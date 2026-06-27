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
    Moon,
    Activity,
    Shield
} from "lucide-react";
import api from "../../services/api";
import LoadingScreen from "../../components/LoadingScreen";
import PhoneInput from "../../components/PhoneInput";
import { validatePhone, validateEmail } from "../../utils/validation";

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

const Register = () => {
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
        // Step 1: Org details
        org_name: "",
        org_code: "",
        address: "",
        industry: "Technology & Software",
        
        // Step 2: Primary Contact
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        gst_number: "",
        pan_number: "",
        max_users: 50,

        // Step 3: Admin User Setup
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

    // Response from server on success
    const [successData, setSuccessData] = useState(null);

    // Auto-generate organization code based on organization name
    useEffect(() => {
        if (!isOrgCodeManuallyEdited && formData.org_name) {
            const name = formData.org_name;
            const words = name.trim().split(/[\s\-_]+/).map(w => w.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean);
            let code = "";
            if (words.length >= 3) {
                code = words.map(w => w[0]).join("");
            } else if (words.length === 2) {
                const firstWord = words[0];
                const secondWord = words[1];
                if (firstWord.length >= 2) {
                    code = firstWord.substring(0, 2) + secondWord.charAt(0);
                } else {
                    code = firstWord.charAt(0) + secondWord.substring(0, 2);
                }
            } else if (words.length === 1) {
                code = words[0];
            }

            let cleanCode = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            if (cleanCode.length > 10) {
                cleanCode = cleanCode.substring(0, 10);
            }
            if (cleanCode.length < 3 && cleanCode.length > 0) {
                const originalClean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                if (originalClean.length >= 3) {
                    cleanCode = originalClean.substring(0, 5);
                } else {
                    cleanCode = (cleanCode + "ORG").substring(0, 5);
                }
            }
            if (cleanCode) {
                setFormData(prev => ({ ...prev, org_code: cleanCode }));
            }
        }
    }, [formData.org_name, isOrgCodeManuallyEdited]);

    const handleTextChange = (e) => {
        const { name, value } = e.target;
        if (name === "org_code") {
            setIsOrgCodeManuallyEdited(true);
            const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            setFormData(prev => ({ ...prev, org_code: cleaned }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: checked }));
    };

    const nextStep = () => {
        // Validate Step 1
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
        // Validate Step 2
        if (step === 2) {
            if (!formData.contact_name.trim()) {
                toast.error("Contact person name is required.");
                return;
            }
            if (!formData.contact_phone.trim()) {
                toast.error("Contact phone number is required.");
                return;
            }
            if (!validatePhone(formData.contact_phone)) {
                toast.error("Please enter a valid primary contact phone number according to the country code.");
                return;
            }
            if (!validateEmail(formData.contact_email)) {
                toast.error("A valid contact email is required.");
                return;
            }
            const hasGst = !!formData.gst_number?.trim();
            const hasPan = !!formData.pan_number?.trim();

            if ((hasGst && !hasPan) || (!hasGst && hasPan)) {
                toast.error("Please enter both GST and PAN, or leave both fields blank.");
                return;
            }

            if (hasGst && hasPan) {
                const upperGst = formData.gst_number.trim().toUpperCase();
                const upperPan = formData.pan_number.trim().toUpperCase();

                const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
                const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

                if (!gstRegex.test(upperGst)) {
                    toast.error("Invalid GST format. It must be in the format: 27ABCDE1234F1Z5.");
                    return;
                }
                if (!panRegex.test(upperPan)) {
                    toast.error("Invalid PAN format. It must be in the format: ABCDE1234F (5 letters, 4 digits, 1 letter).");
                    return;
                }

                // Update to uppercase
                setFormData(prev => ({ ...prev, gst_number: upperGst, pan_number: upperPan }));
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

        if (step < 3) {
            nextStep();
            return;
        }

        // Validate Step 3
        const finalAdminEmail = formData.isAdminSameAsPoc ? formData.contact_email : formData.admin_email;
        const finalAdminName = formData.isAdminSameAsPoc ? formData.contact_name : formData.admin_name;
        const finalAdminPhone = formData.isAdminSameAsPoc ? formData.contact_phone : formData.admin_phone;

        if (!formData.isAdminSameAsPoc) {
            if (!formData.admin_name.trim()) {
                toast.error("Administrator name is required.");
                return;
            }
            if (!validateEmail(formData.admin_email)) {
                toast.error("A valid administrator email is required.");
                return;
            }
            if (formData.admin_phone && !validatePhone(formData.admin_phone)) {
                toast.error("Please enter a valid administrator phone number according to the country code.");
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
                gst_number: formData.gst_number || null,
                pan_number: formData.pan_number || null,
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
        toast.success("Credentials copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    // Animation Variants
    const slideVariants = {
        enter: (dir) => ({
            x: dir > 0 ? 50 : -50,
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1,
            transition: { duration: 0.25 }
        },
        exit: (dir) => ({
            x: dir < 0 ? 50 : -50,
            opacity: 0,
            transition: { duration: 0.2 }
        })
    };

    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-[#010404] font-poppins selection:bg-indigo-500/30 overflow-hidden transition-colors duration-500">
            <AnimatePresence>
                {loading && (
                    <LoadingScreen message="Onboarding your organization..." />
                )}
            </AnimatePresence>

            {/* Background Visuals */}
            <div className="fixed inset-0 z-0 opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/5 dark:bg-violet-600/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.03] pointer-events-none" />
            </div>

            {/* Theme Toggle */}
            <button
                onClick={() => setIsDark(!isDark)}
                className="fixed top-8 right-8 z-[100] p-3 rounded-lg bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-600 dark:text-slate-400 hover:scale-110 active:scale-95 transition-all shadow-xl shadow-black/5"
            >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Main Flex Wrapper */}
            <div className="flex min-h-screen relative z-10">
                {/* LEFT SECTION: Show Branding on Desktop */}
                <div className="hidden lg:flex relative w-[48%] flex-col justify-between p-16 overflow-hidden border-r border-slate-200 dark:border-white/5 transition-colors duration-500">
                    {/* Logo */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-4"
                    >
                        <div className="w-12 h-12 bg-white dark:bg-[#0d1117] rounded-lg flex items-center justify-center border border-slate-100 dark:border-[#30363d] shadow-2xl">
                            <img src="/mano-logo.svg" alt="logo" className="w-7 h-7" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-none">
                                MANO <span className="text-indigo-600 dark:text-indigo-400 not-italic font-medium opacity-80">Attendance</span>
                            </h1>
                            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mt-0.5">Enterprise Operations</span>
                        </div>
                    </motion.div>

                    {/* Middle Info Graphics */}
                    <div className="space-y-8 my-auto">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-4"
                        >
                            <h2 className="text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-tight uppercase">
                                Deploy in <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400">Seconds.</span>
                            </h2>
                            <p className="max-w-md text-slate-500 dark:text-slate-400 text-base font-medium leading-relaxed">
                                Experience a complete self-onboarding flow. Create your secure organization space, setup initial administrator settings, and test with our 30-day premium trial plan instantly.
                            </p>
                        </motion.div>

                        {/* Interactive Steps List */}
                        <div className="space-y-4 max-w-md">
                            {[
                                { s: 1, title: "Company Profile", desc: "Define name, code, firm location, and industry type." },
                                { s: 2, title: "Contact & Billing Identity", desc: "Provide primary contacts, optional PAN/GST, and team size." },
                                { s: 3, title: "Admin Portal Credentials", desc: "Generate secure login code and credentials." }
                            ].map((item) => (
                                <motion.div
                                    key={item.s}
                                    className={`flex items-start gap-4 p-4 rounded-lg border transition-all duration-300 ${
                                        step === item.s
                                            ? "bg-indigo-600/10 dark:bg-indigo-400/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                                            : "border-transparent text-slate-400"
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                        step === item.s ? "bg-indigo-600 dark:bg-indigo-400 text-white" : "bg-slate-200 dark:bg-white/5"
                                    }`}>
                                        {item.s}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 leading-tight">{item.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>v1.2.0</span>
                        <span>© {new Date().getFullYear()} Mano Enterprises</span>
                    </div>
                </div>

                {/* RIGHT SECTION: Multi-step Signup Form */}
                <div className="relative flex flex-col justify-center w-full lg:w-[52%] p-6 md:p-12 lg:p-16 z-10 bg-white dark:bg-[#010101] transition-colors duration-500 shadow-[-20px_0_60px_rgba(0,0,0,0.05)] dark:shadow-none min-h-screen">
                    <div className="w-full max-w-xl mx-auto space-y-8">
                        
                        {/* Mobile Logo Branding */}
                        <div className="lg:hidden flex items-center gap-3 justify-center mb-6">
                            <div className="w-10 h-10 bg-white dark:bg-[#0d1117] rounded-lg flex items-center justify-center border border-slate-100 dark:border-[#30363d] shadow-lg">
                                <img src="/mano-logo.svg" alt="logo" className="w-6 h-6" />
                            </div>
                            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-none">
                                MANO <span className="text-indigo-600 dark:text-indigo-400 not-italic font-medium opacity-80">Attendance</span>
                            </h1>
                        </div>

                        {/* Title block */}
                        {step < 4 && (
                            <div className="text-center lg:text-left space-y-2">
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.25em]">
                                    Step {step} of 3
                                </span>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                                    {step === 1 && "Create Organization"}
                                    {step === 2 && "Billing & Contact Details"}
                                    {step === 3 && "Administrator Setup"}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                                    {step === 1 && "Set your organization name, legal location code, and industry area."}
                                    {step === 2 && "Setup billing preferences, team capacity limits, and tax records."}
                                    {step === 3 && "Configure the master user credentials and master passwords."}
                                </p>
                            </div>
                        )}

                        {/* Form block */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <AnimatePresence mode="wait" custom={direction}>
                                <motion.div
                                    key={step}
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    className="space-y-5"
                                >
                                    {/* STEP 1: ORGANIZATION CONFIG */}
                                    {step === 1 && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                    Organization Legal Name *
                                                </label>
                                                <div className="relative group">
                                                    <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        type="text"
                                                        name="org_name"
                                                        value={formData.org_name}
                                                        onChange={handleTextChange}
                                                        required
                                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                                        placeholder="e.g. Acme Corporation Ltd"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="flex justify-between items-center text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                    <span>Organization Code *</span>
                                                    <span className="text-[9px] text-slate-400 font-normal lowercase tracking-normal">e.g. ACME (used in login credentials)</span>
                                                </label>
                                                <div className="relative group">
                                                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        type="text"
                                                        name="org_code"
                                                        value={formData.org_code}
                                                        onChange={handleTextChange}
                                                        required
                                                        maxLength={10}
                                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                                        placeholder="e.g. ACME"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                    Industry Vertical *
                                                </label>
                                                <div className="relative group">
                                                    <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                                                    <select
                                                        name="industry"
                                                        value={formData.industry}
                                                        onChange={handleTextChange}
                                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm appearance-none"
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
                                                    <MapPin className="absolute left-5 top-4 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                    <textarea
                                                        name="address"
                                                        value={formData.address}
                                                        onChange={handleTextChange}
                                                        rows={2}
                                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm resize-none"
                                                        placeholder="Corporate Office / HQ Address"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* STEP 2: POC & BILLING CONFIG */}
                                    {step === 2 && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                    Primary Contact Person Name *
                                                </label>
                                                <div className="relative group">
                                                    <User className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        type="text"
                                                        name="contact_name"
                                                        value={formData.contact_name}
                                                        onChange={handleTextChange}
                                                        required
                                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                                        placeholder="e.g. John Doe"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                        Primary Contact Email *
                                                    </label>
                                                    <div className="relative group">
                                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                        <input
                                                            type="email"
                                                            name="contact_email"
                                                            value={formData.contact_email}
                                                            onChange={handleTextChange}
                                                            required
                                                            className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm text-sm"
                                                            placeholder="john@example.com"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                        Primary Contact Phone *
                                                    </label>
                                                    <PhoneInput
                                                        value={formData.contact_phone}
                                                        onChange={(val) => setFormData(prev => ({ ...prev, contact_phone: val }))}
                                                        variant="register-desktop"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                    Team Size (Max Users Allowed) *
                                                </label>
                                                <div className="relative group">
                                                    <Users className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                                                    <select
                                                        name="max_users"
                                                        value={formData.max_users}
                                                        onChange={handleTextChange}
                                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm appearance-none"
                                                    >
                                                        {MAX_USERS_OPTIONS.map(opt => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                        GST Number (Optional)
                                                    </label>
                                                    <div className="relative group">
                                                        <FileText className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                        <input
                                                            type="text"
                                                            name="gst_number"
                                                            value={formData.gst_number || ""}
                                                            onChange={handleTextChange}
                                                            className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm text-sm"
                                                            placeholder="e.g. 27ABCDE1234F1Z5"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                        PAN Number (Optional)
                                                    </label>
                                                    <div className="relative group">
                                                        <FileText className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                        <input
                                                            type="text"
                                                            name="pan_number"
                                                            value={formData.pan_number || ""}
                                                            onChange={handleTextChange}
                                                            className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm text-sm"
                                                            placeholder="e.g. ABCDE1234F"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* STEP 3: ADMINISTRATOR ACCOUNT CONFIG */}
                                    {step === 3 && (
                                        <>
                                            {/* Same as POC checkbox */}
                                            <div className="bg-slate-50 dark:bg-[#0d1117]/30 border border-slate-200 dark:border-[#30363d]/50 p-4 rounded-lg mb-4">
                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        name="isAdminSameAsPoc"
                                                        checked={formData.isAdminSameAsPoc}
                                                        onChange={handleCheckboxChange}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-5 h-5 rounded border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#0d1117] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:scale-105">
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
                                                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 select-none transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-300">
                                                        Admin user is same as Primary Contact
                                                    </span>
                                                </label>
                                            </div>

                                            {/* Hidden Admin Fields if they are different */}
                                            {!formData.isAdminSameAsPoc && (
                                                <div className="space-y-4 border-l-2 border-indigo-500/20 pl-4 py-1">
                                                    <div className="space-y-2">
                                                        <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                            Administrator Name *
                                                        </label>
                                                        <div className="relative group">
                                                            <User className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                            <input
                                                                type="text"
                                                                name="admin_name"
                                                                value={formData.admin_name}
                                                                onChange={handleTextChange}
                                                                required
                                                                className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                                                                placeholder="e.g. Admin Supervisor"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                                Administrator Email *
                                                            </label>
                                                            <div className="relative group">
                                                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                                                                <input
                                                                    type="email"
                                                                    name="admin_email"
                                                                    value={formData.admin_email}
                                                                    onChange={handleTextChange}
                                                                    required
                                                                    className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm"
                                                                    placeholder="admin@example.com"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                                Administrator Phone
                                                            </label>
                                                            <PhoneInput
                                                                value={formData.admin_phone}
                                                                onChange={(val) => setFormData(prev => ({ ...prev, admin_phone: val }))}
                                                                variant="register-desktop"
                                                                placeholder="Admin Phone"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                    Initial Administrator Password *
                                                </label>
                                                <div className="relative group">
                                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        name="admin_password"
                                                        value={formData.admin_password}
                                                        onChange={handleTextChange}
                                                        required
                                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
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

                                            <div className="space-y-2">
                                                <label className="block text-xs font-normal text-slate-500 dark:text-slate-400 px-1">
                                                    Confirm Password *
                                                </label>
                                                <div className="relative group">
                                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        type={showConfirmPassword ? "text" : "password"}
                                                        name="confirm_password"
                                                        value={formData.confirm_password}
                                                        onChange={handleTextChange}
                                                        required
                                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg py-4 pl-14 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
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
                                        </>
                                    )}

                                    {/* STEP 4: SUCCESS / CREDENTIALS DISPLAY */}
                                    {step === 4 && successData && (
                                        <div className="space-y-6 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-full animate-bounce">
                                                    <CheckCircle2 size={48} />
                                                </div>
                                                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                    Registration Successful
                                                </h3>
                                                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                                                    Your organization workspace has been created. Use the generated credentials below to log into the main application.
                                                </p>
                                            </div>

                                            {/* Credentials Box */}
                                            <div className="bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg p-6 space-y-4 text-left max-w-md mx-auto relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-full blur-xl pointer-events-none" />
                                                
                                                <div className="space-y-1">
                                                    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">Organization Code</span>
                                                    <span className="text-lg font-mono font-black text-indigo-600 dark:text-indigo-400 uppercase">
                                                        {successData.user_code.substring(0, successData.user_code.length - 3)}
                                                    </span>
                                                </div>

                                                <div className="h-px bg-slate-200 dark:bg-[#30363d]" />

                                                <div className="space-y-1">
                                                    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">Admin Username / Login ID</span>
                                                    <span className="text-lg font-mono font-black text-slate-900 dark:text-white">
                                                        {successData.user_code}
                                                    </span>
                                                </div>

                                                <div className="h-px bg-slate-200 dark:bg-[#30363d]" />

                                                <div className="space-y-1">
                                                    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">Email Address</span>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {successData.email}
                                                    </span>
                                                </div>

                                                <div className="pt-2 flex justify-between items-center text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/5 dark:bg-amber-400/5 px-3 py-2 rounded-lg border border-amber-500/10">
                                                    <span>Password: Secure password set by you</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="space-y-3 max-w-md mx-auto pt-2">
                                                <button
                                                    type="button"
                                                    onClick={copyToClipboard}
                                                    className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-[#0d1117] dark:hover:bg-[#161b22] border border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-slate-300 py-4 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                                >
                                                    {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                                    {copied ? "Credentials Copied" : "Copy Credentials"}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => navigate("/login")}
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/10"
                                                >
                                                    Proceed to Login
                                                    <ArrowRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Navigation Buttons for Form Steps */}
                            {step < 4 && (
                                <div className="pt-4 flex items-center gap-4">
                                    {step > 1 && (
                                        <button
                                            type="button"
                                            onClick={prevStep}
                                            className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#0d1117] dark:hover:bg-[#161b22] border border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-slate-300 py-4 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                        >
                                            <ArrowLeft size={16} />
                                            Back
                                        </button>
                                    )}

                                    {step < 3 ? (
                                        <button
                                            type="button"
                                            onClick={nextStep}
                                            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/10"
                                        >
                                            Next Step
                                            <ArrowRight size={16} />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-lg text-[10px] font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/10 disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={16} /> : "Complete Registration"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </form>

                        {/* Footer link to sign in */}
                        {step < 4 && (
                            <div className="text-center pt-2">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Already registered?{" "}
                                    <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                        Sign In
                                    </Link>
                                </p>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
