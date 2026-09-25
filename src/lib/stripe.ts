import { loadStripe } from '@stripe/stripe-js';

import { supabase } from './supabase';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const getStripe = () => stripePromise;

export type BillingCycle = 'monthly' | 'yearly';

export const createCheckoutSession = async (
  plan: string,
  billingCycle: BillingCycle = 'monthly'
) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: {
      plan,
      billing_cycle: billingCycle,
    },
  });

  if (error) {
    throw new Error(error.message || 'Unable to start Stripe Checkout');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.url) {
    throw new Error('Stripe Checkout URL missing');
  }

  return {
    url: data.url as string,
    sessionId: data.session_id as string,
  };
};

export const getCustomerPortalLink = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
    body: {},
  });

  if (error) {
    throw new Error(error.message || 'Unable to open Stripe Customer Portal');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.url) {
    throw new Error('Stripe Customer Portal URL missing');
  }

  return data.url as string;
};
