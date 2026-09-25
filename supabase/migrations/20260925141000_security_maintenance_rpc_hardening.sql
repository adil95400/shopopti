-- P0 security maintenance RPC hardening.
-- These functions operate on global security/maintenance state and are not user APIs.
-- Keep browser roles out; preserve trusted service-side execution.

REVOKE EXECUTE ON FUNCTION public.check_security_configuration() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_security_configuration() TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_security_definer_functions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_security_definer_functions() TO service_role;

REVOKE EXECUTE ON FUNCTION public.configure_auth_security_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_auth_security_settings() TO service_role;

REVOKE EXECUTE ON FUNCTION public.configure_password_protection() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_password_protection() TO service_role;

REVOKE EXECUTE ON FUNCTION public.detect_suspicious_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_activity() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_import_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_import_records() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_gateway_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_gateway_logs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_security_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_security_events() TO service_role;
