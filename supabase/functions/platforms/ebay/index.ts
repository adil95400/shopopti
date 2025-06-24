import { serve } from "npm:@supabase/functions-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (path === "products") {
      return await handleProducts(req);
    }

    return await handleConnection(req);
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleConnection(req: Request) {
  const { appId, certId, devId, authToken } = await req.json();

  if (!appId || !certId || !devId || !authToken) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing credentials" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  return new Response(
    JSON.stringify({ success: true, message: "eBay credentials valid" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function handleProducts(req: Request) {
  const { authToken } = await req.json();

  if (!authToken) {
    return new Response(
      JSON.stringify({ success: false, error: "authToken required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
  const products = Array(5)
    .fill(0)
    .map((_, i) => ({
      id: `EBAY-${1000 + i}`,
      title: `eBay Product ${i + 1}`,
      price: Math.floor(Math.random() * 100) + 10,
    }));

  return new Response(
    JSON.stringify({ success: true, products }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
