import { supabase } from '@/lib/supabase';

export type AnalyticsRange = {
  from: string;
  to: string;
};

export type ProductAnalyticsMetric = {
  productId: string;
  name: string;
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  conversionRate: number | null;
};

export type ProductAnalyticsSnapshot = {
  range: AnalyticsRange;
  revenue: number;
  views: number;
  clicks: number;
  conversions: number;
  conversionRate: number | null;
  profit: null;
  products: ProductAnalyticsMetric[];
  dailyRevenue: Array<{ date: string; value: number }>;
  source: 'marketplace_analytics';
  verifiedAt: string;
};

type ProductRow = {
  id: string;
  title: string;
};

type AnalyticsRow = {
  product_id: string | null;
  views: number | null;
  clicks: number | null;
  conversions: number | null;
  revenue: number | string | null;
  date: string;
};

const asFiniteNumber = (value: unknown): number => {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : 0;
};

export const aggregateProductAnalytics = (
  products: ProductRow[],
  rows: AnalyticsRow[],
  range: AnalyticsRange,
  verifiedAt = new Date().toISOString(),
): ProductAnalyticsSnapshot => {
  const productNames = new Map(products.map((product) => [product.id, product.title]));
  const byProduct = new Map<string, ProductAnalyticsMetric>();
  const byDate = new Map<string, number>();

  let revenue = 0;
  let views = 0;
  let clicks = 0;
  let conversions = 0;

  for (const row of rows) {
    const rowViews = asFiniteNumber(row.views);
    const rowClicks = asFiniteNumber(row.clicks);
    const rowConversions = asFiniteNumber(row.conversions);
    const rowRevenue = asFiniteNumber(row.revenue);

    revenue += rowRevenue;
    views += rowViews;
    clicks += rowClicks;
    conversions += rowConversions;
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + rowRevenue);

    if (!row.product_id || !productNames.has(row.product_id)) continue;

    const current = byProduct.get(row.product_id) ?? {
      productId: row.product_id,
      name: productNames.get(row.product_id) ?? 'Produit',
      views: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      conversionRate: null,
    };

    current.views += rowViews;
    current.clicks += rowClicks;
    current.conversions += rowConversions;
    current.revenue += rowRevenue;
    byProduct.set(row.product_id, current);
  }

  const productMetrics = Array.from(byProduct.values())
    .map((metric) => ({
      ...metric,
      conversionRate: metric.views > 0 ? (metric.conversions / metric.views) * 100 : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    range,
    revenue,
    views,
    clicks,
    conversions,
    conversionRate: views > 0 ? (conversions / views) * 100 : null,
    profit: null,
    products: productMetrics,
    dailyRevenue: Array.from(byDate.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    source: 'marketplace_analytics',
    verifiedAt,
  };
};

export const productAnalyticsService = {
  async getSnapshot(range: AnalyticsRange): Promise<ProductAnalyticsSnapshot> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error('AUTH_REQUIRED');

    const [{ data: products, error: productsError }, { data: analytics, error: analyticsError }] =
      await Promise.all([
        supabase.from('products').select('id,title').eq('user_id', user.id),
        supabase
          .from('marketplace_analytics')
          .select('product_id,views,clicks,conversions,revenue,date')
          .gte('date', range.from)
          .lte('date', range.to)
          .order('date', { ascending: true }),
      ]);

    if (productsError) throw productsError;
    if (analyticsError) throw analyticsError;

    return aggregateProductAnalytics(
      (products ?? []) as ProductRow[],
      (analytics ?? []) as AnalyticsRow[],
      range,
    );
  },
};
