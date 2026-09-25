import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock3,
  PackageSearch,
  RefreshCw,
  ShoppingCart,
  Truck,
  Webhook,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supplierService } from '@/services/supplierService';
import {
  supplierDetailService,
  type SupplierConnectionDetail,
} from '@/services/supplierDetailService';

type DetailTab =
  | 'overview'
  | 'catalog'
  | 'pricing'
  | 'stock'
  | 'shipping'
  | 'orders'
  | 'tracking'
  | 'automation'
  | 'logs';

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Vue d’ensemble' },
  { id: 'catalog', label: 'Catalogue' },
  { id: 'pricing', label: 'Prix & marge' },
  { id: 'stock', label: 'Stock' },
  { id: 'shipping', label: 'Livraison' },
  { id: 'orders', label: 'Commandes' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'automation', label: 'Automatisation' },
  { id: 'logs', label: 'Logs' },
];

const formatDate = (value?: string) => {
  if (!value) return 'Non vérifié';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non vérifié';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const metricValue = (value: number | null) =>
  value === null ? 'Non vérifié' : new Intl.NumberFormat('fr-FR').format(value);

const SupplierDetail: React.FC = () => {
  const { supplierId = '' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SupplierConnectionDetail | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await supplierDetailService.get(supplierId));
    } catch (loadError) {
      console.error('Unable to load supplier detail:', loadError);
      setDetail(null);
      setError('Impossible de charger cette connexion fournisseur.');
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  const testConnection = async () => {
    if (!detail) return;
    setTesting(true);
    try {
      const success = await supplierService.testConnectionById(detail.supplier.id);
      if (!success) throw new Error('Connexion fournisseur non confirmée');
      toast.success('Connexion fournisseur confirmée');
      await load();
    } catch (testError) {
      toast.error(
        testError instanceof Error ? testError.message : 'Test de connexion impossible'
      );
    } finally {
      setTesting(false);
    }
  };

  const configureRealtime = async () => {
    if (!detail) return;
    setSyncing(true);
    try {
      await supplierService.configureRealtimeSync(detail.supplier.id);
      toast.success('Synchronisation temps réel configurée');
      await load();
    } catch (syncError) {
      toast.error(
        syncError instanceof Error ? syncError.message : 'Configuration temps réel impossible'
      );
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        Chargement du fournisseur…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <AlertCircle className="mb-3 h-6 w-6" />
          <p className="font-semibold">{error ?? 'Fournisseur introuvable'}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/app/suppliers">Retour au Supplier Hub</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { supplier, metrics } = detail;
  const connected = supplier.status === 'active';

  const renderTab = () => {
    if (activeTab === 'overview') {
      return (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Santé de la connexion</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">API fournisseur</p>
                  <div className="mt-2 flex items-center gap-2 font-medium">
                    {connected ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                    {connected ? 'Connexion active' : 'À vérifier'}
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Webhook</p>
                  <div className="mt-2 flex items-center gap-2 font-medium">
                    <Webhook className="h-4 w-4" />
                    {supplier.webhookStatus === 'enabled'
                      ? 'Actif'
                      : supplier.webhookStatus === 'error'
                        ? 'Erreur'
                        : 'Non configuré'}
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Dernière synchronisation</p>
                  <p className="mt-2 font-medium">{formatDate(supplier.lastSync)}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Dernier événement webhook</p>
                  <p className="mt-2 font-medium">
                    {formatDate(supplier.webhookLastEventAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Données vérifiées ShopOpti</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Les compteurs restent « Non vérifié » si la source serveur n’est pas accessible.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Produits importés', metricValue(metrics.importedProducts), PackageSearch],
                  ['Variantes stock', metricValue(metrics.stockVariants), Boxes],
                  ['Commandes dispatchées', metricValue(metrics.dispatchedOrders), ShoppingCart],
                  ['Événements webhook', metricValue(metrics.webhookEvents), Webhook],
                ].map(([label, value, Icon]) => (
                  <div key={String(label)} className="rounded-xl border p-4">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="mt-3 text-xs text-muted-foreground">{String(label)}</p>
                    <p className="mt-1 text-lg font-semibold">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Actions rapides</h2>
              <div className="mt-4 space-y-2">
                <Button
                  className="w-full"
                  onClick={() =>
                    navigate(
                      `/app/import-products?supplier=${encodeURIComponent(supplier.id)}`
                    )
                  }
                >
                  <PackageSearch className="mr-2 h-4 w-4" />
                  Ouvrir le catalogue
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={testing}
                  onClick={() => void testConnection()}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
                  Tester la connexion
                </Button>
                {supplier.type === 'cj_dropshipping' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={syncing}
                    onClick={() => void configureRealtime()}
                  >
                    <Webhook className="mr-2 h-4 w-4" />
                    {supplier.webhookStatus === 'enabled'
                      ? 'Reconfigurer le webhook'
                      : 'Activer le temps réel'}
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 text-sm">
              <h2 className="font-semibold">Connexion</h2>
              <dl className="mt-4 space-y-3">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Nom</dt>
                  <dd className="text-right font-medium">{supplier.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Fournisseur</dt>
                  <dd className="text-right font-medium">CJdropshipping</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Créée</dt>
                  <dd className="text-right font-medium">{formatDate(supplier.created_at)}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      );
    }

    const tabContent: Record<Exclude<DetailTab, 'overview'>, {
      title: string;
      description: string;
      action?: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = {
      catalog: {
        title: 'Catalogue fournisseur',
        description:
          'Recherchez le catalogue réel CJ, consultez les variantes et importez uniquement des snapshots vérifiés.',
        action: 'Ouvrir le catalogue CJ',
        icon: PackageSearch,
      },
      pricing: {
        title: 'Prix & marge',
        description:
          'Les règles de marge automatiques ne sont pas encore configurées pour cette connexion. Aucun prix calculé n’est inventé.',
        icon: Clock3,
      },
      stock: {
        title: 'Stock',
        description:
          'Le stock vérifié par variante et les événements de stock CJ sont disponibles quand ils ont été reçus côté serveur.',
        icon: Boxes,
      },
      shipping: {
        title: 'Livraison',
        description:
          'Le connecteur CJ sait calculer le fret à partir des données réelles de destination et des variantes.',
        icon: Truck,
      },
      orders: {
        title: 'Commandes',
        description:
          'Les dispatchs CJ sont protégés contre les doubles créations et les résultats distants ambigus sont bloqués pour réconciliation.',
        icon: ShoppingCart,
      },
      tracking: {
        title: 'Tracking',
        description:
          'Le tracking provient du connecteur CJ et des événements logistiques reçus. Aucun numéro de suivi fictif n’est généré.',
        icon: Truck,
      },
      automation: {
        title: 'Automatisation',
        description:
          'Le temps réel CJ peut être activé via webhook. Les automatisations supplémentaires resteront désactivées tant qu’elles ne sont pas validées.',
        icon: Webhook,
      },
      logs: {
        title: 'Logs & événements',
        description:
          'ShopOpti conserve les événements webhook dédupliqués côté serveur. Une vue chronologique détaillée pourra être ajoutée sans exposer de secret.',
        icon: Clock3,
      },
    };

    const config = tabContent[activeTab];
    const Icon = config.icon;

    return (
      <div className="rounded-2xl border bg-card p-6">
        <Icon className="h-7 w-7" />
        <h2 className="mt-4 text-xl font-semibold">{config.title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {config.description}
        </p>
        {config.action && (
          <Button
            className="mt-5"
            onClick={() =>
              navigate(`/app/import-products?supplier=${encodeURIComponent(supplier.id)}`)
            }
          >
            {config.action}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-full bg-muted/20">
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
        <Button variant="ghost" asChild className="-ml-2">
          <Link to="/app/suppliers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Supplier Hub
          </Link>
        </Button>

        <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border bg-orange-50 font-bold text-orange-600">
                  CJ
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{supplier.name}</h1>
                  <p className="text-sm text-muted-foreground">CJdropshipping · Connexion fournisseur</p>
                </div>
              </div>
            </div>
            <span
              className={`w-fit rounded-full border px-3 py-1 text-sm font-medium ${
                connected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {connected ? 'Connecté' : 'À vérifier'}
            </span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="flex min-w-max gap-1 border-b">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {renderTab()}
      </div>
    </div>
  );
};

export default SupplierDetail;
