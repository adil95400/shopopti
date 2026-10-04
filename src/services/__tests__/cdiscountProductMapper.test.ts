import { describe, expect, it } from 'vitest';

import {
  mapShopOptiProductToCdiscountStockPrice,
  mapShopOptiProductsToCdiscountStockPrice,
} from '../marketplaces/cdiscountProductMapper';

describe('Cdiscount ShopOpti product mapper', () => {
  it('maps verified ShopOpti SKU, stock, price and EAN without inventing values', () => {
    expect(
      mapShopOptiProductToCdiscountStockPrice({
        id: 'p1',
        title: 'Produit',
        sku: 'SKU-1',
        stock: 7,
        price: 24.9,
        ean: '1234567890123',
      }),
    ).toEqual({
      ok: true,
      offer: {
        reference: 'SKU-1',
        stock: 7,
        priceTtc: 24.9,
        ean: '1234567890123',
      },
    });
  });

  it('accepts numeric database values serialized as strings', () => {
    const result = mapShopOptiProductToCdiscountStockPrice({
      id: 'p2',
      title: 'Produit',
      sku: 'SKU-2',
      stock: '12',
      price: '19,90',
      metadata: { gtin: '0123456789012' },
    });

    expect(result).toEqual({
      ok: true,
      offer: {
        reference: 'SKU-2',
        stock: 12,
        priceTtc: 19.9,
        ean: '0123456789012',
      },
    });
  });

  it('fails closed when SKU is absent instead of falling back to product id', () => {
    const result = mapShopOptiProductToCdiscountStockPrice({
      id: 'product-id',
      title: 'Produit',
      stock: 3,
      price: 12,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'MISSING_SKU', productId: 'product-id' },
    });
  });

  it('fails closed when stock or price is missing', () => {
    const result = mapShopOptiProductsToCdiscountStockPrice([
      { id: 'a', title: 'A', sku: 'A', price: 10 },
      { id: 'b', title: 'B', sku: 'B', stock: 1 },
    ]);

    expect(result.offers).toEqual([]);
    expect(result.errors.map((error) => error.code)).toEqual([
      'MISSING_STOCK',
      'MISSING_PRICE',
    ]);
  });
});
