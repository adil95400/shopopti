-- P0 sensitive legacy RPC lockdown.
-- These privileged endpoints have no current repository callers.
-- Keep them service-side until explicitly re-exposed through audited Edge Functions.

REVOKE EXECUTE ON FUNCTION public.get_admin_catalog_intelligence(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_catalog_intelligence(text, integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_business_intelligence(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_intelligence(integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_customer_sensitive_info(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_sensitive_info(uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_supplier_sensitive_data(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_sensitive_data(uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.secure_admin_set_role(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_admin_set_role(uuid, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.revoke_user_token(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_token(uuid, uuid, text)
  TO service_role;
