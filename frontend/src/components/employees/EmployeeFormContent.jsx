import React, { useState, useEffect, useRef } from 'react';
import { Save, X, User, Mail, Phone, Briefcase, Clock, Camera, Plus, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { adminService, adminCacheData } from '../../services/adminService';
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

const EmployeeFormContent = ({ userId, onSuccess, onCancel, isSidebarMode = false }) => {
    const { user: currentUser } = useAuth();
    const isEditMode = !!userId;

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
        profile_image: null,
        force_password_change: false
    });

    const [showPassword, setShowPassword] = useState(false);

    const [departments, setDepartments] = useState(() => adminCacheData.departments?.departments || []);
    const [designations, setDesignations] = useState(() => adminCacheData.designations?.designations || []);
    const [shifts, setShifts] = useState(() => adminCacheData.shifts?.shifts || []);
    const [isLoading, setIsLoading] = useState(() => {
        return !(adminCacheData.departments && adminCacheData.designations && adminCacheData.shifts);
    });
    const [isSaving, setIsSaving] = useState(false);
    const [activePopover, setActivePopover] = useState(null);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isShiftOpen, setIsShiftOpen] = useState(false);
    const [shiftSearchQuery, setShiftSearchQuery] = useState('');
    const [isDeptOpen, setIsDeptOpen] = useState(false);
    const [deptSearchQuery, setDeptSearchQuery] = useState('');
    const [isDesgOpen, setIsDesgOpen] = useState(false);
    const [desgSearchQuery, setDesgSearchQuery] = useState('');
    const [isUserTypeOpen, setIsUserTypeOpen] = useState(false);

    const deptContainerRef = useRef(null);
    const desgContainerRef = useRef(null);
    const shiftContainerRef = useRef(null);
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
                    const userRes = await adminService.getUserById(userId);
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
                            profile_image: u.profile_image_url || null,
                            force_password_change: u.force_password_change === 1 || u.force_password_change === true || u.force_password_change === 'true'
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
    }, [userId, isEditMode]);

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

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    profile_image: reader.result,
                    profile_image_file: file
                }));
            };
            reader.readAsDataURL(file);
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
                user_type: formData.user_type,
                force_password_change: formData.force_password_change
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
                await adminService.updateUser(userId, payload, formData.profile_image_file || null);
                toast.success("User updated successfully");
            } else {
                await adminService.createUser(payload, formData.profile_image_file || null);
                toast.success("User created successfully");
            }
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Operation failed");
        } finally {
            setIsSaving(false);
        }
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

    if (isLoading) return <div className="p-8 text-center text-slate-500 text-sm italic">Loading...</div>;

    return (
        <form 
            onSubmit={handleSubmit} 
            className={`flex flex-col ${
                isSidebarMode 
                    ? 'h-full bg-white dark:bg-dark-card' 
                    : 'space-y-6 w-full'
            }`}
        >
            {/* Header Actions */}
            <div className={`flex items-center justify-between ${isSidebarMode ? 'p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20 sticky top-0 z-10' : 'mb-8 pb-4 border-b border-slate-200 dark:border-github-dark-border'}`}>
                <button type="button" onClick={onCancel} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-slate-300 transition-colors">
                    <X size={18} />
                    <span className="text-sm font-bold uppercase tracking-wider">Cancel</span>
                </button>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-70 uppercase tracking-widest"
                >
                    <Save size={16} />
                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
            </div>

            <div className={`${isSidebarMode ? 'flex-1 overflow-y-auto p-5 custom-scrollbar' : ''}`}>
                <div className={`flex flex-col ${isSidebarMode ? 'gap-6' : 'md:flex-row-reverse items-center justify-center gap-8 xl:gap-16'}`}>
                    
                    {/* Profile Picture */}
                    <div className={`${isSidebarMode ? 'flex flex-col items-center mb-4' : 'w-full md:w-1/4 flex flex-col items-center justify-center'}`}>
                        <div className="relative group">
                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400 blur-2xl opacity-20 pointer-events-none ${isSidebarMode ? 'w-32 h-32' : 'w-48 h-48 md:w-56 md:h-56'}`}></div>
                            <div className={`relative rounded-full border-4 border-white dark:border-github-dark-border shadow-xl overflow-hidden bg-slate-100 dark:bg-github-dark-subtle flex items-center justify-center text-slate-400 z-10 ${isSidebarMode ? 'w-24 h-24' : 'w-48 h-48 md:w-48 md:h-48'}`}>
                                {formData.profile_image ? (
                                    <img src={formData.profile_image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={isSidebarMode ? 40 : 80} className="opacity-50" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-2 z-20 w-10 h-10 bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center cursor-pointer shadow-lg border border-slate-100 dark:border-github-dark-border hover:scale-110 transition-transform">
                                <Camera size={18} />
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className={`${isSidebarMode ? 'space-y-6' : 'w-full md:w-3/4 space-y-6'}`}>
                        {/* Section 1: Personal Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-1 bg-indigo-500 rounded-full"></div>
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Personal Info</h4>
                            </div>

                            <div className={`grid gap-4 ${isSidebarMode ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                                    <input
                                        type="text"
                                        name="user_name"
                                        value={formData.user_name}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        className={`w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border ${
                                            touched.user_name && errors.user_name 
                                                ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' 
                                                : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 focus:ring-indigo-500/20 focus:border-indigo-500'
                                        } rounded-xl outline-none transition-all text-slate-800 dark:text-github-dark-text`}
                                        required
                                    />
                                    {touched.user_name && errors.user_name && (
                                        <p className="text-[10px] text-rose-500 mt-1 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {errors.user_name}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="user_password"
                                            value={formData.user_password}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            placeholder={isEditMode ? "Leave blank to keep" : "Enter password"}
                                            className={`w-full pl-4 pr-12 py-2.5 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border ${
                                                touched.user_password && errors.user_password 
                                                    ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' 
                                                    : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 focus:ring-indigo-500/20 focus:border-indigo-500'
                                            } rounded-xl outline-none transition-all text-slate-800 dark:text-github-dark-text`}
                                            required={!isEditMode}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {touched.user_password && errors.user_password && (
                                        <p className="text-[10px] text-rose-500 mt-1 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {errors.user_password}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 px-1">
                                        <input
                                            type="checkbox"
                                            id="force_password_change"
                                            name="force_password_change"
                                            checked={formData.force_password_change}
                                            onChange={handleChange}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <label htmlFor="force_password_change" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                                            Force change on first login
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        className={`w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border ${
                                            touched.email && errors.email 
                                                ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' 
                                                : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 focus:ring-indigo-500/20 focus:border-indigo-500'
                                        } rounded-xl outline-none transition-all text-slate-800 dark:text-github-dark-text`}
                                    />
                                    {touched.email && errors.email && (
                                        <p className="text-[10px] text-rose-500 mt-1 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {errors.email}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Phone</label>
                                    <input
                                        type="tel"
                                        name="phone_no"
                                        value={formData.phone_no}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        className={`w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border ${
                                            touched.phone_no && errors.phone_no 
                                                ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' 
                                                : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 focus:ring-indigo-500/20 focus:border-indigo-500'
                                        } rounded-xl outline-none transition-all text-slate-800 dark:text-github-dark-text`}
                                    />
                                    {touched.phone_no && errors.phone_no && (
                                        <p className="text-[10px] text-rose-500 mt-1 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {errors.phone_no}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Work Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-1 bg-indigo-500 rounded-full"></div>
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Work Details</h4>
                            </div>

                            <div className={`grid gap-4 ${isSidebarMode ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                <div className="space-y-1.5 relative" ref={deptContainerRef}>
                                    <div className="flex items-center justify-between mb-1 px-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department</label>
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
                                        className="w-full pl-4 pr-10 py-2.5 text-left text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none flex items-center justify-between cursor-pointer text-slate-800 dark:text-github-dark-text"
                                    >
                                        <span className="truncate">
                                            {departments.find(d => String(d.dept_id) === String(formData.dept_id))?.dept_name || "Select Dept"}
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
                                                    Select Dept
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

                                <div className="space-y-1.5 relative" ref={desgContainerRef}>
                                    <div className="flex items-center justify-between mb-1 px-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Designation / Role</label>
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
                                        className="w-full pl-4 pr-10 py-2.5 text-left text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none flex items-center justify-between cursor-pointer text-slate-800 dark:text-github-dark-text"
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

                                <div className="space-y-1.5 relative" ref={shiftContainerRef}>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Shift Time</label>
                                    <button
                                        type="button"
                                        onClick={toggleShiftDropdown}
                                        className="w-full pl-4 pr-10 py-2.5 text-left text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none flex items-center justify-between cursor-pointer text-slate-800 dark:text-github-dark-text"
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

                                <div className="space-y-1.5 relative" ref={userTypeContainerRef}>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">User Type</label>
                                    <button
                                        type="button"
                                        onClick={toggleUserTypeDropdown}
                                        className="w-full pl-4 pr-10 py-2.5 text-left text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none flex items-center justify-between cursor-pointer text-slate-800 dark:text-github-dark-text"
                                    >
                                        <span className="truncate capitalize">
                                            {formData.user_type}
                                        </span>
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
                </div>
            </div>
        </form>
    );
};

export default EmployeeFormContent;
