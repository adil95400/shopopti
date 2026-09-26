-- Shopify P0.1: real orders persistence and verified webhook ingestion.
-- This migration is intentionally additive and is not applied to production by this PR.

CREATE TABLE IF NOT EXISTS public.shopify_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.platform_connections(id) ON DELETE CASCADE,
  shopify_order_id text NOT NULL,
  order_name text NOT NULL,
  email text,
  customer_name text,
  financial_status text,
  fulfillment_status text,
  total_price numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  remote_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  remote_created_at timestamptz,
  remote_updated_at timestamptz,
  source text NOT NULL CHECK (source IN ('pull', 'webhook')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connection_id, shopify_order_id)
);

ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopify_orders_select_own ON public.shopify_orders;
CREATE POLICY shopify_orders_select_own
  ON public.shopify_orders
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.shopify_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.shopify_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopify_orders TO service_role;

CREATE INDEX IF NOT EXISTS shopify_orders_user_updated_idx
  ON public.shopify_orders (user_id, remote_updated_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.shopify_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.platform_connections(id) ON DELETE CASCADE,
  delivery_id text NOT NULL,
  topic text NOT NULL,
  shop_domain text NOT NULL,
  payload_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  last_error text,
  processed_at timestamptz,
  UNIQUE (connection_id, delivery_id)
);

ALTER TABLE public.shopify_webhook_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shopify_webhook_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopify_webhook_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.get_shopify_webhook_connection(p_shop_domain text)
RETURNS TABLE (
  connection_id uuid,
  user_id uuid,
  shop_domain text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    secret.connection_id,
    secret.user_id,
    secret.shop_domain
  FROM shopify_private.connection_secrets secret
  JOIN public.platform_connections pc ON pc.id = secret.connection_id
  WHERE current_user IN ('postgres', 'service_role')
    AND secret.shop_domain = lower(trim(p_shop_domain))
    AND CASE COALESCE(to_jsonb(pc)->>'status', to_jsonb(pc)->>'connection_status')
          WHEN 'active' THEN true
          WHEN 'connected' THEN true
          ELSE false
        END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shopify_webhook_connection(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shopify_webhook_connection(text)
  TO service_role;
