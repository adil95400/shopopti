export const SHOPIFY_API_VERSION = '2026-07'

export class ShopifyIntegrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
    public readonly retryable = false,
  ) {
    super(message)
    this.name = 'ShopifyIntegrationError'
  }
}

export function normalizeShopDomain(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ShopifyIntegrationError('SHOPIFY_DOMAIN_REQUIRED', 'A Shopify store domain is required.', 400)
  }

  const raw = value.trim().toLowerCase()
  let url: URL
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    throw new ShopifyIntegrationError('SHOPIFY_DOMAIN_INVALID', 'The Shopify store domain is invalid.', 400)
  }

  const hostname = url.hostname.toLowerCase()
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash ||
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(hostname)
  ) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_DOMAIN_INVALID',
      'Use the canonical store domain, for example store.myshopify.com.',
      400,
    )
  }

  return hostname
}

type FetchLike = typeof fetch

function retryDelayMs(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get('retry-after')
  const parsed = retryAfter ? Number(retryAfter) : Number.NaN
  if (Number.isFinite(parsed) && parsed >= 0) return Math.min(parsed * 1000, 10_000)
  return Math.min(250 * 2 ** attempt, 2_000)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function shopifyGraphQL<T>(options: {
  domain: string
  accessToken: string
  query: string
  variables?: Record<string, unknown>
  fetchImpl?: FetchLike
  maxAttempts?: number
}): Promise<T> {
  const domain = normalizeShopDomain(options.domain)
  if (!options.accessToken || options.accessToken.length < 20) {
    throw new ShopifyIntegrationError('SHOPIFY_TOKEN_INVALID', 'The Shopify access token is invalid.', 400)
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const maxAttempts = options.maxAttempts ?? 3
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetchImpl(
      `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': options.accessToken,
        },
        body: JSON.stringify({ query: options.query, variables: options.variables ?? {} }),
      },
    )
    lastResponse = response

    if (response.status === 429 || response.status >= 500) {
      if (attempt + 1 < maxAttempts) {
        await sleep(retryDelayMs(response, attempt))
        continue
      }
      throw new ShopifyIntegrationError(
        response.status === 429 ? 'SHOPIFY_RATE_LIMITED' : 'SHOPIFY_UNAVAILABLE',
        response.status === 429 ? 'Shopify rate limit reached.' : 'Shopify is temporarily unavailable.',
        response.status === 429 ? 429 : 503,
        true,
      )
    }

    let payload: { data?: T; errors?: Array<{ message?: string; extensions?: { code?: string } }> }
    try {
      payload = await response.json()
    } catch {
      throw new ShopifyIntegrationError('SHOPIFY_RESPONSE_INVALID', 'Shopify returned an invalid response.')
    }

    const throttled = payload.errors?.some(error => error.extensions?.code === 'THROTTLED')
    if (throttled && attempt + 1 < maxAttempts) {
      await sleep(retryDelayMs(response, attempt))
      continue
    }

    if (!response.ok || payload.errors?.length || !payload.data) {
      const message = payload.errors?.map(error => error.message).filter(Boolean).join('; ')
      throw new ShopifyIntegrationError(
        throttled ? 'SHOPIFY_RATE_LIMITED' : response.status === 401 ? 'SHOPIFY_TOKEN_INVALID' : 'SHOPIFY_API_ERROR',
        message || (response.status === 401 ? 'Shopify rejected the access token.' : 'Shopify rejected the request.'),
        throttled ? 429 : response.status === 401 ? 401 : 502,
        throttled,
      )
    }

    return payload.data
  }

  throw new ShopifyIntegrationError(
    'SHOPIFY_UNAVAILABLE',
    `Shopify request failed${lastResponse ? ` with HTTP ${lastResponse.status}` : ''}.`,
    503,
    true,
  )
}

export interface LocalVariant {
  id?: string
  title?: string
  price?: number | string
  sku?: string
  stock?: number
  options?: Record<string, string>
}

export interface LocalProduct {
  id: string
  title: string
  description?: string | null
  price: number | string
  image_url?: string | null
  images?: unknown
  sku?: string | null
  stock?: number | null
  variants?: unknown
  category?: string | null
}

export interface VariantMapping {
  key: string
  variantId: string
  inventoryItemId?: string
}

export interface ExpectedVariantState {
  key: string
  price: string
  sku: string | null
  available: number
}

export interface VerifiedVariantState {
  price: unknown
  sku?: unknown
  available: unknown
}

function finiteMoney(value: unknown, field: string): string {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new ShopifyIntegrationError('SHOPIFY_PRODUCT_INVALID', `${field} must be a valid non-negative number.`, 400)
  }
  return number.toFixed(2)
}

function safeStock(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isInteger(number) || number < 0) {
    throw new ShopifyIntegrationError('SHOPIFY_PRODUCT_INVALID', 'Stock must be a non-negative integer.', 400)
  }
  return number
}

export function localVariantKey(variant: LocalVariant, index: number): string {
  return variant.id?.trim() || variant.sku?.trim() || `index:${index}`
}

export function buildProductSetVariables(options: {
  product: LocalProduct
  locationId: string
  existingProductId?: string | null
  existingVariants?: VariantMapping[]
  priceOverride?: number
  stockOverride?: number
}) {
  const { product, locationId } = options
  if (!product.id || !product.title?.trim()) {
    throw new ShopifyIntegrationError('SHOPIFY_PRODUCT_INVALID', 'Product ID and title are required.', 400)
  }

  const configuredVariants = Array.isArray(product.variants) ? product.variants as LocalVariant[] : []
  if (configuredVariants.length > 100) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_PRODUCT_INVALID',
      'Shopify publication is limited to 100 variants per request until pagination is implemented.',
      422,
    )
  }
  const variants = configuredVariants.length > 0
    ? configuredVariants
    : [{
        title: 'Default Title',
        price: product.price,
        sku: product.sku ?? undefined,
        stock: product.stock ?? 0,
        options: { Title: 'Default Title' },
      }]

  const optionValues = new Map<string, Set<string>>()
  variants.forEach(variant => {
    const values = variant.options && Object.keys(variant.options).length > 0
      ? variant.options
      : { Title: variant.title?.trim() || 'Default Title' }
    Object.entries(values).forEach(([name, value]) => {
      if (!name.trim() || !value.trim()) return
      const entries = optionValues.get(name) ?? new Set<string>()
      entries.add(value)
      optionValues.set(name, entries)
    })
  })
  if (optionValues.size > 3) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_PRODUCT_INVALID',
      'Shopify products support at most three product options.',
      422,
    )
  }

  const existingByKey = new Map((options.existingVariants ?? []).map(mapping => [mapping.key, mapping]))
  const productVariants = variants.map((variant, index) => {
    const key = localVariantKey(variant, index)
    const existing = existingByKey.get(key)
    const values = variant.options && Object.keys(variant.options).length > 0
      ? variant.options
      : { Title: variant.title?.trim() || 'Default Title' }
    const price = options.priceOverride ?? variant.price ?? product.price
    const stock = options.stockOverride ?? variant.stock ?? product.stock ?? 0
    const sku = variant.sku?.trim() || (variants.length === 1 ? product.sku?.trim() : '') || undefined

    return {
      ...(existing?.variantId ? { id: existing.variantId } : {}),
      optionValues: Object.entries(values).map(([optionName, name]) => ({ optionName, name })),
      price: finiteMoney(price, 'Price'),
      ...(sku ? { sku, inventoryItem: { sku, tracked: true } } : { inventoryItem: { tracked: true } }),
      inventoryQuantities: [{ locationId, name: 'available', quantity: safeStock(stock) }],
    }
  })

  const imageCandidates = [
    ...(product.image_url ? [product.image_url] : []),
    ...(Array.isArray(product.images) ? product.images : []),
  ]
  const images = [...new Set(imageCandidates.filter(value => typeof value === 'string' && /^https:\/\//i.test(value)) as string[])]
  if (images.length > 100) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_PRODUCT_INVALID',
      'Shopify publication is limited to 100 images per request until pagination is implemented.',
      422,
    )
  }

  const input = {
    title: product.title.trim(),
    descriptionHtml: product.description ?? '',
    handle: `shopopti-${product.id}`,
    status: 'ACTIVE',
    ...(product.category?.trim() ? { productType: product.category.trim() } : {}),
    productOptions: [...optionValues.entries()].map(([name, values]) => ({
      name,
      values: [...values].map(value => ({ name: value })),
    })),
    variants: productVariants,
    ...(images.length > 0 ? { files: images.map(originalSource => ({ originalSource })) } : {}),
  }

  return {
    input,
    identifier: options.existingProductId
      ? { id: options.existingProductId }
      : { handle: `shopopti-${product.id}` },
    synchronous: true,
    localVariantKeys: variants.map(localVariantKey),
    expectedVariants: productVariants.map((variant, index) => ({
      key: localVariantKey(variants[index], index),
      price: variant.price,
      sku: 'sku' in variant ? variant.sku ?? null : null,
      available: variant.inventoryQuantities[0].quantity,
    })),
  }
}

export function assertVerifiedVariants(
  expected: ExpectedVariantState[],
  actual: VerifiedVariantState[],
) {
  if (actual.length !== expected.length) {
    throw new ShopifyIntegrationError(
      'SHOPIFY_PRODUCT_CONFIRMATION_MISMATCH',
      'Shopify returned a different number of variants than requested.',
      502,
    )
  }

  expected.forEach((expectedVariant, index) => {
    const remote = expectedVariant.sku
      ? actual.find(candidate => candidate.sku === expectedVariant.sku)
      : actual[index]
    const remotePrice = Number(remote?.price)
    if (
      !remote
      || !Number.isFinite(remotePrice)
      || remotePrice.toFixed(2) !== expectedVariant.price
      || remote.available !== expectedVariant.available
    ) {
      throw new ShopifyIntegrationError(
        'SHOPIFY_PRODUCT_CONFIRMATION_MISMATCH',
        'Shopify did not confirm the requested price and inventory values.',
        502,
      )
    }
  })
}

export function assertNoUserErrors(
  errors: Array<{ field?: string[] | null; message?: string | null }> | null | undefined,
  code: string,
) {
  if (!errors?.length) return
  throw new ShopifyIntegrationError(
    code,
    errors.map(error => error.message || error.field?.join('.') || 'Shopify validation failed').join('; '),
    422,
  )
}
