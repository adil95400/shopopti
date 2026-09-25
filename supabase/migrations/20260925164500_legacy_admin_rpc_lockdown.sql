-- P0 legacy Admin RPC lockdown.
-- The current Admin UI uses protected Edge Functions; these legacy SECURITY DEFINER
-- RPCs have no repository callers and should not be directly callable by all signed-in users.

REVOKE EXECUTE ON FUNCTION public.admin_change_user_role(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_role(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_get_all_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.user_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.user_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_user_plan(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_plan(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO service_role;
