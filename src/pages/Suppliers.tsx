import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  PackageSearch,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Unplug,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  supplierProviders,
  type SupplierCapability,
  type SupplierProviderDefinition,
} from '@/config/supplierProviders';
import { supplierService } from '@/services/supplierService';
import {
  supplierConnectorSettingsService,
  type SupplierConnectorSetting,
} from '@/services/supplierConnectorSettingsService';
import type { SupplierProviderType, SupplierSummary } from '@/types/supplier';

type ConnectionState = 'active' | 'inactive' | 'error' | 'unknown';
type HubTab = 'all' | 'connected' | 'available' | 'planned';

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

const CAPABILITY_LABELS: Record<SupplierCapability, string> = {
  catalog: 'Catalogue',
  import: 'Import',
  price: 'Prix',
  stock: 'Stock',
  variants: 'Variantes',
  shipping: 'Livraison',
  orders: 'Commandes',
  tracking: 'Tracking',
};

const PROVIDER_BADGES: Partial<Record<SupplierProviderType, string>> = {
  cj_dropshipping: 'CJ',
  bigbuy: 'BIG',
  aliexpress: 'Ali',
  alibaba: 'A',
  banggood: 'BG',
  dhgate: 'DH',
  cdiscount: 'C',
  spocket: 'S',
  eprolo: 'E',
  custom_api: 'API',
  custom_csv: 'CSV',
  custom_xml: 'XML',
  custom_ftp: 'FTP',
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

const stageLabel = (provider: SupplierProviderDefinition) => {
  if (provider.stage === 'implemented') return 'Disponible';
  if (provider.stage === 'planned') return 'Bientôt';
  if (provider.stage === 'legacy') return 'Legacy';
  return 'Personnalisé';
};

const stageClassName = (provider: SupplierProviderDefinition) => {
  if (provider.stage === 'implemented') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }
  if (provider.stage === 'planned') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }
  if (provider.stage === 'legacy') {
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }
  return 'border-cyan-200 bg-cyan-50 text-cyan-700';
};

const Suppliers = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [connectorSettings, setConnectorSettings] = useState<SupplierConnectorSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<HubTab>('all');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error'>>({});
  const [showConnectCJ, setShowConnectCJ] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [connectingCJ, setConnectingCJ] = useState(false);
  const [cjName, setCjName] = useState('Mon compte CJ');
  const [cjApiKey, setCjApiKey] = useState('');

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await supplierService.getSupplierSummaries();
      setSuppliers(data);

      try {
        const settings = await supplierConnectorSettingsService.list();
        setConnectorSettings(settings);
      } catch (settingsError) {
        console.error('Unable to load connector availability:', settingsError);
        setConnectorSettings([]);
        setLoadError(
          'Le statut plateforme des connecteurs est indisponible. Les connexions existantes restent visibles, mais les nouvelles actions sont désactivées par sécurité.'
        );
      }
    } catch (error) {
      console.error('Unable to load supplier hub:', error);
      setSuppliers([]);
      setConnectorSettings([]);
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

  const connectionsByType = useMemo(() => {
    const map = new Map<SupplierProviderType, SupplierSummary[]>();
    for (const supplier of suppliers) {
      const current = map.get(supplier.type) ?? [];
      current.push(supplier);
      map.set(supplier.type, current);
    }
    return map;
  }, [suppliers]);

  const availabilityByProvider = useMemo(
    () => new Map(connectorSettings.map((setting) => [setting.provider, setting.status])),
    [connectorSettings]
  );

  const filteredProviders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return supplierProviders.filter((provider) => {
      const connections = connectionsByType.get(provider.type) ?? [];
      const matchesSearch =
        !term ||
        provider.name.toLowerCase().includes(term) ||
        provider.type.toLowerCase().includes(term) ||
        provider.region.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      if (activeTab === 'connected') {
        return connections.length > 0;
      }
      if (activeTab === 'available') {
        return availabilityByProvider.get(provider.type) === 'enabled';
      }
      if (activeTab === 'planned') {
        return provider.stage === 'planned';
      }
      return true;
    });
  }, [activeTab, availabilityByProvider, connectionsByType, search]);

  const connectedCount = suppliers.filter(
    (supplier) => getConnectionState(supplier) === 'active'
  ).length;
  const realtimeCount = suppliers.filter(
    (supplier) => supplier.webhookStatus === 'enabled'
  ).length;
  const errorCount = suppliers.filter(
    (supplier) => getConnectionState(supplier) === 'error'
  ).length;
  const availableConnectorCount = connectorSettings.filter(
    (setting) => setting.status === 'enabled'
  ).length;
  const plannedConnectorCount = supplierProviders.filter(
    (provider) => provider.stage === 'planned'
  ).length;
  const cjAvailability =
    availabilityByProvider.get('cj_dropshipping') ?? 'disabled';

  const openCJConnectionPanel = (supplier?: SupplierSummary) => {
    setEditingSupplierId(supplier?.id ?? null);
    setCjName(supplier?.name ?? 'Mon compte CJ');
    setCjApiKey('');
    setShowConnectCJ(true);
  };

  const handleConnectCJ = async () => {
    if (cjAvailability !== 'enabled') {
      toast.error(
        cjAvailability === 'maintenance'
          ? 'CJdropshipping est temporairement en maintenance'
          : 'CJdropshipping est actuellement désactivé'
      );
      return;
    }

    const name = cjName.trim();
    const apiKey = cjApiKey.trim();

    if (!name || !apiKey) {
      toast.error('Le nom du compte et la clé API CJ sont obligatoires');
      return;
    }

    setConnectingCJ(true);
    try {
      const created = editingSupplierId
        ? await supplierService.updateSupplier(editingSupplierId, {
            name,
            apiKey,
          })
        : await supplierService.createSupplier({
            name,
            type: 'cj_dropshipping',
            apiKey,
            apiSecret: undefined,
            baseUrl: '',
            status: 'inactive',
            user_id: '',
          });

      toast.success(
        editingSupplierId
          ? 'Connexion CJdropshipping mise à jour et vérifiée'
          : 'CJdropshipping connecté et vérifié'
      );
      setShowConnectCJ(false);
      setEditingSupplierId(null);
      setCjApiKey('');
      setCjName('Mon compte CJ');
      await loadSuppliers();

      if (created.status === 'active') {
        setTestResults((current) => ({ ...current, [created.id]: 'success' }));
      }
    } catch (error) {
      console.error('CJ connection failed:', error);
      toast.error(error instanceof Error ? error.message : 'Connexion CJ impossible');
    } finally {
      setConnectingCJ(false);
    }
  };

  const handleDisconnectSupplier = async (supplier: SupplierSummary) => {
    const confirmed = window.confirm(
      `Déconnecter ${supplier.name} ? Cette action supprimera la connexion ShopOpti.`
    );
    if (!confirmed) return;

    setDisconnectingId(supplier.id);
    try {
      const result = await supplierService.disconnectSupplier(supplier.id);
      toast.success(
        result.remoteLogoutConfirmed
          ? 'Connexion CJ révoquée et supprimée'
          : 'Connexion supprimée de ShopOpti'
      );
      await loadSuppliers();
    } catch (error) {
      console.error(`Supplier disconnect failed for ${supplier.id}:`, error);
      toast.error(
        error instanceof Error ? error.message : 'Impossible de déconnecter ce fournisseur'
      );
    } finally {
      setDisconnectingId(null);
    }
  };

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

  const renderProviderAction = (provider: SupplierProviderDefinition) => {
    const availability = availabilityByProvider.get(provider.type) ?? 'disabled';

    if (
      provider.type === 'cj_dropshipping' &&
      provider.stage === 'implemented' &&
      availability === 'enabled'
    ) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => openCJConnectionPanel()}
        >
          Connecter un compte
        </Button>
      );
    }

    return (
      <Button size="sm" variant="outline" className="w-full" disabled>
        {availability === 'maintenance'
          ? 'En maintenance'
          : provider.stage === 'planned'
            ? 'Bientôt disponible'
            : 'Non disponible'}
      </Button>
    );
  };

  return (
    <div className="min-h-full bg-muted/20">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
        <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                <Store className="h-4 w-4" />
                Supplier Hub
              </div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Connectez vos fournisseurs
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
                Gérez vos comptes fournisseurs, contrôlez leur état et accédez aux produits
                depuis une seule interface.
              </p>
            </div>

            <Button
              onClick={() => openCJConnectionPanel()}
              className="gap-2"
              disabled={cjAvailability !== 'enabled'}
            >
              <PlugZap className="h-4 w-4" />
              {cjAvailability === 'maintenance'
                ? 'CJdropshipping en maintenance'
                : cjAvailability === 'disabled'
                  ? 'CJdropshipping désactivé'
                  : 'Connecter CJdropshipping'}
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fournisseurs connectés
              </p>
              <p className="mt-2 text-2xl font-semibold">{connectedCount}</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Synchronisations actives
              </p>
              <p className="mt-2 text-2xl font-semibold">{realtimeCount}</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                À vérifier
              </p>
              <p className="mt-2 text-2xl font-semibold">{errorCount}</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Connecteurs disponibles
              </p>
              <p className="mt-2 text-2xl font-semibold">{availableConnectorCount}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                ['all', `Tous les fournisseurs (${supplierProviders.length})`],
                ['connected', `Connectés (${suppliers.length})`],
                ['available', `Disponibles (${availableConnectorCount})`],
                ['planned', `Bientôt (${plannedConnectorCount})`],
              ] as Array<[HubTab, string]>).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative w-full xl:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un fournisseur..."
                className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
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
        ) : filteredProviders.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
            <Unplug className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Aucun fournisseur correspondant</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Modifiez la recherche ou choisissez un autre filtre.
            </p>
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProviders.map((provider) => {
              const connections = connectionsByType.get(provider.type) ?? [];
              const platformAvailability =
                availabilityByProvider.get(provider.type) ?? 'disabled';
              const capabilityEntries = (Object.entries(provider.capabilities) as Array<
                [SupplierCapability, string]
              >).filter(([, status]) => status === 'implemented');

              return (
                <article
                  key={provider.type}
                  className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted text-sm font-bold">
                        {PROVIDER_BADGES[provider.type] ?? provider.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">{provider.name}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {provider.region}
                          {connections.length > 1 ? ` · ${connections.length} comptes` : ''}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        platformAvailability === 'maintenance'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : platformAvailability === 'disabled'
                            ? 'border-slate-200 bg-slate-50 text-slate-600'
                            : connections.some((connection) => connection.status === 'active')
                              ? STATUS_COPY.active.className
                              : stageClassName(provider)
                      }`}
                    >
                      {platformAvailability === 'maintenance'
                        ? 'Maintenance'
                        : platformAvailability === 'disabled'
                          ? 'Désactivé'
                          : connections.some((connection) => connection.status === 'active')
                            ? 'Connecté'
                            : stageLabel(provider)}
                    </span>
                  </div>

                  <div className="mt-4 flex min-h-16 flex-wrap content-start gap-2">
                    {capabilityEntries.length > 0 ? (
                      capabilityEntries.map(([capability]) => (
                        <span
                          key={capability}
                          className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          {CAPABILITY_LABELS[capability]}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Capacités ShopOpti non encore validées
                      </span>
                    )}
                  </div>

                  {connections.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {connections.map((connection) => {
                        const state = getConnectionState(connection);
                        const testResult = testResults[connection.id];

                        return (
                          <div key={connection.id} className="rounded-xl border bg-muted/20 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{connection.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Dernière synchro : {formatDate(connection.lastSync)}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COPY[state].className}`}
                              >
                                {STATUS_COPY[state].label}
                              </span>
                            </div>

                            {connection.type === 'cj_dropshipping' && (
                              <div className="mt-2 flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Temps réel</span>
                                <span className="font-medium">
                                  {connection.webhookStatus === 'enabled'
                                    ? 'Webhook actif'
                                    : connection.webhookStatus === 'error'
                                      ? 'Erreur webhook'
                                      : 'Non configuré'}
                                </span>
                              </div>
                            )}

                            {testResult && (
                              <div
                                className={`mt-2 flex items-center gap-2 rounded-md border p-2 text-xs ${
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
                                  ? 'Connexion confirmée'
                                  : 'Connexion non confirmée'}
                              </div>
                            )}

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                disabled={
                                  state !== 'active' || platformAvailability !== 'enabled'
                                }
                                onClick={() =>
                                  navigate(
                                    `/app/import-products?supplier=${encodeURIComponent(connection.id)}`
                                  )
                                }
                              >
                                Gérer
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  testingId === connection.id ||
                                  platformAvailability !== 'enabled'
                                }
                                onClick={() => void handleTestConnection(connection)}
                                aria-label={`Tester ${connection.name}`}
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${
                                    testingId === connection.id ? 'animate-spin' : ''
                                  }`}
                                />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={disconnectingId === connection.id}
                                onClick={() => void handleDisconnectSupplier(connection)}
                                aria-label={`Déconnecter ${connection.name}`}
                              >
                                <Trash2
                                  className={`h-4 w-4 ${
                                    disconnectingId === connection.id ? 'animate-pulse' : ''
                                  }`}
                                />
                              </Button>
                            </div>

                            {connection.type === 'cj_dropshipping' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="mt-2 w-full"
                                disabled={connectingCJ || platformAvailability !== 'enabled'}
                                onClick={() => openCJConnectionPanel(connection)}
                              >
                                {state === 'error' ? 'Reconnecter avec une nouvelle clé' : 'Mettre à jour la clé CJ'}
                              </Button>
                            )}

                            {connection.type === 'cj_dropshipping' && state === 'active' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="mt-2 w-full gap-2"
                                disabled={
                                  syncingId === connection.id ||
                                  platformAvailability !== 'enabled'
                                }
                                onClick={() => void handleConfigureRealtimeSync(connection)}
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${
                                    syncingId === connection.id ? 'animate-spin' : ''
                                  }`}
                                />
                                {connection.webhookStatus === 'enabled'
                                  ? 'Reconfigurer la synchro CJ'
                                  : 'Activer la synchro CJ'}
                              </Button>
                            )}
                          </div>
                        );
                      })}

                      {provider.type === 'cj_dropshipping' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={platformAvailability !== 'enabled'}
                          onClick={() => openCJConnectionPanel()}
                        >
                          {platformAvailability === 'maintenance'
                            ? 'Connecteur en maintenance'
                            : platformAvailability === 'disabled'
                              ? 'Connecteur désactivé'
                              : 'Connecter un autre compte'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-5">{renderProviderAction(provider)}</div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
          <p className="font-semibold">Principe de vérité des données</p>
          <p className="mt-1">
            ShopOpti n’affiche pas de volume produits, prix, stock ou automatisation comme vérifiés
            tant qu’une source serveur ne les confirme pas.
          </p>
        </section>
      </div>

      {showConnectCJ && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => !connectingCJ && setShowConnectCJ(false)}
            aria-label="Fermer le panneau"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-2xl md:p-8">
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border bg-orange-50 font-bold text-orange-600">
                    CJ
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {editingSupplierId ? 'Reconnecter CJdropshipping' : 'Connecter CJdropshipping'}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Connectez votre compte CJ pour importer des produits et utiliser les fonctions
                      validées du connecteur ShopOpti.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowConnectCJ(false);
                    setEditingSupplierId(null);
                  }}
                  disabled={connectingCJ}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-7 space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Nom de la connexion <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={cjName}
                    onChange={(event) => setCjName(event.target.value)}
                    className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
                    placeholder="Mon compte CJ"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nom interne pour identifier cette connexion.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Clé API CJ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={cjApiKey}
                    onChange={(event) => setCjApiKey(event.target.value)}
                    className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
                    placeholder="Collez votre clé API CJ"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    La clé est envoyée uniquement au serveur ShopOpti pour obtenir et vérifier le token CJ.
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    Connexion sécurisée
                  </div>
                  <p className="mt-1 text-xs">
                    La clé API est échangée côté serveur contre les tokens CJ. L’openId et le refresh token sont récupérés automatiquement et ne sont jamais exposés au navigateur.
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm font-semibold">Fonctionnalités ShopOpti implémentées</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(Object.entries(
                      supplierProviders.find((provider) => provider.type === 'cj_dropshipping')
                        ?.capabilities ?? {}
                    ) as Array<[SupplierCapability, string]>)
                      .filter(([, status]) => status === 'implemented')
                      .map(([capability]) => (
                        <div key={capability} className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          {CAPABILITY_LABELS[capability]}
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="mt-7 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={connectingCJ}
                  onClick={() => {
                    setShowConnectCJ(false);
                    setEditingSupplierId(null);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={connectingCJ || !cjName.trim() || !cjApiKey.trim()}
                  onClick={() => void handleConnectCJ()}
                >
                  {connectingCJ ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlugZap className="h-4 w-4" />
                  )}
                  {editingSupplierId ? 'Vérifier et mettre à jour' : 'Tester et connecter'}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
