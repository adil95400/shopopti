import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: insertMock })
  }
}));

vi.mock('../src/services/translationService', () => {
  const translateMock = vi.fn().mockResolvedValue('Bonjour');
  const updateMock = vi.fn();
  return {
    translationService: {
      languages: ['fr'],
      translate: translateMock,
      updateLocaleFile: updateMock,
      setClient: vi.fn()
    }
  };
});

vi.mock('../src/services/aiService', () => ({
  aiService: {
    optimizeForSEO: vi.fn().mockResolvedValue({ title: '', description: '', keywords: [], metaTitle: '', metaDescription: '' })
  }
}));

import { importService } from '../src/services/importService';
import { translationService } from '../src/services/translationService';

beforeEach(() => {
  insertMock.mockClear();
  (translationService.translate as any).mockClear();
  (translationService.updateLocaleFile as any).mockClear();
});

describe('importService.saveProducts', () => {
  it('translates and updates locales when enabled', async () => {
    await importService.saveProducts([
      { title: 'Hello', description: 'World', price: 1, images: [] }
    ], { translate: true });

    expect((translationService.translate as any)).toHaveBeenCalled();
    expect((translationService.updateLocaleFile as any)).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalled();
  });
});
