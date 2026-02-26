import { useState } from 'react';
import { Key, ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export function ForgotPasswordPage() {
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
        <div className="min-h-screen flex bg-white font-sans">
            {/* Back to Login */}
            <Link
                to="/login"
                className="absolute top-8 left-8 z-10 p-2 text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2 font-medium"
            >
                <ArrowLeft className="w-5 h-5" />
                Back to Login
            </Link>

            {/* Form Section */}
            <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 py-12">
                <div className="w-full max-w-md mx-auto">
                    {!success ? (
                        <>
                            <div className="flex items-center justify-center w-20 h-20 bg-brand-orange/10 rounded-[30px] mb-10">
                                <Key className="w-10 h-10 text-brand-orange" />
                            </div>

                            <div className="mb-10">
                                <h2 className="text-[40px] font-extrabold text-brand-navy leading-tight mb-4 tracking-tight">Forgot password?</h2>
                                <p className="text-brand-navy/60 text-lg">No worries, we'll send you reset instructions.</p>
                            </div>

                            <form onSubmit={handleResetPassword} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-brand-navy mb-2 ml-1">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Gilad@gmail.com"
                                        required
                                        className="w-full h-14 px-6 border border-slate-200 rounded-full focus:outline-none focus:ring-4 focus:ring-brand-orange/20 focus:border-brand-orange transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                                        <p className="text-sm text-red-600 font-medium">{error}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-14 bg-brand-orange text-white font-bold rounded-full hover:bg-orange-600 transition-all shadow-[0_8px_30px_rgba(254,95,32,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Sending...' : 'Reset Password'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center">
                            <div className="flex items-center justify-center w-20 h-20 bg-brand-blue/10 rounded-[30px] mb-10 mx-auto">
                                <Mail className="w-10 h-10 text-brand-blue" />
                            </div>

                            <div className="mb-10">
                                <h2 className="text-[40px] font-extrabold text-brand-navy leading-tight mb-4 tracking-tight">Check Your Email</h2>
                                <p className="text-brand-navy/60 text-lg">
                                    We've sent reset instructions to your email address. Please check your inbox.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={() => window.open('mailto:', '_blank')}
                                    className="w-full h-14 bg-brand-orange text-white font-bold rounded-full hover:bg-orange-600 transition-all shadow-lg active:scale-[0.98]"
                                >
                                    Open Email App
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSuccess(false)}
                                    className="w-full h-14 text-brand-navy font-bold hover:bg-slate-50 rounded-full transition-all"
                                >
                                    Didn't receive the email? <span className="text-brand-orange">Click to resend</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Section */}
            <div
                className="hidden lg:block w-1/2 bg-cover bg-center"
                style={{
                    backgroundImage: 'url(https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
                }}
            >
                <div className="w-full h-full bg-brand-navy/30 backdrop-blur-[2px] p-24 flex flex-col justify-end text-white">
                    <div className="max-w-md">
                        <h3 className="text-5xl font-extrabold leading-tight mb-6">Security & Trust.</h3>
                        <p className="text-xl text-white/90 leading-relaxed font-medium">
                            We ensure your account remains secure with verified access and encryption.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
