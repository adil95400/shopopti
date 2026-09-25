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
