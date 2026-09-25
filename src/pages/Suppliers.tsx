import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  PackageSearch,
  PlugZap,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supplierProviders } from '@/config/supplierProviders';
import { supplierService } from '@/services/supplierService';
import type { SupplierSummary } from '@/types/supplier';

type ConnectionState = 'active' | 'inactive' | 'error' | 'unknown';

const STATUS_COPY: Record<ConnectionState, { label: string; className: string }> = {
  active: {
    label: 'Connecté',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  inactive: {
    label: 'Inactif',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  error: {
    label: 'Erreur',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  unknown: {
    label: 'Non vérifié',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

const formatDate = (value?: string) => {
  if (!value) return 'Non vérifié';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non vérifié';

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const getConnectionState = (supplier: SupplierSummary): ConnectionState => {
  if (supplier.status === 'active') return 'active';
  if (supplier.status === 'inactive') return 'inactive';
  if (supplier.status === 'error') return 'error';
  return 'unknown';
};

const Suppliers = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConnectionState | 'all'>('all');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error'>>({});

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await supplierService.getSupplierSummaries();
      setSuppliers(data);
    } catch (error) {
      console.error('Unable to load supplier hub:', error);
      setSuppliers([]);
      setLoadError(
        'Impossible de charger les fournisseurs. Aucune donnée fournisseur n’est affichée tant que la source n’est pas disponible.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const state = getConnectionState(supplier);
      const matchesStatus = statusFilter === 'all' || state === statusFilter;
      const matchesSearch =
        !term ||
        supplier.name.toLowerCase().includes(term) ||
        supplier.type.toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, suppliers]);

  const connectedCount = suppliers.filter(
    (supplier) => getConnectionState(supplier) === 'active'
  ).length;
  const errorCount = suppliers.filter(
    (supplier) => getConnectionState(supplier) === 'error'
  ).length;
  const verifiedSyncCount = suppliers.filter((supplier) => Boolean(supplier.lastSync)).length;

  const handleConfigureRealtimeSync = async (supplier: SupplierSummary) => {
    setSyncingId(supplier.id);
    try {
      await supplierService.configureRealtimeSync(supplier.id);
      toast.success('Synchronisation temps réel CJ activée');
      await loadSuppliers();
    } catch (error) {
      console.error(`CJ realtime sync setup failed for ${supplier.id}:`, error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Impossible d’activer la synchronisation temps réel CJ'
      );
    } finally {
      setSyncingId(null);
    }
  };

  const handleTestConnection = async (supplier: SupplierSummary) => {
    setTestingId(supplier.id);
    setTestResults((current) => {
      const next = { ...current };
      delete next[supplier.id];
      return next;
    });

    try {
      const success = await supplierService.testConnectionById(supplier.id);
      setTestResults((current) => ({
        ...current,
        [supplier.id]: success ? 'success' : 'error',
      }));
    } catch (error) {
      console.error(`Supplier connection test failed for ${supplier.id}:`, error);
      setTestResults((current) => ({ ...current, [supplier.id]: 'error' }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <ServerCog className="h-4 w-4" />
              Supplier Hub
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Gestion multi-fournisseurs
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
              Connectez et contrôlez vos sources fournisseurs depuis un seul endroit.
              ShopOpti n’affiche ici que les états réellement disponibles dans votre compte.
            </p>
          </div>

          <Button onClick={() => navigate('/app/integrations')} className="gap-2">
            <PlugZap className="h-4 w-4" />
            Ajouter / configurer
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fournisseurs
            </p>
            <p className="mt-2 text-2xl font-semibold">{suppliers.length}</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Connectés
            </p>
            <p className="mt-2 text-2xl font-semibold">{connectedCount}</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Synchronisation datée
            </p>
            <p className="mt-2 text-2xl font-semibold">{verifiedSyncCount}</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              En erreur
            </p>
            <p className="mt-2 text-2xl font-semibold">{errorCount}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom ou type de connecteur…"
              className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ConnectionState | 'all')
            }
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Tous les états</option>
            <option value="active">Connectés</option>
            <option value="inactive">Inactifs</option>
            <option value="error">En erreur</option>
            <option value="unknown">Non vérifiés</option>
          </select>

          <Button variant="outline" onClick={() => void loadSuppliers()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </section>

      {loadError && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Données fournisseurs indisponibles</p>
            <p className="mt-1">{loadError}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border bg-card">
          <div className="flex items-center gap-3 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Chargement des fournisseurs…
          </div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
          <Unplug className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Aucun fournisseur disponible</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Aucun fournisseur ne correspond aux données actuellement disponibles.
            ShopOpti ne crée pas de fournisseur, de score ou de statut fictif pour remplir cette vue.
          </p>
          <Button className="mt-5" onClick={() => navigate('/app/integrations')}>
            Configurer une intégration
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredSuppliers.map((supplier) => {
            const state = getConnectionState(supplier);
            const statusCopy = STATUS_COPY[state];
            const testResult = testResults[supplier.id];

            return (
              <article key={supplier.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold">{supplier.name}</h2>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusCopy.className}`}
                      >
                        {statusCopy.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Connecteur : <span className="font-medium text-foreground">{supplier.type}</span>
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock3 className="h-3.5 w-3.5" />
                      Dernière synchro
                    </div>
                    <p className="mt-1 text-muted-foreground">{formatDate(supplier.lastSync)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <ShieldCheck className="h-4 w-4" />
                      Connexion
                    </div>
                    <p className="mt-2 text-sm font-semibold">{statusCopy.label}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <PackageSearch className="h-4 w-4" />
                      Catalogue
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      {state === 'active' ? 'Accessible via connecteur' : 'Non vérifié'}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <RefreshCw className="h-4 w-4" />
                      Prix / stock
                    </div>
                    <p className="mt-2 text-sm font-semibold">Non vérifié</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <RefreshCw className="h-4 w-4" />
                      Temps réel
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      {supplier.type !== 'cj_dropshipping'
                        ? 'Non disponible'
                        : supplier.webhookStatus === 'enabled'
                          ? 'Webhook actif'
                          : supplier.webhookStatus === 'error'
                            ? 'Erreur webhook'
                            : 'Non configuré'}
                    </p>
                    {supplier.webhookLastEventAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dernier événement : {formatDate(supplier.webhookLastEventAt)}
                      </p>
                    )}
                  </div>
                </div>

                {testResult && (
                  <div
                    className={`mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
                      testResult === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                  >
                    {testResult === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    {testResult === 'success'
                      ? 'Connexion confirmée par le serveur.'
                      : 'Connexion non confirmée. Aucune réussite n’a été supposée.'}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={testingId === supplier.id}
                    onClick={() => void handleTestConnection(supplier)}
                    className="gap-2"
                  >
                    {testingId === supplier.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlugZap className="h-4 w-4" />
                    )}
                    Tester la connexion
                  </Button>

                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(`/app/import-products?supplier=${encodeURIComponent(supplier.id)}`)
                    }
                    disabled={state !== 'active'}
                    className="gap-2"
                  >
                    <PackageSearch className="h-4 w-4" />
                    Voir les produits
                  </Button>

                  {supplier.type === 'cj_dropshipping' && state === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={syncingId === supplier.id}
                      onClick={() => void handleConfigureRealtimeSync(supplier)}
                      className="gap-2"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${syncingId === supplier.id ? 'animate-spin' : ''}`}
                      />
                      {supplier.webhookStatus === 'enabled'
                        ? 'Reconfigurer synchro CJ'
                        : 'Activer synchro CJ'}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate('/app/integrations')}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Configurer
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Connecteurs fournisseurs</h2>
          <p className="text-sm text-muted-foreground">
            Portefeuille cible ShopOpti. « Documenté » signifie que la capacité existe chez le fournisseur,
            pas qu'elle est déjà implémentée dans ShopOpti.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {supplierProviders.map((provider) => {
            const implemented = Object.values(provider.capabilities).filter(
              (value) => value === 'implemented'
            ).length;
            const documented = Object.values(provider.capabilities).filter(
              (value) => value === 'documented'
            ).length;
            const stageLabel =
              provider.stage === 'implemented'
                ? 'Implémenté'
                : provider.stage === 'planned'
                  ? 'À intégrer'
                  : provider.stage === 'legacy'
                    ? 'Compatibilité héritée'
                    : 'Connecteur personnalisé';

            return (
              <div key={provider.type} className="rounded-xl border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{provider.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{provider.region}</p>
                  </div>
                  <span className="rounded-full border px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    {stageLabel}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Priorité</span>
                  <span className="font-medium">P{provider.priority}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Implémentées ShopOpti</span>
                  <span className="font-medium">{implemented}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Documentées fournisseur</span>
                  <span className="font-medium">{documented}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
        <p className="font-semibold">Principe de vérité des données</p>
        <p className="mt-1">
          Les métriques de performance, délais, prix, stock, nombre de produits et capacités
          d’automatisation ne sont volontairement pas inventés. Ils pourront être affichés
          lorsqu’une source serveur vérifiable les expose.
        </p>
      </section>
    </div>
  );
};

export default Suppliers;
