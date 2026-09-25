import { supabase } from '@/lib/supabase';

export interface AdminBillingData {
  generatedAt: string;
  plans: Array<{
    id: string;
    name: string;
    display_name: string | null;
    description: string | null;
    price_monthly: number | string | null;
    price_yearly: number | string | null;
    currency: string | null;
    is_active: boolean | null;
    trial_days: number | null;
    features: unknown;
    limits: unknown;
    stripe_price_id_monthly: string | null;
    stripe_price_id_yearly: string | null;
    stripe_product_id: string | null;
  }>;
  subscriptions: Array<{
    id: string;
    user_id: string | null;
    status: string | null;
    plan_name: string | null;
    plan: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    canceled_at: string | null;
    created_at: string;
    updated_at: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  }>;
  userSubscriptions: Array<{
    id: string;
    user_id: string | null;
    plan_id: string | null;
    status: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    trial_end: string | null;
    billing_cycle: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  overages: Array<Record<string, unknown>>;
  stripeWebhooks: Array<{
    id: string;
    stripe_event_id: string | null;
    event_type: string | null;
    processed: boolean | null;
    created_at: string;
    processed_at: string | null;
  }>;
  totals: {
    subscriptions: number;
    userSubscriptions: number;
    usageEvents: number;
    usageCounters: number;
    overages: number;
    stripeWebhooks: number;
  };
  statusCounts: Record<string, number>;
  userSubscriptionStatusCounts: Record<string, number>;
  overageSummary: {
    amount: number | null;
    currency: string | null;
    verified: boolean;
  };
  webhookSummary: {
    processed: number;
    pending: number;
  };
  derivedMetrics: {
    mrr: number | null;
    arr: number | null;
    churnRate: number | null;
    activePaidSubscribers: number | null;
  };
  billingReadiness: {
    stripeSecretConfigured: boolean;
    stripeWebhookSecretConfigured: boolean;
    appUrlConfigured: boolean;
    activePlans: number;
    fullyMappedPlans: number;
    planMappingsComplete: boolean;
    processedWebhookObserved: boolean;
    canonicalSubscriptionObserved: boolean;
    goldenPathObserved: boolean;
  };
  provenance: Record<string, string>;
  completeness: Record<string, boolean>;
}

export const adminBillingService = {
  async getOverview() {
    const { data, error } = await supabase.functions.invoke('admin-billing', {
      body: { mode: 'overview' },
    });

    if (error) throw new Error(error.message || 'Erreur du service Admin Billing');
    if (data?.error) throw new Error(data.message || data.error);

    return data as AdminBillingData;
  },
};
