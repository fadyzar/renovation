import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/** Public URL of the platform — used for "log in" links inside messages. */
export const APP_URL = 'https://mgbit.io';

/** A ready-to-paste login call-to-action appended to user-facing notifications. */
const LOGIN_CTA = `👉 Log in to the platform:\n${APP_URL}`;

async function send(
  phone: string | undefined | null,
  message: string,
  opts?: { throwOnError?: boolean },
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
      body: JSON.stringify({ phone, message }),
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
  custom(phone: string, message: string) {
    return send(phone, message, { throwOnError: true });
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
