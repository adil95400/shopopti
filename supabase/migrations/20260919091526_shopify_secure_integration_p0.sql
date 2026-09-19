-- P0 Shopify hardening: keep credentials server-only and persist real remote IDs.

CREATE SCHEMA IF NOT EXISTS shopify_private;
REVOKE ALL ON SCHEMA shopify_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA shopify_private TO service_role;

CREATE TABLE IF NOT EXISTS shopify_private.connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.platform_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_domain text NOT NULL,
  access_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopify_connection_secrets_domain_check
    CHECK (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  CONSTRAINT shopify_connection_secrets_token_check
    CHECK (length(access_token) BETWEEN 20 AND 512)
);

ALTER TABLE shopify_private.connection_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shopify_private.connection_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE shopify_private.connection_secrets TO service_role;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;

CREATE TABLE IF NOT EXISTS public.shopify_product_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.platform_connections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shopify_product_id text,
  shopify_variant_id text,
  shopify_inventory_item_id text,
  shopify_location_id text,
  variant_mappings jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'failed')),
  last_error text,
  remote_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connection_id, product_id)
);

ALTER TABLE public.shopify_product_publications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shopify_publications_select_own ON public.shopify_product_publications;
CREATE POLICY shopify_publications_select_own
  ON public.shopify_product_publications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.shopify_product_publications FROM anon, authenticated;
GRANT SELECT ON TABLE public.shopify_product_publications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopify_product_publications TO service_role;

-- Preserve existing Shopify tokens before removing them from the exposed table.
INSERT INTO shopify_private.connection_secrets (
  connection_id,
  user_id,
  shop_domain,
  access_token
)
SELECT
  pc.id,
  pc.user_id,
  regexp_replace(
    regexp_replace(
      lower(COALESCE(pc.credentials->>'storeUrl', pc.credentials->>'shopDomain', '')),
      '^https?://',
      ''
    ),
    '/.*$',
    ''
  ),
  COALESCE(pc.credentials->>'accessToken', pc.credentials->>'access_token')
FROM public.platform_connections pc
WHERE pc.platform_id = 'shopify'
  AND COALESCE(pc.credentials->>'accessToken', pc.credentials->>'access_token') IS NOT NULL
  AND regexp_replace(
        regexp_replace(
          lower(COALESCE(pc.credentials->>'storeUrl', pc.credentials->>'shopDomain', '')),
          '^https?://',
          ''
        ),
        '/.*$',
        ''
      ) ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'
ON CONFLICT (connection_id) DO UPDATE
SET shop_domain = EXCLUDED.shop_domain,
    access_token = EXCLUDED.access_token,
    updated_at = now();

UPDATE public.platform_connections
SET credentials = '{}'::jsonb,
    type = 'webstore',
    status = 'inactive',
    disconnected_at = COALESCE(disconnected_at, now()),
    updated_at = now()
WHERE platform_id = 'shopify'
  AND (
    COALESCE(credentials, '{}'::jsonb) <> '{}'::jsonb
    OR COALESCE(settings->>'validated_at', '') = ''
  );

CREATE OR REPLACE FUNCTION public.guard_shopify_connection_client_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role')
     AND (
       NEW.platform_id = 'shopify'
       OR (TG_OP = 'UPDATE' AND OLD.platform_id = 'shopify')
     ) THEN
    RAISE EXCEPTION 'SHOPIFY_CONNECTION_SERVER_WRITE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_shopify_connection_client_writes
  ON public.platform_connections;
CREATE TRIGGER guard_shopify_connection_client_writes
BEFORE INSERT OR UPDATE ON public.platform_connections
FOR EACH ROW EXECUTE FUNCTION public.guard_shopify_connection_client_writes();

CREATE OR REPLACE FUNCTION public.save_shopify_connection(
  p_user_id uuid,
  p_shop_domain text,
  p_access_token text,
  p_shop_name text,
  p_settings jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_connection_id uuid;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'SHOPIFY_SERVER_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('shopify:' || p_user_id::text, 0)
  );

  SELECT id INTO v_connection_id
  FROM public.platform_connections
  WHERE user_id = p_user_id AND platform_id = 'shopify'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_connection_id IS NULL THEN
    INSERT INTO public.platform_connections (
      user_id, platform_id, name, type, credentials, settings,
      status, connected_at, disconnected_at
    ) VALUES (
      p_user_id, 'shopify', p_shop_name, 'webstore', '{}'::jsonb,
      COALESCE(p_settings, '{}'::jsonb), 'active', now(), NULL
    )
    RETURNING id INTO v_connection_id;
  ELSE
    UPDATE public.platform_connections
    SET name = p_shop_name,
        type = 'webstore',
        credentials = '{}'::jsonb,
        settings = COALESCE(p_settings, '{}'::jsonb),
        status = 'active',
        connected_at = now(),
        disconnected_at = NULL,
        updated_at = now()
    WHERE id = v_connection_id;
  END IF;

  INSERT INTO shopify_private.connection_secrets (
    connection_id, user_id, shop_domain, access_token
  ) VALUES (
    v_connection_id, p_user_id, p_shop_domain, p_access_token
  )
  ON CONFLICT (connection_id) DO UPDATE
  SET shop_domain = EXCLUDED.shop_domain,
      access_token = EXCLUDED.access_token,
      updated_at = now();

  RETURN v_connection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shopify_connection_secret(p_user_id uuid)
RETURNS TABLE (
  connection_id uuid,
  shop_domain text,
  access_token text,
  settings jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pc.id, secret.shop_domain, secret.access_token, pc.settings
  FROM public.platform_connections pc
  JOIN shopify_private.connection_secrets secret ON secret.connection_id = pc.id
  WHERE current_user IN ('postgres', 'service_role')
    AND pc.user_id = p_user_id
    AND pc.platform_id = 'shopify'
    AND pc.status = 'active'
  ORDER BY pc.created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.disconnect_shopify_connection(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_connection_id uuid;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'SHOPIFY_SERVER_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_connection_id
  FROM public.platform_connections
  WHERE user_id = p_user_id AND platform_id = 'shopify'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_connection_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM shopify_private.connection_secrets
  WHERE connection_id = v_connection_id;

  UPDATE public.platform_connections
  SET status = 'inactive',
      credentials = '{}'::jsonb,
      disconnected_at = now(),
      updated_at = now()
  WHERE id = v_connection_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.save_shopify_connection(uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_shopify_connection_secret(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.disconnect_shopify_connection(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_shopify_connection(uuid, text, text, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_shopify_connection_secret(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.disconnect_shopify_connection(uuid)
  TO service_role;
