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

  if (!customerId) return json({ error: "stripe_customer_not_found" }, 404);

  const stripe = new Stripe(stripeSecretKey);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/app/subscription`,
    });

    return json({ url: session.url });
  } catch (error) {
    console.error("stripe-customer-portal failed", error);
    return json({ error: "stripe_portal_failed" }, 502);
  }
});
