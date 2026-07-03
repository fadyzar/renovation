import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  sendResend, tplWelcome, tplNewProject, tplNewBid, tplGeneric, APP_URL as EMAIL_APP_URL, type Email,
} from "../_shared/email.ts";
import { sendWhatsApp, bodyForNotification, eventTypeFor } from "../_shared/whatsapp.ts";

/**
 * Unified notification dispatcher.
 *
 * This is the single server-side fan-out point for every notification in the
 * platform. It is invoked by an AFTER INSERT trigger on the `notifications`
 * table (via pg_net), so delivery no longer depends on the acting user's
 * browser staying open — fixing the "sometimes WhatsApp arrives, sometimes not"
 * problem.
 *
 * Flow:  notifications row inserted → DB trigger → here → WhatsApp + Email.
 * The `notifications` table stays the single source of truth for message text;
 * we just format that text per channel.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-webhook-secret",
};

// ─── Channel routing ─────────────────────────────────────────────────────────
// Which channels each notification type should reach, in addition to the
// in-app row that already exists. Admin recipients are downgraded to WhatsApp
// only (see channelsFor) to avoid flooding admin inboxes with email.
type Channel = "whatsapp" | "email";

const TYPE_CHANNELS: Record<string, Channel[]> = {
  welcome:             ["whatsapp", "email"],
  new_bid:             ["whatsapp", "email"],
  bid_submitted:       ["whatsapp", "email"],
  bid_accepted:        ["whatsapp", "email"],
  bid_rejected:        ["whatsapp", "email"],
  deposit_paid:        ["whatsapp", "email"],
  milestone_submitted: ["whatsapp", "email"],
  milestone_completed: ["whatsapp", "email"],
  milestone_approved:  ["whatsapp", "email"],
  payment_received:    ["whatsapp", "email"],
  project_activated:   ["whatsapp", "email"],
  project_update:      ["whatsapp", "email"],
  new_message:         ["whatsapp"],
};

function channelsFor(type: string, role: string | null): Channel[] {
  const base = TYPE_CHANNELS[type] ?? ["whatsapp", "email"];
  // Admins get WhatsApp pings only — no per-event email noise.
  if (role === "admin") return base.filter((c) => c === "whatsapp");
  return base;
}

function absUrl(path?: string | null): string {
  if (!path) return EMAIL_APP_URL;
  return path.startsWith("http") ? path : `${EMAIL_APP_URL}${path}`;
}

/**
 * Build the branded email for a notification, choosing a template by type and
 * enriching it with project/bid data fetched server-side (service role).
 */
// deno-lint-ignore no-explicit-any
async function buildEmailForNotification(supabase: any, notif: any, profile: any): Promise<Email> {
  const meta = notif.metadata ?? {};

  if (notif.type === "welcome") {
    return tplWelcome(meta.role ?? profile?.role, profile?.full_name);
  }

  if (notif.type === "project_update" && meta.kind === "new_project" && meta.project_id) {
    const { data: proj } = await supabase
      .from("projects")
      .select("title, work_types, city, budget_min, budget_max")
      .eq("id", meta.project_id).maybeSingle();
    const category = Array.isArray(proj?.work_types) && proj.work_types.length ? proj.work_types.join(", ") : undefined;
    const location = proj?.city || undefined;
    const budget = proj?.budget_min && proj?.budget_max
      ? `$${Number(proj.budget_min).toLocaleString()}–$${Number(proj.budget_max).toLocaleString()}`
      : proj?.budget_min ? `$${Number(proj.budget_min).toLocaleString()}` : undefined;
    return tplNewProject({
      contractorName: profile?.full_name, title: proj?.title ?? "New project",
      category, location, budget, url: absUrl(notif.link ?? "/projects"),
    });
  }

  if (notif.type === "new_bid" && meta.bid_id) {
    const { data: bid } = await supabase
      .from("bids").select("total_price, milestones, contractor_id, project_id")
      .eq("id", meta.bid_id).maybeSingle();
    let contractorName = "A contractor";
    if (bid?.contractor_id) {
      const { data: c } = await supabase.from("profiles").select("full_name").eq("id", bid.contractor_id).maybeSingle();
      contractorName = c?.full_name ?? contractorName;
    }
    let projectTitle = "your project";
    if (bid?.project_id) {
      const { data: pr } = await supabase.from("projects").select("title").eq("id", bid.project_id).maybeSingle();
      projectTitle = pr?.title ?? projectTitle;
    }
    const ms = Array.isArray(bid?.milestones) ? bid.milestones : [];
    const days = ms.reduce((s: number, m: any) => s + (Number(m?.duration) || 0), 0);
    const timeline = days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : undefined;
    const amount = `$${Number(bid?.total_price ?? meta.amount ?? 0).toLocaleString()}`;
    return tplNewBid({ ownerName: profile?.full_name, contractorName, amount, timeline, projectTitle, url: absUrl(notif.link ?? "/dashboard") });
  }

  return tplGeneric({ title: notif.title, message: notif.message, url: notif.link });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Optional shared-secret check (the DB trigger sends x-webhook-secret).
    const expectedSecret = Deno.env.get("DISPATCH_SECRET");
    if (expectedSecret && req.headers.get("x-webhook-secret") !== expectedSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    // Accept either { notification_id } or a Supabase webhook { record: {...} }.
    const notificationId: string | undefined = body.notification_id ?? body.record?.id ?? body.id;
    if (!notificationId) {
      return new Response(JSON.stringify({ error: "notification_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: notif, error: notifErr } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, message, link, metadata, dispatched_at")
      .eq("id", notificationId)
      .single();

    if (notifErr || !notif) {
      return new Response(JSON.stringify({ error: "notification not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: never dispatch the same row twice.
    if (notif.dispatched_at) {
      return new Response(JSON.stringify({ ok: true, skipped: "already dispatched" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, role")
      .eq("id", notif.user_id)
      .maybeSingle();

    const channels = channelsFor(notif.type, profile?.role ?? null);
    const results: Record<string, { ok: boolean; error?: string; skipped?: string }> = {};

    // WhatsApp
    if (channels.includes("whatsapp")) {
      if (profile?.phone) {
        const meta = notif.metadata ?? {};
        const waBody = await bodyForNotification(supabase, notif, profile);
        const r = await sendWhatsApp(profile.phone, waBody);
        results.whatsapp = r;
        // Skipped by the kill-switch is not a failure — don't log a phantom row.
        if (!r.skipped) {
          await supabase.from("whatsapp_logs").insert({
            phone: r.to ?? profile.phone,
            message: waBody,
            status: r.ok ? "sent" : "failed",
            error: r.error ?? null,
            recipient_id: notif.user_id,
            recipient_type: profile.role ?? null,
            event_type: eventTypeFor(notif),
            project_id: meta.project_id ?? null,
            quote_id: meta.bid_id ?? null,
          });
        }
      } else {
        results.whatsapp = { ok: false, skipped: "no phone" };
      }
    }

    // Email
    if (channels.includes("email")) {
      if (profile?.email) {
        const meta = notif.metadata ?? {};
        const email = await buildEmailForNotification(supabase, notif, profile);
        const r = await sendResend(profile.email, email.subject, email.html, email.text);
        results.email = r;
        await supabase.from("email_logs").insert({
          recipient_id: notif.user_id,
          email: profile.email,
          subject: email.subject,
          type: notif.type,
          project_id: meta.project_id ?? null,
          bid_id: meta.bid_id ?? null,
          status: r.ok ? "sent" : "failed",
          error: r.error ?? null,
          provider_id: r.id ?? null,
        });
      } else {
        results.email = { ok: false, skipped: "no email" };
      }
    }

    await supabase.from("notifications").update({ dispatched_at: new Date().toISOString() }).eq("id", notif.id);

    return new Response(JSON.stringify({ ok: true, type: notif.type, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("dispatch-notification error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
