-- P0 Admin RBAC hardening.
-- This migration is additive and fail-closed: authenticated users can read only
-- their own role row; role mutation remains reserved to service-role / database admin.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'superadmin');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT ur.role FROM public.user_roles AS ur WHERE ur.user_id = auth.uid()),
    'user'::public.app_role
  );
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_app_role() IN ('admin'::public.app_role, 'superadmin'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_app_role() = 'superadmin'::public.app_role;
$$;

REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- Replace legacy policies that attempted to read auth.users.role directly.
DROP POLICY IF EXISTS "Admin manage inventory settings" ON public.inventory_settings;
CREATE POLICY "Admin manage inventory settings"
  ON public.inventory_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users manage own AB tests" ON public.ab_tests;
CREATE POLICY "Admins manage AB tests"
  ON public.ab_tests
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users manage own funnels" ON public.funnels;
CREATE POLICY "Admins manage funnels"
  ON public.funnels
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.user_roles IS
  'Authoritative application RBAC roles. Mutations must be performed only by trusted server-side code.';

COMMENT ON FUNCTION public.current_app_role() IS
  'Returns the authenticated user application role, defaulting to user when no assignment exists.';
