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
 * Admin-only manual-payout center (service role, admin-verified).
 *
 *   action "list"  → every owner payment with the net amount owed to the
 *                    contractor (gross − 10% platform fee already recorded on
 *                    the transaction) plus the contractor's banking details and
 *                    whether it has been paid out.
 *   action "mark"  → set a transaction's payout_status ('paid' | 'unpaid').
 *
 * Body: { action, txId?, status?, note? }
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

    const { action, txId, status, note } = await req.json().catch(() => ({ action: "list" }));

    // ── Mark a payout paid/unpaid ────────────────────────────────────────────
    if (action === "mark") {
      if (!txId || !["paid", "unpaid"].includes(status)) {
        return json({ error: "txId and status ('paid'|'unpaid') are required" }, 400);
      }
      const { error } = await admin
        .from("transactions")
        .update({
          payout_status: status,
          payout_at: status === "paid" ? new Date().toISOString() : null,
          payout_note: note ?? null,
        })
        .eq("id", txId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action, txId, status });
    }

    // ── List payouts ─────────────────────────────────────────────────────────
    const { data: txns, error: txErr } = await admin
      .from("transactions")
      .select(`id, project_id, owner_id, contractor_id, amount, platform_fee, status,
        payout_status, payout_at, created_at,
        project:projects(title),
        contractor:profiles!contractor_id(full_name, phone, email)`)
      .order("created_at", { ascending: false });
    if (txErr) return json({ error: txErr.message }, 500);

    // Banking details, keyed by contractor
    const { data: details } = await admin
      .from("contractor_payout_details")
      .select("contractor_id, full_name, bank_name, account_number, routing_number, account_type, email, phone, tax_id_type, tax_id_value");
    const detailsByContractor: Record<string, any> = {};
    for (const d of details ?? []) detailsByContractor[d.contractor_id] = d;

    const norm = (v: any) => (Array.isArray(v) ? v[0] ?? null : v ?? null);

    const rows = (txns ?? []).map((t: any) => {
      const fee = Number(t.platform_fee ?? 0);
      const gross = Number(t.amount ?? 0);
      const net = Math.round((gross - fee) * 100) / 100; // amount to transfer
      const contractor = norm(t.contractor);
      return {
        id: t.id,
        project_id: t.project_id,
        project_title: norm(t.project)?.title ?? "—",
        contractor_id: t.contractor_id,
        contractor_name: contractor?.full_name ?? "—",
        contractor_phone: contractor?.phone ?? null,
        gross,
        platform_fee: fee,
        net,
        status: t.status,
        payout_status: t.payout_status ?? "unpaid",
        payout_at: t.payout_at,
        created_at: t.created_at,
        bank: detailsByContractor[t.contractor_id] ?? null,
      };
    });

    const unpaid = rows.filter(r => r.payout_status !== "paid");
    const summary = {
      total_net: rows.reduce((s, r) => s + r.net, 0),
      total_fees: rows.reduce((s, r) => s + r.platform_fee, 0),
      unpaid_net: unpaid.reduce((s, r) => s + r.net, 0),
      unpaid_count: unpaid.length,
      count: rows.length,
    };

    return json({ ok: true, rows, summary });
  } catch (err) {
    console.error("admin-payouts error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
