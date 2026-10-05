import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { getCjCredentials } from "../../_shared/cjCredentials.ts";

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
      return json({ success: false, error: "Supplier disconnect server is not configured" }, 503);
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
    const supplierId = typeof body?.supplierId === "string" ? body.supplierId : "";
    if (!supplierId) {
      return json({ success: false, error: "supplierId is required" }, 400);
    }

    const { data: supplier, error: supplierError } = await userClient
      .from("external_suppliers")
      .select("id,user_id,type")
      .eq("id", supplierId)
      .eq("type", "cj_dropshipping")
      .single();

    if (supplierError || !supplier || supplier.user_id !== user.id) {
      return json({ success: false, error: "CJ supplier not found" }, 404);
    }

    let remoteLogoutConfirmed = false;
    try {
      const credentials = await getCjCredentials(admin, supplierId);
      const response = await fetch(`${CJ_BASE_URL}/authentication/logout`, {
        method: "POST",
        headers: {
          "CJ-Access-Token": credentials.access_token,
          Accept: "application/json",
        },
      });
      const payload = await response.json().catch(() => null);
      remoteLogoutConfirmed = response.ok && payload?.result === true;
    } catch {
      remoteLogoutConfirmed = false;
    }

    const { error: deleteError } = await admin
      .from("external_suppliers")
      .delete()
      .eq("id", supplierId)
      .eq("user_id", user.id);

    if (deleteError) throw deleteError;

    return json({
      success: true,
      supplierId,
      remoteLogoutConfirmed,
      message: remoteLogoutConfirmed
        ? "CJ connection revoked and removed"
        : "CJ connection removed locally; remote logout was not confirmed",
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected CJ disconnect error",
      },
      500
    );
  }
});
