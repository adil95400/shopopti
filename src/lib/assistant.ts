import { openai } from "./openai";

export async function generateProductSheet({ name, keywords }: { name: string; keywords: string }) {
  const prompt = `Tu es un expert e-commerce. Rédige une fiche produit optimisée SEO pour :\nNom: ${name}\nMots-clés: ${keywords}`;
  const res = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
  });
  return res.choices[0].message.content;
}

export async function optimizeSeo({ description, lang }: { description: string; lang: string }) {
  const prompt = `Tu es un expert SEO. Optimise le texte suivant pour le référencement (${lang}) :\n${description}`;
  const res = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
  });
  return res.choices[0].message.content;
}

export async function translateText(text: string, lang: string) {
  const prompt = `Traduis le texte suivant en ${lang} :\n${text}`;
  const res = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
  });
  return res.choices[0].message.content;
}

export async function generateFAQ(product: string) {
  const prompt = `Génère une FAQ pour ce produit :\n${product}`;
  const res = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
  });
  return res.choices[0].message.content;
}

export async function synthesizeReviews(reviews: string[]) {
  const joined = reviews.join("\n");
  const prompt = `Analyse les avis suivants et crée un résumé intelligent :\n${joined}`;
  const res = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
  });
  return res.choices[0].message.content;
}

export async function createNewsletter({ subject, audience }: { subject: string; audience: string }) {
  const prompt = `Crée une newsletter avec le sujet : ${subject} pour le public : ${audience}`;
  const res = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
  });
  return res.choices[0].message.content;
}
