-- P0 Admin RBAC hardening.
-- Aligns the app with ShopOpti's existing role model and remains safe to replay.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'staff', 'agency');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS "user_roles_select_own_v2" ON public.user_roles;
CREATE POLICY "user_roles_select_own_v2"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "user_roles_admin_manage_v2" ON public.user_roles;
CREATE POLICY "user_roles_admin_manage_v2"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

-- Replace legacy policies that queried auth.users.role directly.
DROP POLICY IF EXISTS "Admin manage inventory settings" ON public.inventory_settings;
CREATE POLICY "Admin manage inventory settings"
  ON public.inventory_settings
  FOR ALL
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Users manage own AB tests" ON public.ab_tests;
DROP POLICY IF EXISTS "Admins manage AB tests" ON public.ab_tests;
CREATE POLICY "Admins manage AB tests"
  ON public.ab_tests
  FOR ALL
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Users manage own funnels" ON public.funnels;
DROP POLICY IF EXISTS "Admins manage funnels" ON public.funnels;
CREATE POLICY "Admins manage funnels"
  ON public.funnels
  FOR ALL
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

COMMENT ON TABLE public.user_roles IS
  'Authoritative application role assignments. Role mutation is controlled by admin/server-side authorization.';
