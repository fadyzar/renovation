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

/**
 * Admin-only data feed. The projects/bids RLS has no admin bypass, so an admin
 * client cannot read projects it does not own. This runs with the service role
 * (after verifying the caller is an admin) and returns the full picture:
 * every project with its owner, assigned contractor, agreed amount and the
 * complete bid history — plus the contractor list for the assignment modal.
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

    // All projects with owner + assigned contractor
    const { data: projects, error: pErr } = await admin
      .from("projects")
      .select(`id, title, status, city, work_types, budget_min, budget_max, created_at,
        owner:profiles!owner_id(id, full_name, phone, email),
        contractor:profiles!selected_contractor_id(id, full_name, phone)`)
      .order("created_at", { ascending: false });
    if (pErr) return json({ error: pErr.message }, 500);

    // All bids (history), with contractor names
    const { data: bids } = await admin
      .from("bids")
      .select(`id, project_id, contractor_id, total_price, status, message, created_at, responded_at,
        contractor:profiles!contractor_id(full_name)`)
      .order("created_at", { ascending: false });

    const bidsByProject: Record<string, any[]> = {};
    for (const b of bids ?? []) {
      const row = {
        id: b.id,
        contractor_id: b.contractor_id,
        contractor_name: Array.isArray(b.contractor) ? b.contractor[0]?.full_name : b.contractor?.full_name,
        total_price: b.total_price,
        status: b.status,
        message: b.message,
        created_at: b.created_at,
        responded_at: b.responded_at,
      };
      (bidsByProject[b.project_id] ??= []).push(row);
    }

    const norm = (v: any) => (Array.isArray(v) ? v[0] ?? null : v ?? null);

    const projectsOut = (projects ?? []).map((p: any) => {
      const list = bidsByProject[p.id] ?? [];
      const accepted = list.find(b => b.status === "accepted");
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        city: p.city,
        work_types: p.work_types,
        budget_min: p.budget_min,
        budget_max: p.budget_max,
        created_at: p.created_at,
        owner: norm(p.owner),
        contractor: norm(p.contractor),
        agreed_amount: accepted?.total_price ?? null,
        bids: list,
      };
    });

    // Contractor list for the assignment modal
    const { data: contractors } = await admin
      .from("profiles")
      .select("id, full_name, phone")
      .eq("role", "contractor")
      .order("full_name");

    return json({ ok: true, projects: projectsOut, contractors: contractors ?? [] });
  } catch (err) {
    console.error("admin-data error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
