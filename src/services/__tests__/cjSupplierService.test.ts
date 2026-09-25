import { describe, expect, it } from 'vitest';

import { supplierProviders } from '@/config/supplierProviders';

describe('CJdropshipping connector contract', () => {
  it('is the only implemented supplier connector in the first supplier-hub tranche', () => {
    const cj = supplierProviders.find((provider) => provider.type === 'cj_dropshipping');
    expect(cj?.stage).toBe('implemented');
  });

  it('marks durable CJ snapshot import as implemented', () => {
    const cj = supplierProviders.find((provider) => provider.type === 'cj_dropshipping');
    expect(cj?.capabilities.import).toBe('implemented');
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

  it('does not overstate BigBuy while its production connector is not wired', () => {
    const bigBuy = supplierProviders.find((provider) => provider.type === 'bigbuy');
    expect(bigBuy?.stage).toBe('planned');
    expect(bigBuy?.capabilities.import).toBe('planned');
  });
});
