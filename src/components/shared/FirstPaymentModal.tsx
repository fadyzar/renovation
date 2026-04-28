import { useState } from 'react';
import {
  X, Lock, Shield, Building2, CheckCircle, AlertCircle,
  CreditCard, DollarSign, MessageCircle, Phone, MapPin,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
  projectAddress?: string;
  totalBidAmount: number;
  milestones: BidMilestone[];
  onSuccess: (conversationId?: string) => void;
  onClose: () => void;
}

type Step = 'review' | 'card' | 'processing' | 'success' | 'error';

const PLATFORM_FEE_PCT = 10;

function formatCardNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

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
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [errMsg, setErrMsg] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');

  const cardReady =
    cardNumber.replace(/\s/g, '').length >= 13 &&
    expiry.length === 5 &&
    cvc.length >= 3 &&
    cardName.trim().length > 0;

  async function handlePay() {
    setStep('processing');
    setProcessingStatus('Contacting payment processor…');

    await new Promise(r => setTimeout(r, 800));
    setProcessingStatus('Authorizing payment…');
    await new Promise(r => setTimeout(r, 900));
    setProcessingStatus('Confirming card…');
    await new Promise(r => setTimeout(r, 700));
    setProcessingStatus('Activating project…');

    try {
      const mockTxId = `mock_pi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'activate_project_after_payment',
        {
          p_project_id:       projectId,
          p_bid_id:           bidId,
          p_owner_id:         ownerId,
          p_contractor_id:    contractorId,
          p_total_amount:     totalBidAmount,
          p_first_amount:     firstAmount,
          p_mock_tx_id:       mockTxId,
          p_contractor_name:  contractorName,
          p_contractor_phone: contractorPhone,
          p_milestones:       milestones,
        }
      );

      if (rpcError) {
        console.error('RPC error:', rpcError);
        setErrMsg('Payment processed but project activation failed. Please contact support with code: ACT-ERR');
        setStep('error');
        return;
      }

      const convId = (rpcData as any)?.conversation_id as string | undefined;
      setConversationId(convId);
      setStep('success');
    } catch (err: any) {
      console.error('Payment flow error:', err);
      setErrMsg(err?.message ?? 'Unexpected error. Please try again.');
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
              <p className="text-xs text-green-100">Secure payment · 10% platform fee</p>
            </div>
          </div>
          {(step === 'review' || step === 'card' || step === 'error') && (
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        <div className="p-6">

          {/* ── REVIEW ── */}
          {step === 'review' && (
            <>
              <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-500 mb-0.5">Project</p>
                <p className="font-bold text-gray-900">{projectTitle}</p>
                <p className="text-sm text-gray-600 mt-1">Contractor: <strong>{contractorName}</strong></p>
              </div>

              {firstMilestone && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">First Milestone</p>
                  <p className="text-sm text-gray-800 font-medium">{firstMilestone.description}</p>
                  {firstMilestone.duration && (
                    <p className="text-xs text-gray-500 mt-1">Estimated: {firstMilestone.duration} days</p>
                  )}
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">First Milestone Payment</span>
                  <span className="text-2xl font-bold text-green-700">${firstAmount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">This activates your project and unlocks direct communication with your contractor.</p>
              </div>

              <div className="space-y-2 mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What unlocks after payment:</p>
                {[
                  { icon: MessageCircle, text: 'Direct chat with contractor', color: 'text-blue-600 bg-blue-50' },
                  { icon: Phone,         text: "Contractor's phone number",   color: 'text-green-600 bg-green-50' },
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

              <button
                onClick={() => setStep('card')}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-lg"
              >
                Continue to Payment →
              </button>
            </>
          )}

          {/* ── CARD ── */}
          {step === 'card' && (
            <>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900">Card Details</h3>
                <span className="text-sm font-bold text-green-700">${firstAmount.toLocaleString()}</span>
              </div>

              <div className="space-y-3 mb-6">
                {/* Card number */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Card Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-mono"
                    />
                    <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name on Card</label>
                  <input
                    type="text"
                    placeholder="John Smith"
                    value={cardName}
                    onChange={e => setCardName(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>

                {/* Expiry + CVC */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={e => setExpiry(formatExpiry(e.target.value))}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CVC</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="123"
                      value={cvc}
                      onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={!cardReady}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* ── PROCESSING ── */}
          {step === 'processing' && (
            <div className="py-10 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-green-100 rounded-full" />
                <div className="absolute inset-0 w-20 h-20 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                <CreditCard className="absolute inset-0 m-auto w-7 h-7 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 mb-1">Processing payment…</p>
                <p className="text-sm text-gray-500">{processingStatus}</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── SUCCESS ── */}
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
                onClick={() => onSuccess(conversationId)}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
              >
                Open Project Chat →
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
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
