import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/** Public URL of the platform — used for "log in" links inside messages. */
export const APP_URL = 'https://mgbit.io';

/** A ready-to-paste login call-to-action appended to user-facing notifications. */
const LOGIN_CTA = `👉 Log in to the platform:\n${APP_URL}`;

interface SendMeta { recipient_id?: string; recipient_type?: string; event_type?: string; project_id?: string }

async function send(
  phone: string | undefined | null,
  message: string,
  opts?: { throwOnError?: boolean; meta?: SendMeta },
): Promise<{ ok: boolean; error?: string }> {
  if (!phone) return { ok: false, error: 'No phone number' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { ok: false, error: 'Not authenticated' };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone, message, ...(opts?.meta ?? {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      const error = data?.error ?? `HTTP ${res.status}`;
      if (opts?.throwOnError) throw new Error(error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    console.warn('WhatsApp notification failed (non-blocking):', err);
    if (opts?.throwOnError) throw err;
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Smart notification templates ────────────────────────────────────────────

export const whatsapp = {
  /** Send any custom message as-is (used by the admin message sender). */
  custom(phone: string, message: string, meta?: SendMeta) {
    return send(phone, message, { throwOnError: true, meta });
  },

  /** Contractor: a project was assigned to them by an admin. */
  projectAssigned(phone: string, projectTitle: string, amount: number) {
    return send(phone,
      `🏗️ Project Assigned!\n\nYou have been assigned "${projectTitle}" for $${amount.toLocaleString()}.\n\n${LOGIN_CTA}\n\n— M.G.BIT Platform`
    );
  },

  /** Contractor: their bid was accepted by the owner */
  bidAccepted(phone: string, projectTitle: string, amount: number) {
    return send(phone,
      `🏗️ Bid Accepted!\n\nYour bid of $${amount.toLocaleString()} for "${projectTitle}" was accepted by the owner.\n\nThe owner is about to make the first payment. You'll be notified once the project is active.\n\n${LOGIN_CTA}\n\n— M.G.BIT Platform`
    );
  },

  /** Contractor: owner paid — project is now active */
  projectActivated(phone: string, projectTitle: string, ownerName: string) {
    return send(phone,
      `✅ Project Active!\n\n"${projectTitle}" is now active — the owner has made the first payment.\n\nYou can now chat directly with ${ownerName} through the platform.\n\n— M.G.BIT Platform`
    );
  },

  /** Owner: contractor submitted a milestone for approval */
  milestoneSubmitted(phone: string, projectTitle: string, milestoneTitle: string, amount: number) {
    return send(phone,
      `🔔 Milestone Ready for Review\n\nYour contractor submitted "${milestoneTitle}" for approval on "${projectTitle}".\n\nAmount: $${amount.toLocaleString()}\n\n${LOGIN_CTA}`
    );
  },

  /** Contractor: owner approved a milestone and released payment */
  milestoneApproved(phone: string, projectTitle: string, milestoneTitle: string, amount: number) {
    return send(phone,
      `💰 Payment Released!\n\nThe owner approved "${milestoneTitle}" on "${projectTitle}".\n\nAmount released: $${amount.toLocaleString()}\n\n— M.G.BIT Platform`
    );
  },

  /** Owner: new bid received on their project */
  newBidReceived(phone: string, projectTitle: string, contractorName: string, amount: number) {
    return send(phone,
      `📋 New Bid Received!\n\n${contractorName} submitted a bid of $${amount.toLocaleString()} on "${projectTitle}".\n\n${LOGIN_CTA}\n\n— M.G.BIT Platform`
    );
  },

  /** Both: new chat message (optional, only if user is offline) */
  newMessage(phone: string, senderName: string, preview: string) {
    const truncated = preview.length > 80 ? preview.slice(0, 77) + '...' : preview;
    return send(phone,
      `💬 New Message from ${senderName}\n\n"${truncated}"\n\nReply via the M.G.BIT platform.\n\n— M.G.BIT Platform`
    );
  },

  // ─── Admin notifications ───────────────────────────────────────────────────

  /** Admin: new project posted by a client */
  adminNewProject(phone: string, projectTitle: string, ownerName: string, budget: number) {
    return send(phone,
      `🏗️ New Project Posted!\n\nClient: ${ownerName}\nProject: "${projectTitle}"\nBudget: $${budget.toLocaleString()}\n\nLog in to the admin dashboard to monitor.\n\n— M.G.BIT System`
    );
  },

  /** Admin: new bid submitted */
  adminNewBid(phone: string, projectTitle: string, contractorName: string, amount: number) {
    return send(phone,
      `📋 New Bid Received\n\nProject: "${projectTitle}"\nContractor: ${contractorName}\nAmount: $${amount.toLocaleString()}\n\n— M.G.BIT System`
    );
  },

  /** Admin: payment received — project activated */
  adminProjectActivated(phone: string, projectTitle: string, totalAmount: number, platformFee: number) {
    return send(phone,
      `💰 Payment Received!\n\nProject: "${projectTitle}"\nTotal: $${totalAmount.toLocaleString()}\nPlatform Fee: $${platformFee.toLocaleString()}\n\nProject is now active.\n\n— M.G.BIT System`
    );
  },

  /** Admin: timeout warning — no bids on a project */
  adminTimeoutWarning(phone: string, projectTitle: string, hoursOpen: number) {
    return send(phone,
      `⚠️ No Bids Alert!\n\nProject "${projectTitle}" has been open for ${hoursOpen} hours with no bids.\n\nConsider manual intervention.\n\n— M.G.BIT System`
    );
  },
};

// ─── Admin sender templates (preview only) ───────────────────────────────────
// These mirror the server-side branded builders in
// supabase/functions/_shared/whatsapp.ts so the admin sees the exact copy that
// automated notifications use. The server remains the source of truth for
// automated sends; here they're used to compose a manual message and preview it.

const BRAND = '— M.G.BIT';
const cta = () => `👉 ${APP_URL}`;
const clean = (lines: (string | false | undefined)[]) =>
  lines.filter((l) => l !== '' && l !== false && l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');

export interface WaTemplateField { key: string; label: string; placeholder?: string }
export interface WaTemplate {
  id: string;
  label: string;
  /** Which recipient role this template is meant for (drives the picker filter). */
  audience: 'property_owner' | 'contractor' | 'any';
  fields: WaTemplateField[];
  build: (v: Record<string, string>) => string;
}

export const WA_TEMPLATES: WaTemplate[] = [
  {
    id: 'project_created_owner',
    label: 'Project created — confirmation to owner',
    audience: 'property_owner',
    fields: [
      { key: 'ownerName', label: 'Owner name', placeholder: 'Dana' },
      { key: 'title', label: 'Project title', placeholder: 'Kitchen remodel' },
      { key: 'category', label: 'Category', placeholder: 'plumbing, electrical' },
      { key: 'location', label: 'Location', placeholder: 'Tel Aviv' },
      { key: 'budget', label: 'Budget', placeholder: '$10,000–$15,000' },
    ],
    build: (v) => clean([
      '*✅ Your project is live on M.G.BIT*', '',
      `Hi ${v.ownerName || 'there'}, "${v.title || 'your project'}" is now open and visible to matching contractors.`, '',
      v.category && `🔧 Category: ${v.category}`,
      v.location && `📍 Location: ${v.location}`,
      v.budget && `💰 Budget: ${v.budget}`, '',
      `We'll notify you the moment a contractor sends a quote.`, cta(), '', BRAND,
    ]),
  },
  {
    id: 'new_project_contractor',
    label: 'New project alert — to matching contractors',
    audience: 'contractor',
    fields: [
      { key: 'title', label: 'Project title', placeholder: 'Kitchen remodel' },
      { key: 'category', label: 'Category', placeholder: 'plumbing' },
      { key: 'location', label: 'Location', placeholder: 'Tel Aviv' },
      { key: 'budget', label: 'Budget', placeholder: '$10,000–$15,000' },
      { key: 'description', label: 'Short description', placeholder: 'Full kitchen renovation…' },
    ],
    build: (v) => clean([
      '*🏗️ New Project Available*', '',
      `*${v.title || 'New project'}*`,
      v.category && `🔧 Category: ${v.category}`,
      v.location && `📍 Location: ${v.location}`,
      v.budget && `💰 Budget: ${v.budget}`,
      v.description && `📝 ${v.description}`, '',
      `Log in to review the project and submit your bid:`, cta(), '', BRAND,
    ]),
  },
  {
    id: 'quote_submitted_contractor',
    label: 'Quote submitted — confirmation to contractor',
    audience: 'contractor',
    fields: [
      { key: 'contractorName', label: 'Contractor name', placeholder: 'Avi' },
      { key: 'title', label: 'Project title', placeholder: 'Kitchen remodel' },
      { key: 'amount', label: 'Price', placeholder: '$12,000' },
      { key: 'timeline', label: 'Timeline', placeholder: '30 days' },
    ],
    build: (v) => clean([
      '*✅ Your quote was submitted*', '',
      `Hi ${v.contractorName || 'there'}, your quote for "${v.title || 'the project'}" is in:`, '',
      v.amount && `💵 Price: ${v.amount}`,
      v.timeline && `🗓️ Timeline: ${v.timeline}`,
      `📌 Status: Waiting for owner response`, '',
      `Next step: the owner will review your quote — we'll let you know as soon as they respond.`, cta(), '', BRAND,
    ]),
  },
  {
    id: 'quote_received_owner',
    label: 'New quote received — by owner',
    audience: 'property_owner',
    fields: [
      { key: 'ownerName', label: 'Owner name', placeholder: 'Dana' },
      { key: 'contractorName', label: 'Contractor name', placeholder: 'Avi' },
      { key: 'title', label: 'Project title', placeholder: 'Kitchen remodel' },
      { key: 'amount', label: 'Price', placeholder: '$12,000' },
      { key: 'timeline', label: 'Timeline', placeholder: '30 days' },
    ],
    build: (v) => clean([
      '*📋 New quote received*', '',
      `Hi ${v.ownerName || 'there'}, you received a new quote on "${v.title || 'your project'}":`, '',
      `👷 Contractor: ${v.contractorName || 'A contractor'}`,
      v.amount && `💵 Price: ${v.amount}`,
      v.timeline && `🗓️ Timeline: ${v.timeline}`, '',
      `Review it and accept or decline:`, cta(), '', BRAND,
    ]),
  },
  {
    id: 'quote_accepted_contractor',
    label: 'Quote accepted — to contractor',
    audience: 'contractor',
    fields: [
      { key: 'contractorName', label: 'Contractor name', placeholder: 'Avi' },
      { key: 'title', label: 'Project title', placeholder: 'Kitchen remodel' },
      { key: 'amount', label: 'Price', placeholder: '$12,000' },
    ],
    build: (v) => clean([
      '*🎉 Your quote was accepted!*', '',
      `Congratulations ${v.contractorName || 'there'} — the owner accepted your quote of ${v.amount || 'your price'} for "${v.title || 'the project'}".`, '',
      `Next step: the owner completes a secure deposit to activate the project. Once that's done you'll be notified and can chat with the owner directly.`, cta(), '', BRAND,
    ]),
  },
  {
    id: 'quote_accepted_owner',
    label: 'Quote accepted — confirmation to owner',
    audience: 'property_owner',
    fields: [
      { key: 'ownerName', label: 'Owner name', placeholder: 'Dana' },
      { key: 'contractorName', label: 'Contractor name', placeholder: 'Avi' },
      { key: 'title', label: 'Project title', placeholder: 'Kitchen remodel' },
      { key: 'amount', label: 'Price', placeholder: '$12,000' },
    ],
    build: (v) => clean([
      '*✅ Quote accepted*', '',
      `Hi ${v.ownerName || 'there'}, you accepted ${v.contractorName || 'the contractor'}'s quote of ${v.amount || 'their price'} for "${v.title || 'your project'}".`, '',
      `Next step: complete the secure deposit to activate the project and unlock direct chat with your contractor.`, cta(), '', BRAND,
    ]),
  },
  {
    id: 'quote_rejected_contractor',
    label: 'Quote rejected — to contractor',
    audience: 'contractor',
    fields: [
      { key: 'contractorName', label: 'Contractor name', placeholder: 'Avi' },
      { key: 'title', label: 'Project title', placeholder: 'Kitchen remodel' },
    ],
    build: (v) => clean([
      '*Update on your quote*', '',
      `Hi ${v.contractorName || 'there'}, thank you for the quote you submitted for "${v.title || 'the project'}". The owner has decided to move forward with a different contractor this time.`, '',
      `We genuinely appreciate your effort, and we'll keep sending you new projects that match your trade and area.`, cta(), '', BRAND,
    ]),
  },
  {
    id: 'custom',
    label: 'Admin custom message',
    audience: 'any',
    fields: [{ key: 'message', label: 'Message', placeholder: 'Type your message…' }],
    build: (v) => v.message || '',
  },
];

export function getWaTemplate(id: string): WaTemplate | undefined {
  return WA_TEMPLATES.find((t) => t.id === id);
}
