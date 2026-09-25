-- Targeted Admin security hardening.
-- Restricts legacy SECURITY DEFINER functions and makes Admin/stat views honor
-- the querying role's privileges/RLS instead of the view owner's privileges.

-- Legacy Admin consumption RPCs expose cross-user data and do not perform an
-- internal Admin authorization check. Keep them server-side only.
REVOKE EXECUTE ON FUNCTION public.admin_get_all_users_consumption() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users_consumption() TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_get_consumption_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_consumption_overview() TO service_role;

-- Trigger helper functions are not client APIs. Direct execution from the Data
-- API is unnecessary and increases the privilege surface.
REVOKE EXECUTE ON FUNCTION public.audit_feature_flag_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_sensitive_operations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.background_jobs_insert_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.background_jobs_update_fn() FROM PUBLIC, anon, authenticated;

-- Ensure views use caller permissions and underlying RLS.
ALTER VIEW public.customers_admin SET (security_invoker = true);
ALTER VIEW public.supplier_stats SET (security_invoker = true);
