import { describe, it, beforeEach, expect, vi } from 'vitest';

var postMock: any;
var getSessionMock: any;

vi.mock('axios', () => {
  postMock = vi.fn().mockResolvedValue({ data: { products: [] } });
  return { default: { post: postMock } };
});

vi.mock('../../lib/supabase', () => {
  getSessionMock = vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  return { supabase: { auth: { getSession: getSessionMock } } };
});

import { supplierService } from '../supplierService';

vi.stubGlobal('import.meta', { env: { VITE_SUPABASE_URL: 'http://test' } });

describe('supplierService filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends filters in getProducts for Spocket', async () => {
    vi.spyOn(supplierService, 'getSupplierById').mockResolvedValue({
      type: 'spocket', apiKey: 'k', apiSecret: 's', baseUrl: 'http://s'
    } as any);

    const filters = { shippingLocation: 'US', priceMarkupType: 'percentage', priceMarkupValue: 10 };
    await supplierService.getProducts('sup', filters as any);

    expect(postMock).toHaveBeenCalled();
    const [url, body] = postMock.mock.calls[0];
    expect(url).toContain('/functions/v1/providers/spocket');
    expect(body).toEqual(expect.objectContaining({
      supplierId: 'sup',
      apiKey: 'k',
      apiSecret: 's',
      baseUrl: 'http://s',
      filters
    }));
  });

  it('sends filters in importProducts for AutoDS', async () => {
    vi.spyOn(supplierService, 'getSupplierById').mockResolvedValue({
      type: 'autods', apiKey: 'k', apiSecret: 's', baseUrl: 'http://a'
    } as any);

    const filters = { shippingLocation: 'EU', priceMarkupType: 'fixed', priceMarkupValue: 2 };
    await supplierService.importProducts('a1', ['1', '2'], filters as any);

    expect(postMock).toHaveBeenCalled();
    const [url, body] = postMock.mock.calls[0];
    expect(url).toContain('/functions/v1/providers/import');
    expect(body).toEqual(expect.objectContaining({
      supplierId: 'a1',
      apiKey: 'k',
      apiSecret: 's',
      baseUrl: 'http://a',
      productIds: ['1', '2'],
      filters
    }));
  });
});
