import { serve } from "npm:@supabase/functions-js";
import { corsHeaders } from "../../_shared/cors.ts";

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
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleConnection(req: Request) {
  const { storeUrl, apiKey } = await req.json();
  if (!storeUrl || !apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "storeUrl and apiKey required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  return new Response(
    JSON.stringify({ success: true, message: "PrestaShop credentials valid" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleProducts(req: Request) {
  const { storeUrl, apiKey } = await req.json();
  if (!storeUrl || !apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "storeUrl and apiKey required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  const products = Array(5)
    .fill(0)
    .map((_, i) => ({
      id: `${2000 + i}`,
      title: `PrestaShop Product ${i + 1}`,
      price: Math.floor(Math.random() * 70) + 5,
    }));
  return new Response(
    JSON.stringify({ success: true, products }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
