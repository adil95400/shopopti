-- P0 authenticated RPC boundary hardening.
-- Preserve intentional signed-in user APIs, but remove anonymous access.
-- Internal trigger/placeholder helpers are not browser APIs.

-- Pure calculator does not need owner privileges; preserve public behavior under caller privileges.
ALTER FUNCTION public.calculate_profit_margin(numeric, numeric) SECURITY INVOKER;

-- Authenticated user-scoped functions: anon must not call them.
REVOKE EXECUTE ON FUNCTION public.export_user_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_user_data() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.generate_api_key(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_api_key(text, text[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_plan_feature(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_plan_feature(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_security_rate_limit(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_security_rate_limit(text, integer, integer) TO authenticated, service_role;

-- Legacy zero-arg API key generator has no caller identity or persistence semantics.
REVOKE EXECUTE ON FUNCTION public.generate_api_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_api_key() TO service_role;

-- Internal helpers: direct browser execution is unnecessary.
REVOKE EXECUTE ON FUNCTION public.create_imported_reviews_table_if_not_exists() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_imported_reviews_table_if_not_exists() TO service_role;

REVOKE EXECUTE ON FUNCTION public.detect_catalog_scraping() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_fulfillment_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_default_warehouse() FROM PUBLIC, anon, authenticated;
