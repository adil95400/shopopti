import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

import {
  SHOPIFY_API_VERSION,
  ShopifyIntegrationError,
  assertNoUserErrors,
  assertVerifiedVariants,
  buildProductSetVariables,
  normalizeShopDomain,
  shopifyGraphQL,
  type LocalProduct,
  type VariantMapping,
} from './core.ts'

type JsonRecord = Record<string, unknown>

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function allowedOrigins(): Set<string> {
  const configured = [
    ...(Deno.env.get('SHOPIFY_ALLOWED_ORIGINS') || '').split(','),
    Deno.env.get('SITE_URL') || '',
    Deno.env.get('APP_URL') || '',
    'http://localhost:8080',
    'http://localhost:5173',
  ]
  return new Set(configured.map(value => value.trim()).filter(Boolean))
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin) return {}
  if (!allowedOrigins().has(origin)) {
    throw new ShopifyIntegrationError('ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.', 403)
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(req: Request, body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function errorResponse(req: Request, error: unknown) {
  let safeError = error instanceof ShopifyIntegrationError
    ? error
    : new ShopifyIntegrationError('SHOPIFY_INTERNAL_ERROR', 'Shopify integration failed.', 500)
  let cors: Record<string, string> = {}
  try {
    cors = corsHeaders(req)
  } catch (originError) {
    safeError = originError instanceof ShopifyIntegrationError
      ? originError
      : new ShopifyIntegrationError('ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.', 403)
  }
  const body = {
    success: false,
    error: {
      code: safeError.code,
      message: safeError.message,
      retryable: safeError.retryable,
    },
  }
  return new Response(JSON.stringify(body), {
    status: safeError.status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function bearerToken(req: Request): string {
  const authorization = req.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new ShopifyIntegrationError('AUTH_REQUIRED', 'Authentication is required.', 401)
  return match[1]
}

async function authenticatedUser(req: Request) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new ShopifyIntegrationError('SHOPIFY_SERVER_CONFIG_MISSING', 'Shopify server configuration is incomplete.', 503)
  }
  const token = bearerToken(req)
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    throw new ShopifyIntegrationError('AUTH_INVALID', 'The authenticated session is invalid.', 401)
  }
  return data.user
}

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function connectionStatus(admin: ReturnType<typeof adminClient>, userId: string) {
  const { data, error } = await admin.rpc('get_shopify_connection_status', { p_user_id: userId })
  const row = Array.isArray(data) ? data[0] : data
  if (error) {
    throw new ShopifyIntegrationError('SHOPIFY_CONNECTION_READ_FAILED', 'Unable to read Shopify connection.', 502)
  }
  const settings = row?.settings && typeof row.settings === 'object'
    ? row.settings as Record<string, unknown>
    : {}
  if (
    !row
    || row.status !== 'active'
    || typeof settings.validated_at !== 'string'
    || typeof settings.shop_domain !== 'string'
    || typeof settings.location_id !== 'string'
  ) return { connected: false, connection: null }

  return {
    connected: true,
    connection: {
      id: row.id,
      platform_id: 'shopify',
      name: row.name,
      type: 'webstore',
      status: 'active',
      settings,
      last_sync: row.last_sync,
      connected_at: row.connected_at,
    },
  }
}

async function connectionSecret(admin: ReturnType<typeof adminClient>, userId: string) {
  const { data, error } = await admin.rpc('get_shopify_connection_secret', { p_user_id: userId })
  const secret = Array.isArray(data) ? data[0] : data
  if (error || !secret?.connection_id || !secret?.shop_domain || !secret?.access_token) {
    throw new ShopifyIntegrationError('SHOPIFY_NOT_CONNECTED', 'No validated Shopify connection is available.', 409)
  }
  return secret as {
    connection_id: string
    shop_domain: string
    access_token: string
    settings: Record<string, unknown> | null
  }
}

const VALIDATE_SHOP_QUERY = `#graphql
  query ValidateShopOptiShopifyConnection {
    shop {
      id
      name
      myshopifyDomain
      plan { displayName }
    }
    currentAppInstallation {
      accessScopes { handle }
    }
    locations(first: 1) {
      nodes { id name }
    }
  }
`

async function validateShop(domain: string, accessToken: string) {
  const data = await shopifyGraphQL<{
    shop: { id: string; name: string; myshopifyDomain: string; plan?: { displayName?: string } | null }
    currentAppInstallation?: { accessScopes?: Array<{ handle: string }> } | null
    locations?: { nodes?: Array<{ id: string; name: string }> }
  }>({ domain, accessToken, query: VALIDATE_SHOP_QUERY })

  const confirmedDomain = normalizeShopDomain(data.shop?.myshopifyDomain)
  if (confirmedDomain !== domain) {
    throw new ShopifyIntegrationError('SHOPIFY_IDENTITY_MISMATCH', 'Shopify returned a different store identity.', 403)
  }

  const scopes = new Set(data.currentAppInstallation?.accessScopes?.map(scope => scope.handle) ?? [])
  const requiredScopes = ['read_products', 'write_products', 'read_inventory', 'write_inventory', 'read_locations', 'read_orders']
  const missingScopes = requiredScopes.filter(scope => !scopes.has(scope))
  if (missingScopes.length > 0) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_SCOPE_MISSING',
      `The Shopify token is missing required scopes: ${missingScopes.join(', ')}.`,
      403,
    )
  }

  const location = data.locations?.nodes?.[0]
  if (!location?.id) {
    throw new ShopifyIntegrationError('SHOPIFY_LOCATION_MISSING', 'No active Shopify inventory location is available.', 422)
  }

  return {
    shopId: data.shop.id,
    shopName: data.shop.name,
    shopDomain: confirmedDomain,
    plan: data.shop.plan?.displayName ?? null,
    scopes: [...scopes].sort(),
    locationId: location.id,
    locationName: location.name,
  }
}

const PRODUCT_SET_MUTATION = `#graphql
  mutation ShopOptiProductSet(
    $input: ProductSetInput!,
    $identifier: ProductSetIdentifiers,
    $synchronous: Boolean!
  ) {
    productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
      product {
        id
        title
        handle
        status
        variants(first: 100) {
          nodes {
            id
            title
            price
            sku
            inventoryItem { id tracked }
          }
        }
        media(first: 100) {
          nodes { id status mediaContentType }
        }
      }
      userErrors { field message }
    }
  }
`

const VERIFY_PRODUCT_QUERY = `#graphql
  query VerifyShopOptiProduct($id: ID!, $locationId: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      variants(first: 100) {
        nodes {
          id
          title
          price
          sku
          inventoryItem {
            id
            tracked
            inventoryLevel(locationId: $locationId) {
              quantities(names: ["available"]) { name quantity }
            }
          }
        }
      }
      media(first: 100) {
        nodes { id status mediaContentType }
      }
    }
  }
`

function sanitizedSnapshot(product: {
  id: string
  title: string
  handle: string
  status: string
  variants?: { nodes?: Array<Record<string, unknown>> }
  media?: { nodes?: Array<Record<string, unknown>> }
}) {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    variants: (product.variants?.nodes ?? []).map(variant => {
      const inventoryItem = variant.inventoryItem as Record<string, unknown> | undefined
      const inventoryLevel = inventoryItem?.inventoryLevel as Record<string, unknown> | undefined
      return {
        id: variant.id,
        title: variant.title,
        price: variant.price,
        sku: variant.sku,
        inventory_item_id: inventoryItem?.id,
        available: Array.isArray(inventoryLevel?.quantities)
          ? (inventoryLevel.quantities as Array<{ name: string; quantity: number }>).find(item => item.name === 'available')?.quantity
          : null,
      }
    }),
    media: (product.media?.nodes ?? []).map(item => ({
      id: item.id,
      status: item.status,
      media_content_type: item.mediaContentType,
    })),
  }
}

async function publishProduct(options: {
  admin: ReturnType<typeof adminClient>
  userId: string
  productId: string
  priceOverride?: number
  stockOverride?: number
}) {
  const { admin, userId, productId } = options
  const secret = await connectionSecret(admin, userId)
  const locationId = typeof secret.settings?.location_id === 'string' ? secret.settings.location_id : ''
  if (!locationId) {
    throw new ShopifyIntegrationError('SHOPIFY_LOCATION_MISSING', 'The Shopify connection has no validated inventory location.', 409)
  }

  const { data: product, error: productError } = await admin
    .from('products')
    .select('id, title, description, price, image_url, images, sku, stock, variants, category')
    .eq('id', productId)
    .eq('user_id', userId)
    .maybeSingle()
  if (productError) throw new ShopifyIntegrationError('SHOPIFY_PRODUCT_READ_FAILED', 'Unable to read the ShopOpti product.', 502)
  if (!product) throw new ShopifyIntegrationError('SHOPIFY_PRODUCT_NOT_FOUND', 'The ShopOpti product was not found.', 404)

  const { data: existingPublication, error: publicationError } = await admin
    .from('shopify_product_publications')
    .select('shopify_product_id, variant_mappings')
    .eq('user_id', userId)
    .eq('connection_id', secret.connection_id)
    .eq('product_id', productId)
    .maybeSingle()
  if (publicationError) throw new ShopifyIntegrationError('SHOPIFY_PUBLICATION_READ_FAILED', 'Unable to read Shopify publication state.', 502)

  const variables = buildProductSetVariables({
    product: product as LocalProduct,
    locationId,
    existingProductId: existingPublication?.shopify_product_id,
    existingVariants: Array.isArray(existingPublication?.variant_mappings)
      ? existingPublication.variant_mappings as VariantMapping[]
      : [],
    priceOverride: options.priceOverride,
    stockOverride: options.stockOverride,
  })
  const {
    localVariantKeys,
    expectedVariants,
    ...graphqlVariables
  } = variables

  const mutation = await shopifyGraphQL<{
    productSet: {
      product: {
        id: string
        title: string
        handle: string
        status: string
        variants: { nodes: Array<{ id: string; title: string; price: string; sku?: string | null; inventoryItem?: { id: string } | null }> }
        media: { nodes: Array<{ id: string; status: string; mediaContentType: string }> }
      } | null
      userErrors: Array<{ field?: string[]; message: string }>
    }
  }>({
    domain: secret.shop_domain,
    accessToken: secret.access_token,
    query: PRODUCT_SET_MUTATION,
    variables: graphqlVariables,
  })
  assertNoUserErrors(mutation.productSet.userErrors, 'SHOPIFY_PRODUCT_REJECTED')
  const remoteProduct = mutation.productSet.product
  if (!remoteProduct?.id || !remoteProduct.variants.nodes.length) {
    throw new ShopifyIntegrationError('SHOPIFY_PRODUCT_CONFIRMATION_MISSING', 'Shopify did not return the published product.', 502)
  }
  const expectedMediaCount = Array.isArray(graphqlVariables.input.files)
    ? graphqlVariables.input.files.length
    : 0
  if (
    expectedMediaCount > 0
    && (
      remoteProduct.media.nodes.length < expectedMediaCount
      || remoteProduct.media.nodes.some(item => item.status === 'FAILED')
    )
  ) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_MEDIA_CONFIRMATION_MISSING',
      'Shopify did not confirm every requested product image.',
      502,
    )
  }

  const verification = await shopifyGraphQL<{
    product: {
      id: string
      title: string
      handle: string
      status: string
      variants: { nodes: Array<Record<string, unknown>> }
      media: { nodes: Array<Record<string, unknown>> }
    } | null
  }>({
    domain: secret.shop_domain,
    accessToken: secret.access_token,
    query: VERIFY_PRODUCT_QUERY,
    variables: { id: remoteProduct.id, locationId },
  })
  if (!verification.product || verification.product.id !== remoteProduct.id) {
    throw new ShopifyIntegrationError('SHOPIFY_PRODUCT_CONFIRMATION_MISSING', 'The Shopify product could not be confirmed after mutation.', 502)
  }

  const snapshot = sanitizedSnapshot(verification.product)
  assertVerifiedVariants(
    expectedVariants,
    snapshot.variants.map(variant => ({
      price: variant.price,
      sku: variant.sku,
      available: variant.available,
    })),
  )

  const variantMappings = expectedVariants.map((expected, index) => {
    const remote = expected.sku
      ? remoteProduct.variants.nodes.find(variant => variant.sku === expected.sku)
      : remoteProduct.variants.nodes[index]
    if (!remote?.id) {
      throw new ShopifyIntegrationError(
        'SHOPIFY_PRODUCT_CONFIRMATION_MISMATCH',
        'Shopify did not return an ID for every requested variant.',
        502,
      )
    }
    return {
      key: localVariantKeys[index] ?? `index:${index}`,
      variantId: remote.id,
      inventoryItemId: remote.inventoryItem?.id,
    }
  })
  const primaryVariant = remoteProduct.variants.nodes[0]
  const operation = existingPublication?.shopify_product_id ? 'updated' : 'created'

  const { error: persistError } = await admin
    .from('shopify_product_publications')
    .upsert({
      user_id: userId,
      connection_id: secret.connection_id,
      product_id: productId,
      shopify_product_id: remoteProduct.id,
      shopify_variant_id: primaryVariant.id,
      shopify_inventory_item_id: primaryVariant.inventoryItem?.id ?? null,
      shopify_location_id: locationId,
      variant_mappings: variantMappings,
      status: 'published',
      last_error: null,
      remote_snapshot: snapshot,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,connection_id,product_id' })
  if (persistError) {
    throw new ShopifyIntegrationError('SHOPIFY_PUBLICATION_PERSIST_FAILED', 'Shopify succeeded but ShopOpti could not persist the remote IDs.', 502)
  }

  const { error: historyError } = await admin.from('sync_history').insert({
    user_id: userId,
    type: options.stockOverride !== undefined ? 'inventory' : options.priceOverride !== undefined ? 'prices' : 'products',
    status: 'success',
    platforms: [{ id: 'shopify', name: 'Shopify', status: 'success' }],
    items_processed: 1,
    items_succeeded: 1,
    items_failed: 0,
    duration: 0,
    initiated_by: 'user',
    details: { product_id: productId, operation },
  })
  if (historyError) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_HISTORY_PERSIST_FAILED',
      'Shopify publication was confirmed, but ShopOpti could not record its sync history.',
      502,
    )
  }

  return { operation, product: snapshot }
}


const ORDERS_QUERY = \`#graphql
  query ShopOptiOrders($first: Int!) {
    orders(first: $first, reverse: true, sortKey: UPDATED_AT) {
      nodes {
        id
        name
        createdAt
        updatedAt
        displayFinancialStatus
        displayFulfillmentStatus
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 100) {
          nodes { id name quantity sku variant { id title } }
        }
      }
    }
  }
\`

const WEBHOOKS_QUERY = \`#graphql
  query ShopOptiWebhookSubscriptions($first: Int!) {
    webhookSubscriptions(first: $first) {
      nodes { id topic uri }
    }
  }
\`

const WEBHOOK_CREATE_MUTATION = \`#graphql
  mutation ShopOptiWebhookCreate(
    $topic: WebhookSubscriptionTopic!,
    $webhookSubscription: WebhookSubscriptionInput!
  ) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription { id topic uri }
      userErrors { field message }
    }
  }
\`

type ShopifyOrderNode = {
  id: string
  name: string
  email?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  displayFinancialStatus?: string | null
  displayFulfillmentStatus?: string | null
  currentTotalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } | null } | null
  customer?: { displayName?: string | null } | null
  lineItems?: { nodes?: Array<Record<string, unknown>> } | null
}

function normalizedOrderRow(
  userId: string,
  connectionId: string,
  order: ShopifyOrderNode,
  source: 'pull' | 'webhook',
) {
  const money = order.currentTotalPriceSet?.shopMoney
  return {
    user_id: userId,
    connection_id: connectionId,
    shopify_order_id: order.id,
    order_name: order.name || order.id,
    email: order.email ?? null,
    customer_name: order.customer?.displayName ?? null,
    financial_status: order.displayFinancialStatus ?? null,
    fulfillment_status: order.displayFulfillmentStatus ?? null,
    total_price: Number(money?.amount ?? 0),
    currency: money?.currencyCode || 'EUR',
    line_items: order.lineItems?.nodes ?? [],
    remote_snapshot: order,
    remote_created_at: order.createdAt ?? null,
    remote_updated_at: order.updatedAt ?? null,
    source,
    updated_at: new Date().toISOString(),
  }
}

async function syncOrders(
  admin: ReturnType<typeof adminClient>,
  userId: string,
) {
  const secret = await connectionSecret(admin, userId)
  const data = await shopifyGraphQL<{ orders: { nodes: ShopifyOrderNode[] } }>({
    domain: secret.shop_domain,
    accessToken: secret.access_token,
    query: ORDERS_QUERY,
    variables: { first: 50 },
  })
  const rows = (data.orders?.nodes ?? []).map(order =>
    normalizedOrderRow(userId, secret.connection_id, order, 'pull')
  )
  if (rows.length > 0) {
    const { error } = await admin
      .from('shopify_orders')
      .upsert(rows, { onConflict: 'user_id,connection_id,shopify_order_id' })
    if (error) {
      throw new ShopifyIntegrationError(
        'SHOPIFY_ORDER_PERSIST_FAILED',
        'Shopify orders were received but could not be persisted.',
        502,
      )
    }
  }
  return rows.map(row => ({
    id: row.shopify_order_id,
    name: row.order_name,
    email: row.email,
    customer_name: row.customer_name,
    created_at: row.remote_created_at,
    updated_at: row.remote_updated_at,
    financial_status: row.financial_status,
    fulfillment_status: row.fulfillment_status,
    total_price: row.total_price,
    currency: row.currency,
    line_items: row.line_items,
  }))
}

async function ensureOrderWebhooks(
  admin: ReturnType<typeof adminClient>,
  userId: string,
) {
  const webhookUrl = (Deno.env.get('SHOPIFY_WEBHOOK_URL') || '').trim()
  const appSecret = (Deno.env.get('SHOPIFY_APP_CLIENT_SECRET') || '').trim()
  if (!webhookUrl || !appSecret) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_WEBHOOK_CONFIG_MISSING',
      'Shopify webhook URL or app client secret is not configured.',
      503,
    )
  }
  if (!/^https:\/\//i.test(webhookUrl)) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_WEBHOOK_URL_INVALID',
      'Shopify webhook URL must use HTTPS.',
      503,
    )
  }

  const secret = await connectionSecret(admin, userId)
  const existing = await shopifyGraphQL<{
    webhookSubscriptions: { nodes: Array<{ id: string; topic: string; uri: string }> }
  }>({
    domain: secret.shop_domain,
    accessToken: secret.access_token,
    query: WEBHOOKS_QUERY,
    variables: { first: 100 },
  })
  const requiredTopics = ['ORDERS_CREATE', 'ORDERS_UPDATED']
  const subscriptions = [...(existing.webhookSubscriptions?.nodes ?? [])]

  for (const topic of requiredTopics) {
    if (subscriptions.some(item => item.topic === topic && item.uri === webhookUrl)) continue
    const created = await shopifyGraphQL<{
      webhookSubscriptionCreate: {
        webhookSubscription: { id: string; topic: string; uri: string } | null
        userErrors: Array<{ field?: string[]; message: string }>
      }
    }>({
      domain: secret.shop_domain,
      accessToken: secret.access_token,
      query: WEBHOOK_CREATE_MUTATION,
      variables: {
        topic,
        webhookSubscription: { uri: webhookUrl },
      },
    })
    assertNoUserErrors(
      created.webhookSubscriptionCreate.userErrors,
      'SHOPIFY_WEBHOOK_REGISTRATION_REJECTED',
    )
    const subscription = created.webhookSubscriptionCreate.webhookSubscription
    if (!subscription?.id || subscription.uri !== webhookUrl) {
      throw new ShopifyIntegrationError(
        'SHOPIFY_WEBHOOK_CONFIRMATION_MISSING',
        'Shopify did not confirm the webhook subscription.',
        502,
      )
    }
    subscriptions.push(subscription)
  }

  return subscriptions.filter(item =>
    requiredTopics.includes(item.topic) && item.uri === webhookUrl
  )
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

async function hmacBase64(secret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

async function sha256Hex(rawBody: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody))
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function handleShopifyWebhook(
  req: Request,
  admin: ReturnType<typeof adminClient>,
): Promise<Response> {
  const topic = (req.headers.get('x-shopify-topic') || '').trim().toLowerCase()
  const shopDomain = normalizeShopDomain(req.headers.get('x-shopify-shop-domain'))
  const deliveryId = (req.headers.get('x-shopify-webhook-id') || '').trim()
  const receivedHmac = (req.headers.get('x-shopify-hmac-sha256') || '').trim()
  const appSecret = (Deno.env.get('SHOPIFY_APP_CLIENT_SECRET') || '').trim()

  if (!topic || !deliveryId || !receivedHmac || !appSecret) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_WEBHOOK_AUTH_MISSING',
      'Shopify webhook authentication metadata is incomplete.',
      401,
    )
  }

  const rawBody = await req.text()
  const expectedHmac = await hmacBase64(appSecret, rawBody)
  if (!safeEqual(receivedHmac, expectedHmac)) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_WEBHOOK_HMAC_INVALID',
      'Shopify webhook signature validation failed.',
      401,
    )
  }

  const { data, error } = await admin.rpc('get_shopify_webhook_connection', {
    p_shop_domain: shopDomain,
  })
  const connection = Array.isArray(data) ? data[0] : data
  if (error || !connection?.connection_id || !connection?.user_id) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_WEBHOOK_STORE_UNKNOWN',
      'The Shopify webhook store is not connected to ShopOpti.',
      404,
    )
  }

  const { error: deliveryError } = await admin
    .from('shopify_webhook_deliveries')
    .insert({
      user_id: connection.user_id,
      connection_id: connection.connection_id,
      delivery_id: deliveryId,
      topic,
      shop_domain: shopDomain,
      payload_sha256: await sha256Hex(rawBody),
    })

  if (deliveryError?.code === '23505') {
    return new Response(null, { status: 200 })
  }
  if (deliveryError) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_WEBHOOK_IDEMPOTENCY_FAILED',
      'Shopify webhook delivery could not be recorded safely.',
      502,
    )
  }

  if (topic !== 'orders/create' && topic !== 'orders/updated') {
    return new Response(null, { status: 204 })
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>
  const numericId = payload.id
  if (numericId === undefined || numericId === null) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_WEBHOOK_ORDER_INVALID',
      'Shopify order webhook did not include an order ID.',
      400,
    )
  }

  const customer = payload.customer && typeof payload.customer === 'object'
    ? payload.customer as Record<string, unknown>
    : {}
  const firstName = typeof customer.first_name === 'string' ? customer.first_name : ''
  const lastName = typeof customer.last_name === 'string' ? customer.last_name : ''
  const currency = typeof payload.currency === 'string'
    ? payload.currency
    : typeof payload.presentment_currency === 'string'
      ? payload.presentment_currency
      : 'EUR'
  const totalRaw = payload.current_total_price ?? payload.total_price ?? 0

  const row = {
    user_id: connection.user_id,
    connection_id: connection.connection_id,
    shopify_order_id: \`gid://shopify/Order/\${String(numericId)}\`,
    order_name: typeof payload.name === 'string' ? payload.name : \`#\${String(numericId)}\`,
    email: typeof payload.email === 'string' ? payload.email : null,
    customer_name: \`\${firstName} \${lastName}\`.trim() || null,
    financial_status: typeof payload.financial_status === 'string' ? payload.financial_status.toUpperCase() : null,
    fulfillment_status: typeof payload.fulfillment_status === 'string'
      ? payload.fulfillment_status.toUpperCase()
      : 'UNFULFILLED',
    total_price: Number(totalRaw),
    currency,
    line_items: Array.isArray(payload.line_items) ? payload.line_items : [],
    remote_snapshot: payload,
    remote_created_at: typeof payload.created_at === 'string' ? payload.created_at : null,
    remote_updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : null,
    source: 'webhook',
    updated_at: new Date().toISOString(),
  }

  const { error: orderError } = await admin
    .from('shopify_orders')
    .upsert(row, { onConflict: 'user_id,connection_id,shopify_order_id' })
  if (orderError) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_WEBHOOK_ORDER_PERSIST_FAILED',
      'The verified Shopify order webhook could not be persisted.',
      502,
    )
  }

  return new Response(null, { status: 200 })
}

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) })
    }
    if (req.method !== 'POST') {
      throw new ShopifyIntegrationError('METHOD_NOT_ALLOWED', 'Only POST is supported.', 405)
    }

    const admin = adminClient()
    if (req.headers.has('x-shopify-hmac-sha256')) {
      return await handleShopifyWebhook(req, admin)
    }

    const user = await authenticatedUser(req)
    const body = await req.json().catch(() => ({})) as JsonRecord
    const action = typeof body.action === 'string' ? body.action : ''

    if (action === 'status') {
      return json(req, { success: true, ...(await connectionStatus(admin, user.id)) })
    }

    if (action === 'validate' || action === 'connect') {
      const domain = normalizeShopDomain(body.store_url)
      const accessToken = typeof body.access_token === 'string' ? body.access_token.trim() : ''
      const identity = await validateShop(domain, accessToken)
      if (action === 'validate') {
        return json(req, { success: true, validated: true, shop: identity })
      }

      const settings = {
        shop_id: identity.shopId,
        shop_domain: identity.shopDomain,
        plan: identity.plan,
        scopes: identity.scopes,
        location_id: identity.locationId,
        location_name: identity.locationName,
        api_version: SHOPIFY_API_VERSION,
        validated_at: new Date().toISOString(),
        oauth_managed: false,
      }
      const { data: connectionId, error } = await admin.rpc('save_shopify_connection', {
        p_user_id: user.id,
        p_shop_domain: identity.shopDomain,
        p_access_token: accessToken,
        p_shop_name: identity.shopName,
        p_settings: settings,
      })
      if (error || !connectionId) {
        throw new ShopifyIntegrationError('SHOPIFY_CONNECTION_PERSIST_FAILED', 'Validated credentials could not be stored securely.', 502)
      }
      const [persistedStatus, persistedSecret] = await Promise.all([
        connectionStatus(admin, user.id),
        connectionSecret(admin, user.id),
      ])
      if (
        !persistedStatus.connected
        || persistedStatus.connection?.id !== connectionId
        || persistedSecret.connection_id !== connectionId
        || persistedSecret.shop_domain !== identity.shopDomain
      ) {
        throw new ShopifyIntegrationError(
          'SHOPIFY_CONNECTION_PERSIST_FAILED',
          'Validated credentials could not be confirmed after persistence.',
          502,
        )
      }
      return json(req, {
        success: true,
        connected: true,
        connection: persistedStatus.connection,
      })
    }

    if (action === 'disconnect') {
      const { data, error } = await admin.rpc('disconnect_shopify_connection', { p_user_id: user.id })
      if (error || data !== true) {
        throw new ShopifyIntegrationError('SHOPIFY_DISCONNECT_FAILED', 'No active Shopify connection was disconnected.', 409)
      }
      return json(req, { success: true, connected: false })
    }

    if (action === 'publication_status') {
      const productId = typeof body.product_id === 'string' ? body.product_id : ''
      if (!productId) throw new ShopifyIntegrationError('SHOPIFY_PRODUCT_ID_REQUIRED', 'Product ID is required.', 400)
      const status = await connectionStatus(admin, user.id)
      if (!status.connected || !status.connection) {
        return json(req, { success: true, published: false, publication: null })
      }
      const { data, error } = await admin
        .from('shopify_product_publications')
        .select('status, shopify_product_id, shopify_variant_id, remote_snapshot, published_at, updated_at')
        .eq('user_id', user.id)
        .eq('connection_id', status.connection.id)
        .eq('product_id', productId)
        .maybeSingle()
      if (error) throw new ShopifyIntegrationError('SHOPIFY_PUBLICATION_READ_FAILED', 'Unable to read publication state.', 502)
      return json(req, { success: true, published: data?.status === 'published', publication: data ?? null })
    }

    if (action === 'publish_product' || action === 'update_price' || action === 'update_inventory') {
      const productId = typeof body.product_id === 'string' ? body.product_id : ''
      if (!productId) throw new ShopifyIntegrationError('SHOPIFY_PRODUCT_ID_REQUIRED', 'Product ID is required.', 400)
      if (action === 'update_price' && typeof body.price !== 'number') {
        throw new ShopifyIntegrationError('SHOPIFY_PRICE_REQUIRED', 'A numeric price is required.', 400)
      }
      if (action === 'update_inventory' && typeof body.stock !== 'number') {
        throw new ShopifyIntegrationError('SHOPIFY_STOCK_REQUIRED', 'A numeric stock quantity is required.', 400)
      }
      const priceOverride = action === 'update_price' && typeof body.price === 'number' ? body.price : undefined
      const stockOverride = action === 'update_inventory' && typeof body.stock === 'number' ? body.stock : undefined
      const result = await publishProduct({ admin, userId: user.id, productId, priceOverride, stockOverride })
      return json(req, { success: true, published: true, confirmed: true, ...result })
    }

    if (action === 'categories') {
      return json(req, { success: true, available: false, categories: [] })
    }

    if (action === 'orders') {
      return json(req, { success: true, orders: await syncOrders(admin, user.id) })
    }

    if (action === 'webhooks') {
      return json(req, {
        success: true,
        configured: true,
        subscriptions: await ensureOrderWebhooks(admin, user.id),
      })
    }

    throw new ShopifyIntegrationError('SHOPIFY_ACTION_INVALID', 'Unknown Shopify action.', 400)
  } catch (error) {
    return errorResponse(req, error)
  }
})
