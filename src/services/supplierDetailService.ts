import { supabase } from '@/lib/supabase';
import type { SupplierSummary } from '@/types/supplier';

export interface SupplierConnectionMetrics {
  importedProducts: number | null;
  webhookEvents: number | null;
  dispatchedOrders: number | null;
  stockVariants: number | null;
}

export interface SupplierConnectionDetail {
  supplier: SupplierSummary;
  metrics: SupplierConnectionMetrics;
}

const countOwnedRows = async (
  table: 'supplier_product_snapshots' | 'cj_webhook_events' | 'supplier_order_dispatches' | 'supplier_variant_stock',
  supplierId: string
): Promise<number | null> => {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId);

  if (error) {
    console.error(`Unable to count ${table} for supplier ${supplierId}:`, error);
    return null;
  }

  return count ?? 0;
};

export const supplierDetailService = {
  async get(supplierId: string): Promise<SupplierConnectionDetail> {
    const { data, error } = await supabase
      .from('external_suppliers')
      .select('id,name,type,status,last_sync,webhook_status,webhook_last_event_at,created_at')
      .eq('id', supplierId)
      .neq('type', 'autods')
      .single();

    if (error) throw error;

    const [importedProducts, webhookEvents, dispatchedOrders, stockVariants] =
      await Promise.all([
        countOwnedRows('supplier_product_snapshots', supplierId),
        countOwnedRows('cj_webhook_events', supplierId),
        countOwnedRows('supplier_order_dispatches', supplierId),
        countOwnedRows('supplier_variant_stock', supplierId),
      ]);

    return {
      supplier: {
        id: data.id,
        name: data.name,
        type: data.type,
        status: data.status,
        lastSync: data.last_sync ?? undefined,
        webhookStatus: data.webhook_status ?? 'not_configured',
        webhookLastEventAt: data.webhook_last_event_at ?? undefined,
        created_at: data.created_at,
      },
      metrics: {
        importedProducts,
        webhookEvents,
        dispatchedOrders,
        stockVariants,
      },
    };
  },
};
