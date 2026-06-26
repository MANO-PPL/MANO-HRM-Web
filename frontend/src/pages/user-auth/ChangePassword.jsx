import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, KeyRound, LogOut, Check, X, Sun, Moon, Activity } from "lucide-react";
import api from "../../services/api";
import LoadingScreen from "../../components/LoadingScreen";

const ChangePassword = () => {
    const { fetchUser, logout } = useAuth();
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) return savedTheme === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener("resize", handleResize);

        // Sync theme with HTML element & save preference
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }

        return () => window.removeEventListener("resize", handleResize);
    }, [isDark]);

    // Criteria checks
    const hasMinLength = password.length >= 6;
    const passwordsMatch = password && password === confirmPassword;
    const isFormValid = hasMinLength && passwordsMatch;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isFormValid) {
            toast.error("Please satisfy all password criteria.");
            return;
        }

        setLoading(true);
        try {
            await api.post("/auth/change-password", { newPassword: password });
            toast.success("Security configuration updated. Password changed successfully.");
            
            // Reload the user context to clear the force_password_change flag
            await fetchUser();
            
            navigate("/dashboard");
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Failed to update password.";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate("/login");
        } catch (err) {
            toast.error("Logout failed.");
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-[#010404] font-poppins selection:bg-indigo-500/30 overflow-hidden transition-colors duration-500">
            <AnimatePresence>
                {loading && (
                    <LoadingScreen message="Securing your new credentials..." />
                )}
            </AnimatePresence>

            {/* Background Visuals (Global - Not Scaled) */}
            <div className="fixed inset-0 z-0 opacity-100 dark:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/5 dark:bg-violet-600/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.03] pointer-events-none" />
            </div>

            {/* Theme Toggle Button - Fixed at viewport edge */}
            <button
                onClick={() => setIsDark(!isDark)}
                className="fixed top-8 right-8 z-[100] p-3 rounded-2xl bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-600 dark:text-slate-400 hover:scale-110 active:scale-95 transition-all shadow-xl shadow-black/5"
            >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* --- CORE CONTENT CONTAINER --- */}
            <div className="flex min-h-screen relative z-10">
                {/* --- LEFT SECTION: VISUALS (Desktop only) --- */}
                {!isMobile && (
                    <div className="relative w-[58%] flex flex-col justify-center p-[7rem] overflow-hidden border-r border-slate-200 dark:border-white/5 transition-colors duration-500 gap-24">
                        {/* Logo & Branding */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative z-10 flex items-center gap-6"
                        >
                            <div className="w-16 h-16 bg-white dark:bg-[#0d1117] rounded-2xl flex items-center justify-center border border-slate-100 dark:border-[#30363d] shadow-2xl">
                                <img src="/mano-logo.svg" alt="logo" className="w-10 h-10" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-none">
                                    MANO <span className="text-indigo-600 dark:text-indigo-400 not-italic font-medium opacity-80">Attendance</span>
                                </h1>
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mt-1">Enterprise Grade Security</span>
                            </div>
                        </motion.div>

                        {/* Industrial Stats / Mockup Centerpiece */}
                        <div className="relative z-10 flex flex-col items-start gap-10">
                            <motion.div
                                initial={{ opacity: 0, x: -50 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="space-y-5"
                            >
                                <h2 className="text-6xl font-black text-slate-900 dark:text-white leading-tight tracking-[calc(-0.02em)] uppercase">
                                    Precision <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400">Intelligence.</span>
                                </h2>
                                <p className="max-w-md text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed">
                                    Streamline your workforce operations with our industrial-grade attendance monitoring system. Secure, automated, and hyper-accurate.
                                </p>
                            </motion.div>

                            {/* Glassmorphic Activity Card - High Density */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="w-full max-w-2xl p-1 bg-gradient-to-br from-indigo-500/10 to-transparent dark:from-white/10 dark:to-transparent rounded-[2.4rem] shadow-2xl backdrop-blur-xl border border-slate-200 dark:border-white/10"
                            >
                                <div className="bg-white/80 dark:bg-[#0d1117]/80 rounded-[2.3rem] p-8 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                                <Activity size={18} />
                                            </div>
                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Network Status</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-ping" />
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Operational</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-black underline decoration-indigo-500/30 underline-offset-4">Daily Sync</span>
                                            <span className="text-lg font-mono text-slate-900 dark:text-white font-black">99.98%</span>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-black underline decoration-indigo-500/30 underline-offset-4">Uptime</span>
                                            <span className="text-lg font-mono text-slate-900 dark:text-white font-black">365 Days</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}

                {/* --- RIGHT SECTION: CHANGE PASSWORD FORM --- */}
                <div className={`relative flex flex-col justify-center ${isMobile ? 'w-full p-8' : 'w-[42%] p-[6rem]'} z-10 bg-white dark:bg-[#010101] transition-colors duration-500 shadow-[-20px_0_60px_rgba(0,0,0,0.05)] dark:shadow-none`}>
                    <div className="w-full max-w-md mx-auto space-y-10">
                        {/* Header */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className={isMobile ? 'text-center' : ''}
                        >
                            <h3 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight uppercase mb-3">Update Password</h3>
                            <p className="text-slate-500 font-normal tracking-tight">For security, you must customize your password on first login.</p>
                        </motion.div>

                        {/* Form Group */}
                        <motion.form
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            onSubmit={handleSubmit}
                            className="space-y-8"
                        >
                            {/* Password Field */}
                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1">
                                    New Password
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl py-4 pl-14 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm text-sm"
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

                            {/* Confirm Password Field */}
                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1">
                                    Confirm Password
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl py-4 pl-14 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm text-sm"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Criteria validation box */}
                            <div className="bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${hasMinLength ? 'bg-emerald-500 text-white' : 'border border-slate-200 dark:border-[#30363d]'}`}>
                                        {hasMinLength && <Check size={14} strokeWidth={3} />}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider select-none ${hasMinLength ? 'text-slate-800 dark:text-slate-300 font-extrabold' : 'text-slate-400 dark:text-slate-500'}`}>
                                        At least 6 characters
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${passwordsMatch ? 'bg-emerald-500 text-white' : 'border border-slate-200 dark:border-[#30363d]'}`}>
                                        {passwordsMatch && <Check size={14} strokeWidth={3} />}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider select-none ${passwordsMatch ? 'text-slate-800 dark:text-slate-300 font-extrabold' : 'text-slate-400 dark:text-slate-500'}`}>
                                        Passwords match
                                    </span>
                                </div>
                            </div>

                            {/* Submit Action */}
                            <div className="space-y-4">
                                <button
                                    type="submit"
                                    disabled={!isFormValid || loading}
                                    className="group relative w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-[#161b22] text-white py-5 rounded-[1.25rem] text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        "Save & Continue"
                                    )}
                                </button>
                            </div>
                        </motion.form>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-center pt-4"
                        >
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] whitespace-nowrap">
                                Cancel and <button onClick={handleLogout} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-bold transition-colors opacity-80 uppercase tracking-widest ml-1 bg-transparent border-0 cursor-pointer">Sign Out</button>
                            </p>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;
