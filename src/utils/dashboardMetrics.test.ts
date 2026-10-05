import { describe, expect, it } from 'vitest';

import { percentChange } from '../dashboardMetrics';

describe('percentChange', () => {
  it('computes verified previous-period change', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(75, 100)).toBe(-25);
  });

  it('fails closed when the previous period is zero', () => {
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
  });
});
