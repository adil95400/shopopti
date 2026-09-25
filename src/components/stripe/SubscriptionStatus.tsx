import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  CreditCard,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCustomerPortalLink } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

interface SubscriptionRow {
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  billing_cycle: string | null;
  stripe_subscription_id: string | null;
  subscription_plans:
    | {
        name: string;
        display_name: string | null;
        features: Record<string, unknown> | null;
      }
    | Array<{
        name: string;
        display_name: string | null;
        features: Record<string, unknown> | null;
      }>
    | null;
}

const formatFeature = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/^./, (value) => value.toUpperCase());

const SubscriptionStatus: React.FC = () => {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [managingSubscription, setManagingSubscription] = useState(false);

  const fetchSubscription = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(
          'status,current_period_start,current_period_end,trial_end,billing_cycle,stripe_subscription_id,subscription_plans(name,display_name,features)'
        )
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
        return;
      }

      setSubscription((data as SubscriptionRow | null) ?? null);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSubscription();
  }, []);

  const handleManageSubscription = async () => {
    try {
      setManagingSubscription(true);
      const url = await getCustomerPortalLink();
      window.location.assign(url);
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Impossible d’ouvrir le portail Stripe.'
      );
    } finally {
      setManagingSubscription(false);
    }
  };

  const plan = Array.isArray(subscription?.subscription_plans)
    ? subscription?.subscription_plans[0]
    : subscription?.subscription_plans;

  const active =
    subscription?.status === 'active' || subscription?.status === 'trialing';

  const features = Object.entries(plan?.features ?? {})
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => formatFeature(key));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-gray-900">
              {plan?.display_name || plan?.name || 'Plan gratuit'}
            </h3>
            {subscription?.status && (
              <Badge variant={active ? 'success' : 'warning'}>
                {subscription.status}
              </Badge>
            )}
          </div>
          {subscription?.billing_cycle && (
            <p className="mt-1 text-sm text-gray-500">
              Facturation {subscription.billing_cycle === 'yearly' ? 'annuelle' : 'mensuelle'}
            </p>
          )}
        </div>

        {subscription?.stripe_subscription_id && (
          <Button
            onClick={handleManageSubscription}
            disabled={managingSubscription}
          >
            {managingSubscription ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Chargement...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Gérer la facturation
              </>
            )}
          </Button>
        )}
      </div>

      {subscription?.stripe_subscription_id ? (
        <div className="mt-4 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 text-sm font-medium text-gray-700">
                Détails de l’abonnement
              </h4>
              <div className="space-y-4">
                <div className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Période actuelle</p>
                    <p className="text-sm font-medium text-gray-900">
                      {subscription.current_period_start
                        ? new Date(subscription.current_period_start).toLocaleDateString('fr-FR')
                        : '—'}{' '}
                      –{' '}
                      {subscription.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR')
                        : '—'}
                    </p>
                  </div>
                </div>

                {active && (
                  <div className="flex items-start rounded-md bg-green-50 p-4">
                    <CheckCircle className="mr-2 mt-0.5 h-5 w-5 text-green-500" />
                    <div>
                      <h4 className="text-sm font-medium text-green-800">
                        Abonnement actif
                      </h4>
                      <p className="mt-1 text-sm text-green-700">
                        Les droits sont synchronisés depuis Stripe par webhook signé.
                      </p>
                    </div>
                  </div>
                )}

                {subscription.status === 'past_due' && (
                  <div className="flex items-start rounded-md bg-yellow-50 p-4">
                    <AlertTriangle className="mr-2 mt-0.5 h-5 w-5 text-yellow-500" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">
                        Paiement en retard
                      </h4>
                      <p className="mt-1 text-sm text-yellow-700">
                        Mettez à jour votre moyen de paiement dans le portail Stripe.
                      </p>
                    </div>
                  </div>
                )}

                {subscription.status === 'unpaid' && (
                  <div className="flex items-start rounded-md bg-red-50 p-4">
                    <AlertTriangle className="mr-2 mt-0.5 h-5 w-5 text-red-500" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800">
                        Paiement non réglé
                      </h4>
                      <p className="mt-1 text-sm text-red-700">
                        La facturation nécessite une action. Ouvrez le portail Stripe pour vérifier vos factures et votre moyen de paiement.
                      </p>
                    </div>
                  </div>
                )}

                {subscription.status === 'paused' && (
                  <div className="flex items-start rounded-md bg-blue-50 p-4">
                    <AlertTriangle className="mr-2 mt-0.5 h-5 w-5 text-blue-500" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-800">
                        Abonnement en pause
                      </h4>
                      <p className="mt-1 text-sm text-blue-700">
                        La facturation est en pause. Ouvrez le portail Stripe pour consulter ou reprendre l’abonnement lorsque cette option est disponible.
                      </p>
                    </div>
                  </div>
                )}

                {subscription.status === 'canceled' && (
                  <div className="flex items-start rounded-md bg-gray-50 p-4">
                    <AlertTriangle className="mr-2 mt-0.5 h-5 w-5 text-gray-500" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-800">
                        Abonnement résilié
                      </h4>
                      <p className="mt-1 text-sm text-gray-600">
                        Cet abonnement n’est plus actif. Vous pouvez comparer les plans disponibles pour vous réabonner.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-medium text-gray-700">
                Fonctionnalités du plan
              </h4>
              <div className="space-y-2">
                {features.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Aucune fonctionnalité détaillée disponible.
                  </p>
                ) : (
                  features.map((feature) => (
                    <div key={feature} className="flex items-start">
                      <CheckCircle className="mr-2 mt-0.5 h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6">
                <Button asChild variant="outline">
                  <Link to="/pricing">Comparer les plans</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <CreditCard className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Aucun abonnement payant
          </h3>
          <p className="mx-auto mt-2 max-w-md text-gray-500">
            Vous utilisez actuellement le plan gratuit.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link to="/pricing">Voir les plans</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatus;
