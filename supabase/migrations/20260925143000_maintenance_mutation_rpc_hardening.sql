-- P0 global maintenance mutation RPC hardening.
-- These SECURITY DEFINER functions mutate shared/global state and have no current
-- browser/Edge/workflow callers in the ShopOpti repository.
-- Restrict them to trusted service-side execution only.

REVOKE EXECUTE ON FUNCTION public.auto_sync_product_stock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_sync_product_stock() TO service_role;

REVOKE EXECUTE ON FUNCTION public.clean_expired_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clean_expired_cache() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_audit_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_audit_logs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_extension_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_extension_records() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_fulfillment_idempotency_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_fulfillment_idempotency_keys() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_api_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_api_logs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_import_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_import_jobs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_jobs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_product_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_product_history() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_translation_cache(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_translation_cache(integer) TO service_role;
