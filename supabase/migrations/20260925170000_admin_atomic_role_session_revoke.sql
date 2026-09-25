-- P0 Admin atomic role replacement + session revocation.
-- Service-role only helpers used by the protected admin-users Edge Function.
-- Verified transactionally on shopopti-staging before CI.

CREATE OR REPLACE FUNCTION public.admin_replace_user_role_atomic(
  p_target_user_id uuid,
  p_new_role public.app_role,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_old_roles text[];
BEGIN
  IF current_user <> 'service_role'
     AND COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL OR p_new_role IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Missing required arguments' USING ERRCODE = '22023';
  END IF;

  IF p_target_user_id = p_actor_id THEN
    RAISE EXCEPTION 'Cannot change your own role' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_target_user_id) THEN
    RAISE EXCEPTION 'Target user not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(array_agg(ur.role::text ORDER BY ur.role::text), ARRAY[]::text[])
  INTO v_old_roles
  FROM public.user_roles ur
  WHERE ur.user_id = p_target_user_id;

  DELETE FROM public.user_roles
  WHERE user_id = p_target_user_id;

  INSERT INTO public.user_roles (user_id, role, created_at, updated_at)
  VALUES (p_target_user_id, p_new_role, now(), now());

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'old_roles', v_old_roles,
    'new_role', p_new_role::text
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_replace_user_role_atomic(uuid, public.app_role, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_user_role_atomic(uuid, public.app_role, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO auth, public, pg_temp
AS $function$
DECLARE
  v_session_count integer := 0;
  v_refresh_count integer := 0;
BEGIN
  IF current_user <> 'service_role'
     AND COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target user id' USING ERRCODE = '22023';
  END IF;

  UPDATE auth.refresh_tokens
  SET revoked = true,
      updated_at = now()
  WHERE user_id = p_target_user_id::text
    AND revoked IS DISTINCT FROM true;
  GET DIAGNOSTICS v_refresh_count = ROW_COUNT;

  DELETE FROM auth.sessions
  WHERE user_id = p_target_user_id;
  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'sessions_deleted', v_session_count,
    'refresh_tokens_revoked', v_refresh_count
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid)
  TO service_role;

-- Legacy admin RPCs are no longer browser-facing APIs. Admin actions flow through
-- the protected admin-users Edge Function which re-checks the caller's Admin role.
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
