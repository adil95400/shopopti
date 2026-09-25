import { serve } from "npm:@supabase/functions-js";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBearerToken = (req: Request) => {
  const auth = req.headers.get("Authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
};

const periodDays: Record<string, number> = {
  "7days": 7,
  "30days": 30,
  "90days": 90,
  year: 365,
};

const pctGrowth = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "server_not_configured" }, 500);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = getBearerToken(req);
  if (!token) return json({ error: "missing_authorization" }, 401);

  const {
    data: { user: actor },
    error: actorError,
  } = await service.auth.getUser(token);

  if (actorError || !actor) {
    return json({ error: "invalid_session" }, 401);
  }

  const { data: adminRole, error: roleError } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", actor.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) {
    console.error("admin role lookup failed", roleError);
    return json({ error: "authorization_check_failed" }, 500);
  }

  if (!adminRole) {
    return json({ error: "forbidden" }, 403);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const mode = String(payload.mode ?? "dashboard");
  const period = String(payload.period ?? "30days");
  const days = periodDays[period] ?? 30;
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setUTCDate(currentStart.getUTCDate() - days);
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - days);

  try {
    const [
      usersResult,
      productsResult,
      ordersCountResult,
      currentOrdersResult,
      previousOrdersResult,
      rolesResult,
      recentOrdersResult,
    ] = await Promise.all([
      service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      service.from("products").select("id", { count: "exact", head: true }),
      service.from("orders").select("id", { count: "exact", head: true }),
      service
        .from("orders")
        .select("id,total_amount,currency,financial_status,created_at,order_number,customer_email,customer_name")
        .gte("created_at", currentStart.toISOString())
        .order("created_at", { ascending: true })
        .limit(5000),
      service
        .from("orders")
        .select("id,total_amount,currency,financial_status,created_at")
        .gte("created_at", previousStart.toISOString())
        .lt("created_at", currentStart.toISOString())
        .limit(5000),
      service.from("user_roles").select("user_id,role"),
      service
        .from("orders")
        .select("id,order_number,total_amount,currency,financial_status,created_at,customer_email,customer_name")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (usersResult.error) throw usersResult.error;
    if (productsResult.error) throw productsResult.error;
    if (ordersCountResult.error) throw ordersCountResult.error;
    if (currentOrdersResult.error) throw currentOrdersResult.error;
    if (previousOrdersResult.error) throw previousOrdersResult.error;
    if (rolesResult.error) throw rolesResult.error;
    if (recentOrdersResult.error) throw recentOrdersResult.error;

    const users = usersResult.data.users ?? [];
    const totalUsers = usersResult.data.total ?? users.length;
    const newUsers = users.filter(
      (user) => Date.parse(user.created_at) >= currentStart.getTime(),
    ).length;
    const previousNewUsers = users.filter((user) => {
      const created = Date.parse(user.created_at);
      return created >= previousStart.getTime() && created < currentStart.getTime();
    }).length;
    const activeUsers = users.filter((user) => {
      const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN;
      return Number.isFinite(lastSignIn) && lastSignIn >= currentStart.getTime();
    }).length;

    const currentOrders = currentOrdersResult.data ?? [];
    const previousOrders = previousOrdersResult.data ?? [];

    const currentPaidOrders = currentOrders.filter((order) =>
      ["paid", "partially_paid"].includes(String(order.financial_status ?? "").toLowerCase()),
    );
    const previousPaidOrders = previousOrders.filter((order) =>
      ["paid", "partially_paid"].includes(String(order.financial_status ?? "").toLowerCase()),
    );

    const currencies = Array.from(
      new Set(
        currentOrders
          .map((order) => String(order.currency ?? "").trim())
          .filter(Boolean),
      ),
    );

    const singleCurrency = currencies.length === 1 ? currencies[0] : null;

    const sumAmount = (orders: typeof currentOrders) =>
      orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);

    const currentGross = sumAmount(currentOrders);
    const previousGross = sumAmount(previousOrders);
    const currentPaid = sumAmount(currentPaidOrders);
    const previousPaid = sumAmount(previousPaidOrders);

    const recentUsers = [...users]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 5)
      .map((user) => ({
        id: user.id,
        email: user.email ?? "",
        name:
          typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : "",
        created_at: user.created_at,
      }));

    const roleCounts = new Map<string, number>();
    for (const row of rolesResult.data ?? []) {
      roleCounts.set(row.role, (roleCounts.get(row.role) ?? 0) + 1);
    }

    const roleDistribution = Array.from(roleCounts.entries()).map(([role, count]) => ({
      role,
      count,
    }));

    const dayBuckets = new Map<
      string,
      { date: string; orders: number; paidRevenue: number; grossOrderValue: number }
    >();

    for (const order of currentOrders) {
      const date = String(order.created_at).slice(0, 10);
      const existing = dayBuckets.get(date) ?? {
        date,
        orders: 0,
        paidRevenue: 0,
        grossOrderValue: 0,
      };
      existing.orders += 1;
      existing.grossOrderValue += Number(order.total_amount ?? 0);
      if (
        ["paid", "partially_paid"].includes(
          String(order.financial_status ?? "").toLowerCase(),
        )
      ) {
        existing.paidRevenue += Number(order.total_amount ?? 0);
      }
      dayBuckets.set(date, existing);
    }

    const timeSeries = Array.from(dayBuckets.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const recentOrders = (recentOrdersResult.data ?? []).map((order) => ({
      id: order.id,
      order_number: order.order_number ?? order.id,
      total_amount: Number(order.total_amount ?? 0),
      currency: order.currency ?? null,
      financial_status: order.financial_status ?? null,
      created_at: order.created_at,
      customer_email: order.customer_email ?? null,
      customer_name: order.customer_name ?? null,
    }));

    const common = {
      period,
      periodDays: days,
      generatedAt: new Date().toISOString(),
      provenance: {
        users: "supabase.auth.admin.listUsers",
        products: "public.products exact count",
        orders: "public.orders",
        revenueRule: "financial_status IN (paid, partially_paid)",
        grossOrderValueRule: "sum(orders.total_amount), regardless of payment status",
      },
      completeness: {
        authUsersCappedAt1000: totalUsers > 1000,
        currentOrdersCappedAt5000: currentOrders.length >= 5000,
        previousOrdersCappedAt5000: previousOrders.length >= 5000,
        topProductsAvailable: false,
        conversionRateAvailable: false,
      },
    };

    if (mode === "dashboard") {
      return json({
        ...common,
        metrics: {
          users: {
            total: totalUsers,
            currentPeriodNew: newUsers,
            growthPct: pctGrowth(newUsers, previousNewUsers),
          },
          products: {
            total: productsResult.count ?? 0,
          },
          orders: {
            total: ordersCountResult.count ?? 0,
            currentPeriod: currentOrders.length,
            growthPct: pctGrowth(currentOrders.length, previousOrders.length),
          },
          paidRevenue: {
            amount: singleCurrency ? currentPaid : null,
            currency: singleCurrency,
            paidOrders: currentPaidOrders.length,
            growthPct:
              singleCurrency && currencies.length === 1
                ? pctGrowth(currentPaid, previousPaid)
                : null,
            verified: singleCurrency !== null,
          },
          grossOrderValue: {
            amount: singleCurrency ? currentGross : null,
            currency: singleCurrency,
            growthPct:
              singleCurrency && currencies.length === 1
                ? pctGrowth(currentGross, previousGross)
                : null,
            verified: singleCurrency !== null,
          },
        },
        recentUsers,
        recentOrders,
      });
    }

    const averageOrderValue =
      currentPaidOrders.length > 0 && singleCurrency
        ? currentPaid / currentPaidOrders.length
        : null;

    return json({
      ...common,
      metrics: {
        totalUsers,
        activeUsers,
        newUsers,
        products: productsResult.count ?? 0,
        totalOrders: ordersCountResult.count ?? 0,
        periodOrders: currentOrders.length,
        ordersGrowthPct: pctGrowth(currentOrders.length, previousOrders.length),
        paidRevenue: singleCurrency ? currentPaid : null,
        paidRevenueCurrency: singleCurrency,
        paidRevenueGrowthPct:
          singleCurrency ? pctGrowth(currentPaid, previousPaid) : null,
        grossOrderValue: singleCurrency ? currentGross : null,
        grossOrderValueCurrency: singleCurrency,
        grossOrderValueGrowthPct:
          singleCurrency ? pctGrowth(currentGross, previousGross) : null,
        averageOrderValue,
        conversionRate: null,
      },
      roleDistribution,
      timeSeries,
      topProducts: [],
      recentActivity: [],
    });
  } catch (error) {
    console.error("admin-metrics error", error);
    return json(
      {
        error: "admin_metrics_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
