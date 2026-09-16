
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

// Helper to calculate days
const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e - s);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
};

const LeaveApplication = ({ mode, onSelectLeave, onLeavesChange, onActiveRangeChange }) => {
    const navigate = useNavigate();

    const { user, avatarTimestamp } = useAuth();
    const [myLeaves, setMyLeaves] = useState([]);
    const [adminLeaves, setAdminLeaves] = useState([]);
    const [loading, setLoading] = useState(true);

    const isAdmin = user?.user_type === 'admin' || user?.user_type === 'hr';
    const effectiveMode = mode || (isAdmin ? 'approval' : 'my_leaves');
    const isApprovalView = isAdmin && effectiveMode === 'approval';
    const leaves = isApprovalView ? adminLeaves : myLeaves;
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
        onConfirm: () => { },
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
            .reduce((acc, curr) => acc + calculateDays(curr.start_date, curr.end_date), 0);
    }, [filteredLeaves]);

    // Portal target container in the line of the tab bar
    const [portalNode, setPortalNode] = useState(() => {
        return typeof document !== 'undefined' ? document.getElementById('holiday-tab-actions') : null;
    });

    useEffect(() => {
        if (!portalNode && typeof document !== 'undefined') {
            const el = document.getElementById('holiday-tab-actions');
            if (el) setPortalNode(el);
        }
    }, [portalNode]);

    const myLeaveActionButtons = (
        <div className="flex items-center gap-2 flex-wrap">
            <button
                onClick={() => setShowForm(true)}
                data-tour-id="leave-request-btn"
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm text-xs font-semibold active:scale-95 cursor-pointer"
            >
                <Plus size={14} />
                <span>Apply for Leave</span>
            </button>
            <MinimalSelect
                options={Array.from({ length: 12 }, (_, i) => ({
                    value: i,
                    label: new Date(0, i).toLocaleString('default', { month: 'long' })
                }))}
                value={selectedMonth}
                onChange={(val) => setSelectedMonth(val)}
                size="sm"
                triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-github-dark-border shadow-sm font-semibold text-xs"
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
                triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-github-dark-border shadow-sm font-semibold text-xs"
                menuWidth={90}
            />
        </div>
    );

    const adminActionButtons = (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                    type="text"
                    placeholder="Search by employee name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-36 sm:w-52 pl-8 pr-3 py-1.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text shadow-sm"
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
                triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-github-dark-border shadow-sm font-semibold text-xs"
                menuWidth={110}
            />
            <button
                type="button"
                onClick={() => setShowForm(true)}
                data-tour-id="leave-request-btn"
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm text-xs font-semibold active:scale-95 cursor-pointer shrink-0"
            >
                <Plus size={14} />
                <span>Apply for Leave</span>
            </button>
        </div>
    );

    // eslint-disable-next-line no-unused-vars
    const { totalQuota, totalUsed, totalAvailable, usedPercentage } = React.useMemo(() => {
        const quota = myBalances.reduce((acc, b) => acc + Number(b.allocated) + Number(b.carried_forward), 0);
        const used = myBalances.reduce((acc, b) => acc + Number(b.used), 0);
        const avail = myBalances.reduce((acc, b) => acc + Number(b.available), 0);
        const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
        return { totalQuota: quota, totalUsed: used, totalAvailable: avail, usedPercentage: pct };
    }, [myBalances]);

    const selectedBalance = React.useMemo(() => {
        if (isCustomType) return null;
        return myBalances.find(b =>
            String(b.rule_id) === String(formData.leave_type) ||
            b.leave_type?.trim().toLowerCase() === String(formData.leave_type).trim().toLowerCase()
        );
    }, [myBalances, formData.leave_type, isCustomType]);

    // --- ADMIN FILTERED LEAVES ---
    const adminFilteredLeaves = React.useMemo(() => {
        if (!isAdmin) return [];
        return adminLeaves.filter(leaf => {
            const matchesSearch = (leaf.user_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || leaf.status === statusFilter;
            const isUserActive = leaf.is_active === undefined ? true : (leaf.is_active === 1 || leaf.is_active === true || leaf.is_active === '1');
            const isUserDeleted = leaf.is_deleted === undefined ? false : (leaf.is_deleted === 1 || leaf.is_deleted === true || leaf.is_deleted === '1');
            return matchesSearch && matchesStatus && isUserActive && !isUserDeleted;
        });
    }, [adminLeaves, isAdmin, searchTerm, statusFilter]);

    useEffect(() => {
        if (onLeavesChange) {
            onLeavesChange(isApprovalView ? adminLeaves : myLeaves);
        }
    }, [isApprovalView, adminLeaves, myLeaves, onLeavesChange]);

    useEffect(() => {
        if (user) {
            fetchLeaves();
            fetchPolicies();
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
            // 1. Fetch own personal leaves
            const myRes = await leaveService.getMyLeaves();
            const personalLeaves = myRes?.leaves || [];
            setMyLeaves(personalLeaves);

            // 2. If Admin/HR, also fetch all company leave requests
            if (isAdmin) {
                const adminRes = await leaveService.getAdminLeaves();
                if (adminRes.ok) {
                    const fetchedRaw = adminRes.history || adminRes.requests || [];
                    const activeRequests = fetchedRaw.filter(l => {
                        const isUserActive = l.is_active === undefined ? true : (l.is_active === 1 || l.is_active === true || l.is_active === '1');
                        const isUserDeleted = l.is_deleted === undefined ? false : (l.is_deleted === 1 || l.is_deleted === true || l.is_deleted === '1');
                        return isUserActive && !isUserDeleted;
                    });
                    setAdminLeaves(activeRequests);
                    if (isApprovalView && activeRequests.length > 0 && !selectedLeave) {
                        setSelectedLeave(activeRequests[0]);
                    }
                }
            }

            // 3. Fetch leave balances for the logged-in user
            const balRes = await leaveService.getMyLeaveBalances(selectedYear);
            if (balRes.ok) {
                const balances = balRes.balances || [];
                setMyBalances(balances);
                if (balances.length > 0 && !formData.leave_type) {
                    setFormData(prev => ({
                        ...prev,
                        leave_type: String(balances[0].rule_id)
                    }));
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
            if (isCustomType && (!formData.leave_type || !formData.leave_type.trim())) {
                toast.error("Please enter a custom leave type name.");
                return;
            }

            // Check if attachment is required per policy
            if (selectedBalance && selectedBalance.requires_doc && (!formData.attachments || formData.attachments.length === 0)) {
                toast.error(`An attachment is required for ${selectedBalance.leave_type} as per leave policy.`);
                return;
            }

            // Create FormData to handle file upload
            const data = new FormData();
            data.append('leave_type', formData.leave_type.trim());
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
                const updatedAdminLeaves = adminLeaves.map(l =>
                    l.lr_id === selectedLeave.lr_id
                        ? { ...l, status: actionStatus.toLowerCase(), admin_comment: adminAction.remarks, pay_type: adminAction.payType, pay_percentage: adminAction.payPercentage }
                        : l
                );
                setAdminLeaves(updatedAdminLeaves);
                setSelectedLeave({ ...selectedLeave, status: actionStatus.toLowerCase(), admin_comment: adminAction.remarks, pay_type: adminAction.payType, pay_percentage: adminAction.payPercentage });
                setAdminAction({ status: '', remarks: '', payType: 'Paid', payPercentage: 100 });
            }
        } catch (error) {
            console.error("Action error", error);
            toast.error(error.message || "Failed to update status");
        }
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
            {isApprovalView ? (
                <>
                    {portalNode ? (
                        createPortal(adminActionButtons, portalNode)
                    ) : (
                        <div className="flex items-center justify-end gap-2 mb-2">
                            {adminActionButtons}
                        </div>
                    )}
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
                        onOpenApply={() => setShowForm(true)}
                    />
                </>
            ) : (
                <div className="w-full space-y-4">
                    {/* Render action buttons into tab bar line if container exists */}
                    {portalNode ? (
                        createPortal(myLeaveActionButtons, portalNode)
                    ) : (
                        <div className="flex items-center justify-end gap-2 mb-2">
                            {myLeaveActionButtons}
                        </div>
                    )}

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

            {/* --- LEAVE DETAIL DRAWER --- */}
            <EmployeeLeaveDetailDrawer
                isOpen={!isApprovalView && Boolean(selectedLeave)}
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
                policies={policies}
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
