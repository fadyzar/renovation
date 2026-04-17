/**
 * FirstPaymentModal — Owner pays the first milestone to activate the project.
 *
 * This is the gate that:
 *  1. Charges the owner for the first milestone via mock credit card
 *  2. Deducts 10% platform fee
 *  3. Advances project → in_progress
 *  4. Creates conversation & sends contractor's intro auto-message
 *  5. Creates all project milestones in the DB
 *
 * TO INTEGRATE REAL PAYMENT: replace processMockDeposit with your provider call
 * and pass the real transactionId to the RPC. Everything else stays the same.
 */

import { useState } from 'react';
import {
  X, Lock, Shield, Building2, CheckCircle, AlertCircle,
  CreditCard, DollarSign, MessageCircle,
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
  projectTitle, totalBidAmount, milestones,
  onSuccess, onClose,
}: Props) {
  // First milestone amount = what owner pays now
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
    if (card.cardNumber.replace(/\D/g, '').length < 13) errs.cardNumber = 'הכנס מספר כרטיס תקין';
    if (!card.cardholderName.trim()) errs.cardholderName = 'הכנס שם בעל הכרטיס';
    if (!card.expiryMonth || !card.expiryYear) errs.expiryMonth = 'הכנס תאריך תפוגה';
    if (card.cvv.length < 3) errs.cvv = 'הכנס CVV';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handlePay() {
    if (!validateCard()) return;
    setStep('processing');

    try {
      // 1. Mock payment processor
      const result = await processMockDeposit(firstAmount, card, 'ILS');
      if (!result.success) {
        setErrMsg(result.errorMessage ?? 'התשלום נכשל. נסה שנית.');
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
        setErrMsg('שגיאה בהפעלת הפרויקט. פנה לתמיכה.');
        setStep('error');
        return;
      }

      setStep('success');
    } catch (err) {
      console.error('Payment flow error:', err);
      setErrMsg('שגיאה לא צפויה. נסה שנית.');
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
              <h2 className="text-base font-bold text-white">תשלום ראשון — הפעלת פרויקט</h2>
              <p className="text-xs text-green-100">תשלום מאובטח · 10% עמלת פלטפורמה נכלל</p>
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
              {/* Project info */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-500 mb-1">פרויקט</p>
                <p className="font-bold text-gray-900">{projectTitle}</p>
                <p className="text-sm text-gray-600 mt-1">קבלן: {contractorName}</p>
              </div>

              {/* First milestone */}
              {firstMilestone && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-blue-700 mb-2">שלב ראשון לתשלום</p>
                  <p className="text-sm text-gray-800 font-medium">{firstMilestone.description}</p>
                </div>
              )}

              {/* Payment breakdown */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">פירוט תשלום</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">סכום שלב ראשון</span>
                    <span className="font-semibold">₪{firstAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>עמלת פלטפורמה ({PLATFORM_FEE_PCT}%)</span>
                    <span className="font-semibold">₪{platformFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>לקבלן (90%)</span>
                    <span className="font-semibold">₪{contractorReceives.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-green-200 pt-2 flex justify-between">
                    <span className="font-bold text-gray-900">סה"כ לתשלום</span>
                    <span className="text-xl font-bold text-green-700">₪{firstAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* What opens after payment */}
              <div className="space-y-2 mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">מה נפתח לאחר התשלום:</p>
                {[
                  { icon: MessageCircle, text: 'צ\'אט מלא עם הקבלן', color: 'text-blue-600 bg-blue-50' },
                  { icon: CheckCircle, text: 'פרויקט עובר לסטטוס "בביצוע"', color: 'text-green-600 bg-green-50' },
                  { icon: Lock, text: 'ניהול שלבים ושחרור תשלומים', color: 'text-purple-600 bg-purple-50' },
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
                <p className="text-xs text-amber-700 font-medium">Demo Mode — לא מבוצעת סליקה אמיתית</p>
              </div>

              <button
                onClick={() => setStep('card')}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-lg"
              >
                המשך לתשלום ←
              </button>
            </>
          )}

          {/* ── CARD FORM ─────────────────────────────────────────────────────── */}
          {step === 'card' && (
            <>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900">פרטי כרטיס אשראי</h3>
                <span className="text-sm font-bold text-green-700">₪{firstAmount.toLocaleString()}</span>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר כרטיס</label>
                  <input
                    type="text" inputMode="numeric" placeholder="4242 4242 4242 4242"
                    value={card.cardNumber}
                    onChange={e => { setCard(p => ({ ...p, cardNumber: formatCard(e.target.value) })); setErrors(p => ({ ...p, cardNumber: undefined })); }}
                    className={`w-full px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.cardNumber ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.cardNumber && <p className="text-xs text-red-500 mt-1">{errors.cardNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם בעל הכרטיס</label>
                  <input
                    type="text" placeholder="Israel Israeli"
                    value={card.cardholderName}
                    onChange={e => setCard(p => ({ ...p, cardholderName: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.cardholderName ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.cardholderName && <p className="text-xs text-red-500 mt-1">{errors.cardholderName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">תוקף</label>
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
                שלם ₪{firstAmount.toLocaleString()} והפעל פרויקט
              </button>

              <div className="flex items-center justify-center gap-6 mt-4">
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><Lock className="w-3.5 h-3.5" />SSL 256bit</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><Building2 className="w-3.5 h-3.5" />Escrow</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><Shield className="w-3.5 h-3.5" />PCI DSS</span>
              </div>

              <button onClick={() => setStep('review')} className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700">
                ← חזור לסקירה
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
                <p className="text-lg font-semibold text-gray-900 mb-1">מעבד תשלום…</p>
                <p className="text-sm text-gray-500">מאמת כרטיס ומפעיל את הפרויקט</p>
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
                <h3 className="text-xl font-bold text-gray-900 mb-1">הפרויקט הופעל!</h3>
                <p className="text-sm text-gray-600">
                  התשלום אושר. <strong>{contractorName}</strong> ישלח הודעה בקרוב.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 w-full text-left">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">אושר:</p>
                <div className="space-y-1.5 text-sm">
                  {[
                    `תשלום ₪${firstAmount.toLocaleString()} עבר בהצלחה`,
                    'פרויקט עבר לסטטוס "בביצוע"',
                    'צ\'אט עם הקבלן נפתח',
                    'הקבלן קיבל הודעה',
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
                עבור לניהול פרויקט →
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
                <h3 className="text-xl font-bold text-gray-900 mb-1">התשלום נכשל</h3>
                <p className="text-sm text-red-600">{errMsg}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setStep('card')} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl">נסה שנית</button>
                <button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">ביטול</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
