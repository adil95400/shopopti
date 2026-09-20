import { describe, expect, it } from 'vitest';

import { percentChange, sumAmount } from '@/utils/dashboardMetrics';

describe('dashboard metric helpers', () => {
  it('computes positive and negative previous-period changes', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(75, 100)).toBe(-25);
  });

  it('does not invent a percentage when the previous period is zero', () => {
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
  });

  it('sums supplier order amounts defensively', () => {
    expect(
      sumAmount([
        { id: '1', status: 'pending', total_amount: '12.50', created_at: '2026-09-20T10:00:00Z' },
        { id: '2', status: 'shipped', total_amount: 7.5, created_at: '2026-09-20T11:00:00Z' },
        { id: '3', status: 'delivered', total_amount: null, created_at: '2026-09-20T12:00:00Z' },
      ])
    ).toBe(20);
  });
});
