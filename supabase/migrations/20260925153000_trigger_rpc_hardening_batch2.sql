-- P0 trigger RPC hardening, batch 2.
-- These SECURITY DEFINER functions are attached to PostgreSQL triggers.
-- Direct Data API /rpc execution is unnecessary; trigger execution remains intact.

REVOKE EXECUTE ON FUNCTION public.generate_tenant_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_api_key_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_user_onboarding() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_admin_badge_threshold_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_critical_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_customer_access() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_security_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_access() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_subscription_access() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_published_product_outdated() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_gsc_sitemap_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_sensitive_supplier_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.price_rules_delete_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.price_rules_insert_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.price_rules_update_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_content_regen_on_product_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_price_sync_on_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_stock_sync_on_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_tracking_sync_on_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_limit_contact_submissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_admin_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_credential_access() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_audit_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_course_progress() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_marketplace_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_premium_supplier_product_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_product_enrichment_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_review_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_supplier_credentials_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_supplier_ecosystem_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_supplier_product_count() FROM PUBLIC, anon, authenticated;
