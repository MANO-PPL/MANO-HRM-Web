import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    CalendarCheck, Plus, Search, RefreshCw, Users, Layers,
    Edit2, Trash2, X, ChevronRight, Check, AlertCircle, Clock,
    BookOpen, Shield, ShieldCheck, UserCheck, UserMinus, UserPlus,
    Calendar, CheckCircle2
} from 'lucide-react';
import { leaveService } from '../../services/leaveService';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import ProfilePictureModal from '../../components/modals/ProfilePictureModal';

const LeavePoliciesMobile = ({ embedded = false }) => {
    const { avatarTimestamp } = useAuth();
    const [previewAvatarData, setPreviewAvatarData] = useState(null);

    const openAvatarPreview = (userObj) => {
        if (!userObj) return;
        setPreviewAvatarData({
            imageUrl: userObj.profile_image_url ? `${userObj.profile_image_url}?t=${avatarTimestamp}` : null,
            name: userObj.user_name || 'Staff Member',
            role: userObj.desg_name || 'Staff',
            department: userObj.dept_name,
            email: userObj.email,
            phone: userObj.phone_no
        });
    };

    // Data State
    const [policies, setPolicies] = useState([]);
    const [selectedPolicyId, setSelectedPolicyId] = useState(null);
    const [allBalances, setAllBalances] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Navigation & Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [activeSubTab, setActiveSubTab] = useState(0); // 0: Policy Rules, 1: Staff Assignment

    // Modal / Drawer States
    const [isPolicyFormOpen, setIsPolicyFormOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState(null);
    const [policyForm, setPolicyForm] = useState({
        name: '',
        description: '',
        is_active: true
    });

    const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [ruleForm, setRuleForm] = useState({
        name: '',
        code: '',
        accural_type: 'No Accrual',
        accural_amount: 0,
        max_balance: 12,
        carry_forward: false,
        carry_forward_max: 0,
        encashable: false,
        is_paid: true,
        requires_doc: false
    });

    const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
    const [editingBalance, setEditingBalance] = useState(null);
    const [balanceForm, setBalanceForm] = useState({
        allocated: 0,
        carried_forward: 0,
        used: 0
    });

    const [isDeletePolicyOpen, setIsDeletePolicyOpen] = useState(false);
    const [isDeleteRuleOpen, setIsDeleteRuleOpen] = useState(false);
    const [ruleToDelete, setRuleToDelete] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load Data
    const loadPolicies = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await leaveService.getLeavePolicies();
            if (res.ok && res.policies) {
                setPolicies(res.policies);
                if (!selectedPolicyId && res.policies.length > 0) {
                    setSelectedPolicyId(res.policies[0].lp_id);
                }
            }
        } catch {
            toast.error('Failed to load leave policies');
        } finally {
            setIsLoading(false);
        }
    }, [selectedPolicyId]);

    const loadBalances = useCallback(async () => {
        try {
            const res = await leaveService.getAllEmployeesLeaveBalances(selectedYear);
            if (res.ok && res.balances) {
                setAllBalances(res.balances);
            }
        } catch {
            // Ignore balance errors
        }
    }, [selectedYear]);

    const loadEmployees = useCallback(async () => {
        try {
            const res = await adminService.getEmployees();
            if (res.ok && res.employees) {
                setEmployees(res.employees);
            }
        } catch {
            // Ignore employee error
        }
    }, []);

    useEffect(() => {
        loadPolicies();
        loadEmployees();
    }, [loadPolicies, loadEmployees]);

    useEffect(() => {
        loadBalances();
    }, [loadBalances]);

    // Selected policy object
    const selectedPolicy = policies.find(p => p.lp_id === selectedPolicyId) || policies[0] || null;
    const rules = selectedPolicy?.rules || [];

    // Filter policies
    const filteredPolicies = policies.filter(p =>
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Staff Classification
    const getStaffClassification = () => {
        if (!selectedPolicy) return { assigned: [], available: [] };
        const ruleIds = rules.map(r => r.rule_id);

        const userBalanceMap = {};
        allBalances.forEach(bal => {
            if (!userBalanceMap[bal.user_id]) userBalanceMap[bal.user_id] = [];
            userBalanceMap[bal.user_id].push(bal);
        });

        const assigned = [];
        const available = [];

        employees.forEach(emp => {
            const query = staffSearchQuery.toLowerCase();
            const matchesQuery = !query ||
                (emp.user_name || '').toLowerCase().includes(query) ||
                (emp.desg_name || '').toLowerCase().includes(query);

            if (!matchesQuery) return;

            const userBals = userBalanceMap[emp.user_id] || [];
            const policyBals = userBals.filter(b => ruleIds.includes(b.rule_id));

            if (policyBals.length > 0) {
                assigned.push({ ...emp, balances: policyBals });
            } else {
                available.push(emp);
            }
        });

        return { assigned, available };
    };

    const { assigned: assignedStaff, available: availableStaff } = getStaffClassification();

    // Handlers
    const handleOpenAddPolicy = () => {
        setEditingPolicy(null);
        setPolicyForm({ name: '', description: '', is_active: true });
        setIsPolicyFormOpen(true);
    };

    const handleOpenEditPolicy = (p) => {
        setEditingPolicy(p);
        setPolicyForm({
            name: p.name || '',
            description: p.description || '',
            is_active: p.is_active !== 0
        });
        setIsPolicyFormOpen(true);
    };

    const handleSavePolicy = async (e) => {
        e.preventDefault();
        if (!policyForm.name.trim()) {
            toast.error('Policy name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingPolicy) {
                const res = await leaveService.updateLeavePolicy(editingPolicy.lp_id, policyForm);
                if (res.ok) {
                    toast.success('Policy updated successfully');
                    setIsPolicyFormOpen(false);
                    loadPolicies();
                }
            } else {
                const res = await leaveService.createLeavePolicy(policyForm);
                if (res.ok) {
                    toast.success('Policy created successfully');
                    setIsPolicyFormOpen(false);
                    loadPolicies();
                }
            }
        } catch (err) {
            toast.error(err.message || 'Failed to save policy');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePolicy = async () => {
        if (!selectedPolicy) return;
        setIsSubmitting(true);
        try {
            const res = await leaveService.deleteLeavePolicy(selectedPolicy.lp_id);
            if (res.ok) {
                toast.success('Policy deleted successfully');
                setIsDeletePolicyOpen(false);
                setSelectedPolicyId(null);
                loadPolicies();
            }
        } catch (err) {
            toast.error(err.message || 'Failed to delete policy');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenAddRule = () => {
        setEditingRule(null);
        setRuleForm({
            name: '',
            code: '',
            accural_type: 'No Accrual',
            accural_amount: 0,
            max_balance: 12,
            carry_forward: false,
            carry_forward_max: 0,
            encashable: false,
            is_paid: true,
            requires_doc: false
        });
        setIsRuleFormOpen(true);
    };

    const handleOpenEditRule = (rule) => {
        setEditingRule(rule);
        setRuleForm({
            name: rule.name || '',
            code: rule.code || '',
            accural_type: rule.accural_type || 'No Accrual',
            accural_amount: rule.accural_amount ?? 0,
            max_balance: rule.max_balance ?? 12,
            carry_forward: !!rule.carry_forward,
            carry_forward_max: rule.carry_forward_max ?? 0,
            encashable: !!rule.encashable,
            is_paid: rule.is_paid !== false && rule.is_paid !== 0,
            requires_doc: !!rule.requires_doc
        });
        setIsRuleFormOpen(true);
    };

    const handleSaveRule = async (e) => {
        e.preventDefault();
        if (!selectedPolicy) return;
        if (!ruleForm.name.trim() || !ruleForm.code.trim()) {
            toast.error('Rule name and code are required');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...ruleForm,
                accural_amount: Number(ruleForm.accural_amount) || 0,
                max_balance: Number(ruleForm.max_balance) || 0,
                carry_forward_max: Number(ruleForm.carry_forward_max) || 0
            };

            if (editingRule) {
                const res = await leaveService.updateLeavePolicyRule(selectedPolicy.lp_id, editingRule.rule_id, payload);
                if (res.ok) {
                    toast.success('Rule updated successfully');
                    setIsRuleFormOpen(false);
                    loadPolicies();
                }
            } else {
                const res = await leaveService.createLeavePolicyRule(selectedPolicy.lp_id, payload);
                if (res.ok) {
                    toast.success('Rule added successfully');
                    setIsRuleFormOpen(false);
                    loadPolicies();
                }
            }
        } catch (err) {
            toast.error(err.message || 'Failed to save rule');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRule = async () => {
        if (!selectedPolicy || !ruleToDelete) return;
        setIsSubmitting(true);
        try {
            const res = await leaveService.deleteLeavePolicyRule(selectedPolicy.lp_id, ruleToDelete.rule_id);
            if (res.ok) {
                toast.success('Rule deleted successfully');
                setIsDeleteRuleOpen(false);
                setRuleToDelete(null);
                loadPolicies();
            }
        } catch (err) {
            toast.error(err.message || 'Failed to delete rule');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssignUser = async (user) => {
        if (!selectedPolicy) return;
        try {
            const res = await leaveService.assignPolicyToEmployees(selectedPolicy.lp_id, {
                user_ids: [user.user_id],
                year: selectedYear
            });
            if (res.ok) {
                toast.success(`Assigned ${user.user_name} to policy`);
                loadBalances();
            }
        } catch (err) {
            toast.error(err.message || 'Failed to assign policy');
        }
    };

    const handleUnassignUser = async (user) => {
        if (!selectedPolicy) return;
        try {
            // Delete all balances under this policy for this employee
            const userBals = (user.balances || []).filter(b => rules.some(r => r.rule_id === b.rule_id));
            for (const bal of userBals) {
                await leaveService.deleteLeaveBalance(bal.lb_id);
            }
            toast.success(`Unassigned ${user.user_name}`);
            loadBalances();
        } catch (err) {
            toast.error(err.message || 'Failed to unassign staff');
        }
    };

    const handleOpenAdjustBalance = (bal, user) => {
        setEditingBalance({ ...bal, user_name: user.user_name });
        setBalanceForm({
            allocated: bal.allocated || 0,
            carried_forward: bal.carried_forward || 0,
            used: bal.used || 0
        });
        setIsAdjustBalanceOpen(true);
    };

    const handleSaveAdjustBalance = async (e) => {
        e.preventDefault();
        if (!editingBalance) return;
        setIsSubmitting(true);
        try {
            const res = await leaveService.updateLeaveBalance(editingBalance.lb_id, {
                allocated: Number(balanceForm.allocated) || 0,
                carried_forward: Number(balanceForm.carried_forward) || 0,
                used: Number(balanceForm.used) || 0
            });
            if (res.ok) {
                toast.success('Leave balance adjusted');
                setIsAdjustBalanceOpen(false);
                loadBalances();
            }
        } catch (err) {
            toast.error(err.message || 'Failed to adjust balance');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full px-3 pt-2.5 pb-6 space-y-3">
            {/* Top Toolbar: Search + Refresh + Add */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search policy..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text placeholder:text-slate-400 shadow-2xs"
                    />
                </div>
                <button
                    onClick={() => { loadPolicies(); loadBalances(); }}
                    disabled={isLoading}
                    className="p-2.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button
                    onClick={handleOpenAddPolicy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
                >
                    <Plus size={15} />
                    <span>Add</span>
                </button>
            </div>

            {/* Horizontal Policy Selector Pills (matching Flutter app) */}
            {filteredPolicies.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {filteredPolicies.map((p) => {
                        const isSelected = p.lp_id === selectedPolicy?.lp_id;
                        return (
                            <button
                                key={p.lp_id}
                                onClick={() => setSelectedPolicyId(p.lp_id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer border ${isSelected
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                    : 'bg-white dark:bg-github-dark-subtle border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                <span>{p.name}</span>
                                <span className={`text-[10px] font-normal px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {p.rules?.length || 0}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Selected Policy Card & Actions */}
            {selectedPolicy ? (
                <div className="w-full bg-white dark:bg-dark-card rounded-2xl p-3.5 border border-slate-200/80 dark:border-github-dark-border shadow-2xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                                <CalendarCheck size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text truncate">
                                        {selectedPolicy.name}
                                    </h3>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${selectedPolicy.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
                                        {selectedPolicy.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                                    {selectedPolicy.description || 'No description configured.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => handleOpenEditPolicy(selectedPolicy)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Edit policy"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                onClick={() => setIsDeletePolicyOpen(true)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                                title="Delete policy"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Sub-Tab Segmented Controller: Rules vs Staff */}
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-github-dark-subtle rounded-xl border border-slate-200/60 dark:border-github-dark-border">
                        <button
                            onClick={() => setActiveSubTab(0)}
                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeSubTab === 0
                                ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                        >
                            <Layers size={13} />
                            <span>Policy Rules ({rules.length})</span>
                        </button>
                        <button
                            onClick={() => setActiveSubTab(1)}
                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeSubTab === 1
                                ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                        >
                            <Users size={13} />
                            <span>Staff ({assignedStaff.length})</span>
                        </button>
                    </div>

                    {/* SUBTAB 0: POLICY RULES VIEW */}
                    {activeSubTab === 0 && (
                        <div className="space-y-2.5 pt-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    Entitlement Rules
                                </span>
                                <button
                                    onClick={handleOpenAddRule}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors cursor-pointer"
                                >
                                    <Plus size={13} />
                                    <span>Add Rule</span>
                                </button>
                            </div>

                            {rules.length === 0 ? (
                                <div className="py-8 text-center border border-dashed border-slate-200 dark:border-github-dark-border rounded-xl p-4">
                                    <Layers size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">No rules configured</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Add rules for Casual Leave, Sick Leave, etc.</p>
                                    <button
                                        onClick={handleOpenAddRule}
                                        className="mt-2 text-xs font-medium text-indigo-600 hover:underline cursor-pointer"
                                    >
                                        + Configure first rule
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {rules.map((rule) => (
                                        <div
                                            key={rule.rule_id}
                                            className="bg-slate-50/70 dark:bg-github-dark-subtle/20 rounded-xl p-3 border border-slate-200/80 dark:border-github-dark-border space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-semibold text-xs flex items-center justify-center">
                                                        {rule.code || 'LV'}
                                                    </span>
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-slate-900 dark:text-github-dark-text">
                                                            {rule.name}
                                                        </h4>
                                                        <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded ${rule.is_paid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            {rule.is_paid ? 'Paid' : 'Unpaid'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleOpenEditRule(rule)}
                                                        className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                                        title="Edit rule"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setRuleToDelete(rule);
                                                            setIsDeleteRuleOpen(true);
                                                        }}
                                                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                                        title="Delete rule"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Rule Badges Strip */}
                                            <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                                                <span className="px-2 py-0.5 bg-white dark:bg-dark-card border border-slate-200/60 dark:border-github-dark-border rounded-md font-mono">
                                                    Max: {rule.max_balance}d
                                                </span>
                                                <span className="px-2 py-0.5 bg-white dark:bg-dark-card border border-slate-200/60 dark:border-github-dark-border rounded-md">
                                                    {rule.accural_type || 'No Accrual'}
                                                </span>
                                                {rule.carry_forward ? (
                                                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-md font-medium">
                                                        Carry Fwd: Max {rule.carry_forward_max}d
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-md">
                                                        No Carry Forward
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SUBTAB 1: STAFF ASSIGNMENT VIEW */}
                    {activeSubTab === 1 && (
                        <div className="space-y-3 pt-1">
                            {/* Year Picker & Staff Search */}
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                    <input
                                        type="text"
                                        placeholder="Search staff..."
                                        value={staffSearchQuery}
                                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="px-2.5 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none"
                                >
                                    {[2024, 2025, 2026, 2027].map(yr => (
                                        <option key={yr} value={yr}>{yr}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Assigned Staff */}
                            <div>
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                                    Assigned Staff ({assignedStaff.length})
                                </p>
                                {assignedStaff.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">No employees assigned to this leave policy for {selectedYear}.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {assignedStaff.map((staff) => (
                                            <div
                                                key={staff.user_id}
                                                className="bg-slate-50/70 dark:bg-github-dark-subtle/30 rounded-xl p-2.5 border border-slate-200/80 dark:border-github-dark-border space-y-2"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div
                                                            onClick={() => staff.profile_image_url && openAvatarPreview(staff)}
                                                            className={`w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden transition-transform ${
                                                                staff.profile_image_url ? 'cursor-pointer active:scale-95 ring-1 ring-indigo-500/30' : ''
                                                            }`}
                                                            title={staff.profile_image_url ? `View ${staff.user_name}'s photo` : staff.user_name}
                                                        >
                                                            {staff.profile_image_url ? (
                                                                <img src={`${staff.profile_image_url}?t=${avatarTimestamp}`} alt="" className="w-full h-full object-cover" />
                                                            ) : staff.user_name?.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-slate-900 dark:text-github-dark-text truncate">
                                                                {staff.user_name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 truncate">
                                                                {staff.desg_name || 'Staff'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleUnassignUser(staff)}
                                                        className="px-2 py-1 text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg text-[10px] font-medium hover:bg-rose-100 transition-colors cursor-pointer"
                                                    >
                                                        Unassign
                                                    </button>
                                                </div>

                                                {/* Rule Balances Badges with Adjust Button */}
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {(staff.balances || []).map((bal) => (
                                                        <button
                                                            key={bal.lb_id}
                                                            onClick={() => handleOpenAdjustBalance(bal, staff)}
                                                            className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-dark-card border border-indigo-200/80 dark:border-indigo-900/50 rounded-md text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-500 cursor-pointer"
                                                        >
                                                            <span className="font-medium text-indigo-600">{bal.leave_type || bal.code}:</span>
                                                            <span className="font-mono">{bal.allocated - bal.used}/{bal.allocated}d</span>
                                                            <Edit2 size={9} className="text-slate-400 ml-0.5" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Available Staff */}
                            <div className="pt-2">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                    Available Staff ({availableStaff.length})
                                </p>
                                {availableStaff.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">No available staff.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {availableStaff.map((emp) => (
                                            <div
                                                key={emp.user_id}
                                                className="flex items-center justify-between p-2.5 bg-white dark:bg-dark-card rounded-xl border border-slate-200/80 dark:border-github-dark-border"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div
                                                        onClick={() => emp.profile_image_url && openAvatarPreview(emp)}
                                                        className={`w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden transition-transform ${
                                                            emp.profile_image_url ? 'cursor-pointer active:scale-95 ring-1 ring-slate-300 dark:ring-slate-700' : ''
                                                        }`}
                                                        title={emp.profile_image_url ? `View ${emp.user_name}'s photo` : emp.user_name}
                                                    >
                                                        {emp.profile_image_url ? (
                                                            <img src={`${emp.profile_image_url}?t=${avatarTimestamp}`} alt="" className="w-full h-full object-cover" />
                                                        ) : emp.user_name?.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-slate-900 dark:text-github-dark-text truncate">
                                                            {emp.user_name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 truncate">
                                                            {emp.desg_name || 'Staff'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleAssignUser(emp)}
                                                    className="px-2.5 py-1 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-[10px] font-medium hover:bg-indigo-100 transition-colors cursor-pointer"
                                                >
                                                    + Assign
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="py-14 text-center space-y-2 bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border p-6 shadow-2xs">
                    <CalendarCheck size={36} className="mx-auto text-indigo-400 opacity-60" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-github-dark-text">No leave policies found</p>
                    <p className="text-[11px] text-slate-400">Create a policy to define leave entitlements and rules.</p>
                    <button
                        onClick={handleOpenAddPolicy}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>Add First Policy</span>
                    </button>
                </div>
            )}

            {/* ADD / EDIT POLICY MODAL */}
            {isPolicyFormOpen && createPortal(
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsPolicyFormOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-dark-card w-full rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden"
                    >
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text">
                                {editingPolicy ? 'Edit Leave Policy' : 'Create Leave Policy'}
                            </h3>
                            <button onClick={() => setIsPolicyFormOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSavePolicy} className="p-4 space-y-4 overflow-y-auto no-scrollbar pb-10">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Policy Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Standard Organization Policy"
                                    value={policyForm.name}
                                    onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Description
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Brief description of this policy and its eligibility..."
                                    value={policyForm.description}
                                    onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-xl border border-slate-200 dark:border-github-dark-border">
                                <div>
                                    <p className="text-xs font-medium text-slate-800 dark:text-github-dark-text">Active Status</p>
                                    <p className="text-[10px] text-slate-400">Enable this policy for employee assignments</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={policyForm.is_active}
                                        onChange={(e) => setPolicyForm({ ...policyForm, is_active: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus-visible:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    {editingPolicy ? 'Update Policy' : 'Create Policy'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* ADD / EDIT RULE MODAL */}
            {isRuleFormOpen && createPortal(
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsRuleFormOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-dark-card w-full rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden"
                    >
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text">
                                {editingRule ? 'Edit Entitlement Rule' : 'Add Entitlement Rule'}
                            </h3>
                            <button onClick={() => setIsRuleFormOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveRule} className="p-4 space-y-3.5 overflow-y-auto no-scrollbar pb-10">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Rule Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Casual Leave"
                                        value={ruleForm.name}
                                        onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. CL"
                                        value={ruleForm.code}
                                        onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs uppercase font-mono outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Accrual Type
                                    </label>
                                    <select
                                        value={ruleForm.accural_type}
                                        onChange={(e) => setRuleForm({ ...ruleForm, accural_type: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs outline-none focus:border-indigo-500"
                                    >
                                        <option value="No Accrual">No Accrual (Lump Sum)</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Yearly">Yearly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Max Balance (Days)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={ruleForm.max_balance}
                                        onChange={(e) => setRuleForm({ ...ruleForm, max_balance: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-xl border border-slate-200 dark:border-github-dark-border">
                                <div>
                                    <p className="text-xs font-medium text-slate-800 dark:text-github-dark-text">Paid Leave</p>
                                    <p className="text-[10px] text-slate-400">Employees are compensated for these days</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={ruleForm.is_paid}
                                        onChange={(e) => setRuleForm({ ...ruleForm, is_paid: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus-visible:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            <div className="p-3 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-slate-800 dark:text-github-dark-text">Carry Forward</p>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={ruleForm.carry_forward}
                                            onChange={(e) => setRuleForm({ ...ruleForm, carry_forward: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus-visible:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                {ruleForm.carry_forward && (
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                            Max Carry Forward Days
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={ruleForm.carry_forward_max}
                                            onChange={(e) => setRuleForm({ ...ruleForm, carry_forward_max: e.target.value })}
                                            className="w-full px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-mono outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    {editingRule ? 'Update Rule' : 'Save Rule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* ADJUST BALANCE MODAL */}
            {isAdjustBalanceOpen && editingBalance && createPortal(
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsAdjustBalanceOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-dark-card w-full rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden"
                    >
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text">
                                    Adjust {editingBalance.leave_type || editingBalance.code} Balance
                                </h3>
                                <p className="text-[10px] text-slate-400">
                                    Employee: {editingBalance.user_name}
                                </p>
                            </div>
                            <button onClick={() => setIsAdjustBalanceOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveAdjustBalance} className="p-4 space-y-3.5 overflow-y-auto no-scrollbar pb-10">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Allocated Days
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={balanceForm.allocated}
                                    onChange={(e) => setBalanceForm({ ...balanceForm, allocated: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Carried Forward Days
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={balanceForm.carried_forward}
                                    onChange={(e) => setBalanceForm({ ...balanceForm, carried_forward: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Used Days
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={balanceForm.used}
                                    onChange={(e) => setBalanceForm({ ...balanceForm, used: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    Save Balance
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* DELETE POLICY CONFIRMATION */}
            {isDeletePolicyOpen && selectedPolicy && createPortal(
                <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-github-dark-border space-y-4">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-2.5 rounded-full bg-rose-50 dark:bg-rose-950/40">
                                <AlertCircle size={22} />
                            </div>
                            <h3 className="font-semibold text-sm text-slate-900 dark:text-github-dark-text">Delete Leave Policy?</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Are you sure you want to delete <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedPolicy.name}</span>? Make sure no employees depend on this policy.
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={() => setIsDeletePolicyOpen(false)}
                                className="flex-1 py-2 bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeletePolicy}
                                disabled={isSubmitting}
                                className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-medium hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* DELETE RULE CONFIRMATION */}
            {isDeleteRuleOpen && ruleToDelete && createPortal(
                <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-github-dark-border space-y-4">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-2.5 rounded-full bg-rose-50 dark:bg-rose-950/40">
                                <AlertCircle size={22} />
                            </div>
                            <h3 className="font-semibold text-sm text-slate-900 dark:text-github-dark-text">Delete Rule?</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Are you sure you want to delete rule <span className="font-semibold text-slate-700 dark:text-slate-200">{ruleToDelete.name} ({ruleToDelete.code})</span>?
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={() => setIsDeleteRuleOpen(false)}
                                className="flex-1 py-2 bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteRule}
                                disabled={isSubmitting}
                                className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-medium hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

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
        </div>
    );
};

export default LeavePoliciesMobile;
