-- P0 Shopify hardening: keep credentials server-only and persist real remote IDs.
-- This migration supports both the historical ShopOpti platform_connections
-- schema and the current staging schema without duplicating compatibility columns.

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
    CHECK (shop_domain ~ '^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$'),
  CONSTRAINT shopify_connection_secrets_token_check
    CHECK (length(access_token) BETWEEN 20 AND 512)
);

ALTER TABLE shopify_private.connection_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shopify_private.connection_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE shopify_private.connection_secrets TO service_role;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;
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

-- Preserve pre-existing Shopify tokens from either platform_connections schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_connections'
      AND column_name = 'platform_id'
  ) THEN
    INSERT INTO shopify_private.connection_secrets (
      connection_id, user_id, shop_domain, access_token
    )
    SELECT
      pc.id,
      pc.user_id,
      regexp_replace(
        regexp_replace(
          lower(COALESCE(pc.credentials->>'storeUrl', pc.credentials->>'shopDomain', '')),
          '^https?://', ''
        ),
        '/.*$', ''
      ),
      COALESCE(pc.credentials->>'accessToken', pc.credentials->>'access_token')
    FROM public.platform_connections pc
    WHERE pc.platform_id = 'shopify'
      AND COALESCE(pc.credentials->>'accessToken', pc.credentials->>'access_token') IS NOT NULL
      AND regexp_replace(
            regexp_replace(
              lower(COALESCE(pc.credentials->>'storeUrl', pc.credentials->>'shopDomain', '')),
              '^https?://', ''
            ),
            '/.*$', ''
          ) ~ '^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$'
    ON CONFLICT (connection_id) DO UPDATE
    SET shop_domain = EXCLUDED.shop_domain,
        access_token = EXCLUDED.access_token,
        updated_at = now();
  ELSE
    INSERT INTO shopify_private.connection_secrets (
      connection_id, user_id, shop_domain, access_token
    )
    SELECT
      pc.id,
      pc.user_id,
      regexp_replace(
        regexp_replace(
          lower(COALESCE(pc.credentials->>'storeUrl', pc.credentials->>'shopDomain', '')),
          '^https?://', ''
        ),
        '/.*$', ''
      ),
      COALESCE(pc.credentials->>'accessToken', pc.credentials->>'access_token')
    FROM public.platform_connections pc
    WHERE lower(pc.platform_name) = 'shopify'
      AND COALESCE(pc.credentials->>'accessToken', pc.credentials->>'access_token') IS NOT NULL
      AND regexp_replace(
            regexp_replace(
              lower(COALESCE(pc.credentials->>'storeUrl', pc.credentials->>'shopDomain', '')),
              '^https?://', ''
            ),
            '/.*$', ''
          ) ~ '^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$'
    ON CONFLICT (connection_id) DO UPDATE
    SET shop_domain = EXCLUDED.shop_domain,
        access_token = EXCLUDED.access_token,
        updated_at = now();
  END IF;
END
$$;

-- Clear exposed credentials and fail closed until a server-side validation succeeds.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_connections'
      AND column_name = 'platform_id'
  ) THEN
    UPDATE public.platform_connections
    SET credentials = '{}'::jsonb,
        status = 'inactive',
        disconnected_at = COALESCE(disconnected_at, now()),
        updated_at = now()
    WHERE platform_id = 'shopify'
      AND (
        COALESCE(credentials, '{}'::jsonb) <> '{}'::jsonb
        OR COALESCE(settings->>'validated_at', '') = ''
      );
  ELSE
    UPDATE public.platform_connections
    SET credentials = '{}'::jsonb,
        connection_status = 'disconnected',
        updated_at = now()
    WHERE lower(platform_name) = 'shopify'
      AND (
        COALESCE(credentials, '{}'::jsonb) <> '{}'::jsonb
        OR COALESCE(sync_settings->>'validated_at', '') = ''
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.guard_shopify_connection_client_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_new_platform text := COALESCE(to_jsonb(NEW)->>'platform_id', to_jsonb(NEW)->>'platform_name');
  v_old_platform text := CASE WHEN TG_OP = 'UPDATE'
    THEN COALESCE(to_jsonb(OLD)->>'platform_id', to_jsonb(OLD)->>'platform_name')
    ELSE NULL
  END;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role')
     AND (
       lower(COALESCE(v_new_platform, '')) = 'shopify'
       OR lower(COALESCE(v_old_platform, '')) = 'shopify'
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
  v_legacy_schema boolean;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'SHOPIFY_SERVER_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('shopify:' || p_user_id::text, 0)
  );

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_connections'
      AND column_name = 'platform_id'
  ) INTO v_legacy_schema;

  IF v_legacy_schema THEN
    EXECUTE
      'SELECT id FROM public.platform_connections
       WHERE user_id = $1 AND platform_id = ''shopify''
       ORDER BY created_at LIMIT 1 FOR UPDATE'
      INTO v_connection_id
      USING p_user_id;

    IF v_connection_id IS NULL THEN
      EXECUTE
        'INSERT INTO public.platform_connections
          (user_id, platform_id, name, type, credentials, settings,
           status, connected_at, disconnected_at)
         VALUES ($1, ''shopify'', $2, ''webstore'', ''{}''::jsonb, $3,
                 ''active'', now(), NULL)
         RETURNING id'
        INTO v_connection_id
        USING p_user_id, p_shop_name, COALESCE(p_settings, '{}'::jsonb);
    ELSE
      EXECUTE
        'UPDATE public.platform_connections
         SET name = $2,
             type = ''webstore'',
             credentials = ''{}''::jsonb,
             settings = $3,
             status = ''active'',
             connected_at = now(),
             disconnected_at = NULL,
             updated_at = now()
         WHERE id = $1'
        USING v_connection_id, p_shop_name, COALESCE(p_settings, '{}'::jsonb);
    END IF;
  ELSE
    EXECUTE
      'SELECT id FROM public.platform_connections
       WHERE user_id = $1 AND lower(platform_name) = ''shopify''
       ORDER BY created_at LIMIT 1 FOR UPDATE'
      INTO v_connection_id
      USING p_user_id;

    IF v_connection_id IS NULL THEN
      EXECUTE
        'INSERT INTO public.platform_connections
          (user_id, platform_name, connection_status, credentials,
           sync_settings, last_test_at, test_results, error_message)
         VALUES ($1, ''shopify'', ''connected'', ''{}''::jsonb,
                 $2, now(), jsonb_build_object(''validated'', true), NULL)
         RETURNING id'
        INTO v_connection_id
        USING p_user_id,
              COALESCE(p_settings, '{}'::jsonb) || jsonb_build_object('shop_name', p_shop_name);
    ELSE
      EXECUTE
        'UPDATE public.platform_connections
         SET connection_status = ''connected'',
             credentials = ''{}''::jsonb,
             sync_settings = $2,
             last_test_at = now(),
             test_results = jsonb_build_object(''validated'', true),
             error_message = NULL,
             updated_at = now()
         WHERE id = $1'
        USING v_connection_id,
              COALESCE(p_settings, '{}'::jsonb) || jsonb_build_object('shop_name', p_shop_name);
    END IF;
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

CREATE OR REPLACE FUNCTION public.get_shopify_connection_status(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  platform_id text,
  name text,
  type text,
  status text,
  settings jsonb,
  last_sync timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pc.id,
    'shopify'::text,
    COALESCE(
      to_jsonb(pc)->>'name',
      COALESCE(to_jsonb(pc)->'settings', to_jsonb(pc)->'sync_settings')->>'shop_name',
      'Shopify'
    ),
    'webstore'::text,
    CASE COALESCE(to_jsonb(pc)->>'status', to_jsonb(pc)->>'connection_status')
      WHEN 'active' THEN 'active'
      WHEN 'connected' THEN 'active'
      ELSE 'inactive'
    END,
    COALESCE(to_jsonb(pc)->'settings', to_jsonb(pc)->'sync_settings', '{}'::jsonb),
    COALESCE(
      NULLIF(to_jsonb(pc)->>'last_sync', '')::timestamptz,
      NULLIF(to_jsonb(pc)->>'last_sync_at', '')::timestamptz
    ),
    COALESCE(
      NULLIF(to_jsonb(pc)->>'connected_at', '')::timestamptz,
      NULLIF(to_jsonb(pc)->>'created_at', '')::timestamptz
    ),
    NULLIF(to_jsonb(pc)->>'disconnected_at', '')::timestamptz
  FROM public.platform_connections pc
  WHERE current_user IN ('postgres', 'service_role')
    AND pc.user_id = p_user_id
    AND lower(COALESCE(to_jsonb(pc)->>'platform_id', to_jsonb(pc)->>'platform_name', '')) = 'shopify'
  ORDER BY pc.created_at
  LIMIT 1;
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
  SELECT
    pc.id,
    secret.shop_domain,
    secret.access_token,
    COALESCE(to_jsonb(pc)->'settings', to_jsonb(pc)->'sync_settings', '{}'::jsonb)
  FROM public.platform_connections pc
  JOIN shopify_private.connection_secrets secret ON secret.connection_id = pc.id
  WHERE current_user IN ('postgres', 'service_role')
    AND pc.user_id = p_user_id
    AND lower(COALESCE(to_jsonb(pc)->>'platform_id', to_jsonb(pc)->>'platform_name', '')) = 'shopify'
    AND CASE COALESCE(to_jsonb(pc)->>'status', to_jsonb(pc)->>'connection_status')
          WHEN 'active' THEN true
          WHEN 'connected' THEN true
          ELSE false
        END
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
  v_legacy_schema boolean;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'SHOPIFY_SERVER_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_connections'
      AND column_name = 'platform_id'
  ) INTO v_legacy_schema;

  IF v_legacy_schema THEN
    EXECUTE
      'SELECT id FROM public.platform_connections
       WHERE user_id = $1 AND platform_id = ''shopify''
       ORDER BY created_at LIMIT 1 FOR UPDATE'
      INTO v_connection_id
      USING p_user_id;
  ELSE
    EXECUTE
      'SELECT id FROM public.platform_connections
       WHERE user_id = $1 AND lower(platform_name) = ''shopify''
       ORDER BY created_at LIMIT 1 FOR UPDATE'
      INTO v_connection_id
      USING p_user_id;
  END IF;

  IF v_connection_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM shopify_private.connection_secrets
  WHERE connection_id = v_connection_id;

  IF v_legacy_schema THEN
    EXECUTE
      'UPDATE public.platform_connections
       SET status = ''inactive'',
           credentials = ''{}''::jsonb,
           disconnected_at = now(),
           updated_at = now()
       WHERE id = $1'
      USING v_connection_id;
  ELSE
    EXECUTE
      'UPDATE public.platform_connections
       SET connection_status = ''disconnected'',
           credentials = ''{}''::jsonb,
           updated_at = now()
       WHERE id = $1'
      USING v_connection_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.save_shopify_connection(uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_shopify_connection_status(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_shopify_connection_secret(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.disconnect_shopify_connection(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_shopify_connection(uuid, text, text, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_shopify_connection_status(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_shopify_connection_secret(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.disconnect_shopify_connection(uuid)
  TO service_role;
