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

type PackageType = "Upsert" | "Update" | "Delete";
type Action =
  | "create_package"
  | "upload_requests"
  | "get_package"
  | "submit_package"
  | "get_results";

type OfferWriteRequest = {
  action?: Action;
  packageType?: PackageType;
  packageId?: string;
  salesChannelId?: string;
  acceptLanguage?: "fr-FR" | "en-US" | "es-ES";
  offerRequests?: Record<string, unknown>[];
  limit?: number;
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
    .select("id, encrypted_credentials, seller_id, connection_status, is_active")
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

  return { integrationId: data.id as string, clientId, clientSecret, sellerId };
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

function validateOfferRequests(
  packageType: PackageType,
  requests: Record<string, unknown>[],
) {
  if (requests.length < 1 || requests.length > 100) {
    throw new Error("Each Octopia upload must contain between 1 and 100 offer requests");
  }

  for (const request of requests) {
    const ref = request.sellerExternalReference;
    if (typeof ref !== "string" || !ref.trim()) {
      throw new Error("sellerExternalReference is required for every offer request");
    }

    if (packageType === "Upsert") {
      const product = request.product;
      const condition = request.condition;
      const price = request.price;
      if (!product || typeof product !== "object") {
        throw new Error("product is required for Upsert requests");
      }
      const gtin = (product as Record<string, unknown>).gtin;
      if (typeof gtin !== "string" || !gtin.trim()) {
        throw new Error("product.gtin is required for Upsert requests");
      }
      if (typeof condition !== "string" || !condition.trim()) {
        throw new Error("condition is required for Upsert requests");
      }
      if (!price || typeof price !== "object") {
        throw new Error("price is required for Upsert requests");
      }
      const priceValue = (price as Record<string, unknown>).price;
      if (typeof priceValue !== "number" || !Number.isFinite(priceValue)) {
        throw new Error("price.price must be a finite number for Upsert requests");
      }
      if (typeof request.quantity !== "number" || !Number.isFinite(request.quantity)) {
        throw new Error("quantity must be a finite number for Upsert requests");
      }
    }

    if (packageType === "Delete" && Object.keys(request).some(
      (key) => key !== "sellerExternalReference",
    )) {
      throw new Error("Delete requests may only contain sellerExternalReference");
    }
  }
}

async function getPackage(
  token: string,
  sellerId: string,
  packageId: string,
) {
  const response = await fetch(
    `${API_BASE}/offer-packages/${encodeURIComponent(packageId)}`,
    { headers: octopiaHeaders(token, sellerId) },
  );
  return await parseResponse(response) as Record<string, unknown>;
}

async function waitUntilUploadSettled(
  token: string,
  sellerId: string,
  packageId: string,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const pkg = await getPackage(token, sellerId, packageId);
    const state = pkg?.state;
    if (state === "WaitingForCompletion") return pkg;
    if (state === "Rejected" || state === "Integrated") return pkg;
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  return await getPackage(token, sellerId, packageId);
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

    const input = await req.json() as OfferWriteRequest;
    const action = input.action;
    if (!action) {
      return jsonResponse({ success: false, error: "action is required" }, 400);
    }

    const { clientId, clientSecret, sellerId } =
      await loadCredentials(auth.user.id);
    const token = await getOctopiaToken(clientId, clientSecret);
    const channel = input.salesChannelId?.trim() || "CDISFR";
    const language = input.acceptLanguage || "fr-FR";

    if (action === "create_package") {
      if (!input.packageType || !["Upsert", "Update", "Delete"].includes(input.packageType)) {
        return jsonResponse({ success: false, error: "Valid packageType is required" }, 400);
      }

      const response = await fetch(`${API_BASE}/offer-packages`, {
        method: "POST",
        headers: octopiaHeaders(token, sellerId, {
          "Content-Type": "application/json",
          "Accept-Language": language,
          SalesChannelId: channel,
        }),
        body: JSON.stringify({ packageType: input.packageType }),
      });

      if (response.status !== 201) {
        await parseResponse(response);
      }

      const location = response.headers.get("Content-Location");
      const packageId = location?.split("/").filter(Boolean).pop() || null;
      if (!packageId) {
        throw new Error("Octopia created a package but returned no package identifier");
      }

      return jsonResponse({
        success: true,
        action,
        packageId,
        salesChannelId: channel,
        packageType: input.packageType,
        state: "WaitingForCompletion",
      }, 201);
    }

    const packageId = input.packageId?.trim();
    if (!packageId) {
      return jsonResponse({ success: false, error: "packageId is required" }, 400);
    }

    if (action === "get_package") {
      const data = await getPackage(token, sellerId, packageId);
      return jsonResponse({ success: true, action, packageId, data });
    }

    if (action === "upload_requests") {
      if (!input.packageType) {
        return jsonResponse({ success: false, error: "packageType is required" }, 400);
      }
      const requests = input.offerRequests || [];
      validateOfferRequests(input.packageType, requests);

      const current = await getPackage(token, sellerId, packageId);
      if (current.state !== "WaitingForCompletion") {
        return jsonResponse({
          success: false,
          error: "Offer requests can only be uploaded while package is WaitingForCompletion",
          packageState: current.state ?? null,
        }, 409);
      }
      if (current.type && current.type !== input.packageType) {
        return jsonResponse({
          success: false,
          error: "packageType does not match the remote package",
        }, 409);
      }

      const response = await fetch(
        `${API_BASE}/offer-packages/${encodeURIComponent(packageId)}/offer-requests`,
        {
          method: "POST",
          headers: octopiaHeaders(token, sellerId, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(requests),
        },
      );
      await parseResponse(response);

      return jsonResponse({
        success: true,
        action,
        packageId,
        uploaded: requests.length,
      }, 201);
    }

    if (action === "submit_package") {
      const current = await waitUntilUploadSettled(token, sellerId, packageId);
      if (current.state !== "WaitingForCompletion") {
        return jsonResponse({
          success: false,
          error: "Package is not ready to be submitted",
          packageState: current.state ?? null,
        }, 409);
      }

      const response = await fetch(
        `${API_BASE}/offer-packages/${encodeURIComponent(packageId)}`,
        {
          method: "PATCH",
          headers: octopiaHeaders(token, sellerId, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ state: "Ready" }),
        },
      );
      await parseResponse(response);

      return jsonResponse({
        success: true,
        action,
        packageId,
        submitted: true,
        state: "Ready",
      });
    }

    if (action === "get_results") {
      const limit = Math.max(1, Math.min(Math.trunc(input.limit || 100), 1000));
      const url = new URL(
        `${API_BASE}/offer-packages/${encodeURIComponent(packageId)}/offer-requests-results`,
      );
      url.searchParams.set("limit", String(limit));
      const response = await fetch(url, {
        headers: octopiaHeaders(token, sellerId),
      });
      const data = await parseResponse(response);
      return jsonResponse({
        success: true,
        action,
        packageId,
        data,
        link: response.headers.get("Link"),
      });
    }

    return jsonResponse({ success: false, error: "Unsupported action" }, 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cdiscount offer write failed";
    return jsonResponse({ success: false, error: message }, 400);
  }
});
