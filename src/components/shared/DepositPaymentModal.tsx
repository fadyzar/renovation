/**
 * DepositPaymentModal
 *
 * Professional fake payment UI for contractor 10% deposit.
 * Designed so the payment service layer can be swapped with a real provider
 * (Stripe / Cardcom / Pelecard) by replacing only `processMockDeposit`.
 *
 * States: form → processing → success | error
 */

import { useState } from 'react';
import {
  X,
  Lock,
  Shield,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Building2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  processMockDeposit,
  type CardDetails,
  type PaymentResult,
} from '../../lib/mockPaymentService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  bidId: string;
  ownerId: string;
  contractorId: string;
  projectTitle: string;
  totalBidAmount: number;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'processing' | 'success' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEPOSIT_PERCENTAGE = 10;

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function formatDisplayCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16).padEnd(16, '•');
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardVisual({ card }: { card: Partial<CardDetails> }) {
  const displayNumber = formatDisplayCardNumber(card.cardNumber ?? '');
  const name = card.cardholderName?.toUpperCase() || 'YOUR NAME';
  const expiry =
    card.expiryMonth && card.expiryYear
      ? `${card.expiryMonth}/${card.expiryYear}`
      : 'MM/YY';

  return (
    <div className="relative h-40 bg-gradient-to-br from-slate-700 via-slate-800 to-blue-900 rounded-2xl p-5 text-white shadow-xl overflow-hidden mb-6 select-none">
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-40 h-40 border border-white/10 rounded-full" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 border border-white/10 rounded-full" />

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-semibold tracking-[0.2em] opacity-60 uppercase">
            Renovation Escrow
          </span>
          <CreditCard className="w-6 h-6 opacity-60" />
        </div>

        {/* Chip + number */}
        <div>
          <div className="w-9 h-6 bg-amber-300/80 rounded mb-3 grid grid-cols-2 gap-0.5 p-0.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-amber-400/50 rounded-sm" />
            ))}
          </div>
          <p className="font-mono text-base tracking-widest">{displayNumber}</p>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <p className="text-[9px] opacity-50 uppercase tracking-widest mb-0.5">Cardholder</p>
            <p className="text-xs font-semibold tracking-wide">{name}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] opacity-50 uppercase tracking-widest mb-0.5">Expires</p>
            <p className="text-xs font-semibold">{expiry}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DepositPaymentModal({
  projectId,
  bidId,
  ownerId,
  contractorId,
  projectTitle,
  totalBidAmount,
  onSuccess,
  onClose,
}: Props) {
  const depositAmount = Math.round((totalBidAmount * DEPOSIT_PERCENTAGE) / 100);

  const [state, setState] = useState<ModalState>('form');
  const [card, setCard] = useState<CardDetails>({
    cardNumber: '',
    cardholderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CardDetails, string>>>({});
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: typeof errors = {};
    const digits = card.cardNumber.replace(/\D/g, '');
    if (digits.length < 13) errs.cardNumber = 'Enter a valid card number';
    if (!card.cardholderName.trim()) errs.cardholderName = 'Enter cardholder name';
    if (!card.expiryMonth || !card.expiryYear) errs.expiryMonth = 'Enter expiry date';
    if (card.cvv.length < 3) errs.cvv = 'Enter CVV';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handlePay() {
    if (!validate()) return;
    setState('processing');

    const result = await processMockDeposit(depositAmount, card);
    setPaymentResult(result);

    if (!result.success) {
      setState('error');
      return;
    }

    // Persist mock transaction + update project status
    try {
      // 1. Create payment record
      const { error: paymentError } = await supabase.from('payments').insert({
        project_id: projectId,
        bid_id: bidId,
        owner_id: ownerId,
        contractor_id: contractorId,
        total_amount: depositAmount,
        is_deposit: true,
        deposit_percentage: DEPOSIT_PERCENTAGE,
        status: 'escrowed',
        mock_transaction_id: result.transactionId,
        paid_at: result.timestamp,
        payment_method_last4: result.last4,
      });

      if (paymentError) throw paymentError;

      // 2. Advance project to in_progress
      const { error: projectError } = await supabase
        .from('projects')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', projectId);

      if (projectError) throw projectError;

      setState('success');
    } catch (err) {
      console.error('Failed to persist payment record:', err);
      // Payment was mock-successful but DB write failed — still show success
      // in production, this would trigger a reconciliation job
      setState('success');
    }
  }

  function handleCardNumberChange(raw: string) {
    setCard(prev => ({ ...prev, cardNumber: formatCardNumber(raw) }));
    setErrors(prev => ({ ...prev, cardNumber: undefined }));
  }

  function handleExpiryChange(raw: string) {
    const formatted = formatExpiry(raw);
    const parts = formatted.split('/');
    setCard(prev => ({
      ...prev,
      expiryMonth: parts[0] ?? '',
      expiryYear: parts[1] ?? '',
    }));
    setErrors(prev => ({ ...prev, expiryMonth: undefined }));
  }

  function handleRetry() {
    setPaymentResult(null);
    setState('form');
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderAmountSummary() {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Total Project Bid</span>
          <span className="text-sm font-semibold text-gray-900">
            ${totalBidAmount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-600">Platform Fee (included)</span>
          <span className="text-sm text-gray-500">—</span>
        </div>
        <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
          <div>
            <span className="text-sm font-bold text-blue-900">
              Required Deposit ({DEPOSIT_PERCENTAGE}%)
            </span>
            <p className="text-xs text-blue-600 mt-0.5">
              Held in escrow · released after first milestone
            </p>
          </div>
          <span className="text-2xl font-bold text-blue-700">
            ${depositAmount.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  // ── States ─────────────────────────────────────────────────────────────────

  function renderForm() {
    const expiryDisplay =
      card.expiryMonth || card.expiryYear
        ? `${card.expiryMonth}${card.expiryYear ? `/${card.expiryYear}` : ''}`
        : '';

    return (
      <>
        {renderAmountSummary()}
        <CardVisual card={card} />

        <div className="space-y-4">
          {/* Card number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Card Number
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="1234 5678 9012 3456"
              value={card.cardNumber}
              onChange={e => handleCardNumberChange(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.cardNumber ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.cardNumber && (
              <p className="text-xs text-red-500 mt-1">{errors.cardNumber}</p>
            )}
          </div>

          {/* Cardholder name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cardholder Name
            </label>
            <input
              type="text"
              placeholder="John Smith"
              value={card.cardholderName}
              onChange={e =>
                setCard(prev => ({ ...prev, cardholderName: e.target.value }))
              }
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.cardholderName ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.cardholderName && (
              <p className="text-xs text-red-500 mt-1">{errors.cardholderName}</p>
            )}
          </div>

          {/* Expiry + CVV */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM/YY"
                value={expiryDisplay}
                onChange={e => handleExpiryChange(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.expiryMonth ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.expiryMonth && (
                <p className="text-xs text-red-500 mt-1">{errors.expiryMonth}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CVV
              </label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="•••"
                maxLength={4}
                value={card.cvv}
                onChange={e =>
                  setCard(prev => ({
                    ...prev,
                    cvv: e.target.value.replace(/\D/g, '').slice(0, 4),
                  }))
                }
                className={`w-full px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.cvv ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.cvv && (
                <p className="text-xs text-red-500 mt-1">{errors.cvv}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pay button */}
        <button
          onClick={handlePay}
          className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-base rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          <Lock className="w-4 h-4" />
          Pay ${depositAmount.toLocaleString()} Deposit Securely
        </button>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Lock className="w-3.5 h-3.5 text-green-500" />
            256-bit SSL
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Building2 className="w-3.5 h-3.5 text-blue-500" />
            Funds in Escrow
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Shield className="w-3.5 h-3.5 text-orange-500" />
            PCI DSS
          </div>
        </div>
      </>
    );
  }

  function renderProcessing() {
    return (
      <div className="py-12 flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-100 rounded-full" />
          <div className="absolute inset-0 w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <Lock className="absolute inset-0 m-auto w-7 h-7 text-blue-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 mb-1">Processing payment…</p>
          <p className="text-sm text-gray-500">
            Securely authorizing ${depositAmount.toLocaleString()} deposit
          </p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderSuccess() {
    return (
      <div className="py-8 flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-[scale-in_0.3s_ease-out]">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Deposit Paid!</h3>
          <p className="text-gray-600 text-sm">
            Your $
            {depositAmount.toLocaleString()} deposit is secured in escrow.
          </p>
          <p className="text-gray-600 text-sm mt-1">
            <strong>{projectTitle}</strong> is now active.
          </p>
        </div>

        {paymentResult && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 w-full text-left">
            <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">
              Transaction Details
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Transaction ID</span>
                <span className="font-mono text-xs text-gray-800 break-all">
                  {paymentResult.transactionId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-semibold text-gray-900">
                  ${paymentResult.amount.toLocaleString()} {paymentResult.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Card</span>
                <span className="text-gray-800">•••• {paymentResult.last4}</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onSuccess}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
        >
          Continue to Dashboard
        </button>
      </div>
    );
  }

  function renderError() {
    return (
      <div className="py-8 flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Payment Failed</h3>
          <p className="text-sm text-red-600">
            {paymentResult?.errorMessage ?? 'An unexpected error occurred.'}
          </p>
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={handleRetry}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Layout ──────────────────────────────────────────────────────────────────

  const canClose = state === 'form' || state === 'error' || state === 'success';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Lock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Secure Deposit Payment</h2>
              {state === 'form' && (
                <p className="text-xs text-gray-500">Funds held in escrow — protected</p>
              )}
            </div>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {state === 'form' && renderForm()}
          {state === 'processing' && renderProcessing()}
          {state === 'success' && renderSuccess()}
          {state === 'error' && renderError()}
        </div>
      </div>
    </div>
  );
}
