import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import logo from '../../assets/logo.svg';

type Phase = 'checking' | 'ready' | 'invalid' | 'saving' | 'done' | 'error';

/**
 * Password reset landing page.
 *
 * Supabase turns the `?...type=recovery` link from the reset email into a
 * temporary recovery session (detectSessionInUrl) and fires PASSWORD_RECOVERY.
 * We let the user set a new password via supabase.auth.updateUser, then sign
 * them out and send them to /login so they sign in with the new password.
 */
export function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let settled = false;
    const finish = (ok: boolean) => { if (!settled) { settled = true; setPhase(ok ? 'ready' : 'invalid'); } };

    // The recovery event fires once Supabase parses the URL token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) finish(true);
    });

    // Also check immediately, in case the session is already established.
    supabase.auth.getSession().then(({ data }) => { if (data.session) finish(true); });

    // If nothing arrives, the link is missing/expired.
    const timer = setTimeout(() => finish(false), 4000);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setPhase('saving');
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setError(updErr.message || 'Could not update password. The link may have expired.');
      setPhase('error');
      return;
    }
    // Force a fresh login with the new password.
    await supabase.auth.signOut().catch(() => {});
    setPhase('done');
    setTimeout(() => navigate('/login', { replace: true }), 2200);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={logo} alt="M.G.BIT" className="h-9 w-auto mx-auto" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
          {phase === 'checking' && (
            <div className="text-center py-8">
              <Loader2 className="w-7 h-7 text-[#1e3a5f] animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Verifying your reset link…</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Link expired or invalid</h2>
              <p className="text-gray-500 text-sm mb-5">This reset link is no longer valid. Request a new one to continue.</p>
              <button onClick={() => navigate('/forgot-password')}
                className="w-full py-3 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-semibold text-sm rounded-xl transition-colors">
                Request a new link
              </button>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Password updated</h2>
              <p className="text-gray-500 text-sm">Redirecting you to sign in…</p>
            </div>
          )}

          {(phase === 'ready' || phase === 'saving' || phase === 'error') && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Set a new password</h2>
              <p className="text-gray-500 text-sm mb-5">Choose a new password for your M.G.BIT account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <PasswordField label="New password" value={password} onChange={setPassword} show={show} setShow={setShow} />
                <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} show={show} setShow={setShow} />

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={phase === 'saving'}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60">
                  {phase === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin" />Updating…</> : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, setShow }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; setShow: (b: boolean) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]/50"
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
