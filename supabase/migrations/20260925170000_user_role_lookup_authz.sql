-- P0 role lookup authorization hardening.
-- Keep the legacy signature for compatibility, but prevent arbitrary cross-user role enumeration.

CREATE OR REPLACE FUNCTION public.get_user_role(user_id_param uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  caller_is_service boolean := COALESCE((SELECT auth.role()), '') = 'service_role';
  caller_is_admin boolean := false;
  target_user_id uuid := COALESCE(user_id_param, caller_id);
BEGIN
  IF target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT caller_is_service THEN
    IF caller_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required'
        USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles AS caller_role
      WHERE caller_role.user_id = caller_id
        AND caller_role.role = 'admin'::public.app_role
    )
    INTO caller_is_admin;

    IF target_user_id IS DISTINCT FROM caller_id AND NOT caller_is_admin THEN
      RAISE EXCEPTION 'Cross-user role access denied'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.user_roles AS target_role
      WHERE target_role.user_id = target_user_id
        AND target_role.role = 'admin'::public.app_role
    )
    THEN 'admin'
    ELSE 'user'
  END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
