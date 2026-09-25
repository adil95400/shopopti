import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { adminPlatformService } from '../adminPlatformService';

describe('adminPlatformService', () => {
  beforeEach(() => invokeMock.mockReset());

  it('loads platform controls from the protected function', async () => {
    invokeMock.mockResolvedValue({
      data: { flags: [], supportTickets: [], enterpriseSettings: [], totals: {} },
      error: null,
    });

    await adminPlatformService.getOverview();

    expect(invokeMock).toHaveBeenCalledWith('admin-platform', {
      body: { action: 'overview' },
    });
  });

  it('sends feature flag mutations server-side', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, flag: { id: 'flag-1', key: 'x', is_enabled: false } },
      error: null,
    });

    await adminPlatformService.setFlagEnabled('flag-1', false);

    expect(invokeMock).toHaveBeenCalledWith('admin-platform', {
      body: { action: 'set_flag_enabled', flagId: 'flag-1', enabled: false },
    });
  });

  it('fails closed on server rejection', async () => {
    invokeMock.mockResolvedValue({ data: { error: 'forbidden' }, error: null });

    await expect(adminPlatformService.getOverview()).rejects.toThrow('forbidden');
  });
});
