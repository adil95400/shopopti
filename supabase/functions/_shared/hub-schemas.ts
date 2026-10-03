/**
 * Zod validation schemas for hub Edge Functions
 * P1.2 — Input validation for import-hub, order-hub, billing-hub
 */
import { z } from 'npm:zod@3'

// ── Common ──
const uuidSchema = z.string().uuid()
const safeString = z.string().max(1000).trim()
const actionSchema = z.string().min(1).max(100).trim()

/**
 * Reject URL targets that must never be reachable from a server-side importer.
 *
 * This is the first SSRF boundary: schemes, credentials, localhost, metadata
 * hosts and literal private/link-local/reserved IP ranges are rejected before
 * any scraping provider or direct fetch sees the URL. Fetchers must still
 * validate redirect targets because DNS/redirect validation is a runtime
 * concern and cannot be made authoritative in a synchronous Zod schema.
 */
export function isSafePublicUrl(value: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  if (parsed.username || parsed.password) return false
  if (!parsed.hostname) return false

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata' ||
    hostname === 'instance-data' ||
    hostname === '169.254.169.254'
  ) return false

  // IPv6 loopback, unspecified, link-local and unique-local ranges.
  if (hostname.includes(':')) {
    const normalized = hostname.toLowerCase()
    if (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd')
    ) return false
    return true
  }

  // IPv4 literals. Reject non-public ranges, including RFC1918, loopback,
  // link-local, CGNAT, documentation/test networks, multicast and reserved.
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number)
    if (octets.some(o => o < 0 || o > 255)) return false
    const [a, b, c] = octets
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 192 && b === 0 && c === 0) return false
    if (a === 192 && b === 0 && c === 2) return false
    if (a === 198 && (b === 18 || b === 19)) return false
    if (a === 198 && b === 51 && c === 100) return false
    if (a === 203 && b === 0 && c === 113) return false
    if (a >= 224) return false
  }

  return true
}

const urlSchema = z
  .string()
  .url()
  .max(2000)
  .refine(isSafePublicUrl, 'URL target is not allowed')

// ══════════════════════════════════════════
//  IMPORT-HUB Schemas
// ══════════════════════════════════════════

export const importActionSchema = z.object({
  action: actionSchema,
}).passthrough()

export const importUrlSchema = z.object({
  action: actionSchema,
  url: urlSchema,
}).passthrough()

export const importCsvSchema = z.object({
  action: actionSchema,
  csvData: z.string().max(10_000_000), // 10MB max
  mapping: z.record(z.string()).optional(),
  config: z.object({}).passthrough().optional(),
}).passthrough()

export const importBulkSchema = z.object({
  action: actionSchema,
  products: z.array(z.object({}).passthrough()).max(500),
  source: safeString.optional(),
}).passthrough()

export const importOneClickSchema = z.object({
  action: actionSchema,
  urls: z.array(urlSchema).max(50).optional(),
  url: urlSchema.optional(),
}).passthrough()

export const importImageSchema = z.object({
  action: actionSchema,
  imageUrls: z.array(urlSchema).max(30).optional(),
  images: z.array(urlSchema).max(30).optional(),
}).passthrough()

// ══════════════════════════════════════════
//  ORDER-HUB Schemas
// ══════════════════════════════════════════

export const orderEnqueueSchema = z.object({
  action: z.literal('enqueue'),
  orderId: uuidSchema,
  supplierType: safeString.optional(),
  payload: z.object({}).passthrough().optional(),
  userId: uuidSchema.optional(),
})

export const orderCancelSchema = z.object({
  action: z.literal('cancel'),
  queueId: uuidSchema.optional(),
  order_id: uuidSchema.optional(),
  reason: safeString.optional(),
  userId: uuidSchema.optional(),
})

export const orderFulfillSchema = z.object({
  action: z.literal('fulfill'),
  order_id: uuidSchema,
  tracking_number: safeString.optional(),
  carrier: safeString.optional(),
})

export const orderReturnSchema = z.object({
  action: z.literal('return'),
  order_id: uuidSchema,
  items: z.array(z.object({}).passthrough()).optional(),
  reason: safeString.optional(),
})

export const orderRefundSchema = z.object({
  action: z.literal('refund'),
  order_id: uuidSchema,
  amount: z.number().min(0).max(1_000_000).optional(),
  reason: safeString.optional(),
})

export const orderTrackSchema = z.object({
  action: z.literal('track'),
  order_id: uuidSchema,
})

export const orderAutoPlaceSchema = z.object({
  action: z.literal('auto-place'),
  order_id: uuidSchema,
  supplier_type: safeString.optional(),
  supplier_id: uuidSchema.optional(),
})

export const orderAutoPlaceBulkSchema = z.object({
  action: z.literal('auto-place-bulk'),
  order_ids: z.array(uuidSchema).min(1).max(50),
})

export const orderCreateDisputeSchema = z.object({
  action: z.literal('create_dispute'),
  orderId: uuidSchema,
  type: safeString.optional(),
  reason: safeString.optional(),
  amount: z.number().min(0).max(1_000_000).optional(),
  evidence: z.array(z.object({}).passthrough()).optional(),
})

export const orderCreateReturnSchema = z.object({
  action: z.literal('create_return'),
  orderId: uuidSchema,
  reason: safeString.optional(),
  items: z.array(z.object({}).passthrough()).optional(),
  customerNote: safeString.optional(),
})

// ══════════════════════════════════════════
//  BILLING-HUB Schemas
// ══════════════════════════════════════════

export const billingCheckoutSchema = z.object({
  action: z.literal('checkout.create'),
  plan: z.enum(['standard', 'pro', 'ultra_pro']),
})

export const billingCheckoutSessionSchema = z.object({
  action: z.literal('checkout.create_session'),
  planType: safeString.optional(),
  priceId: z.string().max(200).optional(),
})

export const billingPaymentSchema = z.object({
  action: z.literal('payment.create'),
  amount: z.number().int().min(100).max(100_000_000), // cents
  currency: z.string().length(3).optional(),
  description: safeString.optional(),
})

export const billingCouponSchema = z.object({
  action: actionSchema,
  code: z.string().min(1).max(100).trim(),
})

export const billingCreditsPurchaseSchema = z.object({
  action: z.literal('credits.purchase'),
  pack: z.enum(['small', 'medium', 'large']),
})

export const billingAddonCheckoutSchema = z.object({
  action: z.literal('addons.checkout'),
  addon: z.enum(['ai_boost', 'api_boost', 'store_boost']),
  quantity: z.number().int().min(1).max(10).optional(),
})

export const billingCheckQuotaSchema = z.object({
  action: z.literal('check_quota'),
  quotaKey: z.string().min(1).max(100),
  incrementBy: z.number().int().min(0).max(10_000).optional(),
  consume: z.boolean().optional(),
})

export const billingQuotaSummarySchema = z.object({
  action: z.literal('quota.summary'),
})

export const billingEnforceGateSchema = z.object({
  action: z.literal('enforce_gate'),
  actionType: safeString.optional(), // legacy
  quantity: z.number().int().min(1).max(10_000).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
}).passthrough()

export const billingCheckPlanSchema = z.object({
  action: z.literal('check_plan'),
  requiredPlan: z.string().min(1).max(50),
})

export const billingTrialSchema = z.object({
  action: z.literal('trial_activate'),
  trialDays: z.number().int().min(1).max(90).optional(),
  plan: z.string().max(50).optional(),
  couponCode: z.string().max(100).optional(),
})

export const billingUpgradeSchema = z.object({
  action: z.literal('upgrade_plan'),
  newPlan: z.string().min(1).max(50),
  // SECURITY P0-B6: paymentIntentId is REQUIRED and validated server-side against Stripe.
  // Must be a Stripe PaymentIntent ID (pi_...) or Checkout Session ID (cs_...).
  paymentIntentId: z.string().min(3).max(200).regex(/^(pi_|cs_)/, 'Must be a Stripe pi_ or cs_ id'),
})

/**
 * Validate body against a schema. Returns { data } on success, { error, response } on failure.
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodType<T>,
  corsHeaders: Record<string, string>
): { data: T; error?: never; response?: never } | { data?: never; error: string; response: Response } {
  const result = schema.safeParse(body)
  if (result.success) return { data: result.data }

  const message = result.error.issues
    .slice(0, 3)
    .map(i => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join(' | ')

  return {
    error: message,
    response: new Response(
      JSON.stringify({ success: false, error: `Validation error: ${message}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    ),
  }
}
