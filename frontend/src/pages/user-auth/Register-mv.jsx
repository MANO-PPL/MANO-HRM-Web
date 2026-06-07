import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import {
    Building2,
    MapPin,
    Briefcase,
    Key,
    User,
    Phone,
    Mail,
    FileText,
    Users,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    Copy,
    Check,
    Loader2,
    Sun,
    Moon
} from "lucide-react";
import api from "../../services/api";
import LoadingScreen from "../../components/LoadingScreen";

const INDUSTRIES = [
    "Technology & Software",
    "Manufacturing & Heavy Industry",
    "Healthcare & Medical",
    "Retail & E-commerce",
    "Construction & Real Estate",
    "Hospitality & Tourism",
    "Education & Training",
    "Logistics & Supply Chain",
    "Professional Services",
    "Financial Services & Banking",
    "Other"
];

const MAX_USERS_OPTIONS = [
    { label: "10 Users (Small Team)", value: 10 },
    { label: "50 Users (Growing Firm)", value: 50 },
    { label: "100 Users (Medium Org)", value: 100 },
    { label: "200 Users (Large Enterprise)", value: 200 },
    { label: "500 Users (Corporation)", value: 500 }
];

const MobileRegisterPage = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [direction, setDirection] = useState(0);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Dark Mode Sync
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

    // Form State
    const [formData, setFormData] = useState({
        org_name: "",
        org_code: "",
        address: "",
        industry: "Technology & Software",
        
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        tax_identity: "Neither",
        tax_code: "",
        max_users: 50,

        isAdminSameAsPoc: true,
        admin_name: "",
        admin_phone: "",
        admin_email: "",
        admin_password: "",
        confirm_password: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isOrgCodeManuallyEdited, setIsOrgCodeManuallyEdited] = useState(false);
    const [successData, setSuccessData] = useState(null);

    // Auto-generate code based on company name
    useEffect(() => {
        if (!isOrgCodeManuallyEdited && formData.org_name) {
            let code = formData.org_name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            code = code.substring(0, 5);
            if (code.length >= 3) {
                setFormData(prev => ({ ...prev, org_code: code }));
            } else if (code.length > 0) {
                setFormData(prev => ({ ...prev, org_code: (code + "ORG").substring(0, 5) }));
            }
        }
    }, [formData.org_name, isOrgCodeManuallyEdited]);

    const handleTextChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === "org_code") {
            setIsOrgCodeManuallyEdited(true);
        }
    };

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: checked }));
    };

    const nextStep = () => {
        if (step === 1) {
            if (!formData.org_name.trim()) {
                toast.error("Organization legal name is required.");
                return;
            }
            const cleanCode = formData.org_code.trim().toUpperCase();
            if (cleanCode.length < 3 || cleanCode.length > 10 || !/^[A-Z0-9]+$/.test(cleanCode)) {
                toast.error("Organization code must be 3-10 alphanumeric characters with no spaces.");
                return;
            }
        }
        if (step === 2) {
            if (!formData.contact_name.trim()) {
                toast.error("Contact person name is required.");
                return;
            }
            if (!formData.contact_phone.trim()) {
                toast.error("Contact phone number is required.");
                return;
            }
            if (!formData.contact_email.trim() || !/\S+@\S+\.\S+/.test(formData.contact_email)) {
                toast.error("A valid contact email is required.");
                return;
            }
            if (formData.tax_identity !== "Neither" && !formData.tax_code.trim()) {
                toast.error(`Please enter your ${formData.tax_identity} identification code.`);
                return;
            }
        }

        setDirection(1);
        setStep(prev => prev + 1);
    };

    const prevStep = () => {
        setDirection(-1);
        setStep(prev => prev - 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const finalAdminEmail = formData.isAdminSameAsPoc ? formData.contact_email : formData.admin_email;
        const finalAdminName = formData.isAdminSameAsPoc ? formData.contact_name : formData.admin_name;
        const finalAdminPhone = formData.isAdminSameAsPoc ? formData.contact_phone : formData.admin_phone;

        if (!formData.isAdminSameAsPoc) {
            if (!formData.admin_name.trim()) {
                toast.error("Administrator name is required.");
                return;
            }
            if (!formData.admin_email.trim() || !/\S+@\S+\.\S+/.test(formData.admin_email)) {
                toast.error("A valid administrator email is required.");
                return;
            }
        }

        if (!formData.admin_password) {
            toast.error("Please set a secure administrator password.");
            return;
        }

        if (formData.admin_password.length < 6) {
            toast.error("Admin password must be at least 6 characters.");
            return;
        }

        if (formData.admin_password !== formData.confirm_password) {
            toast.error("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                org_name: formData.org_name,
                org_code: formData.org_code,
                contact_name: formData.contact_name,
                contact_email: formData.contact_email,
                contact_phone: formData.contact_phone,
                admin_name: finalAdminName,
                admin_email: finalAdminEmail,
                admin_phone: finalAdminPhone,
                admin_password: formData.admin_password,
                address: formData.address,
                industry: formData.industry,
                tax_identity: formData.tax_identity,
                tax_code: formData.tax_identity === "Neither" ? null : formData.tax_code,
                max_users: Number(formData.max_users)
            };

            const response = await api.post("/auth/onboard", payload);
            setSuccessData(response.data);
            toast.success("Organization onboarded successfully!");
            setDirection(1);
            setStep(4);
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Self Onboarding Failed";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!successData) return;
        const text = `MANO Attendance Credentials:\nOrganization Code: ${successData.user_code.substring(0, successData.user_code.length - 3)}\nAdmin Login ID: ${successData.user_code}\nRegistered Email: ${successData.email}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Credentials copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    const slideVariants = {
        enter: (dir) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1, transition: { duration: 0.25 } },
        exit: (dir) => ({ x: dir < 0 ? 50 : -50, opacity: 0, transition: { duration: 0.2 } })
    };

    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-[#010404] font-poppins selection:bg-indigo-500/30 overflow-x-hidden transition-colors duration-500 flex flex-col">
            <AnimatePresence>
                {loading && (
                    <LoadingScreen message="Creating workspace..." />
                )}
            </AnimatePresence>

            {/* Background Visuals */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-5%] left-[-5%] w-[80%] h-[35%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[80px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-5%] right-[-5%] w-[70%] h-[35%] bg-violet-600/5 dark:bg-violet-600/10 blur-[80px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.03]" />
            </div>

            <div className="relative z-10 flex flex-col flex-1 px-5 py-6">
                {/* Header */}
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-[#0d1117] rounded-lg flex items-center justify-center shadow-lg border border-slate-100 dark:border-[#30363d]">
                            <img src="/mano-logo.svg" alt="logo" className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-none">
                                MANO <span className="text-indigo-600 dark:text-indigo-400 not-italic font-medium opacity-80 text-xs">Attendance</span>
                            </h1>
                            <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-0.5">Self Onboarding</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="w-10 h-10 bg-white dark:bg-[#0d1117] rounded-lg flex items-center justify-center shadow-md border border-slate-200 dark:border-[#30363d] text-slate-600 dark:text-slate-400 active:scale-90 transition-all"
                    >
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </header>

                {/* Progress Header */}
                {step < 4 && (
                    <div className="mb-6">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
                            <span>Step {step} of 3</span>
                            <span>{step === 1 && "Profile"} {step === 2 && "Contact & Billing"} {step === 3 && "Credentials"}</span>
                        </div>
                        <div className="w-full h-1 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 rounded-full" 
                                style={{ width: `${(step / 3) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Step Content Form */}
                <div className="flex-1 flex flex-col justify-center">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={step}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                className="space-y-4"
                            >
                                {/* STEP 1 */}
                                {step === 1 && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Organization Legal Name *
                                            </label>
                                            <div className="relative group">
                                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    name="org_name"
                                                    value={formData.org_name}
                                                    onChange={handleTextChange}
                                                    required
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                                    placeholder="e.g. Acme Corporation"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Organization Code *
                                            </label>
                                            <div className="relative group">
                                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    name="org_code"
                                                    value={formData.org_code}
                                                    onChange={handleTextChange}
                                                    required
                                                    maxLength={10}
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                                    placeholder="e.g. ACME"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Industry Vertical *
                                            </label>
                                            <div className="relative group">
                                                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
                                                <select
                                                    name="industry"
                                                    value={formData.industry}
                                                    onChange={handleTextChange}
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm appearance-none"
                                                >
                                                    {INDUSTRIES.map(ind => (
                                                        <option key={ind} value={ind}>{ind}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Firm Address
                                            </label>
                                            <div className="relative group">
                                                <MapPin className="absolute left-4 top-3.5 size-5 text-slate-400" />
                                                <textarea
                                                    name="address"
                                                    value={formData.address}
                                                    onChange={handleTextChange}
                                                    rows={2}
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm shadow-sm resize-none"
                                                    placeholder="Office / Location Address"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* STEP 2 */}
                                {step === 2 && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Primary Contact Name *
                                            </label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    name="contact_name"
                                                    value={formData.contact_name}
                                                    onChange={handleTextChange}
                                                    required
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                                    placeholder="e.g. John Doe"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Primary Contact Email *
                                            </label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                <input
                                                    type="email"
                                                    name="contact_email"
                                                    value={formData.contact_email}
                                                    onChange={handleTextChange}
                                                    required
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                                    placeholder="john@example.com"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Primary Contact Phone *
                                            </label>
                                            <div className="relative group">
                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                <input
                                                    type="tel"
                                                    name="contact_phone"
                                                    value={formData.contact_phone}
                                                    onChange={handleTextChange}
                                                    required
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                                    placeholder="+1 234 567 8900"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Max Users Allowed *
                                            </label>
                                            <div className="relative group">
                                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
                                                <select
                                                    name="max_users"
                                                    value={formData.max_users}
                                                    onChange={handleTextChange}
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm appearance-none"
                                                >
                                                    {MAX_USERS_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Tax Identity
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {["GST", "PAN", "Neither"].map(type => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, tax_identity: type }))}
                                                        className={`py-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                                                            formData.tax_identity === type
                                                                ? "bg-indigo-600 border-indigo-600 text-white"
                                                                : "bg-white dark:bg-[#0d1117] border-slate-200 dark:border-[#30363d] text-slate-500 dark:text-slate-400"
                                                        }`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {formData.tax_identity !== "Neither" && (
                                            <div className="space-y-2">
                                                <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                    {formData.tax_identity} ID Value *
                                                </label>
                                                <div className="relative group">
                                                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        name="tax_code"
                                                        value={formData.tax_code}
                                                        onChange={handleTextChange}
                                                        required
                                                        className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                                        placeholder={`Enter ${formData.tax_identity} code`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* STEP 3 */}
                                {step === 3 && (
                                    <>
                                        <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] p-3 rounded-lg">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    name="isAdminSameAsPoc"
                                                    checked={formData.isAdminSameAsPoc}
                                                    onChange={handleCheckboxChange}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-5 h-5 rounded border border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:scale-105">
                                                    <svg
                                                        className={`w-3.5 h-3.5 text-white transition-opacity ${formData.isAdminSameAsPoc ? 'opacity-100' : 'opacity-0'}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth="3.5"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 select-none">
                                                    Admin user is same as Contact
                                                </span>
                                            </label>
                                        </div>

                                        {!formData.isAdminSameAsPoc && (
                                            <div className="space-y-4 border-l-2 border-indigo-500/20 pl-3 py-1">
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                        Admin Name *
                                                    </label>
                                                    <div className="relative group">
                                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            name="admin_name"
                                                            value={formData.admin_name}
                                                            onChange={handleTextChange}
                                                            required
                                                            className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4"
                                                            placeholder="Admin supervisor name"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                        Admin Email *
                                                    </label>
                                                    <div className="relative group">
                                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                        <input
                                                            type="email"
                                                            name="admin_email"
                                                            value={formData.admin_email}
                                                            onChange={handleTextChange}
                                                            required
                                                            className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 text-sm"
                                                            placeholder="admin@example.com"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Admin password *
                                            </label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    name="admin_password"
                                                    value={formData.admin_password}
                                                    onChange={handleTextChange}
                                                    required
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                                    placeholder="••••••••"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                Confirm password *
                                            </label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    name="confirm_password"
                                                    value={formData.confirm_password}
                                                    onChange={handleTextChange}
                                                    required
                                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-3.5 pl-12 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                                    placeholder="••••••••"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* SUCCESS DISPLAY */}
                                {step === 4 && successData && (
                                    <div className="space-y-5 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-full animate-bounce">
                                                <CheckCircle2 size={38} />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                Workspace Ready
                                            </h3>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-[280px] mx-auto leading-relaxed">
                                                Your organization has been successfully registered on the platform. Use these credentials to login.
                                            </p>
                                        </div>

                                        <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg p-5 space-y-3 text-left shadow-sm">
                                            <div className="space-y-0.5">
                                                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">Org Code</span>
                                                <span className="text-base font-mono font-black text-indigo-600 dark:text-indigo-400 uppercase">
                                                    {successData.user_code.substring(0, successData.user_code.length - 3)}
                                                </span>
                                            </div>
                                            <div className="h-px bg-slate-200 dark:bg-[#30363d]" />
                                            <div className="space-y-0.5">
                                                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">Admin Login ID</span>
                                                <span className="text-base font-mono font-black text-slate-900 dark:text-white">
                                                    {successData.user_code}
                                                </span>
                                            </div>
                                            <div className="h-px bg-slate-200 dark:bg-[#30363d]" />
                                            <div className="space-y-0.5">
                                                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">Email</span>
                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    {successData.email}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={copyToClipboard}
                                                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-slate-300 py-3.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-2 active:scale-95 transition-all"
                                            >
                                                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                {copied ? "Copied Credentials" : "Copy Credentials"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => navigate("/login")}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
                                            >
                                                Go to Login Page
                                                <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Navigation buttons */}
                        {step < 4 && (
                            <div className="pt-2 flex items-center gap-3">
                                {step > 1 && (
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="flex-1 bg-slate-100 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-slate-300 py-3.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-1 active:scale-95 transition-all"
                                    >
                                        <ArrowLeft size={14} />
                                        Back
                                    </button>
                                )}

                                {step < 3 ? (
                                    <button
                                        type="button"
                                        onClick={nextStep}
                                        className="flex-[2] bg-indigo-600 text-white py-3.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-1 active:scale-95 transition-all"
                                    >
                                        Next
                                        <ArrowRight size={14} />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-[2] bg-indigo-600 text-white py-3.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={14} /> : "Submit"}
                                    </button>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer */}
                {step < 4 && (
                    <footer className="mt-8 text-center">
                        <p className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            Already registered?{" "}
                            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default MobileRegisterPage;
