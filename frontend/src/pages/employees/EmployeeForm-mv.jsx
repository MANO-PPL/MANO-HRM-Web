import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Save,
    X,
    User,
    Mail,
    Phone,
    Briefcase,
    Clock,
    Plus,
    ChevronDown,
    Camera,
    Loader2,
    Eye,
    EyeOff
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const QuickAddPopover = ({ title, onAdd, onClose, isOpen }) => {
    const [newValue, setNewValue] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newValue.trim()) return;
        setLoading(true);
        try {
            await onAdd(newValue);
            setNewValue("");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Failed to add item");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="absolute z-50 bottom-full right-0 mb-3 w-72 p-4 bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/20 border border-indigo-500/30 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-sm origin-bottom-right font-sans">
            <div className="absolute -bottom-2 right-3 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-indigo-500/30 border-r-[8px] border-r-transparent"></div>
            <div className="absolute -bottom-[7px] right-3 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-slate-900 border-r-[8px] border-r-transparent"></div>

            <div className="flex justify-between items-start mb-3">
                <h4 className="text-sm font-medium text-white">{title}</h4>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                    <X size={14} />
                </button>
            </div>

            <div className="flex flex-col gap-3">
                <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="e.g. Engineering"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-slate-500"
                    autoFocus
                />
                <button
                    onClick={handleSubmit}
                    disabled={loading || !newValue.trim()}
                    className="self-end px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(99,102,241,0.4)] hover:shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all duration-200"
                >
                    {loading ? 'Adding...' : 'Add'}
                </button>
            </div>
        </div>
    );
};

const EmployeeForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;
    const { user: currentUser } = useAuth();

    const [formData, setFormData] = useState({
        user_name: '',
        email: '',
        phone_no: '',
        user_password: '',
        desg_id: '',
        dept_id: '',
        shift_id: '',
        user_type: 'employee',
        status: true,
        profile_image_url: ''
    });

    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [imageTimestamp, setImageTimestamp] = useState(Date.now());

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    
    // Custom Dropdown & Quick Add state variables
    const [isShiftOpen, setIsShiftOpen] = useState(false);
    const [shiftSearchQuery, setShiftSearchQuery] = useState('');
    const [isDeptOpen, setIsDeptOpen] = useState(false);
    const [deptSearchQuery, setDeptSearchQuery] = useState('');
    const [isDesgOpen, setIsDesgOpen] = useState(false);
    const [desgSearchQuery, setDesgSearchQuery] = useState('');
    const [isUserTypeOpen, setIsUserTypeOpen] = useState(false);
    const [activePopover, setActivePopover] = useState(null);

    const shiftContainerRef = useRef(null);
    const deptContainerRef = useRef(null);
    const desgContainerRef = useRef(null);
    const userTypeContainerRef = useRef(null);

    const toggleDeptDropdown = () => {
        setIsDeptOpen(prev => !prev);
        setIsDesgOpen(false);
        setIsShiftOpen(false);
        setIsUserTypeOpen(false);
        setActivePopover(null);
    };

    const toggleDesgDropdown = () => {
        setIsDesgOpen(prev => !prev);
        setIsDeptOpen(false);
        setIsShiftOpen(false);
        setIsUserTypeOpen(false);
        setActivePopover(null);
    };

    const toggleShiftDropdown = () => {
        setIsShiftOpen(prev => !prev);
        setIsDeptOpen(false);
        setIsDesgOpen(false);
        setIsUserTypeOpen(false);
        setActivePopover(null);
    };

    const toggleUserTypeDropdown = () => {
        setIsUserTypeOpen(prev => !prev);
        setIsDeptOpen(false);
        setIsDesgOpen(false);
        setIsShiftOpen(false);
        setActivePopover(null);
    };

    const toggleQuickAdd = (type) => {
        setActivePopover(activePopover === type ? null : type);
        setIsDeptOpen(false);
        setIsDesgOpen(false);
        setIsShiftOpen(false);
        setIsUserTypeOpen(false);
    };

    const handleAddDepartment = async (name) => {
        const res = await adminService.createDepartment(name);
        if (res.success) {
            toast.success("Department added");
            const deptRes = await adminService.getDepartments();
            setDepartments(deptRes.departments);
            setFormData(prev => ({ ...prev, dept_id: res.dept_id }));
        }
    };

    const handleAddDesignation = async (name) => {
        const res = await adminService.createDesignation(name);
        if (res.success) {
            toast.success("Designation added");
            const desgRes = await adminService.getDesignations();
            setDesignations(desgRes.designations);
            setFormData(prev => ({ ...prev, desg_id: res.desg_id }));
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activePopover === 'dept' && deptContainerRef.current && !deptContainerRef.current.contains(event.target)) setActivePopover(null);
            if (activePopover === 'desg' && desgContainerRef.current && !desgContainerRef.current.contains(event.target)) setActivePopover(null);
            if (isShiftOpen && shiftContainerRef.current && !shiftContainerRef.current.contains(event.target)) setIsShiftOpen(false);
            if (isDeptOpen && deptContainerRef.current && !deptContainerRef.current.contains(event.target)) setIsDeptOpen(false);
            if (isDesgOpen && desgContainerRef.current && !desgContainerRef.current.contains(event.target)) setIsDesgOpen(false);
            if (isUserTypeOpen && userTypeContainerRef.current && !userTypeContainerRef.current.contains(event.target)) setIsUserTypeOpen(false);
        };
        if (activePopover || isShiftOpen || isDeptOpen || isDesgOpen || isUserTypeOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activePopover, isShiftOpen, isDeptOpen, isDesgOpen, isUserTypeOpen]);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [deptRes, desgRes, shiftRes] = await Promise.all([
                    adminService.getDepartments(),
                    adminService.getDesignations(),
                    adminService.getShifts()
                ]);

                if (deptRes.success) setDepartments(deptRes.departments);
                if (desgRes.success) setDesignations(desgRes.designations);
                if (shiftRes.success || shiftRes.ok) setShifts(shiftRes.shifts || []);

                if (isEditMode) {
                    const userRes = await adminService.getUserById(id);
                    if (userRes.success) {
                        const u = userRes.user;
                        setFormData({
                            user_name: u.user_name,
                            email: u.email,
                            phone_no: u.phone_no || '',
                            user_password: '',
                            desg_id: u.desg_id || '',
                            dept_id: u.dept_id || '',
                            shift_id: u.shift_id || '',
                            user_type: u.user_type,
                            status: true,
                            profile_image_url: u.profile_image_url || ''
                        });
                    }
                }
            } catch (err) {
                console.error(err);
                toast.error("Failed to load data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id, isEditMode]);

    const validateForm = (data) => {
        const newErrors = {};

        // Full name validation
        if (!data.user_name || !data.user_name.trim()) {
            newErrors.user_name = "Full Name is required";
        } else if (data.user_name.trim().length < 3) {
            newErrors.user_name = "Name must be at least 3 characters";
        } else if (!/^[a-zA-Z\s.-]+$/.test(data.user_name.trim())) {
            newErrors.user_name = "Name can only contain letters, spaces, dots, and hyphens";
        }

        // Password validation (only for new user or if password field is filled in edit mode)
        if (!isEditMode) {
            if (!data.user_password) {
                newErrors.user_password = "Password is required for new employees";
            } else if (data.user_password.length < 6) {
                newErrors.user_password = "Password must be at least 6 characters";
            }
        } else {
            if (data.user_password && data.user_password.length < 6) {
                newErrors.user_password = "Password must be at least 6 characters";
            }
        }

        // Email validation
        if (data.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email.trim())) {
                newErrors.email = "Invalid email format";
            }
        }

        // Phone validation
        if (data.phone_no) {
            const cleanPhone = data.phone_no.replace(/[-()\s]/g, "");
            const phoneRegex = /^\+?[0-9]{10,15}$/;
            if (!phoneRegex.test(cleanPhone)) {
                newErrors.phone_no = "Phone number must be 10-15 digits";
            }
        }

        // Either Email or Phone is required
        if (!data.email?.trim() && !data.phone_no?.trim()) {
            newErrors.email = "Either Email or Phone number is required";
            newErrors.phone_no = "Either Email or Phone number is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        setFormData(prev => {
            const updated = { ...prev, [name]: val };
            validateForm(updated);
            return updated;
        });
        setTouched(prev => ({ ...prev, [name]: true }));
    };

    const handleBlur = (e) => {
        const { name } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
        validateForm(formData);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        const formDataPayload = new FormData();
        formDataPayload.append('avatar', file);

        setUploading(true);
        try {
            const res = await adminService.updateUserAvatar(id, formDataPayload);
            if (res.success) {
                toast.success('Profile picture updated!');
                setImageTimestamp(Date.now());
                setFormData(prev => ({
                    ...prev,
                    profile_image_url: res.profile_image_url
                }));
            }
        } catch (error) {
            console.error('Upload Error:', error);
            toast.error(error.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Mark all fields as touched
        setTouched({
            user_name: true,
            user_password: true,
            email: true,
            phone_no: true
        });

        const isValid = validateForm(formData);
        if (!isValid) {
            toast.error("Please resolve the validation errors before saving");
            return;
        }

        try {
            setIsSaving(true);

            const payload = {
                user_name: formData.user_name,
                email: formData.email,
                phone_no: formData.phone_no,
                desg_id: formData.desg_id,
                dept_id: formData.dept_id,
                shift_id: formData.shift_id,
                user_type: formData.user_type
            };

            if (formData.user_password) {
                payload.user_password = formData.user_password;
            } else if (!isEditMode) {
                payload.user_password = "Password@123";
            }

            if (!isEditMode && !payload.user_password) {
                toast.error("Password is required for new users");
                setIsSaving(false);
                return;
            }

            if (isEditMode) {
                await adminService.updateUser(id, payload);
                toast.success("User updated successfully");
            } else {
                await adminService.createUser(payload);
                toast.success("User created successfully");
            }
            navigate('/employees');
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Operation failed");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <MobileDashboardLayout title={isEditMode ? "Edit Employee" : "Add Employee"}>
                <div className="p-8 text-center text-slate-500">Loading...</div>
            </MobileDashboardLayout>
        );
    }

    const SaveButton = (
        <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
        >
            {isSaving ? (
                <Loader2 className="animate-spin" size={16} />
            ) : (
                <>
                    <Save size={16} />
                    <span>Save</span>
                </>
            )}
        </button>
    );

    return (
        <MobileDashboardLayout 
            title={isEditMode ? "Edit Employee" : "Add Employee"} 
            hideSidebar={true}
            showBackButton={true}
            headerAction={SaveButton}
        >
            <form onSubmit={handleSubmit} className="space-y-6 pb-20 relative min-h-screen p-4">


                {/* Form Card */}
                <div className="space-y-6">

                    {/* PROFILE IMAGE (ONLY VISIBLE IN EDIT MODE) */}
                    {isEditMode && (
                        <div className="mb-8 flex flex-col items-center">
                            <div className="relative group">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-24 h-24 rounded-full bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-3xl font-bold border-4 border-white dark:border-github-dark-border shadow-lg overflow-hidden cursor-pointer shrink-0"
                                >
                                    {formData.profile_image_url ? (
                                        <img src={`${formData.profile_image_url}?t=${imageTimestamp}`} alt={formData.user_name} className="w-full h-full object-cover" />
                                    ) : (
                                        (formData.user_name || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center border-[3px] border-white dark:border-github-dark-border shadow-md transition-transform active:scale-95"
                                >
                                    {uploading ? (
                                        <Loader2 className="animate-spin" size={14} />
                                    ) : (
                                        <Camera size={14} />
                                    )}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-3 font-medium text-center">Tap to change display picture</p>
                        </div>
                    )}

                    {/* PERSONAL INFORMATION */}
                    <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border p-5 rounded-3xl shadow-xl shadow-indigo-500/5 mb-6">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                            <User size={14} className="text-indigo-500" /> Personal Information
                        </h3>

                        <div className="flex flex-col gap-4">
                            {/* Full Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                                <input
                                    type="text"
                                    name="user_name"
                                    placeholder="Enter full name"
                                    value={formData.user_name}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/50 border ${
                                        touched.user_name && errors.user_name 
                                            ? 'border-rose-500 focus:ring-rose-500/20' 
                                            : 'border-slate-100 dark:border-github-dark-border focus:ring-indigo-500/20'
                                    } rounded-xl focus:outline-none focus:ring-2 text-sm text-slate-800 dark:text-github-dark-text transition-all`}
                                    required
                                />
                                {touched.user_name && errors.user_name && (
                                    <p className="text-[10px] text-rose-500 mt-1 ml-1 animate-in fade-in duration-200">
                                        {errors.user_name}
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="user_password"
                                        placeholder="Enter password"
                                        value={formData.user_password}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        className={`w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/50 border ${
                                            touched.user_password && errors.user_password 
                                                ? 'border-rose-500 focus:ring-rose-500/20' 
                                                : 'border-slate-100 dark:border-github-dark-border focus:ring-indigo-500/20'
                                        } rounded-xl focus:outline-none focus:ring-2 text-sm text-slate-800 dark:text-github-dark-text transition-all`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {touched.user_password && errors.user_password && (
                                    <p className="text-[10px] text-rose-500 mt-1 ml-1 animate-in fade-in duration-200">
                                        {errors.user_password}
                                    </p>
                                )}
                            </div>

                            {/* Email */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Enter email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/50 border ${
                                        touched.email && errors.email 
                                            ? 'border-rose-500 focus:ring-rose-500/20' 
                                            : 'border-slate-100 dark:border-github-dark-border focus:ring-indigo-500/20'
                                    } rounded-xl focus:outline-none focus:ring-2 text-sm text-slate-800 dark:text-github-dark-text transition-all`}
                                />
                                {touched.email && errors.email && (
                                    <p className="text-[10px] text-rose-500 mt-1 ml-1 animate-in fade-in duration-200">
                                        {errors.email}
                                    </p>
                                )}
                            </div>

                            {/* Phone */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone_no"
                                    placeholder="Enter phone number"
                                    value={formData.phone_no}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/50 border ${
                                        touched.phone_no && errors.phone_no 
                                            ? 'border-rose-500 focus:ring-rose-500/20' 
                                            : 'border-slate-100 dark:border-github-dark-border focus:ring-indigo-500/20'
                                    } rounded-xl focus:outline-none focus:ring-2 text-sm text-slate-800 dark:text-github-dark-text transition-all`}
                                />
                                {touched.phone_no && errors.phone_no && (
                                    <p className="text-[10px] text-rose-500 mt-1 ml-1 animate-in fade-in duration-200">
                                        {errors.phone_no}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* WORK DETAILS */}
                    <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border p-5 rounded-3xl shadow-xl shadow-indigo-500/5 mb-6">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                            <Briefcase size={14} className="text-indigo-500" /> Work Details
                        </h3>

                        <div className="flex flex-col gap-4">
                            {/* Department */}
                            <div className="space-y-1.5 relative" ref={deptContainerRef}>
                                <div className="flex items-center justify-between mb-1 px-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Department</label>
                                    <button
                                        type="button"
                                        onClick={() => toggleQuickAdd('dept')}
                                        className="text-indigo-500 hover:text-indigo-600 transition-colors"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    <QuickAddPopover
                                        isOpen={activePopover === 'dept'}
                                        title="New Department"
                                        onAdd={handleAddDepartment}
                                        onClose={() => setActivePopover(null)}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleDeptDropdown}
                                    className="w-full pl-3 pr-10 py-2.5 text-left text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 flex items-center justify-between cursor-pointer text-slate-800 dark:text-github-dark-text"
                                >
                                    <span className="truncate">
                                        {departments.find(d => String(d.dept_id) === String(formData.dept_id))?.dept_name || "Select Department"}
                                    </span>
                                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                </button>

                                {isDeptOpen && (
                                    <div className="absolute z-50 left-0 right-0 mt-1 p-2 bg-white dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="px-2 pb-2 pt-1">
                                            <input
                                                type="text"
                                                value={deptSearchQuery}
                                                onChange={(e) => setDeptSearchQuery(e.target.value)}
                                                placeholder="Search departments..."
                                                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleChange({ target: { name: 'dept_id', value: '' } });
                                                    setIsDeptOpen(false);
                                                    setDeptSearchQuery('');
                                                }}
                                                className={`w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center ${
                                                    !formData.dept_id ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
                                                }`}
                                            >
                                                Select Department
                                            </button>
                                            {departments
                                                .filter(d => d.dept_name.toLowerCase().includes(deptSearchQuery.toLowerCase()))
                                                .map(d => {
                                                    const isSelected = String(d.dept_id) === String(formData.dept_id);
                                                    return (
                                                        <button
                                                            key={d.dept_id}
                                                            type="button"
                                                            onClick={() => {
                                                                handleChange({ target: { name: 'dept_id', value: d.dept_id } });
                                                                setIsDeptOpen(false);
                                                                setDeptSearchQuery('');
                                                            }}
                                                            className={`w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center ${
                                                                isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            <span>{d.dept_name}</span>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Designation */}
                            <div className="space-y-1.5 relative" ref={desgContainerRef}>
                                <div className="flex items-center justify-between mb-1 px-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Designation / Role</label>
                                    <button
                                        type="button"
                                        onClick={() => toggleQuickAdd('desg')}
                                        className="text-indigo-500 hover:text-indigo-600 transition-colors"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    <QuickAddPopover
                                        isOpen={activePopover === 'desg'}
                                        title="New Designation"
                                        onAdd={handleAddDesignation}
                                        onClose={() => setActivePopover(null)}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleDesgDropdown}
                                    className="w-full pl-3 pr-10 py-2.5 text-left text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 flex items-center justify-between cursor-pointer text-slate-800 dark:text-github-dark-text"
                                >
                                    <span className="truncate">
                                        {designations.find(d => String(d.desg_id) === String(formData.desg_id))?.desg_name || "Select Role"}
                                    </span>
                                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                </button>

                                {isDesgOpen && (
                                    <div className="absolute z-50 left-0 right-0 mt-1 p-2 bg-white dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="px-2 pb-2 pt-1">
                                            <input
                                                type="text"
                                                value={desgSearchQuery}
                                                onChange={(e) => setDesgSearchQuery(e.target.value)}
                                                placeholder="Search designations..."
                                                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleChange({ target: { name: 'desg_id', value: '' } });
                                                    setIsDesgOpen(false);
                                                    setDesgSearchQuery('');
                                                }}
                                                className={`w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center ${
                                                    !formData.desg_id ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
                                                }`}
                                            >
                                                Select Role
                                            </button>
                                            {designations
                                                .filter(d => d.desg_name.toLowerCase().includes(desgSearchQuery.toLowerCase()))
                                                .map(d => {
                                                    const isSelected = String(d.desg_id) === String(formData.desg_id);
                                                    return (
                                                        <button
                                                            key={d.desg_id}
                                                            type="button"
                                                            onClick={() => {
                                                                handleChange({ target: { name: 'desg_id', value: d.desg_id } });
                                                                setIsDesgOpen(false);
                                                                setDesgSearchQuery('');
                                                            }}
                                                            className={`w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center ${
                                                                isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            <span>{d.desg_name}</span>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Shift Time */}
                            <div className="space-y-1.5 relative" ref={shiftContainerRef}>
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Shift Time</label>
                                <button
                                    type="button"
                                    onClick={toggleShiftDropdown}
                                    className="w-full pl-3 pr-10 py-2.5 text-left text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 flex items-center justify-between cursor-pointer text-slate-800 dark:text-github-dark-text"
                                >
                                    <span className="truncate">
                                        {shifts.find(s => String(s.shift_id) === String(formData.shift_id))?.shift_name || "Select Shift"}
                                    </span>
                                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                </button>

                                {isShiftOpen && (
                                    <div className="absolute z-50 left-0 right-0 top-full mt-1 p-2 bg-white dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="px-2 pb-2 pt-1">
                                            <input
                                                type="text"
                                                value={shiftSearchQuery}
                                                onChange={(e) => setShiftSearchQuery(e.target.value)}
                                                placeholder="Search shifts..."
                                                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleChange({ target: { name: 'shift_id', value: '' } });
                                                    setIsShiftOpen(false);
                                                    setShiftSearchQuery('');
                                                }}
                                                className={`w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center ${
                                                    !formData.shift_id ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
                                                }`}
                                            >
                                                Select Shift
                                            </button>
                                            {shifts
                                                .filter(s => s.shift_name.toLowerCase().includes(shiftSearchQuery.toLowerCase()))
                                                .map(s => {
                                                    const isSelected = String(s.shift_id) === String(formData.shift_id);
                                                    return (
                                                        <button
                                                            key={s.shift_id}
                                                            type="button"
                                                            onClick={() => {
                                                                handleChange({ target: { name: 'shift_id', value: s.shift_id } });
                                                                setIsShiftOpen(false);
                                                                setShiftSearchQuery('');
                                                            }}
                                                            className={`w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center ${
                                                                isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            <span>{s.shift_name}</span>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* User Type */}
                            <div className="space-y-1.5 relative" ref={userTypeContainerRef}>
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">User Type</label>
                                <button
                                    type="button"
                                    onClick={toggleUserTypeDropdown}
                                    className="w-full pl-3 pr-10 py-2.5 text-left text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 flex items-center justify-between cursor-pointer text-slate-800 dark:text-github-dark-text capitalize"
                                >
                                    <span>{formData.user_type}</span>
                                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                </button>

                                {isUserTypeOpen && (
                                    <div className="absolute z-50 left-0 right-0 top-full mt-1 p-2 bg-white dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleChange({ target: { name: 'user_type', value: 'employee' } });
                                                    setIsUserTypeOpen(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center ${
                                                    formData.user_type === 'employee' ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                Employee
                                            </button>
                                            {currentUser?.user_type === 'admin' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleChange({ target: { name: 'user_type', value: 'hr' } });
                                                        setIsUserTypeOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center ${
                                                        formData.user_type === 'hr' ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                                                    }`}
                                                >
                                                    HR
                                                </button>
                                            )}
                                            {formData.user_type === 'admin' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleChange({ target: { name: 'user_type', value: 'admin' } });
                                                        setIsUserTypeOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center ${
                                                        formData.user_type === 'admin' ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                                                    }`}
                                                >
                                                    Admin
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                </div>

            </form>
        </MobileDashboardLayout>
    );
};

export default EmployeeForm;
