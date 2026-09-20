export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round((((current - previous) / previous) * 100 + Number.EPSILON) * 10) / 10;
}
