import { serve } from "npm:@supabase/functions-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json(
    {
      success: false,
      error: "Legacy Shopify platform endpoint disabled",
      code: "SHOPIFY_LEGACY_ENDPOINT_DISABLED",
      canonicalFunction: "shopify",
    },
    410,
  );
});
