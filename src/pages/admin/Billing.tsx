import React, { useEffect, useState } from 'react';
import { CreditCard, RefreshCw, Users, Webhook, Gauge } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useRole } from '@/context/RoleContext';
import { adminBillingService, type AdminBillingData } from '@/services/adminBillingService';
import { Button } from '@/components/ui/button';

const money = (value: number | string | null, currency: string | null) => {
  if (value === null || !currency) return 'Non vérifié';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(value));
};

const AdminBilling: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const [data, setData] = useState<AdminBillingData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      setData(await adminBillingService.getOverview());
    } catch (error) {
      console.error('Error loading Admin Billing:', error);
      toast.error(error instanceof Error ? error.message : 'Impossible de charger Admin Billing');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  if (roleLoading) return <div className="flex justify-center p-8">Chargement...</div>;
  if (!isAdmin) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Billing</h1>
          <p className="text-gray-500">Plans, abonnements, usage et événements Stripe vérifiés</p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-10 text-center">Chargement...</div>
      ) : !data ? (
        <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
          Données Billing indisponibles. Aucun chiffre simulé n'est affiché.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between text-sm text-gray-500"><span>Abonnements</span><Users className="h-4 w-4" /></div>
              <div className="mt-2 text-2xl font-bold">{data.totals.subscriptions}</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between text-sm text-gray-500"><span>Usage events</span><Gauge className="h-4 w-4" /></div>
              <div className="mt-2 text-2xl font-bold">{data.totals.usageEvents}</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between text-sm text-gray-500"><span>Webhooks Stripe</span><Webhook className="h-4 w-4" /></div>
              <div className="mt-2 text-2xl font-bold">{data.totals.stripeWebhooks}</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between text-sm text-gray-500"><span>MRR</span><CreditCard className="h-4 w-4" /></div>
              <div className="mt-2 text-2xl font-bold">
                {money(data.derivedMetrics.mrr, data.plans[0]?.currency ?? 'EUR')}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold">Plans configurés</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {data.plans.map((plan) => (
                <div key={plan.id} className="rounded-lg border p-4">
                  <div className="font-semibold">{plan.display_name || plan.name}</div>
                  <div className="mt-2 text-2xl font-bold">{money(plan.price_monthly, plan.currency)}<span className="text-sm font-normal text-gray-500"> / mois</span></div>
                  <div className="mt-1 text-sm text-gray-500">{money(plan.price_yearly, plan.currency)} / an</div>
                  <div className="mt-2 text-sm">{plan.is_active ? 'Actif' : 'Inactif'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold">Abonnements réels</h2>
              {data.subscriptions.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Aucun abonnement enregistré.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.subscriptions.map((sub) => (
                    <div key={sub.id} className="rounded border p-3 text-sm">
                      <div className="font-medium">{sub.plan_name || sub.plan || 'Plan inconnu'}</div>
                      <div className="text-gray-500">{sub.status || 'statut inconnu'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold">Stripe webhooks</h2>
              <div className="mt-3 text-sm text-gray-500">
                Traités : {data.webhookSummary.processed} · En attente : {data.webhookSummary.pending}
              </div>
              {data.stripeWebhooks.length === 0 && (
                <p className="mt-3 text-sm text-gray-500">Aucun webhook Stripe enregistré.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold">Préparation Stripe</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ['Secret Stripe', data.billingReadiness.stripeSecretConfigured],
                ['Secret webhook', data.billingReadiness.stripeWebhookSecretConfigured],
                ['APP_URL', data.billingReadiness.appUrlConfigured],
                [
                  `Mapping plans (${data.billingReadiness.fullyMappedPlans}/${data.billingReadiness.activePlans})`,
                  data.billingReadiness.planMappingsComplete
                ],
                ['Webhook traité observé', data.billingReadiness.processedWebhookObserved],
                ['Abonnement canonique observé', data.billingReadiness.canonicalSubscriptionObserved]
              ].map(([label, ok]) => (
                <div key={String(label)} className="flex items-center justify-between rounded border p-3 text-sm">
                  <span>{String(label)}</span>
                  <span className={ok ? 'text-green-700' : 'text-amber-700'}>
                    {ok ? 'OK' : 'À configurer'}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Golden path observé : {data.billingReadiness.goldenPathObserved ? 'oui' : 'non'}.
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold">Métriques dérivées</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-gray-500">MRR</div>
                <div className="font-semibold">
                  {money(data.derivedMetrics.mrr, data.plans[0]?.currency ?? 'EUR')}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">ARR</div>
                <div className="font-semibold">
                  {money(data.derivedMetrics.arr, data.plans[0]?.currency ?? 'EUR')}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Churn</div>
                <div className="font-semibold">
                  {data.derivedMetrics.churnRate === null
                    ? 'Non vérifié'
                    : `${data.derivedMetrics.churnRate.toFixed(1)} %`}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Abonnés payants actifs</div>
                <div className="font-semibold">
                  {data.derivedMetrics.activePaidSubscribers ?? 'Non vérifié'}
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-amber-700">
              MRR/ARR restent « Non vérifié » tant qu'un webhook Stripe signé n'a pas été observé avec au moins un abonnement canonique. Le churn reste non calculé faute d'historique fiable de résiliation.
            </p>
          </div>

          <div className="text-xs text-gray-500">
            Généré le {new Date(data.generatedAt).toLocaleString('fr-FR')}. Stripe Live API n'est pas interrogée depuis cette page.
          </div>
        </>
      )}
    </div>
  );
};

export default AdminBilling;
