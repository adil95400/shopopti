-- P0 strict Admin session validation.
-- Sensitive Admin Edge Functions validate the JWT session_id against auth.sessions
-- so revoked/deleted sessions cannot continue until access-token expiry.
-- Verified on shopopti-staging before CI.

CREATE OR REPLACE FUNCTION public.admin_session_is_active(
  p_user_id uuid,
  p_session_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO auth, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auth.sessions s
    WHERE s.id = p_session_id
      AND s.user_id = p_user_id
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_session_is_active(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_session_is_active(uuid, uuid)
  TO service_role;
