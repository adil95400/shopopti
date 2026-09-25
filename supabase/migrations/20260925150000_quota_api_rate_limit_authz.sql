-- P0 quota/API rate-limit authorization hardening.
-- Keep user quota checks authenticated and owner-scoped; keep API-key rate checks server-side.

CREATE OR REPLACE FUNCTION public.check_quota(user_id_param uuid, quota_key_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_usage INTEGER := 0;
  limit_value INTEGER := 0;
  user_plan public.plan_type;
  caller_id uuid := auth.uid();
  caller_role text := COALESCE(auth.jwt()->>'role', '');
BEGIN
  IF caller_role <> 'service_role'
     AND (caller_id IS NULL OR caller_id IS DISTINCT FROM user_id_param) THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  SELECT plan INTO user_plan
  FROM public.profiles
  WHERE id = user_id_param;

  SELECT pl.limit_value INTO limit_value
  FROM public.plans_limits pl
  WHERE pl.plan = user_plan
    AND pl.limit_key = quota_key_param;

  IF limit_value IS NULL OR limit_value = -1 THEN
    RETURN true;
  END IF;

  SELECT COALESCE(uq.current_count, 0) INTO current_usage
  FROM public.user_quotas uq
  WHERE uq.user_id = user_id_param
    AND uq.quota_key = quota_key_param
    AND uq.reset_date > now();

  RETURN current_usage < limit_value;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_quota(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_quota(uuid, text) TO authenticated, service_role;

-- API-key rate-limit evaluation accepts arbitrary key ids and is a server concern.
REVOKE EXECUTE ON FUNCTION public.check_api_rate_limit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(uuid, integer, integer) TO service_role;
