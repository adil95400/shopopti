import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { adminBillingService } from '../adminBillingService';

describe('adminBillingService', () => {
  beforeEach(() => invokeMock.mockReset());

  it('loads billing overview from the protected function', async () => {
    invokeMock.mockResolvedValue({
      data: { plans: [], subscriptions: [], totals: {} },
      error: null,
    });

    await adminBillingService.getOverview();

    expect(invokeMock).toHaveBeenCalledWith('admin-billing', {
      body: { mode: 'overview' },
    });
  });

  it('fails closed when the server rejects the request', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'forbidden' },
      error: null,
    });

    await expect(adminBillingService.getOverview()).rejects.toThrow('forbidden');
  });
});
