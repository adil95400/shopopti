import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return json({ success: false, error: "Supplier credential server is not configured" }, 503);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ success: false, error: "Invalid session" }, 401);
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    const openId = typeof body?.openId === "string" ? body.openId.trim() : "";
    const supplierId = typeof body?.supplierId === "string" ? body.supplierId : null;

    if (!name || !apiKey) {
      return json({ success: false, error: "CJ supplier name and API key are required" }, 400);
    }

    // CJ's API Key is exchanged server-side for an access token. The API key is never
    // returned to the browser and the access token is the only credential used by runtime calls.
    const tokenResponse = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    const tokenPayload = await tokenResponse.json().catch(() => null);
    const tokenData = tokenPayload?.data ?? {};
    const accessToken =
      tokenData?.accessToken ?? tokenData?.access_token ?? tokenPayload?.accessToken ?? null;

    if (!tokenResponse.ok || tokenPayload?.result !== true || !accessToken) {
      return json(
        {
          success: false,
          error: tokenPayload?.message || "CJ rejected this API key",
        },
        tokenResponse.status === 401 ? 401 : 422
      );
    }

    const settingResponse = await fetch(`${CJ_BASE_URL}/setting/get`, {
      method: "GET",
      headers: { "CJ-Access-Token": String(accessToken), Accept: "application/json" },
    });
    const settingPayload = await settingResponse.json().catch(() => null);
    if (!settingResponse.ok || settingPayload?.result !== true) {
      return json({ success: false, error: "CJ access token verification failed" }, 422);
    }

    let row;
    if (supplierId) {
      const { data: owned } = await userClient
        .from("external_suppliers")
        .select("id,user_id,type")
        .eq("id", supplierId)
        .eq("type", "cj_dropshipping")
        .single();

      if (!owned || owned.user_id !== user.id) {
        return json({ success: false, error: "CJ supplier not found" }, 404);
      }

      const { data, error } = await admin
        .from("external_suppliers")
        .update({
          name,
          api_key: String(accessToken),
          api_secret: openId || null,
          base_url: CJ_BASE_URL,
          status: "active",
          last_sync: new Date().toISOString(),
        })
        .eq("id", supplierId)
        .eq("user_id", user.id)
        .select("id,name,type,status,last_sync,webhook_status,webhook_last_event_at,created_at")
        .single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await admin
        .from("external_suppliers")
        .insert({
          user_id: user.id,
          name,
          type: "cj_dropshipping",
          api_key: String(accessToken),
          api_secret: openId || null,
          base_url: CJ_BASE_URL,
          status: "active",
          last_sync: new Date().toISOString(),
        })
        .select("id,name,type,status,last_sync,webhook_status,webhook_last_event_at,created_at")
        .single();
      if (error) throw error;
      row = data;
    }

    return json({
      success: true,
      supplier: {
        id: row.id,
        name: row.name,
        type: row.type,
        status: row.status,
        lastSync: row.last_sync ?? undefined,
        webhookStatus: row.webhook_status ?? "not_configured",
        webhookLastEventAt: row.webhook_last_event_at ?? undefined,
        created_at: row.created_at,
      },
      credentialStored: true,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected CJ connection error",
      },
      500
    );
  }
});
