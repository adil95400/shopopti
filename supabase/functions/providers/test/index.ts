import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(
        { success: false, error: "Supplier probe is not configured on the server" },
        503
      );
    }

    const { supplierId } = await req.json();
    if (!supplierId || typeof supplierId !== "string") {
      return jsonResponse({ success: false, error: "supplierId is required" }, 400);
    }

    // Use the caller session so RLS enforces supplier ownership.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Invalid session" }, 401);
    }

    const { data: supplier, error: supplierError } = await supabase
      .from("external_suppliers")
      .select("id,name,type,status,api_key,api_secret,base_url,user_id")
      .eq("id", supplierId)
      .single();

    if (supplierError || !supplier) {
      return jsonResponse({ success: false, error: "Supplier not found" }, 404);
    }

    if (supplier.user_id !== user.id) {
      return jsonResponse({ success: false, error: "Supplier not found" }, 404);
    }

    if (!supplier.api_key || !supplier.base_url) {
      return jsonResponse(
        {
          success: false,
          supplierId,
          provider: supplier.type,
          status: "not_configured",
          error: "Supplier credentials are incomplete",
        },
        422
      );
    }

    // Fail closed until a provider-specific authenticated probe exists.
    // A stored API key is configuration, not proof that the remote provider accepts it.
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
