import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import Stripe from "npm:stripe@22.0.0";

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

const bearer = (req: Request) => {
  const value = req.headers.get("Authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey || !appUrl) {
    return json({ error: "billing_not_configured" }, 503);
  }

  const token = bearer(req);
  if (!token) return json({ error: "missing_authorization" }, 401);

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await service.auth.getUser(token);

  if (userError || !user) return json({ error: "invalid_session" }, 401);

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const planName = typeof payload.plan === "string" ? payload.plan.trim() : "";
  const billingCycle = payload.billing_cycle === "yearly" ? "yearly" : "monthly";

  if (!planName) return json({ error: "missing_plan" }, 400);

  const { data: plan, error: planError } = await service
    .from("subscription_plans")
    .select(
      "id,name,display_name,is_active,stripe_price_id_monthly,stripe_price_id_yearly",
    )
    .eq("name", planName)
    .eq("is_active", true)
    .maybeSingle();

  if (planError) {
    console.error("stripe-checkout plan lookup failed", planError);
    return json({ error: "plan_lookup_failed" }, 500);
  }

  if (!plan) return json({ error: "plan_not_found" }, 404);

  const priceId =
    billingCycle === "yearly"
      ? plan.stripe_price_id_yearly
      : plan.stripe_price_id_monthly;

  if (!priceId) {
    return json(
      {
        error: "stripe_price_not_configured",
        plan: plan.name,
        billing_cycle: billingCycle,
      },
      409,
    );
  }

  const [{ data: canonicalSubscription }, { data: legacySubscriptions }] =
    await Promise.all([
      service
        .from("user_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      service
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  const customerId =
    canonicalSubscription?.stripe_customer_id ??
    legacySubscriptions?.[0]?.stripe_customer_id ??
    null;

  const stripe = new Stripe(stripeSecretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cancel`,
      client_reference_id: user.id,
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : user.email ?? undefined,
      allow_promotion_codes: true,
      metadata: {
        user_id: user.id,
        plan_id: plan.id,
        plan_name: plan.name,
        billing_cycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: plan.id,
          plan_name: plan.name,
          billing_cycle: billingCycle,
        },
      },
    });

    if (!session.url) {
      return json({ error: "stripe_checkout_url_missing" }, 502);
    }

    return json({
      url: session.url,
      session_id: session.id,
      plan: plan.name,
      billing_cycle: billingCycle,
    });
  } catch (error) {
    console.error("stripe-checkout failed", error);
    return json({ error: "stripe_checkout_failed" }, 502);
  }
});
