-- P0 global helper RPC boundary hardening.
-- These SECURITY DEFINER helpers read shared/global tables and have no current repo callers.
-- Keep them available only to trusted server-side execution.
-- Verified on shopopti-staging before CI.

REVOKE EXECUTE ON FUNCTION public.generate_bulk_order_number()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_bulk_order_number()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_dispute_number()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_dispute_number()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_rma_number()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rma_number()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_exchange_rate(varchar, varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_exchange_rate(varchar, varchar)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.convert_price(numeric, varchar, varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_price(numeric, varchar, varchar)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_scope_rate_limit(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_scope_rate_limit(text)
  TO service_role;
