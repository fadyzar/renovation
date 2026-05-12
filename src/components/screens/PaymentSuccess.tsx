import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { whatsapp } from '../../lib/whatsapp';

type State = 'activating' | 'success' | 'error';

const PENDING_KEY = 'pending_stripe_payment';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('activating');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    activate();
  }, []);

  async function activate() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) throw new Error('Payment data not found. If you already paid, your project will be activated shortly.');

      const {
        projectId, bidId, ownerId, contractorId,
        contractorName, contractorPhone,
        totalBidAmount, firstAmount, milestones,
        projectTitle,
      } = JSON.parse(raw);

      const sessionId = searchParams.get('session_id') ?? `stripe_${Date.now()}`;

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'activate_project_after_payment',
        {
          p_project_id:       projectId,
          p_bid_id:           bidId,
          p_owner_id:         ownerId,
          p_contractor_id:    contractorId,
          p_total_amount:     totalBidAmount,
          p_first_amount:     firstAmount,
          p_mock_tx_id:       sessionId,
          p_contractor_name:  contractorName,
          p_contractor_phone: contractorPhone,
          p_milestones:       milestones,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      localStorage.removeItem(PENDING_KEY);
      setConversationId((rpcData as any)?.conversation_id);
      setState('success');

      // Notify contractor via WhatsApp
      const { data: contractorProfile } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', contractorId)
        .maybeSingle();

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', ownerId)
        .maybeSingle();

      if (contractorProfile?.phone) {
        whatsapp.projectActivated(
          contractorProfile.phone,
          projectTitle,
          ownerProfile?.full_name ?? 'the owner'
        );
      }

      // Notify all admins
      const { data: admins } = await supabase.from('profiles').select('phone').eq('role', 'admin');
      const platformFee = Math.round(totalBidAmount * 0.10);
      (admins ?? []).forEach(a => {
        if (a.phone) whatsapp.adminProjectActivated(a.phone, projectTitle, totalBidAmount, platformFee);
      });
    } catch (err: any) {
      console.error('Activation error:', err);
      setErrMsg(err?.message ?? 'Something went wrong activating your project.');
      setState('error');
    }
  }

  if (state === 'activating') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="w-20 h-20 border-4 border-green-100 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            <CheckCircle className="absolute inset-0 m-auto w-7 h-7 text-green-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900 mb-1">Payment confirmed!</p>
          <p className="text-sm text-gray-500">Activating your project…</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Activated!</h1>
          <p className="text-sm text-gray-600 mb-6">
            Payment confirmed by Stripe. Your contractor has been notified and will reach out shortly.
          </p>

          <div className="space-y-3">
            {conversationId && (
              <button
                onClick={() => navigate('/messages')}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Open Project Chat
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Activation Issue</h1>
        <p className="text-sm text-red-600 mb-6">{errMsg}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
