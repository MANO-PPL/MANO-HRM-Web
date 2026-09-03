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

import PolicyDirectory from './components/PolicyDirectory';
import PolicyRulesBuilder from './components/PolicyRulesBuilder';
import PolicyStaffAssignment from './components/PolicyStaffAssignment';
import PolicyFormDrawer from './components/PolicyFormDrawer';
import PolicyRuleFormDrawer from './components/PolicyRuleFormDrawer';
import AdjustBalanceDrawer from './components/AdjustBalanceDrawer';

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
            <PolicyDirectory
                policies={policies}
                selectedPolicyId={selectedPolicyId}
                setSelectedPolicyId={setSelectedPolicyId}
                loading={loading}
                policySearch={policySearch}
                setPolicySearch={setPolicySearch}
                openAddPolicy={openAddPolicy}
                activeMobileTab={activeMobileTab}
                setActiveMobileTab={setActiveMobileTab}
            />

            {/* COLUMN 2: Selected Policy & Leave Rules Details */}
            <div className={`flex-1 h-full bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden ${activeMobileTab !== 'details' ? 'hidden lg:flex' : 'flex'}`}>
                {showEditBalanceDrawer ? (
                    <AdjustBalanceDrawer
                        editingBalance={editingBalance}
                        balanceForm={balanceForm}
                        setBalanceForm={setBalanceForm}
                        onSaveBalance={handleSaveBalance}
                        onClose={() => setShowEditBalanceDrawer(false)}
                        isSavingBalance={isSavingBalance}
                    />
                ) : showPolicyDrawer ? (
                    <PolicyFormDrawer
                        editingPolicy={editingPolicy}
                        policyForm={policyForm}
                        setPolicyForm={setPolicyForm}
                        onSavePolicy={handleSavePolicy}
                        onClose={() => setShowPolicyDrawer(false)}
                        isSaving={isSaving}
                    />
                ) : showRuleDrawer ? (
                    <PolicyRuleFormDrawer
                        selectedPolicy={selectedPolicy}
                        editingRule={editingRule}
                        ruleForm={ruleForm}
                        setRuleForm={setRuleForm}
                        onSaveRule={handleSaveRule}
                        onClose={() => setShowRuleDrawer(false)}
                        isSaving={isSaving}
                    />
                ) : (
                    <PolicyRulesBuilder
                        selectedPolicy={selectedPolicy}
                        openEditPolicy={openEditPolicy}
                        setConfirmDeletePolicy={setConfirmDeletePolicy}
                        openAddRule={openAddRule}
                        openEditRule={openEditRule}
                        setConfirmDeleteRule={setConfirmDeleteRule}
                        activeMobileTab={activeMobileTab}
                        setActiveMobileTab={setActiveMobileTab}
                    />
                )}
            </div>

            {/* COLUMN 3: Staff Assignments & Individual Balance Adjustments */}
            <PolicyStaffAssignment
                selectedPolicy={selectedPolicy}
                assignedStaff={assignedStaff}
                availableStaff={availableStaff}
                loadingBalances={loadingBalances}
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                balanceSearch={balanceSearch}
                setBalanceSearch={setBalanceSearch}
                openEditBalanceDrawer={openEditBalanceDrawer}
                setConfirmUnassignUser={setConfirmUnassignUser}
                handleAssignUser={handleAssignUser}
                activeMobileTab={activeMobileTab}
                setActiveMobileTab={setActiveMobileTab}
            />

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
