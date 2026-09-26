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

type CatalogRequest = {
  action?: "products" | "offers";
  cursor?: string;
  limit?: number;
  gtin?: string;
  categoryReference?: string;
  language?: "fr-FR" | "en-US" | "es-ES";
  fields?: string;
  salesChannelId?: string;
  offerIds?: string;
  offerStates?: string;
  sellerExternalReferences?: string;
  updatedAtMin?: string;
  expand?: string;
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serverKey = getServerKey();
  const encryptionKey = Deno.env.get("CDISCOUNT_CREDENTIALS_ENCRYPTION_KEY") || "";

  if (!supabaseUrl || !serverKey || !encryptionKey) {
    throw new Error("Secure Cdiscount credentials are not configured");
  }

  const admin = createClient(supabaseUrl, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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

function clampLimit(value: number | undefined, max: number): number {
  if (!Number.isFinite(value)) return Math.min(100, max);
  return Math.max(1, Math.min(Math.trunc(value as number), max));
}

async function octopiaGet(
  path: string,
  token: string,
  sellerId: string,
  params: URLSearchParams,
) {
  const url = new URL(`${API_BASE}/${path}`);
  url.search = params.toString();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      SellerId: sellerId,
      Accept: "application/json",
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Octopia denied access to this seller");
    }
    if (response.status === 429) {
      throw new Error("Octopia rate limit reached");
    }
    throw new Error(`Octopia ${path} request failed`);
  }

  return {
    body,
    nextLink: response.headers.get("Link"),
  };
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

    const input = await req.json() as CatalogRequest;
    const action = input.action;
    if (action !== "products" && action !== "offers") {
      return jsonResponse({ success: false, error: "Invalid action" }, 400);
    }

    const { clientId, clientSecret, sellerId } =
      await loadCredentials(auth.user.id);
    const token = await getOctopiaToken(clientId, clientSecret);
    const params = new URLSearchParams();

    if (input.cursor) params.set("cursor", input.cursor);

    if (action === "products") {
      params.set("limit", String(clampLimit(input.limit, 1000)));
      if (input.gtin) params.set("gtin", input.gtin);
      if (input.categoryReference) {
        params.set("categoryReference", input.categoryReference);
      }
      if (input.language) params.set("language", input.language);
      if (input.fields) params.set("fields", input.fields);

      const result = await octopiaGet("products", token, sellerId, params);
      return jsonResponse({
        success: true,
        provider: "cdiscount-octopia",
        action,
        data: result.body,
        link: result.nextLink,
      });
    }

    params.set("salesChannelId", input.salesChannelId?.trim() || "CDISFR");
    params.set("limit", String(clampLimit(input.limit, 1000)));
    if (input.offerIds) params.set("offerIds", input.offerIds);
    if (input.offerStates) params.set("offerStates", input.offerStates);
    if (input.sellerExternalReferences) {
      params.set("sellerExternalReferences", input.sellerExternalReferences);
    }
    if (input.updatedAtMin) params.set("updatedAtMin", input.updatedAtMin);
    if (input.fields) params.set("fields", input.fields);
    else if (input.expand) params.set("expand", input.expand);

    const result = await octopiaGet("offers", token, sellerId, params);
    return jsonResponse({
      success: true,
      provider: "cdiscount-octopia",
      action,
      salesChannelId: params.get("salesChannelId"),
      data: result.body,
      link: result.nextLink,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cdiscount catalog request failed";
    return jsonResponse({ success: false, error: message }, 400);
  }
});
