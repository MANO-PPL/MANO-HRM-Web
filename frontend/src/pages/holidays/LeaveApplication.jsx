
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
    ArrowLeft,
    Shield,
    BookOpen,
    Info
} from 'lucide-react';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import MinimalSelect from '../../components/MinimalSelect';
import { motion, AnimatePresence } from 'framer-motion';

import AdminLeaveRequests from './components/AdminLeaveRequests';
import EmployeeLeavePlan from './components/EmployeeLeavePlan';
import LeaveHistoryTable from './components/LeaveHistoryTable';
import EmployeeLeaveDetailDrawer from './components/EmployeeLeaveDetailDrawer';
import ApplyLeaveDrawer from './components/ApplyLeaveDrawer';
import AttachmentModal from './components/AttachmentModal';

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

    // Employee Policy View State
    const [policies, setPolicies] = useState([]);
    const [loadingPolicies, setLoadingPolicies] = useState(false);

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

    // eslint-disable-next-line no-unused-vars
    const { totalQuota, totalUsed, totalAvailable, usedPercentage } = React.useMemo(() => {
        const quota = myBalances.reduce((acc, b) => acc + Number(b.allocated) + Number(b.carried_forward), 0);
        const used = myBalances.reduce((acc, b) => acc + Number(b.used), 0);
        const avail = myBalances.reduce((acc, b) => acc + Number(b.available), 0);
        const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
        return { totalQuota: quota, totalUsed: used, totalAvailable: avail, usedPercentage: pct };
    }, [myBalances]);

    const selectedBalance = myBalances.find(b => String(b.rule_id) === String(formData.leave_type));

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
            if (user.user_type !== 'admin' && user.user_type !== 'hr') {
                fetchPolicies();
            }
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

    // Fetch leave policies for the employee view
    const fetchPolicies = async () => {
        if (isAdmin) return;
        setLoadingPolicies(true);
        try {
            const res = await leaveService.getLeavePolicies();
            if (res.ok) {
                setPolicies(res.policies || []);
            }
        } catch (error) {
            console.error("Failed to fetch policies", error);
        } finally {
            setLoadingPolicies(false);
        }
    };

    const handleApply = async (e) => {
        e.preventDefault();
        try {
            // Check if attachment is required per policy
            if (selectedBalance && selectedBalance.requires_doc && (!formData.attachments || formData.attachments.length === 0)) {
                toast.error(`An attachment is required for ${selectedBalance.leave_type} as per leave policy.`);
                return;
            }

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
                <AdminLeaveRequests
                    searchQuery={searchTerm}
                    setSearchQuery={setSearchTerm}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    adminFilteredLeaves={adminFilteredLeaves}
                    selectedLeave={selectedLeave}
                    setSelectedLeave={setSelectedLeave}
                    avatarTimestamp={avatarTimestamp}
                    calculateDays={calculateDays}
                    isAdmin={isAdmin}
                    selectedEmployeeBalances={selectedEmployeeBalances}
                    attachmentsExpanded={attachmentsExpanded}
                    setAttachmentsExpanded={setAttachmentsExpanded}
                    setViewingAttachment={setViewingAttachment}
                    adminAction={adminAction}
                    setAdminAction={setAdminAction}
                    adminRemarksRef={adminRemarksRef}
                    handleAdminAction={handleAdminAction}
                />
            ) : (
                <div className="w-full space-y-5">
                    {/* ── TOP ACTION BAR ── */}
                    <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border px-6 py-4 flex flex-wrap gap-4 justify-between items-center">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-base">My Leave</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-github-dark-subtle px-2 py-1 rounded-md">
                                    {filteredLeaves.length} Requests
                                </div>
                                <div className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-200 px-3 py-1.5 rounded-md border border-indigo-100 dark:border-indigo-500/30">
                                    {totalApprovedDays} Days Approved
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setShowForm(true)}
                                data-tour-id="leave-request-btn"
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md text-xs font-bold active:scale-95 cursor-pointer"
                            >
                                <Plus size={14} />
                                Apply for Leave
                            </button>
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

                    {/* ── MY LEAVE PLAN & BALANCES ── */}
                    <EmployeeLeavePlan
                        policies={policies}
                        loadingPolicies={loadingPolicies}
                        selectedYear={selectedYear}
                        myBalances={myBalances}
                    />

                    {/* ── LEAVE REQUEST HISTORY ── */}
                    <LeaveHistoryTable
                        filteredLeaves={filteredLeaves}
                        selectedLeave={selectedLeave}
                        setSelectedLeave={setSelectedLeave}
                        selectedYear={selectedYear}
                        selectedMonth={selectedMonth}
                        calculateDays={calculateDays}
                        handleWithdraw={handleWithdraw}
                    />
                </div>
            )}

            {/* --- LEAVE DETAIL DRAWER (Employee only) --- */}
            <EmployeeLeaveDetailDrawer
                isOpen={!isAdmin && Boolean(selectedLeave)}
                onClose={() => setSelectedLeave(null)}
                selectedLeave={selectedLeave}
                calculateDays={calculateDays}
                onWithdraw={(id) => {
                    setSelectedLeave(null);
                    handleWithdraw(id);
                }}
            />

            {/* --- APPLY FOR LEAVE DRAWER --- */}
            <ApplyLeaveDrawer
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                formData={formData}
                setFormData={setFormData}
                isCustomType={isCustomType}
                setIsCustomType={setIsCustomType}
                myBalances={myBalances}
                selectedBalance={selectedBalance}
                calculateDays={calculateDays}
                handleTextareaInput={handleTextareaInput}
                handleFileChange={handleFileChange}
                removeFile={removeFile}
                handleApply={handleApply}
            />

            {/* --- ATTACHMENT MODAL --- */}
            <AttachmentModal
                file={viewingAttachment}
                onClose={() => setViewingAttachment(null)}
            />

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
