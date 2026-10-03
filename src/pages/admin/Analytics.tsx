import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Users
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { toast } from 'sonner';

import { useRole } from '@/context/RoleContext';
import {
  adminMetricsService,
  type AdminAnalyticsData
} from '@/services/adminMetricsService';
import { Button } from '@/components/ui/button';

const formatMoney = (amount: number | null, currency: string | null) => {
  if (amount === null || !currency) return 'Non vérifié';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency
  }).format(amount);
};

const formatGrowth = (value: number | null) =>
  value === null ? 'Indisponible' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

const AdminAnalytics: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const [period, setPeriod] = useState('30days');
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setData(await adminMetricsService.getAnalytics(period));
    } catch (error) {
      console.error('Error fetching admin analytics:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Impossible de charger les analytics Admin'
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void fetchAnalytics();
  }, [isAdmin, period]);

  if (roleLoading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analyse de la plateforme</h1>
          <p className="text-gray-500">
            Métriques globales vérifiées, sans données de démonstration
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-md border border-gray-300 px-3 py-2"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="7days">7 derniers jours</option>
            <option value="30days">30 derniers jours</option>
            <option value="90days">90 derniers jours</option>
            <option value="year">365 derniers jours</option>
          </select>
          <Button variant="outline" onClick={() => void fetchAnalytics()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-10 text-center">
          Chargement des analytics vérifiées...
        </div>
      ) : !data ? (
        <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
          Analytics indisponibles. Aucune valeur simulée n'est affichée.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">
                  Revenu payé vérifié
                </h3>
                <DollarSign className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-2xl font-bold">
                {formatMoney(
                  data.metrics.paidRevenue,
                  data.metrics.paidRevenueCurrency
                )}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {formatGrowth(data.metrics.paidRevenueGrowthPct)} vs période précédente
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Commandes</h3>
                <BarChart3 className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-2xl font-bold">{data.metrics.periodOrders}</p>
              <p className="mt-2 text-xs text-gray-500">
                {formatGrowth(data.metrics.ordersGrowthPct)} vs période précédente
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Utilisateurs</h3>
                <Users className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-2xl font-bold">{data.metrics.totalUsers}</p>
              <p className="mt-2 text-xs text-gray-500">
                {data.metrics.activeUsers} actifs · {data.metrics.newUsers} nouveaux
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Conversion</h3>
                <TrendingUp className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-2xl font-bold">Non vérifié</p>
              <p className="mt-2 text-xs text-gray-500">
                Aucun dénominateur de sessions/visiteurs fiable n'est disponible.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="font-medium">Montant brut des commandes</h3>
            <p className="mt-2 text-2xl font-bold">
              {formatMoney(
                data.metrics.grossOrderValue,
                data.metrics.grossOrderValueCurrency
              )}
            </p>
            <p className="mt-2 text-sm text-amber-700">
              Inclut les commandes non payées. Ce montant n'est pas présenté comme revenu encaissé.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow-sm md:col-span-2">
              <h3 className="mb-4 font-medium">Commandes et revenu payé par jour</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="grossOrderValue"
                      name="Montant brut commandes"
                    />
                    <Area
                      type="monotone"
                      dataKey="paidRevenue"
                      name="Revenu payé"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-medium">Répartition des rôles</h3>
              <div className="h-80">
                {data.roleDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.roleDistribution}
                        dataKey="count"
                        nameKey="role"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                      />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500">
                    Aucune donnée de rôle
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-medium">Produits les plus vendus</h3>
              <p className="text-sm text-gray-500">
                Non vérifié : la table canonique order_items ne contient pas encore
                suffisamment de données exploitables pour produire un classement fiable.
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-medium">Panier moyen payé</h3>
              <p className="text-2xl font-bold">
                {formatMoney(
                  data.metrics.averageOrderValue,
                  data.metrics.paidRevenueCurrency
                )}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Calculé uniquement à partir des commandes payées ou partiellement payées.
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Généré le {new Date(data.generatedAt).toLocaleString('fr-FR')}. La
            fonction serveur fournit également des indicateurs de complétude et de provenance.
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAnalytics;
