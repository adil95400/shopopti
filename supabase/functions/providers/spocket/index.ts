import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { apiKey, apiSecret, baseUrl, filters, productId, productIds } = await req.json();

    if (!apiKey) {
      throw new Error("API key is required");
    }

    const apiBase = baseUrl || "https://dummyjson.com";
    let products: any[] = [];

    try {
      if (productId) {
        const res = await fetch(`${apiBase}/products/${productId}`);
        if (res.ok) {
          const data = await res.json();
          products = [data];
        }
      } else {
        const res = await fetch(`${apiBase}/products`);
        if (res.ok) {
          const data = await res.json();
          products = data.products || [];
        }
      }
    } catch (_) {
      // ignore network errors and fall back to demo data
    }

    if (products.length === 0) {
      products = Array(20).fill(0).map((_, i) => ({
        id: i + 1,
        title: `Spocket Demo Product ${i + 1}`,
        description: `Sample product from Spocket demo API.`,
        price: Math.floor(Math.random() * 100) + 10,
        stock: Math.floor(Math.random() * 100) + 5,
        category: ['Electronics', 'Fashion', 'Home', 'Beauty'][Math.floor(Math.random() * 4)],
        images: [
          `https://images.pexels.com/photos/${1038000 + i * 5}/pexels-photo-${1038000 + i * 5}.jpeg?auto=compress&cs=tinysrgb&w=300`
        ]
      }));
    }

    const mapped = products.map((p, idx) => ({
      id: `sp-${p.id ?? idx + 1}`,
      externalId: String(p.id ?? idx + 1),
      name: p.title || `Spocket Product ${idx + 1}`,
      description: p.description || 'Spocket product',
      price: p.price ?? Math.floor(Math.random() * 100) + 10,
      msrp: (p.price ? Math.round(p.price * 1.2) : Math.floor(Math.random() * 150) + 20),
      stock: p.stock ?? Math.floor(Math.random() * 100) + 5,
      images: p.images && Array.isArray(p.images) ? p.images : [p.thumbnail].filter(Boolean),
      category: p.category || 'General',
      supplier_id: "spocket",
      supplier_type: "spocket",
      shipping_time: `${Math.floor(Math.random() * 10) + 3} days`,
      processing_time: `${Math.floor(Math.random() * 3) + 1} days`,
    }));

    let filteredProducts = [...mapped];

    if (filters) {
      if (filters.category) {
        filteredProducts = filteredProducts.filter(p => p.category === filters.category);
      }
      if (filters.minPrice) {
        filteredProducts = filteredProducts.filter(p => p.price >= filters.minPrice);
      }
      if (filters.maxPrice) {
        filteredProducts = filteredProducts.filter(p => p.price <= filters.maxPrice);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredProducts = filteredProducts.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }
      if (filters.page && filters.limit) {
        const start = (filters.page - 1) * filters.limit;
        const end = start + filters.limit;
        filteredProducts = filteredProducts.slice(start, end);
      }
    }

    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
      filteredProducts = filteredProducts.filter(p => productIds.includes(p.externalId));
    }

    return new Response(
      JSON.stringify({
        products: filteredProducts,
        total: mapped.length,
        filtered: filteredProducts.length,
        product: filteredProducts.length === 1 && productId ? filteredProducts[0] : undefined
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
