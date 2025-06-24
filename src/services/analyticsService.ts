import { supabase } from '../lib/supabase';

export interface DailyImportCount {
  date: string;
  count: number;
}

export interface SalesData {
  date: string;
  orders: number;
  revenue: number;
}

export interface SeoScore {
  product_id: string;
  score: number;
  updated_at: string;
}

export const analyticsService = {
  async getDailyImportCounts(days = 30): Promise<DailyImportCount[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - (days - 1));

      const { data, error } = await supabase
        .from('product_imports')
        .select('id, created_at')
        .gte('created_at', since.toISOString());

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const date = row.created_at.split('T')[0];
        counts[date] = (counts[date] || 0) + 1;
      }

      return Object.entries(counts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));
    } catch (error) {
      console.error('Error fetching daily import counts:', error);
      throw error;
    }
  },

  async getSalesData(days = 30): Promise<SalesData[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - (days - 1));
      const fromDate = since.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('marketplace_analytics')
        .select('conversions, revenue, date')
        .gte('date', fromDate);

      if (error) throw error;

      const totals: Record<string, { orders: number; revenue: number }> = {};
      for (const row of data || []) {
        if (!totals[row.date]) {
          totals[row.date] = { orders: 0, revenue: 0 };
        }
        totals[row.date].orders += row.conversions || 0;
        totals[row.date].revenue += row.revenue || 0;
      }

      return Object.entries(totals)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, { orders, revenue }]) => ({ date, orders, revenue }));
    } catch (error) {
      console.error('Error fetching sales data:', error);
      throw error;
    }
  },

  async getSeoScores(): Promise<SeoScore[]> {
    try {
      const { data, error } = await supabase
        .from('seo_scores')
        .select('*');

      if (error) {
        // If table doesn't exist, return empty array
        if (error.code === '42P01') return [];
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching SEO scores:', error);
      throw error;
    }
  }
};
