import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendWhatsApp, APP_URL } from "../_shared/whatsapp.ts";

/**
 * Internal MGbit Team WhatsApp alerts.
 *
 * Invoked (via pg_net) by an AFTER INSERT trigger on `team_alerts`. Builds one
 * English "MGbit Team Alert" message for the event and sends it to every ACTIVE
 * team member whose matching alert flag is on. Reuses the shared WhatsApp layer
 * (feature flags + test-mode + Green API) — it never talks to Green API directly.
 *
 * Idempotent: team_alerts.idempotency_key allows one alert per event, and
 * dispatched_at guards against double delivery here.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-webhook-secret",
};

// event_type → which per-member flag gates delivery.
const FLAG_FOR: Record<string, string> = {
  new_project:       "receive_project_alerts",
  new_quote:         "receive_quote_alerts",
  quote_accepted:    "receive_status_alerts",
  quote_rejected:    "receive_status_alerts",
  status_update:     "receive_status_alerts",
  contractor_joined: "receive_status_alerts",
};

const STATUS_LABEL: Record<string, string> = {
  awaiting_deposit: "Awaiting deposit",
  in_progress:      "In progress",
  completed:        "Completed",
  cancelled:        "Cancelled",
};

function money(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : "";
}
function budgetRange(min: unknown, max: unknown): string {
  const lo = money(min), hi = money(max);
  if (lo && hi) return `${lo}–${hi}`;
  return lo || hi || "Not specified";
}
function nowUtc(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
function clean(lines: (string | false | undefined)[]): string {
  return lines.filter((l) => l !== "" && l !== false && l !== undefined).join("\n");
}

// deno-lint-ignore no-explicit-any
async function buildMessage(supabase: any, alert: any): Promise<string | null> {
  const meta = alert.metadata ?? {};

  // New contractor completed onboarding.
  if (alert.event_type === "contractor_joined" && meta.profile_id) {
    const { data: c } = await supabase.from("profiles")
      .select("full_name, company_name, phone, email, city, state, specialties")
      .eq("id", meta.profile_id).maybeSingle();
    if (!c) return null;
    const specialties = Array.isArray(c.specialties) && c.specialties.length ? c.specialties.join(", ") : "";
    const loc = [c.city, c.state].filter(Boolean).join(", ");
    return clean([
      `🚨 *MGbit Team Alert* — New Contractor Joined`, ``,
      `👷 ${c.full_name || "Unnamed"}`,
      c.company_name && `🏢 ${c.company_name}`,
      c.phone && `📞 ${c.phone}`,
      c.email && `✉️ ${c.email}`,
      loc && `📍 ${loc}`,
      specialties && `🔧 ${specialties}`, ``,
      `🔗 ${APP_URL}/admin/verifications`,
      `🕒 ${nowUtc()}`,
    ]);
  }

  const projectId: string | undefined = meta.project_id;
  const bidId: string | undefined = meta.bid_id;
  const adminLink = projectId ? `${APP_URL}/contractor-matching/${projectId}` : `${APP_URL}/admin`;

  // deno-lint-ignore no-explicit-any
  let proj: any = null;
  if (projectId) {
    const { data } = await supabase.from("projects")
      .select("title, work_types, city, budget_min, budget_max, owner_id").eq("id", projectId).maybeSingle();
    proj = data;
  }
  const projectTitle = proj?.title ?? "a project";
  const category = Array.isArray(proj?.work_types) && proj.work_types.length ? proj.work_types.join(", ") : "";
  const location = proj?.city ?? "";

  // deno-lint-ignore no-explicit-any
  let bid: any = null;
  let contractorName = "";
  if (bidId) {
    const { data } = await supabase.from("bids")
      .select("total_price, milestones, contractor_id, project_id").eq("id", bidId).maybeSingle();
    bid = data;
    if (bid?.contractor_id) {
      const { data: c } = await supabase.from("profiles").select("full_name").eq("id", bid.contractor_id).maybeSingle();
      contractorName = c?.full_name ?? "";
    }
  }
  const ms = Array.isArray(bid?.milestones) ? bid.milestones : [];
  // deno-lint-ignore no-explicit-any
  const days = ms.reduce((s: number, m: any) => s + (Number(m?.duration) || 0), 0);
  const timeline = days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "";
  const summary = ms.length ? `${ms.length} milestone${ms.length !== 1 ? "s" : ""}` : "";

  switch (alert.event_type) {
    case "new_project": {
      let ownerName = "";
      if (proj?.owner_id) {
        const { data: o } = await supabase.from("profiles").select("full_name").eq("id", proj.owner_id).maybeSingle();
        ownerName = o?.full_name ?? "";
      }
      return clean([
        `🚨 *MGbit Team Alert* — New Project`, ``,
        `📋 ${projectTitle}`,
        category && `🔧 ${category}`,
        location && `📍 ${location}`,
        `💰 ${budgetRange(proj?.budget_min, proj?.budget_max)}`,
        ownerName && `👤 Owner: ${ownerName}`, ``,
        `🔗 ${adminLink}`,
        `🕒 ${nowUtc()}`,
      ]);
    }
    case "new_quote":
      return clean([
        `🚨 *MGbit Team Alert* — New Quote`, ``,
        `📋 Project: ${projectTitle}`,
        contractorName && `👷 Contractor: ${contractorName}`,
        `💵 Price: ${money(bid?.total_price) || "N/A"}`,
        timeline && `🗓️ Timeline: ${timeline}`,
        summary && `📝 ${summary}`, ``,
        `🔗 ${adminLink}`,
        `🕒 ${nowUtc()}`,
      ]);
    case "quote_accepted":
      return clean([
        `🚨 *MGbit Team Alert* — Quote Accepted ✅`, ``,
        `📋 Project: ${projectTitle}`,
        contractorName && `👷 Contractor: ${contractorName}`,
        `💵 Accepted price: ${money(bid?.total_price) || "N/A"}`,
        `➡️ Next: owner completes the secure deposit into escrow to activate the project.`, ``,
        `🔗 ${adminLink}`,
        `🕒 ${nowUtc()}`,
      ]);
    case "quote_rejected":
      return clean([
        `🚨 *MGbit Team Alert* — Quote Rejected`, ``,
        `📋 Project: ${projectTitle}`,
        contractorName && `👷 Contractor: ${contractorName}`,
        `💵 Quote: ${money(bid?.total_price) || "N/A"}`,
        `📌 Status: Rejected`, ``,
        `🔗 ${adminLink}`,
        `🕒 ${nowUtc()}`,
      ]);
    case "status_update":
      return clean([
        `🚨 *MGbit Team Alert* — Project Status Update`, ``,
        `📋 Project: ${projectTitle}`,
        `🔄 New status: ${STATUS_LABEL[meta.status] ?? meta.status}`, ``,
        `🔗 ${adminLink}`,
        `🕒 ${nowUtc()}`,
      ]);
    default:
      return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const expectedSecret = Deno.env.get("DISPATCH_SECRET");
    if (expectedSecret && req.headers.get("x-webhook-secret") !== expectedSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const alertId: string | undefined = body.team_alert_id ?? body.record?.id ?? body.id;
    if (!alertId) {
      return new Response(JSON.stringify({ error: "team_alert_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: alert, error: aErr } = await supabase
      .from("team_alerts").select("*").eq("id", alertId).single();
    if (aErr || !alert) {
      return new Response(JSON.stringify({ error: "team alert not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (alert.dispatched_at) {
      return new Response(JSON.stringify({ ok: true, skipped: "already dispatched" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = await buildMessage(supabase, alert);
    if (!message) {
      await supabase.from("team_alerts").update({ dispatched_at: new Date().toISOString() }).eq("id", alert.id);
      return new Response(JSON.stringify({ ok: true, skipped: "unknown event_type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const flag = FLAG_FOR[alert.event_type] ?? "receive_status_alerts";
    const { data: members } = await supabase
      .from("team_whatsapp_recipients")
      .select("id, name, phone")
      .eq("is_active", true)
      .eq(flag, true);

    const meta = alert.metadata ?? {};
    const results: Array<{ name: string; ok: boolean; error?: string; skipped?: string }> = [];

    for (const m of members ?? []) {
      const r = await sendWhatsApp(m.phone, message);
      results.push({ name: m.name, ok: r.ok, error: r.error, skipped: r.skipped });
      if (!r.skipped) {
        await supabase.from("whatsapp_logs").insert({
          phone: r.to ?? m.phone,
          message,
          status: r.ok ? "sent" : "failed",
          error: r.error ?? null,
          recipient_id: m.id,
          recipient_type: "team",
          recipient_name: m.name,
          event_type: `team:${alert.event_type}`,
          project_id: meta.project_id ?? null,
          quote_id: meta.bid_id ?? null,
        });
      }
    }

    await supabase.from("team_alerts").update({ dispatched_at: new Date().toISOString() }).eq("id", alert.id);

    return new Response(JSON.stringify({ ok: true, event: alert.event_type, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("dispatch-team-alert error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
