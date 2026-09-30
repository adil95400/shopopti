import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import {
  CDISCOUNT_STOCK_PRICE_FIRST_DATA_ROW,
  CDISCOUNT_STOCK_PRICE_SHEET,
  buildCdiscountStockPriceWorkbook,
} from '../marketplaces/cdiscountStockPriceWorkbook';

function createTemplate(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [null, null, null, null],
    ['Données produit', null, null, null],
    ['Données obligatoires', 'Données optionnelles', 'Données obligatoires', null],
    ['Votre référence', 'EAN', 'Stock', 'Prix (€)(TTC)'],
    [null, null, null, null],
    [null, null, null, null],
  ]);

  sheet['!merges'] = [
    XLSX.utils.decode_range('A2:D2'),
    XLSX.utils.decode_range('C3:D3'),
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, CDISCOUNT_STOCK_PRICE_SHEET);

  const definitionSheet = XLSX.utils.aoa_to_sheet([
    ['Mode opératoire'],
    ['Le fichier prix/stock met uniquement à jour des offres existantes.'],
  ]);
  XLSX.utils.book_append_sheet(workbook, definitionSheet, 'Définition des attributs ');

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('buildCdiscountStockPriceWorkbook', () => {
  it('fills the official data area without changing sheet names or header rows', () => {
    const result = buildCdiscountStockPriceWorkbook(createTemplate(), [
      {
        reference: 'SHOP-001',
        ean: '1234567890123',
        stock: 8,
        priceTtc: 29.9,
      },
      {
        reference: 'SHOP-002',
        stock: 0,
        priceTtc: 15.5,
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.exportedRows).toBe(2);

    const workbook = XLSX.read(result.workbook, { type: 'array' });
    expect(workbook.SheetNames).toEqual([
      CDISCOUNT_STOCK_PRICE_SHEET,
      'Définition des attributs ',
    ]);

    const sheet = workbook.Sheets[CDISCOUNT_STOCK_PRICE_SHEET];
    expect(sheet.A4.v).toBe('Votre référence');
    expect(sheet.B4.v).toBe('EAN');
    expect(sheet.C4.v).toBe('Stock');
    expect(sheet.D4.v).toBe('Prix (€)(TTC)');

    expect(sheet.A5.v).toBe('SHOP-001');
    expect(sheet.B5.v).toBe('1234567890123');
    expect(sheet.C5.v).toBe('8');
    expect(sheet.D5.v).toBe('29,90');

    expect(sheet.A6.v).toBe('SHOP-002');
    expect(sheet.B6).toBeUndefined();
    expect(sheet.C6.v).toBe('0');
    expect(sheet.D6.v).toBe('15,50');

    expect(sheet['!merges']).toEqual([
      XLSX.utils.decode_range('A2:D2'),
      XLSX.utils.decode_range('C3:D3'),
    ]);
  });

  it('replaces stale example/data rows instead of appending after them', () => {
    const template = createTemplate();
    const workbook = XLSX.read(template, { type: 'array' });
    const sheet = workbook.Sheets[CDISCOUNT_STOCK_PRICE_SHEET];
    XLSX.utils.sheet_add_aoa(sheet, [['OLD', '1234567890123', '99', '999,00']], {
      origin: { r: CDISCOUNT_STOCK_PRICE_FIRST_DATA_ROW - 1, c: 0 },
    });

    const withOldRow = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = buildCdiscountStockPriceWorkbook(withOldRow, [
      {
        reference: 'NEW',
        stock: 1,
        priceTtc: 12.25,
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const exported = XLSX.read(result.workbook, { type: 'array' });
    const exportedSheet = exported.Sheets[CDISCOUNT_STOCK_PRICE_SHEET];

    expect(exportedSheet.A5.v).toBe('NEW');
    expect(exportedSheet.A6).toBeUndefined();
  });

  it('fails closed before writing when one offer is invalid', () => {
    const result = buildCdiscountStockPriceWorkbook(createTemplate(), [
      {
        reference: 'VALID',
        stock: 2,
        priceTtc: 12,
      },
      {
        reference: 'INVALID|REFERENCE',
        ean: '123',
        stock: -1,
        priceTtc: 1,
      },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(6);
    expect(result.errors[0].errors.map((error) => error.code)).toEqual([
      'INVALID_REFERENCE_CHARACTER',
      'INVALID_EAN',
      'INVALID_STOCK',
      'INVALID_PRICE',
    ]);
  });

  it('rejects a modified template instead of exporting shifted columns', () => {
    const workbook = XLSX.read(createTemplate(), { type: 'array' });
    const sheet = workbook.Sheets[CDISCOUNT_STOCK_PRICE_SHEET];
    sheet.B4.v = 'Stock';
    sheet.C4.v = 'EAN';

    const changed = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    expect(() =>
      buildCdiscountStockPriceWorkbook(changed, [
        {
          reference: 'SHOP-001',
          stock: 1,
          priceTtc: 10,
        },
      ]),
    ).toThrow('CDISCOUNT_STOCK_PRICE_TEMPLATE_MISMATCH');
  });

  it('rejects a workbook without the official Cdiscount sheet', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['x']]), 'Wrong sheet');
    const template = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    expect(() => buildCdiscountStockPriceWorkbook(template, [])).toThrow(
      'CDISCOUNT_STOCK_PRICE_SHEET_MISSING',
    );
  });
});
