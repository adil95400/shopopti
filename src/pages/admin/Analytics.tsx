import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, Download, DollarSign, TrendingUp, Users } from 'lucide-react';
import { Navigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useRole } from '@/context/RoleContext';
import { supabase } from '@/lib/supabase';

type PeriodKey = '7days' | '30days' | '90days' | 'year';

type AnalyticsRow = {
  date: string;
  revenue: number | string | null;
  conversions: number | null;
  clicks: number | null;
  product_id: string | null;
  marketplace_id: string | null;
};

type MarketplaceRow = {
  id: string;
  name: string;
  country: string;
  status: string | null;
};

type ProductRow = {
  id: string;
  title: string;
  price: number | string;
};

type ProductPerformance = {
  id: string;
  title: string;
  price: number;
  conversions: number;
  revenue: number;
};

const periodDays: Record<Exclude<PeriodKey, 'year'>, number> = {
  '7days': 7,
  '30days': 30,
  '90days': 90,
};

const startOfDayIso = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
};

const getRange = (period: PeriodKey) => {
  const now = new Date();
  const end = startOfDayIso(now);
  const startDate = new Date(now);

  if (period === 'year') {
    startDate.setMonth(0, 1);
  } else {
    startDate.setDate(startDate.getDate() - periodDays[period] + 1);
  }

  const start = startOfDayIso(startDate);
  const previousEndDate = new Date(startDate);
  previousEndDate.setDate(previousEndDate.getDate() - 1);

  const durationMs = new Date(end).getTime() - new Date(start).getTime();
  const previousStartDate = new Date(previousEndDate.getTime() - durationMs);

  return {
    start,
    end,
    previousStart: startOfDayIso(previousStartDate),
    previousEnd: startOfDayIso(previousEndDate),
  };
};

const growth = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
};

const aggregate = (rows: AnalyticsRow[]) =>
  rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.revenue ?? 0),
      conversions: acc.conversions + Number(row.conversions ?? 0),
      clicks: acc.clicks + Number(row.clicks ?? 0),
    }),
    { revenue: 0, conversions: 0, clicks: 0 },
  );

const AdminAnalytics: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const [period, setPeriod] = useState<PeriodKey>('30days');
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [previousRows, setPreviousRows] = useState<AnalyticsRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [marketplaces, setMarketplaces] = useState<MarketplaceRow[]>([]);
  const [marketplaceId, setMarketplaceId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => getRange(period), [period]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);

      let currentQuery = supabase
        .from('marketplace_analytics')
        .select('date,revenue,conversions,clicks,product_id,marketplace_id')
        .gte('date', range.start)
        .lte('date', range.end)
        .order('date', { ascending: true });

      let previousQuery = supabase
        .from('marketplace_analytics')
        .select('date,revenue,conversions,clicks,product_id,marketplace_id')
        .gte('date', range.previousStart)
        .lte('date', range.previousEnd)
        .order('date', { ascending: true });

      if (marketplaceId !== 'all') {
        currentQuery = currentQuery.eq('marketplace_id', marketplaceId);
        previousQuery = previousQuery.eq('marketplace_id', marketplaceId);
      }

      const productsQuery = supabase.from('products').select('id,title,price');
      const marketplacesQuery = supabase
        .from('marketplaces')
        .select('id,name,country,status')
        .order('name', { ascending: true });

      const [currentResult, previousResult, productsResult, marketplacesResult] = await Promise.all([
        currentQuery,
        previousQuery,
        productsQuery,
        marketplacesQuery,
      ]);

      const firstError =
        currentResult.error ??
        previousResult.error ??
        productsResult.error ??
        marketplacesResult.error;
      if (firstError) {
        console.error('Unable to load verified analytics', firstError);
        setRows([]);
        setPreviousRows([]);
        setProducts([]);
        setMarketplaces([]);
        setError('Les données Analytics ne peuvent pas être vérifiées pour le moment.');
        setLoading(false);
        return;
      }

      setRows((currentResult.data ?? []) as AnalyticsRow[]);
      setPreviousRows((previousResult.data ?? []) as AnalyticsRow[]);
      setProducts((productsResult.data ?? []) as ProductRow[]);
      setMarketplaces((marketplacesResult.data ?? []) as MarketplaceRow[]);
      setLoading(false);
    };

    void fetchAnalytics();
  }, [isAdmin, range, marketplaceId]);

  const current = useMemo(() => aggregate(rows), [rows]);
  const previous = useMemo(() => aggregate(previousRows), [previousRows]);

  const revenueGrowth = growth(current.revenue, previous.revenue);
  const conversionGrowth = growth(current.conversions, previous.conversions);
  const conversionRate = current.clicks > 0 ? (current.conversions / current.clicks) * 100 : null;
  const averageOrderValue = current.conversions > 0 ? current.revenue / current.conversions : null;

  const dailyRevenue = useMemo(() => {
    const values = new Map<string, number>();
    rows.forEach((row) => values.set(row.date, (values.get(row.date) ?? 0) + Number(row.revenue ?? 0)));
    return Array.from(values.entries()).map(([date, revenue]) => ({ date, revenue }));
  }, [rows]);

  const maxDailyRevenue = Math.max(...dailyRevenue.map((item) => item.revenue), 0);

  const marketplaceBreakdown = useMemo(() => {
    const byMarketplace = new Map<string, { revenue: number; conversions: number; clicks: number }>();
    rows.forEach((row) => {
      const key = row.marketplace_id ?? 'unattributed';
      const existing = byMarketplace.get(key) ?? { revenue: 0, conversions: 0, clicks: 0 };
      byMarketplace.set(key, {
        revenue: existing.revenue + Number(row.revenue ?? 0),
        conversions: existing.conversions + Number(row.conversions ?? 0),
        clicks: existing.clicks + Number(row.clicks ?? 0),
      });
    });

    const names = new Map(marketplaces.map((marketplace) => [marketplace.id, marketplace.name]));
    return Array.from(byMarketplace.entries())
      .map(([id, metrics]) => ({
        id,
        name: id === 'unattributed' ? 'Non attribué' : names.get(id) ?? 'Marketplace inconnue',
        ...metrics,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [marketplaces, rows]);

  const topProducts = useMemo<ProductPerformance[]>(() => {
    const performance = new Map<string, { conversions: number; revenue: number }>();
    rows.forEach((row) => {
      if (!row.product_id) return;
      const existing = performance.get(row.product_id) ?? { conversions: 0, revenue: 0 };
      performance.set(row.product_id, {
        conversions: existing.conversions + Number(row.conversions ?? 0),
        revenue: existing.revenue + Number(row.revenue ?? 0),
      });
    });

    return products
      .map((product) => {
        const metrics = performance.get(product.id) ?? { conversions: 0, revenue: 0 };
        return {
          id: product.id,
          title: product.title,
          price: Number(product.price),
          conversions: metrics.conversions,
          revenue: metrics.revenue,
        };
      })
      .filter((product) => product.conversions > 0 || product.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [products, rows]);

  const exportCsv = () => {
    if (!rows.length) return;
    const header = 'date,revenue,conversions,clicks,product_id,marketplace_id';
    const body = rows
      .map((row) => [row.date, Number(row.revenue ?? 0), Number(row.conversions ?? 0), Number(row.clicks ?? 0), row.product_id ?? '', row.marketplace_id ?? ''].join(','))
      .join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'shopopti-analytics-' + range.start + '-' + range.end + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (roleLoading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const formatGrowth = (value: number | null) => (value === null ? 'Non vérifié' : Math.abs(value).toFixed(1) + '%');

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analyse de la plateforme</h1>
          <p className="text-gray-500">
            Données vérifiées depuis marketplace_analytics, limitées par les permissions Supabase actives.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={marketplaceId}
            onChange={(event) => setMarketplaceId(event.target.value)}
          >
            <option value="all">Toutes les marketplaces</option>
            {marketplaces.map((marketplace) => (
              <option key={marketplace.id} value={marketplace.id}>
                {marketplace.name} · {marketplace.country}
              </option>
            ))}
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodKey)}
          >
            <option value="7days">7 derniers jours</option>
            <option value="30days">30 derniers jours</option>
            <option value="90days">90 derniers jours</option>
            <option value="year">Cette année</option>
          </select>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length || loading}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error} Aucun zéro de remplacement n'est affiché.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-500">Chiffre d'affaires attribué</h3>
            <DollarSign className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{loading || error ? 'Non vérifié' : current.revenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
          {!loading && !error && (
            <div className="flex items-center mt-2 text-sm text-gray-600">
              {revenueGrowth !== null && (revenueGrowth >= 0 ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />)}
              {formatGrowth(revenueGrowth)} vs période précédente
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-500">Conversions attribuées</h3>
            <BarChart3 className="h-5 w-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">{loading || error ? 'Non vérifié' : current.conversions}</p>
          {!loading && !error && <p className="mt-2 text-sm text-gray-600">{formatGrowth(conversionGrowth)} vs période précédente</p>}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-500">Utilisateurs plateforme</h3>
            <Users className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold">Non vérifié</p>
          <p className="mt-2 text-sm text-gray-500">Aucune source admin globale sûre n'est exposée au client.</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-500">Taux de conversion</h3>
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold">{loading || error || conversionRate === null ? 'Non vérifié' : conversionRate.toFixed(2) + '%'}</p>
          <p className="mt-2 text-sm text-gray-600">
            Valeur moyenne/conversion : {loading || error || averageOrderValue === null ? 'Non vérifié' : averageOrderValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm">
          <h3 className="font-medium mb-4">Revenus attribués par jour</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-500">Chargement...</div>
          ) : error || !dailyRevenue.length ? (
            <div className="h-64 flex items-center justify-center text-gray-500">Aucune donnée vérifiée sur cette période.</div>
          ) : (
            <div className="h-64 flex items-end gap-1 overflow-x-auto border-b border-gray-200 pb-2">
              {dailyRevenue.map((item) => (
                <div key={item.date} className="min-w-4 flex-1 flex flex-col justify-end" title={item.date + ' — ' + item.revenue.toFixed(2) + ' €'}>
                  <div
                    className="w-full rounded-t bg-blue-500"
                    style={{ height: Math.max(4, (item.revenue / maxDailyRevenue) * 220) }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="font-medium mb-4">Couverture des données</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Début</span><strong>{range.start}</strong></div>
            <div className="flex justify-between"><span>Fin</span><strong>{range.end}</strong></div>
            <div className="flex justify-between"><span>Lignes Analytics</span><strong>{error ? 'Non vérifié' : rows.length}</strong></div>
            <div className="flex justify-between"><span>Clics attribués</span><strong>{error ? 'Non vérifié' : current.clicks}</strong></div>
            <p className="pt-2 text-xs text-gray-500">
              Les métriques globales non accessibles via les politiques RLS restent volontairement non vérifiées.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="font-medium mb-4">Performance par marketplace</h3>
          {loading ? (
            <div className="text-sm text-gray-500">Chargement...</div>
          ) : error || !marketplaceBreakdown.length ? (
            <div className="text-sm text-gray-500">Aucune attribution marketplace vérifiée sur cette période.</div>
          ) : (
            <div className="space-y-3">
              {marketplaceBreakdown.map((marketplace) => {
                const rate = marketplace.clicks > 0 ? (marketplace.conversions / marketplace.clicks) * 100 : null;
                return (
                  <div key={marketplace.id} className="grid grid-cols-4 gap-3 border-b border-gray-100 pb-3 text-sm">
                    <div className="font-medium">{marketplace.name}</div>
                    <div className="text-right">{marketplace.revenue.toLocaleString('fr-FR')} revenu*</div>
                    <div className="text-right">{marketplace.conversions} conv.</div>
                    <div className="text-right">{rate === null ? 'Non vérifié' : rate.toFixed(2) + '%'}</div>
                  </div>
                );
              })}
              <p className="text-xs text-gray-500">* Devise non stockée dans marketplace_analytics : aucun symbole monétaire n'est supposé ici.</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="font-medium mb-4">Métriques P1 encore non vérifiables</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between"><span>Commandes réelles distinctes</span><strong>Non vérifié</strong></div>
            <div className="flex justify-between"><span>COGS / coût fournisseur</span><strong>Non vérifié</strong></div>
            <div className="flex justify-between"><span>Marge / profit net</span><strong>Non vérifié</strong></div>
            <div className="flex justify-between"><span>Devise par canal</span><strong>Non vérifié</strong></div>
            <p className="pt-2 text-xs text-gray-500">
              Ces KPI ne sont pas dérivés artificiellement : le schéma actuel ne fournit pas encore une source canonique suffisante.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Produits les plus performants</h3>
        {loading ? (
          <div className="text-center py-4">Chargement des données...</div>
        ) : error || !topProducts.length ? (
          <div className="text-sm text-gray-500 py-4">Aucun produit avec performance vérifiée sur cette période.</div>
        ) : (
          <div className="space-y-4">
            {topProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <div className="font-medium text-gray-900">{product.title}</div>
                  <div className="text-xs text-gray-500">Prix catalogue : {product.price.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{product.revenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
                  <div className="text-xs text-gray-500">{product.conversions} conversions</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
