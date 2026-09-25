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
