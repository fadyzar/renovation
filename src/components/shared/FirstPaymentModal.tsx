import { useState } from 'react';
import {
  X, Lock, Shield, Building2, CheckCircle, AlertCircle,
  CreditCard, DollarSign, MessageCircle, Phone, MapPin, Tag,
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

const PLATFORM_FEE_PCT = 10;

const PENDING_KEY = 'pending_stripe_payment';

export function FirstPaymentModal({
  projectId, bidId, ownerId, contractorId,
  contractorName, contractorPhone,
  projectTitle, projectAddress,
  totalBidAmount, milestones,
  onSuccess, onClose,
}: Props) {
  const firstMilestone = milestones[0];
  const firstAmount    = firstMilestone?.price ?? Math.round(totalBidAmount * 0.25);
  const platformFee    = Math.round(totalBidAmount * PLATFORM_FEE_PCT / 100);
  const totalCharge    = firstAmount + platformFee;

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  async function handlePay() {
    setLoading(true);
    setErrMsg('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const origin = window.location.origin;
      const successUrl = `${origin}/payment-success?projectId=${projectId}`;
      const cancelUrl = `${origin}/accept-offer/${projectId}/${bidId}`;

      // Save full payload locally so the success page can activate the project
      localStorage.setItem(PENDING_KEY, JSON.stringify({
        projectId, bidId, ownerId, contractorId,
        contractorName, contractorPhone,
        projectTitle, projectAddress,
        totalBidAmount, firstAmount, milestones,
      }));

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: totalCharge,
            projectId, bidId, ownerId, contractorId, projectTitle,
            successUrl, cancelUrl,
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
      console.error('Checkout error:', err);
      setErrMsg(err?.message ?? 'Unexpected error. Please try again.');
      setLoading(false);
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
              <p className="text-xs text-green-100">Secure checkout via Stripe</p>
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        <div className="p-6">

          {/* Project info */}
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

          {/* Amount breakdown */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 space-y-2.5">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>First milestone</span>
              <span className="font-semibold text-gray-900">${firstAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                <span>MGBiT match fee</span>
                <span className="ml-1.5 text-xs bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded-full">
                  {PLATFORM_FEE_PCT}% of ${totalBidAmount.toLocaleString()}
                </span>
              </div>
              <span className="font-semibold text-orange-700">${platformFee.toLocaleString()}</span>
            </div>
            <div className="border-t border-green-200 pt-2.5 flex items-center justify-between">
              <span className="text-sm font-bold text-green-800">Total you pay</span>
              <span className="text-2xl font-bold text-green-700">${totalCharge.toLocaleString()}</span>
            </div>
          </div>

          {/* Coupon hint */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
            <Tag className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 font-medium">You can apply a coupon or promo code on the next page</p>
          </div>

          {/* What unlocks */}
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

          {errMsg && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{errMsg}</p>
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Redirecting to Stripe…
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Pay ${totalCharge.toLocaleString()} via Stripe →
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-6 mt-4">
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><Lock className="w-3.5 h-3.5" />SSL 256-bit</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><Building2 className="w-3.5 h-3.5" />Escrow</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><Shield className="w-3.5 h-3.5" />PCI DSS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
