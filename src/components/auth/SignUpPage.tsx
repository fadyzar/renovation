import { useState } from 'react';
import { Home, HardHat, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';

export function SignUpPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'property_owner' | 'contractor'>('property_owner');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    async function handleSignUp(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role,
                    },
                },
            });

            if (authError) throw authError;

            if (authData.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: authData.user.id,
                        email,
                        full_name: fullName,
                        role,
                    });

                if (profileError) throw profileError;

                // Redirect to dashboard after signup
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="h-screen flex bg-white font-sans overflow-hidden">
            {/* Back to Landing */}
            <Link
                to="/"
                className="absolute top-8 left-8 z-10 p-2 text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2 font-medium"
            >
                <ArrowLeft className="w-5 h-5" />
                Back to Home
            </Link>

            {/* Form Section */}
            <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-24 py-8 overflow-y-auto">
                <div className="w-full max-w-[400px] mx-auto">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 bg-[#FF5C5C] rounded-full"></div>
                            <div className="w-2.5 h-2.5 bg-[#FFBD2E] rounded-full"></div>
                            <div className="w-2.5 h-2.5 bg-[#27C93F] rounded-full"></div>
                            <div className="w-2.5 h-2.5 bg-[#1336F6] rounded-full"></div>
                        </div>
                        <span className="text-2xl font-black text-brand-navy tracking-tight">M.G.BIT</span>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-[36px] font-extrabold text-brand-navy leading-tight mb-1 tracking-tight">Create Account</h2>
                        <p className="text-brand-navy/60 text-base">Sign up to get started in just a few clicks</p>
                    </div>

                    <form onSubmit={handleSignUp} className="space-y-3">
                        <div>
                            <label className="block text-sm font-bold text-brand-navy mb-2 ml-1">
                                Your Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Gilad Ben Arush"
                                required
                                className="w-full h-14 px-6 border border-slate-200 rounded-full focus:outline-none focus:ring-4 focus:ring-brand-orange/20 focus:border-brand-orange transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-brand-navy mb-2 ml-1">
                                I am a
                            </label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRole('property_owner')}
                                    className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-full border-2 transition-all ${role === 'property_owner'
                                        ? 'border-brand-orange bg-brand-orange/5 text-brand-orange font-bold'
                                        : 'border-slate-100 text-slate-400 font-medium hover:border-slate-200'
                                        }`}
                                >
                                    <Home className="w-5 h-5" />
                                    <span>Homeowner</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('contractor')}
                                    className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-full border-2 transition-all ${role === 'contractor'
                                        ? 'border-brand-orange bg-brand-orange/5 text-brand-orange font-bold'
                                        : 'border-slate-100 text-slate-400 font-medium hover:border-slate-200'
                                        }`}
                                >
                                    <HardHat className="w-5 h-5" />
                                    <span>Contractor</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-brand-navy mb-2 ml-1">
                                Email
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

                        <div>
                            <label className="block text-sm font-bold text-brand-navy mb-2 ml-1">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full h-14 px-6 border border-slate-200 rounded-full focus:outline-none focus:ring-4 focus:ring-brand-orange/20 focus:border-brand-orange transition-all placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="pb-2">
                            <label className="block text-sm font-bold text-brand-navy mb-2 ml-1">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full h-14 px-6 border border-slate-200 rounded-full focus:outline-none focus:ring-4 focus:ring-brand-orange/20 focus:border-brand-orange transition-all placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
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
                            {loading ? 'Creating account...' : 'Sign up'}
                        </button>

                        <p className="text-center text-brand-navy/60 font-medium pt-2">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                className="text-brand-orange hover:underline font-bold"
                            >
                                Sign in
                            </Link>
                        </p>
                    </form>
                </div>
            </div>

            {/* Image Section */}
            <div
                className="hidden lg:block w-1/2 bg-cover bg-center"
                style={{
                    backgroundImage: 'url(https://images.pexels.com/photos/416405/pexels-photo-416405.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
                }}
            >
                <div className="w-full h-full bg-brand-navy/30 backdrop-blur-[2px] p-24 flex flex-col justify-end text-white">
                    <div className="max-w-md">
                        <h3 className="text-5xl font-extrabold leading-tight mb-6">Start Your <br />Dream Project.</h3>
                        <p className="text-xl text-white/90 leading-relaxed font-medium">
                            Join M.G.BIT today and get connected with verified professionals for your next renovation.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
