import { OpenAI } from 'openai';

const apiKey =
  import.meta.env.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  console.error(
    'VITE_OPENAI_API_KEY is not defined. Set this value in your .env file.'
  );
  throw new Error('VITE_OPENAI_API_KEY is not defined');
}

const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true
});

export async function auditSEOWithAI({
  title,
  description,
  tags
}: {
  title: string;
  description: string;
  tags: string;
}) {
  const prompt = `
Analyse SEO d'une fiche produit :
Titre : ${title}
Description : ${description}
Tags : ${tags}

Retourne un JSON avec :
{
  "score": 85,
  "title": "...",
  "meta_description": "...",
  "rich_snippet": "{...}",
  "recommendations": ["..."]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Tu es un expert en SEO e-commerce." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    const content = response.choices[0].message.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Failed to get SEO analysis');
  }
}