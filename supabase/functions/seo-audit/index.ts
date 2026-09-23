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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    const model = Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL

    if (!supabaseUrl || !supabaseAnonKey || !openAiKey) {
      console.error('SEO AI server configuration is incomplete')
      return json({ error: 'Server configuration error' }, 500)
    }

    const token = authHeader.slice('Bearer '.length)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { title, description, tags, bypassCache = false } = await req.json()
    if (typeof title !== 'string' || typeof description !== 'string' || typeof tags !== 'string') {
      return json({ error: 'Invalid SEO audit payload' }, 400)
    }

    const cacheKey = `${user.id}:${title}:${description}:${tags}`
    if (!bypassCache) {
      const cached = getCached(cacheKey)
      if (cached !== undefined) return json({ data: cached, cached: true })
    }

    const prompt = `Analyse SEO d'une fiche produit :
Titre : ${title}
Description : ${description}
Tags : ${tags}

Retourne uniquement un JSON valide avec :
{
  "score": 85,
  "title": "...",
  "meta_description": "...",
  "rich_snippet": "{...}",
  "recommendations": ["maximum 5 recommandations courtes"]
}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Tu es un expert en SEO e-commerce. Sois concis et retourne uniquement du JSON valide.' },
          { role: 'user', content: prompt },
        ],
        reasoning_effort: 'none',
        max_completion_tokens: 450,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      console.error('SEO AI provider request failed', response.status, await response.text())
      return json({ error: 'AI provider request failed' }, 502)
    }

    const payload = await response.json()
    const content = payload?.choices?.[0]?.message?.content
    if (!content) return json({ error: 'Invalid AI provider response' }, 502)

    try {
      const parsed = JSON.parse(content)
      setCached(cacheKey, parsed)
      return json({ data: parsed, cached: false })
    } catch {
      return json({ error: 'AI provider returned invalid JSON' }, 502)
    }
  } catch (error) {
    console.error('seo-audit error', error)
    return json({ error: 'SEO audit failed' }, 500)
  }
})
