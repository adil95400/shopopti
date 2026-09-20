export interface AmountRow {
  total_amount: number | string | null;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round((((current - previous) / previous) * 100 + Number.EPSILON) * 10) / 10;
}

export function sumAmount(rows: AmountRow[]): number {
  return rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
}
