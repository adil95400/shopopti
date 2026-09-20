import { describe, expect, it } from 'vitest';

import { aggregateProductAnalytics } from '../analyticsService';

describe('aggregateProductAnalytics', () => {
  it('aggregates verified marketplace analytics without inventing profit', () => {
    const snapshot = aggregateProductAnalytics(
      [
        { id: 'p1', title: 'Alpha' },
        { id: 'p2', title: 'Beta' },
      ],
      [
        {
          product_id: 'p1',
          views: 100,
          clicks: 20,
          conversions: 5,
          revenue: '125.50',
          date: '2026-09-18',
        },
        {
          product_id: 'p1',
          views: 50,
          clicks: 10,
          conversions: 2,
          revenue: 50,
          date: '2026-09-19',
        },
        {
          product_id: 'p2',
          views: 25,
          clicks: 4,
          conversions: 1,
          revenue: 20,
          date: '2026-09-19',
        },
      ],
      { from: '2026-09-18', to: '2026-09-19' },
      '2026-09-20T20:00:00.000Z',
    );

    expect(snapshot.revenue).toBe(195.5);
    expect(snapshot.views).toBe(175);
    expect(snapshot.clicks).toBe(34);
    expect(snapshot.conversions).toBe(8);
    expect(snapshot.conversionRate).toBeCloseTo((8 / 175) * 100);
    expect(snapshot.profit).toBeNull();
    expect(snapshot.products[0]).toMatchObject({
      productId: 'p1',
      name: 'Alpha',
      revenue: 175.5,
      conversions: 7,
    });
    expect(snapshot.dailyRevenue).toEqual([
      { date: '2026-09-18', value: 125.5 },
      { date: '2026-09-19', value: 70 },
    ]);
  });

  it('returns null conversion rate when no verified views exist', () => {
    const snapshot = aggregateProductAnalytics(
      [{ id: 'p1', title: 'Alpha' }],
      [
        {
          product_id: 'p1',
          views: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
          date: '2026-09-20',
        },
      ],
      { from: '2026-09-20', to: '2026-09-20' },
    );

    expect(snapshot.conversionRate).toBeNull();
    expect(snapshot.products[0].conversionRate).toBeNull();
  });

  it('ignores rows that cannot be tied to one of the authenticated user products', () => {
    const snapshot = aggregateProductAnalytics(
      [{ id: 'p1', title: 'Alpha' }],
      [
        {
          product_id: 'foreign',
          views: 10,
          clicks: 2,
          conversions: 1,
          revenue: 99,
          date: '2026-09-20',
        },
      ],
      { from: '2026-09-20', to: '2026-09-20' },
    );

    expect(snapshot.products).toEqual([]);
    expect(snapshot.revenue).toBe(99);
  });
});
