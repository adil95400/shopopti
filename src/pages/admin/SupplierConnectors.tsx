import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { CheckCircle2, Clock3, PlugZap, ShieldCheck } from 'lucide-react';

import { useRole } from '@/context/RoleContext';
import { supplierProviders, type SupplierCapability } from '@/config/supplierProviders';
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
  implemented: 'Disponible',
  planned: 'Planifié',
  legacy: 'Legacy',
  custom: 'Personnalisé',
} as const;

const AdminSupplierConnectors: React.FC = () => {
  const { isAdmin, loading } = useRole();

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (!isAdmin) return <Navigate to="/app/dashboard" replace />;

  const available = supplierProviders.filter((provider) => provider.stage === 'implemented').length;
  const planned = supplierProviders.filter((provider) => provider.stage === 'planned').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connecteurs fournisseurs</h1>
          <p className="text-gray-500">
            Centre de contrôle des intégrations disponibles dans ShopOpti. Les clés API des clients ne sont jamais affichées ici.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/app/suppliers">Ouvrir le Supplier Hub utilisateur</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Connecteurs référencés</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{supplierProviders.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Disponibles dans le code</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{available}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Planifiés</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{planned}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {supplierProviders.map((provider) => {
          const implementedCapabilities = Object.entries(provider.capabilities)
            .filter(([, status]) => status === 'implemented')
            .map(([capability]) => capability as SupplierCapability);

          return (
            <Card key={provider.type}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <PlugZap className="h-5 w-5" />
                      {provider.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-gray-500">{provider.region} · Priorité P{provider.priority}</p>
                  </div>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium">
                    {stageLabel[provider.stage]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  {provider.stage === 'implemented' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Clock3 className="h-4 w-4" />
                  )}
                  <span>
                    {provider.stage === 'implemented'
                      ? 'Connecteur implémenté — validation production séparée requise'
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
                      Les utilisateurs connectent leur propre compte CJ depuis Supplier Hub. Cet écran admin ne lit ni n'affiche leurs secrets.
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Capacités implémentées : {implementedCapabilities.length}. Le Golden Path avec un compte CJ réel reste une preuve distincte.
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
