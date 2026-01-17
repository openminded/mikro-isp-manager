import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Lock, User, Loader2 } from 'lucide-react';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await axios.post('/api/auth/login', { username, password });
            login(res.data.token, res.data.user);
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-3xl" />
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-3xl" />
                <div className="absolute -bottom-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-sky-400/20 blur-3xl" />
            </div>

            <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 transition-all hover:shadow-blue-500/10">
                <div className="p-8 bg-gradient-to-br from-blue-600 to-blue-700 text-white text-center relative overflow-hidden">
                    {/* Header Decoration */}
                    <div className="absolute top-0 left-0 w-full h-full bg-white/5 mix-blend-overlay"></div>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

                    <div className="flex justify-center mb-6 relative z-10">
                        <div className="bg-white p-3 rounded-2xl shadow-lg shadow-blue-900/20">
                            <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold mb-2 relative z-10">Welcome Back!</h1>
                    <p className="text-blue-100 relative z-10">Sign in to access your dashboard</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div className="group">
                            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
                    </button>
                </form>
            </div>

            <div className="absolute bottom-4 text-slate-400 text-xs font-medium">
                &copy; {new Date().getFullYear()} TelajuApp ISP Management
            </div>
        </div>
    );
}
