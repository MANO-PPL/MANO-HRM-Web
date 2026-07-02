import React, { useState, useEffect } from 'react';
import { leaveService } from '../../services/leaveService';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import {
    Plus,
    Edit2,
    Trash2,
    Loader2,
    X,
    Settings,
    FileText,
    BookOpen,
    Check,
    AlertCircle,
    Users,
    Search,
    Calendar,
    ChevronRight,
    ChevronDown,
    ArrowLeft,
    UserMinus,
    UserPlus,
    UserCheck,
    Clock,
    Layers,
    Shield
} from 'lucide-react';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

const LeavePolicies = () => {
    // Core state
    const [policies, setPolicies] = useState([]);
    const [selectedPolicyId, setSelectedPolicyId] = useState(null);
    const [allBalances, setAllBalances] = useState([]);
    const [employees, setEmployees] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [loadingBalances, setLoadingBalances] = useState(false);
    
    // Mobile Tab Navigation state
    const [activeMobileTab, setActiveMobileTab] = useState('list'); // 'list', 'details', 'staff'

    // Filters
    const [policySearch, setPolicySearch] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [balanceSearch, setBalanceSearch] = useState('');

    // Form/Modal States for Policy
    const [showPolicyDrawer, setShowPolicyDrawer] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState(null);
    const [policyForm, setPolicyForm] = useState({
        name: '',
        description: '',
        is_active: true
    });

    // Form/Modal States for Rule
    const [showRuleDrawer, setShowRuleDrawer] = useState(false);
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

    // Balance Edit Drawer State
    const [showEditBalanceDrawer, setShowEditBalanceDrawer] = useState(false);
    const [editingBalance, setEditingBalance] = useState(null);
    const [balanceForm, setBalanceForm] = useState({
        allocated: 0,
        carried_forward: 0,
        used: 0
    });
    const [isSavingBalance, setIsSavingBalance] = useState(false);

    // Confirmation Modals
    const [confirmDeletePolicy, setConfirmDeletePolicy] = useState({ isOpen: false, policy: null });
    const [confirmDeleteRule, setConfirmDeleteRule] = useState({ isOpen: false, rule: null });
    const [confirmDeleteBalance, setConfirmDeleteBalance] = useState({ isOpen: false, balance: null });
    const [confirmUnassignUser, setConfirmUnassignUser] = useState({ isOpen: false, user: null, balancesToDelete: [] });

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, [selectedYear]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadPolicies(),
                loadBalances(),
                loadAllEmployees()
            ]);
        } catch (error) {
            console.error("Failed to load initial data", error);
        } finally {
            setLoading(false);
        }
    };

    const loadPolicies = async () => {
        try {
            const res = await leaveService.getLeavePolicies();
            if (res.ok) {
                const fetched = res.policies || [];
                setPolicies(fetched);
                // Select first policy by default if none selected
                if (fetched.length > 0 && !selectedPolicyId) {
                    setSelectedPolicyId(fetched[0].lp_id);
                }
            }
        } catch (error) {
            console.error("Failed to load policies", error);
            toast.error(error.message || "Failed to load leave policies");
        }
    };

    const loadBalances = async () => {
        setLoadingBalances(true);
        try {
            const res = await leaveService.getAllEmployeesLeaveBalances(selectedYear);
            if (res.ok) {
                setAllBalances(res.balances || []);
            }
        } catch (error) {
            console.error("Failed to load balances", error);
        } finally {
            setLoadingBalances(false);
        }
    };

    const loadAllEmployees = async () => {
        try {
            const res = await adminService.getAllUsers();
            if (res) {
                const usersList = res.users || res || [];
                setEmployees(usersList.filter(u => u.user_type !== 'super_admin' && u.is_active === 1 && u.is_deleted === 0));
            }
        } catch (error) {
            console.error("Failed to load employees list", error);
        }
    };

    const getSelectedPolicy = () => {
        return policies.find(p => p.lp_id === selectedPolicyId) || null;
    };

    // Policy Handlers
    const openAddPolicy = () => {
        setEditingPolicy(null);
        setPolicyForm({ name: '', description: '', is_active: true });
        setShowPolicyDrawer(true);
    };

    const openEditPolicy = (policy, e) => {
        if (e) e.stopPropagation();
        setEditingPolicy(policy);
        setPolicyForm({
            name: policy.name,
            description: policy.description || '',
            is_active: policy.is_active === 1 || policy.is_active === true
        });
        setShowPolicyDrawer(true);
    };

    const handleSavePolicy = async (e) => {
        e.preventDefault();
        if (!policyForm.name.trim()) return;

        setIsSaving(true);
        try {
            if (editingPolicy) {
                const res = await leaveService.updateLeavePolicy(editingPolicy.lp_id, {
                    name: policyForm.name,
                    description: policyForm.description,
                    is_active: policyForm.is_active
                });
                if (res.ok) {
                    toast.success("Leave policy updated successfully");
                    setShowPolicyDrawer(false);
                    loadPolicies();
                }
            } else {
                const res = await leaveService.createLeavePolicy({
                    name: policyForm.name,
                    description: policyForm.description
                });
                if (res.ok) {
                    toast.success("Leave policy created successfully");
                    setShowPolicyDrawer(false);
                    await loadPolicies();
                    if (res.policy) {
                        setSelectedPolicyId(res.policy.lp_id);
                        setActiveMobileTab('details');
                    }
                }
            }
        } catch (error) {
            toast.error(error.message || "Failed to save leave policy");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePolicy = async () => {
        if (!confirmDeletePolicy.policy) return;
        setIsDeleting(true);
        try {
            const res = await leaveService.deleteLeavePolicy(confirmDeletePolicy.policy.lp_id);
            if (res.ok) {
                toast.success("Leave policy deleted successfully");
                setConfirmDeletePolicy({ isOpen: false, policy: null });
                setSelectedPolicyId(null);
                setActiveMobileTab('list');
                loadPolicies();
            }
        } catch (error) {
            toast.error(error.message || "Failed to delete policy");
        } finally {
            setIsDeleting(false);
        }
    };

    // Rule Handlers
    const openAddRule = () => {
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
        setShowRuleDrawer(true);
    };

    const openEditRule = (rule) => {
        setEditingRule(rule);
        setRuleForm({
            name: rule.name,
            code: rule.code,
            accural_type: rule.accural_type || 'No Accrual',
            accural_amount: rule.accural_amount || 0,
            max_balance: rule.max_balance || 0,
            carry_forward: rule.carry_forward === 1 || rule.carry_forward === true,
            carry_forward_max: rule.carry_forward_max || 0,
            encashable: rule.encashable === 1 || rule.encashable === true,
            is_paid: rule.is_paid === 1 || rule.is_paid === true,
            requires_doc: rule.requires_doc === 1 || rule.requires_doc === true
        });
        setShowRuleDrawer(true);
    };

    const handleSaveRule = async (e) => {
        e.preventDefault();
        if (!ruleForm.name.trim() || !ruleForm.code.trim()) return;

        setIsSaving(true);
        try {
            const payload = {
                name: ruleForm.name,
                code: ruleForm.code.toUpperCase(),
                accural_type: ruleForm.accural_type,
                accural_amount: Number(ruleForm.accural_amount),
                max_balance: Number(ruleForm.max_balance),
                carry_forward: ruleForm.carry_forward,
                carry_forward_max: Number(ruleForm.carry_forward_max),
                encashable: ruleForm.encashable,
                is_paid: ruleForm.is_paid,
                requires_doc: ruleForm.requires_doc
            };

            if (editingRule) {
                const res = await leaveService.updateLeavePolicyRule(selectedPolicyId, editingRule.rule_id, payload);
                if (res.ok) {
                    toast.success("Policy rule updated successfully");
                    setShowRuleDrawer(false);
                    loadPolicies();
                    loadBalances();
                }
            } else {
                const res = await leaveService.createLeavePolicyRule(selectedPolicyId, payload);
                if (res.ok) {
                    toast.success("Policy rule added successfully");
                    setShowRuleDrawer(false);
                    loadPolicies();
                    loadBalances();
                }
            }
        } catch (error) {
            toast.error(error.message || "Failed to save policy rule");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRule = async () => {
        if (!confirmDeleteRule.rule) return;
        setIsDeleting(true);
        try {
            const res = await leaveService.deleteLeavePolicyRule(selectedPolicyId, confirmDeleteRule.rule.rule_id);
            if (res.ok) {
                toast.success("Policy rule deleted successfully");
                setConfirmDeleteRule({ isOpen: false, rule: null });
                loadPolicies();
                loadBalances();
            }
        } catch (error) {
            toast.error(error.message || "Failed to delete rule");
        } finally {
            setIsDeleting(false);
        }
    };

    // User Policy Assignment / Unassignment Handlers
    const handleAssignUser = async (user) => {
        try {
            const res = await leaveService.assignPolicyToEmployees(selectedPolicyId, {
                user_ids: [user.user_id],
                year: selectedYear
            });
            if (res.ok) {
                toast.success(`Policy successfully assigned to ${user.user_name}`);
                loadBalances();
            }
        } catch (error) {
            toast.error(error.message || "Failed to assign policy");
        }
    };

    const handleUnassignUser = async () => {
        if (!confirmUnassignUser.user) return;
        setIsDeleting(true);
        try {
            // Delete all balances associated with this policy rule for this user
            const deletePromises = confirmUnassignUser.balancesToDelete.map(bal =>
                leaveService.deleteLeaveBalance(bal.lb_id)
            );
            await Promise.all(deletePromises);
            toast.success(`Unassigned policy from ${confirmUnassignUser.user.user_name}`);
            setConfirmUnassignUser({ isOpen: false, user: null, balancesToDelete: [] });
            loadBalances();
        } catch (error) {
            toast.error(error.message || "Failed to unassign policy");
        } finally {
            setIsDeleting(false);
        }
    };

    // Balance Editing Handlers
    const openEditBalanceDrawer = (balance) => {
        setEditingBalance(balance);
        setBalanceForm({
            allocated: balance.allocated,
            carried_forward: balance.carried_forward,
            used: balance.used
        });
        setShowEditBalanceDrawer(true);
    };

    const handleSaveBalance = async (e) => {
        e.preventDefault();
        if (!editingBalance) return;
        setIsSavingBalance(true);
        try {
            const res = await leaveService.updateLeaveBalance(editingBalance.lb_id, {
                allocated: Number(balanceForm.allocated),
                carried_forward: Number(balanceForm.carried_forward),
                used: Number(balanceForm.used)
            });
            if (res.ok) {
                toast.success("Leave balance updated successfully");
                setShowEditBalanceDrawer(false);
                loadBalances();
            }
        } catch (error) {
            toast.error(error.message || "Failed to update leave balance");
        } finally {
            setIsSavingBalance(false);
        }
    };

    const handleDeleteBalance = async () => {
        if (!confirmDeleteBalance.balance) return;
        setIsDeleting(true);
        try {
            const res = await leaveService.deleteLeaveBalance(confirmDeleteBalance.balance.lb_id);
            if (res.ok) {
                toast.success("Leave balance deleted successfully");
                setConfirmDeleteBalance({ isOpen: false, balance: null });
                loadBalances();
            }
        } catch (error) {
            toast.error(error.message || "Failed to delete leave balance");
        } finally {
            setIsDeleting(false);
        }
    };

    // Filter policies
    const filteredPolicies = policies.filter(p =>
        p.name.toLowerCase().includes(policySearch.toLowerCase())
    );

    // Group and separate staff list
    const getStaffClassification = () => {
        const policy = getSelectedPolicy();
        if (!policy) return { assigned: [], available: [] };

        const ruleIds = (policy.rules || []).map(r => r.rule_id);
        
        // Group all balances by user_id
        const userBalanceMap = {};
        allBalances.forEach(bal => {
            if (!userBalanceMap[bal.user_id]) {
                userBalanceMap[bal.user_id] = [];
            }
            userBalanceMap[bal.user_id].push(bal);
        });

        const assigned = [];
        const available = [];

        employees.forEach(emp => {
            // Apply name/designation search filter on balances if any
            const query = balanceSearch.toLowerCase();
            const matchesSearch = 
                (emp.user_name || '').toLowerCase().includes(query) ||
                (emp.email || '').toLowerCase().includes(query) ||
                (emp.designation || '').toLowerCase().includes(query) ||
                (emp.department_name || '').toLowerCase().includes(query);
            
            if (balanceSearch && !matchesSearch) return;

            const empBalances = userBalanceMap[emp.user_id] || [];
            // Assigned if they have at least one balance under this policy's rules
            const empPolicyBalances = empBalances.filter(bal => ruleIds.includes(bal.rule_id));
            const isAssigned = empPolicyBalances.length > 0;

            if (isAssigned) {
                assigned.push({
                    ...emp,
                    policyBalances: empPolicyBalances
                });
            } else {
                available.push(emp);
            }
        });

        return { assigned, available };
    };

    const selectedPolicy = getSelectedPolicy();
    const { assigned: assignedStaff, available: availableStaff } = getStaffClassification();

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full w-full overflow-hidden">
            
            {/* COLUMN 1: Policies Directory List */}
            <div className={`w-full lg:w-1/4 h-full bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden shrink-0 ${activeMobileTab !== 'list' ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-200 dark:border-github-dark-border space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-black uppercase text-slate-750 dark:text-github-dark-text tracking-wider">Leave Policies</h3>
                        <button
                            onClick={openAddPolicy}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                        >
                            <Plus size={14} />
                            Create
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search policies..."
                            value={policySearch}
                            onChange={(e) => setPolicySearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 text-slate-755 dark:text-github-dark-text"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-2 space-y-1.5 no-scrollbar max-h-[400px] lg:max-h-none">
                    {loading && policies.length === 0 ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="animate-spin text-indigo-650" size={24} />
                        </div>
                    ) : filteredPolicies.length === 0 ? (
                        <p className="text-xs text-slate-400 italic p-6 text-center">No policies found.</p>
                    ) : (
                        filteredPolicies.map((policy) => {
                            const isSelected = policy.lp_id === selectedPolicyId;
                            return (
                                <div
                                    key={policy.lp_id}
                                    onClick={() => {
                                        setSelectedPolicyId(policy.lp_id);
                                        setActiveMobileTab('details');
                                    }}
                                    className={`p-3 rounded-lg border transition-all cursor-pointer group ${isSelected
                                        ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                                        : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${policy.is_active ? 'bg-indigo-500' : 'bg-slate-350 dark:bg-slate-600'}`} />
                                            <h4 className={`font-semibold text-sm ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-850 dark:text-github-dark-text'}`}>{policy.name}</h4>
                                        </div>
                                        {!policy.is_active && (
                                            <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted truncate">{policy.description || 'No description'}</p>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-450 mt-2 font-semibold">
                                        <span className="flex items-center gap-1"><Clock size={10} /> Rules: {policy.rules?.length || 0}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* COLUMN 2: Selected Policy & Leave Rules Details */}
            <div className={`flex-1 h-full bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden ${activeMobileTab !== 'details' ? 'hidden lg:flex' : 'flex'}`}>
                {showEditBalanceDrawer ? (
                    <>
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/25">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                                    <Edit2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-github-dark-text">Adjust Balance</h3>
                                    <p className="text-[10px] text-slate-400 font-bold">{editingBalance?.user_name} - {editingBalance?.leave_type}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowEditBalanceDrawer(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-muted rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBalance} className="flex-1 p-6 space-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted">Allocated Quota</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={balanceForm.allocated}
                                    onChange={(e) => setBalanceForm({ ...balanceForm, allocated: Number(e.target.value) })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-semibold text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted">Carried Forward</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={balanceForm.carried_forward}
                                    onChange={(e) => setBalanceForm({ ...balanceForm, carried_forward: Number(e.target.value) })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-semibold text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted">Used Days</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={balanceForm.used}
                                    onChange={(e) => setBalanceForm({ ...balanceForm, used: Number(e.target.value) })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-semibold text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    required
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-github-dark-border">
                                <button
                                    type="submit"
                                    disabled={isSavingBalance}
                                    className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-xs"
                                >
                                    {isSavingBalance ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                    <span>Save Adjustments</span>
                                </button>
                            </div>
                        </form>
                    </>
                ) : showPolicyDrawer ? (
                    <>
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/25">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                                    <Settings size={20} />
                                </div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-github-dark-text">{editingPolicy ? 'Edit Leave Policy' : 'Create Leave Policy'}</h3>
                            </div>
                            <button onClick={() => setShowPolicyDrawer(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-muted rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePolicy} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted">Policy Name</label>
                                <input
                                    type="text"
                                    required
                                    value={policyForm.name}
                                    onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-semibold text-xs"
                                    placeholder="e.g. Standard Entitlements"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted">Description</label>
                                <textarea
                                    value={policyForm.description}
                                    onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 text-xs font-semibold h-28 resize-none"
                                    placeholder="Outline scope or details about eligibility for this policy..."
                                />
                            </div>

                            {editingPolicy && (
                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-github-dark-subtle/55 border border-slate-200 dark:border-github-dark-border rounded-xl">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-github-dark-text">Policy Status</span>
                                        <p className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium">Inactive policies cannot be assigned to employees.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={policyForm.is_active} 
                                            onChange={e => setPolicyForm({ ...policyForm, is_active: e.target.checked })} 
                                        />
                                        <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                    </label>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPolicyDrawer(false)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text rounded-lg text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                    <span>{editingPolicy ? 'Update Policy' : 'Create Policy'}</span>
                                </button>
                            </div>
                        </form>
                    </>
                ) : showRuleDrawer ? (
                    <>
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/25">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-github-dark-text">{editingRule ? 'Edit Entitlement Rule' : 'Add Entitlement Rule'}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold">{selectedPolicy.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowRuleDrawer(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-muted rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRule} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted">Rule Name</label>
                                <input
                                    type="text"
                                    required
                                    value={ruleForm.name}
                                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-semibold text-xs"
                                    placeholder="e.g. Annual Leave"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted">Leave Code / Abbreviation</label>
                                <input
                                    type="text"
                                    required
                                    maxLength="4"
                                    value={ruleForm.code}
                                    onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value.toUpperCase() })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-bold text-xs"
                                    placeholder="e.g. AL"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted">Days Per Year</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={ruleForm.max_balance}
                                        onChange={(e) => setRuleForm({ ...ruleForm, max_balance: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-semibold text-xs"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted">When is Leave Added?</label>
                                    <div className="relative">
                                        <select
                                            value={ruleForm.accural_type}
                                            onChange={(e) => setRuleForm({ ...ruleForm, accural_type: e.target.value })}
                                            className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-semibold text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 pr-10 cursor-pointer text-slate-700 dark:text-slate-350"
                                        >
                                            <option value="No Accrual">All at Once (Start of Year)</option>
                                            <option value="Monthly">Add Monthly</option>
                                            <option value="Quarterly">Add Every 3 Months</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 dark:text-github-dark-muted">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {ruleForm.accural_type !== 'No Accrual' && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5">Days Added Each Period</label>
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        value={ruleForm.accural_amount}
                                        onChange={(e) => setRuleForm({ ...ruleForm, accural_amount: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-semibold text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                                        required
                                    />
                                </div>
                            )}

                            <div className="p-4 bg-slate-50/50 dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl space-y-3.5">
                                {/* Option 1: Accrue as Paid Leave */}
                                <label className="flex items-center justify-between p-3.5 bg-white dark:bg-[#161b22] hover:bg-slate-100/50 dark:hover:bg-slate-800/40 border border-slate-200 dark:border-[#30363d] rounded-xl cursor-pointer transition-all duration-200 group">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-bold text-slate-700 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Accrue as Paid Leave</span>
                                        <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium">Employee gets paid as usual during this leave</span>
                                    </div>
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={ruleForm.is_paid}
                                            onChange={(e) => setRuleForm({ ...ruleForm, is_paid: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:scale-105">
                                            <svg
                                                className={`w-3.5 h-3.5 text-white transition-opacity ${ruleForm.is_paid ? 'opacity-100' : 'opacity-0'}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="3.5"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </label>

                                {/* Option 2: Requires Medical/Doc */}
                                <label className="flex items-center justify-between p-3.5 bg-white dark:bg-[#161b22] hover:bg-slate-100/50 dark:hover:bg-slate-800/40 border border-slate-200 dark:border-[#30363d] rounded-xl cursor-pointer transition-all duration-200 group">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-bold text-slate-700 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Requires Medical/Doc</span>
                                        <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium">Must upload a doctor's note or document when applying</span>
                                    </div>
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={ruleForm.requires_doc}
                                            onChange={(e) => setRuleForm({ ...ruleForm, requires_doc: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:scale-105">
                                            <svg
                                                className={`w-3.5 h-3.5 text-white transition-opacity ${ruleForm.requires_doc ? 'opacity-100' : 'opacity-0'}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="3.5"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </label>

                                {/* Option 3: Encashable Leave */}
                                <label className="flex items-center justify-between p-3.5 bg-white dark:bg-[#161b22] hover:bg-slate-100/50 dark:hover:bg-slate-800/40 border border-slate-200 dark:border-[#30363d] rounded-xl cursor-pointer transition-all duration-200 group">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-bold text-slate-700 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Encashable Leave</span>
                                        <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium">Unused days can be paid out in cash</span>
                                    </div>
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={ruleForm.encashable}
                                            onChange={(e) => setRuleForm({ ...ruleForm, encashable: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:scale-105">
                                            <svg
                                                className={`w-3.5 h-3.5 text-white transition-opacity ${ruleForm.encashable ? 'opacity-100' : 'opacity-0'}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="3.5"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </label>

                                {/* Option 4: Carry Forward to Next Year */}
                                <label className="flex items-center justify-between p-3.5 bg-white dark:bg-[#161b22] hover:bg-slate-100/50 dark:hover:bg-slate-800/40 border border-slate-200 dark:border-[#30363d] rounded-xl cursor-pointer transition-all duration-200 group">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-bold text-slate-700 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Carry Forward to Next Year</span>
                                        <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium">Unused days move to the next year instead of expiring</span>
                                    </div>
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={ruleForm.carry_forward}
                                            onChange={(e) => setRuleForm({ ...ruleForm, carry_forward: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:scale-105">
                                            <svg
                                                className={`w-3.5 h-3.5 text-white transition-opacity ${ruleForm.carry_forward ? 'opacity-100' : 'opacity-0'}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="3.5"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </label>

                                {ruleForm.carry_forward && (
                                    <div className="animate-in fade-in slide-in-from-top-1 duration-200 p-3.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl space-y-1.5 mt-2">
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-github-dark-muted">Max Carry Forward Cap</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            value={ruleForm.carry_forward_max}
                                            onChange={(e) => setRuleForm({ ...ruleForm, carry_forward_max: Number(e.target.value) })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-semibold text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRuleDrawer(false)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-github-dark-text rounded-lg text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                    <span>{editingRule ? 'Update Rule' : 'Add Rule'}</span>
                                </button>
                            </div>
                        </form>
                    </>
                ) : selectedPolicy ? (
                    <>
                        {/* Header details block */}
                        <div className="p-4 border-b border-[#e1e4e6] dark:border-github-dark-border flex flex-col justify-start gap-3 bg-slate-50/30 dark:bg-github-dark-subtle/10">
                            {/* Mobile action bar */}
                            <div className="flex justify-between items-center lg:hidden">
                                <button
                                    onClick={() => setActiveMobileTab('list')}
                                    className="flex items-center gap-1 text-xs font-bold text-indigo-650"
                                >
                                    <ArrowLeft size={14} />
                                    Policies
                                </button>
                                <button
                                    onClick={() => setActiveMobileTab('staff')}
                                    className="flex items-center gap-1 text-xs font-bold text-indigo-650"
                                >
                                    Manage Staff
                                    <ChevronRight size={14} />
                                </button>
                            </div>

                            <div className="flex justify-between items-center w-full">
                                <div>
                                    <h2 className="text-sm font-black text-slate-900 dark:text-github-dark-text uppercase tracking-wide flex items-center gap-2">
                                        {selectedPolicy.name}
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${selectedPolicy.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
                                            {selectedPolicy.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </h2>
                                    <p className="text-[11px] text-slate-450 dark:text-github-dark-muted mt-1 leading-normal max-w-xl">{selectedPolicy.description || 'No description provided.'}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={(e) => openEditPolicy(selectedPolicy, e)}
                                        className="p-1.5 text-slate-400 hover:text-indigo-655 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                        title="Edit Policy"
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeletePolicy({ isOpen: true, policy: selectedPolicy }); }}
                                        className="p-1.5 text-slate-400 hover:text-red-655 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                        title="Delete Policy"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Rules builder and metadata cards */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
                            {/* Rules config lists */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-1.5 border-b border-slate-150 dark:border-github-dark-border">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-github-dark-muted flex items-center gap-1.5">
                                        <Layers size={11} />
                                        Entitlement Rules ({selectedPolicy.rules?.length || 0})
                                    </h4>
                                    <button
                                        onClick={openAddRule}
                                        className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-github-dark-border rounded-lg text-[10px] font-bold shadow-sm cursor-pointer"
                                    >
                                        <Plus size={11} />
                                        Add Rule
                                    </button>
                                </div>

                                {!selectedPolicy.rules || selectedPolicy.rules.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-250 dark:border-[#30363d] rounded-xl text-center">
                                        <p className="text-xs text-slate-400 italic">No rules defined. Add rules to configure Sick Leaves, Casual Leaves etc.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3.5">
                                        {selectedPolicy.rules.map((rule) => (
                                            <div
                                                key={rule.rule_id}
                                                className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl p-4 flex flex-col justify-between shadow-sm"
                                            >
                                                <div className="flex justify-between items-start gap-4">
                                                    <div>
                                                        <h5 className="font-bold text-xs text-slate-800 dark:text-github-dark-text">{rule.name}</h5>
                                                        <span className="text-[9px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 px-2 py-0.5 rounded font-black mt-1.5 inline-block">{rule.code}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => openEditRule(rule)}
                                                            className="p-1 text-slate-450 hover:text-indigo-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteRule({ isOpen: true, rule })}
                                                            className="p-1 text-slate-455 hover:text-red-650 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-2 gap-y-2 text-[10px] text-slate-505 dark:text-github-dark-muted font-bold">
                                                    <div>Quota Limit: <span className="text-slate-850 dark:text-white">{rule.max_balance} Days</span></div>
                                                    <div>Pay Type: <span className="text-slate-850 dark:text-white">{rule.is_paid ? 'Paid' : 'Unpaid'}</span></div>
                                                    <div>Accrual Strategy: <span className="text-slate-850 dark:text-white">{rule.accural_type}</span></div>
                                                    <div>Carry Forward: <span className="text-slate-850 dark:text-white">{rule.carry_forward ? `CF (Max ${rule.carry_forward_max})` : 'Disabled'}</span></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-center">
                        <BookOpen size={48} className="opacity-20 mb-3" />
                        <h4 className="font-bold text-xs">No Policy Selected</h4>
                        <p className="text-[11px] mt-1">Select a leave policy from the directory to manage its settings and rules.</p>
                    </div>
                )}
            </div>

            {/* COLUMN 3: Staff Assignments & Individual Balance Adjustments */}
            <div className={`w-full lg:w-1/3 h-full bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden shrink-0 ${activeMobileTab !== 'staff' ? 'hidden lg:flex' : 'flex'}`}>
                {selectedPolicy ? (
                    <>
                        {/* Header assigned list */}
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border space-y-4">
                            <div className="flex justify-between items-center">
                                <button
                                    onClick={() => setActiveMobileTab('details')}
                                    className="lg:hidden flex items-center gap-1 text-xs font-bold text-indigo-650"
                                >
                                    <ArrowLeft size={14} />
                                    Back Details
                                </button>
                                <h3 className="text-xs font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider flex items-center gap-1.5">
                                    <Users size={12} />
                                    Assigned Staff ({assignedStaff.length})
                                </h3>

                                {/* Target Year selection */}
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="px-2 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-[#30363d] rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-350 outline-none cursor-pointer"
                                >
                                    {Array.from({ length: 5 }, (_, i) => {
                                        const y = new Date().getFullYear() - 2 + i;
                                        return <option key={y} value={y}>{y}</option>;
                                    })}
                                </select>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                <input
                                    type="text"
                                    placeholder="Search staff, design..."
                                    value={balanceSearch}
                                    onChange={(e) => setBalanceSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 text-slate-705 dark:text-github-dark-text"
                                />
                            </div>
                        </div>

                        {/* Split Staff lists */}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-150 dark:divide-slate-800 no-scrollbar p-2 space-y-3">
                            {/* Section 1: Assigned Staff list */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">Assigned Staff ({assignedStaff.length})</h4>
                                {loadingBalances ? (
                                    <div className="flex justify-center items-center py-4">
                                        <Loader2 className="animate-spin text-indigo-600" size={16} />
                                    </div>
                                ) : assignedStaff.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic py-2">No assigned staff matches query.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {assignedStaff.map(user => (
                                            <div
                                                key={user.user_id}
                                                className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-all"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-650 overflow-hidden shrink-0">
                                                        {user.profile_image_url && user.profile_image_url.startsWith('http') ? (
                                                            <img src={user.profile_image_url} alt={user.user_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            (user.user_name || 'U').charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <p className="text-xs font-semibold text-slate-850 dark:text-github-dark-text truncate">{user.user_name}</p>
                                                            {user.designation && (
                                                                <span className="text-[9px] font-black text-indigo-650 dark:text-indigo-400 shrink-0 uppercase tracking-tight">{user.designation}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                                                        
                                                        {/* Summarize rule balances inside a clean structured layout */}
                                                        {user.policyBalances && user.policyBalances.length > 0 && (
                                                            <div className="grid grid-cols-1 gap-1.5 mt-2 bg-slate-50 dark:bg-github-dark-subtle/50 p-2 rounded-lg border border-slate-200 dark:border-github-dark-border">
                                                                {user.policyBalances.map(bal => (
                                                                    <div
                                                                        key={bal.lb_id}
                                                                        onClick={() => openEditBalanceDrawer(bal)}
                                                                        className="text-[9px] font-bold text-slate-605 dark:text-slate-350 cursor-pointer hover:text-indigo-600 flex flex-col"
                                                                        title="Adjust Balance"
                                                                    >
                                                                        <span className="text-[7.5px] uppercase text-slate-450 font-black tracking-wider truncate">{bal.leave_type}</span>
                                                                        <span className="mt-0.5 text-slate-750 dark:text-slate-200">
                                                                            Available: <strong className="text-indigo-650 dark:text-indigo-400">{Number(bal.available)}</strong>/{Number(bal.allocated)}d
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setConfirmUnassignUser({ isOpen: true, user, balancesToDelete: user.policyBalances || [] })}
                                                    className="w-7 h-7 flex items-center justify-center text-slate-450 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full transition-all shrink-0 cursor-pointer ml-2 self-start"
                                                    title="Unassign Policy"
                                                >
                                                    <UserMinus size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Available Staff list */}
                            <div className="space-y-3 pt-3">
                                <h4 className="text-[10px] font-black uppercase text-slate-450 dark:text-slate-400 tracking-wider">Available Staff ({availableStaff.length})</h4>
                                {availableStaff.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic py-2">No available staff.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {availableStaff.map(user => (
                                            <div
                                                key={user.user_id}
                                                className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-650 overflow-hidden shrink-0">
                                                        {user.profile_image_url && user.profile_image_url.startsWith('http') ? (
                                                            <img src={user.profile_image_url} alt={user.user_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            (user.user_name || 'U').charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <p className="text-xs font-semibold text-slate-850 dark:text-github-dark-text truncate">{user.user_name}</p>
                                                            {user.designation && (
                                                                <span className="text-[9px] font-black text-slate-450 dark:text-github-dark-muted shrink-0 uppercase tracking-tight">{user.designation}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleAssignUser(user)}
                                                    className="w-7 h-7 flex items-center justify-center text-slate-405 hover:text-indigo-650 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-full transition-all shrink-0 cursor-pointer ml-2"
                                                    title="Assign Policy"
                                                >
                                                    <UserPlus size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-center">
                        <Users size={48} className="opacity-20 mb-3" />
                        <h4 className="font-bold text-xs">No Policy Selected</h4>
                        <p className="text-[11px] mt-1">Select a leave policy from the directory to manage assigned staff balances.</p>
                    </div>
                )}
            </div>

            {/* DRAWERS & MODALS */}

            {/* Confirm Delete Policy Modal */}
            <AnimatePresence>
                {confirmDeletePolicy.isOpen && (
                    <ConfirmationModal
                        isOpen={confirmDeletePolicy.isOpen}
                        title="Delete Leave Policy?"
                        message={`Are you sure you want to delete the policy "${confirmDeletePolicy.policy?.name}"? Make sure it has no active dependencies.`}
                        type="danger"
                        confirmText="Delete"
                        isSubmitting={isDeleting}
                        onClose={() => setConfirmDeletePolicy({ isOpen: false, policy: null })}
                        onConfirm={handleDeletePolicy}
                    />
                )}
            </AnimatePresence>

            {/* Confirm Delete Rule Modal */}
            <AnimatePresence>
                {confirmDeleteRule.isOpen && (
                    <ConfirmationModal
                        isOpen={confirmDeleteRule.isOpen}
                        title="Delete Policy Rule?"
                        message={`Are you sure you want to delete the rule "${confirmDeleteRule.rule?.name}" (${confirmDeleteRule.rule?.code})?`}
                        type="danger"
                        confirmText="Delete"
                        isSubmitting={isDeleting}
                        onClose={() => setConfirmDeleteRule({ isOpen: false, rule: null })}
                        onConfirm={handleDeleteRule}
                    />
                )}
            </AnimatePresence>

            {/* Confirm Delete Balance Modal */}
            <AnimatePresence>
                {confirmDeleteBalance.isOpen && (
                    <ConfirmationModal
                        isOpen={confirmDeleteBalance.isOpen}
                        title="Delete Leave Balance?"
                        message={`Are you sure you want to delete the balance allocation for "${confirmDeleteBalance.balance?.user_name}" under rule "${confirmDeleteBalance.balance?.leave_type}"?`}
                        type="danger"
                        confirmText="Delete"
                        isSubmitting={isDeleting}
                        onClose={() => setConfirmDeleteBalance({ isOpen: false, balance: null })}
                        onConfirm={handleDeleteBalance}
                    />
                )}
            </AnimatePresence>

            {/* Confirm Unassign User Modal */}
            <AnimatePresence>
                {confirmUnassignUser.isOpen && (
                    <ConfirmationModal
                        isOpen={confirmUnassignUser.isOpen}
                        title="Unassign Policy?"
                        message={`Are you sure you want to unassign "${confirmUnassignUser.user?.user_name}" from "${selectedPolicy?.name}"? This will delete all their leave balances under this policy rules for the year ${selectedYear}.`}
                        type="danger"
                        confirmText="Unassign"
                        isSubmitting={isDeleting}
                        onClose={() => setConfirmUnassignUser({ isOpen: false, user: null, balancesToDelete: [] })}
                        onConfirm={handleUnassignUser}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default LeavePolicies;
