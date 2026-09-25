import React, { useEffect, useMemo, useState } from 'react';
import { Activity, FileClock, RefreshCw, RotateCcw, Webhook, Workflow } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useRole } from '@/context/RoleContext';
import { adminOpsService, type AdminOpsData } from '@/services/adminOpsService';
import { Button } from '@/components/ui/button';

type Tab = 'audits' | 'jobs' | 'sync' | 'webhooks' | 'imports';

const AdminOperations: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const [data, setData] = useState<AdminOpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('audits');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setData(await adminOpsService.getOverview());
    } catch (error) {
      console.error('Error loading Admin Ops:', error);
      toast.error(error instanceof Error ? error.message : 'Impossible de charger Admin Ops');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const replayImport = async (jobId: string) => {
    if (!window.confirm('Rejouer cet import dead-letter ?')) return;

    try {
      setActingId(jobId);
      const result = await adminOpsService.replayImportPipeline(jobId);
      toast.success(
        result.auditLogged
          ? 'Import remis dans le pipeline avec audit.'
          : 'Import rejoué, mais l’audit secondaire a échoué.'
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Échec du replay import');
    } finally {
      setActingId(null);
    }
  };

  const retrySync = async (syncId: string) => {
    if (!window.confirm('Reprogrammer cette synchronisation échouée ?')) return;

    try {
      setActingId(syncId);
      const result = await adminOpsService.retrySyncQueue(syncId);
      toast.success(
        result.auditLogged
          ? 'Synchronisation reprogrammée avec audit.'
          : 'Synchronisation reprogrammée, mais l’audit secondaire a échoué.'
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Échec du retry sync');
    } finally {
      setActingId(null);
    }
  };

  const tabs = useMemo(() => [
    { id: 'audits' as const, label: 'Audit logs', count: data?.totals.audits ?? 0, icon: FileClock },
    { id: 'jobs' as const, label: 'Jobs', count: data?.totals.backgroundJobs ?? 0, icon: Activity },
    { id: 'sync' as const, label: 'Sync queue', count: data?.totals.syncQueue ?? 0, icon: Workflow },
    { id: 'webhooks' as const, label: 'Webhooks', count: data?.totals.webhookDeliveries ?? 0, icon: Webhook },
    { id: 'imports' as const, label: 'Import DLQ', count: data?.totals.deadLetterImports ?? 0, icon: RotateCcw },
  ], [data]);

  if (roleLoading) return <div className="flex justify-center p-8">Chargement...</div>;
  if (!isAdmin) return <Navigate to="/app/dashboard" replace />;

  const empty = (label: string) => (
    <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
      Aucun {label} enregistré dans la table canonique du staging.
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Ops</h1>
          <p className="text-gray-500">
            Audit, jobs, synchronisations et livraisons webhook réels
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tabs.map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg border p-4 text-left ${tab === id ? 'bg-muted' : 'bg-white'}`}
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
          Chargement des données opérationnelles...
        </div>
      ) : !data ? (
        <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
          Données indisponibles. Aucun faux log n'est affiché.
        </div>
      ) : (
        <>
          {tab === 'audits' && (
            data.audits.length === 0 ? empty('audit log') : (
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Acteur</th><th className="p-3 text-left">Action</th><th className="p-3 text-left">Ressource</th><th className="p-3 text-left">Statut</th></tr>
                  </thead>
                  <tbody>
                    {data.audits.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-3">{new Date(row.created_at).toLocaleString('fr-FR')}</td>
                        <td className="p-3">{row.actor_email || 'Inconnu'}</td>
                        <td className="p-3">{row.action || '—'}</td>
                        <td className="p-3">{row.resource_type || '—'} {row.resource_id ? '#' + row.resource_id : ''}</td>
                        <td className="p-3">{String(row.metadata?.status ?? row.severity ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'jobs' && (
            data.backgroundJobs.length === 0 ? empty('job') : (
              <div className="space-y-3">
                {data.backgroundJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border bg-white p-4">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="font-medium">{job.name || job.job_type || 'Job sans nom'}</div>
                        <div className="text-sm text-gray-500">{job.job_subtype || job.job_type || '—'}</div>
                      </div>
                      <div className="text-sm">{job.status || 'unknown'}</div>
                    </div>
                    {job.error_message && <div className="mt-2 text-sm text-red-600">{job.error_message}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'sync' && (
            data.syncQueue.length === 0 ? empty('élément de synchronisation') : (
              <div className="space-y-3">
                {data.syncQueue.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-white p-4">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="font-medium">{item.sync_type || 'Sync'}</div>
                        <div className="text-sm text-gray-500">{item.entity_type || '—'} · {item.action || '—'}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm">{item.status || 'unknown'}</div>
                        {item.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              actingId === item.id ||
                              ((item.max_retries ?? 0) > 0 &&
                                (item.retry_count ?? 0) >= (item.max_retries ?? 0))
                            }
                            onClick={() => void retrySync(item.id)}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Retry {item.retry_count ?? 0}/{item.max_retries ?? '—'}
                    </div>
                    {item.error_message && <div className="mt-2 text-sm text-red-600">{item.error_message}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'imports' && (
            data.deadLetterImports.length === 0 ? empty('import en dead-letter') : (
              <div className="space-y-3">
                {data.deadLetterImports.map((item) => (
                  <div key={item.job_id} className="rounded-lg border bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">{item.stage || 'FAILED'}</div>
                        <div className="text-sm text-gray-500">
                          Job {item.job_id} · tentative {item.attempt ?? 0}/{item.max_attempts ?? '—'}
                        </div>
                        {item.dead_lettered_at && (
                          <div className="mt-1 text-xs text-gray-500">
                            Dead-letter le {new Date(item.dead_lettered_at).toLocaleString('fr-FR')}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingId === item.job_id}
                        onClick={() => void replayImport(item.job_id)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Replay
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'webhooks' && (
            data.webhookDeliveries.length === 0 ? empty('livraison webhook') : (
              <div className="space-y-3">
                {data.webhookDeliveries.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-white p-4">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="font-medium">{item.event_type || 'Webhook'}</div>
                        <div className="text-sm text-gray-500">Tentative {item.attempt_number ?? '—'} · HTTP {item.status_code ?? '—'}</div>
                      </div>
                      <div className={item.success === true ? 'text-sm text-green-600' : item.success === false ? 'text-sm text-red-600' : 'text-sm'}>
                        {item.success === true ? 'Succès' : item.success === false ? 'Échec' : 'Inconnu'}
                      </div>
                    </div>
                    {item.error_message && <div className="mt-2 text-sm text-red-600">{item.error_message}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          <div className="text-xs text-gray-500">
            Généré le {new Date(data.generatedAt).toLocaleString('fr-FR')}. Sources : {Object.values(data.provenance).join(', ')}. Actions disponibles : replay import dead-letter et retry sync échouée. Les background jobs, webhooks et logs runtime Supabase/Vercel restent en lecture seule.
          </div>
        </>
      )}
    </div>
  );
};

export default AdminOperations;
