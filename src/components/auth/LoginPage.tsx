import { useState } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import logo from '../../assets/logo.svg';

export function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [keepLoggedIn, setKeepLoggedIn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    async function handleLogIn(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // Successful login will be handled by the AuthContext listener which triggers re-render in App.tsx
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to log in');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex bg-white font-sans">
            {/* Back to Landing */}
            <Link
                to="/"
                className="absolute top-4 sm:top-8 left-4 sm:left-8 z-10 p-2 text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2 font-medium text-sm sm:text-base"
            >
                <ArrowLeft className="w-5 h-5" />
                Back to Home
            </Link>

            {/* Form Section */}
            <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 pt-16 pb-10 overflow-y-auto">
                <div className="w-full max-w-[400px] mx-auto">
                    <div className="mb-10">
                        <img src={logo} alt="M.G.BIT" className="h-9 w-auto" />
                    </div>

                    <div className="mb-8">
                        <h2 className="text-[36px] font-extrabold text-brand-navy leading-tight mb-2 tracking-tight">Log In</h2>
                        <p className="text-brand-navy/60 text-lg">Log in to get started in just a few clicks</p>
                    </div>

                    <form onSubmit={handleLogIn} className="space-y-6">
                        <div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                                className="w-full h-14 px-6 border border-slate-200 rounded-full focus:outline-none focus:ring-4 focus:ring-brand-orange/20 focus:border-brand-orange transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                                className="w-full h-14 px-6 border border-slate-200 rounded-full focus:outline-none focus:ring-4 focus:ring-brand-orange/20 focus:border-brand-orange transition-all placeholder:text-slate-400"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className="flex items-center justify-between px-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={keepLoggedIn}
                                    onChange={(e) => setKeepLoggedIn(e.target.checked)}
                                    className="w-5 h-5 text-brand-orange focus:ring-brand-orange border-slate-300 rounded-lg cursor-pointer transition-all"
                                />
                                <span className="text-sm text-brand-navy/60 font-medium group-hover:text-brand-navy transition-colors">
                                    Keep me logged in
                                </span>
                            </label>
                            <Link
                                to="/forgot-password"
                                className="text-sm text-brand-navy/60 hover:text-brand-navy font-semibold hover:underline transition-all"
                            >
                                Forgot Password?
                            </Link>
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
                            {loading ? 'Logging in...' : 'Log In'}
                        </button>

                        <p className="text-center text-brand-navy/60 font-medium">
                            Need an account?{' '}
                            <Link
                                to="/signup"
                                className="text-brand-orange hover:underline font-bold"
                            >
                                Create one
                            </Link>
                        </p>
                    </form>
                </div>
            </div>

            {/* Image Section */}
            <div
                className="hidden lg:block w-1/2 bg-cover bg-center"
                style={{
                    backgroundImage: 'url(https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
                }}
            >
                <div className="w-full h-full bg-brand-navy/30 backdrop-blur-[2px] p-24 flex flex-col justify-end text-white">
                    <div className="max-w-md">
                        <h3 className="text-5xl font-extrabold leading-tight mb-6">Expert Renovations, <br />Hassle-Free.</h3>
                        <p className="text-xl text-white/90 leading-relaxed font-medium">
                            Join thousands of homeowners and contractors who trust M.G.BIT for their renovation projects.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
