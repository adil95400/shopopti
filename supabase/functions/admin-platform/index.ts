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

      const { data, error } = await service.rpc(
        "admin_set_feature_flag_enabled_atomic",
        {
          p_actor_id: actor.id,
          p_flag_id: flagId,
          p_enabled: enabled,
        },
      );

      if (error) throw error;

      return json({ success: true, flag: data });
    }

    if (action === "set_ticket_status") {
      const ticketId = String(payload.ticketId ?? "");
      const status = String(payload.status ?? "");
      const allowed = new Set(["open", "pending", "in_progress", "resolved", "closed"]);

      if (!ticketId || !allowed.has(status)) {
        return json({ error: "invalid_ticket_update" }, 400);
      }

      const { data, error } = await service.rpc(
        "admin_set_support_ticket_status_atomic",
        {
          p_actor_id: actor.id,
          p_actor_email: actor.email ?? null,
          p_ticket_id: ticketId,
          p_status: status,
        },
      );

      if (error) throw error;

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
