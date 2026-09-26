import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  TrendingUp,
  Users,
  FileText,
  Bot,
  Code,
  Webhook,
} from 'lucide-react';

import SubscriptionOverview from '@/components/dashboard/SubscriptionOverview';
import TrackingWidget from '@/components/tracking/TrackingWidget';
import MainNavbar from '@/components/layout/MainNavbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import {
  productAnalyticsService,
  type ProductAnalyticsSnapshot,
} from '@/services/analyticsService';

const formatRevenue = (value: number) =>
  `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} · devise non vérifiée`;

const formatNumber = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);

const formatPercent = (value: number | null) =>
  value === null
    ? 'Non disponible'
    : new Intl.NumberFormat('fr-FR', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value / 100);

const getLast30DaysRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
};

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<ProductAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => getLast30DaysRange(), []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productAnalyticsService.getSnapshot(range);
      setSnapshot(data);
    } catch (fetchError) {
      console.error('Erreur lors de la récupération des données du tableau de bord:', fetchError);
      setSnapshot(null);
      setError(
        fetchError instanceof Error && fetchError.message === 'AUTH_REQUIRED'
          ? 'Votre session a expiré. Reconnectez-vous pour afficher les données vérifiées.'
          : 'Les données vérifiées du tableau de bord sont momentanément indisponibles.',
      );
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const hasVerifiedData =
    snapshot !== null &&
    (snapshot.revenue > 0 ||
      snapshot.views > 0 ||
      snapshot.clicks > 0 ||
      snapshot.conversions > 0 ||
      snapshot.products.length > 0);

  const verifiedAtLabel = snapshot
    ? new Date(snapshot.verifiedAt).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null;

  const metricCards = [
    {
      title: "Chiffre d'affaires vérifié",
      value: snapshot ? formatRevenue(snapshot.revenue) : '—',
      helper: 'Source : marketplace_analytics',
      icon: BarChart3,
    },
    {
      title: 'Conversions vérifiées',
      value: snapshot ? formatNumber(snapshot.conversions) : '—',
      helper: 'Conversions attribuées aux produits du compte',
      icon: ShoppingBag,
    },
    {
      title: 'Vues vérifiées',
      value: snapshot ? formatNumber(snapshot.views) : '—',
      helper: 'Aucune estimation ajoutée',
      icon: Users,
    },
    {
      title: 'Taux de conversion',
      value: snapshot ? formatPercent(snapshot.conversionRate) : '—',
      helper:
        snapshot?.conversionRate === null
          ? 'Non calculé sans vues vérifiées'
          : 'Conversions / vues vérifiées',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mt-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tableau de bord</h1>
            <p className="text-sm text-gray-500 mt-1">
              Données vérifiées sur les 30 derniers jours ({range.from} → {range.to})
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchDashboardData()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {error && (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            <div className="font-medium">Données indisponibles</div>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && snapshot && !hasVerifiedData && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <div className="font-medium">Aucune donnée vérifiée sur cette période</div>
            <p className="mt-1 text-gray-500">
              ShopOpti n'affiche pas de chiffres de démonstration. Les indicateurs apparaîtront
              lorsque des données marketplace attribuables à vos produits seront disponibles.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {metricCards.map(({ title, value, helper, icon: Icon }) => (
            <div key={title} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-gray-500">{title}</h3>
                <div className="p-2 bg-gray-50 rounded-full">
                  <Icon className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              {loading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-8 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold">{error ? '—' : value}</p>
                  <p className="text-xs text-gray-500 mt-2">{helper}</p>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-medium">Produits les plus performants</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Classement par chiffre d'affaires vérifié
                </p>
              </div>
              <Link
                to="/app/analytics"
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Voir Analytics →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="animate-pulse h-12 bg-gray-100 rounded" />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-gray-500">Impossible de charger ce classement.</p>
            ) : snapshot && snapshot.products.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 pr-4 font-medium">Produit</th>
                      <th className="py-2 px-4 font-medium text-right">Vues</th>
                      <th className="py-2 px-4 font-medium text-right">Conversions</th>
                      <th className="py-2 pl-4 font-medium text-right">CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.products.slice(0, 5).map((product) => (
                      <tr key={product.productId} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium text-gray-900">{product.name}</td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {formatNumber(product.views)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {formatNumber(product.conversions)}
                        </td>
                        <td className="py-3 pl-4 text-right font-medium">
                          {formatRevenue(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Aucun produit avec données vérifiées sur cette période.
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>Source : {snapshot?.source ?? 'marketplace_analytics'}</span>
              <span>Dernière vérification : {verifiedAtLabel ?? '—'}</span>
              <span>Devise : non vérifiée</span>
              <span>Profit : non disponible sans coût fournisseur vérifié</span>
            </div>
          </div>

          <div className="space-y-6">
            <SubscriptionOverview />
            <TrackingWidget compact />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Link to="/tracking" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-500" />
              Suivi colis
            </h2>
            <p className="text-gray-500 mt-1">Suivez vos envois enregistrés</p>
          </Link>
          <Link to="/generate-invoice" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold flex items-center">
              <FileText className="h-5 w-5 mr-2 text-green-500" />
              Générer facture
            </h2>
            <p className="text-gray-500 mt-1">Créez une facture à partir de vos données</p>
          </Link>
          <Link to="/blog-ai" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold flex items-center">
              <Bot className="h-5 w-5 mr-2 text-purple-500" />
              Blog IA
            </h2>
            <p className="text-gray-500 mt-1">Accédez à l'outil de génération de contenu</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Link to="/app/integrations" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold flex items-center">
              <Code className="h-5 w-5 mr-2 text-indigo-500" />
              Intégrations
            </h2>
            <p className="text-gray-500 mt-1">Gérez les connexions disponibles</p>
          </Link>
          <Link to="/app/webhooks" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold flex items-center">
              <Webhook className="h-5 w-5 mr-2 text-orange-500" />
              Webhooks
            </h2>
            <p className="text-gray-500 mt-1">Configurez vos flux événementiels</p>
          </Link>
          <Link to="/app/advanced-analytics" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-red-500" />
              Analytics avancé
            </h2>
            <p className="text-gray-500 mt-1">Consultez les analyses vérifiées disponibles</p>
          </Link>
        </div>

        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-blue-500 mr-3" />
              <div>
                <h3 className="font-medium">Aujourd'hui</h3>
                <p className="text-sm text-gray-600">
                  {new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/settings">
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
