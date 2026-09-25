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
      priceVerified: price > 0,
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !clientKey || !serviceRoleKey) {
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
    const admin = createClient(supabaseUrl, serviceRoleKey, {
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
      .select("id,type,base_url,user_id,status")
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

    const { data: credentials, error: credentialError } = await admin
      .from("external_suppliers")
      .select("api_key,api_secret")
      .eq("id", supplierId)
      .single();

    if (credentialError || !credentials?.api_key) {
      return json({ success: false, error: "CJ credential is missing" }, 422);
    }

    const baseUrl = normalizeBaseUrl(supplier.base_url);
    const cjHeaders = {
      "CJ-Access-Token": credentials.api_key,
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

    if (action === "import") {
      const productIds = body?.productIds;
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return json({ success: false, error: "productIds are required" }, 400);
      }

      const imported: Array<{ externalId: string; snapshotId: string }> = [];
      const failed: Array<{ externalId: string; error: string }> = [];

      for (const rawId of productIds) {
        const productId = String(rawId ?? "").trim();
        if (!productId) continue;

        try {
          const detailResponse = await fetch(`${baseUrl}/product/productDetail/query`, {
            method: "POST",
            headers: { ...cjHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ id: productId }),
          });

          const detailPayload = await detailResponse.json().catch(() => null);
          if (!detailResponse.ok || detailPayload?.result !== true || !detailPayload?.data) {
            throw new Error(detailPayload?.message || "CJ product detail failed");
          }

          const raw = detailPayload.data;
          const images = Array.isArray(raw.img)
            ? raw.img
            : Array.isArray(raw.productImageSet)
              ? raw.productImageSet
              : [raw.bigImg ?? raw.bigimg].filter(Boolean);

          const variants = Array.isArray(raw.variants)
            ? raw.variants.map(mapVariant)
            : [];

          const mapped = mapProductCard(
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
          );

          let stock: number | null = null;
          const firstVariantId = variants[0]?.id;
          if (firstVariantId) {
            const stockResponse = await fetch(
              `${baseUrl}/product/stock/queryByVid?vid=${encodeURIComponent(firstVariantId)}`,
              { method: "GET", headers: cjHeaders }
            );
            const stockPayload = await stockResponse.json().catch(() => null);
            if (stockResponse.ok && stockPayload?.result === true) {
              const warehouses = Array.isArray(stockPayload?.data) ? stockPayload.data : [];
              stock = warehouses.reduce(
                (sum: number, row: any) =>
                  sum + (Number(row?.totalInventoryNum ?? row?.storageNum ?? 0) || 0),
                0
              );
            }
          }

          const { data: snapshot, error: snapshotError } = await supabase
            .from("supplier_product_snapshots")
            .upsert(
              {
                user_id: user.id,
                supplier_id: supplierId,
                provider: "cj_dropshipping",
                external_id: productId,
                title: mapped.name,
                description: raw.description ?? raw.descriptionEn ?? "",
                price: mapped.price || null,
                currency: "USD",
                stock,
                images,
                variants,
                source_payload: {
                  requestId: detailPayload?.requestId ?? null,
                  sku: mapped.sku ?? null,
                  category: mapped.category,
                  fetchedFrom: "product/productDetail/query",
                },
                fetched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,supplier_id,provider,external_id" }
            )
            .select("id")
            .single();

          if (snapshotError || !snapshot) {
            throw new Error(snapshotError?.message || "Unable to persist CJ snapshot");
          }

          imported.push({ externalId: productId, snapshotId: snapshot.id });
        } catch (error) {
          failed.push({
            externalId: productId,
            error: error instanceof Error ? error.message : "CJ import failed",
          });
        }
      }

      await supabase
        .from("external_suppliers")
        .update({ last_sync: new Date().toISOString() })
        .eq("id", supplierId);

      return json({
        success: failed.length === 0,
        importedCount: imported.length,
        failedCount: failed.length,
        imported,
        failed,
        source: {
          provider: "cj_dropshipping",
          endpoint: "product/productDetail/query",
          persistedAs: "supplier_product_snapshots",
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


    if (action === "webhook_set") {
      if (!credentials.api_secret) {
        return json(
          { success: false, error: "CJ openId is required before enabling signed webhooks" },
          422
        );
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/providers/cj_webhook`;
      const setting = {
        product: { type: "ENABLE", callbackUrls: [callbackUrl] },
        stock: { type: "ENABLE", callbackUrls: [callbackUrl] },
        order: { type: "ENABLE", callbackUrls: [callbackUrl] },
        logistics: { type: "ENABLE", callbackUrls: [callbackUrl] },
      };

      const response = await fetch(`${baseUrl}/webhook/set`, {
        method: "POST",
        headers: { ...cjHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        return json(
          {
            success: false,
            error: payload?.message || "CJ webhook configuration failed",
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      return json({
        success: true,
        callbackUrl,
        data: payload?.data ?? true,
        source: {
          provider: "cj_dropshipping",
          endpoint: "webhook/set",
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (action === "webhook_subscribe_products") {
      const requestedProductIds = body?.payload?.productIds ?? body?.productIds;
      const productIds = Array.isArray(requestedProductIds)
        ? requestedProductIds.filter((value: unknown) => typeof value === "string" && value.length > 0)
        : [];

      if (productIds.length === 0 || productIds.length > 100) {
        return json(
          { success: false, error: "productIds must contain between 1 and 100 products" },
          400
        );
      }

      const response = await fetch(`${baseUrl}/webhook/product/subscribe`, {
        method: "POST",
        headers: { ...cjHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, subscribeAll: false }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        return json(
          {
            success: false,
            error: payload?.message || "CJ product webhook subscription failed",
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      return json({
        success: true,
        data: payload?.data,
        source: {
          provider: "cj_dropshipping",
          endpoint: "webhook/product/subscribe",
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (action === "snapshot_import") {
      const productIds = Array.isArray(body?.productIds)
        ? body.productIds.filter((value: unknown) => typeof value === "string" && value.length > 0)
        : [];

      if (productIds.length === 0) {
        return json({ success: false, error: "productIds are required" }, 400);
      }

      if (productIds.length > 50) {
        return json({ success: false, error: "A maximum of 50 products can be imported per request" }, 400);
      }

      const imported: Array<{ externalId: string; snapshotId: string }> = [];
      const failed: Array<{ externalId: string; error: string }> = [];

      for (const externalId of productIds) {
        try {
          const response = await fetch(`${baseUrl}/product/productDetail/query`, {
            method: "POST",
            headers: { ...cjHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ id: externalId }),
          });

          const payload = await response.json().catch(() => null);
          if (!response.ok || payload?.result !== true || !payload?.data) {
            failed.push({
              externalId,
              error: String(payload?.message || "CJ product detail failed"),
            });
            continue;
          }

          const raw = payload.data;
          const images = Array.isArray(raw.img)
            ? raw.img
            : Array.isArray(raw.productImageSet)
              ? raw.productImageSet
              : [raw.bigImg ?? raw.bigimg].filter(Boolean);

          const normalized = {
            ...mapProductCard(
              {
                id: raw.id ?? raw.pid ?? externalId,
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
            variants: Array.isArray(raw.variants) ? raw.variants.map(mapVariant) : [],
            metadata: {
              source: "cj_dropshipping",
              sourceRequestId: payload?.requestId,
              priceCurrency: "USD",
              stockVerified: false,
              fetchedAt: new Date().toISOString(),
            },
          };

          const { data: snapshot, error: snapshotError } = await supabase
            .from("supplier_product_snapshots")
            .upsert(
              {
                user_id: user.id,
                supplier_id: supplierId,
                provider: "cj_dropshipping",
                external_id: externalId,
                normalized,
                raw,
                fetched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,supplier_id,external_id" }
            )
            .select("id")
            .single();

          if (snapshotError || !snapshot) {
            failed.push({
              externalId,
              error: snapshotError?.message || "Snapshot persistence failed",
            });
            continue;
          }

          imported.push({ externalId, snapshotId: snapshot.id });
        } catch (error) {
          failed.push({
            externalId,
            error: error instanceof Error ? error.message : "Unexpected snapshot import error",
          });
        }
      }

      if (imported.length > 0) {
        await admin
          .from("external_suppliers")
          .update({ last_sync: new Date().toISOString() })
          .eq("id", supplierId);
      }

      return json({
        success: failed.length === 0,
        importedCount: imported.length,
        failedCount: failed.length,
        imported,
        failed,
        source: {
          provider: "cj_dropshipping",
          endpoint: "product/productDetail/query",
          fetchedAt: new Date().toISOString(),
        },
      }, failed.length === productIds.length ? 502 : 200);
    }

    if (action === "freight") {
      const payloadInput = body?.payload;
      if (!payloadInput || typeof payloadInput !== "object") {
        return json({ success: false, error: "payload is required" }, 400);
      }

      const response = await fetch(`${baseUrl}/logistic/freightCalculate`, {
        method: "POST",
        headers: { ...cjHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payloadInput),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        return json(
          {
            success: false,
            error: payload?.message || "CJ freight calculation failed",
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      return json({
        success: true,
        data: payload,
        source: {
          provider: "cj_dropshipping",
          endpoint: "logistic/freightCalculate",
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (action === "order_create") {
      const payloadInput = body?.payload;
      if (!payloadInput || typeof payloadInput !== "object") {
        return json({ success: false, error: "payload is required" }, 400);
      }

      const clientOrderId =
        typeof payloadInput.orderNumber === "string" ? payloadInput.orderNumber.trim() : "";
      if (!clientOrderId) {
        return json({ success: false, error: "orderNumber is required" }, 400);
      }

      const { data: existing } = await admin
        .from("supplier_order_dispatches")
        .select("id,remote_order_id,status,response_payload")
        .eq("supplier_id", supplierId)
        .eq("client_order_id", clientOrderId)
        .maybeSingle();

      if (existing?.remote_order_id) {
        return json({
          success: true,
          replayed: true,
          data: existing.response_payload,
          source: {
            provider: "cj_dropshipping",
            endpoint: "supplier_order_dispatches",
            fetchedAt: new Date().toISOString(),
          },
        });
      }

      if (existing?.status === "pending") {
        return json(
          { success: false, error: "This CJ order is already being dispatched" },
          409
        );
      }

      if (!existing) {
        const { error: reserveError } = await admin
          .from("supplier_order_dispatches")
          .insert({
            user_id: user.id,
            supplier_id: supplierId,
            provider: "cj_dropshipping",
            client_order_id: clientOrderId,
            status: "pending",
            request_payload: payloadInput,
          });

        if (reserveError) {
          if (reserveError.code === "23505") {
            return json(
              { success: false, error: "This CJ order is already being dispatched" },
              409
            );
          }
          return json({ success: false, error: "Order reservation failed" }, 500);
        }
      } else {
        await admin
          .from("supplier_order_dispatches")
          .update({
            status: "pending",
            request_payload: payloadInput,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }

      const endpoint = "shopping/order/createOrderV3";
      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method: "POST",
        headers: { ...cjHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payloadInput),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        await admin
          .from("supplier_order_dispatches")
          .update({
            status: "failed",
            response_payload: payload,
            updated_at: new Date().toISOString(),
          })
          .eq("supplier_id", supplierId)
          .eq("client_order_id", clientOrderId);

        return json(
          {
            success: false,
            error: payload?.message || "CJ order_create failed",
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      const remoteData = payload?.data ?? {};
      const remoteOrderId =
        remoteData?.orderId ??
        remoteData?.cjOrderId ??
        remoteData?.orderNum ??
        remoteData?.cjOrderCode ??
        null;

      await admin
        .from("supplier_order_dispatches")
        .update({
          remote_order_id: remoteOrderId ? String(remoteOrderId) : null,
          status: String(remoteData?.orderStatus ?? "created"),
          response_payload: payload,
          updated_at: new Date().toISOString(),
        })
        .eq("supplier_id", supplierId)
        .eq("client_order_id", clientOrderId);

      return json({
        success: true,
        replayed: false,
        data: payload,
        source: {
          provider: "cj_dropshipping",
          endpoint,
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (action === "order_confirm" || action === "order_pay") {
      const payloadInput = body?.payload;
      if (!payloadInput || typeof payloadInput !== "object") {
        return json({ success: false, error: "payload is required" }, 400);
      }

      const endpoint =
        action === "order_confirm"
          ? "shopping/order/confirmOrder"
          : "shopping/pay/payBalanceV2";

      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method: "POST",
        headers: { ...cjHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payloadInput),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        return json(
          {
            success: false,
            error: payload?.message || `CJ ${action} failed`,
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      return json({
        success: true,
        data: payload,
        source: {
          provider: "cj_dropshipping",
          endpoint,
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (action === "order_detail" || action === "tracking" || action === "balance") {
      const params = new URLSearchParams();
      const inputParams = body?.params ?? {};
      for (const [key, value] of Object.entries(inputParams)) {
        if (value === undefined || value === null || value === "") continue;
        params.set(key, String(value));
      }

      const endpoint =
        action === "order_detail"
          ? "shopping/order/getOrderDetail"
          : action === "tracking"
            ? "logistic/trackInfo"
            : "shopping/pay/getBalance";

      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`${baseUrl}/${endpoint}${suffix}`, {
        method: "GET",
        headers: cjHeaders,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.result !== true) {
        return json(
          {
            success: false,
            error: payload?.message || `CJ ${action} failed`,
            requestId: payload?.requestId,
          },
          response.status >= 400 ? response.status : 502
        );
      }

      return json({
        success: true,
        data: payload,
        source: {
          provider: "cj_dropshipping",
          endpoint,
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
