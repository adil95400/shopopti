-- P0 function search_path hardening.
-- Pin search_path for functions flagged by Supabase Database Advisor.
-- Keep public first because existing bodies use unqualified public objects; pg_temp remains available last.

ALTER FUNCTION public.amazon_set_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.clean_expired_supplier_cache() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_inventory_timestamp() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_import_jobs_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_updated_at_timestamp() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_extension_stats() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.calculate_product_ai_score(uuid) SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_product_rules_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_promotional_updated_at() SET search_path TO public, pg_temp;
ALTER FUNCTION public.validate_fulfillment_transition(public.fulfillment_state, public.fulfillment_state) SET search_path TO public, pg_temp;
ALTER FUNCTION public.normalize_supplier_code(text) SET search_path TO public, pg_temp;
ALTER FUNCTION public.normalize_supplier_code(uuid) SET search_path TO public, pg_temp;
ALTER FUNCTION public.validate_admin_badge_threshold() SET search_path TO public, pg_temp;
