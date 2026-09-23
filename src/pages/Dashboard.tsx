import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  Calendar,
  Code,
  DollarSign,
  FileText,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
  Webhook,
} from 'lucide-react';

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

function ChangeLabel({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-gray-500">Comparaison indisponible</span>;
  }

  const prefix = value > 0 ? '+' : '';
  return <span className={`text-sm ${value >= 0 ? 'text-green-600' : 'text-red-600'}`}>{prefix}{value}%</span>;
}

export default function Dashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>(30);
  const { stats, loading, error, refetch } = useDashboardStats(period);

  const cards = [
    {
      label: "Chiffre d'affaires",
      value: stats ? `${stats.revenue.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €` : '—',
      change: stats?.revenue.change ?? null,
      icon: DollarSign,
    },
    {
      label: 'Commandes fournisseur',
      value: stats ? stats.orders.value.toLocaleString('fr-FR') : '—',
      change: stats?.orders.change ?? null,
      icon: ShoppingBag,
    },
    {
      label: 'Vues produits',
      value: stats ? stats.visitors.value.toLocaleString('fr-FR') : '—',
      change: stats?.visitors.change ?? null,
      icon: Users,
    },
    {
      label: 'Taux de conversion',
      value: stats ? `${stats.conversion.value}%` : '—',
      change: stats?.conversion.change ?? null,
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
              Données Supabase vérifiées. Aucune métrique simulée n'est affichée.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="dashboard-period" className="text-sm text-gray-600">Période</label>
            <select
              id="dashboard-period"
              value={period}
              onChange={(event) => setPeriod(Number(event.target.value) as DashboardPeriod)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {periods.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Statistiques indisponibles : {error}</span>
              <button type="button" onClick={() => void refetch()} className="font-medium underline">
                Réessayer
              </button>
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
                  <Icon className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{loading ? '…' : card.value}</p>
                <div className="mt-2 flex items-center gap-2">
                  {!loading && <ChangeLabel value={card.change} />}
                  <span className="text-xs text-gray-500">vs période précédente</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-sm md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">Commandes récentes</h2>
                <p className="text-sm text-gray-500">Source : supplier_orders</p>
              </div>
              <Link to="/app/orders" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                Voir les commandes →
              </Link>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">Chargement…</p>
            ) : stats && stats.recentOrders.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">#{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {Number(order.total_amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </p>
                      <p className="text-xs text-gray-500">{order.status || 'Statut non renseigné'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500">Aucune commande vérifiée sur cette période.</p>
            )}
          </div>

          <div className="space-y-6">
            <SubscriptionOverview />
            <TrackingWidget compact />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link to="/tracking" className="rounded-lg bg-white p-4 shadow-sm hover:shadow-md">
            <h2 className="flex items-center text-lg font-semibold"><Package className="mr-2 h-5 w-5 text-blue-500" />Suivi colis</h2>
            <p className="mt-1 text-gray-500">Consultez les suivis disponibles</p>
          </Link>
          <Link to="/generate-invoice" className="rounded-lg bg-white p-4 shadow-sm hover:shadow-md">
            <h2 className="flex items-center text-lg font-semibold"><FileText className="mr-2 h-5 w-5 text-green-500" />Générer facture</h2>
            <p className="mt-1 text-gray-500">Créez vos factures PDF</p>
          </Link>
          <Link to="/blog-ai" className="rounded-lg bg-white p-4 shadow-sm hover:shadow-md">
            <h2 className="flex items-center text-lg font-semibold"><Bot className="mr-2 h-5 w-5 text-purple-500" />Blog IA</h2>
            <p className="mt-1 text-gray-500">Générez du contenu SEO</p>
          </Link>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link to="/app/integrations" className="rounded-lg bg-white p-4 shadow-sm hover:shadow-md">
            <h2 className="flex items-center text-lg font-semibold"><Code className="mr-2 h-5 w-5 text-indigo-500" />Intégrations</h2>
            <p className="mt-1 text-gray-500">Gérez vos connexions</p>
          </Link>
          <Link to="/app/webhooks" className="rounded-lg bg-white p-4 shadow-sm hover:shadow-md">
            <h2 className="flex items-center text-lg font-semibold"><Webhook className="mr-2 h-5 w-5 text-orange-500" />Webhooks</h2>
            <p className="mt-1 text-gray-500">Automatisez vos flux</p>
          </Link>
          <Link to="/app/advanced-analytics" className="rounded-lg bg-white p-4 shadow-sm hover:shadow-md">
            <h2 className="flex items-center text-lg font-semibold"><BarChart3 className="mr-2 h-5 w-5 text-red-500" />Analytics avancé</h2>
            <p className="mt-1 text-gray-500">Analysez vos performances</p>
          </Link>
        </div>

        <div className="rounded-lg bg-blue-50 p-6">
          <div className="flex items-center">
            <Calendar className="mr-3 h-6 w-6 text-blue-500" />
            <div>
              <h3 className="font-medium">Aujourd'hui</h3>
              <p className="text-sm text-gray-600">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
