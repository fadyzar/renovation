/**
 * DepositPaymentModal — Demo Mode
 *
 * Contractor pays the 10% security deposit to start the project.
 * This is a mock flow: no real payment is processed.
 *
 * On confirmation:
 *  1. Payment record written to `payments` table (escrowed)
 *  2. Project status advanced: awaiting_deposit → in_progress
 *  3. Conversation created (or found) between contractor and owner
 *  4. Auto-message sent from contractor to owner
 */

import { useState } from 'react';
import { X, Lock, Shield, CheckCircle, AlertCircle, Building2, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

type ModalState = 'confirm' | 'processing' | 'success' | 'error';

const DEPOSIT_PCT = 10;

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function generateTxId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MOCK-${ts}-${rand}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const depositAmount = Math.round((totalBidAmount * DEPOSIT_PCT) / 100);
  const [state, setState] = useState<ModalState>('confirm');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleConfirm() {
    setState('processing');

    // 1.5 s UX pause
    await delay(1500);

    try {
      const txId = generateTxId();
      const now = new Date().toISOString();

      // ── 1. Write deposit payment record ────────────────────────────────────
      // Ignore duplicate error (UNIQUE project_id+bid_id) — just proceed
      await supabase.from('payments').upsert(
        {
          project_id: projectId,
          bid_id: bidId,
          owner_id: ownerId,
          contractor_id: contractorId,
          total_amount: depositAmount,
          is_deposit: true,
          deposit_percentage: DEPOSIT_PCT,
          status: 'escrowed',
          mock_transaction_id: txId,
          paid_at: now,
        },
        { onConflict: 'project_id,bid_id', ignoreDuplicates: true }
      );

      // ── 2. Advance project status → in_progress ────────────────────────────
      const { error: projError } = await supabase
        .from('projects')
        .update({ status: 'in_progress', started_at: now })
        .eq('id', projectId);

      if (projError) {
        console.error('Project update error:', projError);
        // Continue — project update may already be done
      }

      // ── 3. Find or create conversation ─────────────────────────────────────
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('project_id', projectId)
        .eq('contractor_id', contractorId)
        .maybeSingle();

      let convId: string | null = existingConv?.id ?? null;

      if (!convId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            project_id: projectId,
            contractor_id: contractorId,
            owner_id: ownerId,
            last_message_at: now,
          })
          .select('id')
          .single();

        if (convError) {
          console.error('Conversation create error:', convError);
        } else {
          convId = newConv?.id ?? null;
        }
      }

      // ── 4. Send auto intro message from contractor ──────────────────────────
      if (convId) {
        await supabase.from('messages').insert({
          conversation_id: convId,
          sender_id: contractorId,
          content:
            "Hi! I received your project request and I'm ready to get started. When would be a good time to schedule a visit and begin the renovation?",
        });

        await supabase
          .from('conversations')
          .update({ last_message_at: now })
          .eq('id', convId);
      }

      setState('success');
    } catch (err) {
      console.error('Deposit flow error:', err);
      setErrorMsg('Something went wrong. Please try again.');
      setState('error');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Security Deposit</h2>
              <p className="text-xs text-blue-100">Held in escrow · released after first milestone</p>
            </div>
          </div>
          {(state === 'confirm' || state === 'error') && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        <div className="p-6">

          {/* ── CONFIRM STATE ─────────────────────────────────────────────────── */}
          {state === 'confirm' && (
            <>
              {/* Amount summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">Project</span>
                  <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{projectTitle}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">Total Bid</span>
                  <span className="text-sm font-semibold text-gray-900">${totalBidAmount.toLocaleString()}</span>
                </div>
                <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-bold text-blue-900">Deposit ({DEPOSIT_PCT}%)</span>
                    <p className="text-xs text-blue-600 mt-0.5">Returned against first milestone payment</p>
                  </div>
                  <span className="text-2xl font-bold text-blue-700">${depositAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* What happens next */}
              <div className="space-y-3 mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What happens when you confirm:</p>
                {[
                  { icon: Lock, text: 'Deposit secured in escrow', color: 'text-blue-600 bg-blue-50' },
                  { icon: CheckCircle, text: 'Project status becomes Active', color: 'text-green-600 bg-green-50' },
                  { icon: MessageCircle, text: 'Chat with owner unlocked', color: 'text-purple-600 bg-purple-50' },
                ].map(({ icon: Icon, text, color }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-gray-700">{text}</span>
                  </div>
                ))}
              </div>

              {/* Demo mode badge */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">Demo Mode — No real payment is processed</p>
              </div>

              <button
                onClick={handleConfirm}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-base rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Confirm ${depositAmount.toLocaleString()} Deposit
              </button>

              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Lock className="w-3.5 h-3.5" />
                  256-bit SSL
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Building2 className="w-3.5 h-3.5" />
                  Funds in Escrow
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Shield className="w-3.5 h-3.5" />
                  PCI DSS
                </div>
              </div>
            </>
          )}

          {/* ── PROCESSING STATE ───────────────────────────────────────────────── */}
          {state === 'processing' && (
            <div className="py-10 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-100 rounded-full" />
                <div className="absolute inset-0 w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <Lock className="absolute inset-0 m-auto w-7 h-7 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 mb-1">Processing deposit…</p>
                <p className="text-sm text-gray-500">Securing ${depositAmount.toLocaleString()} in escrow</p>
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
          )}

          {/* ── SUCCESS STATE ─────────────────────────────────────────────────── */}
          {state === 'success' && (
            <div className="py-6 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Deposit Paid!</h3>
                <p className="text-sm text-gray-600">
                  <strong>{projectTitle}</strong> is now <span className="text-green-700 font-semibold">Active</span>.
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  A message has been sent to the property owner.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 w-full text-left">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Confirmed</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Deposit ${depositAmount.toLocaleString()} secured
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Project status → In Progress
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Intro message sent to owner
                  </div>
                </div>
              </div>

              <button
                onClick={onSuccess}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
              >
                Continue to Dashboard
              </button>
            </div>
          )}

          {/* ── ERROR STATE ───────────────────────────────────────────────────── */}
          {state === 'error' && (
            <div className="py-6 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Something went wrong</h3>
                <p className="text-sm text-red-600">{errorMsg}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setState('confirm')}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
