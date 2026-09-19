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
  const { data, error } = await admin
    .from('platform_connections')
    .select('id, platform_id, name, type, status, settings, last_sync, connected_at, disconnected_at')
    .eq('user_id', userId)
    .eq('platform_id', 'shopify')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new ShopifyIntegrationError('SHOPIFY_CONNECTION_READ_FAILED', 'Unable to read Shopify connection.', 502)
  const settings = data?.settings && typeof data.settings === 'object'
    ? data.settings as Record<string, unknown>
    : {}
  if (
    !data
    || data.status !== 'active'
    || typeof settings.validated_at !== 'string'
    || typeof settings.shop_domain !== 'string'
    || typeof settings.location_id !== 'string'
  ) return { connected: false, connection: null }
  return {
    connected: true,
    connection: {
      id: data.id,
      platform_id: data.platform_id,
      name: data.name,
      type: 'webstore',
      status: data.status,
      settings,
      last_sync: data.last_sync,
      connected_at: data.connected_at,
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
  const requiredScopes = ['read_products', 'write_products', 'read_inventory', 'write_inventory', 'read_locations']
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

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) })
    }
    if (req.method !== 'POST') {
      throw new ShopifyIntegrationError('METHOD_NOT_ALLOWED', 'Only POST is supported.', 405)
    }

    const user = await authenticatedUser(req)
    const admin = adminClient()
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

    if (action === 'orders' || action === 'webhooks') {
      throw new ShopifyIntegrationError(
        'SHOPIFY_CAPABILITY_NOT_IMPLEMENTED',
        'This Shopify capability is not implemented and no fallback data is available.',
        501,
      )
    }

    throw new ShopifyIntegrationError('SHOPIFY_ACTION_INVALID', 'Unknown Shopify action.', 400)
  } catch (error) {
    return errorResponse(req, error)
  }
})
