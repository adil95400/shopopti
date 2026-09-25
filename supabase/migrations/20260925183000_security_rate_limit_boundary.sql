-- P0 security rate-limit RPC boundary hardening.
-- This helper accepts caller-controlled max/window parameters and has no current repo callers.
-- Keep it server-side until limits come from trusted configuration rather than request arguments.

REVOKE EXECUTE ON FUNCTION public.check_security_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_security_rate_limit(text, integer, integer)
  TO service_role;
