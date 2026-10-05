import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export interface SupplierOrder {
  id: string;
  supplier_id: string | null;
  status: string;
  total_amount: number | null;
  line_items: unknown[];
  shipping_address: Record<string, unknown>;
  tracking_number: string | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

interface UseSupplierOrdersOptions {
  status?: string;
  limit?: number;
}

export function useSupplierOrders(options: UseSupplierOrdersOptions = {}) {
  const { status = 'all', limit = 250 } = options;
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) throw new Error('Utilisateur non authentifié');

      let query = supabase
        .from('supplier_orders')
        .select('id,supplier_id,status,total_amount,line_items,shipping_address,tracking_number,currency,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status !== 'all') query = query.eq('status', status);

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      const normalized = (data ?? []).map((row) => ({
        ...row,
        total_amount:
          row.total_amount === null || row.total_amount === undefined
            ? null
            : Number(row.total_amount),
        line_items: Array.isArray(row.line_items) ? row.line_items : [],
        shipping_address:
          row.shipping_address && typeof row.shipping_address === 'object'
            ? (row.shipping_address as Record<string, unknown>)
            : {},
      })) as SupplierOrder[];

      setOrders(normalized);
    } catch (cause) {
      setOrders([]);
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les commandes vérifiées');
    } finally {
      setLoading(false);
    }
  }, [limit, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { orders, loading, error, refresh };
}
