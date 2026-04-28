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
  Lock,
  Shield,
  Building2,
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
import { processMockDeposit, type CardDetails } from '../../lib/mockPaymentService';

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

function formatILS(n: number) {
  return '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatCardNumber(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:           { label: 'Pending',           color: 'text-gray-600',   bg: 'bg-gray-100',   icon: CircleDot },
  in_progress:       { label: 'In Progress',        color: 'text-blue-600',   bg: 'bg-blue-100',   icon: Clock },
  awaiting_approval: { label: 'Awaiting Approval',  color: 'text-amber-600',  bg: 'bg-amber-100',  icon: AlertCircle },
  approved:          { label: 'Approved',           color: 'text-teal-600',   bg: 'bg-teal-100',   icon: CheckCircle },
  paid:              { label: 'Paid',               color: 'text-green-600',  bg: 'bg-green-100',  icon: CheckCircle },
  disputed:          { label: 'Disputed',           color: 'text-red-600',    bg: 'bg-red-100',    icon: AlertCircle },
};

// ─── Approve & Pay Modal ──────────────────────────────────────────────────────

interface PayModalProps {
  milestone: PaymentMilestone;
  isFirstMilestone: boolean;
  totalPlatformFee: number;
  onSuccess: () => void;
  onClose: () => void;
}

function ApproveMilestoneModal({ milestone, isFirstMilestone, totalPlatformFee, onSuccess, onClose }: PayModalProps) {
  const { fee, payout } = getMilestoneSplit(milestone.amount, isFirstMilestone, totalPlatformFee);
  const [modalState, setModalState] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [card, setCard] = useState<CardDetails>({
    cardNumber: '', cardholderName: '', expiryMonth: '', expiryYear: '', cvv: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CardDetails, string>>>({});
  const [errMsg, setErrMsg] = useState('');

  function validate() {
    const errs: typeof errors = {};
    if (card.cardNumber.replace(/\D/g, '').length < 13) errs.cardNumber = 'Enter a valid card number';
    if (!card.cardholderName.trim()) errs.cardholderName = 'Enter cardholder name';
    if (!card.expiryMonth || !card.expiryYear) errs.expiryMonth = 'Enter expiry date';
    if (card.cvv.length < 3) errs.cvv = 'Enter CVV';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handlePay() {
    if (!validate()) return;
    setModalState('processing');

    const result = await processMockDeposit(milestone.amount, card, 'ILS');
    if (!result.success) {
      setErrMsg(result.errorMessage ?? 'Payment failed.');
      setModalState('error');
      return;
    }

    const { error } = await supabase
      .from('milestones')
      .update({
        status: 'paid',
        approved_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
      })
      .eq('id', milestone.id);

    if (error) {
      console.error('Failed to update milestone:', error);
    }

    setModalState('success');
  }

  const expiryDisplay =
    card.expiryMonth || card.expiryYear
      ? `${card.expiryMonth}${card.expiryYear ? `/${card.expiryYear}` : ''}`
      : '';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Lock className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Approve & Pay Milestone</h2>
              <p className="text-xs text-gray-500">Funds released to contractor after payment</p>
            </div>
          </div>
          {(modalState === 'form' || modalState === 'error' || modalState === 'success') && (
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        <div className="p-6">
          {modalState === 'form' && (
            <>
              {/* Payment breakdown */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-6">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
                  Payment Breakdown — {milestone.title}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Milestone Amount</span>
                    <span className="font-semibold">{formatILS(milestone.amount)}</span>
                  </div>
                  {isFirstMilestone ? (
                    <>
                      <div className="flex justify-between text-green-700">
                        <span>→ Contractor Receives</span>
                        <span className="font-semibold">{formatILS(payout)}</span>
                      </div>
                      <div className="flex justify-between text-orange-600">
                        <span>→ Platform Fee (10% of total, collected once)</span>
                        <span className="font-semibold">{formatILS(fee)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-green-700">
                      <span>→ Contractor Receives (100%)</span>
                      <span className="font-semibold">{formatILS(payout)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-green-200 mt-3 pt-3 flex justify-between">
                  <span className="font-bold text-gray-900">You Pay</span>
                  <span className="text-xl font-bold text-green-700">{formatILS(milestone.amount)}</span>
                </div>
              </div>

              {/* Card form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                  <input
                    type="text" inputMode="numeric" placeholder="1234 5678 9012 3456"
                    value={card.cardNumber}
                    onChange={e => { setCard(p => ({ ...p, cardNumber: formatCardNumber(e.target.value) })); setErrors(p => ({ ...p, cardNumber: undefined })); }}
                    className={`w-full px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.cardNumber ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.cardNumber && <p className="text-xs text-red-500 mt-1">{errors.cardNumber}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
                  <input
                    type="text" placeholder="John Smith"
                    value={card.cardholderName}
                    onChange={e => setCard(p => ({ ...p, cardholderName: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.cardholderName ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.cardholderName && <p className="text-xs text-red-500 mt-1">{errors.cardholderName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
                    <input
                      type="text" inputMode="numeric" placeholder="MM/YY"
                      value={expiryDisplay}
                      onChange={e => {
                        const f = formatExpiry(e.target.value);
                        const parts = f.split('/');
                        setCard(p => ({ ...p, expiryMonth: parts[0] ?? '', expiryYear: parts[1] ?? '' }));
                        setErrors(p => ({ ...p, expiryMonth: undefined }));
                      }}
                      className={`w-full px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.expiryMonth ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    />
                    {errors.expiryMonth && <p className="text-xs text-red-500 mt-1">{errors.expiryMonth}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                    <input
                      type="password" inputMode="numeric" placeholder="•••" maxLength={4}
                      value={card.cvv}
                      onChange={e => setCard(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      className={`w-full px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.cvv ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    />
                    {errors.cvv && <p className="text-xs text-red-500 mt-1">{errors.cvv}</p>}
                  </div>
                </div>
              </div>

              <button
                onClick={handlePay}
                className="w-full mt-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Pay {formatILS(milestone.amount)} & Release to Contractor
              </button>

              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-500"><Lock className="w-3.5 h-3.5 text-green-500" />256-bit SSL</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500"><Building2 className="w-3.5 h-3.5 text-blue-500" />Escrow</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500"><Shield className="w-3.5 h-3.5 text-orange-500" />PCI DSS</div>
              </div>
            </>
          )}

          {modalState === 'processing' && (
            <div className="py-12 flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-green-100 rounded-full" />
                <div className="absolute inset-0 w-20 h-20 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                <Lock className="absolute inset-0 m-auto w-7 h-7 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 mb-1">Processing payment…</p>
                <p className="text-sm text-gray-500">Securely authorizing {formatILS(milestone.amount)}</p>
              </div>
            </div>
          )}

          {modalState === 'success' && (
            <div className="py-8 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Payment Released!</h3>
                <p className="text-gray-600 text-sm">
                  {formatILS(payout)} sent to contractor
                  {isFirstMilestone && fee > 0 ? ` · ${formatILS(fee)} platform fee retained` : ''}
                </p>
              </div>
              <button onClick={onSuccess} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors">
                Done
              </button>
            </div>
          )}

          {modalState === 'error' && (
            <div className="py-8 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Payment Failed</h3>
                <p className="text-sm text-red-600">{errMsg}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setModalState('form')} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl">Try Again</button>
                <button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
              Owner will be asked to approve and pay {formatILS(milestone.amount)} for this milestone.
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
  const [approveModal, setApproveModal] = useState<{ milestone: PaymentMilestone; isFirst: boolean } | null>(null);
  const [submitModal, setSubmitModal] = useState<PaymentMilestone | null>(null);
  const [completing, setCompleting] = useState(false);

  const isOwner = profile?.id === project?.owner_id;
  const isContractor = profile?.id === project?.selected_contractor_id;

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

      // 1b. Load owner profile
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
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
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
              <p className="text-gray-600 mt-1">
                {isOwner ? 'Approve milestone completions and release payments to contractor.' : 'Submit milestones for owner approval to receive payment.'}
              </p>
              {(project.city || project.address) && (
                <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {[project.address, project.city, project.state].filter(Boolean).join(', ')}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors shadow-sm text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </button>
              {isContractor && ownerProfile && (
                <button
                  onClick={() => navigate(`/profile/${ownerProfile.id}`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-colors shadow-sm text-sm"
                >
                  {ownerProfile.avatar_url ? (
                    <img src={ownerProfile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-xs font-bold">
                      {ownerProfile.full_name?.charAt(0)?.toUpperCase() ?? 'O'}
                    </div>
                  )}
                  {ownerProfile.full_name || 'Owner Profile'}
                </button>
              )}
              {isContractor && (
                <button
                  onClick={handleNavigate}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm"
                >
                  <Navigation className="w-4 h-4" />
                  Navigate
                </button>
              )}
              <button
                onClick={handleOpenChat}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Open Chat
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Total Bid</p>
              <p className="text-xl font-bold text-gray-900">{formatILS(totalBid)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <p className="text-xs text-orange-600 mb-1">Platform Fee (10%)</p>
              <p className="text-xl font-bold text-orange-700">{formatILS(totalPlatformFee)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-xs text-green-600 mb-1">Released to Contractor</p>
              <p className="text-xl font-bold text-green-700">{formatILS(releasedAmount)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-xs text-blue-600 mb-1">Remaining</p>
              <p className="text-xl font-bold text-blue-700">{formatILS(remaining)}</p>
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

          <div className="mt-4 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
            <Shield className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-orange-700">
              <strong>Platform Fee:</strong> {platformCollected > 0 ? `${formatILS(platformCollected)} collected` : 'Not collected yet'} of {formatILS(totalPlatformFee)} total.
              10% of the total bid is deducted once from the first milestone payment.
            </p>
          </div>
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
                  <div key={milestone.id} className="p-6">
                    {/* Milestone header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${milestone.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {milestone.status === 'paid' ? <CheckCircle className="w-4 h-4" /> : index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{milestone.title}</h3>
                          {milestone.description && milestone.description !== milestone.title && (
                            <p className="text-sm text-gray-500 mt-0.5">{milestone.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-gray-900">{formatILS(milestone.amount)}</p>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} mt-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </div>
                      </div>
                    </div>

                    {/* Payment split breakdown */}
                    <div className="ml-11 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        Contractor: {formatILS(payout)}{isFirst ? ' (after fee)' : ' (100%)'}
                      </div>
                      {isFirst && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-orange-400" />
                          Platform fee: {formatILS(fee)} (10% of total, once)
                        </div>
                      )}
                    </div>

                    {/* Contractor note (shown when submitted) */}
                    {milestone.proof_of_work_description && (
                      <div className="ml-11 mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Contractor's Completion Note:</p>
                        <p className="text-sm text-blue-900">{milestone.proof_of_work_description}</p>
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
                            {formatILS(payout)} to contractor{isFirst && fee > 0 ? ` · ${formatILS(fee)} platform fee` : ''}
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
                          <Clock className="w-4 h-4" />
                          Waiting for owner to approve and pay…
                        </div>
                      )}

                      {/* OWNER: approve & pay */}
                      {isOwner && milestone.status === 'awaiting_approval' && (
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={() => setApproveModal({ milestone, isFirst })}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                          >
                            <CreditCard className="w-4 h-4" />
                            Approve & Pay {formatILS(milestone.amount)}
                          </button>
                          <button
                            onClick={async () => {
                              await supabase.from('milestones').update({ status: 'disputed' }).eq('id', milestone.id);
                              loadData();
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition-colors border border-red-200"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Dispute
                          </button>
                        </div>
                      )}

                      {/* OWNER: pending milestone */}
                      {isOwner && milestone.status === 'pending' && (
                        <p className="text-xs text-gray-400 italic">Waiting for contractor to submit this milestone…</p>
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
              All {milestones.length} milestones have been paid. Total released: {formatILS(releasedAmount)}.
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
      {approveModal && (
        <ApproveMilestoneModal
          milestone={approveModal.milestone}
          isFirstMilestone={approveModal.isFirst}
          totalPlatformFee={totalPlatformFee}
          onSuccess={() => { setApproveModal(null); loadData(); }}
          onClose={() => setApproveModal(null)}
        />
      )}
      {submitModal && (
        <SubmitMilestoneModal
          milestone={submitModal}
          onSuccess={() => { setSubmitModal(null); loadData(); }}
          onClose={() => setSubmitModal(null)}
        />
      )}
    </div>
  );
}
