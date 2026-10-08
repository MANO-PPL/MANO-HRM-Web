import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { Mail, Lock, Loader2, Eye, EyeOff, Sun, Moon } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";

// Helper to detect local hostnames or private network IPs (e.g. 192.168.x.x, 10.x.x.x, localhost)
const isPrivateOrLocalHost = (hostname) => {
    if (!hostname) return false;
    const cleanHost = hostname.split(':')[0].toLowerCase();
    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '::1') return true;
    if (/^192\.168\./.test(cleanHost)) return true;
    if (/^10\./.test(cleanHost)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(cleanHost)) return true;
    if (/^169\.254\./.test(cleanHost)) return true;
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanHost)) return true;
    return false;
};

const MobileLoginPage = () => {
    const isHostLocalOrLAN = typeof window !== 'undefined' && isPrivateOrLocalHost(window.location.hostname);
    const isCaptchaConfigured = String(import.meta.env.VITE_ENABLE_CAPTCHA).toLowerCase().trim() !== 'false';
    const isCaptchaEnabled = isCaptchaConfigured && !isHostLocalOrLAN;

    const { login } = useAuth();
    const navigate = useNavigate();
    const recaptchaRef = useRef(null);
    const [formData, setFormData] = useState({ identifier: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [captchaToken, setCaptchaToken] = useState(null);
    const [captchaError, setCaptchaError] = useState(false);
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) return savedTheme === 'dark';
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

        if (isCaptchaEnabled && !captchaError && !captchaToken && import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
            toast.error("Please complete the security check.");
            return;
        }

        setLoading(true);
        try {
            await login(
                formData.identifier,
                formData.password,
                (isCaptchaEnabled && !captchaError) ? captchaToken : undefined,
                rememberMe
            );
            toast.success("Identity Verified. Access Granted.");
            navigate("/dashboard");
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Authentication Failed";
            toast.error(errorMessage);
            if (recaptchaRef.current) {
                recaptchaRef.current.reset();
            }
            setCaptchaToken(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-[#F8FAFC] dark:bg-[#010404] font-inter text-slate-900 dark:text-white transition-colors duration-300 flex flex-col justify-center items-center overflow-x-hidden px-6 py-8">
            {/* Background ambient glowing spheres matching Flutter LoginMobilePortrait */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div
                    className="absolute -top-[100px] -left-[100px] w-[320px] sm:w-[420px] h-[320px] sm:h-[420px] rounded-full blur-[90px]"
                    style={{
                        background: isDark
                            ? 'radial-gradient(circle, rgba(37, 99, 235, 0.14) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)'
                    }}
                />
                <div
                    className="absolute -bottom-[100px] -right-[100px] w-[300px] sm:w-[380px] h-[300px] sm:h-[380px] rounded-full blur-[90px]"
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
                    className="w-10 h-10 flex items-center justify-center rounded-[16px] bg-white dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] shadow-sm text-[#475569] dark:text-[#94A3B8] hover:text-[#2563EB] dark:hover:text-white active:scale-95 transition-all"
                    title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    aria-label="Toggle Theme"
                >
                    {isDark ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} />}
                </button>
            </div>

            {/* Centered Form Content constrained to max-w-[440px] matching Flutter */}
            <div className="relative z-10 w-full max-w-[440px] my-auto">
                <form onSubmit={handleSubmit} className="flex flex-col">
                    {/* Brand Header Logo */}
                    <div className="flex items-center justify-center gap-3.5 mb-8">
                        <div className="w-11 h-11 bg-white dark:bg-[#0D1117] rounded-[14px] border border-[#E2E8F0] dark:border-[#30363D] shadow-md flex items-center justify-center p-1.5 shrink-0">
                            <img
                                src="/mano.png"
                                alt="Mano Logo"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = '/mano-logo.svg';
                                }}
                            />
                        </div>
                        <div className="flex flex-col justify-center">
                            <div className="text-[20px] font-black italic tracking-tight leading-none text-slate-900 dark:text-white">
                                MANO <span className="text-[#2563EB] not-italic font-bold">ATTENDANCE</span>
                            </div>
                            <span className="text-[8.5px] font-extrabold uppercase text-[#94A3B8] dark:text-[#64748B] tracking-[2.2px] mt-1">
                                ENTERPRISE OPERATIONS PORTAL
                            </span>
                        </div>
                    </div>

                    {/* Email Field */}
                    <div className="mb-4">
                        <label className="block text-[13px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                            Email Address
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#94A3B8]">
                                <Mail size={19} />
                            </div>
                            <input
                                type="text"
                                name="identifier"
                                value={formData.identifier}
                                onChange={handleChange}
                                required
                                autoComplete="username"
                                placeholder="Enter your email or employee ID"
                                className="w-full h-[52px] pl-11 pr-4 rounded-[16px] bg-[#F8FAFC] dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] text-[14px] font-medium text-[#0F172A] dark:text-white placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="mb-4">
                        <label className="block text-[13px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                            Password
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
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                className="w-full h-[52px] pl-11 pr-12 rounded-[16px] bg-[#F8FAFC] dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] text-[14px] font-medium text-[#0F172A] dark:text-white placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors shadow-sm"
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

                    {/* Captcha Section */}
                    {isCaptchaEnabled && !captchaError && import.meta.env.VITE_RECAPTCHA_SITE_KEY && (
                        <div className="mb-4 flex justify-center scale-90 sm:scale-95 origin-center">
                            <ReCAPTCHA
                                ref={recaptchaRef}
                                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                                onChange={setCaptchaToken}
                                onErrored={() => {
                                    console.warn("[reCAPTCHA] Failed to load. Bypassing requirement.");
                                    setCaptchaError(true);
                                }}
                                theme={isDark ? "dark" : "light"}
                            />
                        </div>
                    )}

                    {/* Options Row: Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between mb-6">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded border-[#E2E8F0] dark:border-[#30363D] text-[#2563EB] focus:ring-[#2563EB]/20 bg-white dark:bg-[#0D1117]"
                            />
                            <span className="text-[13px] font-medium text-slate-600 dark:text-slate-400">
                                Keep me signed in
                            </span>
                        </label>

                        <Link
                            to="/forgot-password"
                            className="text-[13px] font-semibold text-[#2563EB] hover:underline transition-all"
                        >
                            Forgot password?
                        </Link>
                    </div>

                    {/* Sign In Button */}
                    <button
                        type="submit"
                        disabled={loading || (isCaptchaEnabled && !captchaError && !captchaToken && Boolean(import.meta.env.VITE_RECAPTCHA_SITE_KEY))}
                        className="w-full h-[52px] rounded-[16px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-[14px] tracking-[0.8px] uppercase flex items-center justify-center shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin text-white" size={22} />
                        ) : (
                            "SIGN IN"
                        )}
                    </button>
                </form>

                {/* Subtle portal link */}
                <div className="mt-8 text-center">
                    <Link
                        to="/org-login"
                        className="text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-[#2563EB] dark:hover:text-[#2563EB] transition-colors"
                    >
                        Organization & Super Admin Portal →
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default MobileLoginPage;
