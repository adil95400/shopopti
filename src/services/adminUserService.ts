import { supabase } from '@/lib/supabase';

export type AdminRole = 'user' | 'admin' | 'staff' | 'agency';

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  company_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  is_active: boolean;
  role: AdminRole;
  roles: string[];
}

interface AdminUsersResponse {
  users: AdminUserRecord[];
  page: number;
  perPage: number;
  total: number;
  lastPage: number | null;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });

  if (error) {
    throw new Error(error.message || 'Erreur du service administrateur');
  }

  if (data?.error) {
    throw new Error(data.message || data.error);
  }

  return data as T;
}

export const adminUserService = {
  listUsers(page = 1, perPage = 50) {
    return invoke<AdminUsersResponse>({ action: 'list', page, perPage });
  },

  inviteUser(email: string, name?: string) {
    return invoke<{ success: true; userId: string | null }>({
      action: 'invite',
      email,
      name,
    });
  },

  setRole(userId: string, role: AdminRole) {
    return invoke<{ success: true; role: AdminRole }>({
      action: 'set_role',
      userId,
      role,
    });
  },

  setSuspended(userId: string, suspended: boolean) {
    return invoke<{ success: true; banned_until: string | null }>({
      action: suspended ? 'suspend' : 'unsuspend',
      userId,
    });
  },

  deleteUser(userId: string) {
    return invoke<{ success: true }>({ action: 'delete', userId });
  },
};
