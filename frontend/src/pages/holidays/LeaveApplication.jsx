
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
    Filter,
    MessageSquare,
    Activity,
    MapPin,
    Plus,
    X,
    Trash2,
    Paperclip,
    ExternalLink,
    Download,
    Image as ImageIcon,
    ArrowLeft
} from 'lucide-react';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import MinimalSelect from '../../components/MinimalSelect';
import { motion, AnimatePresence } from 'framer-motion';

const AttachmentModal = ({ file, onClose }) => {
    if (!file) return null;
    const isImage = file.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file_key || file.name);
    const isPdf = file.file_type === 'application/pdf' || /\.pdf$/i.test(file.file_key || file.name);

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
                <div className="relative z-10 bg-white dark:bg-github-dark-subtle rounded-2xl overflow-hidden w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 mx-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                            {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-sm">
                                {(file.file_key || file.name)?.split('/').pop() || 'Attachment'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-github-dark-muted">
                                {file.file_type || 'Unknown Type'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={file.file_url} download target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Download">
                            <Download size={20} />
                        </a>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-950/50 p-4 flex items-center justify-center overflow-hidden relative">
                    {isImage ? (
                        <img src={file.file_url} alt="Attachment" className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                    ) : isPdf ? (
                        <iframe src={file.file_url} className="w-full h-full rounded-lg border border-slate-200 dark:border-github-dark-border bg-white" title="PDF Viewer"></iframe>
                    ) : (
                        <div className="text-center">
                            <p className="text-slate-500 dark:text-github-dark-muted mb-4">This file type cannot be previewed.</p>
                            <a href={file.file_url} download className="text-indigo-600 hover:underline">Download to view</a>
                        </div>
                    )}
                </div>
                </div>
            </div>
        </div>
    );
};

const LeaveApplication = ({ onSelectLeave, onLeavesChange, onActiveRangeChange }) => {
    const navigate = useNavigate();


    const { user, avatarTimestamp } = useAuth();
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeave, setSelectedLeave] = useState(null); // For Detail View
    const [viewingAttachment, setViewingAttachment] = useState(null);
    const [adminAction, setAdminAction] = useState({ status: '', remarks: '', payType: 'Paid', payPercentage: 100 });
    const adminRemarksRef = useRef(null);

    // Leave Balances States
    const [myBalances, setMyBalances] = useState([]);
    const [selectedEmployeeBalances, setSelectedEmployeeBalances] = useState([]);
    const [loadingBalances, setLoadingBalances] = useState(false);

    useEffect(() => {
        if (adminRemarksRef.current) {
            adminRemarksRef.current.style.height = 'auto';
            adminRemarksRef.current.style.height = adminRemarksRef.current.scrollHeight + 'px';
        }
    }, [adminAction.remarks, selectedLeave]);

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

    // Form State (User)
    const [formData, setFormData] = useState({
        leave_type: '',
        start_date: '',
        end_date: '',
        reason: '',
        attachments: []
    });

    const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);

    // Reset extended view when changing selected leave
    useEffect(() => {
        setAttachmentsExpanded(false);
    }, [selectedLeave]);

    useEffect(() => {
        if (onSelectLeave) {
            onSelectLeave(selectedLeave);
        }
    }, [selectedLeave, onSelectLeave]);

    useEffect(() => {
        if (onActiveRangeChange) {
            onActiveRangeChange(
                formData.start_date && formData.end_date
                    ? { start_date: formData.start_date, end_date: formData.end_date }
                    : null
            );
        }
    }, [formData.start_date, formData.end_date, onActiveRangeChange]);

    const [showForm, setShowForm] = useState(false);
    const [isCustomType, setIsCustomType] = useState(false);

    // --- FILTER & SUMMARY LOGIC (Moved to top level) ---
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Filter leaves based on selected month
    const filteredLeaves = React.useMemo(() => {
        const monthStr = String(selectedMonth + 1).padStart(2, '0');
        const filterDateStr = `${selectedYear}-${monthStr}`;

        return leaves.filter(leave => {
            if (!leave.start_date) return false;
            return leave.start_date.startsWith(filterDateStr);
        });
    }, [leaves, selectedMonth, selectedYear]);

    // Calculate total approved days
    const totalApprovedDays = React.useMemo(() => {
        return filteredLeaves
            .filter(l => l.status === 'approved')
            .reduce((acc, curr) => {
                // Inline calculateDays since helper is defined below, or move helper up.
                // Better yet, just use the helper if it's defined in scope or move helper up.
                // Helper is defined inside component? Yes at line 138.
                // Since this is inside component, we can use it if defined before use?
                // Javascript function declarations are hoisted, but const arrow functions are NOT.
                // calculateDays is const arrow function at line 138.
                // So we need to move calculateDays UP as well or define it as function.
                if (!curr.start_date || !curr.end_date) return acc; // safety check

                // Re-implementing logic inline to be safe or I'll move calculateDays up.
                // Let's move calculateDays to module scope or top of component.
                const s = new Date(curr.start_date);
                const e = new Date(curr.end_date);
                const diffTime = Math.abs(e - s);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                return acc + (diffDays > 0 ? diffDays : 0);
            }, 0);
    }, [filteredLeaves]);

    const { totalQuota, totalUsed, totalAvailable, usedPercentage } = React.useMemo(() => {
        const quota = myBalances.reduce((acc, b) => acc + Number(b.allocated) + Number(b.carried_forward), 0);
        const used = myBalances.reduce((acc, b) => acc + Number(b.used), 0);
        const avail = myBalances.reduce((acc, b) => acc + Number(b.available), 0);
        const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
        return { totalQuota: quota, totalUsed: used, totalAvailable: avail, usedPercentage: pct };
    }, [myBalances]);

    const isAdmin = user?.user_type === 'admin' || user?.user_type === 'hr';

    // --- ADMIN FILTERED LEAVES ---
    const adminFilteredLeaves = React.useMemo(() => {
        if (!isAdmin) return [];
        return leaves.filter(leaf => {
            const matchesSearch = (leaf.user_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || leaf.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [leaves, isAdmin, searchTerm, statusFilter]);

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
    }, []);

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
            // Admin: Fetch ALL history to allow filtering
            const res = isAdmin ? await leaveService.getAdminLeaves() : await leaveService.getMyLeaves();
            if (res.ok) {
                // Admin endpoint returns 'history', User endpoint returns 'leaves'
                // Pending endpoint (old) returned 'requests'
                const fetched = isAdmin
                    ? (res.history || res.requests || [])
                    : (res.leaves || []);

                setLeaves(fetched);
                if (onLeavesChange) {
                    onLeavesChange(fetched);
                }
                // Select first item by default for admin
                if (isAdmin && fetched.length > 0) setSelectedLeave(fetched[0]);
            }

            // Fetch current employee's leave balances
            if (!isAdmin) {
                const balRes = await leaveService.getMyLeaveBalances(selectedYear);
                if (balRes.ok) {
                    setMyBalances(balRes.balances || []);
                    if (balRes.balances?.length > 0) {
                        setFormData(prev => ({
                            ...prev,
                            leave_type: String(balRes.balances[0].rule_id)
                        }));
                    }
                }
            }
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
            // Create FormData to handle file upload
            const data = new FormData();
            data.append('leave_type', formData.leave_type);
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
                setFormData({ leave_type: 'Casual Leave', start_date: '', end_date: '', reason: '', attachments: [] });
                setShowForm(false);
                setIsCustomType(false);
                fetchLeaves();
            }
        } catch (error) {
            console.error("Apply error", error);
            toast.error(error.message || "Failed to submit request");
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFormData(prev => ({
                ...prev,
                attachments: [...(prev.attachments || []), ...newFiles]
            }));
            // Reset input value to allow selecting same file again if needed
            e.target.value = '';
        }
    };

    const removeFile = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleTextareaInput = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
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
        const actionStatus = status || adminAction.status;
        try {
            const payload = {
                status: actionStatus.charAt(0).toUpperCase() + actionStatus.slice(1), // Capitalize for backend
                admin_comment: adminAction.remarks,
                pay_type: adminAction.payType,
                pay_percentage: adminAction.payPercentage
            };

            const res = await leaveService.updateLeaveStatus(selectedLeave.lr_id, payload);
            if (res.ok) {
                toast.success(`Leave request ${actionStatus.toLowerCase()} successfully`);
                // Update local state
                const updatedLeaves = leaves.map(l =>
                    l.lr_id === selectedLeave.lr_id
                        ? { ...l, status: actionStatus.toLowerCase(), admin_comment: adminAction.remarks, pay_type: adminAction.payType, pay_percentage: adminAction.payPercentage }
                        : l
                );
                setLeaves(updatedLeaves);
                setSelectedLeave({ ...selectedLeave, status: actionStatus.toLowerCase(), admin_comment: adminAction.remarks, pay_type: adminAction.payType, pay_percentage: adminAction.payPercentage });
                setAdminAction({ status: '', remarks: '', payType: 'Paid', payPercentage: 100 });
            }
        } catch (error) {
            console.error("Action error", error);
            toast.error(error.message || "Failed to update status");
        }
    };

    // Helper to calculate days
    const calculateDays = (start, end) => {
        if (!start || !end) return 0;
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = Math.abs(e - s);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 0;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
            case 'rejected': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
            default: return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
        }
    };

    if (loading && !leaves.length) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }


    // --- MAIN RENDER ---
    return (
        <>
            {isAdmin ? (
                <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]">

                    {/* LEFT PANEL: LIST */}
                    <div data-tour-id="leave-admin-list" className="w-full lg:w-1/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col">
                        {/* Header & Search */}
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Leave Requests</h3>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-xs font-bold"
                                >
                                    <Plus size={14} />
                                    Apply
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search by name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>
                                <MinimalSelect
                                    options={[
                                        { value: 'all', label: 'All' },
                                        { value: 'pending', label: 'Pending' },
                                        { value: 'approved', label: 'Approved' },
                                        { value: 'rejected', label: 'Rejected' }
                                    ]}
                                    value={statusFilter}
                                    onChange={(val) => setStatusFilter(val)}
                                    size="sm"
                                    triggerClassName="bg-slate-50 dark:bg-[#161b22] border-slate-200 dark:border-github-dark-border text-xs"
                                    menuWidth={110}
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700 no-scrollbar">
                            {adminFilteredLeaves.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 text-sm">No requests found.</div>
                            ) : (
                                adminFilteredLeaves.map((request) => (
                                    <div
                                        key={request.lr_id}
                                        onClick={() => setSelectedLeave(request)}
                                        className={`p-4 cursor-pointer transition-colors ${selectedLeave?.lr_id === request.lr_id ? 'bg-indigo-50 dark:bg-indigo-900/10 border-l-4 border-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-4 border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                    {request.profile_image_url && request.profile_image_url.startsWith('http') ? (
                                                        <img src={`${request.profile_image_url}?t=${avatarTimestamp}`} alt={request.user_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        (request.user_name || 'U').charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-semibold ${selectedLeave?.lr_id === request.lr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>{request.user_name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted">{request.email}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-slate-600 bg-slate-50 dark:text-github-dark-muted dark:bg-github-dark-subtle`}>
                                                {request.leave_type}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-github-dark-muted mt-3">
                                            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                                                <Calendar size={12} />
                                                {new Date(request.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className={`flex items-center gap-1 font-medium capitalize ${request.status === 'approved' ? 'text-emerald-600' :
                                                request.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                {request.status}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: DETAILS */}
                    <div className="w-full lg:w-2/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                        {selectedLeave ? (
                            <>
                                {/* Detail Header */}
                                <div className="p-6 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-start bg-slate-50/50 dark:bg-github-dark-subtle/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                            {selectedLeave.profile_image_url && selectedLeave.profile_image_url.startsWith('http') ? (
                                                <img src={`${selectedLeave.profile_image_url}?t=${avatarTimestamp}`} alt={selectedLeave.user_name} className="w-full h-full object-cover" />
                                            ) : (
                                                (selectedLeave.user_name || 'U').charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-github-dark-text mb-0.5">Leave Request #{selectedLeave.lr_id}</h2>
                                            <p className="text-sm text-slate-500 dark:text-github-dark-muted">
                                                By <span className="font-bold text-slate-700 dark:text-slate-300">{selectedLeave.user_name}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${selectedLeave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                            selectedLeave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            <span className={`w-2 h-2 rounded-full ${selectedLeave.status === 'approved' ? 'bg-emerald-500' :
                                                selectedLeave.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
                                                }`}></span>
                                            {selectedLeave.status}
                                        </div>
                                        {selectedLeave.status === 'approved' && selectedLeave.pay_type && (
                                            <div className="mt-1">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    selectedLeave.pay_type === 'Paid'
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                        : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                                                }`}>
                                                    {selectedLeave.pay_type}
                                                </span>
                                            </div>
                                        )}
                                        <div className='text-xs text-slate-400 mt-2'>Applied: {new Date(selectedLeave.applied_at || Date.now()).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                                    <div className="flex flex-col gap-6 mb-8">
                                        {/* Consolidated Leave Details Card */}
                                        <div data-tour-id="leave-admin-details" className="bg-slate-50 dark:bg-[#0d1117] p-6 rounded-xl border border-slate-200/80 dark:border-[#30363d] w-full space-y-5 shadow-sm">
                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-1">Leave Type</span>
                                                <span className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">{selectedLeave.leave_type}</span>
                                            </div>
                                            
                                            <div className="flex gap-10">
                                                <div>
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-1">From</span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{new Date(selectedLeave.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-1">To</span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{new Date(selectedLeave.end_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-1">Duration</span>
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{calculateDays(selectedLeave.start_date, selectedLeave.end_date)} Days</span>
                                            </div>

                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-1">Reason</span>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 italic mt-0.5">"{selectedLeave.reason}"</p>
                                            </div>

                                            {/* Selected employee balances display for Admins */}
                                            {isAdmin && selectedEmployeeBalances.length > 0 && (
                                                <div className="border-t border-slate-200/60 dark:border-[#30363d] pt-4">
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-2">Employee Leave Balances</span>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {selectedEmployeeBalances.map(bal => (
                                                            <div key={bal.lb_id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border p-2.5 rounded-lg flex flex-col">
                                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-355 truncate">{bal.leave_type}</span>
                                                                <div className="flex justify-between items-baseline mt-1">
                                                                    <span className="text-xs font-black text-indigo-650 dark:text-indigo-400">{Number(bal.available)} days left</span>
                                                                    <span className="text-[9px] text-slate-400 uppercase font-bold">{Number(bal.used)} used</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Attachments Section - Condensed with Inline Expansion */}
                                            {selectedLeave.attachments && selectedLeave.attachments.length > 0 && (
                                                <div className="border-t border-slate-200/60 dark:border-[#30363d] pt-4">
                                                    <div
                                                        className="flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 p-2 -mx-2 rounded-lg transition-colors gap-10"
                                                        onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Paperclip size={18} className="text-slate-400" />
                                                            <span className="text-sm font-medium text-slate-700 dark:text-github-dark-text">
                                                                {selectedLeave.attachments.length} Attachments
                                                            </span>
                                                        </div>
                                                        <div
                                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
                                                        >
                                                            {attachmentsExpanded ? 'Hide' : 'View All'}
                                                            <ChevronDown size={14} className={`transform transition-transform ${attachmentsExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </div>

                                                    {/* Expanded Content */}
                                                    {attachmentsExpanded && (
                                                        <div className="mt-3 space-y-2">
                                                            {selectedLeave.attachments.map((file, index) => (
                                                                <div
                                                                    key={index}
                                                                    onClick={() => setViewingAttachment(file)}
                                                                    className="flex items-center gap-3 p-3 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-[#30363d] rounded-lg hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-sm transition-all group cursor-pointer"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                                        <FileText size={16} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-slate-700 dark:text-github-dark-text truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                                            {file.file_key.split('/').pop()}
                                                                        </p>
                                                                        <p className="text-[10px] text-slate-400 uppercase font-bold">
                                                                            {file.file_type ? file.file_type.split('/')[1]?.toUpperCase() : 'FILE'}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
                                                                        <ExternalLink size={14} />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Action / Remarks Section */}
                                            <div data-tour-id="leave-admin-actions" className="border-t border-slate-200/60 dark:border-[#30363d] pt-4">
                                                {selectedLeave.status === 'pending' ? (
                                                    <>
                                                        <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-2">Admin Action</span>
                                                        
                                                        <div className="mb-4">
                                                            <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-1.5">Pay Type</span>
                                                            <div className="flex gap-4">
                                                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name="payType"
                                                                        value="Paid"
                                                                        checked={adminAction.payType === 'Paid'}
                                                                        onChange={(e) => setAdminAction({ ...adminAction, payType: e.target.value })}
                                                                        className="text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                                    />
                                                                    Paid Leave
                                                                </label>
                                                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name="payType"
                                                                        value="Unpaid"
                                                                        checked={adminAction.payType === 'Unpaid'}
                                                                        onChange={(e) => setAdminAction({ ...adminAction, payType: e.target.value })}
                                                                        className="text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                                    />
                                                                    Unpaid Leave
                                                                </label>
                                                            </div>
                                                        </div>

                                                        <textarea
                                                            ref={adminRemarksRef}
                                                            value={adminAction.remarks}
                                                            onChange={(e) => setAdminAction({ ...adminAction, remarks: e.target.value })}
                                                            rows="1"
                                                            placeholder="Add remarks (required for rejection)..."
                                                            className="w-full p-3 text-sm bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border text-slate-800 dark:text-github-dark-text rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none overflow-hidden min-h-[42px] mb-3"
                                                        ></textarea>

                                                        <div className="flex gap-3 max-w-xs">
                                                            <button
                                                                onClick={() => handleAdminAction('approved')}
                                                                className="flex-1 py-2 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-md hover:bg-emerald-700 cursor-pointer active:scale-95"
                                                            >
                                                                <CheckCircle size={14} /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleAdminAction('rejected')}
                                                                className="flex-1 py-2 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 bg-red-600 text-white shadow-md hover:bg-red-700 cursor-pointer active:scale-95"
                                                            >
                                                                <XCircle size={14} /> Reject
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="mb-4">
                                                            <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-1">
                                                                Pay Status
                                                            </span>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                                                selectedLeave.pay_type === 'Paid'
                                                                    ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                    : 'text-red-700 bg-red-50 dark:bg-red-950/20 dark:text-red-400'
                                                            }`}>
                                                                {selectedLeave.pay_type || 'Unspecified'}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.12em] block mb-1">
                                                            Admin Remarks
                                                        </span>
                                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                                                            {selectedLeave.admin_comment || "No remarks provided."}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <FileText size={48} className="mb-4 opacity-50" />
                                <p>Select a request to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="w-full">
                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col h-full min-h-[500px]">

                    {/* --- LIST HEADER WITH FILTERS --- */}
                    <div className="px-6 py-5 border-b border-slate-200 dark:border-github-dark-border flex flex-wrap gap-4 justify-between items-center bg-slate-50/50 dark:bg-github-dark-subtle/10">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-github-dark-text">Leave History</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-github-dark-subtle px-2 py-1 rounded-md">
                                    {filteredLeaves.length} Records
                                </div>
                                <div className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-200 px-3 py-1.5 rounded-md border border-indigo-100 dark:border-indigo-500/30">
                                    Total Approved: {totalApprovedDays} Days
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Apply Button */}
                            <button
                                onClick={() => setShowForm(true)}
                                data-tour-id="leave-request-btn"
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md text-xs font-bold active:scale-95 cursor-pointer mr-2"
                            >
                                <Plus size={14} />
                                Apply for Leave
                            </button>

                            {/* Month Picker */}
                            <MinimalSelect
                                options={Array.from({ length: 12 }, (_, i) => ({
                                    value: i,
                                    label: new Date(0, i).toLocaleString('default', { month: 'long' })
                                }))}
                                value={selectedMonth}
                                onChange={(val) => setSelectedMonth(val)}
                                size="sm"
                                triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-github-dark-border shadow-sm font-semibold"
                                menuWidth={130}
                            />

                            {/* Year Picker */}
                            <MinimalSelect
                                options={Array.from({ length: 5 }, (_, i) => {
                                    const y = new Date().getFullYear() - 2 + i;
                                    return { value: y, label: String(y) };
                                })}
                                value={selectedYear}
                                onChange={(val) => setSelectedYear(val)}
                                size="sm"
                                triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-github-dark-border shadow-sm font-semibold"
                                menuWidth={90}
                            />
                        </div>
                    </div>

                    {/* --- LEAVE DASHBOARD OVERVIEW --- */}
                    {!isAdmin && myBalances.length > 0 && (
                        <div className="p-6 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/10 dark:bg-github-dark-subtle/5 space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.15em]">Leave Dashboard</h4>
                                <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-full">
                                    Calendar Year {selectedYear}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Overall Utilization Circle Card */}
                                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-6 shadow-sm flex items-center justify-around gap-4">
                                    <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle
                                                cx="56"
                                                cy="56"
                                                r="48"
                                                className="stroke-slate-100 dark:stroke-github-dark-border"
                                                strokeWidth="8"
                                                fill="transparent"
                                            />
                                            <circle
                                                cx="56"
                                                cy="56"
                                                r="48"
                                                className="stroke-indigo-600 transition-all duration-1000 ease-out"
                                                strokeWidth="8"
                                                fill="transparent"
                                                strokeDasharray={301.6}
                                                strokeDashoffset={301.6 - (Math.min(usedPercentage, 100) / 100) * 301.6}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute flex flex-col items-center">
                                            <span className="text-xl font-black text-slate-800 dark:text-github-dark-text">{usedPercentage}%</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Used</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <div>
                                            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Annual Leave Overview</h5>
                                            <p className="text-[10px] text-slate-405 mt-0.5">Track your overall leave utilization</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Quota</p>
                                                <p className="text-sm font-black text-slate-700 dark:text-github-dark-text">{totalQuota} Days</p>
                                            </div>
                                            <div className="border-l border-slate-100 dark:border-github-dark-border pl-4">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Used</p>
                                                <p className="text-sm font-black text-slate-700 dark:text-github-dark-text">{totalUsed} Days</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Linear Progress Cards Grid */}
                                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {myBalances.map((bal, idx) => {
                                        const balQuota = Number(bal.allocated) + Number(bal.carried_forward);
                                        const percentUsed = balQuota > 0 ? Math.round((Number(bal.used) / balQuota) * 100) : 0;
                                        
                                        // Pick distinct color profiles
                                        const colors = [
                                            { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-650', track: 'bg-indigo-50 dark:bg-indigo-950/20' },
                                            { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500', track: 'bg-rose-50 dark:bg-rose-950/20' },
                                            { text: 'text-teal-650 dark:text-teal-400', bg: 'bg-teal-500', track: 'bg-teal-50 dark:bg-teal-950/20' },
                                            { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', track: 'bg-amber-50 dark:bg-amber-950/20' }
                                        ][idx % 4];

                                        return (
                                            <div key={bal.lb_id} className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">{bal.leave_type}</span>
                                                        <div className="flex items-baseline gap-1.5 mt-1">
                                                            <span className="text-2xl font-black text-slate-800 dark:text-github-dark-text leading-none">{Number(bal.available)}</span>
                                                            <span className="text-xs text-slate-500 dark:text-github-dark-muted">available</span>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${colors.track} ${colors.text}`}>
                                                        {percentUsed}% Consumed
                                                    </span>
                                                </div>

                                                <div className="mt-4 space-y-1.5">
                                                    <div className={`w-full h-2 rounded-full ${colors.track} overflow-hidden`}>
                                                        <div
                                                            className={`h-full ${colors.bg} rounded-full transition-all duration-1000`}
                                                            style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between text-[9px] font-bold text-slate-400 select-none">
                                                        <span>{Number(bal.used)} Days Used</span>
                                                        <span>{balQuota} Days Total</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {filteredLeaves.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                            <FileText size={48} className="mx-auto mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No Leave Records</h3>
                            <p className="max-w-sm mx-auto text-sm">No leave requests found for {new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-github-dark-subtle/50 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Current Status</th>
                                        <th className="px-6 py-4">Duration</th>
                                        <th className="px-6 py-4">Reason</th>
                                        <th className="px-6 py-4">Date Applied</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {filteredLeaves.map((leave) => (
                                        <tr 
                                            key={leave.lr_id} 
                                            onClick={() => setSelectedLeave(selectedLeave?.lr_id === leave.lr_id ? null : leave)}
                                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer ${selectedLeave?.lr_id === leave.lr_id ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-sm text-slate-800 dark:text-github-dark-text">{leave.leave_type}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                                    leave.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                                                        'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${leave.status === 'approved' ? 'bg-emerald-500' :
                                                        leave.status === 'rejected' ? 'bg-red-500' :
                                                            'bg-amber-500'
                                                        }`}></span>
                                                    {leave.status}
                                                </span>
                                                {leave.status === 'approved' && leave.pay_type && (
                                                    <div className="mt-1">
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                            leave.pay_type === 'Paid'
                                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 border border-emerald-500/10'
                                                                : 'bg-red-50 text-red-650 dark:bg-red-500/5 dark:text-red-400 border border-red-500/10'
                                                        }`}>
                                                            {leave.pay_type}
                                                        </span>
                                                    </div>
                                                )}
                                                {leave.admin_comment && (
                                                    <p className="text-[10px] text-slate-500 mt-1 max-w-[120px] truncate" title={leave.admin_comment}>
                                                        Note: {leave.admin_comment}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{calculateDays(leave.start_date, leave.end_date)} Days</span>
                                                    <span className="text-[10px] text-slate-400 mt-0.5">
                                                        {new Date(leave.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(leave.end_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-[200px]">
                                                <p className="text-sm text-slate-600 dark:text-github-dark-muted truncate" title={leave.reason}>
                                                    {leave.reason}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {new Date(leave.applied_at || Date.now()).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {leave.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleWithdraw(leave.lr_id)}
                                                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100"
                                                        title="Withdraw Request"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* --- APPLY FOR LEAVE DRAWER --- */}
            <AnimatePresence>
                {showForm && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowForm(false)}
                            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
                        />

                        {/* Sidebar Drawer */}
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-full max-w-[460px] z-50 bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                        <Plus size={20} />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-github-dark-text">Apply for Leave</h3>
                                </div>
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <form onSubmit={handleApply} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5">Leave Type</label>
                                    <div className="relative">
                                        <select
                                            value={formData.leave_type}
                                            onChange={(e) => {
                                                if (e.target.value === 'Other') {
                                                    setIsCustomType(true);
                                                    setFormData({ ...formData, leave_type: '' });
                                                } else {
                                                    setIsCustomType(false);
                                                    setFormData({ ...formData, leave_type: e.target.value });
                                                }
                                            }}
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-github-dark-text font-medium cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-900"
                                        >
                                            {myBalances.map(bal => (
                                                <option key={bal.rule_id} value={bal.rule_id}>
                                                    {bal.leave_type} ({Number(bal.available)} days left)
                                                </option>
                                            ))}
                                            {myBalances.length === 0 && (
                                                <>
                                                    <option value="Casual Leave">Casual Leave</option>
                                                    <option value="Sick Leave">Sick Leave</option>
                                                </>
                                            )}
                                            <option value="Other">Other</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                    </div>
                                    {isCustomType && (
                                        <input
                                            type="text"
                                            placeholder="Enter custom leave type"
                                            value={formData.leave_type}
                                            onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                                            className="w-full px-3 py-2.5 mt-3 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-github-dark-text"
                                        />
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <DatePicker
                                            label="Start Date"
                                            value={formData.start_date}
                                            onChange={(date) => setFormData({ ...formData, start_date: date })}
                                            placeholder="Select date"
                                        />
                                    </div>
                                    <div>
                                        <DatePicker
                                            label="End Date"
                                            value={formData.end_date}
                                            onChange={(date) => setFormData({ ...formData, end_date: date })}
                                            placeholder="Select date"
                                        />
                                    </div>
                                </div>

                                {formData.start_date && formData.end_date && (
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center gap-2">
                                        <Clock size={14} />
                                        Total Duration: {calculateDays(formData.start_date, formData.end_date)} Days
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5">Reason</label>
                                    <textarea
                                        required
                                        rows="1"
                                        value={formData.reason}
                                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                        onInput={handleTextareaInput}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-github-dark-text resize-none placeholder-slate-400 overflow-hidden min-h-[42px]"
                                        placeholder="Why do you need leave?"
                                    ></textarea>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5">Attachments (Optional)</label>
                                    <div className="space-y-3">
                                         {/* Upload Area */}
                                         <div className="relative group">
                                             <input
                                                 type="file"
                                                 id="leave-attachment"
                                                 className="hidden"
                                                 multiple
                                                 accept=".jpg,.jpeg,.png,.pdf"
                                                 onChange={handleFileChange}
                                             />
                                             <label
                                                 htmlFor="leave-attachment"
                                                 className="w-full flex flex-col items-center gap-2 px-4 py-6 bg-slate-50 dark:bg-github-dark-subtle border-2 border-dashed border-slate-300 dark:border-github-dark-border rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group-hover:scale-[1.01]"
                                             >
                                                 <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                     <Paperclip size={18} />
                                                 </div>
                                                 <div className="text-center">
                                                     <span className="text-sm font-medium text-slate-700 dark:text-github-dark-text">
                                                         Click to upload documents
                                                     </span>
                                                     <p className="text-xs text-slate-400 mt-1">
                                                         JPG, PNG, PDF (Max 5MB)
                                                     </p>
                                                 </div>
                                             </label>
                                         </div>

                                         {/* Selected Files List */}
                                         {formData.attachments && formData.attachments.length > 0 && (
                                             <div className="grid grid-cols-1 gap-2">
                                                 {formData.attachments.map((file, index) => (
                                                     <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                                         <div className="flex items-center gap-3 overflow-hidden">
                                                             <div className="w-8 h-8 rounded bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                                                 <FileText size={16} />
                                                             </div>
                                                             <div className="min-w-0">
                                                                 <p className="text-sm font-medium text-slate-700 dark:text-github-dark-text truncate">
                                                                     {file.name}
                                                                 </p>
                                                                 <p className="text-[10px] text-slate-400 uppercase font-bold">
                                                                     {(file.size / 1024).toFixed(1)} KB
                                                                 </p>
                                                             </div>
                                                         </div>
                                                         <button
                                                             type="button"
                                                             onClick={(e) => {
                                                                 e.preventDefault();
                                                                 removeFile(index);
                                                             }}
                                                             className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                             title="Remove file"
                                                         >
                                                             <Trash2 size={16} />
                                                         </button>
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={18} />
                                    Submit Request
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {confirmModal.isOpen && (
                    <ConfirmationModal
                        {...confirmModal}
                        isSubmitting={isWithdrawing}
                        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default LeaveApplication;
