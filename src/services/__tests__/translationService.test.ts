import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { translationService } from '../translationService';
import i18n from '../../i18n';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('translationService.updateI18nFiles', () => {
  it('writes translations to locale files', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'i18n-'));
    const locales = path.join(tmp, 'public', 'locales');
    await fs.mkdir(path.join(locales, 'en'), { recursive: true });
    await fs.mkdir(path.join(locales, 'fr'), { recursive: true });
    await fs.writeFile(path.join(locales, 'en', 'translation.json'), '{}');
    await fs.writeFile(path.join(locales, 'fr', 'translation.json'), '{}');
    const cwd = process.cwd();
    process.chdir(tmp);

    await translationService.updateI18nFiles('products.test.title', {
      en: 'Hello',
      fr: 'Bonjour'
    });

    const enData = JSON.parse(
      await fs.readFile(path.join(locales, 'en', 'translation.json'), 'utf-8')
    );
    const frData = JSON.parse(
      await fs.readFile(path.join(locales, 'fr', 'translation.json'), 'utf-8')
    );

    expect(enData.products['products.test.title']).toBe('Hello');
    expect(frData.products['products.test.title']).toBe('Bonjour');

    process.chdir(cwd);
  });
});
