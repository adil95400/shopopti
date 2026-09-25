import { supabase } from '@/lib/supabase';
import type { SupplierProviderType } from '@/types/supplier';

export type SupplierConnectorAvailability = 'enabled' | 'maintenance' | 'disabled';

export interface SupplierConnectorSetting {
  provider: SupplierProviderType;
  status: SupplierConnectorAvailability;
  updated_at: string;
  updated_by?: string | null;
}

export const supplierConnectorSettingsService = {
  async list(): Promise<SupplierConnectorSetting[]> {
    const { data, error } = await supabase
      .from('supplier_connector_settings')
      .select('provider,status,updated_at,updated_by')
      .order('provider');

    if (error) throw error;
    return (data ?? []) as SupplierConnectorSetting[];
  },

  async update(
    provider: SupplierProviderType,
    status: SupplierConnectorAvailability
  ): Promise<SupplierConnectorSetting> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .from('supplier_connector_settings')
      .upsert(
        {
          provider,
          status,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider' }
      )
      .select('provider,status,updated_at,updated_by')
      .single();

    if (error) throw error;
    return data as SupplierConnectorSetting;
  },
};
