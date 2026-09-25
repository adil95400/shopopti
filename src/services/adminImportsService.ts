import { supabase } from '@/lib/supabase';

export interface AdminImportsData {
  generatedAt: string;
  totals: {
    suppliers: number;
    connections: number;
    importJobs: number;
    productImportJobs: number;
    pipelineStates: number;
  };
  statusSummary: {
    suppliers: Record<string, number>;
    connections: Record<string, number>;
    importJobs: Record<string, number>;
    productImportJobs: Record<string, number>;
    pipelineStages: Record<string, number>;
  };
  suppliers: Array<{
    id: string;
    user_id: string | null;
    name: string;
    display_name: string | null;
    slug: string | null;
    supplier_type: string | null;
    connector_type: string | null;
    status: string | null;
    connection_status: string | null;
    is_active: boolean | null;
    is_verified: boolean | null;
    is_premium: boolean | null;
    country: string | null;
    rating: number | null;
    product_count: number | null;
    total_products: number | null;
    last_sync_at: string | null;
    last_sync_status: string | null;
    error_count: number | null;
    success_rate: number | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
  connections: Array<{
    id: string;
    user_id: string;
    connector_id: string;
    connector_name: string;
    status: string | null;
    last_sync_at: string | null;
    sync_stats: Record<string, unknown> | null;
    connected_at: string | null;
    updated_at: string | null;
  }>;
  importJobs: Array<{
    id: string;
    user_id: string;
    job_type: string | null;
    status: string | null;
    source_url: string | null;
    source_platform: string | null;
    total_products: number | null;
    processed_products: number | null;
    successful_imports: number | null;
    failed_imports: number | null;
    supplier_id: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  productImportJobs: Array<{
    id: string;
    user_id: string;
    source_url: string | null;
    platform: string | null;
    status: string | null;
    missing_fields: unknown;
    error_code: string | null;
    error_message: string | null;
    progress_percent: number | null;
    extraction_method: string | null;
    retry_count: number | null;
    max_retries: number | null;
    created_at: string;
    updated_at: string | null;
    started_at: string | null;
    completed_at: string | null;
  }>;
  pipelineStates: Array<{
    job_id: string;
    user_id: string;
    stage: string | null;
    source_id: string | null;
    source_product_id: string | null;
    source_url: string | null;
    attempt: number | null;
    issues: unknown;
    last_error: unknown;
    available_at: string | null;
    lease_owner: string | null;
    lease_expires_at: string | null;
    heartbeat_at: string | null;
    max_attempts: number | null;
    dead_lettered_at: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  provenance: Record<string, string>;
  completeness: {
    pageLimit: number;
    credentialsIncluded: boolean;
    mutationsEnabled: boolean;
  };
}

export const adminImportsService = {
  async getOverview() {
    const { data, error } = await supabase.functions.invoke('admin-imports', {
      body: { mode: 'overview' },
    });

    if (error) {
      throw new Error(error.message || 'Erreur du service Admin Imports');
    }

    if (data?.error) {
      throw new Error(data.message || data.error);
    }

    return data as AdminImportsData;
  },
};
