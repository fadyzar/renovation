/**
 * FirstPaymentModal — Owner pays the first milestone to activate the project.
 *
 * On success:
 *  1. Charges via mock credit card
 *  2. Calls activate_project_after_payment RPC (SECURITY DEFINER):
 *     - Advances project → in_progress
 *     - Creates milestones in DB
 *     - Creates conversation
 *     - Sends contractor's auto-intro message (bypasses RLS)
 *
 * TO INTEGRATE REAL PAYMENT: replace processMockDeposit with your provider
 * and pass the real transactionId to the RPC. Everything else stays the same.
 */

import { useState } from 'react';
import {
  X, Lock, Shield, Building2, CheckCircle, AlertCircle,
  CreditCard, DollarSign, MessageCircle, Phone, MapPin,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { processMockDeposit, type CardDetails } from '../../lib/mockPaymentService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BidMilestone {
  description: string;
  price: number;
  duration?: number;
}

interface Props {
  projectId: string;
  bidId: string;
  ownerId: string;
  contractorId: string;
  contractorName: string;
  contractorPhone: string;
  projectTitle: string;
  projectAddress?: string;   // shown after payment unlocks contact info
  totalBidAmount: number;
  milestones: BidMilestone[];
  onSuccess: () => void;
  onClose: () => void;
}

type Step = 'review' | 'card' | 'processing' | 'success' | 'error';

const PLATFORM_FEE_PCT = 10;

function formatCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FirstPaymentModal({
  projectId, bidId, ownerId, contractorId,
  contractorName, contractorPhone,
  projectTitle, projectAddress,
  totalBidAmount, milestones,
  onSuccess, onClose,
}: Props) {
  const firstMilestone = milestones[0];
  const firstAmount = firstMilestone?.price ?? Math.round(totalBidAmount * 0.25);
  const platformFee = Math.round(firstAmount * PLATFORM_FEE_PCT / 100);
  const contractorReceives = firstAmount - platformFee;

  const [step, setStep] = useState<Step>('review');
  const [card, setCard] = useState<CardDetails>({
    cardNumber: '', cardholderName: '', expiryMonth: '', expiryYear: '', cvv: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CardDetails, string>>>({});
  const [errMsg, setErrMsg] = useState('');

  const expiryDisplay = card.expiryMonth || card.expiryYear
    ? `${card.expiryMonth}${card.expiryYear ? `/${card.expiryYear}` : ''}` : '';

  function validateCard() {
    const errs: typeof errors = {};
    if (card.cardNumber.replace(/\D/g, '').length < 13) errs.cardNumber = 'Enter a valid card number';
    if (!card.cardholderName.trim()) errs.cardholderName = 'Enter cardholder name';
    if (!card.expiryMonth || !card.expiryYear) errs.expiryMonth = 'Enter expiry date';
    if (card.cvv.length < 3) errs.cvv = 'Enter CVV';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handlePay() {
    if (!validateCard()) return;
    setStep('processing');

    try {
      // 1. Mock payment processor
      const result = await processMockDeposit(firstAmount, card, 'USD');
      if (!result.success) {
        setErrMsg(result.errorMessage ?? 'Payment failed. Please try again.');
        setStep('error');
        return;
      }

      // 2. Activate project via SECURITY DEFINER function
      const { error: rpcError } = await supabase.rpc('activate_project_after_payment', {
        p_project_id:       projectId,
        p_bid_id:           bidId,
        p_owner_id:         ownerId,
        p_contractor_id:    contractorId,
        p_total_amount:     totalBidAmount,
        p_first_amount:     firstAmount,
        p_mock_tx_id:       result.transactionId,
        p_contractor_name:  contractorName,
        p_contractor_phone: contractorPhone,
        p_milestones:       JSON.stringify(milestones),
      });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        setErrMsg('Error activating project. Please contact support.');
        setStep('error');
        return;
      }

      setStep('success');
    } catch (err) {
      console.error('Payment flow error:', err);
      setErrMsg('Unexpected error. Please try again.');
      setStep('error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">First Payment — Activate Project</h2>
              <p className="text-xs text-green-100">Secure payment · 10% platform fee included</p>
            </div>
          </div>
          {(step === 'review' || step === 'card' || step === 'error') && (
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        <div className="p-6">

          {/* ── REVIEW ────────────────────────────────────────────────────────── */}
          {step === 'review' && (
            <>
              {/* Project + contractor info */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-500 mb-0.5">Project</p>
                <p className="font-bold text-gray-900">{projectTitle}</p>
                <p className="text-sm text-gray-600 mt-1">Contractor: <strong>{contractorName}</strong></p>
              </div>

              {/* First milestone */}
              {firstMilestone && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">First Milestone</p>
                  <p className="text-sm text-gray-800 font-medium">{firstMilestone.description}</p>
                  {firstMilestone.duration && (
                    <p className="text-xs text-gray-500 mt-1">Estimated: {firstMilestone.duration} days</p>
                  )}
                </div>
              )}

              {/* Payment breakdown */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">Payment Breakdown</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">First milestone amount</span>
                    <span className="font-semibold">${firstAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>Platform fee ({PLATFORM_FEE_PCT}%)</span>
                    <span className="font-semibold">${platformFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>To contractor (90%)</span>
                    <span className="font-semibold">${contractorReceives.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-green-200 pt-2 flex justify-between">
                    <span className="font-bold text-gray-900">Total due today</span>
                    <span className="text-xl font-bold text-green-700">${firstAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* What unlocks after payment */}
              <div className="space-y-2 mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What unlocks after payment:</p>
                {[
                  { icon: MessageCircle, text: 'Direct chat with contractor', color: 'text-blue-600 bg-blue-50' },
                  { icon: Phone,         text: "Contractor's phone number for contact", color: 'text-green-600 bg-green-50' },
                  { icon: MapPin,        text: 'Project address for navigation', color: 'text-purple-600 bg-purple-50' },
                  { icon: CheckCircle,   text: 'Project status becomes Active', color: 'text-emerald-600 bg-emerald-50' },
                ].map(({ icon: Icon, text, color }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-gray-700">{text}</span>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">Demo Mode — No real charge is processed</p>
              </div>

              <button
                onClick={() => setStep('card')}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-lg"
              >
                Continue to Payment →
              </button>
            </>
          )}

          {/* ── CARD FORM ─────────────────────────────────────────────────────── */}
          {step === 'card' && (
            <>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900">Card Details</h3>
                <span className="text-sm font-bold text-green-700">${firstAmount.toLocaleString()}</span>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                  <input
                    type="text" inputMode="numeric" placeholder="4242 4242 4242 4242"
                    value={card.cardNumber}
                    onChange={e => { setCard(p => ({ ...p, cardNumber: formatCard(e.target.value) })); setErrors(p => ({ ...p, cardNumber: undefined })); }}
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
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Pay ${firstAmount.toLocaleString()} &amp; Activate Project
              </button>

              <div className="flex items-center justify-center gap-6 mt-4">
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><Lock className="w-3.5 h-3.5" />SSL 256-bit</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><Building2 className="w-3.5 h-3.5" />Escrow</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><Shield className="w-3.5 h-3.5" />PCI DSS</span>
              </div>

              <button onClick={() => setStep('review')} className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700">
                ← Back to Review
              </button>
            </>
          )}

          {/* ── PROCESSING ────────────────────────────────────────────────────── */}
          {step === 'processing' && (
            <div className="py-10 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-green-100 rounded-full" />
                <div className="absolute inset-0 w-20 h-20 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                <CreditCard className="absolute inset-0 m-auto w-7 h-7 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 mb-1">Processing payment…</p>
                <p className="text-sm text-gray-500">Verifying card and activating project</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── SUCCESS ───────────────────────────────────────────────────────── */}
          {step === 'success' && (
            <div className="py-6 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Project Activated!</h3>
                <p className="text-sm text-gray-600">
                  Payment confirmed. <strong>{contractorName}</strong> has been notified and will reach out shortly.
                </p>
              </div>

              {/* Unlocked contact info */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 w-full text-left space-y-3">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Unlocked Contact Info</p>
                {contractorPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Contractor Phone</p>
                      <a href={`tel:${contractorPhone}`} className="text-sm font-semibold text-blue-700 hover:underline">
                        {contractorPhone}
                      </a>
                    </div>
                  </div>
                )}
                {projectAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Project Address</p>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(projectAddress)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-sm font-semibold text-blue-700 hover:underline"
                      >
                        {projectAddress}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 w-full text-left">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Confirmed</p>
                <div className="space-y-1.5 text-sm">
                  {[
                    `Payment $${firstAmount.toLocaleString()} processed`,
                    'Project status → In Progress',
                    'Chat with contractor unlocked',
                    'Contractor notified',
                  ].map(txt => (
                    <div key={txt} className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      {txt}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onSuccess}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
              >
                Open Project Chat →
              </button>
            </div>
          )}

          {/* ── ERROR ─────────────────────────────────────────────────────────── */}
          {step === 'error' && (
            <div className="py-6 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Payment Failed</h3>
                <p className="text-sm text-red-600">{errMsg}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setStep('card')} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl">Try Again</button>
                <button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">Cancel</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
