import { serve } from "npm:@supabase/functions-js";
import { createClient, type User } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedRoles = new Set(["user", "admin", "staff", "agency"]);
const suspendedDuration = "876000h";

type AdminAction =
  | "list"
  | "invite"
  | "set_role"
  | "suspend"
  | "unsuspend"
  | "delete";

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
  if (!token) {
    return json({ error: "missing_authorization" }, 401);
  }

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

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = payload.action as AdminAction | undefined;

  const startAudit = async (
    auditAction: string,
    resourceId: string | null,
    resourceName: string | null,
    description: string,
    oldValues: unknown = null,
  ) => {
    const { data, error } = await service
      .from("audit_logs")
      .insert({
        user_id: actor.id,
        actor: actor.id,
        actor_type: "admin",
        actor_email: actor.email ?? null,
        action: auditAction,
        action_category: "admin",
        severity: "info",
        resource_type: "user",
        resource_id: resourceId,
        resource_name: resourceName,
        description,
        old_values: oldValues,
        metadata: { status: "started" },
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("audit start failed", error);
      throw new Error("audit_unavailable");
    }

    return data.id as string;
  };

  const finishAudit = async (
    auditId: string,
    status: "success" | "failed",
    newValues: unknown = null,
    message?: string,
  ) => {
    const { error } = await service
      .from("audit_logs")
      .update({
        new_values: newValues,
        metadata: {
          status,
          ...(message ? { message: message.slice(0, 500) } : {}),
        },
      })
      .eq("id", auditId);

    if (error) {
      console.error("audit finish failed", error);
    }
  };

  try {
    if (action === "list") {
      const page = Math.max(1, Number(payload.page ?? 1));
      const perPage = Math.min(100, Math.max(1, Number(payload.perPage ?? 50)));

      const { data, error } = await service.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const users = data.users ?? [];
      const ids = users.map((user) => user.id);

      let profiles: Array<Record<string, unknown>> = [];
      let roles: Array<{ user_id: string; role: string }> = [];

      if (ids.length > 0) {
        const [profilesResult, rolesResult] = await Promise.all([
          service
            .from("profiles")
            .select("id,full_name,first_name,last_name,avatar_url,company_name,last_login_at")
            .in("id", ids),
          service.from("user_roles").select("user_id,role").in("user_id", ids),
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (rolesResult.error) throw rolesResult.error;

        profiles = profilesResult.data ?? [];
        roles = (rolesResult.data ?? []) as Array<{ user_id: string; role: string }>;
      }

      const profileById = new Map(
        profiles.map((profile) => [String(profile.id), profile]),
      );
      const rolesById = new Map<string, string[]>();

      for (const role of roles) {
        const current = rolesById.get(role.user_id) ?? [];
        current.push(role.role);
        rolesById.set(role.user_id, current);
      }

      const now = Date.now();
      const responseUsers = users.map((user) => {
        const profile = profileById.get(user.id);
        const userRoles = rolesById.get(user.id) ?? [];
        const role = userRoles.includes("admin")
          ? "admin"
          : userRoles[0] ?? "user";
        const bannedUntil = user.banned_until ?? null;
        const isActive =
          !bannedUntil || Number.isNaN(Date.parse(bannedUntil))
            ? true
            : Date.parse(bannedUntil) <= now;

        const profileName =
          typeof profile?.full_name === "string" && profile.full_name
            ? profile.full_name
            : [profile?.first_name, profile?.last_name]
                .filter((value) => typeof value === "string" && value)
                .join(" ");

        return {
          id: user.id,
          email: user.email ?? "",
          name:
            profileName ||
            (typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : ""),
          avatar_url:
            typeof profile?.avatar_url === "string" ? profile.avatar_url : null,
          company_name:
            typeof profile?.company_name === "string"
              ? profile.company_name
              : null,
          created_at: user.created_at,
          last_sign_in_at:
            user.last_sign_in_at ??
            (typeof profile?.last_login_at === "string"
              ? profile.last_login_at
              : null),
          email_confirmed_at: user.email_confirmed_at ?? null,
          banned_until: bannedUntil,
          is_active: isActive,
          role,
          roles: userRoles,
        };
      });

      return json({
        users: responseUsers,
        page,
        perPage,
        total: data.total ?? responseUsers.length,
        lastPage: data.lastPage ?? null,
      });
    }

    if (action === "invite") {
      const email = String(payload.email ?? "").trim().toLowerCase();
      const name = String(payload.name ?? "").trim();

      if (!email || !email.includes("@")) {
        return json({ error: "invalid_email" }, 400);
      }

      const auditId = await startAudit(
        "USER_INVITE",
        null,
        email,
        `Invitation utilisateur: ${email}`,
      );

      const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
        data: name ? { name } : {},
      });

      if (error) {
        await finishAudit(auditId, "failed", null, error.message);
        throw error;
      }

      await finishAudit(auditId, "success", {
        user_id: data.user?.id ?? null,
        email,
      });

      return json({ success: true, userId: data.user?.id ?? null });
    }

    const targetUserId = String(payload.userId ?? "");
    if (!targetUserId) {
      return json({ error: "missing_user_id" }, 400);
    }

    if (targetUserId === actor.id) {
      return json({ error: "self_mutation_forbidden" }, 409);
    }

    const { data: targetResult, error: targetError } =
      await service.auth.admin.getUserById(targetUserId);

    if (targetError || !targetResult.user) {
      return json({ error: "user_not_found" }, 404);
    }

    const targetUser: User = targetResult.user;

    if (action === "set_role") {
      const nextRole = String(payload.role ?? "");
      if (!allowedRoles.has(nextRole)) {
        return json({ error: "invalid_role" }, 400);
      }

      const { data: oldRoles, error: oldRolesError } = await service
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);

      if (oldRolesError) throw oldRolesError;

      const auditId = await startAudit(
        "USER_ROLE_CHANGED",
        targetUserId,
        targetUser.email ?? targetUserId,
        `Changement de rôle vers ${nextRole}`,
        { roles: (oldRoles ?? []).map((row) => row.role) },
      );

      const { error: upsertError } = await service
        .from("user_roles")
        .upsert(
          { user_id: targetUserId, role: nextRole },
          { onConflict: "user_id,role" },
        );

      if (upsertError) {
        await finishAudit(auditId, "failed", null, upsertError.message);
        throw upsertError;
      }

      const { error: deleteOtherRolesError } = await service
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .neq("role", nextRole);

      if (deleteOtherRolesError) {
        await finishAudit(
          auditId,
          "failed",
          { role: nextRole },
          deleteOtherRolesError.message,
        );
        throw deleteOtherRolesError;
      }

      await finishAudit(auditId, "success", { role: nextRole });
      return json({ success: true, role: nextRole });
    }

    if (action === "suspend" || action === "unsuspend") {
      const suspended = action === "suspend";
      const auditId = await startAudit(
        suspended ? "USER_SUSPENDED" : "USER_REACTIVATED",
        targetUserId,
        targetUser.email ?? targetUserId,
        suspended ? "Suspension du compte" : "Réactivation du compte",
        { banned_until: targetUser.banned_until ?? null },
      );

      const { data, error } = await service.auth.admin.updateUserById(
        targetUserId,
        { ban_duration: suspended ? suspendedDuration : "none" },
      );

      if (error) {
        await finishAudit(auditId, "failed", null, error.message);
        throw error;
      }

      await finishAudit(auditId, "success", {
        banned_until: data.user?.banned_until ?? null,
      });

      return json({
        success: true,
        banned_until: data.user?.banned_until ?? null,
      });
    }

    if (action === "delete") {
      const auditId = await startAudit(
        "USER_DELETED",
        targetUserId,
        targetUser.email ?? targetUserId,
        "Suppression du compte utilisateur",
        {
          email: targetUser.email ?? null,
          created_at: targetUser.created_at,
        },
      );

      const { error } = await service.auth.admin.deleteUser(targetUserId);
      if (error) {
        await finishAudit(auditId, "failed", null, error.message);
        throw error;
      }

      await finishAudit(auditId, "success", {
        deleted: true,
        user_id: targetUserId,
      });

      return json({ success: true });
    }

    return json({ error: "unsupported_action" }, 400);
  } catch (error) {
    console.error("admin-users error", error);
    return json(
      {
        error: "admin_action_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      500,
    );
  }
});
