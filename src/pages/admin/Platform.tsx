import React, { useEffect, useMemo, useState } from 'react';
import { Flag, Headphones, RefreshCw, Settings2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useRole } from '@/context/RoleContext';
import { adminPlatformService, type AdminPlatformData } from '@/services/adminPlatformService';
import { Button } from '@/components/ui/button';

type Tab = 'flags' | 'support' | 'settings' | 'audit';

const AdminPlatform: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const [data, setData] = useState<AdminPlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('flags');

  const load = async () => {
    try {
      setLoading(true);
      setData(await adminPlatformService.getOverview());
    } catch (error) {
      console.error('Error loading Admin Platform:', error);
      toast.error(error instanceof Error ? error.message : 'Impossible de charger Admin Platform');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const categories = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.flags.map((flag) => flag.category || 'autre'))).sort();
  }, [data]);

  const toggleFlag = async (flagId: string, enabled: boolean) => {
    const flag = data?.flags.find((item) => item.id === flagId);
    const label = flag?.name || flag?.key || flagId;
    const confirmed = window.confirm(
      (enabled ? 'Activer ' : 'Désactiver ') + label + ' ?'
    );
    if (!confirmed) return;

    try {
      setActionId(flagId);
      await adminPlatformService.setFlagEnabled(flagId, enabled);
      toast.success(enabled ? 'Feature activée' : 'Feature désactivée');
      await load();
    } catch (error) {
      console.error('Error updating feature flag:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de la mise à jour');
    } finally {
      setActionId(null);
    }
  };

  const updateTicket = async (ticketId: string, status: string) => {
    try {
      setActionId(ticketId);
      await adminPlatformService.setTicketStatus(ticketId, status);
      toast.success('Statut du ticket mis à jour');
      await load();
    } catch (error) {
      console.error('Error updating support ticket:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de la mise à jour');
    } finally {
      setActionId(null);
    }
  };

  if (roleLoading) return <div className="flex justify-center p-8">Chargement...</div>;
  if (!isAdmin) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Platform</h1>
          <p className="text-gray-500">Feature flags, paramètres et support sur données réelles</p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" onClick={() => setTab('flags')} className={`rounded-lg border p-4 text-left ${tab === 'flags' ? 'bg-muted' : 'bg-white'}`}>
          <div className="flex items-center justify-between text-sm text-gray-500"><span>Feature flags</span><Flag className="h-4 w-4" /></div>
          <div className="mt-2 text-2xl font-bold">{data?.totals.flags ?? 0}</div>
        </button>
        <button type="button" onClick={() => setTab('support')} className={`rounded-lg border p-4 text-left ${tab === 'support' ? 'bg-muted' : 'bg-white'}`}>
          <div className="flex items-center justify-between text-sm text-gray-500"><span>Tickets support</span><Headphones className="h-4 w-4" /></div>
          <div className="mt-2 text-2xl font-bold">{data?.totals.supportTickets ?? 0}</div>
        </button>
        <button type="button" onClick={() => setTab('settings')} className={`rounded-lg border p-4 text-left ${tab === 'settings' ? 'bg-muted' : 'bg-white'}`}>
          <div className="flex items-center justify-between text-sm text-gray-500"><span>Paramètres</span><Settings2 className="h-4 w-4" /></div>
          <div className="mt-2 text-2xl font-bold">{data?.totals.enterpriseSettings ?? 0}</div>
        </button>
        <button type="button" onClick={() => setTab('audit')} className={`rounded-lg border p-4 text-left ${tab === 'audit' ? 'bg-muted' : 'bg-white'}`}>
          <div className="text-sm text-gray-500">Audit flags</div>
          <div className="mt-2 text-2xl font-bold">{data?.featureFlagAudit.length ?? 0}</div>
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-10 text-center">Chargement...</div>
      ) : !data ? (
        <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
          Données indisponibles. Aucun contenu simulé n'est affiché.
        </div>
      ) : (
        <>
          {tab === 'flags' && (
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category} className="rounded-lg border bg-white">
                  <div className="border-b px-4 py-3 font-semibold">{category}</div>
                  <div className="divide-y">
                    {data.flags.filter((flag) => (flag.category || 'autre') === category).map((flag) => (
                      <div key={flag.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-medium">{flag.name || flag.key}</div>
                          <div className="text-sm text-gray-500">{flag.key}</div>
                          <div className="mt-1 text-xs text-gray-400">
                            Plan min: {flag.min_plan || '—'} · Rollout: {flag.rollout_percentage ?? 0}% · {flag.is_public ? 'Public' : 'Interne'}
                          </div>
                        </div>
                        <Button
                          variant={flag.is_enabled ? 'default' : 'outline'}
                          disabled={actionId === flag.id}
                          onClick={() => void toggleFlag(flag.id, !flag.is_enabled)}
                        >
                          {flag.is_enabled ? 'Activée' : 'Désactivée'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'support' && (
            data.supportTickets.length === 0 ? (
              <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
                Aucun ticket support enregistré.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left">Sujet</th>
                      <th className="p-3 text-left">Email</th>
                      <th className="p-3 text-left">Priorité</th>
                      <th className="p-3 text-left">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.supportTickets.map((ticket) => (
                      <tr key={ticket.id} className="border-t">
                        <td className="p-3">{ticket.subject || 'Sans sujet'}</td>
                        <td className="p-3">{ticket.email || '—'}</td>
                        <td className="p-3">{ticket.priority || '—'}</td>
                        <td className="p-3">
                          <select
                            value={ticket.status || 'open'}
                            disabled={actionId === ticket.id}
                            onChange={(event) => void updateTicket(ticket.id, event.target.value)}
                            className="rounded border px-2 py-1"
                          >
                            <option value="open">open</option>
                            <option value="pending">pending</option>
                            <option value="in_progress">in_progress</option>
                            <option value="resolved">resolved</option>
                            <option value="closed">closed</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'settings' && (
            data.enterpriseSettings.length === 0 ? (
              <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
                Aucun paramètre enterprise global enregistré. Aucune valeur par défaut n'est inventée.
              </div>
            ) : (
              <div className="space-y-3">
                {data.enterpriseSettings.map((setting) => (
                  <div key={setting.id} className="rounded-lg border bg-white p-4">
                    <div className="font-medium">{setting.setting_category} / {setting.setting_key}</div>
                    <div className="mt-1 text-sm text-gray-500">
                      {setting.is_encrypted ? 'Valeur chiffrée' : JSON.stringify(setting.setting_value)}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'audit' && (
            data.featureFlagAudit.length === 0 ? (
              <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
                Aucun changement de feature flag journalisé.
              </div>
            ) : (
              <div className="space-y-3">
                {data.featureFlagAudit.map((entry) => (
                  <div key={entry.id} className="rounded-lg border bg-white p-4">
                    <div className="font-medium">{entry.flag_key || entry.flag_id || 'Flag'}</div>
                    <div className="text-sm text-gray-500">{entry.action || 'action inconnue'} · {new Date(entry.created_at).toLocaleString('fr-FR')}</div>
                  </div>
                ))}
              </div>
            )
          )}

          <div className="text-xs text-gray-500">
            Généré le {new Date(data.generatedAt).toLocaleString('fr-FR')}. Toute modification de feature flag passe par le serveur et est auditée.
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPlatform;
