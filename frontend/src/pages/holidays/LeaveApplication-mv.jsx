import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { leaveService } from '../../services/leaveService';
import DatePicker from '../../components/DatePicker';
import { toast } from 'react-toastify';
import {
    Calendar,
    Clock,
    CheckCircle,
    XCircle,
    FileText,
    ChevronDown,
    Loader2,
    Search,
    Plus,
    X,
    Paperclip,
    ExternalLink,
    Download,
    Image as ImageIcon,
    CalendarDays,
    Send,
    UserCheck,
    AlertCircle,
    Trash2,
    Shield,
    Check,
    Info,
    Inbox
} from 'lucide-react';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import { AnimatePresence, motion } from 'framer-motion';
import AuditTrailTimeline from '../../components/AuditTrailTimeline';
import { formatPlatformDate } from '../../utils/dateUtils';
import ProfilePictureModal from '../../components/modals/ProfilePictureModal';

// =============================================================================
// ATTACHMENT MODAL
// =============================================================================
const AttachmentModal = ({ file, onClose }) => {
    if (!file) return null;
    const isImage = file.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file_key || file.name);
    const isPdf = file.file_type === 'application/pdf' || /\.pdf$/i.test(file.file_key || file.name);

    return createPortal(
        <div className="fixed inset-0 z-[600] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose} />
                <div className="relative z-10 bg-white dark:bg-[#161B22] rounded-2xl overflow-hidden w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 mx-auto border border-slate-200 dark:border-[#30363D]">
                    <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-[#30363D] bg-slate-50 dark:bg-[#0D1117]">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
                                {isImage ? <ImageIcon size={18} /> : <FileText size={18} />}
                            </div>
                            <div className="overflow-hidden min-w-0">
                                <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-sm truncate">
                                    {(file.file_key || file.name)?.split('/').pop() || 'Attachment'}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-github-dark-muted">
                                    {file.file_type || 'File'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <a
                                href={file.file_url}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Download"
                            >
                                <Download size={18} />
                            </a>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-100 dark:bg-[#010409] p-4 flex items-center justify-center overflow-hidden relative">
                        {isImage ? (
                            <img src={file.file_url} alt="Attachment" className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                        ) : isPdf ? (
                            <iframe src={file.file_url} className="w-full h-full rounded-lg border border-slate-200 dark:border-[#30363D] bg-white" title="PDF Viewer" />
                        ) : (
                            <div className="text-center">
                                <p className="text-slate-500 dark:text-github-dark-muted mb-4 text-xs">This file type cannot be previewed directly.</p>
                                <a href={file.file_url} download className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-semibold">Download to view</a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// =============================================================================
// EMPLOYEE LEAVE PLAN CARD (Matching Flutter EmployeeLeavePlanCard)
// =============================================================================
const EmployeeLeavePlanCard = ({ balance, index }) => {
    const total = Number(balance.allocated || 0) + Number(balance.carried_forward || 0);
    const used = Number(balance.used || 0);
    const available = Number(balance.available || 0);
    const progress = total > 0 ? Math.min(available / total, 1) : 0;
    const remainingPct = total > 0 ? Math.round((available / total) * 100) : 0;

    const colors = [
        { primary: 'text-[#4F46E5] dark:text-[#818CF8]', bar: 'bg-[#4F46E5]', bg: 'bg-indigo-50/70 dark:bg-indigo-950/20', border: 'border-indigo-100 dark:border-indigo-900/30' },
        { primary: 'text-[#0D9488] dark:text-[#2DD4BF]', bar: 'bg-[#0D9488]', bg: 'bg-teal-50/70 dark:bg-teal-950/20', border: 'border-teal-100 dark:border-teal-900/30' },
        { primary: 'text-[#E11D48] dark:text-[#FB7185]', bar: 'bg-[#E11D48]', bg: 'bg-rose-50/70 dark:bg-rose-950/20', border: 'border-rose-100 dark:border-rose-900/30' },
        { primary: 'text-[#D97706] dark:text-[#FBBF24]', bar: 'bg-[#D97706]', bg: 'bg-amber-50/70 dark:bg-amber-950/20', border: 'border-amber-100 dark:border-amber-900/30' },
    ][index % 4];

    const code = balance.leave_code || balance.leave_type?.split(' ').map(w => w[0]).join('').toUpperCase() || 'LV';

    return (
        <div className="bg-white dark:bg-[#161B22] p-3.5 rounded-xl border border-slate-200/80 dark:border-[#30363D] shadow-sm space-y-3">
            {/* Header: Title + Code Pill */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-xs text-slate-900 dark:text-github-dark-text truncate">
                        {balance.leave_type}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/30 shrink-0">
                        {code}
                    </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                    {total} days total
                </span>
            </div>

            {/* Progress Row */}
            <div className="space-y-1.5">
                <div className="flex items-baseline justify-between text-xs">
                    <div>
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white mr-1">{available}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">days left</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {used} used / {total} total
                    </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-100 dark:bg-[#21262D] rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${colors.bar} rounded-full transition-all duration-300`} 
                        style={{ width: `${remainingPct}%` }}
                    />
                </div>

                <div className="flex items-center justify-between text-[10px]">
                    <span className={`font-semibold ${colors.primary}`}>
                        {remainingPct}% remaining
                    </span>
                    <span className="text-slate-400">
                        {total} days allowance
                    </span>
                </div>
            </div>

            {/* Feature tags */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                    balance.is_paid === false || balance.is_paid === 0 
                        ? 'bg-slate-50 dark:bg-[#21262D] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#30363D]' 
                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                }`}>
                    {balance.is_paid === false || balance.is_paid === 0 ? 'Unpaid Leave' : 'Paid Leave'}
                </span>
                {(balance.requires_doc === 1 || balance.requires_doc === true) && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                        Doc Required
                    </span>
                )}
                {(balance.carry_forward === 1 || balance.carry_forward === true) && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40">
                        Carry Fwd
                    </span>
                )}
                {(balance.encashable === 1 || balance.encashable === true) && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40">
                        Encashable
                    </span>
                )}
            </div>
        </div>
    );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const LeaveApplication = ({ isEmbedded = false }) => {
    const { user, avatarTimestamp } = useAuth();
    const isAdmin = user?.user_type === 'admin' || user?.user_type === 'hr';

    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [viewingAttachment, setViewingAttachment] = useState(null);
    const [previewAvatarData, setPreviewAvatarData] = useState(null);
    const [adminAction, setAdminAction] = useState({ remarks: '', payType: 'Paid', payPercentage: 100 });
    const adminRemarksRef = useRef(null);

    const openAvatarPreview = (userObj) => {
        if (!userObj) return;
        setPreviewAvatarData({
            imageUrl: userObj.profile_image_url ? `${userObj.profile_image_url}?t=${avatarTimestamp}` : null,
            name: userObj.user_name || 'Employee',
            role: userObj.designation || userObj.role || 'Employee',
            department: userObj.dept_name,
            email: userObj.email || userObj.user_email,
            phone: userObj.phone_no
        });
    };

    // Leave Balances States
    const [myBalances, setMyBalances] = useState([]);
    const [myPolicies, setMyPolicies] = useState([]);
    const [selectedEmployeeBalances, setSelectedEmployeeBalances] = useState([]);
    const [loadingBalances, setLoadingBalances] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => {},
        confirmText: 'Confirm'
    });
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    // Admin Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Form State (Apply Leave)
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        leave_type: '',
        start_date: '',
        end_date: '',
        reason: '',
        attachments: []
    });
    const [isCustomType, setIsCustomType] = useState(false);
    const [submittingLeave, setSubmittingLeave] = useState(false);

    // Employee Filter & Summary Logic
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const calculateDays = (start, end) => {
        if (!start || !end) return 0;
        try {
            const s = new Date(start + (start.includes('T') ? '' : 'T00:00:00'));
            const e = new Date(end + (end.includes('T') ? '' : 'T00:00:00'));
            const diffTime = Math.abs(e - s);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return diffDays > 0 ? diffDays : 0;
        } catch {
            return 0;
        }
    };

    const formCalculatedDays = calculateDays(formData.start_date, formData.end_date);

    // Filtered leaves for employee view based on selected month & year
    const filteredEmployeeLeaves = useMemo(() => {
        const monthStr = String(selectedMonth + 1).padStart(2, '0');
        const filterDateStr = `${selectedYear}-${monthStr}`;

        return leaves.filter(leave => {
            if (!leave.start_date) return false;
            return leave.start_date.startsWith(filterDateStr);
        });
    }, [leaves, selectedMonth, selectedYear]);

    const totalApprovedDays = useMemo(() => {
        return filteredEmployeeLeaves
            .filter(l => l.status?.toLowerCase() === 'approved')
            .reduce((acc, curr) => {
                const diffDays = calculateDays(curr.start_date, curr.end_date);
                return acc + (diffDays > 0 ? diffDays : 0);
            }, 0);
    }, [filteredEmployeeLeaves]);

    const selectedBalance = useMemo(() => {
        return myBalances.find(b => String(b.rule_id) === String(formData.leave_type) || b.leave_type === formData.leave_type);
    }, [myBalances, formData.leave_type]);

    useEffect(() => {
        if (user) {
            fetchLeaves();
        }
    }, [user, selectedYear]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('apply') === 'true') {
            setShowForm(true);
        }
        const targetReqId = Number(params.get('requestId') || params.get('lr_id') || params.get('id'));
        if (targetReqId && leaves.length > 0) {
            const matching = leaves.find(l => Number(l.lr_id) === targetReqId || Number(l.id) === targetReqId);
            if (matching) {
                setSelectedLeave(matching);
            }
        }
    }, [leaves]);

    // Admin: Fetch selected employee's leave balance
    const fetchSelectedEmployeeBalances = async (userId) => {
        setLoadingBalances(true);
        try {
            const res = await leaveService.getEmployeeLeaveBalance(userId, selectedYear);
            if (res.ok) {
                setSelectedEmployeeBalances(res.balances || []);
            }
        } catch (error) {
            console.error("Failed to fetch employee balances", error);
            setSelectedEmployeeBalances([]);
        } finally {
            setLoadingBalances(false);
        }
    };

    useEffect(() => {
        if (isAdmin && selectedLeave) {
            fetchSelectedEmployeeBalances(selectedLeave.user_id);
        } else {
            setSelectedEmployeeBalances([]);
        }
    }, [selectedLeave, selectedYear]);

    const fetchLeaves = async () => {
        setLoading(true);
        try {
            const res = isAdmin ? await leaveService.getAdminLeaves() : await leaveService.getMyLeaves();
            if (res.ok) {
                const fetchedRaw = isAdmin
                    ? (res.history || res.requests || [])
                    : (res.leaves || []);

                const fetched = isAdmin
                    ? fetchedRaw.filter(l => {
                        const isUserActive = l.is_active === undefined ? true : (l.is_active === 1 || l.is_active === true || l.is_active === '1');
                        const isUserDeleted = l.is_deleted === undefined ? false : (l.is_deleted === 1 || l.is_deleted === true || l.is_deleted === '1');
                        return isUserActive && !isUserDeleted;
                    })
                    : fetchedRaw;

                setLeaves(fetched);
            }

            // Always fetch leave balances for applying leave
            const balRes = await leaveService.getMyLeaveBalances(selectedYear);
            if (balRes.ok) {
                setMyBalances(balRes.balances || []);
                if (balRes.balances?.length > 0 && !formData.leave_type) {
                    setFormData(prev => ({
                        ...prev,
                        leave_type: String(balRes.balances[0].rule_id || balRes.balances[0].leave_type)
                    }));
                }
            }

            // Fetch user policies
            try {
                const polRes = await leaveService.getLeavePolicies();
                if (polRes.ok && polRes.policies) {
                    setMyPolicies(polRes.policies);
                }
            } catch (e) {}

        } catch (error) {
            console.error("Fetch leaves error", error);
            toast.error("Failed to load leave records");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async (e) => {
        e.preventDefault();
        try {
            if (!formData.start_date || !formData.end_date) {
                toast.error("Please select both start and end dates.");
                return;
            }
            if (new Date(formData.end_date) < new Date(formData.start_date)) {
                toast.error("End date cannot be before start date.");
                return;
            }
            if (selectedBalance && selectedBalance.requires_doc && (!formData.attachments || formData.attachments.length === 0)) {
                toast.error(`An attachment is required for ${selectedBalance.leave_type} as per company policy.`);
                return;
            }
            setSubmittingLeave(true);
            const data = new FormData();
            data.append('leave_type', isCustomType ? formData.leave_type : (selectedBalance?.leave_type || formData.leave_type));
            if (!isCustomType && selectedBalance?.rule_id) {
                data.append('rule_id', selectedBalance.rule_id);
            }
            data.append('start_date', formData.start_date);
            data.append('end_date', formData.end_date);
            data.append('reason', formData.reason);
            if (formData.attachments && formData.attachments.length > 0) {
                formData.attachments.forEach(file => {
                    data.append('attachments', file);
                });
            }

            const res = await leaveService.applyForLeave(data);
            if (res.ok) {
                toast.success("Leave request submitted successfully");
                setFormData({
                    leave_type: myBalances[0]?.rule_id ? String(myBalances[0].rule_id) : 'Casual Leave',
                    start_date: '',
                    end_date: '',
                    reason: '',
                    attachments: []
                });
                setShowForm(false);
                setIsCustomType(false);
                fetchLeaves();
            }
        } catch (error) {
            console.error("Apply error", error);
            toast.error(error.message || "Failed to submit request");
        } finally {
            setSubmittingLeave(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFormData(prev => ({
                ...prev,
                attachments: [...(prev.attachments || []), ...newFiles]
            }));
            e.target.value = '';
        }
    };

    const removeFile = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleWithdraw = (leaveId) => {
        setConfirmModal({
            isOpen: true,
            title: "Withdraw Request?",
            message: "Are you sure you want to withdraw this leave request? This action cannot be undone.",
            type: 'warning',
            confirmText: "Withdraw",
            onConfirm: async () => {
                try {
                    setIsWithdrawing(true);
                    const res = await leaveService.withdrawLeave(leaveId);
                    if (res.ok) {
                        toast.success("Request withdrawn successfully");
                        fetchLeaves();
                        if (selectedLeave?.lr_id === leaveId || selectedLeave?.id === leaveId) setSelectedLeave(null);
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }
                } catch (error) {
                    console.error("Withdraw error", error);
                    toast.error(error.message || "Failed to withdraw request");
                } finally {
                    setIsWithdrawing(false);
                }
            }
        });
    };

    const handleAdminAction = async (status) => {
        if (!selectedLeave) return;
        const actionStatus = status;
        const isReject = actionStatus.toLowerCase() === 'rejected';

        if (isReject && !adminAction.remarks?.trim()) {
            toast.warning("Please provide remarks for rejecting this request.");
            return;
        }

        try {
            const adminName = user?.user_name || user?.name;
            const defaultApproveComment = adminName ? `Approved by ${adminName}` : 'Approved by Administrator';
            const effectiveRemarks = adminAction.remarks?.trim()
                ? adminAction.remarks.trim()
                : (isReject ? '' : defaultApproveComment);

            const payload = {
                status: actionStatus.charAt(0).toUpperCase() + actionStatus.slice(1).toLowerCase(),
                admin_comment: effectiveRemarks,
                pay_type: adminAction.payType,
                pay_percentage: adminAction.payType === 'Paid' ? 100 : 0
            };

            const targetId = selectedLeave.lr_id || selectedLeave.id;
            const res = await leaveService.updateLeaveStatus(targetId, payload);
            if (res.ok) {
                toast.success(`Leave request marked as ${actionStatus.toLowerCase()}`);
                const existingTrail = Array.isArray(selectedLeave.audit_trail)
                    ? selectedLeave.audit_trail
                    : (typeof selectedLeave.audit_trail === 'string'
                        ? (() => { try { return JSON.parse(selectedLeave.audit_trail); } catch { return []; } })()
                        : []);
                const updatedTrail = res.request?.audit_trail || [
                    ...existingTrail,
                    {
                        action: actionStatus.toLowerCase(),
                        by: user?.user_id,
                        by_name: user?.user_name || 'Admin',
                        at: new Date().toISOString(),
                        comments: effectiveRemarks || null
                    }
                ];

                const updatedLeaves = leaves.map(l =>
                    (l.lr_id === targetId || l.id === targetId)
                        ? { ...l, status: actionStatus.toLowerCase(), admin_comment: effectiveRemarks, reviewer_name: user?.user_name || l.reviewer_name, audit_trail: updatedTrail }
                        : l
                );
                setLeaves(updatedLeaves);
                setSelectedLeave({
                    ...selectedLeave,
                    status: actionStatus.toLowerCase(),
                    admin_comment: effectiveRemarks,
                    reviewer_name: user?.user_name || selectedLeave.reviewer_name,
                    audit_trail: updatedTrail
                });
                setAdminAction({ remarks: '', payType: 'Paid', payPercentage: 100 });
            }
        } catch (error) {
            console.error("Action error", error);
            toast.error(error.message || "Failed to update status");
        }
    };

    // Helper wrapper for layout
    const ContainerWrapper = ({ children, title }) => {
        if (isEmbedded) {
            return <div className="w-full">{children}</div>;
        }
        return <MobileDashboardLayout title={title} contentClassName="px-0 pt-0 pb-4">{children}</MobileDashboardLayout>;
    };

    if (loading && !leaves.length) {
        return (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="animate-spin text-indigo-600" size={28} />
            </div>
        );
    }

    // =========================================================================
    // RENDER: ADMIN VIEW (Matching Flutter _buildAdminView)
    // =========================================================================
    if (isAdmin) {
        const filteredLeavesList = leaves.filter(leaf => {
            const matchesSearch = (leaf.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (leaf.leave_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (leaf.email || leaf.user_email || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || (leaf.status || '').toLowerCase() === statusFilter.toLowerCase();
            return matchesSearch && matchesStatus;
        });

        const filterChips = [
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' }
        ];

        return (
            <ContainerWrapper title="Leave Requests">
                <div className="w-full px-2.5 sm:px-3 pt-2.5 pb-6 space-y-3">
                    {/* Search Bar & Apply Leave Button */}
                    <div className="flex items-center gap-2 w-full">
                        <div className="relative flex-1 h-9">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Search leave..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-9 pl-9 pr-8 text-xs bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-github-dark-text placeholder:text-slate-400"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowForm(true)}
                            className="h-9 px-3 bg-[#4F46E5] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
                        >
                            <Plus size={14} />
                            <span>Apply Leave</span>
                        </button>
                    </div>

                    {/* Status Filter ChoiceChips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {filterChips.map(chip => {
                            const isSelected = statusFilter === chip.id;
                            return (
                                <button
                                    key={chip.id}
                                    type="button"
                                    onClick={() => setStatusFilter(chip.id)}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                                        isSelected
                                            ? 'bg-[#4F46E5] text-white shadow-sm'
                                            : 'bg-white dark:bg-[#161B22] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#30363D]'
                                    }`}
                                >
                                    {chip.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Admin Request Cards (Matching Flutter AdminLeaveListItem) */}
                    <div className="space-y-2">
                        {filteredLeavesList.length === 0 ? (
                            <div className="py-16 text-center bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D]">
                                <Inbox className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={36} />
                                <p className="text-xs font-medium text-slate-400 dark:text-github-dark-muted">No leave requests found.</p>
                            </div>
                        ) : (
                            filteredLeavesList.map(req => {
                                const status = (req.status || 'pending').toLowerCase();
                                const statusColor = status === 'approved'
                                    ? 'text-emerald-500'
                                    : status === 'rejected'
                                        ? 'text-rose-500'
                                        : 'text-amber-500';

                                return (
                                    <div
                                        key={req.lr_id || req.id}
                                        onClick={() => setSelectedLeave(req)}
                                        className="bg-white dark:bg-[#161B22] p-3.5 rounded-xl border border-slate-200 dark:border-[#30363D] shadow-sm active:scale-[0.99] transition-all cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    onClick={(e) => {
                                                        if (req.profile_image_url) {
                                                            e.stopPropagation();
                                                            openAvatarPreview(req);
                                                        }
                                                    }}
                                                    className={`w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 overflow-hidden shrink-0 transition-transform ${
                                                        req.profile_image_url ? 'cursor-pointer active:scale-95 ring-1 ring-slate-300 dark:ring-slate-700' : ''
                                                    }`}
                                                    title={req.profile_image_url ? `View ${req.user_name}'s photo` : req.user_name}
                                                >
                                                    {req.profile_image_url && req.profile_image_url.startsWith('http') ? (
                                                        <img src={`${req.profile_image_url}?t=${avatarTimestamp}`} alt={req.user_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        (req.user_name || 'U').charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-900 dark:text-github-dark-text truncate leading-tight">
                                                        {req.user_name || 'Employee'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                        {req.email || req.user_email || 'No email'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-semibold bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full shrink-0">
                                                {req.leave_type}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-[#30363D]/50 text-xs">
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                                                <Calendar size={13} className="text-slate-400" />
                                                <span>{formatPlatformDate(req.start_date)} - {formatPlatformDate(req.end_date)}</span>
                                            </div>
                                            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusColor}`}>
                                                {req.status}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Admin Detail Bottom Sheet Modal (Matching Flutter AdminLeaveDetailView) */}
                {selectedLeave && (
                    <div className="fixed inset-0 z-[500] flex items-end justify-center">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLeave(null)} />
                        <div className="relative z-10 w-full bg-white dark:bg-[#161B22] rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] border-t border-slate-200 dark:border-[#30363D] animate-in slide-in-from-bottom duration-200">
                            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        onClick={() => selectedLeave?.profile_image_url && openAvatarPreview(selectedLeave)}
                                        className={`w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-300 overflow-hidden shrink-0 transition-transform ${
                                            selectedLeave.profile_image_url ? 'cursor-pointer active:scale-95 ring-2 ring-indigo-500/30' : ''
                                        }`}
                                        title={selectedLeave.profile_image_url ? `View ${selectedLeave.user_name}'s photo` : selectedLeave.user_name}
                                    >
                                        {selectedLeave.profile_image_url && selectedLeave.profile_image_url.startsWith('http') ? (
                                            <img src={`${selectedLeave.profile_image_url}?t=${avatarTimestamp}`} alt={selectedLeave.user_name} className="w-full h-full object-cover" />
                                        ) : (
                                            (selectedLeave.user_name || 'U').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-github-dark-text truncate">{selectedLeave.user_name}</h3>
                                        <p className="text-[11px] text-slate-400 truncate">{selectedLeave.email || selectedLeave.user_email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedLeave(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full shrink-0">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-4 pt-4">
                                {/* Type & Dates */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 dark:bg-[#0D1117] p-3 rounded-xl border border-slate-200/60 dark:border-[#30363D]">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Leave Type</span>
                                        <span className="text-xs font-bold text-slate-800 dark:text-github-dark-text">{selectedLeave.leave_type}</span>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-[#0D1117] p-3 rounded-xl border border-slate-200/60 dark:border-[#30363D]">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Duration</span>
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                            {calculateDays(selectedLeave.start_date, selectedLeave.end_date)} Days
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-[#0D1117] p-3 rounded-xl border border-slate-200/60 dark:border-[#30363D]">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Date Range</span>
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {formatPlatformDate(selectedLeave.start_date)} - {formatPlatformDate(selectedLeave.end_date)}
                                    </span>
                                </div>

                                {/* Reason */}
                                <div className="bg-slate-50 dark:bg-[#0D1117] p-3.5 rounded-xl border border-slate-200/60 dark:border-[#30363D]">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Reason</span>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                                        "{selectedLeave.reason || 'No reason provided'}"
                                    </p>
                                </div>

                                {/* Employee Balance Summary */}
                                {selectedEmployeeBalances.length > 0 && (
                                    <div className="space-y-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Applicant Leave Balances</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedEmployeeBalances.map(bal => (
                                                <div key={bal.lb_id || bal.rule_id} className="bg-slate-50 dark:bg-[#0D1117] p-2.5 rounded-lg border border-slate-200/60 dark:border-[#30363D]">
                                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block truncate">{bal.leave_type}</span>
                                                    <div className="flex justify-between items-baseline mt-1">
                                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{Number(bal.available)} left</span>
                                                        <span className="text-[9px] text-slate-400">{Number(bal.used)} used</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Attachments */}
                                {selectedLeave.attachments && selectedLeave.attachments.length > 0 && (
                                    <div className="space-y-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Attachments</span>
                                        <div className="space-y-1.5">
                                            {selectedLeave.attachments.map((file, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => setViewingAttachment(file)}
                                                    className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-[#0D1117] rounded-lg border border-slate-200/60 dark:border-[#30363D] cursor-pointer text-xs"
                                                >
                                                    <FileText size={15} className="text-indigo-500 shrink-0" />
                                                    <span className="truncate flex-1 font-medium">{file.file_key?.split('/').pop() || file.name || 'Attachment'}</span>
                                                    <ExternalLink size={13} className="text-slate-400 shrink-0" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Admin Action Form */}
                                {selectedLeave.status?.toLowerCase() === 'pending' && (
                                    <div className="pt-3 border-t border-slate-100 dark:border-[#30363D] space-y-3">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Pay Type</label>
                                            <div className="flex gap-2">
                                                {['Paid', 'Unpaid'].map(pt => (
                                                    <button
                                                        key={pt}
                                                        type="button"
                                                        onClick={() => setAdminAction(prev => ({ ...prev, payType: pt }))}
                                                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                                            adminAction.payType === pt
                                                                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                                                                : 'bg-white dark:bg-[#0D1117] text-slate-500 border-slate-200 dark:border-[#30363D]'
                                                        }`}
                                                    >
                                                        {pt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Remarks</label>
                                            <textarea
                                                ref={adminRemarksRef}
                                                value={adminAction.remarks}
                                                onChange={(e) => setAdminAction(prev => ({ ...prev, remarks: e.target.value }))}
                                                placeholder="Enter review remarks..."
                                                rows={2}
                                                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-slate-800 dark:text-github-dark-text outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                            <button
                                                onClick={() => handleAdminAction('rejected')}
                                                className="py-2.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 transition-all"
                                            >
                                                Reject Request
                                            </button>
                                            <button
                                                onClick={() => handleAdminAction('approved')}
                                                className="py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                                            >
                                                Approve Request
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Admin Remarks display if already processed */}
                                {selectedLeave.status?.toLowerCase() !== 'pending' && selectedLeave.admin_comment && (
                                    <div className="bg-slate-50 dark:bg-[#0D1117] p-3 rounded-xl border border-slate-200/60 dark:border-[#30363D]">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Review Remarks</span>
                                        <p className="text-xs text-slate-700 dark:text-slate-300">
                                            {(() => {
                                                const rawRemarks = selectedLeave.admin_comment;
                                                if (!rawRemarks) return "No remarks provided.";
                                                if (/^approved by (?:administrator|administration)$/i.test(rawRemarks.trim())) {
                                                    const revName = selectedLeave.reviewer_name || selectedLeave.reviewed_by_name || user?.user_name;
                                                    return revName ? `Approved by ${revName}` : rawRemarks;
                                                }
                                                return rawRemarks;
                                            })()}
                                        </p>
                                    </div>
                                )}

                                {/* Audit Trail Timeline */}
                                <AuditTrailTimeline
                                    record={selectedLeave}
                                    compact={true}
                                    currentUserId={isAdmin ? null : selectedLeave.user_id}
                                    isEmployee={!isAdmin}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Apply Leave Sheet Portal */}
                {showForm && (
                    <ApplyLeaveModal
                        formData={formData}
                        setFormData={setFormData}
                        myBalances={myBalances}
                        selectedBalance={selectedBalance}
                        isCustomType={isCustomType}
                        setIsCustomType={setIsCustomType}
                        formCalculatedDays={formCalculatedDays}
                        handleApply={handleApply}
                        handleFileChange={handleFileChange}
                        removeFile={removeFile}
                        submittingLeave={submittingLeave}
                        onClose={() => setShowForm(false)}
                    />
                )}

                {viewingAttachment && (
                    <AttachmentModal file={viewingAttachment} onClose={() => setViewingAttachment(null)} />
                )}
            </ContainerWrapper>
        );
    }

    // =========================================================================
    // RENDER: EMPLOYEE VIEW (Matching Flutter _buildEmployeeView)
    // =========================================================================
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <ContainerWrapper title="Leave Applications">
            <div className="w-full px-2.5 sm:px-3 pt-2.5 pb-6 space-y-3.5">
                {/* Top Action Bar Card (Matching Flutter LeaveMobileView) */}
                <div className="bg-white dark:bg-[#161B22] p-3.5 rounded-xl border border-slate-200/80 dark:border-[#30363D] shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-github-dark-text">My Leave</h3>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-300 text-[10.5px] font-semibold px-2 py-0.5 rounded">
                                    {filteredEmployeeLeaves.length} Requests
                                </span>
                                <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[10.5px] font-bold px-2 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/40">
                                    {totalApprovedDays} Days Approved
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-3 py-1.5 bg-[#4F46E5] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                        >
                            <Plus size={14} />
                            <span>Apply</span>
                        </button>
                    </div>

                    {/* Month & Year Selectors */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-[#30363D]/50">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="flex-1 py-1.5 px-2.5 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                        >
                            {monthNames.map((name, idx) => (
                                <option key={idx} value={idx}>{name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-24 py-1.5 px-2.5 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                        >
                            {[-2, -1, 0, 1, 2].map(offset => {
                                const yr = new Date().getFullYear() + offset;
                                return <option key={yr} value={yr}>{yr}</option>;
                            })}
                        </select>
                    </div>
                </div>

                {/* SECTION 1: Leave Plan & Balances */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                            <h4 className="text-xs font-bold text-slate-800 dark:text-github-dark-text">My Leave Plan & Balances</h4>
                        </div>
                        <span className="text-[10px] text-slate-400">Year {selectedYear}</span>
                    </div>

                    {/* Assigned Policy Banner (if exists) */}
                    {myPolicies.length > 0 && myPolicies.map((pol, pIdx) => (
                        <div key={pIdx} className="p-2.5 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200/70 dark:border-[#30363D] flex items-center gap-2.5">
                            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                                <Shield size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h5 className="text-xs font-bold text-slate-800 dark:text-white truncate">{pol.name || 'Company Leave Policy'}</h5>
                                {pol.description && (
                                    <p className="text-[10px] text-slate-400 truncate">{pol.description}</p>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Rule Cards Grid (Matching Flutter EmployeeLeavePlanCard) */}
                    {myBalances.length > 0 ? (
                        <div className="space-y-2">
                            {myBalances.map((bal, idx) => (
                                <EmployeeLeavePlanCard key={bal.rule_id || idx} balance={bal} index={idx} />
                            ))}
                        </div>
                    ) : (
                        <div className="p-5 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] text-center space-y-1">
                            <Shield className="mx-auto text-slate-300 dark:text-slate-600 mb-1" size={28} />
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No leave plan assigned yet</p>
                            <p className="text-[11px] text-slate-400">Contact HR team to get a leave policy assigned.</p>
                        </div>
                    )}
                </div>

                {/* SECTION 2: My Leave Requests (Matching Flutter LeaveHistoryItem) */}
                <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                            <h4 className="text-xs font-bold text-slate-800 dark:text-github-dark-text">My Leave Requests</h4>
                        </div>
                        <span className="text-[10px] text-slate-400">
                            {monthNames[selectedMonth]} {selectedYear}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {filteredEmployeeLeaves.length === 0 ? (
                            <div className="py-12 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] text-center space-y-1">
                                <CalendarDays className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={32} />
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No requests this month</p>
                                <p className="text-[11px] text-slate-400">No leave requests found for {monthNames[selectedMonth]} {selectedYear}.</p>
                            </div>
                        ) : (
                            filteredEmployeeLeaves.map(leave => {
                                const status = (leave.status || 'pending').toLowerCase();
                                const isApproved = status === 'approved';
                                const isRejected = status === 'rejected';

                                const dotColor = isApproved ? 'bg-emerald-500' : isRejected ? 'bg-rose-500' : 'bg-amber-500';
                                const statusPillBg = isApproved
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
                                    : isRejected
                                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40';

                                const code = leave.leave_code || leave.leave_type?.split(' ').map(w => w[0]).join('').toUpperCase() || 'LV';
                                const duration = calculateDays(leave.start_date, leave.end_date);

                                return (
                                    <div
                                        key={leave.lr_id || leave.id}
                                        onClick={() => setSelectedLeave(leave)}
                                        className="bg-white dark:bg-[#161B22] p-3.5 rounded-xl border border-slate-200/80 dark:border-[#30363D] shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2.5"
                                    >
                                        {/* Top Row: Type, Code & Status */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-github-dark-text truncate">
                                                    {leave.policy_name || leave.leave_type}
                                                </h4>
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                                                    {code}
                                                </span>
                                            </div>

                                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1.5 shrink-0 ${statusPillBg}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                                <span>{leave.status}</span>
                                            </div>
                                        </div>

                                        {/* Middle Row: Duration & Date Range */}
                                        <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                                            <Calendar size={13} className="shrink-0" />
                                            <span>{duration} Day{duration > 1 ? 's' : ''}</span>
                                            <span className="text-slate-500 dark:text-slate-400 font-normal text-[11px] truncate">
                                                ({formatPlatformDate(leave.start_date)} - {formatPlatformDate(leave.end_date)})
                                            </span>
                                        </div>

                                        {/* Reason Quote */}
                                        {leave.reason && (
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 italic bg-slate-50 dark:bg-[#0D1117] p-2 rounded-lg border border-slate-100 dark:border-[#30363D]/40">
                                                "{leave.reason}"
                                            </p>
                                        )}

                                        {/* Bottom Row: Applied On & Actions */}
                                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-[#30363D]/50">
                                            <span>Applied: {formatPlatformDate(leave.created_at || leave.applied_at || leave.start_date)}</span>

                                            <div className="flex items-center gap-2">
                                                <span className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                                                    View Details →
                                                </span>
                                                {status === 'pending' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleWithdraw(leave.lr_id || leave.id);
                                                        }}
                                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                                                        title="Withdraw request"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Employee Detail Bottom Sheet Modal (Matching Flutter EmployeeLeaveDetailSheet) */}
            {selectedLeave && (
                <div className="fixed inset-0 z-[500] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLeave(null)} />
                    <div className="relative z-10 w-full bg-white dark:bg-[#161B22] rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] border-t border-slate-200 dark:border-[#30363D] animate-in slide-in-from-bottom duration-200">
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#30363D]">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-github-dark-text">{selectedLeave.leave_type}</h3>
                                <p className="text-[11px] text-slate-400">
                                    {formatPlatformDate(selectedLeave.start_date)} - {formatPlatformDate(selectedLeave.end_date)}
                                </p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                                selectedLeave.status?.toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                selectedLeave.status?.toLowerCase() === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                                {selectedLeave.status}
                            </span>
                        </div>

                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 dark:bg-[#0D1117] p-3 rounded-xl border border-slate-200/60 dark:border-[#30363D]">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Duration</span>
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                        {calculateDays(selectedLeave.start_date, selectedLeave.end_date)} Days
                                    </span>
                                </div>
                                <div className="bg-slate-50 dark:bg-[#0D1117] p-3 rounded-xl border border-slate-200/60 dark:border-[#30363D]">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</span>
                                    <span className="text-xs font-bold capitalize text-slate-800 dark:text-slate-200">
                                        {selectedLeave.status}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-[#0D1117] p-3.5 rounded-xl border border-slate-200/60 dark:border-[#30363D]">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Reason</span>
                                <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                                    "{selectedLeave.reason || 'No reason provided'}"
                                </p>
                            </div>

                            {selectedLeave.admin_comment && (
                                <div className="bg-slate-50 dark:bg-[#0D1117] p-3.5 rounded-xl border border-slate-200/60 dark:border-[#30363D]">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Admin Remarks</span>
                                    <p className="text-xs text-slate-700 dark:text-slate-300">
                                        {(() => {
                                            const rawRemarks = selectedLeave.admin_comment;
                                            if (!rawRemarks) return "No remarks provided.";
                                            if (/^approved by (?:administrator|administration)$/i.test(rawRemarks.trim())) {
                                                const revName = selectedLeave.reviewer_name || selectedLeave.reviewed_by_name;
                                                return revName ? `Approved by ${revName}` : rawRemarks;
                                            }
                                            return rawRemarks;
                                        })()}
                                    </p>
                                </div>
                            )}

                            {selectedLeave.attachments && selectedLeave.attachments.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Attachments</span>
                                    <div className="space-y-1.5">
                                        {selectedLeave.attachments.map((file, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setViewingAttachment(file)}
                                                className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-[#0D1117] rounded-lg border border-slate-200/60 dark:border-[#30363D] cursor-pointer text-xs"
                                            >
                                                <FileText size={15} className="text-indigo-500 shrink-0" />
                                                <span className="truncate flex-1 font-medium">{file.file_key?.split('/').pop() || file.name || 'Attachment'}</span>
                                                <ExternalLink size={13} className="text-slate-400 shrink-0" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Withdraw Button if Pending */}
                            {selectedLeave.status?.toLowerCase() === 'pending' && (
                                <button
                                    onClick={() => handleWithdraw(selectedLeave.lr_id || selectedLeave.id)}
                                    className="w-full py-2.5 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 rounded-xl border border-red-200 dark:border-red-900/30 transition-all"
                                >
                                    Withdraw Request
                                </button>
                            )}

                            {/* Audit Trail */}
                            <AuditTrailTimeline
                                record={selectedLeave}
                                compact={true}
                                currentUserId={user?.user_id}
                                isEmployee={true}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Apply Leave Sheet Portal */}
            {showForm && (
                <ApplyLeaveModal
                    formData={formData}
                    setFormData={setFormData}
                    myBalances={myBalances}
                    selectedBalance={selectedBalance}
                    isCustomType={isCustomType}
                    setIsCustomType={setIsCustomType}
                    formCalculatedDays={formCalculatedDays}
                    handleApply={handleApply}
                    handleFileChange={handleFileChange}
                    removeFile={removeFile}
                    submittingLeave={submittingLeave}
                    onClose={() => setShowForm(false)}
                />
            )}

            {viewingAttachment && (
                <AttachmentModal file={viewingAttachment} onClose={() => setViewingAttachment(null)} />
            )}

            <AnimatePresence>
                {confirmModal.isOpen && (
                    <ConfirmationModal
                        {...confirmModal}
                        isSubmitting={isWithdrawing}
                        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    />
                )}
            </AnimatePresence>

            <ProfilePictureModal
                isOpen={!!previewAvatarData}
                onClose={() => setPreviewAvatarData(null)}
                imageUrl={previewAvatarData?.imageUrl}
                name={previewAvatarData?.name}
                role={previewAvatarData?.role}
                department={previewAvatarData?.department}
                email={previewAvatarData?.email}
                phone={previewAvatarData?.phone}
            />
        </ContainerWrapper>
    );
};

// =============================================================================
// SUB-COMPONENT: APPLY LEAVE MODAL (Matching Flutter ApplyLeaveSheet)
// =============================================================================
const ApplyLeaveModal = ({
    formData,
    setFormData,
    myBalances,
    selectedBalance,
    isCustomType,
    setIsCustomType,
    formCalculatedDays,
    handleApply,
    handleFileChange,
    removeFile,
    submittingLeave,
    onClose
}) => {
    return createPortal(
        <div className="fixed inset-0 z-[600] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full bg-white dark:bg-[#161B22] rounded-t-2xl p-5 max-h-[92vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+20px)] border-t border-slate-200 dark:border-[#30363D] animate-in slide-in-from-bottom duration-200">
                <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#30363D]">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <Plus size={16} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-github-dark-text">Apply for Leave</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleApply} className="space-y-4 pt-4">
                    {/* Leave Type Selector */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Leave Type</label>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCustomType(!isCustomType);
                                    if (!isCustomType) setFormData(prev => ({ ...prev, leave_type: '' }));
                                    else if (myBalances.length > 0) setFormData(prev => ({ ...prev, leave_type: String(myBalances[0].rule_id || myBalances[0].leave_type) }));
                                }}
                                className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                {isCustomType ? 'Choose from Plan' : 'Specify Custom'}
                            </button>
                        </div>

                        {!isCustomType ? (
                            <select
                                value={formData.leave_type}
                                onChange={(e) => setFormData(prev => ({ ...prev, leave_type: e.target.value }))}
                                className="w-full py-2.5 px-3 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-xs font-semibold text-slate-800 dark:text-github-dark-text outline-none"
                            >
                                {myBalances.map(bal => (
                                    <option key={bal.rule_id || bal.leave_type} value={bal.rule_id || bal.leave_type}>
                                        {bal.leave_type} ({Number(bal.available)} days left)
                                    </option>
                                ))}
                                {myBalances.length === 0 && (
                                    <>
                                        <option value="Casual Leave">Casual Leave</option>
                                        <option value="Sick Leave">Sick Leave</option>
                                    </>
                                )}
                            </select>
                        ) : (
                            <input
                                type="text"
                                placeholder="Enter custom leave type..."
                                value={formData.leave_type}
                                required
                                onChange={(e) => setFormData(prev => ({ ...prev, leave_type: e.target.value }))}
                                className="w-full py-2.5 px-3 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-xs font-semibold text-slate-800 dark:text-github-dark-text outline-none"
                            />
                        )}
                    </div>

                    {/* Doc Required Alert */}
                    {selectedBalance?.requires_doc && (
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs">
                            <AlertCircle size={15} className="shrink-0" />
                            <span>Document proof is required for this leave type.</span>
                        </div>
                    )}

                    {/* Date Pickers */}
                    <div className="grid grid-cols-2 gap-3">
                        <DatePicker
                            label="Start Date"
                            value={formData.start_date}
                            onChange={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
                            placeholder="Select Start"
                        />
                        <DatePicker
                            label="End Date"
                            value={formData.end_date}
                            onChange={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
                            placeholder="Select End"
                            align="right"
                        />
                    </div>

                    {/* Duration Badge */}
                    {formCalculatedDays > 0 && (
                        <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-2.5 rounded-lg flex items-center justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Calculated Duration:</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {formCalculatedDays} Day{formCalculatedDays > 1 ? 's' : ''}
                            </span>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Reason</label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                            placeholder="Please provide reason for leave..."
                            rows={3}
                            required
                            className="w-full p-2.5 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-xs text-slate-800 dark:text-github-dark-text outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Attachments */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Attachments {selectedBalance?.requires_doc ? '(Required)' : '(Optional)'}
                        </label>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            <label className="shrink-0 w-14 h-14 rounded-lg border border-dashed border-slate-300 dark:border-[#30363D] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <Paperclip size={16} className="text-slate-400" />
                                <span className="text-[9px] text-slate-500 mt-1">Upload</span>
                                <input type="file" multiple className="hidden" onChange={handleFileChange} />
                            </label>
                            {formData.attachments?.map((file, i) => (
                                <div key={i} className="shrink-0 w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-[#30363D] relative flex items-center justify-center">
                                    <FileText size={18} className="text-indigo-500" />
                                    <button
                                        type="button"
                                        onClick={() => removeFile(i)}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submittingLeave}
                        className="w-full py-3 bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5"
                    >
                        {submittingLeave ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
                        <span>{submittingLeave ? 'Submitting...' : 'Submit Leave Request'}</span>
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default LeaveApplication;
