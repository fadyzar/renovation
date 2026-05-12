import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function send(phone: string | undefined | null, message: string): Promise<void> {
  if (!phone) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone, message }),
    });
  } catch (err) {
    console.warn('WhatsApp notification failed (non-blocking):', err);
  }
}

// ─── Smart notification templates ────────────────────────────────────────────

export const whatsapp = {
  /** Contractor: their bid was accepted by the owner */
  bidAccepted(phone: string, projectTitle: string, amount: number) {
    return send(phone,
      `🏗️ Bid Accepted!\n\nYour bid of $${amount.toLocaleString()} for "${projectTitle}" was accepted by the owner.\n\nThe owner is about to make the first payment. You'll be notified once the project is active.\n\n— M.G.BIT Platform`
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
      `🔔 Milestone Ready for Review\n\nYour contractor submitted "${milestoneTitle}" for approval on "${projectTitle}".\n\nAmount: $${amount.toLocaleString()}\n\nLog in to review and release payment.\n\n— M.G.BIT Platform`
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
      `📋 New Bid Received!\n\n${contractorName} submitted a bid of $${amount.toLocaleString()} on "${projectTitle}".\n\nLog in to review their offer.\n\n— M.G.BIT Platform`
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
