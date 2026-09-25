-- P0 fail-closed boundary for legacy marketplace catalog RPC.
-- shopopti-staging has no public.catalog_products relation, so this RPC is currently non-functional.
-- Restrict direct browser execution until a real canonical catalog source is implemented.

REVOKE EXECUTE ON FUNCTION public.get_marketplace_products(text,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(text,text,integer)
  TO service_role;
