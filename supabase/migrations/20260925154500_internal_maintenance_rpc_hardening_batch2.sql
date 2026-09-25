-- P0 internal maintenance/status RPC hardening, batch 2.
-- No current callers exist in the ShopOpti repository for this targeted set.

REVOKE EXECUTE ON FUNCTION public.seed_sample_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_sample_data() TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_pending_imports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_pending_imports() TO service_role;

REVOKE EXECUTE ON FUNCTION public.unlock_stuck_import_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_stuck_import_jobs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_dashboard_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_dashboard_notifications() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_final_security_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_final_security_status() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_security_configuration_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_configuration_status() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_security_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_status() TO service_role;

REVOKE EXECUTE ON FUNCTION public.security_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_status() TO service_role;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_translation_cache_stats() FROM PUBLIC, anon, authenticated;
