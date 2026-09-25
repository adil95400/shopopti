-- P0 Admin platform mutation hardening.
-- Feature-flag and support status mutations are committed atomically with their audit record.

CREATE OR REPLACE FUNCTION public.admin_set_feature_flag_enabled_atomic(
  p_actor_id uuid,
  p_flag_id uuid,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_flag record;
BEGIN
  IF p_actor_id IS NULL OR p_flag_id IS NULL OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'actor, flag and enabled are required'
      USING ERRCODE = '22023';
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

  SELECT id,key,is_enabled
  INTO current_flag
  FROM public.feature_flags
  WHERE id = p_flag_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature flag not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.feature_flags
  SET is_enabled = p_enabled,
      updated_at = pg_catalog.now()
  WHERE id = p_flag_id;

  INSERT INTO public.feature_flag_audit_log (
    flag_id,
    flag_key,
    action,
    actor_id,
    old_value,
    new_value,
    metadata
  ) VALUES (
    current_flag.id,
    current_flag.key,
    'updated',
    p_actor_id,
    pg_catalog.jsonb_build_object('is_enabled', current_flag.is_enabled),
    pg_catalog.jsonb_build_object('is_enabled', p_enabled),
    pg_catalog.jsonb_build_object(
      'source', 'admin-platform-controls',
      'operation', CASE WHEN p_enabled THEN 'enabled' ELSE 'disabled' END,
      'atomic', true
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', current_flag.id,
    'key', current_flag.key,
    'is_enabled', p_enabled
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_feature_flag_enabled_atomic(uuid,uuid,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_feature_flag_enabled_atomic(uuid,uuid,boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_support_ticket_status_atomic(
  p_actor_id uuid,
  p_actor_email text,
  p_ticket_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  old_status text;
BEGIN
  IF p_actor_id IS NULL OR p_ticket_id IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'actor, ticket and status are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_status NOT IN ('open','pending','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'Invalid ticket status'
      USING ERRCODE = '22023';
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

  SELECT status
  INTO old_status
  FROM public.support_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.support_tickets
  SET status = p_status,
      updated_at = pg_catalog.now()
  WHERE id = p_ticket_id;

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
    'SUPPORT_TICKET_STATUS_CHANGED',
    'support',
    'info',
    'support_ticket',
    p_ticket_id::text,
    pg_catalog.jsonb_build_object('status', old_status),
    pg_catalog.jsonb_build_object('status', p_status),
    ARRAY['status']::text[],
    'Atomic support ticket status update',
    pg_catalog.jsonb_build_object(
      'source', 'admin-platform-controls',
      'atomic', true
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', p_ticket_id,
    'status', p_status,
    'old_status', old_status
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_support_ticket_status_atomic(uuid,text,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_support_ticket_status_atomic(uuid,text,uuid,text)
  TO service_role;
