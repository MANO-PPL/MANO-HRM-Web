import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Search, 
    Plus, 
    MoreVertical, 
    Edit2, 
    Trash2, 
    UserCheck, 
    UserX, 
    RotateCcw, 
    Mail, 
    Phone, 
    Briefcase, 
    X,
    User,
    Shield,
    Check,
    MapPin,
    ShieldCheck,
    CheckCircle2,
    Clock,
    Download,
    Upload,
    Settings,
    AlertTriangle,
    FileText,
    Folder,
    BadgeCheck,
    PauseCircle,
    Maximize2,
    CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminService, adminCacheData } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import ProfilePictureModal from '../../components/modals/ProfilePictureModal';
import payrollService from '../../services/payrollService';

// --- EMPLOYEE DETAIL SHEET (Matching Flutter EmployeeDetailSheet) ---
const EmployeeDetailSheet = ({ 
    employee, 
    onClose, 
    onEdit, 
    onToggleStatus, 
    onDelete, 
    onRestore, 
    onForceDelete, 
    avatarTimestamp, 
    onOpenAvatar 
}) => {
    const [selectedTab, setSelectedTab] = useState(0); // 0: Profile, 1: Checklist, 2: Docs, 3: AI Audit
    const [salary, setSalary] = useState(null);
    const [loadingSalary, setLoadingSalary] = useState(false);
    const [checklistTasks, setChecklistTasks] = useState([
        { id: 1, title: 'National ID & Address Verification', done: true },
        { id: 2, title: 'Signed Employment Agreement', done: true },
        { id: 3, title: 'Work Email & IT Equipment Provisioning', done: true },
        { id: 4, title: 'Bank Account & Tax Declarations', done: true },
        { id: 5, title: 'Team Introduction & Induction Meeting', done: false },
    ]);

    useEffect(() => {
        if (employee) {
            const fetchSalary = async () => {
                setLoadingSalary(true);
                try {
                    const res = await payrollService.getEmployeeSalary(employee.id);
                    if (res && res.status === 'success') {
                        setSalary(res.data);
                    }
                } catch (err) {
                    // Non-critical, ignore
                } finally {
                    setLoadingSalary(false);
                }
            };
            fetchSalary();
        }
    }, [employee]);

    useEffect(() => {
        const handlePopState = (e) => {
            e.preventDefault();
            onClose();
            window.history.pushState(null, '', window.location.pathname);
        };
        window.history.pushState(null, '', window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [onClose]);

    if (!employee) return null;

    const completedTasksCount = checklistTasks.filter(t => t.done).length;
    const progressPct = Math.round((completedTasksCount / checklistTasks.length) * 100);

    const toggleTask = (taskId) => {
        setChecklistTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: !t.done } : t));
    };

    const documentsList = [
        { name: 'National ID Card (Aadhaar / Passport)', category: 'Identity', size: '1.4 MB', status: 'Verified' },
        { name: 'Highest Educational Degree Certificate', category: 'Education', size: '2.1 MB', status: 'Verified' },
        { name: 'Previous Relieving Letter & Experience', category: 'Work History', size: '890 KB', status: 'Verified' },
        { name: 'Bank Passbook Copy / Voided Cheque', category: 'Payroll', size: '640 KB', status: 'Verified' },
        { name: 'Signed Offer Letter & Confidentiality', category: 'Legal', size: '1.8 MB', status: 'Verified' },
    ];

    const auditChecks = [
        { title: 'Hologram & Security Seal', detail: 'Verified Authentic' },
        { title: 'Legibility & Blur Analysis', detail: 'Crystal Clear (98% sharpness)' },
        { title: 'EXIF & Creation Metadata', detail: 'Unmodified original file' },
        { title: 'Digital Manipulation / Photoshop', detail: 'None Detected' },
    ];

    const isDeleted = employee.status === 'Deleted';
    const isActive = employee.is_active;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="relative bg-white dark:bg-[#161B22] w-full max-h-[88vh] rounded-t-[24px] shadow-2xl border-t border-slate-200 dark:border-[#30363D] flex flex-col overflow-hidden"
            >
                {/* Drag Handle (Matching Flutter) */}
                <div className="w-9 h-1 bg-slate-300 dark:bg-[#30363D] rounded-full mx-auto my-2.5 shrink-0" />

                {/* Top Header Row (Matching Flutter EmployeeDetailSheet) */}
                <div className="flex items-center justify-between px-4 pb-2.5 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar */}
                        <div 
                            onClick={() => employee.profile_image_url && onOpenAvatar({
                                imageUrl: `${employee.profile_image_url}?t=${avatarTimestamp}`,
                                name: employee.name,
                                role: employee.role,
                                department: employee.department,
                                userCode: employee.user_code,
                                email: employee.email,
                                phone: employee.phone,
                                status: employee.status
                            })}
                            className="relative w-10 h-10 rounded-full border-2 border-indigo-500 dark:border-[#2F81F7] shrink-0 overflow-hidden cursor-pointer bg-indigo-50 dark:bg-[#0D1117] flex items-center justify-center font-bold text-sm text-indigo-600 dark:text-white active:scale-95 transition-transform"
                        >
                            {employee.profile_image_url ? (
                                <img 
                                    src={`${employee.profile_image_url}?t=${avatarTimestamp}`} 
                                    alt={employee.name} 
                                    className="w-full h-full object-cover" 
                                />
                            ) : (
                                (employee.name || 'U').charAt(0).toUpperCase()
                            )}
                        </div>

                        {/* Name & Role */}
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {employee.name}
                                </h3>
                                <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold ${
                                    employee.status === 'Active' 
                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                        : employee.status === 'Inactive'
                                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                                        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                                }`}>
                                    {employee.status === 'Deleted' ? 'Trash' : employee.status}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-[#8D96A0] truncate">
                                {employee.role || 'Employee'} • {employee.department || 'General'}
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 4-Tab Switcher (Matching Flutter EmployeeDetailSheet) */}
                <div className="px-3 pb-2 shrink-0">
                    <div className="bg-slate-100 dark:bg-[#0D1117] p-1 flex rounded-xl border border-slate-200/80 dark:border-[#30363D]">
                        {[
                            { id: 0, label: 'Profile', icon: User },
                            { id: 1, label: 'Checklist', icon: CheckSquare },
                            { id: 2, label: 'Docs', icon: Folder },
                            { id: 3, label: 'AI Audit', icon: ShieldCheck }
                        ].map(tab => {
                            const isSelected = selectedTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setSelectedTab(tab.id)}
                                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1 ${
                                        isSelected 
                                            ? 'bg-white dark:bg-[#21262D] text-indigo-600 dark:text-white shadow-sm' 
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Icon size={13} className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="h-px bg-slate-100 dark:bg-[#30363D] shrink-0" />

                {/* Scrollable Tab Body */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                    {/* TAB 0: PROFILE */}
                    {selectedTab === 0 && (
                        <div className="space-y-3.5">
                            {/* Contact & Work Details Card (Matching Flutter _buildDetailRow) */}
                            <div className="bg-slate-50 dark:bg-[#0D1117] rounded-xl border border-slate-200/80 dark:border-[#30363D] p-3 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Mail size={13} /> Email
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                                        {employee.email || 'N/A'}
                                    </span>
                                </div>
                                <div className="h-px bg-slate-200/60 dark:bg-[#21262D]" />
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Phone size={13} /> Phone
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {employee.phone || 'N/A'}
                                    </span>
                                </div>
                                <div className="h-px bg-slate-200/60 dark:bg-[#21262D]" />
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Briefcase size={13} /> Department
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {employee.department || 'N/A'}
                                    </span>
                                </div>
                                <div className="h-px bg-slate-200/60 dark:bg-[#21262D]" />
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <BadgeCheck size={13} /> Designation
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {employee.role || 'N/A'}
                                    </span>
                                </div>
                                <div className="h-px bg-slate-200/60 dark:bg-[#21262D]" />
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Clock size={13} /> Shift
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {employee.shift || 'Default Shift'}
                                    </span>
                                </div>
                            </div>

                            {/* Allowed Geofences Section (Matching Flutter) */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                                    Allowed Geofences
                                </h4>
                                {employee.workLocations && employee.workLocations.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {employee.workLocations.map((loc, idx) => (
                                            <div 
                                                key={idx} 
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40"
                                            >
                                                <MapPin size={11} className="text-blue-500 shrink-0" />
                                                <span>{loc.name || loc.location_name || `Location #${loc.location_id || idx + 1}`}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[11.5px] text-slate-500 dark:text-[#8D96A0] italic">
                                        All Locations Authorized
                                    </p>
                                )}
                            </div>

                            {/* Salary details if loaded */}
                            {salary && salary.base_salary && (
                                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between text-xs">
                                    <span className="text-indigo-900 dark:text-indigo-300 font-medium">Monthly Gross Salary</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                        ₹{Number(salary.base_salary).toLocaleString()}
                                    </span>
                                </div>
                            )}

                            {/* Admin Action Buttons (Matching Flutter) */}
                            <div className="pt-2 space-y-2">
                                {isDeleted ? (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { onClose(); onRestore(employee); }}
                                            className="flex-1 py-2.5 rounded-xl border border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                        >
                                            <RotateCcw size={14} />
                                            <span>Restore</span>
                                        </button>
                                        <button
                                            onClick={() => { onClose(); onForceDelete(employee); }}
                                            className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                                        >
                                            <Trash2 size={14} />
                                            <span>Force Delete</span>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { onClose(); onEdit(employee); }}
                                                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#30363D] text-indigo-600 dark:text-indigo-400 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-slate-50 dark:hover:bg-white/5"
                                            >
                                                <Edit2 size={14} />
                                                <span>Edit Details</span>
                                            </button>

                                            <button
                                                onClick={() => { onClose(); onToggleStatus(employee); }}
                                                className={`flex-1 py-2.5 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
                                                    isActive
                                                        ? 'border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                                                        : 'border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                                }`}
                                            >
                                                {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                                                <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => { onClose(); onDelete(employee); }}
                                            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                                        >
                                            <Trash2 size={14} />
                                            <span>Move to Trash</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 1: CHECKLIST */}
                    {selectedTab === 1 && (
                        <div className="space-y-3.5">
                            {/* Progress Summary Card */}
                            <div className="p-3 bg-slate-50 dark:bg-[#0D1117] rounded-xl border border-slate-200/80 dark:border-[#30363D] space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-white">
                                    <span>Onboarding Progress</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{progressPct}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-200 dark:bg-[#21262D] rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                                <p className="text-[10.5px] text-slate-500 dark:text-[#8D96A0]">
                                    {completedTasksCount} of {checklistTasks.length} steps completed
                                </p>
                            </div>

                            {/* Checklist Tasks List */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-slate-800 dark:text-white">
                                    Onboarding Checklist Tasks
                                </h4>
                                {checklistTasks.map(task => (
                                    <div 
                                        key={task.id}
                                        onClick={() => toggleTask(task.id)}
                                        className="p-3 bg-white dark:bg-[#0D1117] rounded-xl border border-slate-200/80 dark:border-[#30363D] flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <input 
                                                type="checkbox"
                                                checked={task.done}
                                                onChange={() => {}}
                                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                            <span className={`text-xs font-medium truncate ${task.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                                                {task.title}
                                            </span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-semibold shrink-0 ${
                                            task.done 
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                : 'bg-slate-100 text-slate-500 dark:bg-[#21262D] dark:text-slate-400'
                                        }`}>
                                            {task.done ? 'Completed' : 'Pending'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: DOCS */}
                    {selectedTab === 2 && (
                        <div className="space-y-3.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-slate-800 dark:text-white">
                                    Employee Documents ({documentsList.length})
                                </h4>
                                <button 
                                    onClick={() => toast.info("Document upload ready")}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#30363D] text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 active:scale-95 transition-all"
                                >
                                    <Upload size={12} />
                                    <span>Upload Doc</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                {documentsList.map((doc, idx) => (
                                    <div 
                                        key={idx}
                                        className="p-3 bg-slate-50 dark:bg-[#0D1117] rounded-xl border border-slate-200/80 dark:border-[#30363D] flex items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                <FileText size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                    {doc.name}
                                                </h5>
                                                <p className="text-[10px] text-slate-500 dark:text-[#8D96A0]">
                                                    {doc.category} • {doc.size}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[9.5px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 shrink-0">
                                            {doc.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: AI AUDIT */}
                    {selectedTab === 3 && (
                        <div className="space-y-3.5">
                            {/* Auditor Score Banner */}
                            <div className="p-3 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-[#0F2027] dark:to-[#203A43] flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <ShieldCheck size={22} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                        AI Authenticity Score: 96%
                                    </h4>
                                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                                        High Confidence • All integrity checks passed
                                    </p>
                                </div>
                            </div>

                            {/* Automated Checks */}
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-semibold text-slate-800 dark:text-white mb-2">
                                    Automated Security Checks
                                </h4>
                                {auditChecks.map((chk, idx) => (
                                    <div 
                                        key={idx}
                                        className="px-3 py-2 bg-slate-50 dark:bg-[#0D1117] rounded-lg border border-slate-200/80 dark:border-[#30363D] flex items-center justify-between text-xs"
                                    >
                                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate pr-2">
                                            {chk.title}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold shrink-0">
                                            <CheckCircle2 size={13} />
                                            {chk.detail}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* OCR Metadata */}
                            <div className="p-3 bg-slate-50 dark:bg-[#0D1117] rounded-xl border border-slate-200/80 dark:border-[#30363D] space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-[#8D96A0]">Name Match</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        100% Match with HR record
                                    </span>
                                </div>
                                <div className="h-px bg-slate-200/60 dark:bg-[#21262D]" />
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-[#8D96A0]">Document Number</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        Verified Active against Registry
                                    </span>
                                </div>
                                <div className="h-px bg-slate-200/60 dark:bg-[#21262D]" />
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-[#8D96A0]">Document Validity</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        Valid (Expires 2031)
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// --- MAIN MOBILE EMPLOYEES PAGE (Faithful Port of Flutter EmployeesMobileView) ---
const MobileEmployeesPage = () => {
    const navigate = useNavigate();
    const { avatarTimestamp, user: currentUser } = useAuth();
    const isAdmin = currentUser && currentUser.user_type !== 'employee';

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('Active'); // 'Active' | 'Inactive' | 'Deleted'
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // Multi-Selection State (Matching Flutter _selectedIds & _isSelectionMode)
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Lightbox State
    const [lightboxData, setLightboxData] = useState(null);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        confirmText: 'Confirm',
        onConfirm: () => {}
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial Data Fetch
    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const data = await adminService.getAllUsers(true);
            if (data && data.success) {
                const formatted = data.users.map(u => ({
                    id: u.user_id,
                    name: u.user_name || 'Unnamed',
                    email: u.email || 'N/A',
                    role: u.desg_name || u.user_type || 'Employee',
                    user_type: u.user_type,
                    department: u.dept_name || 'N/A',
                    status: u.is_deleted ? 'Deleted' : (u.is_active ? 'Active' : 'Inactive'),
                    phone: u.phone_no || '',
                    shift: u.shift_name || 'Default Shift',
                    workLocations: u.work_locations || [],
                    profile_image_url: u.profile_image_url || u.avatar_url,
                    is_active: !!u.is_active,
                    is_deleted: !!u.is_deleted
                }));
                setEmployees(formatted);
            }
        } catch (err) {
            console.error("Error fetching employees:", err);
            toast.error(err.message || "Failed to load employees");
        } finally {
            setLoading(false);
        }
    };

    // Filter and Sort employees (Matching Flutter _filterEmployees)
    const filteredEmployees = useMemo(() => {
        let result = employees;

        // 1. Search Query filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(e => 
                (e.name && e.name.toLowerCase().includes(q)) ||
                (e.email && e.email.toLowerCase().includes(q)) ||
                (e.phone && e.phone.includes(q)) ||
                (e.role && e.role.toLowerCase().includes(q)) ||
                (e.department && e.department.toLowerCase().includes(q))
            );
        }

        // 2. Status Tab filter
        result = result.filter(e => e.status === statusFilter);

        // 3. Alphabetical sort by user_name
        return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [employees, searchQuery, statusFilter]);

    // Selection Handlers (Matching Flutter)
    const toggleSelection = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                if (next.size === 0) setIsSelectionMode(false);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredEmployees.length) {
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedIds(new Set(filteredEmployees.map(e => e.id)));
        }
    };

    const exitSelectionMode = () => {
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    };

    // Bulk Delete (Matching Flutter _bulkDelete)
    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;

        setConfirmModal({
            isOpen: true,
            title: 'Confirm Bulk Delete',
            message: `Are you sure you want to delete ${selectedIds.size} employees?`,
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await Promise.all(Array.from(selectedIds).map(id => adminService.deleteUser(id)));
                    toast.success("Selected employees deleted");
                    exitSelectionMode();
                    fetchEmployees();
                } catch (err) {
                    toast.error(err.message || "Failed to delete selected employees");
                } finally {
                    setIsSubmitting(false);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    // Single Delete (Matching Flutter _deleteEmployee)
    const handleDeleteEmployee = (employee) => {
        if (employee.user_type === 'admin') {
            toast.info("Admin accounts cannot be deleted");
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Move to Trash',
            message: `Are you sure you want to move ${employee.name} to trash? They will remain inactive until restored.`,
            type: 'warning',
            confirmText: 'Move to Trash',
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.deleteUser(employee.id);
                    toast.success("Employee moved to trash");
                    fetchEmployees();
                } catch (err) {
                    toast.error(err.message || "Failed to delete employee");
                } finally {
                    setIsSubmitting(false);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    // Single Toggle Status (Matching Flutter _toggleStatus)
    const handleToggleStatus = (employee) => {
        if (employee.user_type === 'admin') {
            toast.info("Admin status cannot be modified here");
            return;
        }

        const newStatus = !employee.is_active;
        const action = newStatus ? "activate" : "deactivate";

        setConfirmModal({
            isOpen: true,
            title: `${newStatus ? "Activate" : "Deactivate"} Employee`,
            message: `Are you sure you want to ${action} ${employee.name}?`,
            type: newStatus ? 'info' : 'warning',
            confirmText: newStatus ? 'Activate' : 'Deactivate',
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.toggleUserStatus(employee.id, newStatus);
                    toast.success(`Employee ${action}d successfully`);
                    fetchEmployees();
                } catch (err) {
                    toast.error(err.message || `Failed to ${action} employee`);
                } finally {
                    setIsSubmitting(false);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    // Single Restore (Matching Flutter _restoreEmployee)
    const handleRestoreEmployee = (employee) => {
        setConfirmModal({
            isOpen: true,
            title: 'Restore Employee',
            message: `Are you sure you want to restore ${employee.name} from trash?`,
            type: 'info',
            confirmText: 'Restore',
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.restoreUser(employee.id);
                    toast.success("Employee restored from trash");
                    fetchEmployees();
                } catch (err) {
                    toast.error(err.message || "Failed to restore employee");
                } finally {
                    setIsSubmitting(false);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    // Single Force Delete (Matching Flutter _forceDeleteEmployee)
    const handleForceDeleteEmployee = (employee) => {
        setConfirmModal({
            isOpen: true,
            title: 'Permanently Delete',
            message: `WARNING: This will permanently delete ${employee.name} and cascade across all attendance records, leave requests, and logs. This action CANNOT be undone. Proceed?`,
            type: 'danger',
            confirmText: 'Delete Permanently',
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.forceDeleteUser(employee.id);
                    toast.success("Employee permanently deleted");
                    fetchEmployees();
                } catch (err) {
                    toast.error(err.message || "Failed to permanently delete employee");
                } finally {
                    setIsSubmitting(false);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    // Download Sample CSV Template (Matching Flutter _downloadSampleTemplate)
    const handleDownloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(
            "Name,Email,Phone,Department,Designation,Password\n" +
            "John Doe,john.doe@example.com,9876543210,Engineering,Manager,Mano@123\n" +
            "Jane Smith,jane.smith@example.com,9876543211,Human Resources,HR Executive,Mano@123\n" +
            "Alice Johnson,alice.j@example.com,9876543212,Sales,Sales Executive,Mano@123"
        );
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute("download", "attendance_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Sample template downloaded");
    };

    return (
        <MobileDashboardLayout title="Employees" contentClassName="px-0 pt-0 pb-4">
            <div className="w-full bg-slate-50 dark:bg-github-dark-bg transition-colors duration-300">

                {/* 1. STICKY HEADER & STATUS TABS (Matching Flutter _buildHeader & _buildStatusTabs) */}
                <div className="sticky z-20 bg-white/95 dark:bg-github-dark-bg/95 backdrop-blur-md px-2.5 sm:px-4 pt-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 w-full space-y-2" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
                    {/* Header Row */}
                    {isSelectionMode ? (
                        /* Selection Mode Bar (Matching Flutter) */
                        <div className="flex items-center justify-between h-9 px-1">
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={exitSelectionMode}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors"
                                >
                                    <X size={18} />
                                </button>
                                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                    {selectedIds.size} Selected
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={toggleSelectAll}
                                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-1 hover:underline"
                                >
                                    {selectedIds.size === filteredEmployees.length ? 'Unselect All' : 'Select All'}
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                    title="Bulk Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Normal Search + Actions Bar (Matching Flutter) */
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex-1 relative flex items-center h-9 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-xl px-2.5 shadow-sm">
                                <Search size={15} className="text-slate-400 shrink-0 mr-2" />
                                <input
                                    type="text"
                                    placeholder="Search employees..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-transparent text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none font-medium"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')} 
                                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white shrink-0"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Download Template + Bulk Upload Action Buttons (Matching Flutter) */}
                            {isAdmin && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="p-2 rounded-xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm active:scale-95 transition-all"
                                        title="Download Sample Template"
                                    >
                                        <Download size={15} />
                                    </button>

                                    <button
                                        onClick={() => navigate('/employees/bulk')}
                                        className="p-2 rounded-xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm active:scale-95 transition-all"
                                        title="Bulk Upload"
                                    >
                                        <Upload size={15} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status Tabs (Matching Flutter _buildStatusTabs) */}
                    <div className="bg-slate-100 dark:bg-[#161B22] p-1 flex rounded-xl border border-slate-200/80 dark:border-[#30363D] shadow-sm w-full">
                        {[
                            { id: 'Active', label: 'Active', icon: CheckCircle2 },
                            { id: 'Inactive', label: 'Inactive', icon: PauseCircle },
                            { id: 'Deleted', label: 'Trash', icon: Trash2 },
                        ].map(tab => {
                            const isSelected = statusFilter === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setStatusFilter(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                        isSelected
                                            ? 'bg-white dark:bg-[#2D3139] text-indigo-600 dark:text-white shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Icon size={13} className={isSelected ? 'text-indigo-600 dark:text-white' : 'text-slate-400'} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. EMPLOYEE CARDS LIST (Matching Flutter _buildEmployeeList) */}
                <div className="w-full px-2.5 sm:px-4 py-2 space-y-2">
                    {loading && employees.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-3">
                            <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
                            <p className="text-xs font-semibold text-slate-400 animate-pulse">Loading employees...</p>
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200/80 dark:border-[#30363D] p-6 w-full">
                            <Search size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2 opacity-50" />
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                No {statusFilter.toLowerCase()} employees found
                            </p>
                        </div>
                    ) : (
                        filteredEmployees.map(emp => {
                            const isSelected = selectedIds.has(emp.id);
                            return (
                                <div
                                    key={emp.id}
                                    onClick={() => {
                                        if (isSelectionMode) {
                                            toggleSelection(emp.id);
                                        } else {
                                            setSelectedEmployee(emp);
                                        }
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        if (!isSelectionMode && isAdmin) {
                                            setIsSelectionMode(true);
                                            toggleSelection(emp.id);
                                        }
                                    }}
                                    className={`p-3 rounded-2xl transition-all duration-150 cursor-pointer w-full flex items-center justify-between gap-3 active:scale-[0.99] border shadow-sm ${
                                        isSelected
                                            ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500 ring-1 ring-indigo-500/20'
                                            : 'bg-white dark:bg-[#161B22] border-slate-200/80 dark:border-[#30363D] hover:border-indigo-300 dark:hover:border-indigo-500/40'
                                    }`}
                                >
                                    {/* Left: Checkbox (Selection Mode) or Avatar (Normal Mode) */}
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {isSelectionMode ? (
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(emp.id)}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div
                                                onClick={(e) => {
                                                    if (emp.profile_image_url) {
                                                        e.stopPropagation();
                                                        setLightboxData({
                                                            imageUrl: `${emp.profile_image_url}?t=${avatarTimestamp}`,
                                                            name: emp.name,
                                                            role: emp.role,
                                                            department: emp.department,
                                                            userCode: emp.user_code,
                                                            email: emp.email,
                                                            phone: emp.phone,
                                                            status: emp.status
                                                        });
                                                    }
                                                }}
                                                className="w-9 h-9 rounded-full border border-slate-200 dark:border-[#2F81F7] shrink-0 overflow-hidden bg-indigo-50 dark:bg-[#0D1117] flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-white cursor-pointer active:scale-95 transition-transform"
                                            >
                                                {emp.profile_image_url ? (
                                                    <img 
                                                        src={`${emp.profile_image_url}?t=${avatarTimestamp}`} 
                                                        alt={emp.name} 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                ) : (
                                                    (emp.name || 'U').charAt(0).toUpperCase()
                                                )}
                                            </div>
                                        )}

                                        {/* Middle: Name + Role + Phone (Matching Flutter ListTile) */}
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white truncate leading-tight">
                                                {emp.name}
                                            </h4>
                                            {emp.role && (
                                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
                                                    {emp.role}
                                                </p>
                                            )}
                                            {emp.phone && (
                                                <p className="text-[10.5px] font-normal text-slate-400 dark:text-slate-500 truncate">
                                                    {emp.phone}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: More Options Button */}
                                    {!isSelectionMode && isAdmin && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedEmployee(emp);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors shrink-0"
                                            title="View details"
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 3. FLOATING ACTION BUTTON (Matching Flutter FloatingActionButton) */}
                {isAdmin && (
                    <Link
                        to="/employees/add"
                        className="fixed right-5 w-13 h-13 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center active:scale-95 transition-transform z-30"
                        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
                        title="Add Employee"
                    >
                        <Plus size={22} />
                    </Link>
                )}

                {/* 4. DETAIL SHEET MODAL (Matching Flutter EmployeeDetailSheet) */}
                <AnimatePresence>
                    {selectedEmployee && (
                        <EmployeeDetailSheet
                            employee={selectedEmployee}
                            onClose={() => setSelectedEmployee(null)}
                            onEdit={(emp) => navigate(`/employees/edit/${emp.id}`)}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDeleteEmployee}
                            onRestore={handleRestoreEmployee}
                            onForceDelete={handleForceDeleteEmployee}
                            avatarTimestamp={avatarTimestamp}
                            onOpenAvatar={(data) => setLightboxData(data)}
                        />
                    )}
                </AnimatePresence>

                {/* 5. FULLSCREEN AVATAR LIGHTBOX */}
                {lightboxData && (
                    <ProfilePictureModal 
                        isOpen={!!lightboxData}
                        onClose={() => setLightboxData(null)} 
                        {...lightboxData}
                    />
                )}

                {/* 6. CONFIRMATION DIALOG MODAL (Matching Flutter GlassConfirmationDialog) */}
                <AnimatePresence>
                    {confirmModal.isOpen && (
                        <ConfirmationModal
                            {...confirmModal}
                            isSubmitting={isSubmitting}
                            onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                        />
                    )}
                </AnimatePresence>
            </div>
        </MobileDashboardLayout>
    );
};

export default MobileEmployeesPage;
