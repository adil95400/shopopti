-- Store marketplace credentials outside user-readable connection metadata.
-- Service-role callers can access this table; anon/authenticated roles cannot.

CREATE TABLE IF NOT EXISTS public.platform_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.platform_connections(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_connection_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_connection_secrets FROM anon;
REVOKE ALL ON TABLE public.platform_connection_secrets FROM authenticated;

COMMENT ON TABLE public.platform_connection_secrets IS
  'Server-only marketplace secrets. No anon/authenticated RLS policies by design.';
