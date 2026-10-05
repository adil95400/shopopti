import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { percentChange } from '@/utils/dashboardMetrics';

export type DashboardPeriod = 7 | 30 | 90;

export interface DashboardMetric {
  value: number | null;
  change: number | null;
  source: string;
}

interface MarketplaceOrderRow {
  id: string;
  total_amount: number | string | null;
  order_date: string;
  platform: string;
  status: string;
}

interface ProductMetricRow {
  views: number | null;
  orders: number | null;
  period_start: string;
}

export interface DashboardStats {
  revenue: DashboardMetric;
  orders: DashboardMetric;
  visitors: DashboardMetric;
  conversion: DashboardMetric;
  recentOrders: MarketplaceOrderRow[];
}

const sum = (rows: Array<Record<string, unknown>>, key: string) =>
  rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);

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
        currentOrdersResult,
        previousOrdersResult,
        currentMetricsResult,
        previousMetricsResult,
      ] = await Promise.all([
        supabase
          .from('marketplace_orders')
          .select('id,total_amount,order_date,platform,status')
          .gte('order_date', boundaries.currentStart)
          .order('order_date', { ascending: false }),
        supabase
          .from('marketplace_orders')
          .select('id,total_amount,order_date,platform,status')
          .gte('order_date', boundaries.previousStart)
          .lt('order_date', boundaries.currentStart),
        supabase
          .from('product_metrics')
          .select('views,orders,period_start')
          .gte('period_start', boundaries.currentDate),
        supabase
          .from('product_metrics')
          .select('views,orders,period_start')
          .gte('period_start', boundaries.previousDate)
          .lt('period_start', boundaries.currentDate),
      ]);

      if (currentOrdersResult.error) throw currentOrdersResult.error;
      if (previousOrdersResult.error) throw previousOrdersResult.error;
      if (currentMetricsResult.error) throw currentMetricsResult.error;
      if (previousMetricsResult.error) throw previousMetricsResult.error;

      const currentOrders = (currentOrdersResult.data ?? []) as MarketplaceOrderRow[];
      const previousOrders = (previousOrdersResult.data ?? []) as MarketplaceOrderRow[];
      const currentMetrics = (currentMetricsResult.data ?? []) as ProductMetricRow[];
      const previousMetrics = (previousMetricsResult.data ?? []) as ProductMetricRow[];

      const currentRevenue = currentOrders.length > 0 ? sum(currentOrders as unknown as Array<Record<string, unknown>>, 'total_amount') : null;
      const previousRevenue = previousOrders.length > 0 ? sum(previousOrders as unknown as Array<Record<string, unknown>>, 'total_amount') : null;
      const currentViews = currentMetrics.length > 0 ? sum(currentMetrics as unknown as Array<Record<string, unknown>>, 'views') : null;
      const previousViews = previousMetrics.length > 0 ? sum(previousMetrics as unknown as Array<Record<string, unknown>>, 'views') : null;
      const currentProductOrders = currentMetrics.length > 0 ? sum(currentMetrics as unknown as Array<Record<string, unknown>>, 'orders') : null;
      const previousProductOrders = previousMetrics.length > 0 ? sum(previousMetrics as unknown as Array<Record<string, unknown>>, 'orders') : null;

      const currentConversion =
        currentViews !== null && currentViews > 0 && currentProductOrders !== null
          ? (currentProductOrders / currentViews) * 100
          : null;
      const previousConversion =
        previousViews !== null && previousViews > 0 && previousProductOrders !== null
          ? (previousProductOrders / previousViews) * 100
          : null;

      setStats({
        revenue: {
          value: currentRevenue,
          change: currentRevenue !== null && previousRevenue !== null ? percentChange(currentRevenue, previousRevenue) : null,
          source: 'marketplace_orders',
        },
        orders: {
          value: currentOrders.length > 0 ? currentOrders.length : null,
          change: currentOrders.length > 0 && previousOrders.length > 0 ? percentChange(currentOrders.length, previousOrders.length) : null,
          source: 'marketplace_orders',
        },
        visitors: {
          value: currentViews,
          change: currentViews !== null && previousViews !== null ? percentChange(currentViews, previousViews) : null,
          source: 'product_metrics',
        },
        conversion: {
          value: currentConversion === null ? null : Math.round((currentConversion + Number.EPSILON) * 100) / 100,
          change: currentConversion !== null && previousConversion !== null ? percentChange(currentConversion, previousConversion) : null,
          source: 'product_metrics',
        },
        recentOrders: currentOrders.slice(0, 5),
      });
    } catch (cause) {
      setStats(null);
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les statistiques vérifiées');
    } finally {
      setLoading(false);
    }
  }, [boundaries]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
