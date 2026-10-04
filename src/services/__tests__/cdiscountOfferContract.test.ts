import { describe, expect, it } from 'vitest';

import {
  CDISCOUNT_FULL_OFFER_HEADER_ROW_4,
  CDISCOUNT_FULL_OFFER_HEADER_ROW_5,
  CDISCOUNT_STOCK_PRICE_HEADERS,
  assertCdiscountStockPriceHeaders,
  validateAndBuildCdiscountStockPriceRow,
} from '../marketplaces/cdiscountOfferContract';

describe('Cdiscount offer contract', () => {
  it('keeps the official stock/price column order', () => {
    expect(CDISCOUNT_STOCK_PRICE_HEADERS).toEqual([
      'Votre référence',
      'EAN',
      'Stock',
      'Prix (€)(TTC)',
    ]);
  });

  it('keeps the exact two-row full-offer header structure at 28 columns', () => {
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_4).toHaveLength(28);
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_5).toHaveLength(28);

    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_4[0]).toBe('Votre référence');
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_4[1]).toBe('EAN/GTIN');
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_4[15]).toBe('Début (facultatif)');
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_4[16]).toBeNull();
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_5[15]).toBe('Date (jj/mm/aaaa)');
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_5[16]).toBe('Heure (hh:mm)');
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_4[23]).toContain('Délai de préparation');
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_4[24]).toBe('Suivi (1)');
    expect(CDISCOUNT_FULL_OFFER_HEADER_ROW_5[24]).toBe('Principal');
  });

  it('builds a valid stock/price row using the decimal comma required by the template', () => {
    expect(
      validateAndBuildCdiscountStockPriceRow({
        reference: 'SHOP-123',
        ean: '1234567890123',
        stock: 12,
        priceTtc: 19.9,
      }),
    ).toEqual({
      ok: true,
      row: ['SHOP-123', '1234567890123', '12', '19,90'],
    });
  });

  it('accepts an empty EAN because the stock/price template marks it optional', () => {
    const result = validateAndBuildCdiscountStockPriceRow({
      reference: 'SHOP-123',
      stock: 0,
      priceTtc: 19.9,
    });

    expect(result).toEqual({
      ok: true,
      row: ['SHOP-123', '', '0', '19,90'],
    });
  });

  it('fails closed on invalid reference, EAN, stock and price', () => {
    const result = validateAndBuildCdiscountStockPriceRow({
      reference: 'BAD|REF',
      ean: '123',
      stock: -1,
      priceTtc: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.code)).toEqual([
        'INVALID_REFERENCE_CHARACTER',
        'INVALID_EAN',
        'INVALID_STOCK',
        'INVALID_PRICE',
      ]);
    }
  });

  it('detects a changed or reordered Cdiscount template before export', () => {
    expect(() =>
      assertCdiscountStockPriceHeaders([
        'Votre référence',
        'Stock',
        'EAN',
        'Prix (€)(TTC)',
      ]),
    ).toThrow('CDISCOUNT_STOCK_PRICE_TEMPLATE_MISMATCH');
  });
});
