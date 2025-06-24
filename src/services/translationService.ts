import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_TRANSLATION_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;
const languages = (import.meta.env.VITE_I18N_LANGUAGES || 'en,fr').split(',');

let openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true
});

export const translationService = {
  languages,

  setClient(client: any) {
    openai = client;
  },

  async translate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    const prompt = `Translate the following text${sourceLang ? ` from ${sourceLang}` : ''} to ${targetLang}:\n"${text}"`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }]
    });
    return completion.choices[0].message.content?.trim() || text;
  },

  updateLocaleFile(lang: string, key: string, data: any): void {
    const localesDir = path.resolve('public', 'locales', lang);
    const filePath = path.join(localesDir, 'products.json');

    let existing: Record<string, any> = {};
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else {
      fs.mkdirSync(localesDir, { recursive: true });
    }

    existing[key] = data;
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
  }
};
