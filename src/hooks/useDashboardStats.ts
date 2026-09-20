import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { percentChange } from '@/utils/dashboardMetrics';

export type DashboardPeriod = 7 | 30 | 90;

interface Metric {
  value: number;
  change: number | null;
}

interface SupplierOrderRow {
  id: string;
  status: string;
  total_amount: number | string | null;
  created_at: string;
}

interface AnalyticsRow {
  views: number | null;
  conversions: number | null;
  revenue: number | string | null;
  date: string;
}

export interface DashboardStats {
  products: number;
  revenue: Metric;
  orders: Metric;
  visitors: Metric;
  conversion: Metric;
  recentOrders: SupplierOrderRow[];
}

export function useDashboardStats(period: DashboardPeriod) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const boundaries = useMemo(() => {
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(now.getDate() - period);

    const previousStart = new Date(currentStart);
    previousStart.setDate(currentStart.getDate() - period);

    return {
      currentStart: currentStart.toISOString(),
      previousStart: previousStart.toISOString(),
      currentDate: currentStart.toISOString().slice(0, 10),
      previousDate: previousStart.toISOString().slice(0, 10),
    };
  }, [period]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) throw new Error('Utilisateur non authentifié');

      const [
        productsResult,
        currentOrdersResult,
        previousOrdersResult,
        currentAnalyticsResult,
        previousAnalyticsResult,
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase
          .from('supplier_orders')
          .select('id,status,total_amount,created_at')
          .gte('created_at', boundaries.currentStart)
          .order('created_at', { ascending: false }),
        supabase
          .from('supplier_orders')
          .select('id,status,total_amount,created_at')
          .gte('created_at', boundaries.previousStart)
          .lt('created_at', boundaries.currentStart),
        supabase
          .from('marketplace_analytics')
          .select('views,conversions,revenue,date')
          .gte('date', boundaries.currentDate),
        supabase
          .from('marketplace_analytics')
          .select('views,conversions,revenue,date')
          .gte('date', boundaries.previousDate)
          .lt('date', boundaries.currentDate),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (currentOrdersResult.error) throw currentOrdersResult.error;
      if (previousOrdersResult.error) throw previousOrdersResult.error;
      if (currentAnalyticsResult.error) throw currentAnalyticsResult.error;
      if (previousAnalyticsResult.error) throw previousAnalyticsResult.error;

      const currentOrders = (currentOrdersResult.data || []) as SupplierOrderRow[];
      const previousOrders = (previousOrdersResult.data || []) as SupplierOrderRow[];
      const currentAnalytics = (currentAnalyticsResult.data || []) as AnalyticsRow[];
      const previousAnalytics = (previousAnalyticsResult.data || []) as AnalyticsRow[];

      const currentRevenue = currentAnalytics.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
      const previousRevenue = previousAnalytics.reduce((sum, row) => sum + Number(row.revenue || 0), 0);

      const currentViews = currentAnalytics.reduce((sum, row) => sum + Number(row.views || 0), 0);
      const previousViews = previousAnalytics.reduce((sum, row) => sum + Number(row.views || 0), 0);
      const currentConversions = currentAnalytics.reduce((sum, row) => sum + Number(row.conversions || 0), 0);
      const previousConversions = previousAnalytics.reduce((sum, row) => sum + Number(row.conversions || 0), 0);

      const currentConversion = currentViews > 0 ? (currentConversions / currentViews) * 100 : 0;
      const previousConversion = previousViews > 0 ? (previousConversions / previousViews) * 100 : 0;

      setStats({
        products: productsResult.count || 0,
        revenue: { value: currentRevenue, change: percentChange(currentRevenue, previousRevenue) },
        orders: { value: currentOrders.length, change: percentChange(currentOrders.length, previousOrders.length) },
        visitors: { value: currentViews, change: percentChange(currentViews, previousViews) },
        conversion: {
          value: Math.round((currentConversion + Number.EPSILON) * 100) / 100,
          change: percentChange(currentConversion, previousConversion),
        },
        recentOrders: currentOrders.slice(0, 5),
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible de charger les statistiques';
      setStats(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boundaries]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
