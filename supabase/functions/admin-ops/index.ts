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

const getJwtSessionId = (token: string) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;

    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

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

  if (actorError || !actor) return json({ error: "invalid_session" }, 401);

  const sessionId = getJwtSessionId(token);
  if (!sessionId) {
    return json({ error: "invalid_session" }, 401);
  }

  const { data: sessionActive, error: sessionError } = await service.rpc(
    "admin_session_is_active",
    {
      p_user_id: actor.id,
      p_session_id: sessionId,
    },
  );

  if (sessionError || sessionActive !== true) {
    console.error("admin session validation failed", sessionError);
    return json({ error: "invalid_session" }, 401);
  }

  const { data: adminRole, error: roleError } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", actor.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) return json({ error: "authorization_check_failed" }, 500);
  if (!adminRole) return json({ error: "forbidden" }, 403);

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  if (String(payload.mode ?? "overview") !== "overview") {
    return json({ error: "unsupported_mode" }, 400);
  }

  try {
    const [
      auditCount,
      recentAudits,
      jobCount,
      recentJobs,
      syncCount,
      recentSyncs,
      webhookCount,
      recentWebhooks,
    ] = await Promise.all([
      service.from("audit_logs").select("id", { count: "exact", head: true }),
      service
        .from("audit_logs")
        .select("id,actor_email,action,action_category,severity,resource_type,resource_id,description,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      service.from("background_jobs").select("id", { count: "exact", head: true }),
      service
        .from("background_jobs")
        .select("id,job_type,job_subtype,name,status,progress_percent,progress_message,error_message,retries,max_retries,created_at,updated_at,started_at,completed_at")
        .order("created_at", { ascending: false })
        .limit(50),
      service.from("unified_sync_queue").select("id", { count: "exact", head: true }),
      service
        .from("unified_sync_queue")
        .select("id,sync_type,entity_type,entity_id,action,status,priority,retry_count,max_retries,error_message,scheduled_at,started_at,completed_at,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(50),
      service.from("webhook_delivery_logs").select("id", { count: "exact", head: true }),
      service
        .from("webhook_delivery_logs")
        .select("id,subscription_id,event_type,status_code,error_message,attempt_number,delivered_at,created_at,success")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    for (const result of [
      auditCount,
      recentAudits,
      jobCount,
      recentJobs,
      syncCount,
      recentSyncs,
      webhookCount,
      recentWebhooks,
    ]) {
      if (result.error) throw result.error;
    }

    const jobs = recentJobs.data ?? [];
    const syncs = recentSyncs.data ?? [];
    const webhooks = recentWebhooks.data ?? [];

    const countBy = (rows: Array<Record<string, unknown>>, key: string) => {
      const result: Record<string, number> = {};
      for (const row of rows) {
        const value = String(row[key] ?? "unknown");
        result[value] = (result[value] ?? 0) + 1;
      }
      return result;
    };

    return json({
      generatedAt: new Date().toISOString(),
      totals: {
        audits: auditCount.count ?? 0,
        backgroundJobs: jobCount.count ?? 0,
        syncQueue: syncCount.count ?? 0,
        webhookDeliveries: webhookCount.count ?? 0,
      },
      statusSummary: {
        backgroundJobs: countBy(jobs as Array<Record<string, unknown>>, "status"),
        syncQueue: countBy(syncs as Array<Record<string, unknown>>, "status"),
        webhookDeliveries: {
          success: webhooks.filter((row) => row.success === true).length,
          failed: webhooks.filter((row) => row.success === false).length,
          unknown: webhooks.filter((row) => row.success == null).length,
        },
      },
      audits: recentAudits.data ?? [],
      backgroundJobs: jobs,
      syncQueue: syncs,
      webhookDeliveries: webhooks,
      provenance: {
        audits: "public.audit_logs",
        backgroundJobs: "public.background_jobs",
        syncQueue: "public.unified_sync_queue",
        webhookDeliveries: "public.webhook_delivery_logs",
      },
      completeness: {
        pageLimit: 50,
        platformLogsIncluded: false,
        supabaseRuntimeLogsIncluded: false,
      },
    });
  } catch (error) {
    console.error("admin-ops error", error);
    return json(
      {
        error: "admin_ops_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
