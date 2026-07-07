// Shared branded email layer for M.G.BIT — used by every server-side sender
// (dispatch-notification and admin-send-email). All email goes out through
// Resend from the verified mgbit.io domain. No email is ever sent from the
// browser.

export const RESEND_FROM = Deno.env.get("RESEND_FROM") || "M.G.BIT <notifications@mgbit.io>";
export const APP_URL     = Deno.env.get("APP_URL") || "https://www.mgbit.io";
// Existing MGbit logo (public/logo.svg, served on the live domain). SVG renders
// in most modern clients; where it doesn't (e.g. Gmail) the alt text shows.
export const LOGO_URL    = "https://www.mgbit.io/logo.svg";

const NAVY   = "#1e3a5f";
const ORANGE = "#e85d04";

export interface SendResult { ok: boolean; id?: string; error?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Low-level send via the Resend REST API.
 *
 * Resend's free tier allows only ~2 requests/second. A project broadcast fans
 * out to many contractors in parallel (one dispatch invocation each), so we
 * retry on HTTP 429 with exponential backoff + jitter to spread the load and
 * avoid dropping emails.
 */
export async function sendResend(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<SendResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  const MAX_ATTEMPTS = 5;
  let lastError = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: RESEND_FROM, to, subject, html, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, id: data?.id };

      lastError = `Resend ${res.status}: ${JSON.stringify(data).slice(0, 300)}`;
      // Retry only on rate limiting; everything else is a hard failure.
      if (res.status === 429 && attempt < MAX_ATTEMPTS - 1) {
        await sleep((attempt + 1) * 700 + Math.floor(Math.random() * 500));
        continue;
      }
      return { ok: false, error: lastError };
    } catch (err) {
      lastError = String(err);
      if (attempt < MAX_ATTEMPTS - 1) { await sleep((attempt + 1) * 500); continue; }
      return { ok: false, error: lastError };
    }
  }
  return { ok: false, error: lastError || "send failed" };
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absUrl(path?: string | null): string {
  if (!path) return APP_URL;
  return path.startsWith("http") ? path : `${APP_URL}${path}`;
}

/** Branded shell: logo header, content, optional CTA button, footer. */
export function layout(opts: {
  heading: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  preheader?: string;
}): string {
  const { heading, bodyHtml, ctaText, ctaUrl, preheader } = opts;
  const cta = ctaText && ctaUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td align="center">
          <a href="${esc(ctaUrl)}" style="display:inline-block;background:${ORANGE};color:#ffffff;font-size:16px;font-weight:bold;padding:14px 38px;border-radius:8px;text-decoration:none;">${esc(ctaText)} →</a>
        </td></tr></table>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
      <tr><td style="background:${NAVY};padding:26px 40px;text-align:center;">
        <img src="${LOGO_URL}" alt="M.G.BIT" height="40" style="height:40px;width:auto;display:inline-block;" />
      </td></tr>
      <tr><td style="padding:36px 40px;">
        <h1 style="color:${NAVY};font-size:22px;margin:0 0 18px;">${esc(heading)}</h1>
        <div style="color:#444;font-size:15px;line-height:1.7;">${bodyHtml}</div>
        ${cta}
      </td></tr>
      <tr><td style="background:#f8f8f8;padding:22px 40px;text-align:center;border-top:1px solid #eee;">
        <p style="color:#aaa;font-size:12px;margin:0;line-height:1.6;">
          M.G.BIT · <a href="mailto:mgbit@mgbit.io" style="color:#999;">mgbit@mgbit.io</a> · 855-826-4248<br>
          You're receiving this because you have an account on M.G.BIT.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export interface Email { subject: string; html: string; text: string }

// ─── Transactional templates ─────────────────────────────────────────────────

export function tplWelcome(role: string, name?: string): Email {
  const first = (name?.trim().split(/\s+/)[0]) || "there";
  const isContractor = role === "contractor";
  const subject = "Welcome to M.G.BIT 🎉";
  const body = isContractor
    ? `<p style="margin:0 0 14px;">Hi ${esc(first)}, welcome to M.G.BIT! 🎉</p>
       <p style="margin:0 0 14px;">Your contractor account is ready. New projects that match your trade and area will show up in your dashboard — log in to browse jobs and submit bids.</p>`
    : `<p style="margin:0 0 14px;">Hi ${esc(first)}, welcome to M.G.BIT! 🎉</p>
       <p style="margin:0 0 14px;">Your account is ready. Post your renovation project and start receiving bids from verified contractors.</p>`;
  return {
    subject,
    html: layout({ heading: subject, bodyHtml: body, ctaText: isContractor ? "Browse Projects" : "Post a Project", ctaUrl: absUrl(isContractor ? "/projects" : "/create-project"), preheader: "Welcome to M.G.BIT" }),
    text: `Welcome to M.G.BIT, ${first}! Log in: ${APP_URL}`,
  };
}

export function tplNewProject(p: {
  contractorName?: string; title: string; category?: string; location?: string; budget?: string; url: string;
}): Email {
  const rows = [
    p.category ? row("🔧 Category", p.category) : "",
    p.location ? row("📍 Location", p.location) : "",
    p.budget   ? row("💰 Budget",   p.budget)   : "",
  ].join("");
  const body = `
    <p style="margin:0 0 16px;">Hi ${esc(p.contractorName || "there")}, a new project just opened on M.G.BIT that matches your work:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dde8f5;border-radius:10px;">
      <tr><td style="padding:20px 22px;">
        <h2 style="color:${NAVY};font-size:18px;margin:0 0 12px;">${esc(p.title)}</h2>
        <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>
    </table>`;
  return {
    subject: `🏗️ New Project: ${p.title}`,
    html: layout({ heading: "New Project Available", bodyHtml: body, ctaText: "View Project & Bid", ctaUrl: p.url, preheader: `New job: ${p.title}` }),
    text: `New project "${p.title}". ${p.category ? "Category: " + p.category + ". " : ""}${p.location ? "Location: " + p.location + ". " : ""}${p.budget ? "Budget: " + p.budget + ". " : ""}View & bid: ${p.url}`,
  };
}

export function tplNewBid(p: {
  ownerName?: string; contractorName: string; amount: string; timeline?: string; projectTitle: string; url: string;
}): Email {
  const rows = [
    row("👷 Contractor", p.contractorName),
    row("💵 Bid amount", p.amount),
    p.timeline ? row("🗓️ Timeline", p.timeline) : "",
  ].join("");
  const body = `
    <p style="margin:0 0 16px;">Hi ${esc(p.ownerName || "there")}, you received a new bid on <strong>${esc(p.projectTitle)}</strong>:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dde8f5;border-radius:10px;">
      <tr><td style="padding:20px 22px;"><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    </table>`;
  return {
    subject: `📋 New bid on "${p.projectTitle}"`,
    html: layout({ heading: "New Bid Received", bodyHtml: body, ctaText: "View the Offer", ctaUrl: p.url, preheader: `${p.contractorName} bid ${p.amount}` }),
    text: `New bid on "${p.projectTitle}" from ${p.contractorName}: ${p.amount}${p.timeline ? ", timeline " + p.timeline : ""}. View: ${p.url}`,
  };
}

export function tplGeneric(p: { title: string; message: string; url?: string }): Email {
  const body = `<p style="margin:0;white-space:pre-line;">${esc(p.message)}</p>`;
  return {
    subject: p.title,
    html: layout({ heading: p.title, bodyHtml: body, ctaText: p.url ? "Open M.G.BIT" : undefined, ctaUrl: p.url ? absUrl(p.url) : undefined }),
    text: `${p.title}\n\n${p.message}\n\n${absUrl(p.url)}`,
  };
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#666;font-size:14px;width:130px;">${esc(label)}</td>
    <td style="padding:6px 0;color:#222;font-size:14px;font-weight:bold;">${esc(value)}</td>
  </tr>`;
}

// ─── Admin manual templates (reusable, easy to extend) ───────────────────────
// Add a new admin template by adding an entry here. `custom` lets the admin
// send a free-text message inside the branded shell.

export interface AdminTemplateDef {
  id: string;
  label: string;
  build: (vars: Record<string, string>, recipientName?: string) => Email;
}

export const ADMIN_TEMPLATES: AdminTemplateDef[] = [
  {
    id: "welcome",
    label: "Welcome",
    build: (_v, name) => tplWelcome("property_owner", name),
  },
  {
    id: "account_approved",
    label: "Account approved",
    build: (_v, name) => {
      const subject = "Your M.G.BIT account is approved ✅";
      return {
        subject,
        html: layout({ heading: subject, bodyHtml: `<p style="margin:0 0 14px;">Hi ${esc(name || "there")}, your account has been reviewed and approved. You're all set to use M.G.BIT.</p>`, ctaText: "Go to Dashboard", ctaUrl: `${APP_URL}/dashboard` }),
        text: `Your M.G.BIT account is approved. ${APP_URL}/dashboard`,
      };
    },
  },
  {
    id: "complete_profile",
    label: "Reminder: complete profile",
    build: (_v, name) => {
      const subject = "Finish setting up your M.G.BIT profile";
      return {
        subject,
        html: layout({ heading: subject, bodyHtml: `<p style="margin:0 0 14px;">Hi ${esc(name || "there")}, your profile isn't complete yet. Finishing it helps you ${"get matched faster"}.</p>`, ctaText: "Complete Profile", ctaUrl: `${APP_URL}/account-settings` }),
        text: `Finish setting up your M.G.BIT profile: ${APP_URL}/account-settings`,
      };
    },
  },
  {
    id: "custom",
    label: "Custom message",
    build: (v, name) => {
      const subject = v.subject?.trim() || "A message from M.G.BIT";
      const body = `${name ? `<p style="margin:0 0 14px;">Hi ${esc(name)},</p>` : ""}<p style="margin:0;white-space:pre-line;">${esc(v.message || "")}</p>`;
      return {
        subject,
        html: layout({ heading: subject, bodyHtml: body, ctaText: v.ctaText?.trim() || undefined, ctaUrl: v.ctaUrl?.trim() || undefined }),
        text: `${v.message || ""}`,
      };
    },
  },
];

export function getAdminTemplate(id: string): AdminTemplateDef | undefined {
  return ADMIN_TEMPLATES.find((t) => t.id === id);
}
