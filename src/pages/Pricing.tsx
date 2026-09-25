import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { supabase } from '@/lib/supabase';
import PricingCard from '@/components/stripe/PricingCard';

const plans = [
  {
    title: 'Freemium',
    plan: null,
    price: '0 €',
    description: 'Pour découvrir ShopOpti.',
    features: ['Fonctions essentielles', 'Accès limité', 'Support communautaire']
  },
  {
    title: 'Standard',
    plan: 'standard',
    price: '29 €/mois',
    description: 'Pour démarrer avec fournisseurs, synchronisation et analytics.',
    features: ['Fournisseurs', 'Synchronisation basique', 'Analytics basiques']
  },
  {
    title: 'Pro',
    plan: 'pro',
    price: '79 €/mois',
    description: 'Pour automatiser et piloter plusieurs flux.',
    features: ['Webhooks', 'Automation', 'Synchronisation avancée', 'Analytics avancés'],
    popular: true
  },
  {
    title: 'Ultra Pro',
    plan: 'ultra_pro',
    price: '199 €/mois',
    description: 'Pour les opérations avancées et le white-label.',
    features: ['White-label', 'Automation complète', 'Synchronisation avancée', 'Analytics premium']
  }
];

const Pricing: React.FC = () => {
  const [currentPlan, setCurrentPlan] = useState<string>('free');

  useEffect(() => {
    const fetchSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('status,subscription_plans(name)')
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return;
      }

      const plan = Array.isArray(data?.subscription_plans)
        ? data?.subscription_plans[0]
        : data?.subscription_plans;

      if (data?.status === 'active' || data?.status === 'trialing') {
        setCurrentPlan(plan?.name ?? 'free');
      }
    };

    void fetchSubscription();
  }, []);

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
            Le checkout Stripe utilise les Price IDs configurés côté serveur.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <PricingCard
              key={plan.title}
              title={plan.title}
              price={plan.price}
              description={plan.description}
              features={plan.features}
              plan={plan.plan}
              current={currentPlan === (plan.plan ?? 'free')}
              popular={plan.popular}
            />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Les abonnements payants restent indisponibles tant que les Price IDs Stripe ne sont pas configurés côté serveur.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
