import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importService } from '../importService';
import { translationService } from '../translationService';

vi.mock('../translationService');
vi.mock('../aiService', () => ({
  aiService: { optimizeForSEO: vi.fn().mockResolvedValue({ title: '', description: '', keywords: [] }) }
}));

vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({
            data: [{ id: '1', title: 'Test', description: 'Desc' }],
            error: null
          })
        }))
      })
    }
  };
});

describe('importService.saveProducts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (translationService.translate as any).mockResolvedValue('t');
    (translationService.updateI18nFiles as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls translation when option enabled', async () => {
    await importService.saveProducts([
      { title: 'Test', description: 'Desc', price: 1, images: [] }
    ], { translate: true });

    expect(translationService.translate).toHaveBeenCalled();
    expect(translationService.updateI18nFiles).toHaveBeenCalled();
  });
});
