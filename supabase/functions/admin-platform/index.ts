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
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 500);

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = getBearerToken(req);
  if (!token) return json({ error: "missing_authorization" }, 401);

  const { data: { user: actor }, error: actorError } = await service.auth.getUser(token);
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

  const action = String(payload.action ?? "overview");

  try {
    if (action === "overview") {
      const [flagsResult, ticketsResult, settingsResult, flagAuditResult] = await Promise.all([
        service
          .from("feature_flags")
          .select("id,key,name,description,category,is_enabled,is_public,min_plan,rollout_percentage,expires_at,updated_at")
          .order("category", { ascending: true })
          .order("key", { ascending: true }),
        service
          .from("support_tickets")
          .select("id,user_id,subject,email,status,priority,category,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(100),
        service
          .from("enterprise_settings")
          .select("id,setting_category,setting_key,setting_value,is_encrypted,access_level,updated_at")
          .order("setting_category", { ascending: true })
          .order("setting_key", { ascending: true })
          .limit(100),
        service
          .from("feature_flag_audit_log")
          .select("id,flag_id,flag_key,action,actor_id,old_value,new_value,metadata,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      for (const result of [flagsResult, ticketsResult, settingsResult, flagAuditResult]) {
        if (result.error) throw result.error;
      }

      const flags = flagsResult.data ?? [];
      const tickets = ticketsResult.data ?? [];

      return json({
        generatedAt: new Date().toISOString(),
        flags,
        supportTickets: tickets,
        enterpriseSettings: settingsResult.data ?? [],
        featureFlagAudit: flagAuditResult.data ?? [],
        totals: {
          flags: flags.length,
          enabledFlags: flags.filter((row) => row.is_enabled === true).length,
          publicFlags: flags.filter((row) => row.is_public === true).length,
          supportTickets: tickets.length,
          openSupportTickets: tickets.filter((row) =>
            ["open", "pending", "in_progress"].includes(String(row.status ?? "").toLowerCase())
          ).length,
          enterpriseSettings: (settingsResult.data ?? []).length,
        },
        provenance: {
          flags: "public.feature_flags",
          featureFlagAudit: "public.feature_flag_audit_log",
          supportTickets: "public.support_tickets",
          enterpriseSettings: "public.enterprise_settings",
        },
      });
    }

    if (action === "set_flag_enabled") {
      const flagId = String(payload.flagId ?? "");
      const enabled = payload.enabled;

      if (!flagId || typeof enabled !== "boolean") {
        return json({ error: "invalid_flag_update" }, 400);
      }

      const { data: current, error: currentError } = await service
        .from("feature_flags")
        .select("id,key,is_enabled")
        .eq("id", flagId)
        .single();

      if (currentError || !current) return json({ error: "flag_not_found" }, 404);

      const { data: updated, error: updateError } = await service
        .from("feature_flags")
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("id", flagId)
        .select("id,key,is_enabled")
        .single();

      if (updateError) throw updateError;

      const { error: auditError } = await service.from("feature_flag_audit_log").insert({
        flag_id: current.id,
        flag_key: current.key,
        action: enabled ? "enabled" : "disabled",
        actor_id: actor.id,
        old_value: { is_enabled: current.is_enabled },
        new_value: { is_enabled: enabled },
        metadata: { source: "admin-platform-controls" },
      });

      if (auditError) throw auditError;

      return json({ success: true, flag: updated });
    }

    if (action === "set_ticket_status") {
      const ticketId = String(payload.ticketId ?? "");
      const status = String(payload.status ?? "");
      const allowed = new Set(["open", "pending", "in_progress", "resolved", "closed"]);

      if (!ticketId || !allowed.has(status)) {
        return json({ error: "invalid_ticket_update" }, 400);
      }

      const { data, error } = await service
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId)
        .select("id,status")
        .single();

      if (error) throw error;

      const { error: auditError } = await service.from("audit_logs").insert({
        user_id: actor.id,
        actor: actor.id,
        actor_type: "admin",
        actor_email: actor.email ?? null,
        action: "SUPPORT_TICKET_STATUS_CHANGED",
        action_category: "support",
        severity: "info",
        resource_type: "support_ticket",
        resource_id: ticketId,
        description: "Support ticket status changed",
        new_values: { status },
        metadata: { source: "admin-platform-controls" },
      });

      if (auditError) throw auditError;

      return json({ success: true, ticket: data });
    }

    return json({ error: "unsupported_action" }, 400);
  } catch (error) {
    console.error("admin-platform error", error);
    return json(
      {
        error: "admin_platform_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
