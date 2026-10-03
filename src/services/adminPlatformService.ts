import { supabase } from '@/lib/supabase';

export interface AdminPlatformData {
  generatedAt: string;
  flags: Array<{
    id: string;
    key: string;
    name: string | null;
    description: string | null;
    category: string | null;
    is_enabled: boolean;
    is_public: boolean;
    min_plan: string | null;
    rollout_percentage: number | null;
    expires_at: string | null;
    updated_at: string | null;
  }>;
  supportTickets: Array<{
    id: string;
    user_id: string | null;
    subject: string | null;
    email: string | null;
    status: string | null;
    priority: string | null;
    category: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  enterpriseSettings: Array<{
    id: string;
    setting_category: string | null;
    setting_key: string | null;
    setting_value: unknown;
    is_encrypted: boolean | null;
    access_level: string | null;
    updated_at: string | null;
  }>;
  featureFlagAudit: Array<{
    id: string;
    flag_id: string | null;
    flag_key: string | null;
    action: string | null;
    actor_id: string | null;
    old_value: unknown;
    new_value: unknown;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
  totals: {
    flags: number;
    enabledFlags: number;
    publicFlags: number;
    supportTickets: number;
    openSupportTickets: number;
    enterpriseSettings: number;
  };
  provenance: Record<string, string>;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-platform', { body });

  if (error) throw new Error(error.message || 'Erreur du service Admin Platform');
  if (data?.error) throw new Error(data.message || data.error);

  return data as T;
}

export const adminPlatformService = {
  getOverview() {
    return invoke<AdminPlatformData>({ action: 'overview' });
  },

  setFlagEnabled(flagId: string, enabled: boolean) {
    return invoke<{ success: true; flag: { id: string; key: string; is_enabled: boolean } }>({
      action: 'set_flag_enabled',
      flagId,
      enabled,
    });
  },

  setTicketStatus(ticketId: string, status: string) {
    return invoke<{ success: true; ticket: { id: string; status: string } }>({
      action: 'set_ticket_status',
      ticketId,
      status,
    });
  },
};
