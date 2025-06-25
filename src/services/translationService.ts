import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import i18n from '../i18n';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_TRANSLATION_API_KEY || import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const translationService = {
  async translate(text: string, targetLang: string): Promise<string> {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Translate the following text to ${targetLang}.` },
        { role: 'user', content: text }
      ]
    });
    return completion.choices[0].message.content?.trim() || text;
  },

  async updateI18nFiles(key: string, translations: Record<string, string>): Promise<void> {
    const localesDir = path.resolve('public', 'locales');
    const languages = (i18n.options.supportedLngs as string[]) || [];

    await Promise.all(languages.map(async lng => {
      const filePath = path.join(localesDir, lng, 'translation.json');
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const json = JSON.parse(raw);
        if (!json.products) json.products = {};
        json.products[key] = translations[lng] || json.products[key];
        await fs.writeFile(filePath, JSON.stringify(json, null, 2));
      } catch {
        // ignore missing files for language
      }
    }));
  }
};
