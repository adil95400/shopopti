-- P0 internal RPC hardening.
-- These functions are infrastructure helpers (trigger/cron), not browser APIs.
-- Keep the patch narrow and preserve service-side execution paths.

-- Trigger helpers: direct EXECUTE is unnecessary because triggers invoke them internally.
REVOKE EXECUTE ON FUNCTION public.automation_rules_delete_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.automation_rules_insert_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.automation_rules_update_fn() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.extension_jobs_insert_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.extension_jobs_update_fn() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.import_jobs_delete_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_jobs_insert_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_jobs_update_fn() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.product_import_jobs_insert_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.product_import_jobs_update_fn() FROM PUBLIC, anon, authenticated;

-- Cron/maintenance helpers: keep direct execution server-side only.
-- Staging pg_cron runs these jobs as postgres, so revoking browser roles is safe.
REVOKE EXECUTE ON FUNCTION public.auto_unlock_stuck_imports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_unlock_stuck_imports() TO service_role;

REVOKE EXECUTE ON FUNCTION public.archive_old_import_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_import_jobs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.gsc_indexation_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsc_indexation_cleanup() TO service_role;
