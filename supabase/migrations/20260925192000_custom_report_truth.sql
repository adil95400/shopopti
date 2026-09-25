-- P1 Content Truth: custom reports must use real order data.
-- Removes random/simulated revenue, order, AOV and conversion metrics.

CREATE OR REPLACE FUNCTION public.generate_custom_report(
  p_report_id uuid,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  report_config record;
  report_data jsonb;
  snapshot_id uuid;
  revenue_total numeric := 0;
  orders_total bigint := 0;
  avg_order_value numeric := 0;
  trend_data jsonb := '[]'::jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO report_config
  FROM public.custom_reports
  WHERE id = p_report_id
    AND user_id = caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found or access denied'
      USING ERRCODE = 'P0002';
  END IF;

  p_period_start := COALESCE(p_period_start, pg_catalog.now() - interval '30 days');
  p_period_end := COALESCE(p_period_end, pg_catalog.now());

  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'Invalid report period'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(SUM(o.total_amount), 0),
    COUNT(*)
  INTO revenue_total, orders_total
  FROM public.orders o
  WHERE o.user_id = caller_id
    AND o.created_at >= p_period_start
    AND o.created_at <= p_period_end;

  avg_order_value := CASE
    WHEN orders_total > 0 THEN revenue_total / orders_total
    ELSE 0
  END;

  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'date', bucket_date,
        'revenue', revenue,
        'orders', orders_count
      )
      ORDER BY bucket_date
    ),
    '[]'::jsonb
  )
  INTO trend_data
  FROM (
    SELECT
      date_trunc('day', o.created_at)::date AS bucket_date,
      COALESCE(SUM(o.total_amount), 0) AS revenue,
      COUNT(*) AS orders_count
    FROM public.orders o
    WHERE o.user_id = caller_id
      AND o.created_at >= p_period_start
      AND o.created_at <= p_period_end
    GROUP BY date_trunc('day', o.created_at)::date
  ) daily;

  report_data := pg_catalog.jsonb_build_object(
    'report_id', p_report_id,
    'report_name', report_config.name,
    'report_type', report_config.report_type,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'generated_at', pg_catalog.now(),
    'metrics', pg_catalog.jsonb_build_object(
      'total_revenue', revenue_total,
      'total_orders', orders_total,
      'avg_order_value', avg_order_value,
      'conversion_rate', NULL
    ),
    'metric_status', pg_catalog.jsonb_build_object(
      'total_revenue', 'verified',
      'total_orders', 'verified',
      'avg_order_value', 'verified',
      'conversion_rate', 'not_verified'
    ),
    'metric_sources', pg_catalog.jsonb_build_object(
      'total_revenue', 'public.orders.total_amount',
      'total_orders', 'public.orders',
      'avg_order_value', 'derived from public.orders',
      'conversion_rate', 'missing reliable traffic/session denominator'
    ),
    'trends', trend_data
  );

  INSERT INTO public.report_snapshots (
    report_id,
    user_id,
    data,
    period_start,
    period_end
  )
  VALUES (
    p_report_id,
    caller_id,
    report_data,
    p_period_start,
    p_period_end
  )
  RETURNING id INTO snapshot_id;

  UPDATE public.custom_reports
  SET last_generated_at = pg_catalog.now()
  WHERE id = p_report_id
    AND user_id = caller_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'snapshot_id', snapshot_id,
    'data', report_data
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.generate_custom_report(uuid,timestamptz,timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_custom_report(uuid,timestamptz,timestamptz)
  TO authenticated, service_role;
