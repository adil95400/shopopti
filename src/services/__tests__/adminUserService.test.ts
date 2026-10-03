import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { adminUserService } from '../adminUserService';

describe('adminUserService', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('lists users through the protected admin function', async () => {
    invokeMock.mockResolvedValue({
      data: { users: [], page: 2, perPage: 25, total: 0, lastPage: null },
      error: null,
    });

    const result = await adminUserService.listUsers(2, 25);

    expect(invokeMock).toHaveBeenCalledWith('admin-users', {
      body: { action: 'list', page: 2, perPage: 25 },
    });
    expect(result.users).toEqual([]);
  });

  it('sends role mutations to the server-side function', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, role: 'admin' },
      error: null,
    });

    await adminUserService.setRole('user-1', 'admin');

    expect(invokeMock).toHaveBeenCalledWith('admin-users', {
      body: { action: 'set_role', userId: 'user-1', role: 'admin' },
    });
  });

  it('fails closed when the edge function reports an error', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'forbidden' },
      error: null,
    });

    await expect(adminUserService.deleteUser('user-2')).rejects.toThrow('forbidden');
  });
});
