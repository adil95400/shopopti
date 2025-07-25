import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function generateProductDescription(prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0]?.message.content ?? "";
}

export async function generateSEO(prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0]?.message.content ?? "";
}

export async function generateTranslation(prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0]?.message.content ?? "";
}

export async function generateFAQ(prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0]?.message.content ?? "";
}

export async function generateReviewPrompt(prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0]?.message.content ?? "";
}

export async function generateNewsletter(prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0]?.message.content ?? "";
}

export { openai };
