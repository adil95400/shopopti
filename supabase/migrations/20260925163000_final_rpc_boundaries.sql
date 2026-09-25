-- P0 final RPC boundary hardening.
-- Keep only the intentionally public newsletter wrapper exposed to anon.
-- Preserve authenticated access only where the RPC semantics are user-facing.
-- Functions that accept arbitrary user identifiers or execute global automation
-- are restricted to trusted server-side callers.

-- Authenticated user-facing utilities.
REVOKE EXECUTE ON FUNCTION public.convert_price(numeric, varchar, varchar) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_price(numeric, varchar, varchar) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_exchange_rate(varchar, varchar) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exchange_rate(varchar, varchar) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.generate_bulk_order_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_bulk_order_number() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.generate_dispute_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_dispute_number() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.generate_rma_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_rma_number() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_marketplace_products(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(text, text, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_public_catalog_products(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_catalog_products(text, text, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_scope_rate_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_scope_rate_limit(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin_secure() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_secure() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_own_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_own_profile(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_session_valid() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_session_valid() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_user_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.search_suppliers(text, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_suppliers(text, text, text, text, integer, integer) TO authenticated, service_role;

-- Cross-user / global helpers: server-side only because they accept arbitrary
-- user ids or can execute global automation without an ownership boundary.
REVOKE EXECUTE ON FUNCTION public.get_marketplace_analytics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_analytics(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_feature_flag(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_feature_flag(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_plan(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_plan(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_supplier_owner(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_supplier_owner(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_token_revoked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_token_revoked(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_user_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_automation_trigger(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_automation_trigger(uuid, jsonb) TO service_role;

-- Internal newsletter implementation: only the validated public wrapper remains
-- directly exposed to anonymous callers.
REVOKE EXECUTE ON FUNCTION public.secure_newsletter_signup(text, text, inet) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_newsletter_signup(text, text, inet) TO service_role;

-- Legacy public newsletter wrapper is currently non-functional on staging because
-- no newsletter relation exists. Fail closed until a real persistence path is implemented.
REVOKE EXECUTE ON FUNCTION public.public_newsletter_signup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_newsletter_signup(text) TO service_role;
