-- P0 Admin Platform atomic mutation + audit helpers.
-- Service-role only; called by the protected admin-platform Edge Function.

CREATE OR REPLACE FUNCTION public.admin_set_feature_flag_enabled_atomic(
  p_flag_id uuid,
  p_enabled boolean,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_key text;
  v_old_enabled boolean;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT key, is_enabled
  INTO v_key, v_old_enabled
  FROM public.feature_flags
  WHERE id = p_flag_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flag not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.feature_flags
  SET is_enabled = p_enabled,
      updated_at = now()
  WHERE id = p_flag_id;

  INSERT INTO public.feature_flag_audit_log (
    flag_id,
    flag_key,
    action,
    actor_id,
    old_value,
    new_value,
    metadata
  )
  VALUES (
    p_flag_id,
    v_key,
    CASE WHEN p_enabled THEN 'enabled' ELSE 'disabled' END,
    p_actor_id,
    jsonb_build_object('is_enabled', v_old_enabled),
    jsonb_build_object('is_enabled', p_enabled),
    jsonb_build_object('source', 'admin-platform-controls', 'atomic', true)
  );

  RETURN jsonb_build_object(
    'success', true,
    'flag_id', p_flag_id,
    'flag_key', v_key,
    'old_enabled', v_old_enabled,
    'is_enabled', p_enabled
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_feature_flag_enabled_atomic(uuid, boolean, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_feature_flag_enabled_atomic(uuid, boolean, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_support_ticket_status_atomic(
  p_ticket_id uuid,
  p_status text,
  p_actor_id uuid,
  p_actor_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_old_status text;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('open', 'pending', 'in_progress', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
  END IF;

  SELECT status
  INTO v_old_status
  FROM public.support_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.support_tickets
  SET status = p_status,
      updated_at = now()
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
    description,
    old_values,
    new_values,
    metadata
  )
  VALUES (
    p_actor_id,
    p_actor_id::text,
    'admin',
    p_actor_email,
    'SUPPORT_TICKET_STATUS_CHANGED',
    'support',
    'info',
    'support_ticket',
    p_ticket_id::text,
    'Support ticket status changed',
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_status),
    jsonb_build_object('source', 'admin-platform-controls', 'atomic', true)
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'old_status', v_old_status,
    'status', p_status
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_support_ticket_status_atomic(uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_support_ticket_status_atomic(uuid, text, uuid, text)
  TO service_role;
