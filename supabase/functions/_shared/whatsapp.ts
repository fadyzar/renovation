// Shared WhatsApp layer for M.G.BIT — the single home for all outbound WhatsApp
// logic (used by dispatch-notification and send-whatsapp). Nothing sends WhatsApp
// directly; everything goes through sendWhatsApp() so feature flags and test-mode
// are enforced in exactly one place.
//
// Green API connection + safety flags come from edge-function secrets:
//   GREENAPI_INSTANCE_ID / GREENAPI_API_TOKEN / GREENAPI_API_URL   (connection)
//   WHATSAPP_NOTIFICATIONS_ENABLED  ("false" → send nothing, emails still go)
//   WHATSAPP_TEST_MODE              ("true"  → reroute every message to test #)
//   WHATSAPP_TEST_PHONE             (the number test-mode reroutes to)

const INSTANCE_ID = Deno.env.get("GREENAPI_INSTANCE_ID") ?? "";
const API_TOKEN   = Deno.env.get("GREENAPI_API_TOKEN")   ?? "";
const API_BASE    = (Deno.env.get("GREENAPI_API_URL") ?? "https://api.green-api.com").replace(/\/+$/, "");
export const APP_URL = Deno.env.get("APP_URL") || "https://www.mgbit.io";
// Optional branded header image (public raster URL). When set, messages are sent
// as an image with the text as caption; if the image can't be fetched we fall
// back to a plain text message so nothing is ever lost.
const LOGO_URL = Deno.env.get("WHATSAPP_LOGO_URL") ?? "";

// Flags read at call time (flipping a secret takes effect without a redeploy).
function notificationsEnabled(): boolean {
  return (Deno.env.get("WHATSAPP_NOTIFICATIONS_ENABLED") ?? "true").toLowerCase() !== "false";
}
function testMode(): boolean {
  return (Deno.env.get("WHATSAPP_TEST_MODE") ?? "false").toLowerCase() === "true";
}
function testPhone(): string {
  return Deno.env.get("WHATSAPP_TEST_PHONE") ?? "";
}

export interface WaResult {
  ok: boolean;
  error?: string;
  skipped?: string;
  /** The number the message was actually delivered to (test # in test mode). */
  to?: string;
}

/**
 * Convert any phone format → WhatsApp chatId (e.g. "972541234567@c.us").
 * Handles 054-1234567 / +972-54-1234567 / 0541234567 / 972541234567 / US / etc.
 */
export function toWhatsAppId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits || digits.length < 7) return null;
  let n = digits;
  if (n.startsWith("972")) { /* IL w/ cc */ }
  else if (n.startsWith("1") && n.length === 11) { /* US w/ cc */ }
  else if (n.startsWith("44") || n.startsWith("61") || n.startsWith("52")) { /* other cc */ }
  else if (n.startsWith("0") && n.length === 10) n = "972" + n.slice(1);
  else if (n.length === 10 && !n.startsWith("0")) n = "1" + n;
  else if (n.length === 9 && n.startsWith("5")) n = "972" + n;
  return `${n}@c.us`;
}

/** Low-level Green API text send. No flags — callers must use sendWhatsApp(). */
async function sendWhatsAppRaw(chatId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const url = `${API_BASE}/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Green API ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Low-level branded image send (logo header + caption). */
async function sendWhatsAppFile(chatId: string, caption: string): Promise<{ ok: boolean; error?: string }> {
  const url = `${API_BASE}/waInstance${INSTANCE_ID}/sendFileByUrl/${API_TOKEN}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, urlFile: LOGO_URL, fileName: "mgbit.png", caption }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Green API ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * The one and only entry point for sending WhatsApp. Enforces the kill-switch
 * and test-mode reroute, then delivers via Green API. Returns the effective
 * recipient in `to` so callers log where the message actually went.
 */
export async function sendWhatsApp(phone: string | null | undefined, message: string): Promise<WaResult> {
  if (!notificationsEnabled()) return { ok: false, skipped: "disabled" };
  if (!phone) return { ok: false, error: "No phone number" };

  let targetPhone = phone;
  let body = message;

  if (testMode()) {
    const tp = testPhone();
    if (!tp) return { ok: false, skipped: "test-mode-no-test-phone" };
    body = `⚠️ *TEST MODE* — original recipient: ${phone}\n\n${message}`;
    targetPhone = tp;
  }

  const chatId = toWhatsAppId(targetPhone);
  if (!chatId) return { ok: false, error: "Invalid phone number", to: targetPhone };

  // Branded image (logo header + caption) when a logo URL is configured; fall
  // back to plain text if the image can't be sent so a message is never lost.
  if (LOGO_URL) {
    const img = await sendWhatsAppFile(chatId, body);
    if (img.ok) return { ...img, to: targetPhone };
  }
  const r = await sendWhatsAppRaw(chatId, body);
  return { ...r, to: targetPhone };
}

// ─── Branded per-event body builders ─────────────────────────────────────────
// These map 1:1 to the requested send*Whatsapp(...) API. They return the message
// text only; delivery/flags are handled by sendWhatsApp(). The notifications
// table stays the trigger, but WhatsApp gets its own rich, branded copy here
// (mirrors the email templates in _shared/email.ts).

const BRAND = "— M.G.BIT";
const loginCta = (url?: string) => `👉 ${url || APP_URL}`;

function truncate(s: string, n = 160): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export function buildNewProjectContractor(p: {
  title: string; category?: string; location?: string; budget?: string; description?: string; url: string;
}): string {
  const lines = [
    `*🏗️ New Project Available*`,
    ``,
    `*${p.title}*`,
    p.category ? `🔧 Category: ${p.category}` : "",
    p.location ? `📍 Location: ${p.location}` : "",
    p.budget ? `💰 Budget: ${p.budget}` : "",
    p.description ? `📝 ${truncate(p.description)}` : "",
    ``,
    `Log in to review the project and submit your bid:`,
    loginCta(p.url),
    ``,
    BRAND,
  ];
  return lines.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

export function buildProjectCreatedOwner(p: {
  ownerName?: string; title: string; category?: string; location?: string; budget?: string; url: string;
}): string {
  const lines = [
    `*✅ Your project is live on M.G.BIT*`,
    ``,
    `Hi ${p.ownerName || "there"}, "${p.title}" is now open and visible to matching contractors.`,
    ``,
    p.category ? `🔧 Category: ${p.category}` : "",
    p.location ? `📍 Location: ${p.location}` : "",
    p.budget ? `💰 Budget: ${p.budget}` : "",
    ``,
    `We'll notify you the moment a contractor sends a quote.`,
    loginCta(p.url),
    ``,
    BRAND,
  ];
  return lines.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

export function buildQuoteReceivedOwner(p: {
  ownerName?: string; contractorName: string; projectTitle: string; amount: string; timeline?: string; summary?: string; url: string;
}): string {
  const lines = [
    `*📋 New quote received*`,
    ``,
    `Hi ${p.ownerName || "there"}, you received a new quote on "${p.projectTitle}":`,
    ``,
    `👷 Contractor: ${p.contractorName}`,
    `💵 Price: ${p.amount}`,
    p.timeline ? `🗓️ Timeline: ${p.timeline}` : "",
    p.summary ? `📝 ${truncate(p.summary)}` : "",
    ``,
    `Review it and accept or decline:`,
    loginCta(p.url),
    ``,
    BRAND,
  ];
  return lines.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

export function buildQuoteSubmittedContractor(p: {
  contractorName?: string; projectTitle: string; amount: string; timeline?: string; summary?: string; url: string;
}): string {
  const lines = [
    `*✅ Your quote was submitted*`,
    ``,
    `Hi ${p.contractorName || "there"}, your quote for "${p.projectTitle}" is in:`,
    ``,
    `💵 Price: ${p.amount}`,
    p.timeline ? `🗓️ Timeline: ${p.timeline}` : "",
    p.summary ? `📝 ${truncate(p.summary)}` : "",
    `📌 Status: Waiting for owner response`,
    ``,
    `Next step: the owner will review your quote — we'll let you know as soon as they respond.`,
    loginCta(p.url),
    ``,
    BRAND,
  ];
  return lines.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

export function buildQuoteAcceptedContractor(p: {
  contractorName?: string; projectTitle: string; amount: string; url: string;
}): string {
  const lines = [
    `*🎉 Your quote was accepted!*`,
    ``,
    `Congratulations ${p.contractorName || "there"} — the owner accepted your quote of ${p.amount} for "${p.projectTitle}".`,
    ``,
    `Next step: the owner completes a secure deposit to activate the project. Once that's done you'll be notified and can chat with the owner directly.`,
    loginCta(p.url),
    ``,
    BRAND,
  ];
  return lines.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

export function buildQuoteAcceptedOwner(p: {
  ownerName?: string; contractorName?: string; projectTitle: string; amount: string; url: string;
}): string {
  const lines = [
    `*✅ Quote accepted*`,
    ``,
    `Hi ${p.ownerName || "there"}, you accepted ${p.contractorName || "the contractor"}'s quote of ${p.amount} for "${p.projectTitle}".`,
    ``,
    `Next step: complete the secure deposit to activate the project and unlock direct chat with your contractor.`,
    loginCta(p.url),
    ``,
    BRAND,
  ];
  return lines.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

export function buildQuoteRejectedContractor(p: {
  contractorName?: string; projectTitle: string; url: string;
}): string {
  const lines = [
    `*Update on your quote*`,
    ``,
    `Hi ${p.contractorName || "there"}, thank you for the quote you submitted for "${p.projectTitle}". The owner has decided to move forward with a different contractor this time.`,
    ``,
    `We genuinely appreciate your effort, and we'll keep sending you new projects that match your trade and area.`,
    loginCta(p.url),
    ``,
    BRAND,
  ];
  return lines.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

export function buildGeneric(title: string, message: string, type: string, url?: string): string {
  const cta = type === "new_message" ? `Reply via the M.G.BIT platform.` : loginCta(url);
  return `*${title}*\n\n${message}\n\n${cta}\n\n${BRAND}`;
}

// ─── Notification → WhatsApp body ────────────────────────────────────────────
// Picks the branded builder by (type, metadata.kind, role), enriching with
// project/bid data fetched server-side — the same pattern buildEmailForNotification
// already uses. Falls back to the generic branded body for any unmapped type.

function absUrl(path?: string | null): string {
  if (!path) return APP_URL;
  return path.startsWith("http") ? path : `${APP_URL}${path}`;
}

function fmtMoney(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : "";
}

function budgetRange(min: unknown, max: unknown): string | undefined {
  const lo = fmtMoney(min), hi = fmtMoney(max);
  if (lo && hi) return `${lo}–${hi}`;
  return lo || hi || undefined;
}

// deno-lint-ignore no-explicit-any
async function loadBid(supabase: any, bidId: string) {
  const { data: bid } = await supabase
    .from("bids").select("total_price, milestones, contractor_id, project_id")
    .eq("id", bidId).maybeSingle();
  if (!bid) return null;
  let contractorName = "A contractor";
  if (bid.contractor_id) {
    const { data: c } = await supabase.from("profiles").select("full_name").eq("id", bid.contractor_id).maybeSingle();
    contractorName = c?.full_name ?? contractorName;
  }
  let projectTitle = "your project";
  if (bid.project_id) {
    const { data: pr } = await supabase.from("projects").select("title").eq("id", bid.project_id).maybeSingle();
    projectTitle = pr?.title ?? projectTitle;
  }
  const ms = Array.isArray(bid.milestones) ? bid.milestones : [];
  // deno-lint-ignore no-explicit-any
  const days = ms.reduce((s: number, m: any) => s + (Number(m?.duration) || 0), 0);
  const timeline = days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : undefined;
  const summary = ms.length ? `${ms.length} milestone${ms.length !== 1 ? "s" : ""}` : undefined;
  return { bid, contractorName, projectTitle, amount: fmtMoney(bid.total_price) || "$0", timeline, summary };
}

// deno-lint-ignore no-explicit-any
async function loadProject(supabase: any, projectId: string) {
  const { data: proj } = await supabase
    .from("projects")
    .select("title, work_types, city, budget_min, budget_max, description")
    .eq("id", projectId).maybeSingle();
  if (!proj) return null;
  const category = Array.isArray(proj.work_types) && proj.work_types.length ? proj.work_types.join(", ") : undefined;
  return {
    title: proj.title ?? "New project",
    category,
    location: proj.city || undefined,
    budget: budgetRange(proj.budget_min, proj.budget_max),
    description: proj.description || undefined,
  };
}

/**
 * Build the branded WhatsApp text for a notification row.
 * `profile` is the recipient's profiles row (full_name, role).
 */
// deno-lint-ignore no-explicit-any
export async function bodyForNotification(supabase: any, notif: any, profile: any): Promise<string> {
  const meta = notif.metadata ?? {};
  const url = absUrl(notif.link);

  // Owner: their project is live
  if (notif.type === "project_update" && meta.kind === "project_created" && meta.project_id) {
    const p = await loadProject(supabase, meta.project_id);
    if (p) return buildProjectCreatedOwner({ ownerName: profile?.full_name, ...p, url });
  }

  // Contractor: a matching new project
  if (notif.type === "project_update" && meta.kind === "new_project" && meta.project_id) {
    const p = await loadProject(supabase, meta.project_id);
    if (p) return buildNewProjectContractor({ ...p, url });
  }

  // Owner: they accepted a quote
  if (notif.type === "project_update" && meta.kind === "quote_accepted_owner" && meta.bid_id) {
    const b = await loadBid(supabase, meta.bid_id);
    if (b) return buildQuoteAcceptedOwner({ ownerName: profile?.full_name, contractorName: b.contractorName, projectTitle: b.projectTitle, amount: b.amount, url });
  }

  // Owner: new quote received
  if (notif.type === "new_bid" && meta.bid_id) {
    const b = await loadBid(supabase, meta.bid_id);
    if (b) return buildQuoteReceivedOwner({ ownerName: profile?.full_name, contractorName: b.contractorName, projectTitle: b.projectTitle, amount: b.amount, timeline: b.timeline, summary: b.summary, url });
  }

  // Contractor: quote submitted confirmation
  if (notif.type === "bid_submitted" && meta.bid_id) {
    const b = await loadBid(supabase, meta.bid_id);
    if (b) return buildQuoteSubmittedContractor({ contractorName: profile?.full_name, projectTitle: b.projectTitle, amount: b.amount, timeline: b.timeline, summary: b.summary, url });
  }

  // Contractor: quote accepted
  if (notif.type === "bid_accepted") {
    if (meta.bid_id) {
      const b = await loadBid(supabase, meta.bid_id);
      if (b) return buildQuoteAcceptedContractor({ contractorName: profile?.full_name, projectTitle: b.projectTitle, amount: b.amount, url });
    }
  }

  // Contractor: quote rejected
  if (notif.type === "bid_rejected") {
    let projectTitle = "the project";
    if (meta.project_id) {
      const { data: pr } = await supabase.from("projects").select("title").eq("id", meta.project_id).maybeSingle();
      projectTitle = pr?.title ?? projectTitle;
    }
    return buildQuoteRejectedContractor({ contractorName: profile?.full_name, projectTitle, url });
  }

  // Everything else → branded generic (title/message from the notification row)
  return buildGeneric(notif.title, notif.message, notif.type, notif.link);
}

/** event_type tag for whatsapp_logs (distinguishes project_update sub-kinds). */
// deno-lint-ignore no-explicit-any
export function eventTypeFor(notif: any): string {
  const kind = notif.metadata?.kind;
  return kind ? `${notif.type}:${kind}` : notif.type;
}
