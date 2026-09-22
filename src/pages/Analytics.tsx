import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Calendar, DollarSign, Eye, MousePointerClick, ShoppingBag } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useShop } from '@/contexts/ShopContext';
import {
  ProductAnalyticsSnapshot,
  productAnalyticsService,
} from '@/services/analyticsService';

type TimeRange = '7days' | '30days' | '90days' | 'year';

const getRange = (timeRange: TimeRange) => {
  const to = new Date();
  const from = new Date(to);

  if (timeRange === '7days') from.setDate(to.getDate() - 6);
  if (timeRange === '30days') from.setDate(to.getDate() - 29);
  if (timeRange === '90days') from.setDate(to.getDate() - 89);
  if (timeRange === 'year') from.setMonth(0, 1);

  const asDate = (date: Date) => date.toISOString().slice(0, 10);
  return { from: asDate(from), to: asDate(to) };
};

const formatAmount = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const Analytics: React.FC = () => {
  const { isConnected } = useShop();
  const [timeRange, setTimeRange] = useState<TimeRange>('30days');
  const [snapshot, setSnapshot] = useState<ProductAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => getRange(timeRange), [timeRange]);

  useEffect(() => {
    if (!isConnected) return;

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await productAnalyticsService.getSnapshot(range);
        if (!cancelled) setSnapshot(result);
      } catch (err) {
        console.error('Unable to load verified analytics', err);
        if (!cancelled) {
          setSnapshot(null);
          setError('Les données Analytics n’ont pas pu être vérifiées.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isConnected, range]);

  if (!isConnected) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-neutral-100 p-3">
          <BarChart3 size={28} className="text-neutral-400" />
        </div>
        <h2 className="mt-4 text-lg font-medium text-neutral-900">Aucune boutique connectée</h2>
        <p className="mt-1 text-neutral-500">
          Connectez une boutique pour afficher les Analytics vérifiées.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">Product Analytics</h1>
          <p className="text-neutral-500">
            Données réelles issues de marketplace_analytics. Aucune métrique simulée.
          </p>
        </div>
        <div className="relative">
          <select
            className="input appearance-none pr-10"
            value={timeRange}
            onChange={(event) => setTimeRange(event.target.value as TimeRange)}
          >
            <option value="7days">7 derniers jours</option>
            <option value="30days">30 derniers jours</option>
            <option value="90days">90 derniers jours</option>
            <option value="year">Cette année</option>
          </select>
          <Calendar
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
          />
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Source: <strong>marketplace_analytics</strong>
        {snapshot ? (
          <>
            {' '}· consulté le {new Date(snapshot.verifiedAt).toLocaleString('fr-FR')}
          </>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error} Les valeurs non vérifiées ne sont pas remplacées par 0.
        </div>
      ) : null}

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Chargement des données vérifiées…</div>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              title="Revenu"
              value={`${formatAmount(snapshot.revenue)} · devise non vérifiée`}
              icon={<DollarSign size={16} />}
            />
            <MetricCard
              title="Conversions"
              value={snapshot.conversions.toLocaleString('fr-FR')}
              icon={<ShoppingBag size={16} />}
            />
            <MetricCard
              title="Vues"
              value={snapshot.views.toLocaleString('fr-FR')}
              icon={<Eye size={16} />}
            />
            <MetricCard
              title="Clics"
              value={snapshot.clicks.toLocaleString('fr-FR')}
              icon={<MousePointerClick size={16} />}
            />
            <MetricCard
              title="Profit"
              value="Non vérifié"
              hint="Coûts fournisseur/frais incomplets"
              icon={<BarChart3 size={16} />}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-1 font-medium text-neutral-800">Revenu vérifié</h3>
              <p className="mb-4 text-xs text-neutral-500">
                {snapshot.range.from} → {snapshot.range.to}
              </p>
              {snapshot.dailyRevenue.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={snapshot.dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${formatAmount(Number(value))} · devise non vérifiée`, 'Revenu']} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="Revenu"
                        stroke="currentColor"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState />
              )}
            </div>

            <div className="card">
              <h3 className="mb-4 font-medium text-neutral-800">Produits par revenu</h3>
              {snapshot.products.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={snapshot.products.slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={110} />
                      <Tooltip formatter={(value) => [`${formatAmount(Number(value))} · devise non vérifiée`, 'Revenu']} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenu" fill="currentColor" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState />
              )}
            </div>
          </div>

          <div className="card overflow-x-auto">
            <h3 className="mb-4 font-medium text-neutral-800">Performance produit vérifiée</h3>
            {snapshot.products.length ? (
              <table className="min-w-full divide-y divide-neutral-200">
                <thead>
                  <tr className="text-left text-xs uppercase text-neutral-500">
                    <th className="px-3 py-3">Produit</th>
                    <th className="px-3 py-3">Vues</th>
                    <th className="px-3 py-3">Clics</th>
                    <th className="px-3 py-3">Conversions</th>
                    <th className="px-3 py-3">Conversion</th>
                    <th className="px-3 py-3">Revenu</th>
                    <th className="px-3 py-3">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {snapshot.products.map((product) => (
                    <tr key={product.productId}>
                      <td className="px-3 py-3 font-medium">{product.name}</td>
                      <td className="px-3 py-3">{product.views.toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-3">{product.clicks.toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-3">{product.conversions.toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-3">
                        {product.conversionRate === null
                          ? 'Non vérifié'
                          : `${product.conversionRate.toFixed(2)}%`}
                      </td>
                      <td className="px-3 py-3">{`${formatAmount(product.revenue)} · devise non vérifiée`}</td>
                      <td className="px-3 py-3 text-neutral-500">Non vérifié</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState />
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState />
        </div>
      )}
    </div>
  );
};

const MetricCard = ({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) => (
  <div className="card">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-neutral-700">{title}</h3>
      <div className="rounded-md bg-neutral-100 p-2 text-neutral-600">{icon}</div>
    </div>
    <p className="mt-2 text-2xl font-bold">{value}</p>
    {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
  </div>
);

const EmptyState = () => (
  <div className="py-12 text-center text-sm text-neutral-500">
    Aucune donnée vérifiée disponible pour cette période.
  </div>
);

export default Analytics;
