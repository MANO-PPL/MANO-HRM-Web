import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { Mail, Lock, Loader2, Eye, EyeOff, ShieldAlert, Sun, Moon, ArrowLeft } from "lucide-react";

const SuperAdminLoginMobile = () => {
    const { superAdminLogin } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
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
        <div className="relative min-h-screen bg-[#F8FAFC] dark:bg-[#010404] font-inter text-slate-900 dark:text-white transition-colors duration-300 flex flex-col justify-center items-center overflow-x-hidden px-6 py-8">
            {/* Background glowing spheres */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div
                    className="absolute -top-[100px] -left-[100px] w-[320px] h-[320px] rounded-full blur-[90px]"
                    style={{
                        background: isDark
                            ? 'radial-gradient(circle, rgba(217, 119, 6, 0.14) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(217, 119, 6, 0.08) 0%, transparent 70%)'
                    }}
                />
                <div
                    className="absolute -bottom-[100px] -right-[100px] w-[300px] h-[300px] rounded-full blur-[90px]"
                    style={{
                        background: isDark
                            ? 'radial-gradient(circle, rgba(79, 70, 229, 0.12) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(79, 70, 229, 0.06) 0%, transparent 70%)'
                    }}
                />
            </div>

            {/* Top Right Theme Toggle */}
            <div className="fixed top-5 right-5 z-20">
                <button
                    type="button"
                    onClick={() => setIsDark(!isDark)}
                    className="w-10 h-10 flex items-center justify-center rounded-[16px] bg-white dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] shadow-sm text-[#475569] dark:text-[#94A3B8] hover:text-amber-500 active:scale-95 transition-all"
                    title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isDark ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} />}
                </button>
            </div>

            {/* Centered Form */}
            <div className="relative z-10 w-full max-w-[440px] my-auto">
                <form onSubmit={handleSubmit} className="flex flex-col">
                    {/* Brand Header */}
                    <div className="flex items-center justify-center gap-3.5 mb-8">
                        <div className="w-11 h-11 bg-white dark:bg-[#0D1117] rounded-[14px] border border-[#E2E8F0] dark:border-[#30363D] shadow-md flex items-center justify-center p-2 text-amber-500 shrink-0">
                            <ShieldAlert size={26} />
                        </div>
                        <div className="flex flex-col justify-center">
                            <div className="text-[20px] font-black italic tracking-tight leading-none text-slate-900 dark:text-white">
                                MANO <span className="text-amber-500 not-italic font-bold">INTERNAL</span>
                            </div>
                            <span className="text-[8.5px] font-extrabold uppercase text-[#94A3B8] dark:text-[#64748B] tracking-[2.2px] mt-1">
                                SUPER ADMIN CLEARANCE PORTAL
                            </span>
                        </div>
                    </div>

                    {/* Email Field */}
                    <div className="mb-4">
                        <label className="block text-[13px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                            Authorized Email
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#94A3B8]">
                                <Mail size={19} />
                            </div>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                placeholder="superadmin@mano.co.in"
                                className="w-full h-[52px] pl-11 pr-4 rounded-[16px] bg-[#F8FAFC] dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] text-[14px] font-medium text-[#0F172A] dark:text-white placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="mb-6">
                        <label className="block text-[13px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                            Security Key / Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#94A3B8]">
                                <Lock size={19} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                placeholder="••••••••"
                                className="w-full h-[52px] pl-11 pr-12 rounded-[16px] bg-[#F8FAFC] dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] text-[14px] font-medium text-[#0F172A] dark:text-white placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#94A3B8] hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                            </button>
                        </div>
                    </div>

                    {/* Secure Access Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-[52px] rounded-[16px] bg-amber-600 hover:bg-amber-700 active:scale-[0.99] disabled:opacity-50 text-white font-extrabold text-[14px] tracking-[0.8px] uppercase flex items-center justify-center shadow-md shadow-amber-600/30 transition-all cursor-pointer"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin text-white" size={22} />
                        ) : (
                            "AUTHENTICATE CLEARANCE"
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-500 transition-colors"
                    >
                        <ArrowLeft size={14} /> Back to Employee Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminLoginMobile;
