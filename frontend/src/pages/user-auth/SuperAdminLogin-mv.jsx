import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Loader2, Eye, EyeOff, ShieldAlert, Activity, Sun, Moon } from "lucide-react";
import LoadingScreen from "../../components/LoadingScreen";

const SuperAdminLoginMobile = () => {
    const { superAdminLogin } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        // Sync theme with HTML element
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await superAdminLogin(formData.email, formData.password);
            toast.success("Super Admin authenticated. System Access Granted.");
            navigate("/dashboard");
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Invalid credentials";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-[#010404] font-poppins selection:bg-amber-500/30 overflow-x-hidden transition-colors duration-500">
            <AnimatePresence>
                {loading && (
                    <LoadingScreen message="Verifying security clearance..." isSuperAdmin={true} />
                )}
            </AnimatePresence>

            {/* Background Visuals */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[40%] bg-amber-600/5 dark:bg-amber-600/10 blur-[100px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.03] pointer-events-none" />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen px-6 py-8">
                {/* Header Section */}
                <header className="mb-8 pt-4">
                    <div className="flex items-center justify-between mb-8">
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-4"
                        >
                            <div className="w-12 h-12 bg-white dark:bg-[#0d1117] rounded-xl flex items-center justify-center border border-slate-100 dark:border-[#30363d] shadow-lg">
                                <ShieldAlert className="w-7 h-7 text-amber-500 dark:text-amber-400" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-none">
                                    MANO <span className="text-amber-600 dark:text-amber-400 not-italic font-medium opacity-80 text-sm font-poppins">Internal</span>
                                </h1>
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-1">Super Admin Portal Access</span>
                            </div>
                        </motion.div>

                        {/* Theme Toggle */}
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => setIsDark(!isDark)}
                            className="w-12 h-12 bg-white dark:bg-[#0d1117] rounded-xl flex items-center justify-center shadow-lg text-slate-600 dark:text-slate-400 active:scale-90 transition-all border border-slate-100 dark:border-white/5"
                        >
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </motion.button>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-3"
                    >
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">
                            Global <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-indigo-500 dark:from-amber-400 dark:to-indigo-400 font-black">Control.</span>
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xs">
                            Internal management portal for MANO Attendance. Manage organizations, monitor security alerts, and oversee platform-wide activity logs.
                        </p>
                    </motion.div>
                </header>

                {/* Glassmorphic Activity Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full p-1 bg-gradient-to-br from-amber-500/10 to-transparent dark:from-white/10 dark:to-transparent rounded-[1.8rem] shadow-xl backdrop-blur-xl border border-slate-200 dark:border-white/10 mb-8"
                >
                    <div className="bg-white/80 dark:bg-[#0d1117]/80 rounded-[1.7rem] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                                    <Activity size={14} />
                                </div>
                                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">System Health</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-ping" />
                                <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Secure Link</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50/50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                <span className="block text-[8px] text-slate-500 uppercase tracking-widest mb-1 font-black underline decoration-amber-500/30 underline-offset-4">Internal Monitoring</span>
                                <span className="text-xs font-mono text-slate-900 dark:text-white font-black">ACTIVE</span>
                            </div>
                            <div className="p-3 bg-slate-50/50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                <span className="block text-[8px] text-slate-500 uppercase tracking-widest mb-1 font-black underline decoration-amber-500/30 underline-offset-4">Security Level</span>
                                <span className="text-xs font-mono text-slate-900 dark:text-white font-black">MAX Tier</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Login Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex-1"
                >
                    {/* Form Header */}
                    <div className="space-y-2 mb-6">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Internal Auth</h3>
                        <p className="text-xs text-slate-500 font-normal tracking-tight leading-relaxed">
                            Enter secure credentials to access the organizational management portal.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email Field */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1">
                                Authorized Email
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-amber-600 dark:group-focus-within:text-amber-400 transition-colors" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                    placeholder="admin@mano.co.in"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1">
                                Secure Password
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-amber-600 dark:group-focus-within:text-amber-400 transition-colors" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl py-4 pl-14 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full bg-amber-600 hover:bg-amber-700 text-white py-5 rounded-[1.25rem] text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl shadow-amber-600/20 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <>
                                    Secure Access
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>

                {/* Footer */}
                <footer className="mt-auto pt-10 text-center">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] whitespace-nowrap">
                        Authorized Personnel Only <span className="mx-2">•</span> <Link to="/login" className="text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors opacity-80">User Login</Link>
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default SuperAdminLoginMobile;
