import { createClient } from 'npm:@supabase/supabase-js@2'
import { getSecureCorsHeaders, handleCorsPreflightSecure } from '../_shared/secure-cors.ts'
import { isSafePublicUrl } from '../_shared/hub-schemas.ts'

const MAX_HTML_BYTES = 2_000_000
const FETCH_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3

function json(data: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function requireStaging(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc('is_shopopti_staging_runtime')
  if (error || data !== true) throw new Error('IMPORT_WORKER_STAGING_ONLY')
}

async function requireInternalToken(req: Request, supabase: ReturnType<typeof createClient>) {
  const provided = req.headers.get('x-shopopti-worker-token')
  const expected = Deno.env.get('IMPORT_WORKER_TOKEN')
  if (expected && provided && provided === expected) return
  if (!provided) throw new Error('IMPORT_WORKER_UNAUTHORIZED')
  const { data, error } = await supabase.rpc('verify_import_worker_token', { p_token: provided })
  if (error || data !== true) throw new Error('IMPORT_WORKER_UNAUTHORIZED')
}

function firstMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function parseJsonLdProduct(html: string): Record<string, unknown> | null {
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.['@graph'])
          ? parsed['@graph']
          : [parsed]
      for (const candidate of candidates) {
        const type = candidate?.['@type']
        if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return candidate
      }
    } catch {
      // Ignore malformed JSON-LD and continue with metadata fallbacks.
    }
  }
  return null
}

async function fetchPublicHtml(url: string, redirects = 0): Promise<{ html: string; finalUrl: string }> {
  if (!isSafePublicUrl(url)) throw new Error('IMPORT_SOURCE_URL_NOT_ALLOWED')
  if (redirects > MAX_REDIRECTS) throw new Error('IMPORT_SOURCE_TOO_MANY_REDIRECTS')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ShopOpti-Import-Worker/1.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7',
      },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('IMPORT_SOURCE_REDIRECT_MISSING_LOCATION')
      const nextUrl = new URL(location, url).toString()
      return await fetchPublicHtml(nextUrl, redirects + 1)
    }

    if (!response.ok) throw new Error(`IMPORT_SOURCE_HTTP_${response.status}`)

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('IMPORT_SOURCE_CONTENT_TYPE_UNSUPPORTED')
    }

    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > MAX_HTML_BYTES) throw new Error('IMPORT_SOURCE_BODY_TOO_LARGE')

    const html = await response.text()
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
      throw new Error('IMPORT_SOURCE_BODY_TOO_LARGE')
    }
    return { html, finalUrl: url }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('IMPORT_SOURCE_TIMEOUT')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function extractProduct(sourceUrl: string, sourceId: string, sourceProductId: string | null) {
  const { html, finalUrl } = await fetchPublicHtml(sourceUrl)
  const product = parseJsonLdProduct(html)
  const offers = Array.isArray(product?.offers) ? product?.offers?.[0] : product?.offers
  const brandValue = product?.brand
  const brand = typeof brandValue === 'string'
    ? brandValue
    : typeof brandValue === 'object' && brandValue !== null
      ? String((brandValue as Record<string, unknown>).name || '')
      : ''

  const title = decodeBasicEntities(String(
    product?.name ||
    firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]) ||
    ''
  )).trim()

  if (!title) throw new Error('IMPORT_EXTRACTION_TITLE_MISSING')

  const description = decodeBasicEntities(String(
    product?.description ||
    firstMatch(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    ]) ||
    ''
  )).trim()

  const imageValues = product?.image
  const images = (Array.isArray(imageValues) ? imageValues : imageValues ? [imageValues] : [])
    .map((image) => typeof image === 'string' ? image : String((image as Record<string, unknown>)?.url || ''))
    .filter(Boolean)
  const ogImage = firstMatch(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ])
  if (ogImage && !images.includes(ogImage)) images.push(ogImage)

  const rawPrice = (offers as Record<string, unknown> | undefined)?.price
    ?? (offers as Record<string, unknown> | undefined)?.lowPrice
    ?? firstMatch(html, [
      /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
      /itemprop=["']price["'][^>]+content=["']([^"']+)["']/i,
    ])
  const price = rawPrice == null || rawPrice === '' ? null : Number(String(rawPrice).replace(',', '.'))

  const extracted = {
    contract: 'shopopti_extracted_product_v1',
    extraction_method: 'generic_html_v1',
    extracted_at: new Date().toISOString(),
    source: {
      id: sourceId,
      product_id: sourceProductId,
      requested_url: sourceUrl,
      final_url: finalUrl,
    },
    product: {
      title,
      description,
      price: Number.isFinite(price) ? price : null,
      currency: String((offers as Record<string, unknown> | undefined)?.priceCurrency || ''),
      brand: brand || null,
      sku: product?.sku ? String(product.sku) : null,
      gtin: product?.gtin13
        ? String(product.gtin13)
        : product?.gtin14
          ? String(product.gtin14)
          : product?.gtin
            ? String(product.gtin)
            : null,
      images: images.slice(0, 20),
      availability: (offers as Record<string, unknown> | undefined)?.availability
        ? String((offers as Record<string, unknown>).availability)
        : null,
    },
  }

  return extracted
}


function isVerifiedPreloadedSnapshotForJob(
  snapshot: unknown,
  job: Record<string, unknown>,
): snapshot is Record<string, unknown> {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false
  const record = snapshot as Record<string, unknown>
  if (record.contract !== 'shopopti_extracted_product_v1') return false
  if (record.extraction_method !== 'extension_verified_v1') return false

  const source = record.source && typeof record.source === 'object' && !Array.isArray(record.source)
    ? record.source as Record<string, unknown>
    : null
  const product = record.product && typeof record.product === 'object' && !Array.isArray(record.product)
    ? record.product as Record<string, unknown>
    : null

  if (!source || !product) return false
  if (String(source.id || '') !== String(job.source_id || '')) return false
  if (String(product.title || '').trim() === '') return false

  const jobProductId = job.source_product_id ? String(job.source_product_id) : null
  const snapshotProductId = source.product_id ? String(source.product_id) : null
  if (jobProductId !== snapshotProductId) return false

  const jobUrl = job.source_url ? String(job.source_url) : null
  const snapshotUrl = source.requested_url ? String(source.requested_url) : null
  if (jobUrl !== snapshotUrl) return false

  return true
}

function normalizeExtractedProduct(extracted: Record<string, unknown>) {
  if (extracted?.contract !== 'shopopti_extracted_product_v1') {
    throw new Error('IMPORT_NORMALIZATION_CONTRACT_UNSUPPORTED')
  }

  const source = (extracted.source && typeof extracted.source === 'object')
    ? extracted.source as Record<string, unknown>
    : {}
  const product = (extracted.product && typeof extracted.product === 'object')
    ? extracted.product as Record<string, unknown>
    : {}

  const title = String(product.title || '').trim()
  if (!title) throw new Error('IMPORT_NORMALIZATION_TITLE_MISSING')

  const description = String(product.description || '').trim()
  const rawPrice = product.price
  const price = typeof rawPrice === 'number' && Number.isFinite(rawPrice) && rawPrice >= 0
    ? rawPrice
    : null
  const currencyRaw = String(product.currency || '').trim().toUpperCase()
  const currency = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : null

  const finalUrl = String(source.final_url || source.requested_url || '').trim()
  const rawImages = Array.isArray(product.images) ? product.images : []
  const images: string[] = []
  for (const value of rawImages) {
    const raw = String(value || '').trim()
    if (!raw) continue
    try {
      const resolved = finalUrl ? new URL(raw, finalUrl).toString() : raw
      if (isSafePublicUrl(resolved) && !images.includes(resolved)) images.push(resolved)
    } catch {
      // Invalid image URLs are omitted rather than guessed or rewritten.
    }
    if (images.length >= 30) break
  }

  const sku = String(product.sku || '').trim() || null
  const gtin = String(product.gtin || '').trim() || null
  const ean = String(product.ean || '').trim() || null
  const upc = String(product.upc || '').trim() || null
  const mpn = String(product.mpn || '').trim() || null
  const rawCompareAtPrice = product.compareAtPrice
  const compareAtPrice = typeof rawCompareAtPrice === 'number' && Number.isFinite(rawCompareAtPrice)
    && price !== null && rawCompareAtPrice > price ? rawCompareAtPrice : null
  const rawDiscountPercent = product.discountPercent
  const discountPercent = typeof rawDiscountPercent === 'number' && Number.isFinite(rawDiscountPercent)
    && rawDiscountPercent >= 0 && rawDiscountPercent <= 100 ? rawDiscountPercent : null
  const priceValidUntil = String(product.priceValidUntil || '').trim() || null
  const brand = String(product.brand || '').trim() || null
  const seller = String(product.seller || '').trim() || null
  const category = String(product.category || '').trim() || null
  const breadcrumbs = Array.isArray(product.breadcrumbs)
    ? product.breadcrumbs.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 20)
    : []
  const minimumOrderQuantity = typeof product.minimumOrderQuantity === 'number' && Number.isFinite(product.minimumOrderQuantity) && product.minimumOrderQuantity >= 0
    ? product.minimumOrderQuantity : null
  const packSize = typeof product.packSize === 'number' && Number.isFinite(product.packSize) && product.packSize > 0
    ? product.packSize : null
  const canonicalUrl = String(product.canonicalUrl || source.final_url || '').trim() || null
  const condition = String(product.condition || '').trim() || null
  const taxIncluded = typeof product.taxIncluded === 'boolean' ? product.taxIncluded : null
  const priceCountry = String(product.priceCountry || '').trim() || null
  const soldCount = typeof product.soldCount === 'number' && Number.isFinite(product.soldCount) && product.soldCount >= 0
    ? Math.trunc(product.soldCount) : null
  const sellerDetails = product.sellerDetails && typeof product.sellerDetails === 'object' && !Array.isArray(product.sellerDetails)
    ? product.sellerDetails as Record<string, unknown> : null
  const model = String(product.model || '').trim() || null
  const weight = typeof product.weight === 'number' && Number.isFinite(product.weight) ? product.weight : null
  const weightUnit = String(product.weightUnit || '').trim() || null
  const dimensions = product.dimensions && typeof product.dimensions === 'object' && !Array.isArray(product.dimensions)
    ? product.dimensions as Record<string, unknown>
    : null
  const sourceKeywords = Array.isArray(product.sourceKeywords)
    ? product.sourceKeywords.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 50)
    : []
  const sourceTags = Array.isArray(product.sourceTags)
    ? product.sourceTags.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 30)
    : []
  const attributes = product.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes)
    ? product.attributes as Record<string, unknown>
    : {}
  const shippingInfo = Array.isArray(product.shipping)
    ? product.shipping.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)).slice(0, 20)
    : []
  const videos = Array.isArray(product.videos)
    ? product.videos.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 10)
    : []
  const reviews = Array.isArray(product.reviews)
    ? product.reviews.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)).slice(0, 500)
    : []
  const rawRating = product.aggregateRating
  const rating = typeof rawRating === 'number' && Number.isFinite(rawRating) ? rawRating : null
  const reviewDistribution = product.reviewDistribution && typeof product.reviewDistribution === 'object' && !Array.isArray(product.reviewDistribution)
    ? product.reviewDistribution as Record<string, unknown>
    : null
  const reviewPagination = product.reviewPagination && typeof product.reviewPagination === 'object' && !Array.isArray(product.reviewPagination)
    ? product.reviewPagination as Record<string, unknown>
    : null
  const rawReviewCount = product.reviewCount
  const reviewCount = typeof rawReviewCount === 'number' && Number.isFinite(rawReviewCount) && rawReviewCount >= 0
    ? Math.trunc(rawReviewCount)
    : null
  const variants = Array.isArray(product.variants)
    ? product.variants
      .filter((variant) => variant && typeof variant === 'object' && !Array.isArray(variant))
      .slice(0, 200)
    : []
  const availability = String(product.availability || '').trim()
  const available = availability
    ? /(?:InStock|LimitedAvailability|PreOrder|PreSale)$/i.test(availability)
      ? true
      : /(?:OutOfStock|SoldOut|Discontinued)$/i.test(availability)
        ? false
        : null
    : null

  const requiredSignals = [
    Boolean(title),
    Boolean(description),
    price !== null,
    currency !== null,
    images.length > 0,
    Boolean(sku || gtin || source.product_id),
    Boolean(brand),
  ]
  const completenessScore = Math.round(
    (requiredSignals.filter(Boolean).length / requiredSignals.length) * 100,
  )

  const issues: Array<Record<string, unknown>> = []
  if (price === null) issues.push({ code: 'PRICE_MISSING', severity: 'warning', field: 'price' })
  if (currency === null) issues.push({ code: 'CURRENCY_MISSING', severity: 'warning', field: 'currency' })
  if (images.length === 0) issues.push({ code: 'IMAGES_MISSING', severity: 'warning', field: 'images' })
  if (!description) issues.push({ code: 'DESCRIPTION_MISSING', severity: 'warning', field: 'description' })

  const normalized = {
    contract: 'shopopti_normalized_product_v1',
    normalized_at: new Date().toISOString(),
    title,
    description,
    shortDescription: null,
    price,
    costPrice: null,
    compareAtPrice,
    currency,
    sku,
    barcode: null,
    identifiers: {
      sku,
      ean,
      gtin,
      upc,
      mpn,
      asin: null,
      sourceProductId: source.product_id ? String(source.product_id) : null,
    },
    images,
    videos,
    category,
    subCategory: null,
    categoryPath: breadcrumbs,
    breadcrumbs,
    brand,
    stock: null,
    available,
    weight,
    weightUnit,
    dimensions,
    variants,
    options: [],
    attributes,
    sourceKeywords,
    sourceTags,
    specifications: { model },
    tags: [],
    keywords: [],
    seoTitle: null,
    seoDescription: null,
    seo: null,
    promotion: {
      discountPercent,
      priceValidUntil,
    },
    sourceUrl: source.requested_url ? String(source.requested_url) : null,
    canonicalUrl,
    sourceId: source.id ? String(source.id) : null,
    sourcePlatform: source.id ? String(source.id) : null,
    reviews,
    reviewDistribution,
    reviewPagination,
    rating,
    reviewCount,
    soldCount,
    shippingInfo,
    supplier: sellerDetails,
    seller,
    minimumOrderQuantity,
    packSize,
    condition,
    taxIncluded,
    priceCountry,
    qualityScore: null,
    completenessScore,
    sourceAttribution: {
      title: { source: 'html', confidence: 1, extractedAt: String(extracted.extracted_at || '') },
      description: { source: 'html', confidence: description ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      price: { source: 'html', confidence: price !== null ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      compareAtPrice: { source: 'snapshot', confidence: compareAtPrice !== null ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      images: { source: 'html', confidence: images.length > 0 ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      videos: { source: 'snapshot', confidence: videos.length > 0 ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      reviews: { source: 'snapshot', confidence: reviews.length > 0 ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      reviewDistribution: { source: 'snapshot', confidence: reviewDistribution ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      reviewPagination: { source: 'snapshot', confidence: reviewPagination ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      breadcrumbs: { source: 'snapshot', confidence: breadcrumbs.length > 0 ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      sellerDetails: { source: 'snapshot', confidence: sellerDetails ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      commerceContext: { source: 'snapshot', confidence: minimumOrderQuantity !== null || packSize !== null || condition !== null || taxIncluded !== null || priceCountry !== null || soldCount !== null ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      shipping: { source: 'snapshot', confidence: shippingInfo.length > 0 ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      sourceKeywords: { source: 'snapshot', confidence: sourceKeywords.length > 0 ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      sourceTags: { source: 'snapshot', confidence: sourceTags.length > 0 ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
      identifiers: { source: 'html', confidence: sku || gtin || ean || upc || mpn ? 1 : 0, extractedAt: String(extracted.extracted_at || '') },
    },
    status: issues.length === 0 ? 'draft' : 'error_incomplete',
  }

  return { normalized, issues }
}

type DedupSignal = {
  key: 'source_url' | 'gtin' | 'ean' | 'upc' | 'barcode' | 'sku'
  column: 'source_url' | 'gtin' | 'ean' | 'upc' | 'barcode' | 'sku'
  value: string
}

async function deduplicateNormalizedProduct(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  normalized: Record<string, unknown>,
) {
  const identifiers = (normalized.identifiers && typeof normalized.identifiers === 'object')
    ? normalized.identifiers as Record<string, unknown>
    : {}

  const candidates: Array<DedupSignal | null> = [
    normalized.sourceUrl
      ? { key: 'source_url', column: 'source_url', value: String(normalized.sourceUrl).trim() }
      : null,
    identifiers.gtin
      ? { key: 'gtin', column: 'gtin', value: String(identifiers.gtin).trim() }
      : null,
    identifiers.ean
      ? { key: 'ean', column: 'ean', value: String(identifiers.ean).trim() }
      : null,
    identifiers.upc
      ? { key: 'upc', column: 'upc', value: String(identifiers.upc).trim() }
      : null,
    normalized.barcode
      ? { key: 'barcode', column: 'barcode', value: String(normalized.barcode).trim() }
      : null,
    normalized.sku
      ? { key: 'sku', column: 'sku', value: String(normalized.sku).trim() }
      : null,
  ]

  const signals = candidates.filter(
    (signal): signal is DedupSignal => Boolean(signal?.value),
  )

  const matchedByProduct = new Map<string, Set<string>>()
  const signalResults: Array<{ signal: string; match_count: number }> = []
  let hasNonUniqueSignal = false

  for (const signal of signals) {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('user_id', userId)
      .eq(signal.column, signal.value)
      .limit(3)

    if (error) throw new Error(`IMPORT_DEDUP_QUERY_FAILED_${signal.key.toUpperCase()}`)

    const rows = Array.isArray(data) ? data : []
    signalResults.push({ signal: signal.key, match_count: rows.length })
    if (rows.length > 1) hasNonUniqueSignal = true

    for (const row of rows) {
      const productId = String((row as Record<string, unknown>).id || '')
      if (!productId) continue
      const matchedSignals = matchedByProduct.get(productId) || new Set<string>()
      matchedSignals.add(signal.key)
      matchedByProduct.set(productId, matchedSignals)
    }
  }

  const matches = [...matchedByProduct.entries()].map(([productId, matchedSignals]) => ({
    product_id: productId,
    signals: [...matchedSignals].sort(),
  }))
  const ambiguous = hasNonUniqueSignal || matches.length > 1
  const duplicate = !ambiguous && matches.length === 1

  return {
    contract: 'shopopti_dedup_evidence_v1',
    checked_at: new Date().toISOString(),
    strategy: 'exact_user_scoped_v1',
    signal_results: signalResults,
    matches,
    decision: ambiguous ? 'review' : duplicate ? 'duplicate' : 'unique',
    duplicate_product_id: duplicate ? matches[0].product_id : null,
    review_required: ambiguous,
  }
}


function mapNormalizedVariants(normalized: Record<string, unknown>) {
  const rawVariants = normalized.variants
  if (rawVariants == null) {
    return {
      contract: 'shopopti_variant_mapping_v1',
      strategy: 'no_variants',
      variants: [],
      review_required: false,
      issues: [],
    }
  }

  if (!Array.isArray(rawVariants)) {
    return {
      contract: 'shopopti_variant_mapping_v1',
      strategy: 'invalid_variants',
      variants: [],
      review_required: true,
      issues: [{
        code: 'VARIANTS_NOT_ARRAY',
        severity: 'warning',
        field: 'variants',
      }],
    }
  }

  const invalidVariant = rawVariants.some(
    (variant) => !variant || typeof variant !== 'object' || Array.isArray(variant),
  )

  return {
    contract: 'shopopti_variant_mapping_v1',
    strategy: rawVariants.length === 0 ? 'no_variants' : 'identity_v1',
    variants: invalidVariant ? [] : rawVariants,
    review_required: invalidVariant,
    issues: invalidVariant
      ? [{ code: 'VARIANT_SHAPE_INVALID', severity: 'warning', field: 'variants' }]
      : [],
  }
}

function validateNormalizedProduct(
  normalized: Record<string, unknown>,
  normalizationIssues: Array<Record<string, unknown>>,
  variantIssues: Array<Record<string, unknown>>,
) {
  const issues = [...normalizationIssues, ...variantIssues]
  const title = String(normalized.title || '').trim()

  if (!title) {
    issues.push({
      code: 'TITLE_REQUIRED',
      severity: 'error',
      field: 'title',
    })
  }

  return {
    contract: 'shopopti_import_validation_v1',
    validated_at: new Date().toISOString(),
    review_required: issues.length > 0,
    issues,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightSecure(req)
  const corsHeaders = getSecureCorsHeaders(req)

  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, corsHeaders)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ error: 'IMPORT_WORKER_CONFIG_MISSING' }, 503, corsHeaders)

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await requireStaging(supabase)
    await requireInternalToken(req, supabase)

    const body = await req.json().catch(() => ({}))
    const workerId = typeof body.worker_id === 'string' && body.worker_id.trim()
      ? body.worker_id.trim().slice(0, 128)
      : 'shopopti-import-staging'
    const leaseSeconds = Number.isInteger(body.lease_seconds)
      ? Math.min(300, Math.max(30, body.lease_seconds))
      : 120

    const { data: claimedRows, error: claimError } = await supabase.rpc(
      'claim_import_pipeline_job',
      { p_worker_id: workerId, p_lease_seconds: leaseSeconds },
    )
    if (claimError) return json({ error: 'IMPORT_CLAIM_FAILED', detail: claimError.message }, 502, corsHeaders)

    const job = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows
    if (!job?.job_id) return json({ ok: true, status: 'idle', worker_id: workerId }, 200, corsHeaders)

    const { data: heartbeatOk, error: heartbeatError } = await supabase.rpc(
      'heartbeat_import_pipeline_job',
      {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
        p_worker_id: workerId,
        p_lease_seconds: leaseSeconds,
      },
    )

    if (heartbeatError || heartbeatOk !== true) {
      return json({
        error: 'IMPORT_HEARTBEAT_FAILED',
        job_id: job.job_id,
        detail: heartbeatError?.message || 'heartbeat returned false',
      }, 409, corsHeaders)
    }

    if (job.stage !== 'QUEUED' && job.stage !== 'RETRYING') {
      return json({
        error: 'IMPORT_STAGE_NOT_EXECUTABLE',
        job_id: job.job_id,
        stage: job.stage,
      }, 409, corsHeaders)
    }

    const { data: extractingStage, error: startError } = await supabase.rpc(
      'checkpoint_import_pipeline_job',
      {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
        p_worker_id: workerId,
        p_expected_stage: job.stage,
        p_next_stage: 'EXTRACTING',
      },
    )

    if (startError || extractingStage !== 'EXTRACTING') {
      return json({
        error: 'IMPORT_STAGE_CHECKPOINT_FAILED',
        job_id: job.job_id,
        detail: startError?.message || 'checkpoint returned unexpected stage',
      }, 409, corsHeaders)
    }

    try {
      const { data: pipelineState, error: pipelineStateError } = await supabase
        .from('import_pipeline_states')
        .select('extracted_product')
        .eq('job_id', job.job_id)
        .eq('user_id', job.user_id)
        .maybeSingle()

      if (pipelineStateError) throw new Error('IMPORT_PRELOADED_SNAPSHOT_READ_FAILED')

      let extractedProduct: Record<string, unknown>

      if (pipelineState?.extracted_product != null) {
        if (!isVerifiedPreloadedSnapshotForJob(pipelineState.extracted_product, job)) {
          throw new Error('IMPORT_PRELOADED_SNAPSHOT_INVALID')
        }
        extractedProduct = pipelineState.extracted_product as Record<string, unknown>
      } else {
        if (!job.source_url) throw new Error('IMPORT_EXTRACTION_SOURCE_URL_REQUIRED')
        extractedProduct = await extractProduct(
          job.source_url,
          job.source_id,
          job.source_product_id || null,
        )
      }

      const { data: postFetchHeartbeat, error: postFetchHeartbeatError } = await supabase.rpc(
        'heartbeat_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_lease_seconds: leaseSeconds,
        },
      )
      if (postFetchHeartbeatError || postFetchHeartbeat !== true) {
        return json({
          error: 'IMPORT_HEARTBEAT_FAILED_AFTER_EXTRACTION',
          job_id: job.job_id,
          detail: postFetchHeartbeatError?.message || 'heartbeat returned false',
        }, 409, corsHeaders)
      }

      const { data: extractedStage, error: extractedError } = await supabase.rpc(
        'checkpoint_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_expected_stage: 'EXTRACTING',
          p_next_stage: 'EXTRACTED',
          p_extracted_product: extractedProduct,
        },
      )

      if (extractedError || extractedStage !== 'EXTRACTED') {
        return json({
          error: 'IMPORT_EXTRACTION_CHECKPOINT_FAILED',
          job_id: job.job_id,
          detail: extractedError?.message || 'checkpoint returned unexpected stage',
        }, 409, corsHeaders)
      }

      const { data: normalizingStage, error: normalizingError } = await supabase.rpc(
        'checkpoint_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_expected_stage: 'EXTRACTED',
          p_next_stage: 'NORMALIZING',
        },
      )

      if (normalizingError || normalizingStage !== 'NORMALIZING') {
        return json({
          error: 'IMPORT_NORMALIZING_CHECKPOINT_FAILED',
          job_id: job.job_id,
          detail: normalizingError?.message || 'checkpoint returned unexpected stage',
        }, 409, corsHeaders)
      }

      const { normalized, issues } = normalizeExtractedProduct(extractedProduct)

      const { data: normalizedStage, error: normalizedError } = await supabase.rpc(
        'checkpoint_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_expected_stage: 'NORMALIZING',
          p_next_stage: 'NORMALIZED',
          p_normalized_product: normalized,
          p_issues: issues,
        },
      )

      if (normalizedError || normalizedStage !== 'NORMALIZED') {
        return json({
          error: 'IMPORT_NORMALIZED_CHECKPOINT_FAILED',
          job_id: job.job_id,
          detail: normalizedError?.message || 'checkpoint returned unexpected stage',
        }, 409, corsHeaders)
      }

      const { data: deduplicatingStage, error: deduplicatingError } = await supabase.rpc(
        'checkpoint_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_expected_stage: 'NORMALIZED',
          p_next_stage: 'DEDUPLICATING',
        },
      )

      if (deduplicatingError || deduplicatingStage !== 'DEDUPLICATING') {
        return json({
          error: 'IMPORT_DEDUPLICATING_CHECKPOINT_FAILED',
          job_id: job.job_id,
          detail: deduplicatingError?.message || 'checkpoint returned unexpected stage',
        }, 409, corsHeaders)
      }

      const dedupEvidence = await deduplicateNormalizedProduct(
        supabase,
        job.user_id,
        normalized,
      )
      const dedupStage = dedupEvidence.review_required ? 'NEEDS_DEDUP_REVIEW' : 'DEDUPED'

      const { data: finalDedupStage, error: dedupError } = await supabase.rpc(
        'checkpoint_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_expected_stage: 'DEDUPLICATING',
          p_next_stage: dedupStage,
          p_dedup_evidence: dedupEvidence,
        },
      )

      if (dedupError || finalDedupStage !== dedupStage) {
        return json({
          error: 'IMPORT_DEDUP_CHECKPOINT_FAILED',
          job_id: job.job_id,
          detail: dedupError?.message || 'checkpoint returned unexpected stage',
        }, 409, corsHeaders)
      }

      if (dedupEvidence.review_required) {
        return json({
          ok: true,
          status: 'needs_dedup_review',
          worker_id: workerId,
          job: {
            job_id: job.job_id,
            previous_stage: job.stage,
            stage: finalDedupStage,
            source_id: job.source_id,
            source_product_id: job.source_product_id,
            source_url: job.source_url,
            attempt: job.attempt,
            max_attempts: job.max_attempts,
          },
          deduplication: {
            contract: dedupEvidence.contract,
            strategy: dedupEvidence.strategy,
            decision: dedupEvidence.decision,
            review_required: true,
            match_count: dedupEvidence.matches.length,
          },
        }, 200, corsHeaders)
      }

      const { data: mappingStage, error: mappingStageError } = await supabase.rpc(
        'checkpoint_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_expected_stage: 'DEDUPED',
          p_next_stage: 'MAPPING_VARIANTS',
        },
      )
      if (mappingStageError || mappingStage !== 'MAPPING_VARIANTS') {
        return json({
          error: 'IMPORT_VARIANT_MAPPING_STAGE_FAILED',
          job_id: job.job_id,
          detail: mappingStageError?.message || 'checkpoint returned unexpected stage',
        }, 409, corsHeaders)
      }

      const variantMapping = mapNormalizedVariants(normalized)
      const variantStage = variantMapping.review_required
        ? 'NEEDS_VARIANT_REVIEW'
        : 'VARIANTS_MAPPED'

      const { data: mappedStage, error: mappedStageError } = await supabase.rpc(
        'checkpoint_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_expected_stage: 'MAPPING_VARIANTS',
          p_next_stage: variantStage,
          p_variant_mapping: variantMapping,
          p_issues: variantMapping.issues,
        },
      )
      if (mappedStageError || mappedStage !== variantStage) {
        return json({
          error: 'IMPORT_VARIANT_MAPPING_CHECKPOINT_FAILED',
          job_id: job.job_id,
          detail: mappedStageError?.message || 'checkpoint returned unexpected stage',
        }, 409, corsHeaders)
      }

      if (variantMapping.review_required) {
        return json({
          ok: true,
          status: 'needs_variant_review',
          worker_id: workerId,
          job: { job_id: job.job_id, stage: mappedStage },
          variant_mapping: {
            contract: variantMapping.contract,
            strategy: variantMapping.strategy,
            review_required: true,
          },
        }, 200, corsHeaders)
      }

      const { data: validatingStage, error: validatingStageError } = await supabase.rpc(
        'checkpoint_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_expected_stage: 'VARIANTS_MAPPED',
          p_next_stage: 'VALIDATING',
        },
      )
      if (validatingStageError || validatingStage !== 'VALIDATING') {
        return json({
          error: 'IMPORT_VALIDATION_STAGE_FAILED',
          job_id: job.job_id,
          detail: validatingStageError?.message || 'checkpoint returned unexpected stage',
        }, 409, corsHeaders)
      }

      const validation = validateNormalizedProduct(
        normalized,
        issues,
        variantMapping.issues,
      )
      const validationStage = validation.review_required
        ? 'NEEDS_VALIDATION_REVIEW'
        : 'READY'

      const { data: finalStage, error: validationError } = await supabase.rpc(
        'checkpoint_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_expected_stage: 'VALIDATING',
          p_next_stage: validationStage,
          p_issues: validation.issues,
        },
      )
      if (validationError || finalStage !== validationStage) {
        return json({
          error: 'IMPORT_VALIDATION_CHECKPOINT_FAILED',
          job_id: job.job_id,
          detail: validationError?.message || 'checkpoint returned unexpected stage',
        }, 409, corsHeaders)
      }

      let draftPersistence: Record<string, unknown> | null = null
      if (finalStage === 'READY') {
        const { data: persistedDraft, error: persistenceError } = await supabase.rpc(
          'persist_ready_import_pipeline_draft',
          {
            p_job_id: job.job_id,
            p_lease_token: job.lease_token,
            p_worker_id: workerId,
          },
        )

        if (persistenceError || !persistedDraft?.success) {
          throw new Error(
            persistenceError?.message || 'IMPORT_DRAFT_PERSISTENCE_FAILED',
          )
        }

        draftPersistence = persistedDraft as Record<string, unknown>

        const { data: completedDraftStage, error: completeDraftError } = await supabase.rpc(
          'complete_import_pipeline_draft_job',
          {
            p_job_id: job.job_id,
            p_lease_token: job.lease_token,
            p_worker_id: workerId,
          },
        )

        if (completeDraftError || completedDraftStage !== 'READY') {
          throw new Error(
            completeDraftError?.message || 'IMPORT_DRAFT_COMPLETION_FAILED',
          )
        }
      }

      return json({
        ok: true,
        status: validation.review_required ? 'needs_validation_review' : 'ready',
        worker_id: workerId,
        job: {
          job_id: job.job_id,
          previous_stage: job.stage,
          stage: finalStage,
          source_id: job.source_id,
          source_product_id: job.source_product_id,
          source_url: job.source_url,
          attempt: job.attempt,
          max_attempts: job.max_attempts,
        },
        extraction: {
          method: extractedProduct.extraction_method,
          title_present: Boolean(extractedProduct.product.title),
          image_count: extractedProduct.product.images.length,
        },
        normalization: {
          contract: normalized.contract,
          completeness_score: normalized.completenessScore,
          issue_count: issues.length,
        },
        deduplication: {
          contract: dedupEvidence.contract,
          strategy: dedupEvidence.strategy,
          decision: dedupEvidence.decision,
          review_required: false,
          match_count: dedupEvidence.matches.length,
        },
        variant_mapping: {
          contract: variantMapping.contract,
          strategy: variantMapping.strategy,
          review_required: variantMapping.review_required,
        },
        validation: {
          contract: validation.contract,
          review_required: validation.review_required,
          issue_count: validation.issues.length,
        },
        draft: draftPersistence
          ? {
              persisted: true,
              code: draftPersistence.code,
              draft_id: draftPersistence.draft_id,
            }
          : {
              persisted: false,
              code: 'review_required',
            },
      }, 200, corsHeaders)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'IMPORT_EXTRACTION_FAILED'
      const { data: retryState, error: retryError } = await supabase.rpc(
        'retry_import_pipeline_job',
        {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_worker_id: workerId,
          p_error: { code: message, message },
        },
      )

      if (retryError) {
        return json({
          error: 'IMPORT_EXTRACTION_RETRY_FAILED',
          job_id: job.job_id,
          detail: retryError.message,
        }, 500, corsHeaders)
      }

      return json({
        ok: false,
        status: retryState === 'DEAD_LETTERED' ? 'dead_lettered' : 'retrying',
        worker_id: workerId,
        job: {
          job_id: job.job_id,
          stage: retryState,
          attempt: job.attempt,
          max_attempts: job.max_attempts,
        },
        error: message,
      }, retryState === 'DEAD_LETTERED' ? 422 : 202, corsHeaders)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'IMPORT_WORKER_UNKNOWN'
    if (message === 'IMPORT_WORKER_STAGING_ONLY') return json({ error: message }, 403, corsHeaders)
    if (message === 'IMPORT_WORKER_UNAUTHORIZED') return json({ error: message }, 401, corsHeaders)
    return json({ error: message }, 500, corsHeaders)
  }
})
