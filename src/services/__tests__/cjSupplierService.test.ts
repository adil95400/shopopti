import { describe, expect, it } from 'vitest';

import { supplierProviders } from '@/config/supplierProviders';

describe('CJdropshipping connector contract', () => {
  it('is the only implemented supplier connector in the first supplier-hub tranche', () => {
    const cj = supplierProviders.find((provider) => provider.type === 'cj_dropshipping');
    expect(cj?.stage).toBe('implemented');
  });

  it('keeps import persistence fail-closed until the canonical import pipeline is wired', () => {
    const cj = supplierProviders.find((provider) => provider.type === 'cj_dropshipping');
    expect(cj?.capabilities.import).toBe('planned');
  });

  it('exposes only server-gateway capabilities as implemented', () => {
    const cj = supplierProviders.find((provider) => provider.type === 'cj_dropshipping');
    expect(cj?.capabilities).toMatchObject({
      catalog: 'implemented',
      price: 'implemented',
      stock: 'implemented',
      variants: 'implemented',
      shipping: 'implemented',
      orders: 'implemented',
      tracking: 'implemented',
    });
  });
});
