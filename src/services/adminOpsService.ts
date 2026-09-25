import { supabase } from '@/lib/supabase';

export interface AdminOpsData {
  generatedAt: string;
  totals: {
    audits: number;
    backgroundJobs: number;
    syncQueue: number;
    webhookDeliveries: number;
  };
  statusSummary: {
    backgroundJobs: Record<string, number>;
    syncQueue: Record<string, number>;
    webhookDeliveries: {
      success: number;
      failed: number;
      unknown: number;
    };
  };
  audits: Array<{
    id: string;
    actor_email: string | null;
    action: string | null;
    action_category: string | null;
    severity: string | null;
    resource_type: string | null;
    resource_id: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
  backgroundJobs: Array<{
    id: string;
    job_type: string | null;
    job_subtype: string | null;
    name: string | null;
    status: string | null;
    progress_percent: number | null;
    progress_message: string | null;
    error_message: string | null;
    retries: number | null;
    max_retries: number | null;
    created_at: string;
    updated_at: string | null;
    started_at: string | null;
    completed_at: string | null;
  }>;
  syncQueue: Array<{
    id: string;
    sync_type: string | null;
    entity_type: string | null;
    entity_id: string | null;
    action: string | null;
    status: string | null;
    priority: number | null;
    retry_count: number | null;
    max_retries: number | null;
    error_message: string | null;
    scheduled_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  webhookDeliveries: Array<{
    id: string;
    subscription_id: string | null;
    event_type: string | null;
    status_code: number | null;
    error_message: string | null;
    attempt_number: number | null;
    delivered_at: string | null;
    created_at: string;
    success: boolean | null;
  }>;
  provenance: Record<string, string>;
  completeness: {
    pageLimit: number;
    platformLogsIncluded: boolean;
    supabaseRuntimeLogsIncluded: boolean;
  };
}

export const adminOpsService = {
  async getOverview() {
    const { data, error } = await supabase.functions.invoke('admin-ops', {
      body: { mode: 'overview' },
    });

    if (error) throw new Error(error.message || 'Erreur du service Admin Ops');
    if (data?.error) throw new Error(data.message || data.error);

    return data as AdminOpsData;
  },
};
