-- Supplier Hub P0 schema.
-- Self-contained for environments where the historical external_suppliers migration
-- was never applied. Existing rows are preserved and AutoDS is blocked from new writes.

CREATE TABLE IF NOT EXISTS public.external_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  api_key text NOT NULL DEFAULT 'server-managed',
  api_secret text,
  base_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'inactive',
  last_sync timestamptz,
  webhook_status text NOT NULL DEFAULT 'not_configured',
  webhook_last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.external_suppliers
  ADD COLUMN IF NOT EXISTS api_key text NOT NULL DEFAULT 'server-managed',
  ADD COLUMN IF NOT EXISTS api_secret text,
  ADD COLUMN IF NOT EXISTS base_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS last_sync timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS webhook_last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.external_suppliers
  DROP CONSTRAINT IF EXISTS external_suppliers_type_check;
ALTER TABLE public.external_suppliers
  ADD CONSTRAINT external_suppliers_type_check
  CHECK (
    type IN (
      'aliexpress',
      'cj_dropshipping',
      'bigbuy',
      'alibaba',
      'banggood',
      'dhgate',
      'cdiscount',
      'spocket',
      'eprolo',
      'custom_api',
      'custom_csv',
      'custom_xml',
      'custom_ftp'
    )
  ) NOT VALID;

ALTER TABLE public.external_suppliers
  DROP CONSTRAINT IF EXISTS external_suppliers_status_check;
ALTER TABLE public.external_suppliers
  ADD CONSTRAINT external_suppliers_status_check
  CHECK (status IN ('active', 'inactive', 'error')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_external_suppliers_user_id
  ON public.external_suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_external_suppliers_type
  ON public.external_suppliers(type);
CREATE INDEX IF NOT EXISTS idx_external_suppliers_status
  ON public.external_suppliers(status);

ALTER TABLE public.external_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own external suppliers"
  ON public.external_suppliers;
CREATE POLICY "Users can view their own external suppliers"
  ON public.external_suppliers
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own external suppliers"
  ON public.external_suppliers;
DROP POLICY IF EXISTS "Users can update their own external suppliers"
  ON public.external_suppliers;

DROP POLICY IF EXISTS "Users can delete their own external suppliers"
  ON public.external_suppliers;
CREATE POLICY "Users can delete their own external suppliers"
  ON public.external_suppliers
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Durable, idempotent supplier snapshots used by the canonical import pipeline.
CREATE TABLE IF NOT EXISTS public.supplier_product_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.external_suppliers(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  normalized jsonb NOT NULL,
  raw jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplier_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_product_snapshots_supplier
  ON public.supplier_product_snapshots (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_product_snapshots_user
  ON public.supplier_product_snapshots (user_id);

ALTER TABLE public.supplier_product_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own supplier snapshots"
  ON public.supplier_product_snapshots;
CREATE POLICY "Users can view own supplier snapshots"
  ON public.supplier_product_snapshots
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own supplier snapshots"
  ON public.supplier_product_snapshots;
DROP POLICY IF EXISTS "Users can update own supplier snapshots"
  ON public.supplier_product_snapshots;
DROP POLICY IF EXISTS "Users can delete own supplier snapshots"
  ON public.supplier_product_snapshots;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.supplier_product_snapshots
  FROM authenticated;
GRANT SELECT ON TABLE public.supplier_product_snapshots TO authenticated;

-- CJ webhook event ledger. message_id is stable across CJ retries.
CREATE TABLE IF NOT EXISTS public.cj_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.external_suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message_type text,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cj_webhook_events_supplier
  ON public.cj_webhook_events (supplier_id, received_at DESC);

ALTER TABLE public.cj_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own CJ webhook events"
  ON public.cj_webhook_events;
CREATE POLICY "Users can view own CJ webhook events"
  ON public.cj_webhook_events
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

GRANT SELECT ON TABLE public.cj_webhook_events TO authenticated;

-- Idempotent supplier order dispatch ledger.
CREATE TABLE IF NOT EXISTS public.supplier_order_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.external_suppliers(id) ON DELETE CASCADE,
  provider text NOT NULL,
  client_order_id text NOT NULL,
  remote_order_id text,
  status text NOT NULL DEFAULT 'pending',
  request_payload jsonb NOT NULL,
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplier_id, client_order_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_order_dispatches_supplier
  ON public.supplier_order_dispatches (supplier_id, created_at DESC);

ALTER TABLE public.supplier_order_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own supplier order dispatches"
  ON public.supplier_order_dispatches;
CREATE POLICY "Users can view own supplier order dispatches"
  ON public.supplier_order_dispatches
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

GRANT SELECT ON TABLE public.supplier_order_dispatches TO authenticated;

-- Webhook-driven CJ variant stock cache.
CREATE TABLE IF NOT EXISTS public.supplier_variant_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.external_suppliers(id) ON DELETE CASCADE,
  variant_id text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  warehouses jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'webhook',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplier_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_variant_stock_supplier
  ON public.supplier_variant_stock (supplier_id, updated_at DESC);

ALTER TABLE public.supplier_variant_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own supplier variant stock"
  ON public.supplier_variant_stock;
CREATE POLICY "Users can view own supplier variant stock"
  ON public.supplier_variant_stock
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

GRANT SELECT ON TABLE public.supplier_variant_stock TO authenticated;

-- Server-only CJ credential store.
-- A separate name avoids colliding with ShopOpti's existing supplier_credentials table.
CREATE TABLE IF NOT EXISTS public.supplier_connection_secrets (
  supplier_id uuid PRIMARY KEY REFERENCES public.external_suppliers(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  open_id text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_connection_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Browser roles cannot read supplier connection secrets"
  ON public.supplier_connection_secrets;
CREATE POLICY "Browser roles cannot read supplier connection secrets"
  ON public.supplier_connection_secrets
  FOR SELECT TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "Browser roles cannot insert supplier connection secrets"
  ON public.supplier_connection_secrets;
CREATE POLICY "Browser roles cannot insert supplier connection secrets"
  ON public.supplier_connection_secrets
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Browser roles cannot update supplier connection secrets"
  ON public.supplier_connection_secrets;
CREATE POLICY "Browser roles cannot update supplier connection secrets"
  ON public.supplier_connection_secrets
  FOR UPDATE TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Browser roles cannot delete supplier connection secrets"
  ON public.supplier_connection_secrets;
CREATE POLICY "Browser roles cannot delete supplier connection secrets"
  ON public.supplier_connection_secrets
  FOR DELETE TO anon, authenticated
  USING (false);

REVOKE ALL ON TABLE public.supplier_connection_secrets
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.supplier_connection_secrets TO service_role;

-- Move legacy CJ access tokens out of external_suppliers if any exist.
INSERT INTO public.supplier_connection_secrets (
  supplier_id,
  provider,
  access_token,
  open_id,
  updated_at
)
SELECT
  id,
  type,
  api_key,
  api_secret,
  now()
FROM public.external_suppliers
WHERE type = 'cj_dropshipping'
  AND api_key IS NOT NULL
  AND api_key <> ''
  AND api_key <> 'server-managed'
ON CONFLICT (supplier_id) DO NOTHING;

UPDATE public.external_suppliers
SET api_key = 'server-managed',
    api_secret = NULL
WHERE type = 'cj_dropshipping'
  AND api_key IS NOT NULL
  AND api_key <> '';

-- Browser clients can read only non-secret supplier metadata and delete owned connections.
REVOKE ALL ON TABLE public.external_suppliers FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.external_suppliers FROM authenticated;

GRANT SELECT (
  id,
  name,
  type,
  base_url,
  status,
  last_sync,
  webhook_status,
  webhook_last_event_at,
  created_at,
  user_id
) ON TABLE public.external_suppliers TO authenticated;

GRANT DELETE ON TABLE public.external_suppliers TO authenticated;

-- Platform-level connector availability controlled by canonical user_roles.
CREATE TABLE IF NOT EXISTS public.supplier_connector_settings (
  provider text PRIMARY KEY,
  status text NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('enabled', 'maintenance', 'disabled')),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.supplier_connector_settings (provider, status)
VALUES
  ('cj_dropshipping', 'disabled'),
  ('bigbuy', 'disabled'),
  ('aliexpress', 'disabled'),
  ('alibaba', 'disabled'),
  ('banggood', 'disabled'),
  ('dhgate', 'disabled'),
  ('cdiscount', 'disabled'),
  ('spocket', 'disabled'),
  ('eprolo', 'disabled'),
  ('custom_api', 'disabled'),
  ('custom_csv', 'disabled'),
  ('custom_xml', 'disabled'),
  ('custom_ftp', 'disabled')
ON CONFLICT (provider) DO NOTHING;

ALTER TABLE public.supplier_connector_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view supplier connector settings"
  ON public.supplier_connector_settings;
CREATE POLICY "Authenticated users can view supplier connector settings"
  ON public.supplier_connector_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert supplier connector settings"
  ON public.supplier_connector_settings;
CREATE POLICY "Admins can insert supplier connector settings"
  ON public.supplier_connector_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_roles.user_id = (select auth.uid())
        AND user_roles.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update supplier connector settings"
  ON public.supplier_connector_settings;
CREATE POLICY "Admins can update supplier connector settings"
  ON public.supplier_connector_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_roles.user_id = (select auth.uid())
        AND user_roles.role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_roles.user_id = (select auth.uid())
        AND user_roles.role::text = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.supplier_connector_settings TO authenticated;
