/**
 * ProjectPayments — Milestone-based escrow payment management
 *
 * Uses: `milestones` table (linked by project_id) + `projects` table
 * Both tables exist in the remote Supabase DB.
 *
 * Flow:
 *  1. Page loads → finds milestones for this project (or creates them from bid).
 *  2. Contractor marks a milestone complete → status = 'awaiting_approval'.
 *  3. Owner approves → status = 'paid', paid_at recorded.
 *  4. When all milestones paid → owner can mark project completed.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Shield,
  CreditCard,
  ChevronRight,
  FileText,
  CircleDot,
  X,
  Navigation,
  MessageCircle,
  MapPin,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const PENDING_KEY = 'pending_stripe_payment';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_FEE_PCT = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_approval'
  | 'approved'
  | 'paid'
  | 'disputed';

interface BidMilestone {
  description: string;
  price: number;
  duration?: number;
}

interface PaymentMilestone {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  amount: number;
  order_index: number;
  status: MilestoneStatus;
  submitted_at?: string;
  approved_at?: string;
  paid_at?: string;
  proof_of_work_description?: string;
}

interface ProjectInfo {
  id: string;
  title: string;
  status: string;
  owner_id: string;
  selected_contractor_id?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface BidInfo {
  id: string;
  total_price: number;
  contractor_id: string;
  milestones: BidMilestone[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_FEE_MULTIPLIER = PLATFORM_FEE_PCT / 100;

/** Fee is collected once (from milestone index 0). All others go 100% to contractor. */
function getMilestoneSplit(amount: number, isFirst: boolean, totalFee: number) {
  if (isFirst) {
    const fee = totalFee;
    const payout = Math.round((amount - fee) * 100) / 100;
    return { fee, payout };
  }
  return { fee: 0, payout: amount };
}

function formatUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:           { label: 'Pending',           color: 'text-gray-600',   bg: 'bg-gray-100',   icon: CircleDot },
  in_progress:       { label: 'In Progress',        color: 'text-blue-600',   bg: 'bg-blue-100',   icon: Clock },
  awaiting_approval: { label: 'Awaiting Approval',  color: 'text-amber-600',  bg: 'bg-amber-100',  icon: AlertCircle },
  approved:          { label: 'Approved',           color: 'text-teal-600',   bg: 'bg-teal-100',   icon: CheckCircle },
  paid:              { label: 'Paid',               color: 'text-green-600',  bg: 'bg-green-100',  icon: CheckCircle },
  disputed:          { label: 'Disputed',           color: 'text-red-600',    bg: 'bg-red-100',    icon: AlertCircle },
};


// ─── Submit Milestone Modal ───────────────────────────────────────────────────

interface SubmitModalProps {
  milestone: PaymentMilestone;
  onSuccess: () => void;
  onClose: () => void;
}

function SubmitMilestoneModal({ milestone, onSuccess, onClose }: SubmitModalProps) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const { error } = await supabase
      .from('milestones')
      .update({
        status: 'awaiting_approval',
        submitted_at: new Date().toISOString(),
        proof_of_work_description: note.trim() || null,
      })
      .eq('id', milestone.id);

    setLoading(false);
    if (!error) onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Submit Milestone for Approval</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-blue-900">{milestone.title}</p>
            <p className="text-xs text-blue-700 mt-1">
              Owner will be asked to approve and pay {formatUSD(milestone.amount)} for this milestone.
            </p>
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Completion Note <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            rows={4}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Describe what was completed, any photos, materials used, etc."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Submit for Approval
            </button>
            <button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ProjectPayments() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [bid, setBid] = useState<BidInfo | null>(null);
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);
  const [submitModal, setSubmitModal] = useState<PaymentMilestone | null>(null);
  const [completing, setCompleting] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState('');

  const isOwner = profile?.id === project?.owner_id;
  const isContractor = profile?.id === project?.selected_contractor_id;

  // ── Real Stripe Checkout for a milestone ──────────────────────────────────────
  // Every milestone payment (first and all later ones) goes through the same
  // Stripe Checkout session as the initial deposit. On return, PaymentSuccess
  // marks THIS milestone paid (payload carries `kind: 'milestone'` + milestoneId).
  async function startMilestoneCheckout(m: PaymentMilestone) {
    if (!project || !bid) return;
    setPayingId(m.id);
    setPayError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const origin = window.location.origin;
      const successUrl = `${origin}/payment-success?projectId=${project.id}&milestoneId=${m.id}`;
      const cancelUrl = `${origin}/project/${project.id}/payments`;

      localStorage.setItem(PENDING_KEY, JSON.stringify({
        kind: 'milestone',
        projectId: project.id,
        milestoneId: m.id,
        ownerId: project.owner_id,
        contractorId: project.selected_contractor_id,
        amount: m.amount,
        projectTitle: project.title,
      }));

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            amount: m.amount,
            projectId: project.id,
            bidId: bid.id,
            ownerId: project.owner_id,
            contractorId: project.selected_contractor_id,
            projectTitle: project.title,
            productName: m.title,
            successUrl,
            cancelUrl,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const { sessionUrl } = await res.json();
      window.location.href = sessionUrl;
    } catch (err: any) {
      console.error('Milestone checkout error:', err);
      setPayError(err?.message ?? 'Payment could not be started. Please try again.');
      setPayingId(null);
    }
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!projectId || !profile) return;

    try {
      // 1. Load project (use actual column names: address, city, state, zip_code)
      const { data: proj } = await supabase
        .from('projects')
        .select('id, title, status, owner_id, selected_contractor_id, address, city, state, zip_code')
        .eq('id', projectId)
        .maybeSingle();

      if (!proj) { navigate('/dashboard'); return; }
      setProject(proj);

      // 1b. Load owner profile + phone
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone')
        .eq('id', proj.owner_id)
        .maybeSingle();
      setOwnerProfile(ownerData ?? null);

      // 2. Load accepted bid
      const { data: bidData } = await supabase
        .from('bids')
        .select('id, total_price, contractor_id, milestones')
        .eq('project_id', projectId)
        .eq('status', 'accepted')
        .maybeSingle();

      if (!bidData) { navigate('/dashboard'); return; }
      setBid(bidData);

      // 3. Load existing milestones for this project
      const { data: existingMilestones } = await supabase
        .from('milestones')
        .select('id, project_id, title, description, amount, status, order_index, submitted_at, approved_at, paid_at, proof_of_work_description')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (existingMilestones && existingMilestones.length > 0) {
        setMilestones(existingMilestones as PaymentMilestone[]);
        return;
      }

      // 4. Lazy-init: create milestones from bid.milestones
      const bidMilestones: BidMilestone[] = Array.isArray(bidData.milestones) ? bidData.milestones : [];
      if (bidMilestones.length === 0) return;

      const toInsert = bidMilestones.map((m, i) => ({
        project_id: projectId,
        title: m.description || `Milestone ${i + 1}`,
        description: m.description,
        amount: m.price,
        order_index: i + 1,
        status: 'pending' as MilestoneStatus,
      }));

      const { data: createdMilestones } = await supabase
        .from('milestones')
        .insert(toInsert)
        .select('id, project_id, title, description, amount, status, order_index, submitted_at, approved_at, paid_at, proof_of_work_description');

      setMilestones((createdMilestones as PaymentMilestone[]) ?? []);
    } catch (err) {
      console.error('ProjectPayments loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, profile, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function handleNavigate() {
    if (!project) return;
    const parts = [project.address, project.city, project.state, project.zip_code].filter(Boolean);
    if (parts.length === 0) {
      alert('No address available for this project.');
      return;
    }
    const query = encodeURIComponent(parts.join(', '));
    window.open(`https://www.google.com/maps?q=${query}`, '_blank', 'noopener,noreferrer');
  }

  function handleOpenChat() {
    navigate('/messages');
  }

  async function handleCompleteProject() {
    if (!project || !isOwner) return;
    setCompleting(true);
    await supabase
      .from('projects')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', project.id);
    setCompleting(false);
    loadData();
  }

  // ── Derived stats ───────────────────────────────────────────────────────────

  const totalBid = bid?.total_price ?? 0;
  const totalPlatformFee = Math.round(totalBid * PLATFORM_FEE_MULTIPLIER * 100) / 100;
  const totalContractorPayout = totalBid - totalPlatformFee;
  const firstMilestoneId = milestones[0]?.id;
  const paidMilestones = milestones.filter(m => m.status === 'paid');
  const releasedAmount = paidMilestones.reduce((s, m) => s + getMilestoneSplit(m.amount, m.id === firstMilestoneId, totalPlatformFee).payout, 0);
  const platformCollected = paidMilestones.some(m => m.id === firstMilestoneId) ? totalPlatformFee : 0;
  const remaining = totalContractorPayout - releasedAmount;
  const allPaid = milestones.length > 0 && milestones.every(m => m.status === 'paid');

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading payments…</p>
        </div>
      </div>
    );
  }

  if (!project || !bid) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{project.title}</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                {isOwner ? 'Approve milestone completions and release payments to contractor.' : 'Submit milestones for owner approval to receive payment.'}
              </p>
              {(project.city || project.address) && (
                <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{[project.address, project.city, project.state].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors shadow-sm text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </button>
              {isContractor && ownerProfile && (
                <button
                  onClick={() => navigate(`/profile/${ownerProfile.id}`)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-colors shadow-sm text-sm"
                >
                  {ownerProfile.avatar_url ? (
                    <img src={ownerProfile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {ownerProfile.full_name?.charAt(0)?.toUpperCase() ?? 'O'}
                    </div>
                  )}
                  <span className="truncate max-w-[120px]">{ownerProfile.full_name || 'Owner'}</span>
                </button>
              )}
              {isContractor && (
                <button
                  onClick={handleNavigate}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm"
                >
                  <Navigation className="w-4 h-4" />
                  Navigate
                </button>
              )}
              <button
                onClick={handleOpenChat}
                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Chat
              </button>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Payment Overview</h2>
          </div>

          <div className={`grid grid-cols-2 ${isOwner ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-3`}>
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Total Bid</p>
              <p className="text-base sm:text-xl font-bold text-gray-900">{formatUSD(totalBid)}</p>
            </div>
            {/* Platform Fee is internal — never shown to the client (owner). */}
            {!isOwner && (
              <div className="bg-orange-50 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-[10px] sm:text-xs text-orange-600 mb-1">Platform Fee</p>
                <p className="text-base sm:text-xl font-bold text-orange-700">{formatUSD(totalPlatformFee)}</p>
              </div>
            )}
            <div className="bg-green-50 rounded-xl p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-green-600 mb-1">Released</p>
              <p className="text-base sm:text-xl font-bold text-green-700">{formatUSD(releasedAmount)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-blue-600 mb-1">Remaining</p>
              <p className="text-base sm:text-xl font-bold text-blue-700">{formatUSD(remaining)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{paidMilestones.length} of {milestones.length} milestones paid</span>
              <span>{totalBid > 0 ? Math.round((releasedAmount / totalContractorPayout) * 100) : 0}% complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${totalBid > 0 ? (releasedAmount / totalContractorPayout) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Platform-fee note is internal — never shown to the client (owner). */}
          {!isOwner && (
            <div className="mt-4 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
              <Shield className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-orange-700">
                <strong>Platform Fee:</strong> {platformCollected > 0 ? `${formatUSD(platformCollected)} collected` : 'Not collected yet'} of {formatUSD(totalPlatformFee)} total.
                10% of the total bid is deducted once from the first milestone payment.
              </p>
            </div>
          )}
        </div>

        {/* Milestones */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">Milestones</h2>
            <span className="ml-auto text-sm text-gray-500">{milestones.length} total</span>
          </div>

          {milestones.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No milestones defined for this project.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {milestones.map((milestone, index) => {
                const cfg = STATUS_CONFIG[milestone.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                const isFirst = index === 0;
                const { fee, payout } = getMilestoneSplit(milestone.amount, isFirst, totalPlatformFee);

                return (
                  <div key={milestone.id} className="p-4 sm:p-6">
                    {/* Milestone header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${milestone.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {milestone.status === 'paid' ? <CheckCircle className="w-4 h-4" /> : index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{milestone.title}</h3>
                          {milestone.description && milestone.description !== milestone.title && (
                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{milestone.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base sm:text-lg font-bold text-gray-900">{formatUSD(milestone.amount)}</p>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} mt-1`}>
                          <StatusIcon className="w-3 h-3" />
                          <span className="hidden sm:inline">{cfg.label}</span>
                          <span className="sm:hidden">{cfg.label.split(' ')[0]}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment split breakdown — contractor-facing only; the
                        client (owner) never sees the platform-fee split. */}
                    {!isOwner && (
                      <div className="ml-11 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                          Contractor: {formatUSD(payout)}{isFirst ? ' (after fee)' : ' (100%)'}
                        </div>
                        {isFirst && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                            Fee: {formatUSD(fee)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Contractor note (shown when submitted) */}
                    {milestone.proof_of_work_description && (
                      <div className="ml-11 mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Contractor's Completion Note:</p>
                        <p className="text-xs sm:text-sm text-blue-900">{milestone.proof_of_work_description}</p>
                      </div>
                    )}

                    {/* Paid info */}
                    {milestone.status === 'paid' && milestone.paid_at && (
                      <div className="ml-11 mb-3 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-green-700">
                            Payment Released — {new Date(milestone.paid_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-green-600">
                            {isOwner
                              ? `${formatUSD(milestone.amount)} paid`
                              : `${formatUSD(payout)} to contractor${isFirst && fee > 0 ? ` · ${formatUSD(fee)} platform fee` : ''}`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="ml-11">
                      {/* CONTRACTOR: submit pending/in_progress milestone */}
                      {isContractor && (milestone.status === 'pending' || milestone.status === 'in_progress') && (
                        <button
                          onClick={() => setSubmitModal(milestone)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                          Submit as Complete
                        </button>
                      )}

                      {/* CONTRACTOR: awaiting approval */}
                      {isContractor && milestone.status === 'awaiting_approval' && (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          Waiting for owner to approve…
                        </div>
                      )}

                      {/* OWNER: can release payment for any milestone that isn't
                          already paid — independent of the contractor's status.
                          The contractor's "Submit as Complete" only advances the
                          milestone's progress status; it never gates payment. */}
                      {isOwner && milestone.status !== 'paid' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startMilestoneCheckout(milestone)}
                              disabled={payingId !== null}
                              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                            >
                              {payingId === milestone.id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Redirecting to Stripe…
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-4 h-4" />
                                  <span className="hidden sm:inline">Pay {formatUSD(milestone.amount)} with Stripe</span>
                                  <span className="sm:hidden">Pay {formatUSD(milestone.amount)}</span>
                                </>
                              )}
                            </button>
                            {milestone.status === 'awaiting_approval' && (
                              <button
                                onClick={async () => {
                                  await supabase.from('milestones').update({ status: 'disputed' }).eq('id', milestone.id);
                                  loadData();
                                }}
                                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition-colors border border-red-200"
                              >
                                <AlertCircle className="w-4 h-4" />
                                Dispute
                              </button>
                            )}
                          </div>
                          {payError && payingId === null && (
                            <p className="text-xs text-red-600">{payError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All milestones done banner */}
        {allPaid && (
          <div className="mt-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-center text-white shadow-lg">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-90" />
            <h3 className="text-xl font-bold mb-1">
              {project.status === 'completed' ? 'Project Completed!' : 'All Milestones Paid!'}
            </h3>
            <p className="text-green-100 text-sm mb-4">
              All {milestones.length} milestones have been paid. Total released: {formatUSD(releasedAmount)}.
            </p>
            {isOwner && project.status !== 'completed' && (
              <button
                onClick={handleCompleteProject}
                disabled={completing}
                className="mx-auto flex items-center gap-2 px-6 py-3 bg-white text-green-700 font-bold rounded-xl hover:bg-green-50 transition-colors shadow disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                {completing ? 'Marking...' : 'Mark Project as Completed'}
              </button>
            )}
            {project.status === 'completed' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                Project officially closed
              </div>
            )}
          </div>
        )}

        {/* Owner: complete project even if some milestones pending */}
        {isOwner && project.status === 'in_progress' && !allPaid && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCompleteProject}
              disabled={completing}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-green-300 text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors text-sm disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {completing ? 'Marking...' : 'Mark Project as Completed'}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {submitModal && (
        <SubmitMilestoneModal
          milestone={submitModal}
          onSuccess={() => {
            setSubmitModal(null);
            loadData();
            // Owner notification (in-app + WhatsApp + email) is sent server-side
            // via the milestone-submitted DB trigger + dispatcher.
          }}
          onClose={() => setSubmitModal(null)}
        />
      )}
    </div>
  );
}
