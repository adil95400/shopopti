import { serve } from "npm:@supabase/functions-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const providers = [
  "cj_dropshipping",
  "bigbuy",
  "aliexpress",
  "alibaba",
  "banggood",
  "dhgate",
  "cdiscount",
  "spocket",
  "eprolo",
  "custom_api",
  "custom_csv",
  "custom_xml",
  "custom_ftp",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      message: "ShopOpti supplier provider registry",
      providers,
      note: "Registry membership does not imply a production connector is implemented.",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
