import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const VALID_STATUSES = [
  "draft", "seeking_quotes", "awaiting_deposit",
  "in_progress", "completed", "cancelled", "disputed",
];

/**
 * Admin control actions on a project (service role, admin-verified):
 *   - "unassign":  restore the project to seeking_quotes, clear the contractor,
 *                  revert the accepted bid back to 'sent'. (Undo an assignment.)
 *   - "set_status": force a project status.
 * Body: { action, projectId, status? }
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: callerProfile } = await admin
      .from("profiles").select("role").eq("id", user.id).single();
    if (callerProfile?.role !== "admin") return json({ error: "Forbidden — admin only" }, 403);

    const { action, projectId, status } = await req.json();
    if (!projectId) return json({ error: "projectId is required" }, 400);

    const { data: project } = await admin
      .from("projects").select("id, title, status, selected_contractor_id").eq("id", projectId).single();
    if (!project) return json({ error: "Project not found" }, 404);

    if (action === "unassign") {
      // Revert the accepted bid back to 'sent' so it can be reconsidered
      await admin
        .from("bids")
        .update({ status: "sent", responded_at: null })
        .eq("project_id", projectId)
        .eq("status", "accepted");

      const { error } = await admin
        .from("projects")
        .update({ selected_contractor_id: null, status: "seeking_quotes" })
        .eq("id", projectId);
      if (error) return json({ error: error.message }, 500);

      if (project.selected_contractor_id) {
        await admin.from("notifications").insert({
          user_id: project.selected_contractor_id,
          type: "project_update",
          title: "Assignment Removed",
          message: `Your assignment to "${project.title}" was removed by an admin. The project is open for bids again.`,
          link: `/projects`,
          metadata: { project_id: projectId, action: "unassigned_by_admin" },
        });
      }
      return json({ ok: true, action, projectId, status: "seeking_quotes" });
    }

    if (action === "set_status") {
      if (!status || !VALID_STATUSES.includes(status)) {
        return json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, 400);
      }
      const { error } = await admin.from("projects").update({ status }).eq("id", projectId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action, projectId, status });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("admin-project-action error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
