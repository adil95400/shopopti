-- P0 dashboard analytics authorization hardening.
-- Preserve existing metrics behavior while enforcing ownership/admin boundaries.
-- Verified on shopopti-staging before CI.

CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_catalog
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text := COALESCE(auth.jwt()->>'role', '');
  caller_is_admin boolean := false;
  result jsonb;
  orders_count integer;
  revenue_total numeric;
  customers_count integer;
  products_count integer;
  avg_order_value numeric;
  conversion_rate numeric;
  revenue_growth numeric;
  orders_growth numeric;
  customers_growth numeric;
BEGIN
  IF user_id_param IS NULL THEN
    RAISE EXCEPTION 'user_id_param is required' USING ERRCODE = '22023';
  END IF;

  IF caller_role <> 'service_role' THEN
    IF caller_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = caller_id
        AND ur.role = 'admin'::public.app_role
    )
    INTO caller_is_admin;

    IF caller_id IS DISTINCT FROM user_id_param AND NOT caller_is_admin THEN
      RAISE EXCEPTION 'Cross-user analytics access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COUNT(*) INTO orders_count
  FROM public.orders
  WHERE user_id = user_id_param
    AND created_at > pg_catalog.now() - interval '30 days';

  SELECT COALESCE(SUM(total_amount), 0) INTO revenue_total
  FROM public.orders
  WHERE user_id = user_id_param
    AND created_at > pg_catalog.now() - interval '30 days';

  SELECT COUNT(DISTINCT customer_id) INTO customers_count
  FROM public.orders
  WHERE user_id = user_id_param
    AND customer_id IS NOT NULL
    AND created_at > pg_catalog.now() - interval '30 days';

  SELECT COUNT(*) INTO products_count
  FROM public.imported_products
  WHERE user_id = user_id_param
    AND status = 'published';

  avg_order_value := CASE WHEN orders_count > 0 THEN revenue_total / orders_count ELSE 0 END;
  conversion_rate := CASE WHEN products_count > 0 THEN LEAST(orders_count::numeric / products_count * 10, 100) ELSE 0 END;

  WITH current_period AS (
    SELECT
      COUNT(*) AS current_orders,
      COALESCE(SUM(total_amount), 0) AS current_revenue,
      COUNT(DISTINCT customer_id) AS current_customers
    FROM public.orders
    WHERE user_id = user_id_param
      AND created_at BETWEEN pg_catalog.now() - interval '30 days' AND pg_catalog.now()
  ),
  previous_period AS (
    SELECT
      COUNT(*) AS prev_orders,
      COALESCE(SUM(total_amount), 0) AS prev_revenue,
      COUNT(DISTINCT customer_id) AS prev_customers
    FROM public.orders
    WHERE user_id = user_id_param
      AND created_at BETWEEN pg_catalog.now() - interval '60 days' AND pg_catalog.now() - interval '30 days'
  )
  SELECT
    CASE WHEN pp.prev_orders > 0 THEN ROUND(((cp.current_orders - pp.prev_orders)::numeric / pp.prev_orders * 100), 1) ELSE 0 END,
    CASE WHEN pp.prev_revenue > 0 THEN ROUND(((cp.current_revenue - pp.prev_revenue) / pp.prev_revenue * 100), 1) ELSE 0 END,
    CASE WHEN pp.prev_customers > 0 THEN ROUND(((cp.current_customers - pp.prev_customers)::numeric / pp.prev_customers * 100), 1) ELSE 0 END
  INTO orders_growth, revenue_growth, customers_growth
  FROM current_period cp, previous_period pp;

  result := pg_catalog.jsonb_build_object(
    'revenue', revenue_total,
    'orders', orders_count,
    'products', products_count,
    'customers', customers_count,
    'conversionRate', conversion_rate,
    'averageOrderValue', avg_order_value,
    'revenueGrowth', COALESCE(revenue_growth, 0),
    'ordersGrowth', COALESCE(orders_growth, 0),
    'customersGrowth', COALESCE(customers_growth, 0),
    'lastUpdated', EXTRACT(EPOCH FROM pg_catalog.now())
  );

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_analytics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(uuid) TO authenticated, service_role;
