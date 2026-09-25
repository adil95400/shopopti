import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Cable,
  RefreshCw,
  ServerCog,
  Workflow
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useRole } from '@/context/RoleContext';
import {
  adminImportsService,
  type AdminImportsData
} from '@/services/adminImportsService';

type Tab = 'suppliers' | 'connections' | 'jobs' | 'pipeline';

const statusClass = (status: string | null) => {
  const value = String(status ?? '').toLowerCase();
  if (['active', 'connected', 'completed', 'success', 'succeeded', 'published'].includes(value)) {
    return 'text-green-700';
  }
  if (['failed', 'error', 'dead_lettered', 'dead-lettered'].includes(value)) {
    return 'text-red-700';
  }
  if (['processing', 'running', 'in_progress', 'pending', 'queued'].includes(value)) {
    return 'text-amber-700';
  }
  return 'text-gray-600';
};

const AdminImports: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const [data, setData] = useState<AdminImportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('suppliers');

  const load = async () => {
    try {
      setLoading(true);
      setData(await adminImportsService.getOverview());
    } catch (error) {
      console.error('Error loading Admin Imports:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Impossible de charger Admin Imports'
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const tabs = useMemo(
    () => [
      {
        id: 'suppliers' as const,
        label: 'Fournisseurs',
        count: data?.totals.suppliers ?? 0,
        icon: Boxes
      },
      {
        id: 'connections' as const,
        label: 'Connexions',
        count: data?.totals.connections ?? 0,
        icon: Cable
      },
      {
        id: 'jobs' as const,
        label: 'Jobs import',
        count:
          (data?.totals.importJobs ?? 0) +
          (data?.totals.productImportJobs ?? 0),
        icon: ServerCog
      },
      {
        id: 'pipeline' as const,
        label: 'Pipeline',
        count: data?.totals.pipelineStates ?? 0,
        icon: Workflow
      }
    ],
    [data]
  );

  if (roleLoading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Imports</h1>
          <p className="text-gray-500">
            Supervision fournisseurs, connexions et pipeline d'import réels
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Cette console n'expose jamais les clés API ni les credentials chiffrés.
            Les mutations fournisseur restent désactivées tant qu'elles ne passent pas
            par un flux serveur/vault validé.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tabs.map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg border p-4 text-left ${
              tab === id ? 'bg-muted' : 'bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{label}</span>
              <Icon className="h-4 w-4 text-gray-500" />
            </div>
            <div className="mt-2 text-2xl font-bold">{count}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-10 text-center">
          Chargement des imports réels...
        </div>
      ) : !data ? (
        <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
          Données indisponibles. Aucun fournisseur ou job simulé n'est affiché.
        </div>
      ) : (
        <>
          {tab === 'suppliers' && (
            data.suppliers.length === 0 ? (
              <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
                Aucun fournisseur enregistré.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left">Fournisseur</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Connexion</th>
                      <th className="p-3 text-left">Produits</th>
                      <th className="p-3 text-left">Dernière sync</th>
                      <th className="p-3 text-left">Erreurs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.suppliers.map((supplier) => (
                      <tr key={supplier.id} className="border-t">
                        <td className="p-3">
                          <div className="font-medium">
                            {supplier.display_name || supplier.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {supplier.country || 'Pays non renseigné'}
                            {supplier.is_verified ? ' · Vérifié' : ''}
                            {supplier.is_premium ? ' · Premium' : ''}
                          </div>
                        </td>
                        <td className="p-3">
                          {supplier.connector_type || supplier.supplier_type || '—'}
                        </td>
                        <td className={`p-3 ${statusClass(
                          supplier.connection_status || supplier.status
                        )}`}>
                          {supplier.connection_status || supplier.status || 'inconnu'}
                        </td>
                        <td className="p-3">
                          {supplier.total_products ?? supplier.product_count ?? '—'}
                        </td>
                        <td className="p-3">
                          {supplier.last_sync_at
                            ? new Date(supplier.last_sync_at).toLocaleString('fr-FR')
                            : 'Jamais'}
                        </td>
                        <td className="p-3">
                          {supplier.error_count ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'connections' && (
            data.connections.length === 0 ? (
              <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
                Aucune connexion fournisseur enregistrée.
              </div>
            ) : (
              <div className="space-y-3">
                {data.connections.map((connection) => (
                  <div key={connection.id} className="rounded-lg border bg-white p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">
                          {connection.connector_name || connection.connector_id}
                        </div>
                        <div className="text-xs text-gray-500">
                          Utilisateur {connection.user_id}
                        </div>
                      </div>
                      <div className={`text-sm ${statusClass(connection.status)}`}>
                        {connection.status || 'inconnu'}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Dernière synchronisation :{' '}
                      {connection.last_sync_at
                        ? new Date(connection.last_sync_at).toLocaleString('fr-FR')
                        : 'jamais'}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'jobs' && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-lg font-semibold">Jobs canoniques</h2>
                {data.importJobs.length === 0 ? (
                  <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
                    Aucun import_jobs enregistré sur staging.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.importJobs.map((job) => (
                      <div key={job.id} className="rounded-lg border bg-white p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-medium">
                              {job.source_platform || job.job_type || 'Import'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {job.source_url || job.id}
                            </div>
                          </div>
                          <div className={`text-sm ${statusClass(job.status)}`}>
                            {job.status || 'inconnu'}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
                          <div>
                            <span className="text-gray-500">Total :</span>{' '}
                            {job.total_products ?? 0}
                          </div>
                          <div>
                            <span className="text-gray-500">Traités :</span>{' '}
                            {job.processed_products ?? 0}
                          </div>
                          <div>
                            <span className="text-gray-500">Succès :</span>{' '}
                            {job.successful_imports ?? 0}
                          </div>
                          <div>
                            <span className="text-gray-500">Échecs :</span>{' '}
                            {job.failed_imports ?? 0}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="mb-3 text-lg font-semibold">Jobs produit</h2>
                {data.productImportJobs.length === 0 ? (
                  <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
                    Aucun product_import_jobs enregistré sur staging.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.productImportJobs.map((job) => (
                      <div key={job.id} className="rounded-lg border bg-white p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-medium">
                              {job.platform || 'Import produit'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {job.source_url || job.id}
                            </div>
                          </div>
                          <div className={`text-sm ${statusClass(job.status)}`}>
                            {job.status || 'inconnu'} · {job.progress_percent ?? 0}%
                          </div>
                        </div>
                        {(job.error_code || job.error_message) && (
                          <div className="mt-2 text-sm text-red-700">
                            {job.error_code ? `${job.error_code} · ` : ''}
                            {job.error_message || 'Erreur non détaillée'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'pipeline' && (
            data.pipelineStates.length === 0 ? (
              <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
                Aucun état de pipeline enregistré sur staging.
              </div>
            ) : (
              <div className="space-y-3">
                {data.pipelineStates.map((state) => (
                  <div key={state.job_id} className="rounded-lg border bg-white p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">{state.stage || 'stage inconnu'}</div>
                        <div className="text-xs text-gray-500">
                          Job {state.job_id}
                          {state.source_product_id
                            ? ` · Produit ${state.source_product_id}`
                            : ''}
                        </div>
                      </div>
                      <div className="text-sm">
                        Tentative {state.attempt ?? 0}/{state.max_attempts ?? '—'}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                      <div>
                        <span className="text-gray-500">Lease :</span>{' '}
                        {state.lease_owner || 'aucun'}
                      </div>
                      <div>
                        <span className="text-gray-500">Heartbeat :</span>{' '}
                        {state.heartbeat_at
                          ? new Date(state.heartbeat_at).toLocaleString('fr-FR')
                          : '—'}
                      </div>
                      <div>
                        <span className="text-gray-500">Dead letter :</span>{' '}
                        {state.dead_lettered_at
                          ? new Date(state.dead_lettered_at).toLocaleString('fr-FR')
                          : 'non'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          <div className="text-xs text-gray-500">
            Généré le {new Date(data.generatedAt).toLocaleString('fr-FR')}. Sources :{' '}
            {Object.values(data.provenance).join(', ')}. Credentials inclus : non.
            Mutations Admin Imports : désactivées dans ce lot.
          </div>
        </>
      )}
    </div>
  );
};

export default AdminImports;
