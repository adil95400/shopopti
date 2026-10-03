import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  DollarSign,
  RefreshCw,
  ShoppingBag,
  Users
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useRole } from '@/context/RoleContext';
import {
  adminMetricsService,
  type AdminDashboardData
} from '@/services/adminMetricsService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formatMoney = (amount: number | null, currency: string | null) => {
  if (amount === null || !currency) return 'Non vérifié';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency
  }).format(amount);
};

const growthLabel = (growth: number | null) =>
  growth === null
    ? 'Comparaison indisponible'
    : growth === 0
      ? 'Stable vs période précédente'
      : `${growth > 0 ? '+' : ''}${growth.toFixed(1)}% vs période précédente`;

const AdminDashboard: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setData(await adminMetricsService.getDashboard('30days'));
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Impossible de charger les métriques Admin'
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void fetchDashboard();
  }, [isAdmin]);

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
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="text-gray-500">
            Données réelles de la plateforme — période glissante de 30 jours
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchDashboard()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
          <Button onClick={() => navigate('/app/admin/analytics')}>
            Analytics
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-10 text-center">
          Chargement des métriques vérifiées...
        </div>
      ) : !data ? (
        <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
          Métriques indisponibles. Aucune valeur simulée n'est affichée.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.metrics.users.total}</div>
                <p className="pt-1 text-xs text-gray-500">
                  {data.metrics.users.currentPeriodNew} nouveaux ·{' '}
                  {growthLabel(data.metrics.users.growthPct)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Revenu payé vérifié</CardTitle>
                <DollarSign className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoney(
                    data.metrics.paidRevenue.amount,
                    data.metrics.paidRevenue.currency
                  )}
                </div>
                <p className="pt-1 text-xs text-gray-500">
                  {data.metrics.paidRevenue.paidOrders} commande(s) payée(s) ·{' '}
                  {growthLabel(data.metrics.paidRevenue.growthPct)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Commandes</CardTitle>
                <ShoppingBag className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.metrics.orders.total}</div>
                <p className="pt-1 text-xs text-gray-500">
                  {data.metrics.orders.currentPeriod} sur 30 jours ·{' '}
                  {growthLabel(data.metrics.orders.growthPct)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Produits</CardTitle>
                <BarChart3 className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.metrics.products.total}</div>
                <p className="pt-1 text-xs text-gray-500">
                  Comptage exact de public.products
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Montant brut des commandes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMoney(
                  data.metrics.grossOrderValue.amount,
                  data.metrics.grossOrderValue.currency
                )}
              </div>
              <p className="mt-2 text-sm text-amber-700">
                Ce montant additionne les commandes sans supposer qu'elles sont payées.
                Il ne doit pas être interprété comme du chiffre d'affaires encaissé.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Utilisateurs récents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between border-b pb-2"
                    >
                      <div>
                        <div className="font-medium">
                          {user.name || 'Utilisateur sans nom'}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  ))}
                  {data.recentUsers.length === 0 && (
                    <div className="text-sm text-gray-500">Aucun utilisateur.</div>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => navigate('/app/admin/users')}
                >
                  Voir tous les utilisateurs
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commandes récentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between border-b pb-2"
                    >
                      <div>
                        <div className="font-medium">
                          Commande #{order.order_number}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatMoney(order.total_amount, order.currency)}
                          {' · '}
                          {order.financial_status || 'statut financier inconnu'}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  ))}
                  {data.recentOrders.length === 0 && (
                    <div className="text-sm text-gray-500">Aucune commande.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-xs text-gray-500">
            Généré le {new Date(data.generatedAt).toLocaleString('fr-FR')}. Sources :
            Supabase Auth, public.products et public.orders.
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
