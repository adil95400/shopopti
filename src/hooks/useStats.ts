import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

interface Metric {
  value: number;
  change: number;
}

export interface Stats {
  imports: number;
  revenue: Metric;
  orders: Metric;
  visitors: Metric;
  conversion: Metric;
}

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const { count: productCount, error: productError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      if (productError) throw productError;

      const { data: ordersData, error: ordersError } = await supabase
        .from('supplier_orders')
        .select('total_amount');
      if (ordersError) throw ordersError;
      const orders = ordersData ? ordersData.length : 0;
      const revenueTotal = ordersData
        ? ordersData.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
        : 0;

      const { count: visitorsCount, error: visitorsError } = await supabase
        .from('marketplace_analytics')
        .select('*', { count: 'exact', head: true });
      if (visitorsError) throw visitorsError;

      const conversionRate = visitorsCount
        ? Math.round(((orders / visitorsCount) * 100 + Number.EPSILON) * 100) / 100
        : 0;

      setStats({
        imports: productCount || 0,
        revenue: { value: revenueTotal, change: 0 },
        orders: { value: orders, change: 0 },
        visitors: { value: visitorsCount || 0, change: 0 },
        conversion: { value: conversionRate, change: 0 }
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, error, refetch: fetchStats };
}
