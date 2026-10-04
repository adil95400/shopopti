import * as XLSX from 'xlsx';

import {
  CDISCOUNT_STOCK_PRICE_HEADERS,
  type CdiscountStockPriceInput,
  type CdiscountValidationError,
  assertCdiscountStockPriceHeaders,
  validateAndBuildCdiscountStockPriceRow,
} from './cdiscountOfferContract';

export const CDISCOUNT_STOCK_PRICE_SHEET = 'Fichier Intégration Offre';
export const CDISCOUNT_STOCK_PRICE_HEADER_ROW = 4;
export const CDISCOUNT_STOCK_PRICE_FIRST_DATA_ROW = 5;

export type CdiscountStockPriceExportError = {
  row: number;
  reference: string;
  errors: CdiscountValidationError[];
};

export type CdiscountStockPriceExportResult =
  | { ok: true; workbook: ArrayBuffer; exportedRows: number }
  | { ok: false; errors: CdiscountStockPriceExportError[] };

function readHeaderRow(sheet: XLSX.WorkSheet): unknown[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:D4');
  const endColumn = Math.max(range.e.c, CDISCOUNT_STOCK_PRICE_HEADERS.length - 1);

  return Array.from({ length: CDISCOUNT_STOCK_PRICE_HEADERS.length }, (_, index) => {
    if (index > endColumn) return undefined;
    return sheet[XLSX.utils.encode_cell({ r: CDISCOUNT_STOCK_PRICE_HEADER_ROW - 1, c: index })]?.v;
  });
}

function clearExistingDataRows(sheet: XLSX.WorkSheet): void {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:D4');

  for (let row = CDISCOUNT_STOCK_PRICE_FIRST_DATA_ROW - 1; row <= range.e.r; row += 1) {
    for (let column = 0; column < CDISCOUNT_STOCK_PRICE_HEADERS.length; column += 1) {
      delete sheet[XLSX.utils.encode_cell({ r: row, c: column })];
    }
  }
}

function updateSheetRange(sheet: XLSX.WorkSheet, rowCount: number): void {
  const current = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:D4');
  const lastDataRow = CDISCOUNT_STOCK_PRICE_FIRST_DATA_ROW - 1 + Math.max(rowCount, 1);

  sheet['!ref'] = XLSX.utils.encode_range({
    s: current.s,
    e: {
      r: Math.max(current.e.r, lastDataRow - 1),
      c: Math.max(current.e.c, CDISCOUNT_STOCK_PRICE_HEADERS.length - 1),
    },
  });
}

export function buildCdiscountStockPriceWorkbook(
  template: ArrayBuffer | Uint8Array,
  offers: readonly CdiscountStockPriceInput[],
): CdiscountStockPriceExportResult {
  const rows: [string, string, string, string][] = [];
  const errors: CdiscountStockPriceExportError[] = [];

  offers.forEach((offer, index) => {
    const result = validateAndBuildCdiscountStockPriceRow(offer);

    if (!result.ok) {
      errors.push({
        row: CDISCOUNT_STOCK_PRICE_FIRST_DATA_ROW + index,
        reference: offer.reference,
        errors: result.errors,
      });
      return;
    }

    rows.push(result.row);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const workbook = XLSX.read(template, {
    type: 'array',
    cellStyles: true,
    cellDates: true,
  });

  const sheet = workbook.Sheets[CDISCOUNT_STOCK_PRICE_SHEET];
  if (!sheet) {
    throw new Error('CDISCOUNT_STOCK_PRICE_SHEET_MISSING');
  }

  assertCdiscountStockPriceHeaders(readHeaderRow(sheet));
  clearExistingDataRows(sheet);

  if (rows.length > 0) {
    XLSX.utils.sheet_add_aoa(sheet, rows, {
      origin: {
        r: CDISCOUNT_STOCK_PRICE_FIRST_DATA_ROW - 1,
        c: 0,
      },
    });
  }

  updateSheetRange(sheet, rows.length);

  const output = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
    cellStyles: true,
  });

  return {
    ok: true,
    workbook: output as ArrayBuffer,
    exportedRows: rows.length,
  };
}
