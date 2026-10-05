import { useState } from 'react';
import { BarChart3, ShoppingBag, TrendingUp, Users } from 'lucide-react';

import Footer from '@/components/layout/Footer';
import MainNavbar from '@/components/layout/MainNavbar';
import SubscriptionOverview from '@/components/dashboard/SubscriptionOverview';
import TrackingWidget from '@/components/tracking/TrackingWidget';
import { DashboardPeriod, useDashboardStats } from '@/hooks/useDashboardStats';

const periods: { label: string; value: DashboardPeriod }[] = [
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
  { label: '90 jours', value: 90 },
];

function metricValue(value: number | null, suffix = '') {
  if (value === null) return '—';
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${suffix}`;
}

function ChangeLabel({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-500">Comparaison indisponible</span>;
  const prefix = value > 0 ? '+' : '';
  return <span className={`text-sm ${value >= 0 ? 'text-green-600' : 'text-red-600'}`}>{prefix}{value}%</span>;
}

export default function Dashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>(30);
  const { stats, loading, error, refetch } = useDashboardStats(period);

  const cards = [
    {
      label: "Chiffre d'affaires",
      value: metricValue(stats?.revenue.value ?? null, ' €'),
      change: stats?.revenue.change ?? null,
      source: stats?.revenue.source ?? 'marketplace_orders',
      icon: BarChart3,
    },
    {
      label: 'Commandes marketplace',
      value: metricValue(stats?.orders.value ?? null),
      change: stats?.orders.change ?? null,
      source: stats?.orders.source ?? 'marketplace_orders',
      icon: ShoppingBag,
    },
    {
      label: 'Vues produits',
      value: metricValue(stats?.visitors.value ?? null),
      change: stats?.visitors.change ?? null,
      source: stats?.visitors.source ?? 'product_metrics',
      icon: Users,
    },
    {
      label: 'Taux de conversion',
      value: metricValue(stats?.conversion.value ?? null, '%'),
      change: stats?.conversion.change ?? null,
      source: stats?.conversion.source ?? 'product_metrics',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="mx-auto mt-16 max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tableau de bord</h1>
            <p className="mt-1 text-sm text-gray-500">
              Données vérifiées uniquement. Une métrique non prouvée reste indisponible.
            </p>
          </div>
          <select
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value) as DashboardPeriod)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {periods.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Statistiques indisponibles : {error}</span>
              <button type="button" onClick={() => void refetch()} className="font-medium underline">Réessayer</button>
            </div>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-lg bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-500">{card.label}</h3>
                  <Icon className="h-5 w-5 text-gray-500" />
                </div>
                <p className="text-2xl font-bold">{loading ? '…' : card.value}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <ChangeLabel value={card.change} />
                  <span className="text-[11px] text-gray-400">{card.source}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-sm md:col-span-2">
            <h2 className="mb-4 text-lg font-medium">Commandes marketplace récentes</h2>
            {loading ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : stats?.recentOrders.length ? (
              <div className="space-y-3">
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <p className="font-medium">#{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">{order.platform} · {order.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{Number(order.total_amount ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</p>
                      <p className="text-xs text-gray-500">{new Date(order.order_date).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Aucune commande marketplace vérifiée sur cette période.</p>
            )}
          </div>

          <div className="space-y-6">
            <SubscriptionOverview />
            <TrackingWidget compact />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
