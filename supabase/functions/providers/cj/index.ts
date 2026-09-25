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

const allowedActions = new Set([
  "products",
  "variants",
  "stock",
  "freight",
  "order_create",
  "order_detail",
  "tracking",
]);

const routes: Record<string, { method: "GET" | "POST"; path: string }> = {
  products: { method: "GET", path: "/product/listV2" },
  variants: { method: "GET", path: "/product/variant/query" },
  stock: { method: "GET", path: "/product/stock/queryByVid" },
  freight: { method: "POST", path: "/logistic/freightCalculate" },
  order_create: { method: "POST", path: "/shopping/order/createOrderV3" },
  order_detail: { method: "GET", path: "/shopping/order/getOrderDetail" },
  tracking: { method: "GET", path: "/logistic/trackInfo" },
};

const appendQuery = (url: URL, params: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      url.searchParams.set(key, String(value));
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const clientKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !clientKey) {
      return json({ success: false, error: "Server authentication is not configured" }, 503);
    }

    const body = await req.json();
    const supplierId = body?.supplierId;
    const action = body?.action;
    const params = body?.params ?? {};
    const payload = body?.payload ?? {};

    if (typeof supplierId !== "string" || typeof action !== "string" || !allowedActions.has(action)) {
      return json({ success: false, error: "Invalid supplierId or action" }, 400);
    }

    const supabase = createClient(supabaseUrl, clientKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ success: false, error: "Invalid session" }, 401);

    const { data: supplier, error: supplierError } = await supabase
      .from("external_suppliers")
      .select("id,type,status,api_key,base_url,user_id")
      .eq("id", supplierId)
      .single();

    if (supplierError || !supplier || supplier.user_id !== user.id || supplier.type !== "cj_dropshipping") {
      return json({ success: false, error: "CJdropshipping supplier not found" }, 404);
    }
    if (supplier.status !== "active") {
      return json({ success: false, error: "CJdropshipping connection is not verified" }, 409);
    }
    if (!supplier.api_key) {
      return json({ success: false, error: "CJdropshipping credential is missing" }, 422);
    }

    const route = routes[action];
    const baseUrl = (supplier.base_url || "https://developers.cjdropshipping.com/api2.0/v1").replace(/\/$/, "");
    const url = new URL(baseUrl + route.path);
    appendQuery(url, params);

    const response = await fetch(url, {
      method: route.method,
      headers: {
        "CJ-Access-Token": supplier.api_key,
        Accept: "application/json",
        ...(route.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(route.method === "POST" ? { body: JSON.stringify(payload) } : {}),
    });

    let remote: unknown = null;
    try {
      remote = await response.json();
    } catch {
      return json({ success: false, error: "CJdropshipping returned a non-JSON response" }, 502);
    }

    if (!response.ok) {
      return json(
        { success: false, provider: "cj_dropshipping", action, status: "remote_error", remote },
        response.status >= 400 && response.status < 500 ? response.status : 502
      );
    }

    return json({
      success: true,
      provider: "cj_dropshipping",
      action,
      fetchedAt: new Date().toISOString(),
      data: remote,
    });
  } catch (error) {
    return json(
      { success: false, error: error instanceof Error ? error.message : "Unexpected CJdropshipping error" },
      500
    );
  }
});
