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

const normalizeBaseUrl = (value: string | null | undefined) =>
  (value || "https://developers.cjdropshipping.com/api2.0/v1").replace(/\/$/, "");

const parsePrice = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const first = value.split("-")[0]?.trim();
  const parsed = Number(first);
  return Number.isFinite(parsed) ? parsed : 0;
};

const flattenListV2 = (data: any): any[] => {
  if (Array.isArray(data?.content)) {
    return data.content.flatMap((entry: any) => {
      if (Array.isArray(entry?.productList)) return entry.productList;
      return entry ? [entry] : [];
    });
  }
  if (Array.isArray(data?.list)) return data.list;
  return [];
};

const mapProductCard = (product: any, supplierId: string) => {
  const externalId = String(product.id ?? product.pid ?? "");
  const image = product.bigImage ?? product.productImage ?? product.bigImg ?? "";
  const price = parsePrice(
    product.nowPrice ??
      product.sellPrice ??
      product.productSellPrice ??
      product.price
  );

  return {
    id: `cj-${externalId}`,
    externalId,
    name: product.nameEn ?? product.productNameEn ?? product.nameen ?? "CJ product",
    description: "",
    price,
    stock: 0,
    images: image ? [image] : [],
    category: product.categoryName ?? product.categoryNameEn ?? product.categoryId ?? "",
    supplier_id: supplierId,
    supplier_type: "cj_dropshipping",
    sku: product.sku ?? product.productSku ?? product.spu ?? undefined,
    weight: Number(product.productWeight ?? product.weight ?? 0) || undefined,
    metadata: {
      source: "cj_dropshipping",
      stockVerified: false,
      priceCurrency: "USD",
    },
  };
};

const mapVariant = (variant: any) => ({
  id: String(variant.vid ?? variant.id ?? ""),
  title:
    variant.variantNameEn ??
    variant.variantName ??
    variant.variantSku ??
    variant.sku ??
    "Variant",
  price: parsePrice(variant.variantSellPrice ?? variant.sellPrice ?? variant.price),
  sku: variant.variantSku ?? variant.sku ?? undefined,
  stock: undefined,
  options: {},
});

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
    const clientKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !clientKey) {
      return json({ success: false, error: "CJ connector is not configured" }, 503);
    }

    const body = await req.json();
    const supplierId = body?.supplierId;
    const action = body?.action ?? "search";

    if (!supplierId || typeof supplierId !== "string") {
      return json({ success: false, error: "supplierId is required" }, 400);
    }

    const supabase = createClient(supabaseUrl, clientKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json({ success: false, error: "Invalid session" }, 401);
    }

    const { data: supplier, error: supplierError } = await supabase
      .from("external_suppliers")
      .select("id,type,api_key,base_url,user_id,status")
      .eq("id", supplierId)
      .single();

    if (
      supplierError ||
      !supplier ||
      supplier.user_id !== user.id ||
      supplier.type !== "cj_dropshipping"
    ) {
      return json({ success: false, error: "CJ supplier not found" }, 404);
    }

    if (!supplier.api_key) {
      return json({ success: false, error: "CJ credential is missing" }, 422);
    }

    const baseUrl = normalizeBaseUrl(supplier.base_url);
    const cjHeaders = {
      "CJ-Access-Token": supplier.api_key,
      Accept: "application/json",
    };

    if (action === "categories") {
      const response = await fetch(`${baseUrl}/product/getCategory`, {
        method: "GET",
        headers: cjHeaders,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        return json(
          {
            success: false,
            error: payload?.message || "CJ category query failed",
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const categories = rows.flatMap((first: any) => {
        const firstId = String(first?.categoryId ?? first?.id ?? "");
        const firstName = String(first?.categoryName ?? first?.name ?? "");
        const secondRows = Array.isArray(first?.categoryFirstList)
          ? first.categoryFirstList
          : Array.isArray(first?.children)
            ? first.children
            : [];

        if (secondRows.length === 0 && firstId) {
          return [{ id: firstId, externalId: firstId, name: firstName, level: 1, supplier_id: supplierId }];
        }

        return secondRows.flatMap((second: any) => {
          const secondId = String(second?.categoryId ?? second?.id ?? "");
          const secondName = String(second?.categoryName ?? second?.name ?? "");
          const thirdRows = Array.isArray(second?.categorySecondList)
            ? second.categorySecondList
            : Array.isArray(second?.children)
              ? second.children
              : [];

          if (thirdRows.length === 0 && secondId) {
            return [{
              id: secondId,
              externalId: secondId,
              name: secondName,
              parentId: firstId || undefined,
              level: 2,
              supplier_id: supplierId,
            }];
          }

          return thirdRows
            .map((third: any) => {
              const id = String(third?.categoryId ?? third?.id ?? "");
              if (!id) return null;
              return {
                id,
                externalId: id,
                name: String(third?.categoryName ?? third?.name ?? ""),
                parentId: secondId || firstId || undefined,
                level: 3,
                supplier_id: supplierId,
              };
            })
            .filter(Boolean);
        });
      });

      return json({
        success: true,
        categories,
        source: {
          provider: "cj_dropshipping",
          endpoint: "product/getCategory",
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (action === "search") {
      const filters = body?.filters ?? {};
      const params = new URLSearchParams();
      params.set("page", String(Math.max(1, Number(filters.page ?? 1))));
      params.set("size", String(Math.min(100, Math.max(1, Number(filters.limit ?? 20)))));

      if (filters.search) params.set("keyWord", String(filters.search));
      if (filters.category) params.set("categoryId", String(filters.category));
      if (filters.minPrice != null) params.set("startSellPrice", String(filters.minPrice));
      if (filters.maxPrice != null) params.set("endSellPrice", String(filters.maxPrice));

      const response = await fetch(`${baseUrl}/product/listV2?${params.toString()}`, {
        method: "GET",
        headers: cjHeaders,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        return json(
          {
            success: false,
            error: payload?.message || "CJ product search failed",
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      const products = flattenListV2(payload?.data).map((product) =>
        mapProductCard(product, supplierId)
      );

      return json({
        success: true,
        products,
        pagination: {
          totalRecords: payload?.data?.totalRecords ?? null,
          totalPages: payload?.data?.totalPages ?? null,
        },
        source: {
          provider: "cj_dropshipping",
          endpoint: "product/listV2",
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (action === "detail") {
      const productId = body?.productId;
      if (!productId || typeof productId !== "string") {
        return json({ success: false, error: "productId is required" }, 400);
      }

      const response = await fetch(`${baseUrl}/product/productDetail/query`, {
        method: "POST",
        headers: { ...cjHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true || !payload?.data) {
        return json(
          {
            success: false,
            error: payload?.message || "CJ product detail failed",
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      const raw = payload.data;
      const images = Array.isArray(raw.img)
        ? raw.img
        : Array.isArray(raw.productImageSet)
          ? raw.productImageSet
          : [raw.bigImg ?? raw.bigimg].filter(Boolean);

      const variants = Array.isArray(raw.variants)
        ? raw.variants.map(mapVariant)
        : [];

      return json({
        success: true,
        product: {
          ...mapProductCard(
            {
              id: raw.id ?? raw.pid ?? productId,
              nameEn: raw.nameEn ?? raw.nameen,
              sku: raw.sku,
              sellPrice: raw.sellPrice ?? raw.sellprice,
              bigImage: raw.bigImg ?? raw.bigimg,
              categoryId: raw.categoryId ?? raw.categoryid,
              weight: raw.weight,
            },
            supplierId
          ),
          description: raw.description ?? raw.descriptionEn ?? "",
          images,
          variants,
          metadata: {
            source: "cj_dropshipping",
            sourceRequestId: payload?.requestId,
            priceCurrency: "USD",
            stockVerified: false,
          },
        },
        source: {
          provider: "cj_dropshipping",
          endpoint: "product/productDetail/query",
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (action === "variants") {
      const productId = body?.productId;
      const productSku = body?.productSku;
      if (!productId && !productSku) {
        return json(
          { success: false, error: "productId or productSku is required" },
          400
        );
      }

      const params = new URLSearchParams();
      if (productId) params.set("pid", String(productId));
      if (productSku) params.set("productSku", String(productSku));
      if (body?.countryCode) params.set("countryCode", String(body.countryCode));

      const response = await fetch(
        `${baseUrl}/product/variant/query?${params.toString()}`,
        { method: "GET", headers: cjHeaders }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        return json(
          {
            success: false,
            error: payload?.message || "CJ variant query failed",
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      const rawVariants = Array.isArray(payload?.data) ? payload.data : [];
      return json({
        success: true,
        variants: rawVariants.map(mapVariant),
        source: {
          provider: "cj_dropshipping",
          endpoint: "product/variant/query",
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (action === "stock") {
      const variantId = body?.variantId;
      if (!variantId || typeof variantId !== "string") {
        return json({ success: false, error: "variantId is required" }, 400);
      }

      const response = await fetch(
        `${baseUrl}/product/stock/queryByVid?vid=${encodeURIComponent(variantId)}`,
        { method: "GET", headers: cjHeaders }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        return json(
          {
            success: false,
            error: payload?.message || "CJ stock query failed",
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      const warehouses = Array.isArray(payload?.data) ? payload.data : [];
      const totalStock = warehouses.reduce(
        (sum: number, row: any) =>
          sum + (Number(row?.totalInventoryNum ?? row?.storageNum ?? 0) || 0),
        0
      );

      return json({
        success: true,
        variantId,
        stock: totalStock,
        warehouses,
        source: {
          provider: "cj_dropshipping",
          endpoint: "product/stock/queryByVid",
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    return json({ success: false, error: "Unsupported CJ action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected CJ connector error";
    return json({ success: false, error: message }, 500);
  }
});
