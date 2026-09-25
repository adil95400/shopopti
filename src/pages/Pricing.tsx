import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import { supabase } from '@/lib/supabase';
import PricingCard from '@/components/stripe/PricingCard';
import type { BillingCycle } from '@/lib/stripe';

interface PaidPlan {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  price_monthly: number | string | null;
  price_yearly: number | string | null;
  currency: string | null;
  features: Record<string, unknown> | null;
  limits: Record<string, unknown> | null;
}

const featureLabels: Record<string, string> = {
  suppliers: 'Fournisseurs',
  basic_sync: 'Synchronisation basique',
  basic_analytics: 'Analytics basiques',
  webhooks: 'Webhooks',
  automation: 'Automation',
  advanced_sync: 'Synchronisation avancée',
  advanced_analytics: 'Analytics avancés',
  white_label: 'White-label',
  full_automation: 'Automation complète',
  premium_analytics: 'Analytics premium'
};

const formatMoney = (
  value: number | string | null,
  currency: string | null,
  cycle: BillingCycle
) => {
  if (value === null) return 'Non configuré';

  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Non configuré';

  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency ?? 'EUR',
    maximumFractionDigits: 2
  }).format(amount);

  return `${formatted}/${cycle === 'yearly' ? 'an' : 'mois'}`;
};

const Pricing: React.FC = () => {
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [paidPlans, setPaidPlans] = useState<PaidPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select(
            'id,name,display_name,description,price_monthly,price_yearly,currency,features,limits'
          )
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });

        if (error) throw error;
        setPaidPlans((data ?? []) as PaidPlan[]);
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
        setPaidPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };

    void fetchPlans();
  }, []);

  useEffect(() => {
    const fetchSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('status,stripe_subscription_id,subscription_plans(name)')
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return;
      }

      const plan = Array.isArray(data?.subscription_plans)
        ? data?.subscription_plans[0]
        : data?.subscription_plans;

      const managedStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid']);

      if (data?.stripe_subscription_id && managedStatuses.has(data.status ?? '')) {
        setHasSubscription(true);
      }

      if (data?.status === 'active' || data?.status === 'trialing') {
        setCurrentPlan(plan?.name ?? 'free');
      }
    };

    void fetchSubscription();
  }, []);

  const cards = useMemo(() => {
    const freeCard = {
      id: 'free',
      title: 'Freemium',
      plan: null,
      price: '0 €',
      description: 'Pour découvrir ShopOpti.',
      features: ['Fonctions essentielles', 'Accès limité', 'Support communautaire'],
      popular: false
    };

    const paidCards = paidPlans.map((plan) => {
      const features = Object.entries(plan.features ?? {})
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => featureLabels[key] ?? key.replaceAll('_', ' '));

      const monthly = Number(plan.price_monthly);
      const yearly = Number(plan.price_yearly);
      const savings =
        Number.isFinite(monthly) &&
        Number.isFinite(yearly) &&
        monthly > 0 &&
        yearly >= 0 &&
        yearly < monthly * 12
          ? monthly * 12 - yearly
          : 0;

      const descriptionParts = [
        plan.description || 'Plan ShopOpti avec facturation Stripe sécurisée.'
      ];

      if (billingCycle === 'yearly' && savings > 0) {
        descriptionParts.push(
          `Économie annuelle : ${new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: plan.currency ?? 'EUR'
          }).format(savings)}`
        );
      }

      return {
        id: plan.id,
        title: plan.display_name || plan.name,
        plan: plan.name,
        price: formatMoney(
          billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly,
          plan.currency,
          billingCycle
        ),
        description: descriptionParts.join(' '),
        features,
        popular: plan.name === 'pro'
      };
    });

    return [freeCard, ...paidCards];
  }, [billingCycle, paidPlans]);

  return (
    <div className="bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-gray-900">Choisissez votre plan</h1>
          <p className="mt-4 text-xl text-gray-600">
            Tarifs et cycles chargés depuis la configuration serveur ShopOpti.
          </p>

          <div className="mt-6 inline-flex rounded-lg border bg-white p-1">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                billingCycle === 'monthly'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                billingCycle === 'yearly'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annuel
            </button>
          </div>
        </motion.div>

        {plansLoading ? (
          <div className="mt-12 rounded-lg border bg-white p-10 text-center text-gray-500">
            Chargement des plans...
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((plan) => (
              <PricingCard
                key={plan.id}
                title={plan.title}
                price={plan.price}
                description={plan.description}
                features={plan.features}
                plan={plan.plan}
                billingCycle={billingCycle}
                current={currentPlan === (plan.plan ?? 'free')}
                hasSubscription={hasSubscription}
                popular={plan.popular}
              />
            ))}
          </div>
        )}

        {!plansLoading && paidPlans.length === 0 && (
          <p className="mt-8 text-center text-sm text-amber-700">
            Les plans payants sont momentanément indisponibles car leur configuration serveur n’a pas pu être chargée.
          </p>
        )}

        <p className="mt-8 text-center text-sm text-gray-500">
          Le paiement est ouvert uniquement lorsqu’un Price ID Stripe correspondant est configuré côté serveur.
          Les abonnés existants changent de plan, de moyen de paiement ou résilient depuis le portail de facturation sécurisé.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
