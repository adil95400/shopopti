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
