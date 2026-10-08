import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Mail, ArrowLeft, Loader2, Key, Lock, Sun, Moon } from 'lucide-react';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState('email'); // email, otp, reset
    const [loading, setLoading] = useState(false);

    // Form States
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState(null);

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

    const API_BASE = '/api/auth';

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!email) {
            toast.error("Please enter your email");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.message || "Failed to send OTP");

            toast.success(data.message || "OTP sent to your email!");
            setStep('otp');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!otp) {
            toast.error("Please enter the OTP");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.message || "Invalid OTP");

            setResetToken(data.resetToken);
            toast.success("OTP verified!");
            setStep('reset');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!newPassword || !confirmPassword) {
            toast.error("Please fill in all fields");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resetToken, newPassword })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.message || "Failed to reset password");

            toast.success("Password reset successfully! Please sign in.");
            navigate('/login');
        } catch (error) {
            toast.error(error.message);
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
                            ? 'radial-gradient(circle, rgba(37, 99, 235, 0.14) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)'
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
                    className="w-10 h-10 flex items-center justify-center rounded-[16px] bg-white dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] shadow-sm text-[#475569] dark:text-[#94A3B8] hover:text-[#2563EB] dark:hover:text-white active:scale-95 transition-all"
                    title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isDark ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} />}
                </button>
            </div>

            <div className="relative z-10 w-full max-w-[440px] my-auto">
                {/* Brand Header */}
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
                            ACCOUNT RECOVERY PORTAL
                        </span>
                    </div>
                </div>

                {/* Form Card matching Flutter ForgotPasswordMobilePortrait */}
                <div className="bg-white dark:bg-[#161B22] rounded-[20px] p-6 sm:p-7 border border-[#E2E8F0] dark:border-[#30363D] shadow-xl">
                    <h2 className="text-xl font-bold text-center text-[#0F172A] dark:text-[#C9D1D9] mb-1.5">
                        {step === 'email' && "Forgot Password"}
                        {step === 'otp' && "Verify Security Code"}
                        {step === 'reset' && "Reset Your Password"}
                    </h2>
                    <p className="text-xs text-center text-[#64748B] dark:text-[#8B949E] mb-6 leading-relaxed">
                        {step === 'email' && "Enter your registered email to receive OTP."}
                        {step === 'otp' && `Enter the 6-digit verification code sent to ${email}.`}
                        {step === 'reset' && "Create a new strong password for your account."}
                    </p>

                    {/* Step 1: Email Form */}
                    {step === 'email' && (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div>
                                <label className="block text-[13px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#94A3B8]">
                                        <Mail size={19} />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="Enter your registered email"
                                        className="w-full h-[52px] pl-11 pr-4 rounded-[16px] bg-[#F8FAFC] dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] text-[14px] font-medium text-[#0F172A] dark:text-white placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-[52px] rounded-[16px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50 text-white font-extrabold text-[14px] tracking-[0.8px] uppercase flex items-center justify-center shadow-md shadow-blue-600/30 transition-all cursor-pointer mt-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : "SEND OTP"}
                            </button>
                        </form>
                    )}

                    {/* Step 2: OTP Form */}
                    {step === 'otp' && (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div>
                                <label className="block text-[13px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                                    Verification Code (OTP)
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#94A3B8]">
                                        <Key size={19} />
                                    </div>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        required
                                        maxLength={6}
                                        placeholder="••••••"
                                        className="w-full h-[52px] pl-11 pr-4 rounded-[16px] bg-[#F8FAFC] dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] text-[16px] font-mono tracking-[0.3em] text-center text-[#0F172A] dark:text-white placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-[52px] rounded-[16px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50 text-white font-extrabold text-[14px] tracking-[0.8px] uppercase flex items-center justify-center shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : "VERIFY OTP"}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('email')}
                                className="w-full text-center text-[12px] font-semibold text-[#2563EB] hover:underline pt-1"
                            >
                                Change Email Address
                            </button>
                        </form>
                    )}

                    {/* Step 3: Reset Password Form */}
                    {step === 'reset' && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label className="block text-[13px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#94A3B8]">
                                        <Lock size={19} />
                                    </div>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={8}
                                        placeholder="At least 8 characters"
                                        className="w-full h-[52px] pl-11 pr-4 rounded-[16px] bg-[#F8FAFC] dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] text-[14px] font-medium text-[#0F172A] dark:text-white placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[13px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#94A3B8]">
                                        <Lock size={19} />
                                    </div>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={8}
                                        placeholder="Repeat new password"
                                        className="w-full h-[52px] pl-11 pr-4 rounded-[16px] bg-[#F8FAFC] dark:bg-[#0D1117] border border-[#E2E8F0] dark:border-[#30363D] text-[14px] font-medium text-[#0F172A] dark:text-white placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-[52px] rounded-[16px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50 text-white font-extrabold text-[14px] tracking-[0.8px] uppercase flex items-center justify-center shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : "RESET PASSWORD"}
                            </button>
                        </form>
                    )}

                    <div className="mt-5 text-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2563EB] hover:underline"
                        >
                            <ArrowLeft size={15} /> Back to Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
