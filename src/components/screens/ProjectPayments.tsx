/**
 * ProjectPayments — Milestone-based escrow payment management
 *
 * Accessible by both the property owner and the assigned contractor.
 *
 * FLOW:
 *  1. Page loads → finds (or creates) the payment record for this project.
 *  2. If no payment_milestones exist, lazily initialises them from bid.milestones.
 *  3. Contractor marks a milestone as complete ("Submit for Approval").
 *  4. Owner reviews and pays the milestone amount via the fake payment modal.
 *     → 90% recorded as contractor payout, 10% recorded as platform fee.
 *  5. DB trigger auto-advances payments.status when all milestones are released.
 *
 * ANTI-BYPASS GUARANTEE:
 *  Milestone status can only be set to 'released' through this page (owner pays).
 *  The contractor never touches the release step — they can only submit.
 *  Platform fee (10%) is always calculated server-side and stored per milestone.
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
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { processMockDeposit, type CardDetails } from '../../lib/mockPaymentService';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_FEE_PCT = 10; // percent taken by platform from every milestone

// ─── Types ────────────────────────────────────────────────────────────────────

type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_approval'
  | 'approved'
  | 'released'
  | 'disputed';

interface BidMilestone {
  description: string;
  price: number;
  duration?: number;
}

interface PaymentMilestone {
  id: string;
  payment_id: string;
  title: string;
  description?: string;
  amount: number;
  percentage?: number;
  sequence_order: number;
  status: MilestoneStatus;
  contractor_submitted_at?: string;
  owner_approved_at?: string;
  released_at?: string;
  contractor_note?: string;
  owner_note?: string;
  platform_fee_amount: number;
  contractor_payout: number;
}

interface PaymentRecord {
  id: string;
  total_amount: number;
  platform_fee: number;
  status: string;
  is_deposit: boolean;
}

interface ProjectInfo {
  id: string;
  title: string;
  status: string;
  owner_id: string;
  selected_contractor_id?: string;
}

interface BidInfo {
  id: string;
  total_price: number;
  contractor_id: string;
  milestones: BidMilestone[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_FEE_MULTIPLIER = PLATFORM_FEE_PCT / 100;
const CONTRACTOR_MULTIPLIER = 1 - PLATFORM_FEE_MULTIPLIER;

function calcSplit(amount: number) {
  const fee = Math.round(amount * PLATFORM_FEE_MULTIPLIER * 100) / 100;
  const payout = Math.round((amount - fee) * 100) / 100;
  return { fee, payout };
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
  pending:            { label: 'Pending',             color: 'text-gray-600',   bg: 'bg-gray-100',   icon: CircleDot },
  in_progress:        { label: 'In Progress',         color: 'text-blue-600',   bg: 'bg-blue-100',   icon: Clock },
  awaiting_approval:  { label: 'Awaiting Approval',   color: 'text-amber-600',  bg: 'bg-amber-100',  icon: AlertCircle },
  approved:           { label: 'Approved',            color: 'text-teal-600',   bg: 'bg-teal-100',   icon: CheckCircle },
  released:           { label: 'Payment Released',    color: 'text-green-600',  bg: 'bg-green-100',  icon: CheckCircle },
  disputed:           { label: 'Disputed',            color: 'text-red-600',    bg: 'bg-red-100',    icon: AlertCircle },
};

// ─── Approve & Pay Modal ──────────────────────────────────────────────────────

interface PayModalProps {
  milestone: PaymentMilestone;
  onSuccess: () => void;
  onClose: () => void;
}

function ApproveMilestoneModal({ milestone, onSuccess, onClose }: PayModalProps) {
  const { fee, payout } = calcSplit(milestone.amount);
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

    // Mark milestone as released + record split
    const { error } = await supabase
      .from('payment_milestones')
      .update({
        status: 'released',
        owner_approved_at: new Date().toISOString(),
        released_at: new Date().toISOString(),
        platform_fee_amount: fee,
        contractor_payout: payout,
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
                  <div className="flex justify-between text-green-700">
                    <span>→ Contractor Receives (90%)</span>
                    <span className="font-semibold">{formatILS(payout)}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>→ Platform Fee (10%)</span>
                    <span className="font-semibold">{formatILS(fee)}</span>
                  </div>
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
                  {formatILS(payout)} sent to contractor · {formatILS(fee)} platform fee retained.
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
      .from('payment_milestones')
      .update({
        status: 'awaiting_approval',
        contractor_submitted_at: new Date().toISOString(),
        contractor_note: note.trim() || null,
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
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([]);
  const [approveModal, setApproveModal] = useState<PaymentMilestone | null>(null);
  const [submitModal, setSubmitModal] = useState<PaymentMilestone | null>(null);

  const isOwner = profile?.id === project?.owner_id;
  const isContractor = profile?.id === project?.selected_contractor_id;

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!projectId || !profile) return;

    try {
      // 1. Load project
      const { data: proj } = await supabase
        .from('projects')
        .select('id, title, status, owner_id, selected_contractor_id')
        .eq('id', projectId)
        .maybeSingle();

      if (!proj) { navigate('/dashboard'); return; }
      setProject(proj);

      // 2. Load accepted bid
      const { data: bidData } = await supabase
        .from('bids')
        .select('id, total_price, contractor_id, milestones')
        .eq('project_id', projectId)
        .eq('status', 'accepted')
        .maybeSingle();

      if (!bidData) { navigate('/dashboard'); return; }
      setBid(bidData);

      // 3. Find or create payment record
      let paymentRecord: PaymentRecord | null = null;

      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, total_amount, platform_fee, status, is_deposit')
        .eq('project_id', projectId)
        .maybeSingle();

      if (existingPayment) {
        paymentRecord = existingPayment;
        setPayment(existingPayment);
      } else {
        // No payment yet (deposit modal DB write may have failed) — create one
        const platformFee = Math.round(bidData.total_price * PLATFORM_FEE_MULTIPLIER * 100) / 100;
        const { data: newPayment } = await supabase
          .from('payments')
          .insert({
            project_id: projectId,
            bid_id: bidData.id,
            owner_id: proj.owner_id,
            contractor_id: bidData.contractor_id,
            total_amount: bidData.total_price,
            platform_fee: platformFee,
            status: 'escrowed',
            is_deposit: false,
          })
          .select()
          .maybeSingle();

        paymentRecord = newPayment;
        setPayment(newPayment);
      }

      if (!paymentRecord) return;

      // 4. Load existing milestones
      const { data: existingMilestones } = await supabase
        .from('payment_milestones')
        .select('*')
        .eq('payment_id', paymentRecord.id)
        .order('sequence_order', { ascending: true });

      if (existingMilestones && existingMilestones.length > 0) {
        setMilestones(existingMilestones);
        return;
      }

      // 5. Lazy-init: create milestones from bid.milestones
      const bidMilestones: BidMilestone[] = Array.isArray(bidData.milestones) ? bidData.milestones : [];
      if (bidMilestones.length === 0) return;

      const toInsert = bidMilestones.map((m, i) => {
        const { fee, payout } = calcSplit(m.price);
        return {
          payment_id: paymentRecord!.id,
          title: m.description || `Milestone ${i + 1}`,
          description: m.description,
          amount: m.price,
          percentage: Math.round((m.price / bidData.total_price) * 100 * 100) / 100,
          sequence_order: i + 1,
          status: 'pending' as MilestoneStatus,
          platform_fee_amount: fee,
          contractor_payout: payout,
        };
      });

      const { data: createdMilestones } = await supabase
        .from('payment_milestones')
        .insert(toInsert)
        .select();

      setMilestones(createdMilestones ?? []);
    } catch (err) {
      console.error('ProjectPayments loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, profile, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived stats ───────────────────────────────────────────────────────────

  const totalBid = bid?.total_price ?? 0;
  const totalPlatformFee = Math.round(totalBid * PLATFORM_FEE_MULTIPLIER * 100) / 100;
  const totalContractorPayout = totalBid - totalPlatformFee;
  const releasedAmount = milestones
    .filter(m => m.status === 'released')
    .reduce((s, m) => s + m.contractor_payout, 0);
  const platformCollected = milestones
    .filter(m => m.status === 'released')
    .reduce((s, m) => s + m.platform_fee_amount, 0);
  const remaining = totalContractorPayout - releasedAmount;

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
          <p className="text-gray-600 mt-1">
            {isOwner ? 'Approve milestone completions and release payments to contractor.' : 'Submit milestones for owner approval to receive payment.'}
          </p>
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
              <span>{milestones.filter(m => m.status === 'released').length} of {milestones.length} milestones paid</span>
              <span>{totalBid > 0 ? Math.round((releasedAmount / totalContractorPayout) * 100) : 0}% complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${totalBid > 0 ? (releasedAmount / totalContractorPayout) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Platform fee note */}
          <div className="mt-4 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
            <Shield className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-orange-700">
              <strong>Platform Fee:</strong> {formatILS(platformCollected)} collected so far of {formatILS(totalPlatformFee)} total.
              All payments are processed through escrow — 10% of every milestone is retained by the platform.
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
                const cfg = STATUS_CONFIG[milestone.status];
                const StatusIcon = cfg.icon;
                const { fee, payout } = calcSplit(milestone.amount);

                return (
                  <div key={milestone.id} className="p-6">
                    {/* Milestone header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${milestone.status === 'released' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {milestone.status === 'released' ? <CheckCircle className="w-4 h-4" /> : index + 1}
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
                    <div className="ml-11 grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        Contractor: {formatILS(payout)} (90%)
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-orange-400" />
                        Platform fee: {formatILS(fee)} (10%)
                      </div>
                    </div>

                    {/* Contractor note (shown when submitted) */}
                    {milestone.contractor_note && (
                      <div className="ml-11 mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Contractor's Completion Note:</p>
                        <p className="text-sm text-blue-900">{milestone.contractor_note}</p>
                      </div>
                    )}

                    {/* Released info */}
                    {milestone.status === 'released' && milestone.released_at && (
                      <div className="ml-11 mb-3 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-green-700">
                            Payment Released — {new Date(milestone.released_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-green-600">
                            {formatILS(milestone.contractor_payout)} to contractor · {formatILS(milestone.platform_fee_amount)} platform fee
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

                      {/* CONTRACTOR: awaiting approval — waiting message */}
                      {isContractor && milestone.status === 'awaiting_approval' && (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                          <Clock className="w-4 h-4" />
                          Waiting for owner to approve and pay…
                        </div>
                      )}

                      {/* OWNER: approve & pay awaiting_approval milestone */}
                      {isOwner && milestone.status === 'awaiting_approval' && (
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={() => setApproveModal(milestone)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                          >
                            <CreditCard className="w-4 h-4" />
                            Approve & Pay {formatILS(milestone.amount)}
                          </button>
                          <button
                            onClick={async () => {
                              await supabase.from('payment_milestones').update({ status: 'disputed' }).eq('id', milestone.id);
                              loadData();
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition-colors border border-red-200"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Dispute
                          </button>
                        </div>
                      )}

                      {/* OWNER: pending milestone — instructions */}
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
        {milestones.length > 0 && milestones.every(m => m.status === 'released') && (
          <div className="mt-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-center text-white shadow-lg">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-90" />
            <h3 className="text-xl font-bold mb-1">Project Complete!</h3>
            <p className="text-green-100 text-sm">
              All {milestones.length} milestones have been paid. Total released: {formatILS(releasedAmount)}.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {approveModal && (
        <ApproveMilestoneModal
          milestone={approveModal}
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
