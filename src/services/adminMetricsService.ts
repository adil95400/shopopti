import { supabase } from '@/lib/supabase';

export interface GrowthMetric {
  growthPct: number | null;
}

export interface AdminDashboardData {
  period: string;
  periodDays: number;
  generatedAt: string;
  metrics: {
    users: {
      total: number;
      currentPeriodNew: number;
      growthPct: number | null;
    };
    products: {
      total: number;
    };
    orders: {
      total: number;
      currentPeriod: number;
      growthPct: number | null;
    };
    paidRevenue: {
      amount: number | null;
      currency: string | null;
      paidOrders: number;
      growthPct: number | null;
      verified: boolean;
    };
    grossOrderValue: {
      amount: number | null;
      currency: string | null;
      growthPct: number | null;
      verified: boolean;
    };
  };
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    created_at: string;
  }>;
  recentOrders: Array<{
    id: string;
    order_number: string;
    total_amount: number;
    currency: string | null;
    financial_status: string | null;
    created_at: string;
    customer_email: string | null;
    customer_name: string | null;
  }>;
  provenance: Record<string, string>;
  completeness: Record<string, boolean>;
}

export interface AdminAnalyticsData {
  period: string;
  periodDays: number;
  generatedAt: string;
  metrics: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    products: number;
    totalOrders: number;
    periodOrders: number;
    ordersGrowthPct: number | null;
    paidRevenue: number | null;
    paidRevenueCurrency: string | null;
    paidRevenueGrowthPct: number | null;
    grossOrderValue: number | null;
    grossOrderValueCurrency: string | null;
    grossOrderValueGrowthPct: number | null;
    averageOrderValue: number | null;
    conversionRate: number | null;
  };
  roleDistribution: Array<{ role: string; count: number }>;
  timeSeries: Array<{
    date: string;
    orders: number;
    paidRevenue: number;
    grossOrderValue: number;
  }>;
  topProducts: [];
  recentActivity: [];
  provenance: Record<string, string>;
  completeness: Record<string, boolean>;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-metrics', {
    body,
  });

  if (error) {
    throw new Error(error.message || 'Erreur du service de métriques Admin');
  }

  if (data?.error) {
    throw new Error(data.message || data.error);
  }

  return data as T;
}

export const adminMetricsService = {
  getDashboard(period = '30days') {
    return invoke<AdminDashboardData>({
      mode: 'dashboard',
      period,
    });
  },

  getAnalytics(period = '30days') {
    return invoke<AdminAnalyticsData>({
      mode: 'analytics',
      period,
    });
  },
};
