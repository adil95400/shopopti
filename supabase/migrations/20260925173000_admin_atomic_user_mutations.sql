-- P0 Admin atomic user mutation hardening.
-- Keeps privileged browser mutations out of the client and makes role replacement + audit atomic.

CREATE OR REPLACE FUNCTION public.admin_replace_user_role_atomic(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_new_role public.app_role,
  p_actor_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  old_roles text[];
BEGIN
  IF p_actor_id IS NULL OR p_target_user_id IS NULL OR p_new_role IS NULL THEN
    RAISE EXCEPTION 'actor, target and role are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_actor_id = p_target_user_id THEN
    RAISE EXCEPTION 'Self role mutation is forbidden'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS actor_role
    WHERE actor_role.user_id = p_actor_id
      AND actor_role.role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Admin role required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users AS target_user
    WHERE target_user.id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'Target user not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(array_agg(role::text ORDER BY role::text), ARRAY[]::text[])
  INTO old_roles
  FROM public.user_roles
  WHERE user_id = p_target_user_id;

  DELETE FROM public.user_roles
  WHERE user_id = p_target_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, p_new_role);

  INSERT INTO public.audit_logs (
    user_id,
    actor,
    actor_type,
    actor_email,
    action,
    action_category,
    severity,
    resource_type,
    resource_id,
    old_values,
    new_values,
    changed_fields,
    description,
    metadata
  ) VALUES (
    p_actor_id,
    p_actor_id::text,
    'admin',
    p_actor_email,
    'USER_ROLE_CHANGED',
    'admin',
    'info',
    'user',
    p_target_user_id::text,
    pg_catalog.jsonb_build_object('roles', old_roles),
    pg_catalog.jsonb_build_object('role', p_new_role::text),
    ARRAY['role']::text[],
    'Atomic Admin role replacement',
    pg_catalog.jsonb_build_object('status', 'success', 'atomic', true)
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'role', p_new_role::text,
    'old_roles', old_roles
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_replace_user_role_atomic(uuid, uuid, public.app_role, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_user_role_atomic(uuid, uuid, public.app_role, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_prepare_user_deletion(
  p_actor_id uuid,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  disabled_sessions integer := 0;
BEGIN
  IF p_actor_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'actor and target are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_actor_id = p_target_user_id THEN
    RAISE EXCEPTION 'Self deletion is forbidden'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS actor_role
    WHERE actor_role.user_id = p_actor_id
      AND actor_role.role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Admin role required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_sessions
  SET is_active = false,
      updated_at = pg_catalog.now()
  WHERE user_id = p_target_user_id
    AND COALESCE(is_active, true) = true;

  GET DIAGNOSTICS disabled_sessions = ROW_COUNT;

  INSERT INTO public.revoked_tokens (
    user_id,
    revoked_by,
    reason,
    expires_at
  ) VALUES (
    p_target_user_id,
    p_actor_id,
    'admin_delete',
    pg_catalog.now() + interval '24 hours'
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'disabled_sessions', disabled_sessions,
    'revocation_expires_at', pg_catalog.now() + interval '24 hours'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_prepare_user_deletion(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_user_deletion(uuid, uuid)
  TO service_role;
