-- P0 security status RPC boundary hardening.
-- Internal RLS/policy diagnostics should not be exposed to every signed-in user.
-- Verified on shopopti-staging before CI.

REVOKE EXECUTE ON FUNCTION public.verify_security_status()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_status()
  TO service_role;
