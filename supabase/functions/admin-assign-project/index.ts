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
 * Admin override: assign a project to a contractor with a custom amount.
 * Bypasses the normal bid → accept flow. Only callable by an admin.
 *
 * Body: { projectId, contractorId, amount, message? }
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // 1. Identify the caller from their JWT
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // 2. Service-role client for privileged reads/writes
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Verify the caller is an admin
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (callerProfile?.role !== "admin") return json({ error: "Forbidden — admin only" }, 403);

    // 4. Validate input
    const { projectId, contractorId, amount, message } = await req.json();
    if (!projectId || !contractorId) return json({ error: "projectId and contractorId are required" }, 400);
    const price = Number(amount);
    if (!price || price <= 0) return json({ error: "amount must be a positive number" }, 400);

    // 5. Load project + contractor (validate they exist and roles are correct)
    const { data: project } = await admin
      .from("projects")
      .select("id, title, owner_id")
      .eq("id", projectId)
      .single();
    if (!project) return json({ error: "Project not found" }, 404);

    const { data: contractor } = await admin
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("id", contractorId)
      .single();
    if (!contractor) return json({ error: "Contractor not found" }, 404);
    if (contractor.role !== "contractor") return json({ error: "Selected user is not a contractor" }, 400);

    const { data: owner } = await admin
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", project.owner_id)
      .single();

    // 6. Upsert the contractor's bid as accepted
    const { data: existingBid } = await admin
      .from("bids")
      .select("id")
      .eq("project_id", projectId)
      .eq("contractor_id", contractorId)
      .maybeSingle();

    let bidId: string;
    if (existingBid) {
      const { data: updated, error: upErr } = await admin
        .from("bids")
        .update({
          total_price: price,
          status: "accepted",
          responded_at: new Date().toISOString(),
          message: message ?? "Assigned by admin",
        })
        .eq("id", existingBid.id)
        .select("id")
        .single();
      if (upErr) return json({ error: `Failed to update bid: ${upErr.message}` }, 500);
      bidId = updated.id;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("bids")
        .insert({
          project_id: projectId,
          contractor_id: contractorId,
          total_price: price,
          status: "accepted",
          milestones: [],
          message: message ?? "Assigned by admin",
          responded_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insErr) return json({ error: `Failed to create bid: ${insErr.message}` }, 500);
      bidId = inserted.id;
    }

    // 7. Reject all other bids for this project
    await admin
      .from("bids")
      .update({ status: "rejected", responded_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .neq("id", bidId);

    // 8. Assign the contractor to the project
    const { error: projErr } = await admin
      .from("projects")
      .update({ selected_contractor_id: contractorId, status: "awaiting_deposit" })
      .eq("id", projectId);
    if (projErr) return json({ error: `Failed to assign project: ${projErr.message}` }, 500);

    // 9. Notify the contractor (in-app)
    await admin.from("notifications").insert({
      user_id: contractorId,
      type: "bid_accepted",
      title: "Project Assigned to You",
      message: `You have been assigned "${project.title}" for $${price.toLocaleString()}.`,
      link: `/project/${projectId}/payments`,
      metadata: { project_id: projectId, bid_id: bidId, total_amount: price, assigned_by_admin: true },
    });

    return json({
      ok: true,
      bidId,
      project: { id: project.id, title: project.title },
      contractor: { id: contractor.id, full_name: contractor.full_name, phone: contractor.phone },
      owner: owner ? { id: owner.id, full_name: owner.full_name, phone: owner.phone } : null,
      amount: price,
    });
  } catch (err) {
    console.error("admin-assign-project error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
