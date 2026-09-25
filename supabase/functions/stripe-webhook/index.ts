import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import Stripe from "npm:stripe@22.0.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const toIso = (seconds: number | null | undefined) =>
  typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;

const canonicalStatus = (
  status: Stripe.Subscription.Status,
): "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused" => {
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "unpaid") return "unpaid";
  if (status === "paused") return "paused";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "past_due";
};

const legacyStatus = (status: Stripe.Subscription.Status) => {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  if (status === "paused") return "paused";
  if (status === "canceled" || status === "incomplete_expired") return "cancelled";
  return "inactive";
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey || !webhookSecret) {
    return json({ error: "billing_not_configured" }, 503);
  }

  const signature = req.headers.get("stripe-signature") ?? "";
  if (!signature) return json({ error: "missing_stripe_signature" }, 400);

  const stripe = new Stripe(stripeSecretKey);
  const cryptoProvider = Stripe.createSubtleCryptoProvider();
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error("stripe signature verification failed", error);
    return json({ error: "invalid_stripe_signature" }, 400);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingEvent, error: existingError } = await service
    .from("stripe_webhooks")
    .select("id,processed")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existingError) {
    console.error("stripe webhook idempotency lookup failed", existingError);
    return json({ error: "webhook_store_failed" }, 500);
  }

  if (existingEvent?.processed === true) {
    return json({ received: true, duplicate: true });
  }

  if (!existingEvent) {
    const object = event.data.object as { id?: string };
    const { error: insertError } = await service.from("stripe_webhooks").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      processed: false,
      data: {
        object_id: object.id ?? null,
        livemode: event.livemode,
      },
    });

    if (insertError?.code === "23505") {
      return json({ received: true, duplicate: true, processing: true });
    }

    if (insertError) {
      console.error("stripe webhook insert failed", insertError);
      return json({ error: "webhook_store_failed" }, 500);
    }
  }

  const syncSubscription = async (
    stripeSubscriptionId: string,
    fallback: Record<string, string> = {},
  ) => {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const metadata = { ...fallback, ...subscription.metadata };
    const userId = metadata.user_id ?? "";
    const planIdFromMetadata = metadata.plan_id ?? "";
    const billingCycle = metadata.billing_cycle === "yearly" ? "yearly" : "monthly";
    const priceId = subscription.items.data[0]?.price?.id ?? null;

    if (!userId) throw new Error("missing_user_id_metadata");

    const { data: plans, error: plansError } = await service
      .from("subscription_plans")
      .select(
        "id,name,stripe_price_id_monthly,stripe_price_id_yearly,is_active",
      )
      .eq("is_active", true);

    if (plansError) throw plansError;

    const plan =
      plans?.find((row) => row.id === planIdFromMetadata) ??
      plans?.find(
        (row) =>
          row.stripe_price_id_monthly === priceId ||
          row.stripe_price_id_yearly === priceId,
      );

    if (!plan) throw new Error("subscription_plan_not_found");

    const periodStart = toIso(subscription.current_period_start);
    const periodEnd = toIso(subscription.current_period_end);
    const trialEnd = toIso(subscription.trial_end);
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const { error: canonicalError } = await service
      .from("user_subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_id: plan.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: canonicalStatus(subscription.status),
          current_period_start: periodStart,
          current_period_end: periodEnd,
          trial_end: trialEnd,
          billing_cycle: billingCycle,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (canonicalError) throw canonicalError;

    const { error: legacyError } = await service
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: legacyStatus(subscription.status),
          plan_name: plan.name,
          plan: plan.name,
          price_id: priceId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end,
          canceled_at: toIso(subscription.canceled_at),
          metadata: {
            source: "stripe-webhook",
            billing_cycle: billingCycle,
            stripe_status: subscription.status,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );

    if (legacyError) throw legacyError;

    const profileStatus =
      subscription.status === "active" || subscription.status === "trialing"
        ? subscription.status
        : canonicalStatus(subscription.status);

    const { error: profileError } = await service
      .from("profiles")
      .update({
        plan: plan.name,
        subscription_plan: plan.name,
        subscription_status: profileStatus,
        subscription_expires_at: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) throw profileError;
  };

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (subscriptionId) {
        await syncSubscription(subscriptionId, {
          user_id: session.metadata?.user_id ?? session.client_reference_id ?? "",
          plan_id: session.metadata?.plan_id ?? "",
          billing_cycle: session.metadata?.billing_cycle ?? "monthly",
        });
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.paused" ||
      event.type === "customer.subscription.resumed"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription.id);
    } else if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
      if (subscriptionId) await syncSubscription(subscriptionId);
    }

    const { error: markError } = await service
      .from("stripe_webhooks")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", event.id);

    if (markError) throw markError;

    return json({ received: true });
  } catch (error) {
    console.error("stripe webhook processing failed", event.id, error);
    return json({ error: "webhook_processing_failed" }, 500);
  }
});
