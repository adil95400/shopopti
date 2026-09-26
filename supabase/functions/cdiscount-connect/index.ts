import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

import { encryptSecretPayload } from "../_shared/secretEnvelope.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const TOKEN_URL =
  "https://auth.octopia-io.net/auth/realms/maas/protocol/openid-connect/token";
const SELLER_URL = "https://api.octopia-io.net/seller/v2/sellers";

type ConnectRequest = {
  clientId?: string;
  clientSecret?: string;
  sellerId?: string | number;
  persist?: boolean;
};

type OctopiaTokenResponse = {
  access_token?: string;
  expires_in?: number;
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

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authorization.slice("Bearer ".length);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: "Invalid or expired session" };
  }

  return { user, error: null };
}

async function getOctopiaToken(
  clientId: string,
  clientSecret: string,
): Promise<{ token: string; expiresIn: number | null }> {
  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("grant_type", "client_credentials");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const body = (await response.json().catch(() => ({}))) as OctopiaTokenResponse;

  if (!response.ok || !body.access_token) {
    throw new Error(
      response.status === 401
        ? "Octopia rejected the client credentials"
        : "Octopia token request failed",
    );
  }

  return {
    token: body.access_token,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : null,
  };
}

async function getSellerProfile(token: string, sellerId: string) {
  const response = await fetch(SELLER_URL, {
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
      throw new Error(
        "Octopia authenticated the client but denied access to this seller",
      );
    }
    if (response.status === 404) {
      throw new Error("Octopia seller account not found");
    }
    throw new Error("Octopia seller verification failed");
  }

  return body as Record<string, unknown>;
}

async function persistConnection(
  userId: string,
  clientId: string,
  clientSecret: string,
  sellerId: string,
  seller: Record<string, unknown>,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serverKey = getServerKey();
  const encryptionKey = Deno.env.get("CDISCOUNT_CREDENTIALS_ENCRYPTION_KEY") || "";

  if (!supabaseUrl || !serverKey || !encryptionKey) {
    throw new Error("Secure Cdiscount persistence is not configured");
  }

  const encryptedCredentials = await encryptSecretPayload(
    { clientId, clientSecret, sellerId },
    encryptionKey,
  );

  const admin = createClient(supabaseUrl, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from("integrations")
    .upsert(
      {
        user_id: userId,
        platform_type: "cdiscount",
        platform_name: "Cdiscount / Octopia",
        platform_url: "https://marketplace.cdiscount.com",
        api_key: null,
        api_secret: null,
        access_token: null,
        refresh_token: null,
        seller_id: sellerId,
        encrypted_credentials: encryptedCredentials,
        credential_encryption_version: 1,
        connection_status: "connected",
        is_active: true,
        last_error: null,
        store_config: {
          provider: "octopia",
          seller_id: seller.seller_id ?? sellerId,
          shop_name: seller.shop_name ?? null,
          shop_url: seller.shop_url ?? null,
          seller_state: seller.seller_state ?? seller.status ?? null,
          seller_sub_state: seller.seller_sub_state ?? null,
          subscription_step: seller.subscription_step ?? null,
          language: seller.language ?? null,
          verified_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform_type" },
    )
    .select("id, platform_type, platform_name, seller_id, connection_status, is_active")
    .single();

  if (error) {
    throw new Error("Cdiscount connection could not be stored securely");
  }

  return data;
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

    const payload = (await req.json()) as ConnectRequest;
    const clientId = payload.clientId?.trim();
    const clientSecret = payload.clientSecret?.trim();
    const sellerId = String(payload.sellerId ?? "").trim();

    if (!clientId || !clientSecret || !sellerId) {
      return jsonResponse(
        {
          success: false,
          error: "clientId, clientSecret and sellerId are required",
        },
        400,
      );
    }

    const { token, expiresIn } = await getOctopiaToken(clientId, clientSecret);
    const seller = await getSellerProfile(token, sellerId);

    const connection = payload.persist
      ? await persistConnection(
        auth.user.id,
        clientId,
        clientSecret,
        sellerId,
        seller,
      )
      : null;

    // Never return the OAuth token, client secret or encrypted credential blob.
    return jsonResponse({
      success: true,
      verified: true,
      persisted: Boolean(connection),
      provider: "cdiscount-octopia",
      tokenExpiresIn: expiresIn,
      connection,
      seller: {
        sellerId: seller.seller_id ?? sellerId,
        shopName: seller.shop_name ?? null,
        shopUrl: seller.shop_url ?? null,
        sellerState: seller.seller_state ?? seller.status ?? null,
        sellerSubState: seller.seller_sub_state ?? null,
        subscriptionStep: seller.subscription_step ?? null,
        language: seller.language ?? null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cdiscount connection failed";

    return jsonResponse({ success: false, error: message }, 400);
  }
});
