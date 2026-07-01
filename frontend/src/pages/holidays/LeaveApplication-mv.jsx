import React, { useState, useEffect, useRef } from 'react';
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
import MobileSelect from '../../components/MobileSelect';
import { AnimatePresence } from 'framer-motion';

const AttachmentModal = ({ file, onClose }) => {
    if (!file) return null;
    const isImage = file.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file_key || file.name);
    const isPdf = file.file_type === 'application/pdf' || /\.pdf$/i.test(file.file_key || file.name);

    return createPortal(
        <div className="fixed inset-0 z-[600] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose}></div>
                <div className="relative z-10 bg-white dark:bg-github-dark-subtle rounded-2xl overflow-hidden w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 mx-auto">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                            {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-sm truncate max-w-[150px]">
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
        </div>,
        document.body
    );
};

const LeaveApplication = () => {
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

    // Helper to calculate days
    const calculateDays = (start, end) => {
        if (!start || !end) return 0;
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = Math.abs(e - s);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 0;
    };

    const totalApprovedDays = React.useMemo(() => {
        return filteredLeaves
            .filter(l => l.status === 'approved')
            .reduce((acc, curr) => {
                const diffDays = calculateDays(curr.start_date, curr.end_date);
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
                const fetched = isAdmin
                    ? (res.history || res.requests || [])
                    : (res.leaves || []);

                setLeaves(fetched);
                // For mobile, do NOT select first item by default to keep list view clean
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
                setFormData({ leave_type: myBalances[0]?.rule_id ? String(myBalances[0].rule_id) : 'Casual Leave', start_date: '', end_date: '', reason: '', attachments: [] });
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
                        if (selectedLeave?.lr_id === leaveId) setSelectedLeave(null);
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
                status: actionStatus.charAt(0).toUpperCase() + actionStatus.slice(1),
                admin_comment: adminAction.remarks
            };

            const res = await leaveService.updateLeaveStatus(selectedLeave.lr_id, payload);
            if (res.ok) {
                toast.success(`Leave request ${actionStatus.toLowerCase()} successfully`);
                const updatedLeaves = leaves.map(l =>
                    l.lr_id === selectedLeave.lr_id
                        ? { ...l, status: actionStatus.toLowerCase(), admin_comment: adminAction.remarks }
                        : l
                );
                setLeaves(updatedLeaves);
                setSelectedLeave({ ...selectedLeave, status: actionStatus.toLowerCase(), admin_comment: adminAction.remarks });
                setAdminAction({ status: '', remarks: '', payType: 'Paid', payPercentage: 100 });
            }
        } catch (error) {
            console.error("Action error", error);
            toast.error(error.message || "Failed to update status");
        }
    };

    if (loading && !leaves.length) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    // --- MOBILE ADMIN LIST VIEW ---
    if (isAdmin && !showForm && !selectedLeave) {
        const filteredLeavesList = leaves.filter(leaf => {
            const matchesSearch = leaf.user_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || leaf.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        return (
            <MobileDashboardLayout title="Leave Requests">
                <div className="space-y-4 pb-20">
                    {/* Header & Controls */}
                    <div className="bg-white dark:bg-github-dark-subtle p-4 rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border space-y-3 sticky top-0 z-10">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-github-dark-text">Leave Requests</h3>
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg shadow-sm text-xs font-bold"
                            >
                                <Plus size={14} /> Apply
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 text-xs bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-700 dark:text-github-dark-text font-semibold cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <option value="all">All</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        {filteredLeavesList.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">No requests found.</div>
                        ) : (
                            filteredLeavesList.map((request) => (
                                <div
                                    key={request.lr_id}
                                    onClick={() => setSelectedLeave(request)}
                                    className="bg-white dark:bg-github-dark-subtle p-4 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm active:scale-[0.98] transition-all"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                {request.profile_image_url && request.profile_image_url.startsWith('http') ? (
                                                    <img src={`${request.profile_image_url}?t=${avatarTimestamp}`} alt={request.user_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    (request.user_name || 'U').charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-github-dark-text">{request.user_name}</p>
                                                <p className="text-xs text-slate-500 dark:text-github-dark-muted">{request.email}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${request.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                            request.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                            {request.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-github-dark-muted mt-3 pt-3 border-t border-slate-50 dark:border-github-dark-border">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(request.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        <span>{request.leave_type}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </MobileDashboardLayout >
        );
    }

    // --- DETAIL VIEW (Admin & User Reuse) ---
    if (selectedLeave) {
        return (
            <MobileDashboardLayout title="Request Details">
                <div className="pb-6">
                    {/* Detail Header */}
                    <div className="flex items-center gap-2 mb-4">
                        <button onClick={() => setSelectedLeave(null)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft size={20} /></button>
                        <h3 className="font-bold text-lg">Request Details</h3>
                    </div>

                    <div className="bg-white dark:bg-github-dark-subtle rounded-xl border border-slate-200 dark:border-github-dark-border overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/10">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                        {selectedLeave.profile_image_url && selectedLeave.profile_image_url.startsWith('http') ? (
                                            <img src={`${selectedLeave.profile_image_url}?t=${avatarTimestamp}`} alt={selectedLeave.user_name} className="w-full h-full object-cover" />
                                        ) : (
                                            (selectedLeave.user_name || 'U').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-github-dark-text">{selectedLeave.leave_type}</h2>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1">
                                            By <span className="font-bold text-slate-700 dark:text-slate-300">{selectedLeave.user_name}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${selectedLeave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                    selectedLeave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {selectedLeave.status}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-github-dark-subtle/50 p-3 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                    <span className="text-xs text-slate-500 dark:text-github-dark-muted block mb-1">From</span>
                                    <span className="font-mono text-sm font-semibold text-slate-800 dark:text-github-dark-text">{new Date(selectedLeave.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-github-dark-subtle/50 p-3 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                    <span className="text-xs text-slate-500 dark:text-github-dark-muted block mb-1">To</span>
                                    <span className="font-mono text-sm font-semibold text-slate-800 dark:text-github-dark-text">{new Date(selectedLeave.end_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-github-dark-subtle/50 p-4 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                <div className="flex items-start gap-3">
                                    <MessageSquare size={16} className="text-slate-400 mt-0.5" />
                                    <div>
                                        <span className="text-xs text-slate-400 mb-1 block">Reason</span>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{selectedLeave.reason}"</p>
                                    </div>
                                </div>
                            </div>

                            {/* Selected employee balances display for Admins */}
                            {isAdmin && selectedEmployeeBalances.length > 0 && (
                                <div className="border-t border-slate-100 dark:border-github-dark-border pt-4">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Employee Leave Balances</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedEmployeeBalances.map(bal => (
                                            <div key={bal.lb_id} className="bg-slate-50 dark:bg-github-dark-subtle/50 p-2.5 rounded-lg border border-slate-100 dark:border-github-dark-border flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{bal.leave_type}</span>
                                                <div className="flex justify-between items-baseline mt-1">
                                                    <span className="text-xs font-black text-indigo-650 dark:text-indigo-400">{Number(bal.available)} days left</span>
                                                    <span className="text-[9px] text-slate-400 uppercase font-bold">{Number(bal.used)} used</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedLeave.attachments && selectedLeave.attachments.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Attachments</h4>
                                    <div className="space-y-2">
                                        {selectedLeave.attachments.map((file, index) => (
                                            <div key={index} onClick={() => setViewingAttachment(file)} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-lg border border-slate-100 dark:border-github-dark-border cursor-pointer">
                                                <FileText size={16} className="text-indigo-500" />
                                                <span className="text-sm truncate flex-1">{file.file_key.split('/').pop()}</span>
                                                <ExternalLink size={14} className="text-slate-400" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Admin Action Area */}
                            {isAdmin && selectedLeave.status === 'pending' && (
                                <div className="border-t border-slate-100 dark:border-github-dark-border pt-5 mt-2">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-github-dark-text mb-3">Take Action</h4>
                                    <textarea
                                        ref={adminRemarksRef}
                                        value={adminAction.remarks}
                                        onChange={(e) => setAdminAction({ ...adminAction, remarks: e.target.value })}
                                        rows="1"
                                        placeholder="Enter remarks..."
                                        className="w-full p-3 text-sm bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border text-slate-800 dark:text-github-dark-text rounded-lg resize-none overflow-hidden min-h-[42px] mb-3"
                                    ></textarea>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => handleAdminAction('rejected')} className="py-2.5 bg-red-100 text-red-700 font-bold rounded-lg text-sm">Reject</button>
                                        <button onClick={() => handleAdminAction('approved')} className="py-2.5 bg-emerald-600 text-white font-bold rounded-lg text-sm">Approve</button>
                                    </div>
                                </div>
                            )}

                            {/* Details for User (Remarks) */}
                            {(!isAdmin || selectedLeave.status !== 'pending') && (
                                <div className="bg-slate-50 dark:bg-github-dark-subtle/50 p-4 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                    <span className="text-xs text-slate-500 dark:text-github-dark-muted block mb-1">Admin Remarks</span>
                                    <p className="text-sm font-medium text-slate-800 dark:text-github-dark-text">{selectedLeave.admin_comment || "No remarks provided."}</p>
                                </div>
                            )}

                            {!isAdmin && selectedLeave.status === 'pending' && (
                                <button
                                    onClick={() => handleWithdraw(selectedLeave.lr_id)}
                                    className="w-full py-3 mt-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-bold text-sm border border-red-200"
                                >
                                    Withdraw Request
                                </button>
                            )}
                        </div>
                    </div>

                    {viewingAttachment && (
                        <AttachmentModal
                            file={viewingAttachment}
                            onClose={() => setViewingAttachment(null)}
                        />
                    )}
                </div>
            </MobileDashboardLayout>
        );
    }

    // --- DEFAULT USER APPLY & LIST VIEW ---
    return (
        <MobileDashboardLayout title="Apply Leave">
            <div className="space-y-6 pb-20 animate-in fade-in duration-300">
                {/* Leave Dashboard display */}
                {!isAdmin && myBalances.length > 0 && (
                    <div className="space-y-3">
                        {/* Overall Utilization Card for Mobile */}
                        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-2xl shadow-sm flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Leave Balance Year {selectedYear}</span>
                                <h3 className="text-base font-black text-slate-800 dark:text-github-dark-text">Annual Leave Dashboard</h3>
                                <div className="flex gap-4 mt-2">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Quota</p>
                                        <p className="text-xs font-black text-slate-700 dark:text-github-dark-text">{totalQuota} Days</p>
                                    </div>
                                    <div className="border-l border-slate-100 dark:border-github-dark-border pl-3">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Used</p>
                                        <p className="text-xs font-black text-slate-700 dark:text-github-dark-text">{totalUsed} Days</p>
                                    </div>
                                    <div className="border-l border-slate-100 dark:border-github-dark-border pl-3">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Available</p>
                                        <p className="text-xs font-black text-indigo-650 dark:text-indigo-400">{totalAvailable} Days</p>
                                    </div>
                                </div>
                            </div>
                            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="32"
                                        cy="32"
                                        r="26"
                                        className="stroke-slate-100 dark:stroke-github-dark-border"
                                        strokeWidth="5"
                                        fill="transparent"
                                    />
                                    <circle
                                        cx="32"
                                        cy="32"
                                        r="26"
                                        className="stroke-indigo-600 transition-all duration-1000 ease-out"
                                        strokeWidth="5"
                                        fill="transparent"
                                        strokeDasharray={163.3}
                                        strokeDashoffset={163.3 - (Math.min(usedPercentage, 100) / 100) * 163.3}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className="absolute text-xs font-black text-slate-800 dark:text-github-dark-text">{usedPercentage}%</span>
                            </div>
                        </div>

                        {/* Individual Leave Type Progress Bars */}
                        <div className="grid grid-cols-2 gap-3">
                            {myBalances.map((bal, idx) => {
                                const balQuota = Number(bal.allocated) + Number(bal.carried_forward);
                                const percentUsed = balQuota > 0 ? Math.round((Number(bal.used) / balQuota) * 100) : 0;
                                const colors = [
                                    { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-650', track: 'bg-indigo-50 dark:bg-indigo-950/20' },
                                    { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500', track: 'bg-rose-50 dark:bg-rose-950/20' },
                                    { text: 'text-teal-650 dark:text-teal-400', bg: 'bg-teal-500', track: 'bg-teal-50 dark:bg-teal-950/20' },
                                    { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', track: 'bg-amber-50 dark:bg-amber-950/20' }
                                ][idx % 4];

                                return (
                                    <div key={bal.lb_id} className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider truncate flex-1 mr-1">{bal.leave_type}</span>
                                            <span className={`text-[8px] font-black uppercase px-1 py-0.5 rounded shrink-0 ${colors.track} ${colors.text}`}>
                                                {percentUsed}%
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-1 mt-1.5 mb-3">
                                            <span className="text-xl font-black text-slate-800 dark:text-github-dark-text leading-none">{Number(bal.available)}</span>
                                            <span className="text-[9px] text-slate-450 dark:text-github-dark-muted font-bold">days left</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className={`w-full h-1.5 rounded-full ${colors.track} overflow-hidden`}>
                                                <div
                                                    className={`h-full ${colors.bg} rounded-full transition-all duration-1000`}
                                                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[8px] font-bold text-slate-400">
                                                <span>{Number(bal.used)} Used</span>
                                                <span>{Number(balQuota)} Max</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Form Card */}
                <div className="bg-white dark:bg-github-dark-subtle rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-5">
                    <div
                        onClick={() => setShowForm(!showForm)}
                        className="flex justify-between items-center cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Plus size={18} />
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-github-dark-text">Apply New Leave</h3>
                        </div>
                        <ChevronDown className={`transition-transform ${showForm ? 'rotate-180' : ''}`} size={20} />
                    </div>

                    {showForm && (
                        <form onSubmit={handleApply} className="mt-5 space-y-4 pt-4 border-t border-slate-100 dark:border-github-dark-border animate-in fade-in slide-in-from-top-2">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Leave Type</label>
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
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-lg text-sm font-semibold cursor-pointer"
                                >
                                    {myBalances.map(bal => (
                                        <option key={bal.rule_id} value={bal.rule_id}>
                                            {bal.leave_type} ({Number(bal.available)} left)
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
                            </div>
                            {isCustomType && (
                                <input
                                    type="text"
                                    placeholder="Enter type"
                                    value={formData.leave_type}
                                    onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-lg text-sm mt-2"
                                />
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <DatePicker
                                    label="Start Date"
                                    value={formData.start_date}
                                    onChange={(date) => setFormData({ ...formData, start_date: date })}
                                    placeholder="Start"
                                />
                                <DatePicker
                                    label="End Date"
                                    value={formData.end_date}
                                    onChange={(date) => setFormData({ ...formData, end_date: date })}
                                    placeholder="End"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Reason</label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    onInput={handleTextareaInput}
                                    className="w-full px-3 py-3 bg-slate-50 dark:bg-github-dark-subtle dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-lg text-sm min-h-[60px] resize-none"
                                    placeholder="Reason..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Attachments</label>
                                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                                    <label className="shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50">
                                        <Paperclip size={18} className="text-slate-400" />
                                        <span className="text-[10px] text-slate-500 mt-1">Add</span>
                                        <input type="file" multiple className="hidden" onChange={handleFileChange} />
                                    </label>
                                    {formData.attachments.map((file, i) => (
                                        <div key={i} className="shrink-0 w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 relative flex items-center justify-center">
                                            <FileText size={20} className="text-indigo-400" />
                                            <button type="button" onClick={() => removeFile(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-sm">Submit Request</button>
                        </form>
                    )}
                </div>

                {/* History List */}
                <div>
                    <div className="flex justify-between items-center px-2 mb-3">
                        <h3 className="font-bold text-slate-700 dark:text-github-dark-text">My History</h3>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-bold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        {filteredLeaves.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">No leaves in selected month.</div>
                        ) : (
                            filteredLeaves.map(leave => (
                                <div
                                    key={leave.lr_id}
                                    onClick={() => setSelectedLeave(leave)}
                                    className="bg-white dark:bg-github-dark-subtle p-4 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-github-dark-text">{leave.leave_type}</h4>
                                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                                <Calendar size={12} />
                                                <span>{new Date(leave.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(leave.end_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                            leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {leave.status}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {viewingAttachment && (
                    <AttachmentModal
                        file={viewingAttachment}
                        onClose={() => setViewingAttachment(null)}
                    />
                )}
            </div>
            <AnimatePresence>
                {confirmModal.isOpen && (
                    <ConfirmationModal
                        {...confirmModal}
                        isSubmitting={isWithdrawing}
                        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    />
                )}
            </AnimatePresence>
        </MobileDashboardLayout>
    );
};

export default LeaveApplication;
