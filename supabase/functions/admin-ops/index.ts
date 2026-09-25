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

  const mode = String(payload.mode ?? "overview");

  try {
    if (mode === "replay_import_pipeline") {
      const jobId = typeof payload.jobId === "string" ? payload.jobId : "";
      if (!jobId) return json({ error: "missing_job_id" }, 400);

      const { data: state, error: stateError } = await service
        .from("import_pipeline_states")
        .select("job_id,user_id,stage,dead_lettered_at,attempt,max_attempts")
        .eq("job_id", jobId)
        .maybeSingle();

      if (stateError) throw stateError;
      if (!state) return json({ error: "import_pipeline_job_not_found" }, 404);
      if (!state.dead_lettered_at) {
        return json({ error: "import_pipeline_job_not_dead_lettered" }, 409);
      }

      const { data: replayed, error: replayError } = await service.rpc(
        "replay_import_pipeline_job",
        { p_job_id: jobId },
      );

      if (replayError) throw replayError;
      if (replayed !== true) {
        return json({ error: "import_pipeline_replay_not_applied" }, 409);
      }

      const { error: auditError } = await service.from("audit_logs").insert({
        user_id: actor.id,
        actor: actor.id,
        actor_type: "admin",
        actor_email: actor.email ?? null,
        action: "IMPORT_PIPELINE_REPLAYED",
        action_category: "operations",
        severity: "info",
        resource_type: "import_pipeline_job",
        resource_id: jobId,
        description: "Dead-letter import pipeline job replayed by Admin",
        metadata: {
          source: "admin-ops",
          previous_stage: state.stage,
          previous_attempt: state.attempt,
          max_attempts: state.max_attempts,
        },
      });

      if (auditError) {
        console.error("admin-ops replay audit failed", auditError);
      }

      return json({
        success: true,
        action: "replay_import_pipeline",
        jobId,
        auditLogged: !auditError,
      });
    }

    if (mode === "retry_sync_queue") {
      const syncId = typeof payload.syncId === "string" ? payload.syncId : "";
      if (!syncId) return json({ error: "missing_sync_id" }, 400);

      const { data: current, error: currentError } = await service
        .from("unified_sync_queue")
        .select("id,user_id,status,retry_count,max_retries,sync_type,entity_type,entity_id")
        .eq("id", syncId)
        .maybeSingle();

      if (currentError) throw currentError;
      if (!current) return json({ error: "sync_queue_item_not_found" }, 404);
      if (current.status !== "failed") {
        return json({ error: "sync_queue_item_not_failed" }, 409);
      }

      const retryCount = current.retry_count ?? 0;
      const maxRetries = current.max_retries ?? 0;
      if (maxRetries > 0 && retryCount >= maxRetries) {
        return json({ error: "sync_queue_retry_limit_reached" }, 409);
      }

      const { data: updated, error: updateError } = await service
        .from("unified_sync_queue")
        .update({
          status: "pending",
          error_message: null,
          started_at: null,
          completed_at: null,
          scheduled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", syncId)
        .eq("status", "failed")
        .select("id,status,retry_count,max_retries,scheduled_at")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) {
        return json({ error: "sync_queue_retry_conflict" }, 409);
      }

      const { error: auditError } = await service.from("audit_logs").insert({
        user_id: actor.id,
        actor: actor.id,
        actor_type: "admin",
        actor_email: actor.email ?? null,
        action: "SYNC_QUEUE_RETRY_SCHEDULED",
        action_category: "operations",
        severity: "info",
        resource_type: "unified_sync_queue",
        resource_id: syncId,
        description: "Failed sync queue item rescheduled by Admin",
        metadata: {
          source: "admin-ops",
          sync_type: current.sync_type,
          entity_type: current.entity_type,
          entity_id: current.entity_id,
          retry_count: retryCount,
          max_retries: maxRetries,
        },
      });

      if (auditError) {
        console.error("admin-ops sync retry audit failed", auditError);
      }

      return json({
        success: true,
        action: "retry_sync_queue",
        sync: updated,
        auditLogged: !auditError,
      });
    }

    if (mode !== "overview") {
      return json({ error: "unsupported_mode" }, 400);
    }

    const [
      auditCount,
      recentAudits,
      jobCount,
      recentJobs,
      syncCount,
      recentSyncs,
      webhookCount,
      recentWebhooks,
      deadLetterImports,
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
      service
        .from("import_pipeline_states")
        .select("job_id,user_id,stage,attempt,max_attempts,last_error,dead_lettered_at,updated_at")
        .not("dead_lettered_at", "is", null)
        .order("dead_lettered_at", { ascending: false })
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
      deadLetterImports,
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
        deadLetterImports: deadLetterImports.data?.length ?? 0,
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
      deadLetterImports: deadLetterImports.data ?? [],
      provenance: {
        audits: "public.audit_logs",
        backgroundJobs: "public.background_jobs",
        syncQueue: "public.unified_sync_queue",
        webhookDeliveries: "public.webhook_delivery_logs",
        deadLetterImports: "public.import_pipeline_states",
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
