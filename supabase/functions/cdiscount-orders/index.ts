import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

import { decryptSecretPayload } from "../_shared/secretEnvelope.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const API_BASE = "https://api.octopia-io.net/seller/v2";
const TOKEN_URL =
  "https://auth.octopia-io.net/auth/realms/maas/protocol/openid-connect/token";

type Action =
  | "list_orders"
  | "count_orders"
  | "get_order"
  | "approve_order"
  | "ship_order"
  | "list_carriers";

type Parcel = {
  parcelNumber?: string;
  carrierName?: string;
  trackingUrl?: string;
  orderLineIds?: string[];
};

type OrderRequest = {
  action?: Action;
  orderId?: string;
  pageIndex?: number;
  pageSize?: number;
  status?: string;
  supplyMode?: string;
  salesChannelId?: string;
  reference?: string;
  createdAtMin?: string;
  createdAtMax?: string;
  updatedAtMin?: string;
  updatedAtMax?: string;
  shippedAtMin?: string;
  shippedAtMax?: string;
  sort?: string;
  desc?: string;
  approvalStatus?: "Accepted" | "Refused";
  parcels?: Parcel[];
  idempotencyKey?: string;
};

type SecretEnvelope = {
  v: number;
  alg: "AES-GCM";
  iv: string;
  ciphertext: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readKeySet(name: string): string {
  const raw = Deno.env.get(name);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default || Object.values(parsed)[0] || "";
  } catch {
    return raw;
  }
}

function getPublishableKey(): string {
  return Deno.env.get("SUPABASE_ANON_KEY") ||
    readKeySet("SUPABASE_PUBLISHABLE_KEYS");
}

function getServerKey(): string {
  return readKeySet("SUPABASE_SECRET_KEYS") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serverKey = getServerKey();
  if (!supabaseUrl || !serverKey) {
    throw new Error("Supabase server configuration unavailable");
  }
  return createClient(supabaseUrl, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAuthenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { user: null, error: "Authentication required" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey) {
    return { user: null, error: "Supabase auth configuration unavailable" };
  }

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authorization.slice("Bearer ".length);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) {
    return { user: null, error: "Invalid or expired session" };
  }

  return { user, error: null };
}

async function loadCredentials(userId: string) {
  const admin = getAdminClient();
  const encryptionKey = Deno.env.get("CDISCOUNT_CREDENTIALS_ENCRYPTION_KEY") || "";
  if (!encryptionKey) {
    throw new Error("Secure Cdiscount credentials are not configured");
  }

  const { data, error } = await admin
    .from("integrations")
    .select("encrypted_credentials, seller_id, connection_status, is_active")
    .eq("user_id", userId)
    .eq("platform_type", "cdiscount")
    .maybeSingle();

  if (error) throw new Error("Cdiscount integration lookup failed");
  if (!data || !data.is_active || data.connection_status !== "connected") {
    throw new Error("Cdiscount is not connected");
  }

  const envelope = data.encrypted_credentials as SecretEnvelope | null;
  if (!envelope) throw new Error("Cdiscount credentials are missing");

  const credentials = await decryptSecretPayload(envelope, encryptionKey);
  const clientId = credentials.clientId?.trim();
  const clientSecret = credentials.clientSecret?.trim();
  const sellerId = (credentials.sellerId || data.seller_id || "").trim();

  if (!clientId || !clientSecret || !sellerId) {
    throw new Error("Cdiscount credentials are incomplete");
  }

  return { clientId, clientSecret, sellerId };
}

async function getOctopiaToken(clientId: string, clientSecret: string) {
  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("grant_type", "client_credentials");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  const token = typeof body.access_token === "string" ? body.access_token : null;

  if (!response.ok || !token) {
    throw new Error(
      response.status === 401
        ? "Octopia rejected the stored credentials"
        : "Octopia token request failed",
    );
  }

  return token;
}

function octopiaHeaders(
  token: string,
  sellerId: string,
  extra: Record<string, string> = {},
) {
  return {
    Authorization: `Bearer ${token}`,
    SellerId: sellerId,
    Accept: "application/json",
    ...extra,
  };
}

async function parseResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Octopia denied access to this seller");
    }
    if (response.status === 404) {
      throw new Error("Octopia order not found");
    }
    if (response.status === 429) {
      throw new Error("Octopia rate limit reached");
    }
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as Record<string, unknown>).detail)
        : null;
    throw new Error(detail || `Octopia request failed (${response.status})`);
  }
  return body;
}

async function sha256(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function reserveMutation(
  userId: string,
  action: string,
  idempotencyKey: string,
  requestFingerprint: string,
) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("publication_logs")
    .insert({
      user_id: userId,
      channel_type: "marketplace",
      channel_id: "cdiscount",
      channel_name: "Cdiscount / Octopia",
      action,
      status: "in_progress",
      idempotency_key: idempotencyKey,
      metadata: { request_fingerprint: requestFingerprint },
    })
    .select("id, status, external_id, error_message, metadata")
    .single();

  if (!error) return { admin, log: data, replayed: false };
  if (error.code !== "23505") {
    throw new Error("Cdiscount idempotency ledger reservation failed");
  }

  const { data: existing, error: existingError } = await admin
    .from("publication_logs")
    .select("id, status, external_id, error_message, metadata")
    .eq("user_id", userId)
    .eq("channel_id", "cdiscount")
    .eq("action", action)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingError || !existing) {
    throw new Error("Cdiscount idempotency ledger lookup failed");
  }

  const existingFingerprint = existing.metadata?.request_fingerprint;
  if (existingFingerprint && existingFingerprint !== requestFingerprint) {
    throw new Error("Idempotency key was already used with a different payload");
  }

  return { admin, log: existing, replayed: true };
}

async function completeMutation(
  admin: ReturnType<typeof getAdminClient>,
  logId: string,
  externalId: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await admin
    .from("publication_logs")
    .update({
      status: "success",
      external_id: externalId,
      error_message: null,
      metadata,
    })
    .eq("id", logId);

  if (error) throw new Error("Cdiscount idempotency ledger completion failed");
}

async function markAmbiguous(
  admin: ReturnType<typeof getAdminClient>,
  logId: string,
  errorMessage: string,
) {
  await admin
    .from("publication_logs")
    .update({ status: "ambiguous", error_message: errorMessage })
    .eq("id", logId);
}

async function getOrder(token: string, sellerId: string, orderId: string) {
  const response = await fetch(
    `${API_BASE}/orders/${encodeURIComponent(orderId)}`,
    { headers: octopiaHeaders(token, sellerId) },
  );
  return await parseResponse(response) as Record<string, unknown>;
}

function addOptional(params: URLSearchParams, key: string, value?: string) {
  if (value?.trim()) params.set(key, value.trim());
}

function validateParcels(parcels: Parcel[]) {
  if (!parcels.length) throw new Error("At least one parcel is required");

  for (const parcel of parcels) {
    if (!parcel.parcelNumber?.trim()) {
      throw new Error("parcelNumber is required for every parcel");
    }
    if (!parcel.carrierName?.trim()) {
      throw new Error("carrierName is required for every parcel");
    }
    if (!Array.isArray(parcel.orderLineIds) || parcel.orderLineIds.length < 1) {
      throw new Error("orderLineIds is required for every parcel");
    }
    if (parcel.orderLineIds.some((id) => typeof id !== "string" || !id.trim())) {
      throw new Error("orderLineIds must contain valid line identifiers");
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.user) {
      return jsonResponse({ success: false, error: auth.error }, 401);
    }

    const input = await req.json() as OrderRequest;
    const action = input.action;
    if (!action) {
      return jsonResponse({ success: false, error: "action is required" }, 400);
    }

    const { clientId, clientSecret, sellerId } =
      await loadCredentials(auth.user.id);
    const token = await getOctopiaToken(clientId, clientSecret);

    if (action === "list_orders" || action === "count_orders") {
      const params = new URLSearchParams();
      if (action === "list_orders") {
        params.set("pageIndex", String(Math.max(1, Math.trunc(input.pageIndex || 1))));
        params.set("pageSize", String(Math.max(1, Math.min(Math.trunc(input.pageSize || 100), 100))));
        addOptional(params, "sort", input.sort);
        addOptional(params, "desc", input.desc);
      }

      addOptional(params, "status", input.status);
      addOptional(params, "supplyMode", input.supplyMode);
      addOptional(params, "salesChannelId", input.salesChannelId);
      addOptional(params, "reference", input.reference);
      addOptional(params, "createdAtMin", input.createdAtMin);
      addOptional(params, "createdAtMax", input.createdAtMax);
      addOptional(params, "updatedAtMin", input.updatedAtMin);
      addOptional(params, "updatedAtMax", input.updatedAtMax);
      addOptional(params, "shippedAtMin", input.shippedAtMin);
      addOptional(params, "shippedAtMax", input.shippedAtMax);

      const path = action === "count_orders" ? "orders/count" : "orders";
      const url = new URL(`${API_BASE}/${path}`);
      url.search = params.toString();

      const response = await fetch(url, {
        headers: octopiaHeaders(token, sellerId),
      });
      const data = await parseResponse(response);

      return jsonResponse({
        success: true,
        action,
        data,
        link: response.headers.get("Link"),
      });
    }

    if (action === "list_carriers") {
      const response = await fetch(`${API_BASE}/carriers`, {
        headers: octopiaHeaders(token, sellerId),
      });
      const data = await parseResponse(response);
      return jsonResponse({ success: true, action, data });
    }

    const orderId = input.orderId?.trim();
    if (!orderId) {
      return jsonResponse({ success: false, error: "orderId is required" }, 400);
    }

    if (action === "get_order") {
      const data = await getOrder(token, sellerId, orderId);
      return jsonResponse({ success: true, action, orderId, data });
    }

    const idempotencyKey = input.idempotencyKey?.trim();
    if (!idempotencyKey) {
      return jsonResponse({
        success: false,
        error: "idempotencyKey is required for order mutations",
      }, 400);
    }

    if (action === "approve_order") {
      if (!input.approvalStatus || !["Accepted", "Refused"].includes(input.approvalStatus)) {
        return jsonResponse({
          success: false,
          error: "approvalStatus must be Accepted or Refused",
        }, 400);
      }

      const fingerprint = await sha256({
        action,
        orderId,
        approvalStatus: input.approvalStatus,
      });
      const reservation = await reserveMutation(
        auth.user.id,
        action,
        idempotencyKey,
        fingerprint,
      );

      if (reservation.replayed) {
        if (reservation.log.status === "success") {
          return jsonResponse({
            success: true,
            replayed: true,
            action,
            orderId,
            data: reservation.log.metadata,
          });
        }
        return jsonResponse({
          success: false,
          error: "This order approval is already in progress or has an ambiguous outcome",
          status: reservation.log.status,
        }, 409);
      }

      let response: Response;
      try {
        response = await fetch(
          `${API_BASE}/orders/${encodeURIComponent(orderId)}/approval-status`,
          {
            method: "POST",
            headers: octopiaHeaders(token, sellerId, {
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({ approval_status: input.approvalStatus }),
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Remote approval failed";
        await markAmbiguous(reservation.admin, reservation.log.id, message);
        throw new Error("Cdiscount order approval outcome is ambiguous; manual reconciliation required");
      }

      try {
        await parseResponse(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Remote approval failed";
        await markAmbiguous(reservation.admin, reservation.log.id, message);
        throw error;
      }

      const metadata = {
        request_fingerprint: fingerprint,
        order_id: orderId,
        approval_status: input.approvalStatus,
      };
      await completeMutation(
        reservation.admin,
        reservation.log.id,
        orderId,
        metadata,
      );

      return jsonResponse({
        success: true,
        action,
        orderId,
        approvalStatus: input.approvalStatus,
      }, 201);
    }

    if (action === "ship_order") {
      const parcels = input.parcels || [];
      validateParcels(parcels);

      const currentOrder = await getOrder(token, sellerId, orderId);
      const status = currentOrder.status;
      const supplyMode = currentOrder.supplyMode;

      if (status !== "InPreparation") {
        return jsonResponse({
          success: false,
          error: "Only InPreparation orders can be shipped",
          orderStatus: status ?? null,
        }, 409);
      }
      if (supplyMode !== "Seller") {
        return jsonResponse({
          success: false,
          error: "Only Seller supplyMode orders can be shipped by ShopOpti",
          supplyMode: supplyMode ?? null,
        }, 409);
      }

      const fingerprint = await sha256({ action, orderId, parcels });
      const reservation = await reserveMutation(
        auth.user.id,
        action,
        idempotencyKey,
        fingerprint,
      );

      if (reservation.replayed) {
        if (reservation.log.status === "success") {
          return jsonResponse({
            success: true,
            replayed: true,
            action,
            orderId,
            data: reservation.log.metadata,
          });
        }
        return jsonResponse({
          success: false,
          error: "This shipment is already in progress or has an ambiguous outcome",
          status: reservation.log.status,
        }, 409);
      }

      let response: Response;
      try {
        response = await fetch(
          `${API_BASE}/orders/${encodeURIComponent(orderId)}/shipments`,
          {
            method: "POST",
            headers: octopiaHeaders(token, sellerId, {
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(parcels),
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Remote shipment failed";
        await markAmbiguous(reservation.admin, reservation.log.id, message);
        throw new Error("Cdiscount shipment outcome is ambiguous; manual reconciliation required");
      }

      try {
        await parseResponse(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Remote shipment failed";
        await markAmbiguous(reservation.admin, reservation.log.id, message);
        throw error;
      }

      const metadata = {
        request_fingerprint: fingerprint,
        order_id: orderId,
        parcels: parcels.map((parcel) => ({
          parcel_number: parcel.parcelNumber,
          carrier_name: parcel.carrierName,
          order_line_ids: parcel.orderLineIds,
        })),
      };
      await completeMutation(
        reservation.admin,
        reservation.log.id,
        orderId,
        metadata,
      );

      return jsonResponse({
        success: true,
        action,
        orderId,
        shipped: true,
      }, 201);
    }

    return jsonResponse({ success: false, error: "Unsupported action" }, 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cdiscount orders request failed";
    return jsonResponse({ success: false, error: message }, 400);
  }
});
