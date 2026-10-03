import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { adminMetricsService } from '../adminMetricsService';

describe('adminMetricsService', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('requests dashboard metrics from the protected edge function', async () => {
    invokeMock.mockResolvedValue({
      data: { period: '30days', metrics: {}, recentUsers: [], recentOrders: [] },
      error: null,
    });

    await adminMetricsService.getDashboard('30days');

    expect(invokeMock).toHaveBeenCalledWith('admin-metrics', {
      body: { mode: 'dashboard', period: '30days' },
    });
  });

  it('requests analytics for the selected period', async () => {
    invokeMock.mockResolvedValue({
      data: { period: '7days', metrics: {}, roleDistribution: [], timeSeries: [] },
      error: null,
    });

    await adminMetricsService.getAnalytics('7days');

    expect(invokeMock).toHaveBeenCalledWith('admin-metrics', {
      body: { mode: 'analytics', period: '7days' },
    });
  });

  it('fails closed when the server rejects the request', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'forbidden' },
      error: null,
    });

    await expect(adminMetricsService.getDashboard()).rejects.toThrow('forbidden');
  });
});
