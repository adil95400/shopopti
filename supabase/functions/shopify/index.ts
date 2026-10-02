import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const SHOPIFY_API_VERSION = "2026-07";

type ShopifyProductInput = {
  title: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  imageUrl?: string;
  price?: number | string;
};

type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeShopDomain(raw: string) {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    throw new Error("SHOPIFY_DOMAIN must be a valid *.myshopify.com domain");
  }
  return domain;
}

function normalizePrice(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Product price must be a non-negative number");
  }
  return parsed.toFixed(2);
}

async function shopifyGraphql<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const payload = (await response.json()) as ShopifyGraphqlResponse<T>;

  if (!response.ok) {
    throw new Error(`Shopify HTTP ${response.status}`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message || "Shopify GraphQL error").join("; "));
  }

  if (!payload.data) {
    throw new Error("Shopify returned no data");
  }

  return payload.data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const shopifyDomainRaw = Deno.env.get("SHOPIFY_DOMAIN");
    const shopifyToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ success: false, error: "Supabase server configuration is missing" }, 503);
    }

    if (!shopifyDomainRaw || !shopifyToken) {
      return json({ success: false, error: "Shopify server credentials are not configured" }, 503);
    }

    const authorization = req.headers.get("Authorization");
    const jwt = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

    if (!jwt) {
      return json({ success: false, error: "Authentication required" }, 401);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);

    if (userError || !userData.user) {
      return json({ success: false, error: "Invalid authentication token" }, 401);
    }

    const body = await req.json();
    const operation = body?.operation;

    if (operation !== "create_product") {
      return json(
        {
          success: false,
          error: "Unsupported Shopify operation",
          supportedOperations: ["create_product"],
        },
        400,
      );
    }

    const product = body?.product as ShopifyProductInput | undefined;
    if (!product?.title?.trim()) {
      return json({ success: false, error: "Product title is required" }, 400);
    }

    const shopDomain = normalizeShopDomain(shopifyDomainRaw);
    const price = normalizePrice(product.price);

    const media =
      product.imageUrl && /^https:\/\//i.test(product.imageUrl)
        ? [
            {
              originalSource: product.imageUrl,
              mediaContentType: "IMAGE",
              alt: product.title.trim(),
            },
          ]
        : [];

    const createMutation = `
      mutation CreateShopOptiProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product {
            id
            title
            status
            handle
            variants(first: 1) {
              nodes {
                id
                price
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    type CreatePayload = {
      productCreate: {
        product: {
          id: string;
          title: string;
          status: string;
          handle: string;
          variants: { nodes: Array<{ id: string; price: string }> };
        } | null;
        userErrors: Array<{ field?: string[]; message: string }>;
      };
    };

    const created = await shopifyGraphql<CreatePayload>(
      shopDomain,
      shopifyToken,
      createMutation,
      {
        product: {
          title: product.title.trim(),
          descriptionHtml: product.descriptionHtml || "",
          productType: product.productType || "",
          vendor: product.vendor || "ShopOpti",
          tags: Array.isArray(product.tags) ? product.tags.filter(Boolean) : [],
          status: "DRAFT",
        },
        media,
      },
    );

    const createErrors = created.productCreate.userErrors || [];
    if (createErrors.length || !created.productCreate.product) {
      return json(
        {
          success: false,
          error: createErrors.map((error) => error.message).join("; ") || "Shopify product creation failed",
          shopifyUserErrors: createErrors,
        },
        422,
      );
    }

    const remoteProduct = created.productCreate.product;
    let remoteVariant = remoteProduct.variants.nodes[0] || null;

    if (price && remoteVariant?.id) {
      const variantMutation = `
        mutation UpdateShopOptiVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      type VariantPayload = {
        productVariantsBulkUpdate: {
          productVariants: Array<{ id: string; price: string }> | null;
          userErrors: Array<{ field?: string[]; message: string }>;
        };
      };

      const updated = await shopifyGraphql<VariantPayload>(
        shopDomain,
        shopifyToken,
        variantMutation,
        {
          productId: remoteProduct.id,
          variants: [{ id: remoteVariant.id, price }],
        },
      );

      const variantErrors = updated.productVariantsBulkUpdate.userErrors || [];
      if (variantErrors.length) {
        return json(
          {
            success: false,
            error: "Shopify product was created but its price update failed",
            partial: true,
            shopifyProduct: remoteProduct,
            shopifyUserErrors: variantErrors,
          },
          502,
        );
      }

      remoteVariant = updated.productVariantsBulkUpdate.productVariants?.[0] || remoteVariant;
    }

    return json({
      success: true,
      mode: "real",
      apiVersion: SHOPIFY_API_VERSION,
      shopifyProduct: {
        id: remoteProduct.id,
        title: remoteProduct.title,
        handle: remoteProduct.handle,
        status: remoteProduct.status,
        variant: remoteVariant,
      },
      userId: userData.user.id,
    });
  } catch (error) {
    console.error("Shopify create_product failed:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected Shopify error",
      },
      500,
    );
  }
});
