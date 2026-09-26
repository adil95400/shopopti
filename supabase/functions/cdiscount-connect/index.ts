import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

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
};

type OctopiaTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPublishableKey(): string {
  const legacyAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacyAnon) return legacyAnon;

  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default || Object.values(parsed)[0] || "";
  } catch {
    return "";
  }
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
    const message =
      response.status === 401
        ? "Octopia rejected the client credentials"
        : "Octopia token request failed";
    throw new Error(message);
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

    // Never return the OAuth token or client secret to the browser.
    return jsonResponse({
      success: true,
      verified: true,
      provider: "cdiscount-octopia",
      userId: auth.user.id,
      tokenExpiresIn: expiresIn,
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
