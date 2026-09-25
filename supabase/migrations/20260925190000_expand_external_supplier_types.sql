-- Expand ShopOpti supplier provider types while removing AutoDS from new writes.
-- Existing legacy AutoDS rows are intentionally not deleted or rewritten.
-- The NOT VALID constraint is enforced for new/updated rows while allowing a safe cleanup
-- of any historical AutoDS records before a later VALIDATE CONSTRAINT.

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
  ADD COLUMN IF NOT EXISTS webhook_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS webhook_last_event_at timestamptz;

-- Harden supplier ownership policies for authenticated callers.
DROP POLICY IF EXISTS "Users can view their own external suppliers" ON public.external_suppliers;
CREATE POLICY "Users can view their own external suppliers"
  ON public.external_suppliers
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own external suppliers" ON public.external_suppliers;
CREATE POLICY "Users can insert their own external suppliers"
  ON public.external_suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own external suppliers" ON public.external_suppliers;
CREATE POLICY "Users can update their own external suppliers"
  ON public.external_suppliers
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own external suppliers" ON public.external_suppliers;
CREATE POLICY "Users can delete their own external suppliers"
  ON public.external_suppliers
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);


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

DROP POLICY IF EXISTS "Users can view own supplier snapshots" ON public.supplier_product_snapshots;
CREATE POLICY "Users can view own supplier snapshots"
  ON public.supplier_product_snapshots
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own supplier snapshots" ON public.supplier_product_snapshots;
CREATE POLICY "Users can insert own supplier snapshots"
  ON public.supplier_product_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own supplier snapshots" ON public.supplier_product_snapshots;
CREATE POLICY "Users can update own supplier snapshots"
  ON public.supplier_product_snapshots
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own supplier snapshots" ON public.supplier_product_snapshots;
CREATE POLICY "Users can delete own supplier snapshots"
  ON public.supplier_product_snapshots
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);


-- CJ webhook event ledger. message_id is stable across CJ retries and prevents duplicate processing.
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

DROP POLICY IF EXISTS "Users can view own CJ webhook events" ON public.cj_webhook_events;
CREATE POLICY "Users can view own CJ webhook events"
  ON public.cj_webhook_events
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);


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

DROP POLICY IF EXISTS "Users can view own supplier order dispatches" ON public.supplier_order_dispatches;
CREATE POLICY "Users can view own supplier order dispatches"
  ON public.supplier_order_dispatches
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);


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

DROP POLICY IF EXISTS "Users can view own supplier variant stock" ON public.supplier_variant_stock;
CREATE POLICY "Users can view own supplier variant stock"
  ON public.supplier_variant_stock
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);


-- Prevent browser clients from reading supplier credentials.
REVOKE ALL ON TABLE public.external_suppliers FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.external_suppliers FROM authenticated;

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

GRANT INSERT (
  name,
  type,
  api_key,
  api_secret,
  base_url,
  status,
  created_at,
  user_id
) ON TABLE public.external_suppliers TO authenticated;

GRANT UPDATE (
  name,
  type,
  api_key,
  api_secret,
  base_url
) ON TABLE public.external_suppliers TO authenticated;

GRANT DELETE ON TABLE public.external_suppliers TO authenticated;


-- Idempotency ledger for supplier-side write operations.
CREATE TABLE IF NOT EXISTS public.supplier_operation_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.external_suppliers(id) ON DELETE CASCADE,
  provider text NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  remote_reference text,
  response_payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplier_id, provider, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_supplier_operation_idempotency_lookup
  ON public.supplier_operation_idempotency
  (user_id, supplier_id, provider, operation, idempotency_key);

ALTER TABLE public.supplier_operation_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own supplier operation idempotency"
  ON public.supplier_operation_idempotency;
CREATE POLICY "Users can view their own supplier operation idempotency"
  ON public.supplier_operation_idempotency
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own supplier operation idempotency"
  ON public.supplier_operation_idempotency;
CREATE POLICY "Users can insert their own supplier operation idempotency"
  ON public.supplier_operation_idempotency
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own supplier operation idempotency"
  ON public.supplier_operation_idempotency;
CREATE POLICY "Users can update their own supplier operation idempotency"
  ON public.supplier_operation_idempotency
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
