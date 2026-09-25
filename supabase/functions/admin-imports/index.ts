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

  try {
    const [
      suppliersResult,
      connectionsResult,
      importJobsResult,
      productImportJobsResult,
      pipelineStatesResult,
    ] = await Promise.all([
      service
        .from("suppliers")
        .select(
          "id,user_id,name,display_name,slug,supplier_type,connector_type,status,connection_status,is_active,is_verified,is_premium,country,rating,product_count,total_products,last_sync_at,last_sync_status,error_count,success_rate,created_at,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(200),
      service
        .from("supplier_connections")
        .select(
          "id,user_id,connector_id,connector_name,status,last_sync_at,sync_stats,connected_at,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(200),
      service
        .from("import_jobs")
        .select(
          "id,user_id,job_type,status,source_url,source_platform,total_products,processed_products,successful_imports,failed_imports,supplier_id,started_at,completed_at,created_at,updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      service
        .from("product_import_jobs")
        .select(
          "id,user_id,source_url,platform,status,missing_fields,error_code,error_message,progress_percent,extraction_method,retry_count,max_retries,created_at,updated_at,started_at,completed_at",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      service
        .from("import_pipeline_states")
        .select(
          "job_id,user_id,stage,source_id,source_product_id,source_url,attempt,issues,last_error,available_at,lease_owner,lease_expires_at,heartbeat_at,max_attempts,dead_lettered_at,created_at,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(200),
    ]);

    if (suppliersResult.error) throw suppliersResult.error;
    if (connectionsResult.error) throw connectionsResult.error;
    if (importJobsResult.error) throw importJobsResult.error;
    if (productImportJobsResult.error) throw productImportJobsResult.error;
    if (pipelineStatesResult.error) throw pipelineStatesResult.error;

    const suppliers = suppliersResult.data ?? [];
    const connections = connectionsResult.data ?? [];
    const importJobs = importJobsResult.data ?? [];
    const productImportJobs = productImportJobsResult.data ?? [];
    const pipelineStates = pipelineStatesResult.data ?? [];

    const countBy = <T extends Record<string, unknown>>(
      rows: T[],
      key: keyof T,
    ) => {
      const counts: Record<string, number> = {};
      for (const row of rows) {
        const value = String(row[key] ?? "unknown");
        counts[value] = (counts[value] ?? 0) + 1;
      }
      return counts;
    };

    return json({
      generatedAt: new Date().toISOString(),
      totals: {
        suppliers: suppliers.length,
        connections: connections.length,
        importJobs: importJobs.length,
        productImportJobs: productImportJobs.length,
        pipelineStates: pipelineStates.length,
      },
      statusSummary: {
        suppliers: countBy(suppliers, "status"),
        connections: countBy(connections, "status"),
        importJobs: countBy(importJobs, "status"),
        productImportJobs: countBy(productImportJobs, "status"),
        pipelineStages: countBy(pipelineStates, "stage"),
      },
      suppliers,
      connections,
      importJobs,
      productImportJobs,
      pipelineStates,
      provenance: {
        suppliers: "public.suppliers",
        connections: "public.supplier_connections",
        importJobs: "public.import_jobs",
        productImportJobs: "public.product_import_jobs",
        pipelineStates: "public.import_pipeline_states",
      },
      completeness: {
        pageLimit: 200,
        credentialsIncluded: false,
        mutationsEnabled: false,
      },
    });
  } catch (error) {
    console.error("admin-imports error", error);
    return json(
      {
        error: "admin_imports_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
