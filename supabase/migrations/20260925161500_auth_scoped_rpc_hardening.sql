-- P0 authenticated RPC boundary hardening, batch 2.
-- These functions already depend on auth.uid()/authenticated context.
-- Remove anonymous execution while preserving signed-in and service-side use.

REVOKE EXECUTE ON FUNCTION public.generate_custom_report(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_custom_report(uuid, timestamptz, timestamptz) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_audit_statistics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_audit_statistics(integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_current_user_admin_mode() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_admin_mode() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_analytics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_translation_usage_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_translation_usage_summary(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_quota_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_quota_status() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_secure_data(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_secure_data(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, jsonb, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_sensitive_data_access(text, uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.validate_customer_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_customer_access(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.verify_security_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_security_status() TO authenticated, service_role;
