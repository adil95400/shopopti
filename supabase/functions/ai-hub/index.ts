import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_MODEL = 'gpt-5.6-luna'
const CACHE_TTL_MS = 30 * 60 * 1000
const MAX_CACHE_ENTRIES = 200
const responseCache = new Map<string, { expiresAt: number; data: unknown }>()

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

type ChatMessage = { role: 'system' | 'user'; content: string }

type ChatOptions = {
  maxOutputTokens?: number
  jsonObject?: boolean
}

async function chat(messages: ChatMessage[], options: ChatOptions = {}) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL,
      messages,
      reasoning_effort: 'none',
      max_completion_tokens: options.maxOutputTokens || 400,
      ...(options.jsonObject ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error('OpenAI request failed', response.status, detail)
    throw new Error('AI provider request failed')
  }

  const payload = await response.json()
  return payload?.choices?.[0]?.message?.content ?? ''
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function cacheKey(userId: string, action: string, payload: unknown) {
  return `${userId}:${action}:${JSON.stringify(payload)}`
}

function getCached(key: string) {
  const item = responseCache.get(key)
  if (!item) return undefined
  if (item.expiresAt <= Date.now()) {
    responseCache.delete(key)
    return undefined
  }
  return item.data
}

function setCached(key: string, data: unknown) {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = responseCache.keys().next().value
    if (firstKey) responseCache.delete(firstKey)
  }
  responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data })
}

async function optimizeProduct(payload: any) {
  const content = await chat(
    [
      {
        role: 'system',
        content:
          'You are a concise e-commerce optimizer. Return valid JSON only. Keep copy factual and avoid unsupported claims.',
      },
      {
        role: 'user',
        content: `Optimize this product in one pass.
Product: ${payload.name}
Category: ${payload.category || ''}
Current description: ${payload.description || ''}

Return exactly this JSON shape:
{
  "title": "SEO title, max 70 characters",
  "description_html": "concise product description using basic HTML, max about 220 words",
  "tags": ["up to 8 short relevant tags"],
  "seo": {
    "metaTitle": "max 60 characters",
    "metaDescription": "max 160 characters",
    "keywords": ["up to 8 relevant keywords"]
  }
}`,
      },
    ],
    { maxOutputTokens: 700, jsonObject: true },
  )

  return parseJson(content, {
    title: payload.name,
    description_html: payload.description || '',
    tags: [],
    seo: {
      metaTitle: payload.name,
      metaDescription: '',
      keywords: [],
    },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase auth environment is unavailable')
      return json({ error: 'Server configuration error' }, 500)
    }

    const token = authHeader.slice('Bearer '.length)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { action, payload = {}, bypassCache = false } = await req.json()
    const key = cacheKey(user.id, action, payload)

    if (!bypassCache) {
      const cached = getCached(key)
      if (cached !== undefined) return json({ data: cached, cached: true })
    }

    let result: unknown

    switch (action) {
      case 'generateProductDescription':
        result = await chat(
          [
            {
              role: 'system',
              content: `You are a concise e-commerce copywriter. Style: ${payload.style || 'professional'}. Audience: ${payload.targetAudience || 'general'}.`,
            },
            {
              role: 'user',
              content: `Write a factual SEO-friendly product description, maximum 180 words.
Product: ${payload.title}
Category: ${payload.category}
Key features: ${(payload.features || []).join(', ')}`,
            },
          ],
          { maxOutputTokens: 320 },
        )
        break

      case 'optimizeProductTitle':
        result = await chat(
          [
            { role: 'system', content: 'You are an e-commerce SEO title editor. Return only the title.' },
            {
              role: 'user',
              content: `Optimize for clarity, search relevance and conversion.
Title: ${payload.title}
Category: ${payload.category}
Keywords: ${payload.keywords?.join(', ') || 'none'}
Maximum length: ${payload.maxLength || 70} characters.`,
            },
          ],
          { maxOutputTokens: 90 },
        ) || payload.title
        break

      case 'optimizeProduct':
        result = await optimizeProduct(payload)
        break

      case 'optimizeForSEO': {
        const content = await chat(
          [
            { role: 'system', content: 'You are a concise e-commerce SEO editor. Return valid JSON only.' },
            {
              role: 'user',
              content: `Optimize SEO metadata.
Title: ${payload.title}
Description: ${payload.description}
Category: ${payload.category}
Return JSON with title, description, keywords (max 8), metaTitle (max 60 chars), metaDescription (max 160 chars).`,
            },
          ],
          { maxOutputTokens: 300, jsonObject: true },
        )
        result = parseJson(content, {
          title: payload.title,
          description: payload.description,
          keywords: [],
          metaTitle: payload.title,
          metaDescription: '',
        })
        break
      }

      case 'generateBlogContent':
        result = await chat(
          [
            {
              role: 'system',
              content: `You are a concise content writer specializing in ${payload.type} with a ${payload.tone} tone.`,
            },
            {
              role: 'user',
              content: `Write about: ${payload.title}
Keywords: ${(payload.keywords || []).join(', ')}
Audience: ${payload.targetAudience}
Structure: ${(payload.structure || []).join(', ')}
Maximum length: ${Math.min(Number(payload.wordCount) || 600, 1200)} words.`,
            },
          ],
          { maxOutputTokens: 1800 },
        )
        break

      case 'generateHashtags': {
        const content = await chat(
          [
            { role: 'system', content: 'Return only concise comma-separated hashtags without #.' },
            {
              role: 'user',
              content: `Generate at most ${Math.min(Number(payload.count) || 10, 20)} hashtags for ${payload.platform}: ${payload.product}`,
            },
          ],
          { maxOutputTokens: 120 },
        )
        result = content.split(',').map((tag: string) => tag.trim()).filter(Boolean)
        break
      }

      case 'generateVariants': {
        const content = await chat(
          [
            { role: 'system', content: 'Return a valid JSON object with a "variants" array. Keep it minimal and realistic.' },
            {
              role: 'user',
              content: `Product: ${payload.title}
Category: ${payload.category || ''}
Description: ${payload.description || ''}
Attributes: ${payload.attributes ? JSON.stringify(payload.attributes) : 'N/A'}
Return no more than 20 variants.`,
            },
          ],
          { maxOutputTokens: 700, jsonObject: true },
        )
        const parsed = parseJson<{ variants?: unknown[] }>(content, { variants: [] })
        result = Array.isArray(parsed.variants) ? parsed.variants : []
        break
      }

      case 'analyzeSentiment': {
        const content = (await chat(
          [
            { role: 'system', content: "Respond only with 'positive', 'negative', or 'neutral'." },
            { role: 'user', content: payload.text || '' },
          ],
          { maxOutputTokens: 12 },
        )).toLowerCase()
        result = content.includes('positive') ? 'positive' : content.includes('negative') ? 'negative' : 'neutral'
        break
      }

      case 'generateResponse':
        result = await chat(
          [
            { role: 'system', content: 'Write a concise, professional customer-review response. Maximum 80 words.' },
            {
              role: 'user',
              content: `Review: "${payload.review}"
Rating: ${payload.rating}/5
Sentiment: ${payload.sentiment || 'unknown'}
Verified: ${payload.verified ? 'Yes' : 'No'}`,
            },
          ],
          { maxOutputTokens: 150 },
        )
        break

      case 'analyzeCampaignPerformance': {
        const content = await chat(
          [
            {
              role: 'system',
              content: 'Return valid JSON with metrics, up to 5 concise insights, and up to 5 concise recommendations.',
            },
            {
              role: 'user',
              content: `Campaign: ${JSON.stringify(payload.campaign)}
Metrics: ${JSON.stringify(payload.metrics)}
Goals: ${JSON.stringify(payload.goals)}`,
            },
          ],
          { maxOutputTokens: 500, jsonObject: true },
        )
        result = parseJson(content, {
          metrics: payload.metrics,
          insights: [],
          recommendations: [],
        })
        break
      }

      default:
        return json({ error: 'Unsupported AI action' }, 400)
    }

    setCached(key, result)
    return json({ data: result, cached: false })
  } catch (error) {
    console.error('ai-hub error', error)
    return json({ error: error instanceof Error ? error.message : 'AI request failed' }, 500)
  }
})
