import { useState } from 'react';
import { X, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ForgotPasswordModalProps {
  onClose: () => void;
  onBack: () => void;
}

export function ForgotPasswordModal({ onClose, onBack }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-5xl h-[90vh] flex bg-white rounded-2xl shadow-xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-6 left-6 z-10 p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="w-full md:w-1/2 p-12 overflow-y-auto flex items-center">
          <div className="w-full max-w-md mx-auto">
            {!success ? (
              <>
                <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6 mx-auto">
                  <Key className="w-8 h-8 text-blue-600" />
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot password?</h2>
                  <p className="text-gray-600">No worries, we'll send you reset instructions.</p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Gilad@gmail.com"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending...' : 'Reset Password'}
                  </button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onBack}
                    className="w-full text-center text-sm text-gray-700"
                  >
                    Back To <span className="text-blue-600 hover:underline font-medium">Log in</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6 mx-auto">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Check Your Email</h2>
                  <p className="text-gray-600">
                    Your account is not verified yet. Please check your email for the verification link.
                  </p>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => window.open('mailto:', '_blank')}
                    className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Open Email App
                  </button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="w-full text-center text-sm text-gray-700"
                  >
                    Didn't receive the email? <span className="text-blue-600 hover:underline font-medium">Click to resend</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div
          className="hidden md:block w-1/2 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
          }}
        ></div>
      </div>
    </div>
  );
}
