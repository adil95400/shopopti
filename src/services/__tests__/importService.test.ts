import { describe, it, expect, vi, afterEach } from 'vitest';

const insertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ insert: insertMock }) }
}));

import { importService } from '../importService';
import { aiService } from '../aiService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('importService.saveProducts', () => {
  it('generates variants when missing', async () => {
    const genMock = vi.spyOn(aiService, 'generateVariants').mockResolvedValue([
      { title: 'V1', options: { size: 'M' } }
    ]);
    vi.spyOn(aiService, 'optimizeForSEO').mockResolvedValue({
      title: 't',
      description: 'd',
      keywords: [],
      metaTitle: 't',
      metaDescription: 'd'
    });
    await importService.saveProducts([
      {
        title: 'Test',
        description: 'desc',
        price: 10,
        images: [],
        variants: undefined
      }
    ] as any);
    expect(genMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalled();
  });
});
