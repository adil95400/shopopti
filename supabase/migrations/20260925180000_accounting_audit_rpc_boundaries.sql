-- P0 accounting/audit mutation RPC hardening.
-- These privileged mutations are internal accounting/security operations.
-- No current browser/Edge callers exist in the ShopOpti repository.
-- Verified on shopopti-staging before CI.

REVOKE EXECUTE ON FUNCTION public.create_audit_log(
  text,text,text,text,text,text,jsonb,jsonb,text,jsonb,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_audit_log(
  text,text,text,text,text,text,jsonb,jsonb,text,jsonb,text
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_usage_counter(uuid,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage_counter(uuid,text,integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_user_quota(uuid,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_quota(uuid,text,integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_consumption_and_check_alerts(
  uuid,text,text,jsonb,integer,numeric,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_consumption_and_check_alerts(
  uuid,text,text,jsonb,integer,numeric,text
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_admin_data_access(text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_data_access(text,text,uuid)
  TO service_role;
