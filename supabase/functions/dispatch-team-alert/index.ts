import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendResend, layout, APP_URL } from "../_shared/email.ts";

/**
 * Internal MGbit Team alerts — EMAIL ONLY (via Resend).
 *
 * Moved off WhatsApp on purpose (July 2026): repeated automated WhatsApp blasts
 * to several team numbers risked Meta/Green API blocking the sender number.
 * This function NEVER touches WhatsApp or Green API — every team alert goes out
 * as a branded email through Resend, exactly like customer/contractor emails.
 *
 * Invoked (via pg_net) by an AFTER INSERT trigger on `team_alerts`. Recipients
 * come from `team_whatsapp_recipients` (active, with an email, matching the
 * event's flag OR `always_all`). Dedup: the alert is claimed atomically
 * (dispatched_at set under a NULL guard) so an event is delivered exactly once.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-webhook-secret",
};

// event_type → which per-member flag gates delivery (always_all bypasses this).
const FLAG_FOR: Record<string, string> = {
  new_project:       "receive_project_alerts",
  new_quote:         "receive_quote_alerts",
  quote_accepted:    "receive_status_alerts",
  quote_rejected:    "receive_status_alerts",
  status_update:     "receive_status_alerts",
  contractor_joined: "receive_status_alerts",
  owner_joined:      "receive_status_alerts",
  payment:           "receive_status_alerts",
};

const EVENT_LABEL: Record<string, string> = {
  new_project:       "New project posted",
  new_quote:         "New bid submitted",
  quote_accepted:    "Quote accepted",
  quote_rejected:    "Quote rejected",
  status_update:     "Project status changed",
  contractor_joined: "New contractor registered",
  owner_joined:      "New client registered",
  payment:           "Payment received",
};

const STATUS_LABEL: Record<string, string> = {
  seeking_quotes:   "Seeking quotes",
  awaiting_deposit: "Awaiting deposit",
  in_progress:      "In progress",
  completed:        "Completed",
  cancelled:        "Cancelled",
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function money(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : "";
}
function budgetRange(min: unknown, max: unknown): string {
  const lo = money(min), hi = money(max);
  if (lo && hi) return `${lo}–${hi}`;
  return lo || hi || "Not specified";
}
function when(ts?: string): string {
  const d = ts ? new Date(ts) : new Date();
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

interface Built {
  subject: string;
  eventLabel: string;
  rows: Array<[string, string]>;
  link: string;
  linkText: string;
  customHtml?: string; // when set, replaces the rows table (announcement / summary)
  customText?: string;
}

// deno-lint-ignore no-explicit-any
async function buildEmail(supabase: any, alert: any): Promise<Built | null> {
  const meta = alert.metadata ?? {};

  // ── Free-text announcement (e.g. the WhatsApp→email migration notice) ─────
  if (alert.event_type === "announcement") {
    const msg = String(meta.message ?? "");
    return {
      subject: meta.subject || "M.G.BIT — Team update",
      eventLabel: "Announcement",
      rows: [],
      link: meta.link || `${APP_URL}/admin`,
      linkText: meta.link_text || "Open Admin",
      customHtml: `<p dir="rtl" style="text-align:right;white-space:pre-line;margin:0;">${esc(msg)}</p>`,
      customText: msg,
    };
  }

  // ── Recent-activity summary (last N days) ────────────────────────────────
  if (alert.event_type === "summary") {
    return await buildSummary(supabase, Number(meta.days) || 14);
  }

  const eventLabel = EVENT_LABEL[alert.event_type];
  if (!eventLabel) return null;
  const ts = when(alert.created_at);

  // ── New client / contractor registered ──────────────────────────────────
  if (alert.event_type === "owner_joined" || alert.event_type === "contractor_joined") {
    const pid = meta.profile_id;
    const { data: u } = await supabase.from("profiles")
      .select("full_name, email, phone, company_name, city, state, specialties, role, created_at")
      .eq("id", pid).maybeSingle();
    if (!u) return null;
    const loc = [u.city, u.state].filter(Boolean).join(", ");
    const specialties = Array.isArray(u.specialties) && u.specialties.length ? u.specialties.join(", ") : "";
    const rows: Array<[string, string]> = [
      ["Event", eventLabel],
      ["Name", u.full_name || "Unnamed"],
      ["Email", u.email || ""],
      ["Phone", u.phone || ""],
      ["User type", u.role === "contractor" ? "Contractor" : u.role === "property_owner" ? "Client (owner)" : (u.role || "")],
      ["Company", u.company_name || ""],
      ["Location", loc],
      ["Specialties", specialties],
      ["Joined", when(u.created_at)],
    ];
    const link = alert.event_type === "contractor_joined" ? `${APP_URL}/admin/verifications` : `${APP_URL}/admin`;
    return { subject: `👤 Team Alert — ${eventLabel}: ${u.full_name || "Unnamed"}`, eventLabel, rows, link, linkText: "Open Admin" };
  }

  // ── Project / bid / payment events ───────────────────────────────────────
  const projectId: string | undefined = meta.project_id;
  const bidId: string | undefined = meta.bid_id;
  const link = projectId ? `${APP_URL}/contractor-matching/${projectId}` : `${APP_URL}/admin`;

  // deno-lint-ignore no-explicit-any
  let proj: any = null;
  let ownerName = "", ownerEmail = "";
  if (projectId) {
    const { data } = await supabase.from("projects")
      .select("title, work_types, city, state, budget_min, budget_max, status, owner_id, created_at").eq("id", projectId).maybeSingle();
    proj = data;
    if (proj?.owner_id) {
      const { data: o } = await supabase.from("profiles").select("full_name, email").eq("id", proj.owner_id).maybeSingle();
      ownerName = o?.full_name ?? ""; ownerEmail = o?.email ?? "";
    }
  }
  const projectTitle = proj?.title ?? "a project";
  const category = Array.isArray(proj?.work_types) && proj.work_types.length ? proj.work_types.join(", ") : "";
  const location = [proj?.city, proj?.state].filter(Boolean).join(", ");

  // deno-lint-ignore no-explicit-any
  let bid: any = null;
  let contractorName = "";
  if (bidId) {
    const { data } = await supabase.from("bids").select("total_price, milestones, contractor_id").eq("id", bidId).maybeSingle();
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

  switch (alert.event_type) {
    case "new_project":
      return {
        subject: `🏗️ Team Alert — New project: ${projectTitle}`, eventLabel,
        rows: [
          ["Event", eventLabel], ["Project", projectTitle], ["Category", category],
          ["Location", location], ["Budget", budgetRange(proj?.budget_min, proj?.budget_max)],
          ["Owner", ownerName], ["Owner email", ownerEmail],
          ["Status", STATUS_LABEL[proj?.status] ?? proj?.status ?? ""], ["When", ts],
        ], link, linkText: "View Project",
      };
    case "new_quote":
      return {
        subject: `📋 Team Alert — New bid on "${projectTitle}"`, eventLabel,
        rows: [
          ["Event", eventLabel], ["Project", projectTitle], ["Contractor", contractorName],
          ["Bid amount", money(bid?.total_price) || "N/A"], ["Timeline", timeline],
          ["Milestones", ms.length ? String(ms.length) : ""], ["When", ts],
        ], link, linkText: "View Project",
      };
    case "quote_accepted":
      return {
        subject: `✅ Team Alert — Quote accepted on "${projectTitle}"`, eventLabel,
        rows: [
          ["Event", eventLabel], ["Project", projectTitle], ["Contractor", contractorName],
          ["Accepted price", money(bid?.total_price) || "N/A"],
          ["Next", "Owner completes the escrow deposit to activate the project."], ["When", ts],
        ], link, linkText: "View Project",
      };
    case "quote_rejected":
      return {
        subject: `↩️ Team Alert — Quote rejected on "${projectTitle}"`, eventLabel,
        rows: [
          ["Event", eventLabel], ["Project", projectTitle], ["Contractor", contractorName],
          ["Quote", money(bid?.total_price) || "N/A"], ["When", ts],
        ], link, linkText: "View Project",
      };
    case "status_update":
      return {
        subject: `🔄 Team Alert — "${projectTitle}" → ${STATUS_LABEL[meta.status] ?? meta.status}`, eventLabel,
        rows: [
          ["Event", eventLabel], ["Project", projectTitle],
          ["New status", STATUS_LABEL[meta.status] ?? meta.status ?? ""], ["Owner", ownerName], ["When", ts],
        ], link, linkText: "View Project",
      };
    case "payment": {
      const payLink = projectId ? `${APP_URL}/project/${projectId}/payments` : `${APP_URL}/admin`;
      return {
        subject: `💵 Team Alert — Payment received on "${projectTitle}"`, eventLabel,
        rows: [
          ["Event", eventLabel], ["Project", projectTitle],
          ["Milestone", meta.title || ""], ["Amount", money(meta.amount) || ""],
          ["Owner", ownerName], ["When", ts],
        ], link: payLink, linkText: "View Payments",
      };
    }
    default:
      return null;
  }
}

// Build the "recent activity" digest (new projects + new users, last N days).
// deno-lint-ignore no-explicit-any
async function buildSummary(supabase: any, days: number): Promise<Built> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: projects } = await supabase.from("projects")
    .select("title, created_at, status, owner_id").gte("created_at", since).order("created_at", { ascending: false });
  const ownerIds = [...new Set((projects ?? []).map((p: { owner_id: string }) => p.owner_id).filter(Boolean))];
  // deno-lint-ignore no-explicit-any
  const ownerMap = new Map<string, any>();
  if (ownerIds.length) {
    const { data: owners } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
    for (const o of owners ?? []) ownerMap.set(o.id, o);
  }

  const { data: users } = await supabase.from("profiles")
    .select("full_name, email, role, created_at").gte("created_at", since).order("created_at", { ascending: false });

  const th = 'style="text-align:left;padding:8px 10px;background:#eef3fb;color:#1e3a5f;font-size:13px;border-bottom:1px solid #dde8f5;"';
  const td = 'style="padding:8px 10px;font-size:13px;color:#222;border-bottom:1px solid #eee;"';
  const roleLabel = (r: string) => r === "contractor" ? "Contractor" : r === "property_owner" ? "Client (owner)" : (r || "Other");

  const projRows = (projects ?? []).map((p: { title: string; created_at: string; status: string; owner_id: string }) => {
    const o = ownerMap.get(p.owner_id) ?? {};
    return `<tr>
      <td ${td}>${esc(p.title || "Untitled")}</td>
      <td ${td}>${esc(when(p.created_at).slice(0, 10))}</td>
      <td ${td}>${esc(o.full_name || "—")}</td>
      <td ${td}>${esc(o.email || "—")}</td>
      <td ${td}>${esc(STATUS_LABEL[p.status] ?? p.status ?? "—")}</td>
    </tr>`;
  }).join("");

  const userRows = (users ?? []).map((u: { full_name: string; email: string; role: string; created_at: string }) =>
    `<tr>
      <td ${td}>${esc(u.full_name || "Unnamed")}</td>
      <td ${td}>${esc(u.email || "—")}</td>
      <td ${td}>${esc(roleLabel(u.role))}</td>
      <td ${td}>${esc(when(u.created_at).slice(0, 10))}</td>
    </tr>`).join("");

  const customHtml = `
    <p style="margin:0 0 18px;">Here is the M.G.BIT activity from the last ${days} days.</p>
    <h2 style="color:#1e3a5f;font-size:16px;margin:0 0 8px;">🏗️ New projects (${(projects ?? []).length})</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dde8f5;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr><th ${th}>Project</th><th ${th}>Date</th><th ${th}>Owner</th><th ${th}>Owner email</th><th ${th}>Status</th></tr>
      ${projRows || `<tr><td ${td} colspan="5">No new projects.</td></tr>`}
    </table>
    <h2 style="color:#1e3a5f;font-size:16px;margin:0 0 8px;">👥 New users (${(users ?? []).length})</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dde8f5;border-radius:8px;overflow:hidden;">
      <tr><th ${th}>Name</th><th ${th}>Email</th><th ${th}>Type</th><th ${th}>Joined</th></tr>
      ${userRows || `<tr><td ${td} colspan="4">No new users.</td></tr>`}
    </table>`;

  const textLines = [
    `M.G.BIT — activity (last ${days} days)`, ``,
    `New projects (${(projects ?? []).length}):`,
    ...(projects ?? []).map((p: { title: string; created_at: string; status: string; owner_id: string }) => {
      const o = ownerMap.get(p.owner_id) ?? {};
      return `- ${p.title} | ${when(p.created_at).slice(0, 10)} | ${o.full_name || "—"} <${o.email || "—"}> | ${p.status}`;
    }),
    ``, `New users (${(users ?? []).length}):`,
    ...(users ?? []).map((u: { full_name: string; email: string; role: string; created_at: string }) =>
      `- ${u.full_name} <${u.email}> | ${roleLabel(u.role)} | ${when(u.created_at).slice(0, 10)}`),
  ];

  return {
    subject: `📊 M.G.BIT — Team activity summary (last ${days} days)`,
    eventLabel: "Activity summary",
    rows: [],
    link: `${APP_URL}/admin`,
    linkText: "Open Admin",
    customHtml,
    customText: textLines.join("\n"),
  };
}

function renderHtml(b: Built): string {
  let body: string;
  if (b.customHtml) {
    body = b.customHtml;
  } else {
    const rowsHtml = b.rows.filter(([, v]) => v && String(v).trim() !== "").map(([l, v]) =>
      `<tr>
        <td style="padding:7px 0;color:#666;font-size:14px;width:150px;vertical-align:top;">${esc(l)}</td>
        <td style="padding:7px 0;color:#222;font-size:14px;font-weight:bold;">${esc(v)}</td>
      </tr>`).join("");
    body = `
      <p style="margin:0 0 16px;">An internal system event just occurred on M.G.BIT:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dde8f5;border-radius:10px;">
        <tr><td style="padding:18px 22px;"><table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table></td></tr>
      </table>`;
  }
  return layout({
    heading: `🔔 Team Alert — ${esc(b.eventLabel)}`,
    bodyHtml: body,
    ctaText: b.linkText,
    ctaUrl: b.link,
    preheader: b.subject,
  });
}

function renderText(b: Built): string {
  if (b.customText) return `${b.customText}\n\n${b.link}`;
  const lines = b.rows.filter(([, v]) => v && String(v).trim() !== "").map(([l, v]) => `${l}: ${v}`);
  return `Team Alert — ${b.eventLabel}\n\n${lines.join("\n")}\n\n${b.link}`;
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

    const reqBody = await req.json().catch(() => ({}));
    const alertId: string | undefined = reqBody.team_alert_id ?? reqBody.record?.id ?? reqBody.id;
    if (!alertId) {
      return new Response(JSON.stringify({ error: "team_alert_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: alert } = await supabase.from("team_alerts").select("*").eq("id", alertId).single();
    if (!alert) {
      return new Response(JSON.stringify({ error: "team alert not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Atomic dedup: claim the alert (set dispatched_at only if still NULL). ──
    // If another concurrent invocation already claimed it, we stop here so the
    // same event is never emailed twice.
    const { data: claimed } = await supabase.from("team_alerts")
      .update({ dispatched_at: new Date().toISOString() })
      .eq("id", alert.id).is("dispatched_at", null).select("id");
    if (!claimed || claimed.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "already dispatched" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const built = await buildEmail(supabase, alert);
    if (!built) {
      return new Response(JSON.stringify({ ok: true, skipped: "unknown event_type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const flag = FLAG_FOR[alert.event_type] ?? "receive_status_alerts";
    const { data: members } = await supabase.from("team_whatsapp_recipients")
      .select(`id, name, email, always_all, ${flag}`)
      .eq("is_active", true)
      .not("email", "is", null);
    // deno-lint-ignore no-explicit-any
    const targets = (members ?? []).filter((m: any) => m.always_all === true || m[flag] === true);

    const html = renderHtml(built);
    const text = renderText(built);
    const meta = alert.metadata ?? {};
    const results: Array<{ email: string; ok: boolean; id?: string; error?: string }> = [];

    for (const m of targets) {
      const r = await sendResend(m.email, built.subject, html, text);
      results.push({ email: m.email, ok: r.ok, id: r.id, error: r.error });
      // Best-effort logging — never let a log write break delivery.
      try {
        await supabase.from("email_logs").insert({
          recipient_id: null,
          email: m.email,
          subject: built.subject,
          status: r.ok ? "sent" : "failed",
          error: r.error ?? null,
          provider_id: r.id ?? null,
          type: `team:${alert.event_type}`,
          project_id: meta.project_id ?? null,
          bid_id: meta.bid_id ?? null,
        });
      } catch (_e) { /* ignore log failure */ }
    }

    return new Response(JSON.stringify({ ok: true, channel: "email", event: alert.event_type, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("dispatch-team-alert error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
