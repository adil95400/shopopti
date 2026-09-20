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

type ChatMessage = { role: 'system' | 'user'; content: string }

async function chat(messages: ChatMessage[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
      messages,
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

async function optimizeProduct(payload: any) {
  const title = await chat([
    { role: 'system', content: 'You are an SEO expert specializing in e-commerce product titles.' },
    {
      role: 'user',
      content: `Optimize this product title for SEO and conversions.
Title: ${payload.name}
Category: ${payload.category || ''}
Maximum length: 70 characters.
Return only the optimized title.`,
    },
  ])

  const description_html = await chat([
    {
      role: 'system',
      content: 'You are an e-commerce content expert. Return a safe, concise HTML product description using basic semantic tags only.',
    },
    {
      role: 'user',
      content: `Enhance this product description.
Product: ${payload.name}
Category: ${payload.category || ''}
Current description: ${payload.description || ''}`,
    },
  ])

  const tagText = await chat([
    {
      role: 'system',
      content: 'Generate relevant SEO tags for this product. Return only comma-separated tags.',
    },
    {
      role: 'user',
      content: `Product: ${payload.name}
Category: ${payload.category || ''}
Description: ${payload.description || ''}`,
    },
  ])

  return {
    title: title || payload.name,
    description_html: description_html || payload.description || '',
    tags: tagText.split(',').map((tag: string) => tag.trim()).filter(Boolean),
  }
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

    const { action, payload = {} } = await req.json()

    switch (action) {
      case 'generateProductDescription': {
        const content = await chat([
          {
            role: 'system',
            content: `You are a professional e-commerce copywriter specializing in ${payload.style || 'professional'} product descriptions. Target audience: ${payload.targetAudience || 'general'}.`,
          },
          {
            role: 'user',
            content: `Write a compelling product description for: ${payload.title}
Category: ${payload.category}
Key features: ${(payload.features || []).join(', ')}
Make it engaging, SEO-friendly, and highlight the value proposition.`,
          },
        ])
        return json({ data: content })
      }

      case 'optimizeProductTitle': {
        const content = await chat([
          { role: 'system', content: 'You are an SEO expert specializing in e-commerce product titles.' },
          {
            role: 'user',
            content: `Optimize this product title for SEO and conversions:
Title: ${payload.title}
Category: ${payload.category}
Target keywords: ${payload.keywords?.join(', ') || 'none provided'}
Maximum length: ${payload.maxLength || 70} characters.
Return only the optimized title.`,
          },
        ])
        return json({ data: content || payload.title })
      }

      case 'optimizeProduct':
        return json({ data: await optimizeProduct(payload) })

      case 'optimizeForSEO': {
        const content = await chat([
          { role: 'system', content: 'You are an SEO expert specializing in e-commerce. Return valid JSON only.' },
          {
            role: 'user',
            content: `Optimize this product for SEO:
Title: ${payload.title}
Description: ${payload.description}
Category: ${payload.category}
Return JSON with: title, description, keywords array, metaTitle max 60 chars, metaDescription max 160 chars.`,
          },
        ])
        return json({ data: parseJson(content, {
          title: payload.title,
          description: payload.description,
          keywords: [],
          metaTitle: payload.title,
          metaDescription: '',
        }) })
      }

      case 'generateBlogContent': {
        const content = await chat([
          {
            role: 'system',
            content: `You are a professional content writer specializing in ${payload.type} articles with a ${payload.tone} tone.`,
          },
          {
            role: 'user',
            content: `Write a blog post about: ${payload.title}
Keywords: ${(payload.keywords || []).join(', ')}
Target audience: ${payload.targetAudience}
Structure: ${(payload.structure || []).join(', ')}
Approximate word count: ${payload.wordCount}
Make it engaging, informative, and SEO-friendly.`,
          },
        ])
        return json({ data: content })
      }

      case 'generateHashtags': {
        const content = await chat([
          {
            role: 'system',
            content: `You are a social media expert specializing in ${payload.platform} marketing.`,
          },
          {
            role: 'user',
            content: `Generate ${payload.count} effective hashtags for: ${payload.product}. Return comma-separated values without #.`,
          },
        ])
        return json({ data: content.split(',').map((tag: string) => tag.trim()).filter(Boolean) })
      }

      case 'generateVariants': {
        const content = await chat([
          {
            role: 'system',
            content: 'You are a merchandising expert. Return a valid JSON array of realistic product variants with title and options.',
          },
          {
            role: 'user',
            content: `Product: ${payload.title}
Category: ${payload.category || ''}
Description: ${payload.description || ''}
Attributes: ${payload.attributes ? JSON.stringify(payload.attributes) : 'N/A'}`,
          },
        ])
        return json({ data: parseJson(content, []) })
      }

      case 'analyzeSentiment': {
        const content = (await chat([
          {
            role: 'system',
            content: "Analyze sentiment and respond with only 'positive', 'negative', or 'neutral'.",
          },
          { role: 'user', content: payload.text || '' },
        ])).toLowerCase()
        const sentiment = content.includes('positive') ? 'positive' : content.includes('negative') ? 'negative' : 'neutral'
        return json({ data: sentiment })
      }

      case 'generateResponse': {
        const content = await chat([
          {
            role: 'system',
            content: 'You are a professional customer service representative. Generate a concise response to this customer review.',
          },
          {
            role: 'user',
            content: `Customer review: "${payload.review}"
Rating: ${payload.rating}/5
Sentiment: ${payload.sentiment || 'unknown'}
Verified purchase: ${payload.verified ? 'Yes' : 'No'}`,
          },
        ])
        return json({ data: content })
      }

      case 'analyzeCampaignPerformance': {
        const content = await chat([
          {
            role: 'system',
            content: 'You are a marketing analytics expert. Return valid JSON with metrics, insights array, and recommendations array.',
          },
          {
            role: 'user',
            content: `Campaign: ${JSON.stringify(payload.campaign)}
Metrics: ${JSON.stringify(payload.metrics)}
Goals: ${JSON.stringify(payload.goals)}`,
          },
        ])
        return json({ data: parseJson(content, {
          metrics: payload.metrics,
          insights: [],
          recommendations: [],
        }) })
      }

      default:
        return json({ error: 'Unsupported AI action' }, 400)
    }
  } catch (error) {
    console.error('ai-hub error', error)
    return json({ error: error instanceof Error ? error.message : 'AI request failed' }, 500)
  }
})
