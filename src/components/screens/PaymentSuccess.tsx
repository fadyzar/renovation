import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type State = 'activating' | 'success' | 'error';

const PENDING_KEY = 'pending_stripe_payment';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('activating');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [errMsg, setErrMsg] = useState('');
  const [kind, setKind] = useState<'activation' | 'milestone'>('activation');
  const [paidProjectId, setPaidProjectId] = useState<string | undefined>();

  useEffect(() => {
    activate();
  }, []);

  async function activate() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      const parsed = raw ? JSON.parse(raw) : {};

      // Stripe appends the real session id to the success URL. Nothing on this
      // page decides that money moved: the server asks Stripe, checks the
      // amount against the accepted quote (or the stage) and applies the
      // payment exactly once. The database refuses the same writes from here.
      const sessionId = searchParams.get('session_id');
      if (!sessionId || sessionId.includes('CHECKOUT_SESSION_ID')) {
        throw new Error('Payment reference not found. If you already paid, your project will be activated shortly.');
      }

      const milestoneId = searchParams.get('milestoneId') ?? (parsed.kind === 'milestone' ? parsed.milestoneId : undefined);
      const isStage = !!milestoneId;
      setKind(isStage ? 'milestone' : 'activation');
      setPaidProjectId(searchParams.get('projectId') ?? parsed.projectId);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please sign in again to finish activating your payment.');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-checkout-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            sessionId,
            milestoneId,
            contractorName: parsed.contractorName ?? '',
            contractorPhone: parsed.contractorPhone ?? '',
          }),
        }
      );
      const result = await res.json().catch(() => ({}));

      if (!res.ok || result.error) {
        throw new Error(result.error ?? `Server error ${res.status}`);
      }
      if (!result.paid) {
        throw new Error('This payment has not been completed. Nothing was charged.');
      }

      localStorage.removeItem(PENDING_KEY);
      setConversationId(result.conversationId);
      setState('success');

      // Contractor and admin notifications are raised server-side by the
      // project / milestone triggers, exactly as before.
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {kind === 'milestone' ? 'Payment Confirmed!' : 'Project Activated!'}
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            {kind === 'milestone'
              ? 'Payment confirmed by Stripe and released for this milestone. Your contractor has been notified.'
              : 'Payment confirmed by Stripe. Your contractor has been notified and will reach out shortly.'}
          </p>

          <div className="space-y-3">
            {kind === 'milestone' && paidProjectId && (
              <button
                onClick={() => navigate(`/project/${paidProjectId}/payments`)}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                Back to Payments
              </button>
            )}
            {kind === 'activation' && conversationId && (
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
