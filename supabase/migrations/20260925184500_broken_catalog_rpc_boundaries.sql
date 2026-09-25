-- P0 fail-closed boundary for legacy catalog RPCs.
-- shopopti-staging has no public.catalog_products relation.
-- These RPCs are therefore currently non-functional and should not be exposed
-- to signed-in browser clients until a canonical catalog source is implemented.

REVOKE EXECUTE ON FUNCTION public.get_catalog_products_secure(text,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_catalog_products_secure(text,text,integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_catalog_products_with_ratelimit(text,text,integer,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_catalog_products_with_ratelimit(text,text,integer,text,text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_public_catalog_products(text,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_catalog_products(text,text,integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_secure_catalog_products(text,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_secure_catalog_products(text,text,integer)
  TO service_role;
