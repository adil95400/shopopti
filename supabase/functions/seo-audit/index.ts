import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    const model = Deno.env.get('OPENAI_MODEL')

    if (!supabaseUrl || !supabaseAnonKey || !openAiKey || !model) {
      console.error('SEO AI server configuration is incomplete')
      return json({ error: 'Server configuration error' }, 500)
    }

    const token = authHeader.slice('Bearer '.length)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { title, description, tags } = await req.json()
    if (typeof title !== 'string' || typeof description !== 'string' || typeof tags !== 'string') {
      return json({ error: 'Invalid SEO audit payload' }, 400)
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
  "recommendations": ["..."]
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
          { role: 'system', content: 'Tu es un expert en SEO e-commerce. Retourne uniquement du JSON valide.' },
          { role: 'user', content: prompt },
        ],
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
      return json({ data: JSON.parse(content) })
    } catch {
      return json({ error: 'AI provider returned invalid JSON' }, 502)
    }
  } catch (error) {
    console.error('seo-audit error', error)
    return json({ error: 'SEO audit failed' }, 500)
  }
})
