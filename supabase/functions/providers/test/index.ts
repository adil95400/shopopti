import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { requireConnectorEnabled } from "../../_shared/connectorAvailability.ts";
import { getValidCjAccessToken } from "../../_shared/cjCredentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeBaseUrl = (value: string | null | undefined) =>
  (value || "https://developers.cjdropshipping.com/api2.0/v1").replace(/\/$/, "");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseClientKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseClientKey || !serviceRoleKey) {
      return jsonResponse(
        { success: false, error: "Supplier probe is not configured on the server" },
        503
      );
    }

    const { supplierId } = await req.json();
    if (!supplierId || typeof supplierId !== "string") {
      return jsonResponse({ success: false, error: "supplierId is required" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseClientKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Invalid session" }, 401);
    }

    const { data: supplier, error: supplierError } = await supabase
      .from("external_suppliers")
      .select("id,name,type,status,base_url,user_id")
      .eq("id", supplierId)
      .single();

    if (supplierError || !supplier || supplier.user_id !== user.id) {
      return jsonResponse({ success: false, error: "Supplier not found" }, 404);
    }

    if (supplier.type === "cj_dropshipping") {
      let accessToken: string;
      try {
        accessToken = await getValidCjAccessToken(admin, supplierId);
      } catch (error) {
        return jsonResponse(
          {
            success: false,
            supplierId,
            provider: supplier.type,
            status: "not_configured",
            error: error instanceof Error ? error.message : "Supplier credential is missing",
          },
          422
        );
      }

      const baseUrl = normalizeBaseUrl(supplier.base_url);
      const response = await fetch(`${baseUrl}/setting/get`, {
        method: "GET",
        headers: {
          "CJ-Access-Token": accessToken,
          Accept: "application/json",
        },
      });

      let payload: Record<string, unknown> | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const verified = response.ok && payload?.result === true;

      if (!verified) {
        await admin
          .from("external_suppliers")
          .update({ status: "error" })
          .eq("id", supplierId);

        return jsonResponse(
          {
            success: false,
            supplierId,
            provider: supplier.type,
            status: "remote_rejected",
            error: "CJdropshipping did not confirm this credential",
          },
          response.status === 401 ? 401 : 502
        );
      }

      await admin
        .from("external_suppliers")
        .update({ status: "active" })
        .eq("id", supplierId);

      return jsonResponse({
        success: true,
        supplierId,
        provider: supplier.type,
        status: "verified",
      });
    }

    return jsonResponse(
      {
        success: false,
        supplierId,
        provider: supplier.type,
        status: "probe_not_implemented",
        error: "No production connection probe is implemented for this provider yet",
      },
      501
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected supplier probe error";
    return jsonResponse({ success: false, error: message }, 500);
  }
});
