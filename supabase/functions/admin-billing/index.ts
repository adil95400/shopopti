import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBearerToken = (req: Request) => {
  const auth = req.headers.get("Authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 500);

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = getBearerToken(req);
  if (!token) return json({ error: "missing_authorization" }, 401);

  const { data: { user: actor }, error: actorError } = await service.auth.getUser(token);
  if (actorError || !actor) return json({ error: "invalid_session" }, 401);

  const { data: adminRole, error: roleError } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", actor.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) return json({ error: "authorization_check_failed" }, 500);
  if (!adminRole) return json({ error: "forbidden" }, 403);

  try {
    const [
      plansResult,
      subscriptionsResult,
      userSubscriptionsResult,
      usageEventsResult,
      usageCountersResult,
      overagesResult,
      stripeWebhooksResult,
    ] = await Promise.all([
      service
        .from("subscription_plans")
        .select("id,name,display_name,description,price_monthly,price_yearly,currency,is_active,trial_days,features,limits")
        .order("price_monthly", { ascending: true }),
      service
        .from("subscriptions")
        .select("id,user_id,status,plan_name,plan,current_period_start,current_period_end,cancel_at_period_end,canceled_at,created_at,updated_at,stripe_customer_id,stripe_subscription_id")
        .order("created_at", { ascending: false })
        .limit(100),
      service
        .from("user_subscriptions")
        .select("id,user_id,plan_id,status,current_period_start,current_period_end,trial_end,billing_cycle,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(100),
      service.from("usage_events").select("id", { count: "exact", head: true }),
      service.from("usage_counters").select("id", { count: "exact", head: true }),
      service
        .from("billing_overages")
        .select("id,user_id,quota_key,action_type,quantity,amount_cents,currency,plan_name,status,period_start,period_end,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      service
        .from("stripe_webhooks")
        .select("id,stripe_event_id,event_type,processed,created_at,processed_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    for (const result of [
      plansResult,
      subscriptionsResult,
      userSubscriptionsResult,
      usageEventsResult,
      usageCountersResult,
      overagesResult,
      stripeWebhooksResult,
    ]) {
      if (result.error) throw result.error;
    }

    const plans = plansResult.data ?? [];
    const subscriptions = subscriptionsResult.data ?? [];
    const userSubscriptions = userSubscriptionsResult.data ?? [];
    const overages = overagesResult.data ?? [];
    const stripeWebhooks = stripeWebhooksResult.data ?? [];

    const statusCounts = subscriptions.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.status ?? "unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const userSubscriptionStatusCounts = userSubscriptions.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.status ?? "unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const overageCurrency = Array.from(
      new Set(overages.map((row) => String(row.currency ?? "").trim()).filter(Boolean)),
    );
    const singleOverageCurrency = overageCurrency.length === 1 ? overageCurrency[0] : null;
    const overageAmount =
      singleOverageCurrency === null
        ? null
        : overages.reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0) / 100;

    const processedWebhookCount = stripeWebhooks.filter((row) => row.processed === true).length;
    const pendingWebhookCount = stripeWebhooks.filter((row) => row.processed !== true).length;

    return json({
      generatedAt: new Date().toISOString(),
      plans,
      subscriptions,
      userSubscriptions,
      overages,
      stripeWebhooks,
      totals: {
        subscriptions: subscriptions.length,
        userSubscriptions: userSubscriptions.length,
        usageEvents: usageEventsResult.count ?? 0,
        usageCounters: usageCountersResult.count ?? 0,
        overages: overages.length,
        stripeWebhooks: stripeWebhooks.length,
      },
      statusCounts,
      userSubscriptionStatusCounts,
      overageSummary: {
        amount: overageAmount,
        currency: singleOverageCurrency,
        verified: singleOverageCurrency !== null,
      },
      webhookSummary: {
        processed: processedWebhookCount,
        pending: pendingWebhookCount,
      },
      derivedMetrics: {
        mrr: null,
        arr: null,
        churnRate: null,
        activePaidSubscribers: null,
      },
      provenance: {
        plans: "public.subscription_plans",
        subscriptions: "public.subscriptions",
        userSubscriptions: "public.user_subscriptions",
        usageEvents: "public.usage_events",
        usageCounters: "public.usage_counters",
        overages: "public.billing_overages",
        stripeWebhooks: "public.stripe_webhooks",
      },
      completeness: {
        stripeLiveApiQueried: false,
        invoicesIncluded: false,
        chargesIncluded: false,
        mrrDerivableFromCurrentTables: false,
      },
    });
  } catch (error) {
    console.error("admin-billing error", error);
    return json(
      {
        error: "admin_billing_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
