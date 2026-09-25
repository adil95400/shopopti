import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { adminOpsService } from '../adminOpsService';

describe('adminOpsService', () => {
  beforeEach(() => invokeMock.mockReset());

  it('requests operational data from the protected function', async () => {
    invokeMock.mockResolvedValue({
      data: { totals: {}, audits: [], backgroundJobs: [], syncQueue: [], webhookDeliveries: [] },
      error: null,
    });

    await adminOpsService.getOverview();

    expect(invokeMock).toHaveBeenCalledWith('admin-ops', {
      body: { mode: 'overview' },
    });
  });

  it('fails closed on server rejection', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'forbidden' },
      error: null,
    });

    await expect(adminOpsService.getOverview()).rejects.toThrow('forbidden');
  });
});
