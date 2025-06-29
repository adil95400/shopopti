import { supabase } from '../lib/supabase';

export interface DailyImportCount {
  date: string;
  count: number;
}

export interface SalesAggregate {
  date: string;
  revenue: number;
  orders: number;
}

export interface SeoScore {
  id: string;
  product_id: string;
  score: number;
  created_at: string;
}

export const analyticsService = {
  async getDailyImportCounts(startDate?: string, endDate?: string): Promise<DailyImportCount[]> {
    try {
      const { data, error } = await supabase
        .from('product_imports')
        .select('id, created_at')
        .gte('created_at', startDate || '1970-01-01')
        .lte('created_at', endDate || new Date().toISOString());

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const date = row.created_at.split('T')[0];
        counts[date] = (counts[date] || 0) + 1;
      });

      return Object.entries(counts).map(([date, count]) => ({ date, count }));
    } catch (error) {
      console.error('Error fetching daily import counts:', error);
      throw error;
    }
  },

  async getSalesData(startDate?: string, endDate?: string): Promise<SalesAggregate[]> {
    try {
      const end = endDate || new Date().toISOString();
      const start = startDate || '1970-01-01';

      // Try orders table first
      let { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, created_at')
        .gte('created_at', start)
        .lte('created_at', end);

      if (error && !data) {
        // Fallback to marketplace_analytics
        const res = await supabase
          .from('marketplace_analytics')
          .select('revenue, date');
        data = res.data;
        error = res.error;
      }

      if (error) throw error;

      const aggregates: Record<string, { revenue: number; orders: number }> = {};

      (data || []).forEach((row: any) => {
        const date = (row.created_at || row.date).split('T')[0];
        const revenue = Number(row.total_amount || row.revenue || 0);
        if (!aggregates[date]) {
          aggregates[date] = { revenue: 0, orders: 0 };
        }
        aggregates[date].revenue += revenue;
        aggregates[date].orders += 1;
      });

      return Object.entries(aggregates).map(([date, vals]) => ({
        date,
        revenue: vals.revenue,
        orders: vals.orders
      }));
    } catch (error) {
      console.error('Error aggregating sales data:', error);
      throw error;
    }
  },

  async getSeoScores(productId?: string): Promise<SeoScore[]> {
    try {
      let query = supabase.from('seo_scores').select('*');
      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SeoScore[];
    } catch (error) {
      console.error('Error fetching SEO scores:', error);
      throw error;
    }
  }
};
