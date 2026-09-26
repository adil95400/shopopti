import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { CheckCircle2, Clock3, PlugZap, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { useRole } from '@/context/RoleContext';
import { supplierProviders, type SupplierCapability } from '@/config/supplierProviders';
import {
  supplierConnectorSettingsService,
  type SupplierConnectorAvailability,
  type SupplierConnectorSetting,
} from '@/services/supplierConnectorSettingsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const capabilityLabels: Record<SupplierCapability, string> = {
  catalog: 'Catalogue',
  import: 'Import',
  price: 'Prix',
  stock: 'Stock',
  variants: 'Variantes',
  shipping: 'Livraison',
  orders: 'Commandes',
  tracking: 'Tracking',
};

const stageLabel = {
  implemented: 'Implémenté',
  planned: 'Planifié',
  legacy: 'Legacy',
  custom: 'Personnalisé',
} as const;

const availabilityLabel: Record<SupplierConnectorAvailability, string> = {
  enabled: 'Activé',
  maintenance: 'Maintenance',
  disabled: 'Désactivé',
};

const AdminSupplierConnectors: React.FC = () => {
  const { isAdmin, loading } = useRole();
  const [settings, setSettings] = useState<SupplierConnectorSetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [updatingProvider, setUpdatingProvider] = useState<string | null>(null);

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      setSettings(await supplierConnectorSettingsService.list());
    } catch (error) {
      console.error('Unable to load connector settings:', error);
      toast.error('Impossible de charger les statuts plateforme des connecteurs');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void loadSettings();
    }
  }, [isAdmin]);

  const settingsByProvider = useMemo(
    () => new Map(settings.map((setting) => [setting.provider, setting])),
    [settings]
  );

  const updateAvailability = async (
    provider: (typeof supplierProviders)[number],
    status: SupplierConnectorAvailability
  ) => {
    if (provider.stage !== 'implemented' && status === 'enabled') {
      toast.error('Un connecteur non implémenté ne peut pas être activé');
      return;
    }

    setUpdatingProvider(provider.type);
    try {
      const updated = await supplierConnectorSettingsService.update(provider.type, status);
      setSettings((current) => [
        ...current.filter((setting) => setting.provider !== provider.type),
        updated,
      ]);
      toast.success(`${provider.name} : ${availabilityLabel[status]}`);
    } catch (error) {
      console.error(`Unable to update ${provider.type} connector setting:`, error);
      toast.error(
        error instanceof Error ? error.message : 'Impossible de modifier ce connecteur'
      );
    } finally {
      setUpdatingProvider(null);
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (!isAdmin) return <Navigate to="/app/dashboard" replace />;

  const implemented = supplierProviders.filter((provider) => provider.stage === 'implemented').length;
  const enabled = settings.filter((setting) => setting.status === 'enabled').length;
  const maintenance = settings.filter((setting) => setting.status === 'maintenance').length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connecteurs fournisseurs</h1>
          <p className="text-gray-500">
            Centre de contrôle global des intégrations ShopOpti. Les identifiants des clients ne sont jamais affichés ici.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadSettings()} disabled={settingsLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${settingsLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/suppliers">Ouvrir le Supplier Hub</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Référencés</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{supplierProviders.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Implémentés</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{implemented}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Activés plateforme</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{enabled}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Maintenance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{maintenance}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {supplierProviders.map((provider) => {
          const implementedCapabilities = Object.entries(provider.capabilities)
            .filter(([, status]) => status === 'implemented')
            .map(([capability]) => capability as SupplierCapability);
          const platformSetting = settingsByProvider.get(provider.type);
          const platformStatus = platformSetting?.status ?? 'disabled';
          const canEnable = provider.stage === 'implemented';

          return (
            <Card key={provider.type}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <PlugZap className="h-5 w-5" />
                      {provider.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-gray-500">
                      {provider.region} · Priorité P{provider.priority}
                    </p>
                  </div>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium">
                    {stageLabel[provider.stage]}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Disponibilité plateforme</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Contrôle si les utilisateurs peuvent connecter ce fournisseur.
                    </p>
                  </div>
                  <select
                    value={platformStatus}
                    disabled={settingsLoading || updatingProvider === provider.type}
                    onChange={(event) =>
                      void updateAvailability(
                        provider,
                        event.target.value as SupplierConnectorAvailability
                      )
                    }
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="disabled">Désactivé</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="enabled" disabled={!canEnable}>
                      Activé
                    </option>
                  </select>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  {provider.stage === 'implemented' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Clock3 className="h-4 w-4" />
                  )}
                  <span>
                    {provider.stage === 'implemented'
                      ? 'Connecteur implémenté — le Golden Path reste une validation séparée'
                      : 'Aucune disponibilité production déclarée'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(Object.keys(capabilityLabels) as SupplierCapability[]).map((capability) => {
                    const status = provider.capabilities[capability] ?? 'unknown';
                    return (
                      <span key={capability} className="rounded-md border px-2 py-1 text-xs">
                        {capabilityLabels[capability]} · {status}
                      </span>
                    );
                  })}
                </div>

                {provider.type === 'cj_dropshipping' && (
                  <div className="rounded-md border p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-4 w-4" />
                      Sécurité des identifiants
                    </div>
                    <p className="mt-1 text-gray-500">
                      Les tokens CJ sont stockés dans le schéma privé côté serveur. L’Admin ne peut ni les lire ni les afficher.
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Capacités implémentées : {implementedCapabilities.length}. Le statut plateforme est indépendant du statut de chaque compte utilisateur.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSupplierConnectors;
