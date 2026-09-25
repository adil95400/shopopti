import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, sign",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const base64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const verifySignature = async (rawBody: string, secret: string, provided: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );
  const expected = base64(new Uint8Array(signature));
  if (expected.length !== provided.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "Webhook server is not configured" }, 503);
  }

  const rawBody = await req.text();
  let event: Record<string, unknown>;

  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const messageId = typeof event.messageId === "string" ? event.messageId : "";
  const eventType = typeof event.type === "string" ? event.type : "";
  const messageType = typeof event.messageType === "string" ? event.messageType : null;
  const eventOpenId =
    typeof event.openId === "string" || typeof event.openId === "number"
      ? String(event.openId)
      : "";
  const supplierId = new URL(req.url).searchParams.get("supplierId") || "";

  if (!messageId || !eventType || !supplierId) {
    return json({ success: false, error: "Missing CJ webhook identifiers" }, 400);
  }

  const providedSignature = req.headers.get("sign") || "";
  if (!providedSignature) {
    return json({ success: false, error: "Missing CJ webhook signature" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: supplier, error: supplierError } = await admin
    .from("external_suppliers")
    .select("id,user_id,type")
    .eq("id", supplierId)
    .eq("type", "cj_dropshipping")
    .maybeSingle();

  if (supplierError || !supplier) {
    return json({ success: false, error: "Unknown CJ webhook account" }, 404);
  }

  const { data: credentials, error: credentialError } = await admin
    .from("supplier_credentials")
    .select("open_id")
    .eq("supplier_id", supplierId)
    .eq("provider", "cj_dropshipping")
    .maybeSingle();

  const openId = credentials?.open_id ? String(credentials.open_id) : "";
  if (credentialError || !openId) {
    return json({ success: false, error: "CJ webhook signature secret is unavailable" }, 422);
  }

  if (eventOpenId && eventOpenId !== openId) {
    return json({ success: false, error: "CJ webhook account mismatch" }, 401);
  }

  const signatureValid = await verifySignature(
    rawBody,
    openId,
    providedSignature
  );

  if (!signatureValid) {
    return json({ success: false, error: "Invalid CJ webhook signature" }, 401);
  }

  const { error: insertError } = await admin
    .from("cj_webhook_events")
    .insert({
      message_id: messageId,
      supplier_id: supplier.id,
      user_id: supplier.user_id,
      event_type: eventType,
      message_type: messageType,
      payload: event,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return json({ success: true, duplicate: true, messageId });
    }
    return json({ success: false, error: "Webhook event persistence failed" }, 500);
  }

  const params =
    typeof event.params === "object" && event.params !== null
      ? (event.params as Record<string, unknown>)
      : {};

  if (eventType === "STOCK") {
    const stockRows: Array<Record<string, unknown>> = [];

    for (const [variantId, warehousesValue] of Object.entries(params)) {
      if (!Array.isArray(warehousesValue)) continue;
      const stock = warehousesValue.reduce((sum, row) => {
        if (typeof row !== "object" || row === null) return sum;
        const value = Number((row as Record<string, unknown>).storageNum ?? 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);

      stockRows.push({
        user_id: supplier.user_id,
        supplier_id: supplier.id,
        variant_id: variantId,
        stock,
        warehouses: warehousesValue,
        source: "cj_webhook",
        updated_at: new Date().toISOString(),
      });
    }

    if (stockRows.length > 0) {
      await admin
        .from("supplier_variant_stock")
        .upsert(stockRows, { onConflict: "user_id,supplier_id,variant_id" });
    }
  }

  if (eventType === "ORDER" || eventType === "PRIVATE_ORDER") {
    const clientOrderId =
      typeof params.orderNumber === "string"
        ? params.orderNumber
        : typeof params.orderNum === "string"
          ? params.orderNum
          : null;
    const remoteOrderId =
      typeof params.cjOrderId === "string"
        ? params.cjOrderId
        : typeof params.orderId === "string"
          ? params.orderId
          : null;
    const status =
      typeof params.orderStatus === "string"
        ? params.orderStatus
        : typeof params.status === "string"
          ? params.status
          : null;

    if (clientOrderId) {
      await admin
        .from("supplier_order_dispatches")
        .update({
          remote_order_id: remoteOrderId,
          status: status || "updated",
          response_payload: event,
          updated_at: new Date().toISOString(),
        })
        .eq("supplier_id", supplier.id)
        .eq("client_order_id", clientOrderId);
    }
  }

  if (eventType === "LOGISTIC") {
    const storeOrderNumbers = Array.isArray(params.storeOrderNumbers)
      ? params.storeOrderNumbers.filter((value): value is string => typeof value === "string")
      : [];
    const remoteOrderId =
      typeof params.orderId === "string" ? params.orderId : null;
    const trackingNumber =
      typeof params.trackingNumber === "string" ? params.trackingNumber : null;

    for (const clientOrderId of storeOrderNumbers) {
      await admin
        .from("supplier_order_dispatches")
        .update({
          remote_order_id: remoteOrderId,
          status: trackingNumber ? "shipped" : "logistics_updated",
          response_payload: event,
          updated_at: new Date().toISOString(),
        })
        .eq("supplier_id", supplier.id)
        .eq("client_order_id", clientOrderId);
    }
  }

  const processedAt = new Date().toISOString();

  await admin
    .from("cj_webhook_events")
    .update({ processed_at: processedAt })
    .eq("message_id", messageId);

  await admin
    .from("external_suppliers")
    .update({
      webhook_status: "enabled",
      webhook_last_event_at: processedAt,
      last_sync: processedAt,
    })
    .eq("id", supplier.id);

  return json({ success: true, duplicate: false, messageId });
});
