import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import {
    CreditCard,
    Calendar,
    Search,
    Settings,
    Users,
    FileText,
    Plus,
    CheckCircle,
    Layers,
    Briefcase,
    Building2,
    RefreshCw,
    Trash2,
    Play,
    CheckCircle2,
    Filter,
    Percent,
    Eye,
    UserCheck,
    AlertTriangle,
    Check,
    Wallet,
    Edit3
} from 'lucide-react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import payrollService from '../../services/payrollService';
import { adminService } from '../../services/adminService';

// Modals
import PayrollSettingsModal from './components/PayrollSettingsModal';
import TriggerRunModal from './components/TriggerRunModal';
import CreatePackageModal from './components/CreatePackageModal';
import EditPackageModal from './components/EditPackageModal';
import AddComponentModal from './components/AddComponentModal';
import EditComponentModal from './components/EditComponentModal';
import AssignPackageModal from './components/AssignPackageModal';
import PayslipModal from './components/PayslipModal';
import SalaryStructureModal from './components/SalaryStructureModal';

const formatINR = (val) => Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const Payroll = () => {
    // ----------------------------------------------------
    // 1. STATE MANAGEMENT
    // ----------------------------------------------------
    const [activeTab, setActiveTab] = useState('runs'); // 'runs' | 'packages' | 'assignments' | 'settings'

    // Setup Status
    const [setupStatus, setSetupStatus] = useState({ is_configured: true, settings: null });

    // Core Data
    const [runs, setRuns] = useState([]);
    const [selectedRun, setSelectedRun] = useState(null);
    const [runDetailsLoading, setRunDetailsLoading] = useState(false);
    const [packages, setPackages] = useState([]);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);

    // Filters & Searches
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [assignmentSearch, setAssignmentSearch] = useState('');
    const [assignmentFilterStatus, setAssignmentFilterStatus] = useState('all'); // 'all' | 'assigned' | 'unassigned'
    const [assignmentDeptFilter, setAssignmentDeptFilter] = useState('all');

    // Modals
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isTriggerRunModalOpen, setIsTriggerRunModalOpen] = useState(false);
    const [isCreatePackageModalOpen, setIsCreatePackageModalOpen] = useState(false);
    const [isEditPackageModalOpen, setIsEditPackageModalOpen] = useState(false);
    const [isAddComponentModalOpen, setIsAddComponentModalOpen] = useState(false);
    const [isEditComponentModalOpen, setIsEditComponentModalOpen] = useState(false);
    const [editingComponent, setEditingComponent] = useState(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [preselectedEmpForAssign, setPreselectedEmpForAssign] = useState(null);
    const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
    const [selectedPayslipData, setSelectedPayslipData] = useState(null);
    const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
    const [structureEmployee, setStructureEmployee] = useState(null);
    const [structurePackage, setStructurePackage] = useState(null);
    const [structureEffectiveFrom, setStructureEffectiveFrom] = useState(null);

    // ----------------------------------------------------
    // 2. DATA FETCHING
    // ----------------------------------------------------
    const loadAllPayrollData = useCallback(async () => {
        try {
            // 1. Check Setup Status
            const setupRes = await payrollService.getSetupStatus().catch(() => ({ ok: true, data: { is_configured: false } }));
            const isConfigured = Boolean(
                setupRes.data?.is_configured ??
                setupRes.data?.is_settings_configured ??
                setupRes.data?.settings?.is_configured
            );
            setSetupStatus({
                is_configured: isConfigured,
                settings: setupRes.data?.settings || null
            });

            // 2. Load Packages
            const pkgsRes = await payrollService.getPackages().catch(() => ({ ok: true, data: [] }));
            const pkgsList = pkgsRes.data || [];
            setPackages(pkgsList);
            if (pkgsList.length > 0) {
                setSelectedPackage(pkgsList[0]);
            }

            // 3. Load Runs
            const runsRes = await payrollService.getPayrollRuns().catch(() => ({ ok: true, data: [] }));
            const runsList = runsRes.data || [];
            setRuns(runsList);
            if (runsList.length > 0) {
                // Fetch details for the first/latest run
                loadRunDetails(runsList[0].id);
            }

            // 4. Load Assignments
            const assignRes = await payrollService.getAssignments().catch(() => ({ ok: true, data: [] }));
            setAssignments(assignRes.data || []);

            // 5. Load Employees
            const usersRes = await adminService.getAllUsers({ activeOnly: true }).catch(() => []);
            const userList = Array.isArray(usersRes) ? usersRes : usersRes?.users || [];
            setAllEmployees(userList.map(u => ({
                id: u.user_id || u.id,
                user_id: u.user_id || u.id,
                name: u.user_name || u.name,
                code: u.user_code || u.code || '',
                dept_name: u.dept_name || u.department || 'General',
                desg_name: u.desg_name || u.designation || 'Staff',
                email: u.email
            })));
        } catch (err) {
            console.error('Failed to load payroll data:', err);
            toast.error('Failed to load some payroll data.');
        }
    }, []);

    useEffect(() => {
        loadAllPayrollData();
    }, [loadAllPayrollData]);

    const loadRunDetails = async (runId) => {
        setRunDetailsLoading(true);
        try {
            const res = await payrollService.getPayrollRunDetails(runId);
            setSelectedRun(res.data);
        } catch (err) {
            console.error('Failed to load run details:', err);
            toast.error('Failed to load run details.');
        } finally {
            setRunDetailsLoading(false);
        }
    };

    // ----------------------------------------------------
    // 3. RUN LIFECYCLE ACTIONS
    // ----------------------------------------------------
    const handleRerunDraft = async (runId) => {
        try {
            const res = await payrollService.rerunPayrollRun(runId);
            toast.success(res.message || 'Draft run recalculation complete!');
            setSelectedRun(res.data);
            // Refresh runs list
            const updatedRuns = await payrollService.getPayrollRuns();
            setRuns(updatedRuns.data || []);
        } catch (err) {
            console.error('Failed to rerun payroll:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to rerun draft.');
        }
    };

    const handleApproveRun = async (runId) => {
        if (!window.confirm('Are you sure you want to approve and lock this payroll run?')) return;
        try {
            const res = await payrollService.approvePayrollRun(runId);
            toast.success('Payroll run approved and locked!');
            setSelectedRun(res.data);
            const updatedRuns = await payrollService.getPayrollRuns();
            setRuns(updatedRuns.data || []);
        } catch (err) {
            console.error('Failed to approve run:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to approve run.');
        }
    };

    const handleMarkAsPaid = async (runId) => {
        if (!window.confirm('Mark this payroll run as disbursed/paid to employee bank accounts?')) return;
        try {
            const res = await payrollService.markRunAsPaid(runId);
            toast.success('Payroll run marked as paid!');
            setSelectedRun(res.data);
            const updatedRuns = await payrollService.getPayrollRuns();
            setRuns(updatedRuns.data || []);
        } catch (err) {
            console.error('Failed to mark as paid:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to mark as paid.');
        }
    };

    const handleViewPayslip = async (runId, employeeId) => {
        try {
            const res = await payrollService.getEmployeePayslip(runId, employeeId);
            setSelectedPayslipData(res.data);
            setIsPayslipModalOpen(true);
        } catch (err) {
            console.error('Failed to fetch employee payslip:', err);
            toast.error('Failed to fetch employee payslip.');
        }
    };

    const handleTogglePackageActive = async (pkg) => {
        if (!pkg) return;
        const newStatus = pkg.is_active ? 0 : 1;
        const actionText = newStatus ? 'activated' : 'deactivated';
        try {
            await payrollService.updatePackage(pkg.id, { is_active: newStatus });
            toast.success(`Package "${pkg.name}" ${actionText} successfully.`);
            const pkgsRes = await payrollService.getPackages();
            setPackages(pkgsRes.data || []);
            const updated = pkgsRes.data?.find(p => p.id === pkg.id) || null;
            setSelectedPackage(updated);
        } catch (err) {
            console.error(`Failed to update status for package "${pkg.name}":`, err);
            toast.error(err.response?.data?.message || err.message || 'Failed to update package status.');
        }
    };

    const handleDeletePackage = async (packageId, name) => {
        if (!window.confirm(`Are you sure you want to permanently delete package "${name}"?`)) return;
        try {
            await payrollService.deletePackage(packageId);
            toast.success(`Package "${name}" deleted successfully.`);
            const pkgsRes = await payrollService.getPackages();
            setPackages(pkgsRes.data || []);
            setSelectedPackage(pkgsRes.data?.[0] || null);
        } catch (err) {
            console.error('Failed to delete package:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to delete package.');
        }
    };

    const handleDeleteComponent = async (packageId, componentId, compName) => {
        if (!window.confirm(`Delete component "${compName}" from this package?`)) return;
        try {
            await payrollService.deletePackageComponent(packageId, componentId);
            toast.success(`Component "${compName}" deleted.`);
            // Refresh package details
            const pkgRes = await payrollService.getPackageById(packageId);
            setSelectedPackage(pkgRes.data);
            // Refresh list
            const pkgsRes = await payrollService.getPackages();
            setPackages(pkgsRes.data || []);
        } catch (err) {
            console.error('Failed to delete component:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to delete component.');
        }
    };

    const handleUnassign = async (employeeId, name) => {
        if (!window.confirm(`Unassign salary package from ${name}?`)) return;
        try {
            await payrollService.unassignPackageFromEmployee(employeeId);
            toast.success(`Package unassigned from ${name}.`);
            const assignRes = await payrollService.getAssignments();
            setAssignments(assignRes.data || []);
        } catch (err) {
            console.error('Failed to unassign package:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to unassign package.');
        }
    };

    // ----------------------------------------------------
    // 4. COMPUTED METRICS
    // ----------------------------------------------------
    const filteredRunEmployees = useMemo(() => {
        if (!selectedRun?.employees) return [];
        return selectedRun.employees.filter(emp => {
            const query = employeeSearch.toLowerCase();
            const name = (emp.user_name || '').toLowerCase();
            const code = (emp.user_code || '').toLowerCase();
            const dept = (emp.dept_name || '').toLowerCase();
            return name.includes(query) || code.includes(query) || dept.includes(query);
        });
    }, [selectedRun, employeeSearch]);

    const uniqueDepartments = useMemo(() => {
        const depts = new Set();
        assignments.forEach(a => {
            if (a.department && a.department.trim()) {
                depts.add(a.department.trim());
            }
        });
        return Array.from(depts).sort();
    }, [assignments]);

    const assignmentStats = useMemo(() => {
        const total = assignments.length;
        const assigned = assignments.filter(a => !!a.package_id).length;
        const unassigned = total - assigned;
        const percent = total > 0 ? Math.round((assigned / total) * 100) : 0;
        return { total, assigned, unassigned, percent };
    }, [assignments]);

    const activeAssignments = useMemo(() => {
        return assignments.filter(a => {
            // Status filter
            if (assignmentFilterStatus === 'assigned' && !a.package_id) return false;
            if (assignmentFilterStatus === 'unassigned' && !!a.package_id) return false;

            // Department filter
            if (assignmentDeptFilter !== 'all' && (a.department || '').trim() !== assignmentDeptFilter) return false;

            // Search query
            if (assignmentSearch.trim()) {
                const q = assignmentSearch.toLowerCase().trim();
                const name = (a.employee_name || a.name || '').toLowerCase();
                const code = (a.employee_code || a.user_code || '').toLowerCase();
                const email = (a.email || '').toLowerCase();
                const dept = (a.department || '').toLowerCase();
                const desg = (a.designation || '').toLowerCase();
                const pkg = (a.package_name || '').toLowerCase();
                return name.includes(q) || code.includes(q) || email.includes(q) || dept.includes(q) || desg.includes(q) || pkg.includes(q);
            }

            return true;
        });
    }, [assignments, assignmentSearch, assignmentFilterStatus, assignmentDeptFilter]);

    const runSummary = selectedRun?.summary || {
        employee_count: 0,
        total_gross: 0,
        total_deductions: 0,
        total_net: 0
    };

    return (
        <DashboardLayout title="Payroll Management" hideScrollbar={true}>
            <div className="max-w-7xl mx-auto pb-16 space-y-6 font-sans">

                {/* ============================================================ */}
                {/* 1. TOP HEADER & ACTION BUTTONS                               */}
                {/* ============================================================ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                                <CreditCard className="text-blue-600 dark:text-blue-400" size={24} />
                                Payroll
                            </h1>
                            {selectedRun && (
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                                    selectedRun.status === 'paid'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : selectedRun.status === 'approved'
                                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                }`}>
                                    {selectedRun.status}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {setupStatus.settings
                                ? `Base Currency: ${setupStatus.settings.currency || 'INR'} • Frequency: ${setupStatus.settings.payroll_frequency || 'Monthly'}`
                                : 'Configure salary packages, track LOP deductions & disburse salaries'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="px-3.5 py-2 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Settings size={14} />
                            Settings
                        </button>
                        <button
                            onClick={() => setIsCreatePackageModalOpen(true)}
                            className="px-3.5 py-2 border border-purple-200 dark:border-purple-800/40 bg-purple-50/50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Plus size={14} />
                            New Package
                        </button>
                        <button
                            onClick={() => setIsTriggerRunModalOpen(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            <Play size={13} fill="currentColor" />
                            Run Payroll
                        </button>
                    </div>
                </div>

                {/* ============================================================ */}
                {/* 2. SETUP REQUIRED ONBOARDING BANNER (If not configured)     */}
                {/* ============================================================ */}
                {!setupStatus.is_configured && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 mt-0.5">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Payroll Setup Incomplete
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                    Before generating packages or running payroll, configure your organization currency, frequency, and rounding rules.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
                        >
                            Configure Settings Now
                        </button>
                    </motion.div>
                )}

                {/* ============================================================ */}
                {/* 3. EXECUTIVE METRICS CARDS (Real backend run totals)         */}
                {/* ============================================================ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl p-4.5 shadow-xs relative overflow-hidden group hover:border-purple-300 dark:hover:border-purple-800 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Run Gross</span>
                            <span className="p-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                                <Wallet size={14} />
                            </span>
                        </div>
                        <div className="text-2xl font-black text-purple-700 dark:text-purple-300 font-mono tracking-tight">
                            ₹{formatINR(runSummary.total_gross)}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">Contractual gross before deductions</span>
                    </div>

                    <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl p-4.5 shadow-xs relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Net Employee Payout</span>
                            <span className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={14} />
                            </span>
                        </div>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                            ₹{formatINR(runSummary.total_net)}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">Net bank transfer amount</span>
                    </div>

                    <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl p-4.5 shadow-xs relative overflow-hidden group hover:border-rose-300 dark:hover:border-rose-800 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Deductions</span>
                            <span className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                                <Percent size={14} />
                            </span>
                        </div>
                        <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                            ₹{formatINR(runSummary.total_deductions)}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">LOP & statutory withholdings</span>
                    </div>

                    <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl p-4.5 shadow-xs relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Employees Processed</span>
                            <span className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                <Users size={14} />
                            </span>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                            {runSummary.employee_count} Staff
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">In currently selected run</span>
                    </div>
                </div>

                {/* ============================================================ */}
                {/* 4. SEGMENTED NAVIGATION TABS                                */}
                {/* ============================================================ */}
                <div className="border-b border-slate-200 dark:border-white/10 pb-px">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        {[
                            { id: 'runs', label: 'Payroll Runs', icon: FileText, badge: `${runs.length}` },
                            { id: 'packages', label: 'Salary Packages', icon: Layers, badge: `${packages.length}` },
                            { id: 'assignments', label: 'Staff Assignments', icon: UserCheck, badge: `${assignments.length}` },
                            { id: 'settings', label: 'Settings', icon: Settings, badge: setupStatus.is_configured ? 'Active' : 'Setup' }
                        ].map(t => {
                            const isSelected = activeTab === t.id;
                            const Icon = t.icon;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`relative px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                        isSelected
                                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/40 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <Icon size={15} className={isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                                    <span>{t.label}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold transition-colors ${
                                        isSelected
                                            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                                            : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                                    }`}>
                                        {t.badge}
                                    </span>
                                    {isSelected && (
                                        <motion.div
                                            layoutId="activeTabUnderline"
                                            className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ============================================================ */}
                {/* TAB 1: PAYROLL RUNS                                          */}
                {/* ============================================================ */}
                {activeTab === 'runs' && (
                    <div className="space-y-6">
                        {/* Run Selector & Filters */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 shadow-xs">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500">Run:</span>
                                <select
                                    value={selectedRun?.id || ''}
                                    onChange={(e) => loadRunDetails(Number(e.target.value))}
                                    className="px-3.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                                >
                                    {runs.map(r => (
                                        <option key={r.id} value={r.id} className="dark:bg-slate-800">
                                            #{r.id} - {r.batch_name || `${r.run_type.toUpperCase()} Run`} ({r.period_start} to {r.period_end}) [{r.status.toUpperCase()}]
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Actions for Selected Run */}
                            {selectedRun && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {selectedRun.status === 'draft' && (
                                        <>
                                            <button
                                                onClick={() => handleRerunDraft(selectedRun.id)}
                                                className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <RefreshCw size={13} />
                                                Re-run Draft
                                            </button>
                                            <button
                                                onClick={() => handleApproveRun(selectedRun.id)}
                                                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                            >
                                                <Check size={13} />
                                                Approve Run
                                            </button>
                                        </>
                                    )}

                                    {selectedRun.status === 'approved' && (
                                        <button
                                            onClick={() => handleMarkAsPaid(selectedRun.id)}
                                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <CheckCircle2 size={14} />
                                            Mark as Paid
                                        </button>
                                    )}

                                    {selectedRun.status === 'paid' && (
                                        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                                            <CheckCircle size={14} />
                                            Disbursed on {selectedRun.paid_at ? new Date(selectedRun.paid_at).toLocaleDateString() : 'Paid'}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Employee Rows Table in Selected Run */}
                        <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                        Staff Payslips Breakdown
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Showing {filteredRunEmployees.length} employee entries for this period
                                    </p>
                                </div>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search employee or department..."
                                        value={employeeSearch}
                                        onChange={(e) => setEmployeeSearch(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
                                    />
                                </div>
                            </div>

                            {runDetailsLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
                                    <RefreshCw size={24} className="animate-spin text-blue-500" />
                                    <span className="text-xs font-bold">Loading run details...</span>
                                </div>
                            ) : filteredRunEmployees.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 space-y-2">
                                    <Users size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                                    <p className="text-xs font-bold">No employee records in this payroll run.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                <th className="py-3 px-4">Employee</th>
                                                <th className="py-3 px-4">Department</th>
                                                <th className="py-3 px-4">Gross Earnings</th>
                                                <th className="py-3 px-4">Attendance Adjustments</th>
                                                <th className="py-3 px-4">Deductions</th>
                                                <th className="py-3 px-4">Net Take-Home</th>
                                                <th className="py-3 px-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-medium text-slate-700 dark:text-slate-200">
                                            {filteredRunEmployees.map((emp, idx) => {
                                                const lopLine = (emp.lines || []).find(l => l.name?.toLowerCase().includes('loss of pay') || l.name?.toLowerCase().includes('lop'));
                                                const otLine = (emp.lines || []).find(l => l.name?.toLowerCase().includes('overtime'));

                                                return (
                                                    <tr key={emp.employee_id || `emp-${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                                                        <td className="py-3 px-4">
                                                            <div className="font-bold text-slate-900 dark:text-white">
                                                                {emp.employee_name || emp.user_name}
                                                            </div>
                                                            {emp.employee_code || emp.user_code ? (
                                                                <div className="text-[10px] text-slate-400 font-mono">
                                                                    {emp.employee_code || emp.user_code}
                                                                </div>
                                                            ) : null}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-500">
                                                            {emp.dept_name || 'General'}
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                                                            ₹{formatINR(emp.gross_pay)}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                {lopLine && (
                                                                    <span
                                                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40"
                                                                        title={lopLine.description}
                                                                    >
                                                                        LOP: -₹{formatINR(lopLine.amount)}
                                                                    </span>
                                                                )}
                                                                {otLine && (
                                                                    <span
                                                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40"
                                                                        title={otLine.description}
                                                                    >
                                                                        OT: +₹{formatINR(otLine.amount)}
                                                                    </span>
                                                                )}
                                                                {!lopLine && !otLine && (
                                                                    <span className="text-[11px] text-slate-400 font-medium">None</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                                                            -₹{formatINR(emp.total_deductions)}
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                            ₹{formatINR(emp.net_pay)}
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <button
                                                                onClick={() => handleViewPayslip(selectedRun.id, emp.employee_id)}
                                                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                                            >
                                                                <Eye size={12} />
                                                                View Payslip
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* TAB 2: SALARY PACKAGES                                       */}
                {/* ============================================================ */}
                {activeTab === 'packages' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Package List Left Pane */}
                        <div className="lg:col-span-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    All Packages ({packages.length})
                                </span>
                                <button
                                    onClick={() => setIsCreatePackageModalOpen(true)}
                                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
                                >
                                    <Plus size={14} /> New Package
                                </button>
                            </div>

                            <div className="space-y-2">
                                {packages.map(pkg => (
                                    <div
                                        key={pkg.id}
                                        onClick={() => setSelectedPackage(pkg)}
                                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                            selectedPackage?.id === pkg.id
                                                ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-1 ring-purple-500'
                                                : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 bg-white dark:bg-dark-card'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                                {pkg.name}
                                            </h4>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${pkg.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                    {pkg.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold">
                                                    {pkg.components?.length || 0} comps
                                                </span>
                                            </div>
                                        </div>
                                        {pkg.description && (
                                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                                                {pkg.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Package Detail Right Pane */}
                        <div className="lg:col-span-2 space-y-4">
                            {selectedPackage ? (
                                <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-6">
                                    {/* Header & Delete */}
                                    <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/10 pb-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                                    {selectedPackage.name}
                                                </h3>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedPackage.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                    {selectedPackage.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {selectedPackage.description || 'No description provided'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Status Toggle */}
                                            <div className="flex items-center gap-2 border border-slate-200 dark:border-white/10 px-2.5 py-1 rounded-xl bg-slate-50/50 dark:bg-white/5 select-none">
                                                <span className={`text-xs font-bold transition-colors ${selectedPackage.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                    {selectedPackage.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleTogglePackageActive(selectedPackage)}
                                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${selectedPackage.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                    title={selectedPackage.is_active ? 'Deactivate package' : 'Activate package'}
                                                >
                                                    <span
                                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${selectedPackage.is_active ? 'translate-x-4' : 'translate-x-0'}`}
                                                    />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => setIsEditPackageModalOpen(true)}
                                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                                title="Edit package details & rules"
                                            >
                                                <Edit3 size={13} />
                                                Edit Package
                                            </button>
                                            <button
                                                onClick={() => setIsAddComponentModalOpen(true)}
                                                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-purple-500/20"
                                            >
                                                <Plus size={13} />
                                                Add Component
                                            </button>
                                            <button
                                                onClick={() => handleDeletePackage(selectedPackage.id, selectedPackage.name)}
                                                className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                                title="Delete package"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Package Rules Box */}
                                    <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                                Loss of Pay (LOP) Rule
                                            </span>
                                            <span className="font-bold text-slate-800 dark:text-white mt-1 block">
                                                {selectedPackage.packages_rules?.lop?.enabled !== false
                                                    ? `Deducted from ${selectedPackage.packages_rules?.lop?.basis || 'gross'} / ${selectedPackage.packages_rules?.lop?.day_basis || 'calendar days'}`
                                                    : 'Disabled'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                                Overtime Compensation
                                            </span>
                                            <span className="font-bold text-slate-800 dark:text-white mt-1 block">
                                                {selectedPackage.packages_rules?.ot?.enabled !== false
                                                    ? `₹${selectedPackage.packages_rules?.ot?.hourly_rate || 150}/hr (${selectedPackage.packages_rules?.ot?.multiplier || 1.5}x multiplier)`
                                                    : 'Disabled'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Components Table */}
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            Components Structure
                                        </h4>
                                        <div className="border border-slate-200/80 dark:border-white/10 rounded-xl overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold text-slate-400 uppercase">
                                                    <tr>
                                                        <th className="py-2.5 px-3">Name</th>
                                                        <th className="py-2.5 px-3">Category</th>
                                                        <th className="py-2.5 px-3">Type</th>
                                                        <th className="py-2.5 px-3">Value</th>
                                                        <th className="py-2.5 px-3 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                                    {(selectedPackage.components || []).map((comp, cIdx) => (
                                                        <tr key={comp.id || `comp-${cIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                                                {comp.name}
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                                                    comp.category === 'earning'
                                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                                }`}>
                                                                    {comp.category}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-slate-500">
                                                                {comp.calc_type === 'fixed' ? 'Fixed (₹)' : '% of Base'}
                                                            </td>
                                                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                                                {comp.calc_type === 'fixed' ? `₹${formatINR(comp.value)}` : `${comp.value}%`}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingComponent(comp);
                                                                            setIsEditComponentModalOpen(true);
                                                                        }}
                                                                        className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors cursor-pointer"
                                                                        title="Edit component"
                                                                    >
                                                                        <Edit3 size={13} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteComponent(selectedPackage.id, comp.id, comp.name)}
                                                                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                                                        title="Delete component"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl">
                                    <p className="text-xs font-bold">Select a package from the left to view details.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* ============================================================ */}
                {/* TAB 3: STAFF ASSIGNMENTS                                     */}
                {/* ============================================================ */}
                {activeTab === 'assignments' && (
                    <div className="space-y-6">
                        {/* 1. Summary KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Total Workforce */}
                            <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Workforce</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-2xl font-black text-slate-900 dark:text-white">
                                            {assignmentStats.total}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">Team Members</span>
                                    </div>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <Users size={20} />
                                </div>
                            </div>

                            {/* Active Packages Assigned */}
                            <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Packages Linked</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                            {assignmentStats.assigned}
                                        </span>
                                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">
                                            {assignmentStats.percent}% Covered
                                        </span>
                                    </div>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <CheckCircle2 size={20} />
                                </div>
                            </div>

                            {/* Pending Package Setup */}
                            <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Package Setup</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className={`text-2xl font-black ${assignmentStats.unassigned > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                            {assignmentStats.unassigned}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">Action Needed</span>
                                    </div>
                                </div>
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                                    assignmentStats.unassigned > 0
                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                        : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                                }`}>
                                    <AlertTriangle size={20} />
                                </div>
                            </div>
                        </div>

                        {/* 2. Main Card: Table & Filter Controls */}
                        <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
                            {/* Toolbar Header */}
                            <div className="p-5 border-b border-slate-200/80 dark:border-white/10 space-y-4">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <span>Employee Salary Package Assignments</span>
                                            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                                                {activeAssignments.length} {activeAssignments.length === 1 ? 'Record' : 'Records'}
                                            </span>
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Assign compensation packages, track active salary structures, and manage transitions
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setPreselectedEmpForAssign(null);
                                                setIsAssignModalOpen(true);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
                                        >
                                            <Plus size={15} />
                                            Assign Salary Package
                                        </button>
                                    </div>
                                </div>

                                {/* Filter Controls Row */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                    {/* Status Pills */}
                                    <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/60 dark:border-white/10">
                                        <button
                                            onClick={() => setAssignmentFilterStatus('all')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                assignmentFilterStatus === 'all'
                                                    ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-white shadow-xs font-bold'
                                                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                                            }`}
                                        >
                                            All Staff ({assignmentStats.total})
                                        </button>
                                        <button
                                            onClick={() => setAssignmentFilterStatus('assigned')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                assignmentFilterStatus === 'assigned'
                                                    ? 'bg-white dark:bg-dark-card text-emerald-700 dark:text-emerald-400 shadow-xs font-bold'
                                                    : 'text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400'
                                            }`}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            Assigned ({assignmentStats.assigned})
                                        </button>
                                        <button
                                            onClick={() => setAssignmentFilterStatus('unassigned')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                assignmentFilterStatus === 'unassigned'
                                                    ? 'bg-white dark:bg-dark-card text-amber-700 dark:text-amber-400 shadow-xs font-bold'
                                                    : 'text-slate-500 hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-400'
                                            }`}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                            Pending ({assignmentStats.unassigned})
                                        </button>
                                    </div>

                                    {/* Department Dropdown & Search Bar */}
                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                        {uniqueDepartments.length > 0 && (
                                            <div className="relative">
                                                <select
                                                    value={assignmentDeptFilter}
                                                    onChange={(e) => setAssignmentDeptFilter(e.target.value)}
                                                    className="pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer appearance-none"
                                                >
                                                    <option value="all">All Departments</option>
                                                    {uniqueDepartments.map(dept => (
                                                        <option key={dept} value={dept}>{dept}</option>
                                                    ))}
                                                </select>
                                                <Building2 size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                                            </div>
                                        )}

                                        <div className="relative flex-1 sm:w-64">
                                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search by name, code, role..."
                                                value={assignmentSearch}
                                                onChange={(e) => setAssignmentSearch(e.target.value)}
                                                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                                            />
                                            {assignmentSearch && (
                                                <button
                                                    onClick={() => setAssignmentSearch('')}
                                                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="py-3 px-5">Team Member</th>
                                            <th className="py-3 px-4">Department & Role</th>
                                            <th className="py-3 px-4">Current Salary Package</th>
                                            <th className="py-3 px-4">Effective Period</th>
                                            <th className="py-3 px-4">Rules & Overtime</th>
                                            <th className="py-3 px-5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                        {activeAssignments.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="py-16 text-center">
                                                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-3">
                                                            <Search size={22} />
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                            No team members match your criteria
                                                        </p>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Try adjusting your search terms or clearing the status/department filters.
                                                        </p>
                                                        {(assignmentSearch || assignmentFilterStatus !== 'all' || assignmentDeptFilter !== 'all') && (
                                                            <button
                                                                onClick={() => {
                                                                    setAssignmentSearch('');
                                                                    setAssignmentFilterStatus('all');
                                                                    setAssignmentDeptFilter('all');
                                                                }}
                                                                className="mt-3 text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 cursor-pointer"
                                                            >
                                                                Clear all filters
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            activeAssignments.map((a) => {
                                                const displayName = a.employee_name || a.name || 'Unnamed Employee';
                                                const displayCode = a.employee_code || a.user_code;
                                                const hasPackage = !!a.package_id;
                                                const initials = displayName
                                                    .trim()
                                                    .split(/\s+/)
                                                    .slice(0, 2)
                                                    .map(p => p[0])
                                                    .join('')
                                                    .toUpperCase() || 'EM';

                                                return (
                                                    <tr
                                                        key={a.employee_id}
                                                        className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors group"
                                                    >
                                                        {/* Team Member */}
                                                        <td className="py-3.5 px-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                                                                    hasPackage
                                                                        ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
                                                                        : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                                                }`}>
                                                                    {initials}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                                        <span className="truncate">{displayName}</span>
                                                                        {displayCode && (
                                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                                                                {displayCode}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {a.email && (
                                                                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                                                            {a.email}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Department & Role */}
                                                        <td className="py-3.5 px-4">
                                                            <div className="space-y-0.5">
                                                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                                                                    <Building2 size={11} className="text-slate-400" />
                                                                    <span>{a.department || 'General'}</span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                                                    {a.designation || 'Staff'}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Current Package */}
                                                        <td className="py-3.5 px-4">
                                                            {hasPackage ? (
                                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                                                                    <Briefcase size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                                                    <span className="truncate max-w-[180px]">{a.package_name}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                                    <span>No Package Linked</span>
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Effective Period */}
                                                        <td className="py-3.5 px-4">
                                                            {hasPackage && a.effective_from ? (
                                                                <div className="space-y-0.5">
                                                                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                                        <Calendar size={12} className="text-slate-400" />
                                                                        <span>From: {a.effective_from}</span>
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-medium">
                                                                        {a.effective_to ? `To: ${a.effective_to}` : 'Ongoing Active'}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 italic">
                                                                    Pending Setup
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Rules & Overtime */}
                                                        <td className="py-3.5 px-4">
                                                            {hasPackage ? (
                                                                <div className="flex flex-wrap items-center gap-1">
                                                                    {(a.packages_rules?.lop?.enabled ?? a.packages_rules?.lop_enabled) !== false ? (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                                                            LOP Active
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400">
                                                                            No LOP
                                                                        </span>
                                                                    )}
                                                                    {((a.packages_rules?.ot?.enabled ?? a.packages_rules?.overtime_enabled) !== false) ? (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                                            OT {a.packages_rules?.ot?.multiplier || a.packages_rules?.overtime_rate_multiplier || 1.5}x
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                                                                            No OT
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs">—</span>
                                                            )}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="py-3.5 px-5 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {hasPackage ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => {
                                                                                setStructureEmployee(a);
                                                                                setStructurePackage(packages.find(p => p.id === a.package_id) || null);
                                                                                setStructureEffectiveFrom(a.effective_from);
                                                                                setIsStructureModalOpen(true);
                                                                            }}
                                                                            className="px-2.5 py-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                                                            title="View salary structure breakdown & print Annexure A"
                                                                        >
                                                                            <Eye size={12} />
                                                                            Structure
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setPreselectedEmpForAssign(a);
                                                                                setIsAssignModalOpen(true);
                                                                            }}
                                                                            className="px-2.5 py-1 text-xs font-bold text-purple-700 hover:text-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg transition-colors cursor-pointer"
                                                                            title="Change or reassign package"
                                                                        >
                                                                            Change
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleUnassign(a.employee_id, displayName)}
                                                                            className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                                                            title="Unassign current salary package"
                                                                        >
                                                                            Unassign
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setPreselectedEmpForAssign(a);
                                                                            setIsAssignModalOpen(true);
                                                                        }}
                                                                        className="px-3 py-1 text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                                    >
                                                                        <Plus size={13} />
                                                                        Assign
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* TAB 4: SETTINGS VIEW                                         */}
                {/* ============================================================ */}
                {activeTab === 'settings' && (
                    <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-white/10 rounded-2xl p-6 shadow-xs max-w-2xl space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    Organization Payroll Settings
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Rules and standards configured in payroll_settings_v1
                                </p>
                            </div>
                            <button
                                onClick={() => setIsSettingsModalOpen(true)}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                            >
                                Edit Settings
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Base Currency</span>
                                <div className="text-base font-black text-slate-900 dark:text-white mt-1">
                                    {setupStatus.settings?.currency || 'INR (₹)'}
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Frequency</span>
                                <div className="text-base font-black text-slate-900 dark:text-white mt-1 capitalize">
                                    {setupStatus.settings?.payroll_frequency || 'Monthly'}
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Rounding Method</span>
                                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 capitalize">
                                    {(setupStatus.settings?.rounding_method || 'nearest').replace('_', ' ')}
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Rounding Precision</span>
                                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                    {setupStatus.settings?.rounding_precision || 0} Decimals
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* 5. MODALS INTEGRATION                                        */}
                {/* ============================================================ */}
                <PayrollSettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    initialSettings={setupStatus.settings}
                    onSaved={(newSettings) => {
                        setSetupStatus({ is_configured: true, settings: newSettings });
                    }}
                />

                <TriggerRunModal
                    isOpen={isTriggerRunModalOpen}
                    onClose={() => setIsTriggerRunModalOpen(false)}
                    employees={allEmployees}
                    onRunCreated={(newRun) => {
                        loadAllPayrollData();
                        setSelectedRun(newRun);
                    }}
                />

                <CreatePackageModal
                    isOpen={isCreatePackageModalOpen}
                    onClose={() => setIsCreatePackageModalOpen(false)}
                    isConfigured={setupStatus.is_configured}
                    onOpenSettings={() => setIsSettingsModalOpen(true)}
                    onPackageCreated={(newPkg) => {
                        setPackages(prev => [newPkg, ...prev]);
                        setSelectedPackage(newPkg);
                    }}
                />

                {selectedPackage && (
                    <EditPackageModal
                        isOpen={isEditPackageModalOpen}
                        onClose={() => setIsEditPackageModalOpen(false)}
                        packageData={selectedPackage}
                        onPackageUpdated={(updatedPkg) => {
                            setSelectedPackage(updatedPkg);
                            setPackages(prev => prev.map(p => p.id === updatedPkg.id ? updatedPkg : p));
                        }}
                    />
                )}

                {selectedPackage && (
                    <AddComponentModal
                        isOpen={isAddComponentModalOpen}
                        onClose={() => setIsAddComponentModalOpen(false)}
                        packageId={selectedPackage.id}
                        existingComponents={selectedPackage.components || []}
                        onComponentAdded={(newComp) => {
                            setSelectedPackage(prev => ({
                                ...prev,
                                components: [...(prev.components || []), newComp]
                            }));
                            setPackages(prev => prev.map(p => p.id === selectedPackage.id ? {
                                ...p,
                                components: [...(p.components || []), newComp]
                            } : p));
                        }}
                    />
                )}

                {selectedPackage && editingComponent && (
                    <EditComponentModal
                        isOpen={isEditComponentModalOpen}
                        onClose={() => {
                            setIsEditComponentModalOpen(false);
                            setEditingComponent(null);
                        }}
                        packageId={selectedPackage.id}
                        component={editingComponent}
                        existingComponents={selectedPackage.components || []}
                        onComponentUpdated={(updatedComp) => {
                            setSelectedPackage(prev => ({
                                ...prev,
                                components: (prev.components || []).map(c => c.id === updatedComp.id ? updatedComp : c)
                            }));
                            setPackages(prev => prev.map(p => p.id === selectedPackage.id ? {
                                ...p,
                                components: (p.components || []).map(c => c.id === updatedComp.id ? updatedComp : c)
                            } : p));
                        }}
                    />
                )}

                <AssignPackageModal
                    isOpen={isAssignModalOpen}
                    onClose={() => {
                        setIsAssignModalOpen(false);
                        setPreselectedEmpForAssign(null);
                    }}
                    employees={allEmployees}
                    packages={packages}
                    assignments={assignments}
                    preselectedEmployee={preselectedEmpForAssign}
                    onAssigned={(data, empObj, pkgObj, effFrom) => {
                        payrollService.getAssignments().then(res => setAssignments(res.data || []));
                        // Automatically open the Salary Structure UI immediately after assignment
                        setStructureEmployee(empObj || preselectedEmpForAssign);
                        setStructurePackage(pkgObj);
                        setStructureEffectiveFrom(effFrom);
                        setIsStructureModalOpen(true);
                    }}
                />

                <SalaryStructureModal
                    isOpen={isStructureModalOpen}
                    onClose={() => {
                        setIsStructureModalOpen(false);
                        setStructureEmployee(null);
                        setStructurePackage(null);
                        setStructureEffectiveFrom(null);
                    }}
                    employee={structureEmployee}
                    packageData={structurePackage}
                    effectiveFrom={structureEffectiveFrom}
                />

                <PayslipModal
                    isOpen={isPayslipModalOpen}
                    onClose={() => setIsPayslipModalOpen(false)}
                    initialData={selectedPayslipData}
                />
            </div>
        </DashboardLayout>
    );
};

export default Payroll;
