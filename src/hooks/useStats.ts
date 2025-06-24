import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

export interface Stats {
  imports: number;
  orders: number;
  revenue: number;
}

export function useStats() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const { count: importsCount, error: importsError } = await supabase
        .from('product_imports')
        .select('*', { count: 'exact', head: true });
      if (importsError) throw importsError;

      const { count: ordersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });
      if (ordersError) throw ordersError;

      const { data: revenueAgg, error: revenueError } = await supabase
        .from('orders')
        .select('sum(total_amount) as revenue')
        .maybeSingle();
      if (revenueError) throw revenueError;

      setData({
        imports: importsCount || 0,
        orders: ordersCount || 0,
        revenue: revenueAgg?.revenue || 0
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { data, loading, error, refetch: fetchStats };
}
