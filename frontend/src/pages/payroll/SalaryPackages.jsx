import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Save, Plus, X, Settings, Calendar, AlertTriangle,
    CheckCircle, Trash2, Layers, Search, Users, Check,
    Clock, RefreshCw, Edit2, ArrowRight
} from 'lucide-react';
import payrollService from '../../services/payrollService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const SalaryPackages = () => {
    const { avatarTimestamp } = useAuth();

    // ── PACKAGE STATE ─────────────────────────────────────────────────────────
    const [packages, setPackages] = useState([]);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [isLoadingPackages, setIsLoadingPackages] = useState(false);
    const [packageSearch, setPackageSearch] = useState('');
    const [revisions, setRevisions] = useState([]);
    const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);

    // Modals & Forms State
    const [showPackageForm, setShowPackageForm] = useState(false);
    const [packageForm, setPackageForm] = useState({
        name: '',
        grossSalary: '',
        overtimeEnabled: false,
        overtimeRate: '',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    const [showRevisionForm, setShowRevisionForm] = useState(false);
    const [revisionForm, setRevisionForm] = useState({
        grossSalary: '',
        overtimeEnabled: false,
        overtimeRate: '',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedEmployeeForAssign, setSelectedEmployeeForAssign] = useState(null);
    const [assignForm, setAssignForm] = useState({
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    const [showUnassignModal, setShowUnassignModal] = useState(false);
    const [selectedEmployeeForUnassign, setSelectedEmployeeForUnassign] = useState(null);
    const [unassignForm, setUnassignForm] = useState({
        grossSalary: '50000',
        overtimeEnabled: false,
        overtimeRate: '0',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [packageToDelete, setPackageToDelete] = useState(null);

    // Settings Modal State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
        lopCalculationMethod: 'Calendar Days',
        lopFixedDaysValue: 30,
        lopFactorPresent: 1.00,
        lopFactorHalfDay: 0.50,
        lopFactorAbsent: 0.00
    });

    // ── EMPLOYEE STATE ───────────────────────────────────────────────────────
    const [employees, setEmployees] = useState([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [employeeSearch, setEmployeeSearch] = useState('');

    // ── LOAD DATA ────────────────────────────────────────────────────────────
    const loadPackages = useCallback(async () => {
        setIsLoadingPackages(true);
        try {
            const res = await payrollService.getPackageGroups();
            if (res.status === 'success') {
                setPackages(res.data);
                if (!selectedPackage) {
                    setSelectedPackage(res.data[0] || null);
                } else {
                    const current = res.data.find(p => p.package_group_id === selectedPackage.package_group_id);
                    setSelectedPackage(current || res.data[0] || null);
                }
            }
        } catch (e) {
            toast.error('Failed to load packages');
        } finally {
            setIsLoadingPackages(false);
        }
    }, [selectedPackage]);

    const loadRevisions = useCallback(async (packageGroupId) => {
        if (!packageGroupId) return;
        setIsLoadingRevisions(true);
        try {
            const res = await payrollService.getPackageRevisions(packageGroupId);
            if (res.status === 'success') {
                setRevisions(res.data);
            }
        } catch (e) {
            toast.error('Failed to load package revisions');
        } finally {
            setIsLoadingRevisions(false);
        }
    }, []);

    const loadEmployees = useCallback(async () => {
        setIsLoadingEmployees(true);
        try {
            const res = await payrollService.getEmployeesWithPackages();
            if (res.status === 'success') {
                setEmployees(res.data);
            }
        } catch (e) {
            toast.error('Failed to load employees');
        } finally {
            setIsLoadingEmployees(false);
        }
    }, []);

    const loadSettings = useCallback(async () => {
        try {
            const res = await payrollService.getPayrollSettings();
            if (res.status === 'success' && res.data) {
                setSettingsForm({
                    lopCalculationMethod: res.data.lop_calculation_method || 'Calendar Days',
                    lopFixedDaysValue: res.data.lop_fixed_days_value || 30,
                    lopFactorPresent: res.data.lop_factor_present !== undefined ? Number(res.data.lop_factor_present) : 1.00,
                    lopFactorHalfDay: res.data.lop_factor_half_day !== undefined ? Number(res.data.lop_factor_half_day) : 0.50,
                    lopFactorAbsent: res.data.lop_factor_absent !== undefined ? Number(res.data.lop_factor_absent) : 0.00
                });
            }
        } catch (e) {
            toast.error('Failed to load payroll settings');
        }
    }, []);

    useEffect(() => {
        loadPackages();
        loadEmployees();
        loadSettings();
    }, []);

    useEffect(() => {
        if (selectedPackage) {
            loadRevisions(selectedPackage.package_group_id);
        } else {
            setRevisions([]);
        }
    }, [selectedPackage, loadRevisions]);

    // Populate revision form with active rates when opened
    useEffect(() => {
        if (showRevisionForm && selectedPackage && selectedPackage.active_rate) {
            setRevisionForm({
                grossSalary: selectedPackage.active_rate.gross_salary,
                overtimeEnabled: !!selectedPackage.active_rate.overtime_enabled,
                overtimeRate: selectedPackage.active_rate.overtime_rate || '0.00',
                effectiveFrom: new Date().toISOString().split('T')[0]
            });
        }
    }, [showRevisionForm, selectedPackage]);

    // ── HANDLERS ─────────────────────────────────────────────────────────────
    const handleCreatePackage = async (e) => {
        e.preventDefault();
        try {
            const data = {
                packageName: packageForm.name,
                grossSalary: Number(packageForm.grossSalary),
                overtimeEnabled: packageForm.overtimeEnabled,
                overtimeRate: Number(packageForm.overtimeRate || 0),
                effectiveFrom: packageForm.effectiveFrom
            };
            const res = await payrollService.createPackageGroup(data);
            if (res.status === 'success') {
                toast.success('Salary package created successfully!');
                setShowPackageForm(false);
                setPackageForm({
                    name: '',
                    grossSalary: '',
                    overtimeEnabled: false,
                    overtimeRate: '',
                    effectiveFrom: new Date().toISOString().split('T')[0]
                });
                loadPackages();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to create package');
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setIsSavingSettings(true);
        try {
            const res = await payrollService.updatePayrollSettings({
                lopCalculationMethod: settingsForm.lopCalculationMethod,
                lopFixedDaysValue: Number(settingsForm.lopFixedDaysValue || 30),
                lopFactorPresent: Number(settingsForm.lopFactorPresent),
                lopFactorHalfDay: Number(settingsForm.lopFactorHalfDay),
                lopFactorAbsent: Number(settingsForm.lopFactorAbsent)
            });
            if (res.status === 'success') {
                toast.success('Payroll settings updated successfully!');
                setShowSettingsModal(false);
                loadPackages();
                loadEmployees();
            } else {
                toast.error(res.message || 'Failed to update settings');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to update settings');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleCreateRevision = async (e) => {
        e.preventDefault();
        if (!selectedPackage) return;
        try {
            const data = {
                grossSalary: Number(revisionForm.grossSalary),
                overtimeEnabled: revisionForm.overtimeEnabled,
                overtimeRate: Number(revisionForm.overtimeRate || 0),
                effectiveFrom: revisionForm.effectiveFrom
            };
            const res = await payrollService.createPackageRevision(selectedPackage.package_group_id, data);
            if (res.status === 'success') {
                toast.success('Rate revision added successfully!');
                setShowRevisionForm(false);
                loadPackages();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to add revision');
        }
    };

    const handleToggleActive = async () => {
        if (!selectedPackage) return;
        const newStatus = selectedPackage.is_active === 1 ? 0 : 1;
        try {
            const res = await payrollService.updatePackageGroup(selectedPackage.package_group_id, {
                isActive: newStatus
            });
            if (res.status === 'success') {
                toast.success(`Package status updated to ${newStatus ? 'Active' : 'Inactive'}`);
                loadPackages();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to update status');
        }
    };

    const handleDeleteClick = (pkg) => {
        setPackageToDelete(pkg);
        setIsDeleteModalOpen(true);
    };

    const confirmDeletePackage = async () => {
        if (!packageToDelete) return;
        try {
            await payrollService.deletePackageGroup(packageToDelete.package_group_id);
            toast.success('Salary package deleted successfully');
            if (selectedPackage?.package_group_id === packageToDelete.package_group_id) {
                setSelectedPackage(null);
            }
            setIsDeleteModalOpen(false);
            setPackageToDelete(null);
            loadPackages();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to delete package');
        }
    };

    const handleAssignClick = (employee) => {
        setSelectedEmployeeForAssign(employee);
        setAssignForm({
            effectiveFrom: new Date().toISOString().split('T')[0]
        });
        setShowAssignModal(true);
    };

    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        if (!selectedEmployeeForAssign || !selectedPackage) return;
        try {
            const res = await payrollService.assignPackageToEmployee(
                selectedEmployeeForAssign.user_id,
                selectedPackage.package_group_id,
                assignForm.effectiveFrom
            );
            if (res.status === 'success') {
                toast.success(`Assigned ${selectedEmployeeForAssign.user_name} to ${selectedPackage.package_name}`);
                setShowAssignModal(false);
                setSelectedEmployeeForAssign(null);
                loadEmployees();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to assign package');
        }
    };

    const handleUnassignClick = (employee) => {
        // Prepopulate unassign form with the active rates of the package they are currently assigned to
        const currentPkg = packages.find(p => p.package_group_id === employee.package_group_id);
        const defaultGross = currentPkg?.active_rate?.gross_salary || '50000';
        const defaultOt = !!currentPkg?.active_rate?.overtime_enabled;
        const defaultOtRate = currentPkg?.active_rate?.overtime_rate || '0.00';

        setSelectedEmployeeForUnassign(employee);
        setUnassignForm({
            grossSalary: defaultGross,
            overtimeEnabled: defaultOt,
            overtimeRate: defaultOtRate,
            effectiveFrom: new Date().toISOString().split('T')[0]
        });
        setShowUnassignModal(true);
    };

    const handleUnassignSubmit = async (e) => {
        e.preventDefault();
        if (!selectedEmployeeForUnassign) return;
        try {
            const res = await payrollService.unassignPackageFromEmployee(
                selectedEmployeeForUnassign.user_id,
                {
                    grossMonthlySalary: Number(unassignForm.grossSalary),
                    overtimeEnabled: unassignForm.overtimeEnabled,
                    overtimeRate: Number(unassignForm.overtimeRate || 0),
                    effectiveFrom: unassignForm.effectiveFrom
                }
            );
            if (res.status === 'success') {
                toast.success(`Unassigned ${selectedEmployeeForUnassign.user_name} (switched to custom salary)`);
                setShowUnassignModal(false);
                setSelectedEmployeeForUnassign(null);
                loadEmployees();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to unassign package');
        }
    };

    const filteredPackages = packages.filter(p => p.package_name.toLowerCase().includes(packageSearch.toLowerCase()));
    const filteredEmployees = employees.filter(e =>
        e.user_name?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        e.desg_name?.toLowerCase().includes(employeeSearch.toLowerCase())
    );

    return (
        <DashboardLayout title="Salary Packages Management" noPadding={true}>
            <div className="flex h-[calc(100vh-64px)] p-3 gap-3 animate-in fade-in duration-300">

                {/* LEFT COLUMN: Package List */}
                <div className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/50 space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                <Layers size={18} className="text-indigo-500" />
                                <span>Salary Packages</span>
                            </h3>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => { setShowSettingsModal(true); }}
                                    className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    title="Global Payroll LOP Settings"
                                >
                                    <Settings size={18} />
                                </button>
                                <button
                                    onClick={() => { setShowPackageForm(true); }}
                                    className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                    title="Create new package"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search packages..."
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                value={packageSearch}
                                onChange={e => setPackageSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
                        {isLoadingPackages && (
                            <div className="py-10 text-center text-slate-400 text-sm">Loading packages...</div>
                        )}
                        {!isLoadingPackages && filteredPackages.length === 0 && (
                            <div className="py-10 text-center space-y-2">
                                <Layers size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                                <p className="text-sm text-slate-400">No packages found</p>
                                <button
                                    onClick={() => setShowPackageForm(true)}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                                >
                                    + Create first package
                                </button>
                            </div>
                        )}
                        {filteredPackages.map(pkg => (
                            <div
                                key={pkg.package_group_id}
                                onClick={() => setSelectedPackage(pkg)}
                                className={`p-3 rounded-lg border transition-all cursor-pointer group ${selectedPackage?.package_group_id === pkg.package_group_id
                                    ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                                    : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${pkg.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                        <h4 className={`font-semibold text-sm ${selectedPackage?.package_group_id === pkg.package_group_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                            {pkg.package_name}
                                        </h4>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pkg.is_active ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                        {pkg.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-github-dark-muted font-semibold mb-2">
                                    ₹{Number(pkg.active_rate?.gross_salary || 0).toLocaleString('en-IN')}/mo
                                </p>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-github-dark-muted">
                                    <span className="flex items-center gap-1">
                                        <Users size={10} />
                                        {employees.filter(e => e.package_group_id === pkg.package_group_id).length} Staff
                                    </span>
                                    {pkg.active_rate?.overtime_enabled === 1 && (
                                        <span className="text-indigo-500 font-semibold bg-indigo-50 dark:bg-indigo-900/20 px-1 rounded">OT Enabled</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CENTER COLUMN: Package Details & Rate revisions */}
                <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                    {!selectedPackage ? (
                        <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-400">
                            <Layers size={48} className="opacity-20 text-indigo-500 animate-pulse" />
                            <p className="text-sm">Select a salary package to view details</p>
                            <button
                                onClick={() => setShowPackageForm(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/10"
                            >
                                <Plus size={16} /> New Package
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Package Details Header */}
                            <div className="p-6 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-github-dark-text flex items-center gap-2">
                                        {selectedPackage.package_name}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Created on {new Date(selectedPackage.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleToggleActive}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedPackage.is_active
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-800'
                                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800'
                                            }`}
                                    >
                                        {selectedPackage.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(selectedPackage)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg border border-transparent hover:border-red-200 transition-all"
                                        title="Delete package"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Package Info Cards & History */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                                {/* Active Rate Configuration Card */}
                                <div className="p-5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                            Current Rate Settings
                                        </span>
                                        {selectedPackage.active_rate && (
                                            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 font-mono">
                                                <Calendar size={12} />
                                                Effective: {new Date(selectedPackage.active_rate.effective_from).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    {selectedPackage.active_rate ? (
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-xs text-slate-400 font-medium">Gross Monthly Salary</p>
                                                <p className="text-3xl font-black text-slate-900 dark:text-github-dark-text mt-1">
                                                    ₹{Number(selectedPackage.active_rate.gross_salary).toLocaleString('en-IN')}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400 font-medium font-semibold">Overtime Settings</p>
                                                {selectedPackage.active_rate.overtime_enabled === 1 ? (
                                                    <div className="mt-1 space-y-1">
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                                                            Enabled
                                                        </span>
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-github-dark-text font-mono">
                                                            Rate: ₹{selectedPackage.active_rate.overtime_rate}/hr
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 mt-1">
                                                        Disabled
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center text-sm text-slate-400">
                                            No rates defined for this package.
                                        </div>
                                    )}
                                </div>

                                {/* Revisions Revision Timeline */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2 text-sm">
                                            <Clock size={16} className="text-slate-400" />
                                            <span>Rate Revision History</span>
                                        </h3>
                                        <button
                                            onClick={() => setShowRevisionForm(true)}
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                        >
                                            + Add New Rate Revision
                                        </button>
                                    </div>

                                    {isLoadingRevisions ? (
                                        <p className="text-xs text-slate-400 text-center py-6">Loading revisions...</p>
                                    ) : revisions.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-6">No revisions found.</p>
                                    ) : (
                                        <div className="border border-slate-100 dark:border-github-dark-border rounded-xl overflow-hidden shadow-inner bg-slate-50/20">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-github-dark-subtle/50 text-slate-500 border-b border-slate-100 dark:border-github-dark-border font-semibold">
                                                        <th className="p-3">Gross Salary</th>
                                                        <th className="p-3">Overtime</th>
                                                        <th className="p-3">Effective From</th>
                                                        <th className="p-3">Effective Till</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-github-dark-border/50">
                                                    {revisions.map((rev, index) => (
                                                        <tr key={rev.package_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                            <td className="p-3 font-semibold text-slate-850 dark:text-slate-200">
                                                                ₹{Number(rev.gross_salary).toLocaleString('en-IN')}
                                                            </td>
                                                            <td className="p-3">
                                                                {rev.overtime_enabled ? (
                                                                    <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/10 px-1.5 py-0.5 rounded">
                                                                        ₹{rev.overtime_rate}/hr
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400">Disabled</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                                                                {new Date(rev.effective_from).toLocaleDateString()}
                                                            </td>
                                                            <td className="p-3 font-mono text-slate-500">
                                                                {rev.effective_to ? (
                                                                    new Date(rev.effective_to).toLocaleDateString()
                                                                ) : (
                                                                    <span className="text-emerald-500 font-semibold uppercase tracking-wider text-[9px] bg-emerald-50 dark:bg-emerald-950/20 px-1 rounded">Active</span>
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
                        </>
                    )}
                </div>

                {/* RIGHT COLUMN: Employee Assignment */}
                <div className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/50 space-y-3">
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-slate-500" />
                            <h3 className="font-semibold text-slate-800 dark:text-github-dark-text">Staff Assignments</h3>
                            {selectedPackage && (
                                <span className="ml-auto text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full animate-pulse">
                                    {employees.filter(e => e.package_group_id === selectedPackage.package_group_id).length} Assigned
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search staff..."
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                value={employeeSearch}
                                onChange={e => setEmployeeSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-0.5">
                        {isLoadingEmployees && (
                            <p className="text-sm text-slate-400 px-3 py-4 text-center">Loading users...</p>
                        )}
                        {!isLoadingEmployees && filteredEmployees.map(emp => {
                            const isAssigned = selectedPackage && emp.package_group_id === selectedPackage.package_group_id;
                            const hasOtherPackage = emp.package_group_id && (!selectedPackage || emp.package_group_id !== selectedPackage.package_group_id);
                            const otherPkg = hasOtherPackage ? packages.find(p => p.package_group_id === emp.package_group_id) : null;

                            return (
                                <div key={emp.user_id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors group">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 overflow-hidden flex-shrink-0">
                                            {emp.profile_image_url ? (
                                                <img src={`${emp.profile_image_url}?t=${avatarTimestamp}`} alt={emp.user_name} className="w-full h-full object-cover" />
                                            ) : emp.user_name?.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-800 dark:text-github-dark-text truncate">
                                                {emp.user_name}
                                            </p>
                                            <p className="text-[11px] text-slate-400 truncate">
                                                {otherPkg ? (
                                                    <span className="text-amber-500 font-semibold">{otherPkg.package_name}</span>
                                                ) : emp.desg_name || 'No designation'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!selectedPackage) return;
                                            if (isAssigned) {
                                                handleUnassignClick(emp);
                                            } else {
                                                handleAssignClick(emp);
                                            }
                                        }}
                                        disabled={!selectedPackage}
                                        title={!selectedPackage ? 'Select a package first' : isAssigned ? 'Unassign from package' : 'Assign to package'}
                                        className={`p-1.5 rounded-md transition-all flex-shrink-0 ${!selectedPackage ? 'cursor-not-allowed opacity-30' : isAssigned
                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-250'
                                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600'
                                            }`}
                                    >
                                        {isAssigned ? <Check size={16} /> : <Plus size={16} />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- CREATE PACKAGE MODAL --- */}
            {showPackageForm && (
                <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/70 backdrop-blur-sm transition-all duration-200 animate-in fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative w-full max-w-md bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border">
                                <h3 className="font-bold text-slate-900 dark:text-github-dark-text text-lg">Create Salary Package</h3>
                                <button onClick={() => setShowPackageForm(false)} className="text-slate-400 hover:text-slate-650 p-1 rounded-lg">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleCreatePackage} className="p-5 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Package Name</label>
                                    <input
                                        type="text" required value={packageForm.name}
                                        onChange={e => setPackageForm({ ...packageForm, name: e.target.value })}
                                        placeholder="e.g. Senior Software Engineer"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Gross Salary (Monthly)</label>
                                        <input
                                            type="number" required min="0" value={packageForm.grossSalary}
                                            onChange={e => setPackageForm({ ...packageForm, grossSalary: e.target.value })}
                                            placeholder="e.g. 80000"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Effective From</label>
                                        <input
                                            type="date" required value={packageForm.effectiveFrom}
                                            onChange={e => setPackageForm({ ...packageForm, effectiveFrom: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                        />
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 dark:text-github-dark-text">Enable Overtime</p>
                                            <p className="text-[10px] text-slate-400">Calculate extra pay for additional working hours</p>
                                        </div>
                                        <input
                                            type="checkbox" checked={packageForm.overtimeEnabled}
                                            onChange={e => setPackageForm({ ...packageForm, overtimeEnabled: e.target.checked })}
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                    </div>
                                    {packageForm.overtimeEnabled && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-750">
                                            <label className="block text-[11px] font-semibold text-slate-655 dark:text-slate-300 mb-1">Overtime Rate (per hour)</label>
                                            <input
                                                type="number" required min="0" value={packageForm.overtimeRate}
                                                onChange={e => setPackageForm({ ...packageForm, overtimeRate: e.target.value })}
                                                placeholder="e.g. 250"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button" onClick={() => setShowPackageForm(false)}
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-github-dark-text rounded-lg transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-indigo-650 hover:bg-indigo-550 text-white rounded-lg shadow-md shadow-indigo-600/10 hover:scale-[1.01] active:scale-95 transition-all"
                                    >
                                        Save
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ADD RATE REVISION MODAL --- */}
            {showRevisionForm && (
                <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/70 backdrop-blur-sm transition-all duration-200 animate-in fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative w-full max-w-md bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border">
                                <h3 className="font-bold text-slate-900 dark:text-github-dark-text text-lg">
                                    New Rate Revision: {selectedPackage?.package_name}
                                </h3>
                                <button onClick={() => setShowRevisionForm(false)} className="text-slate-400 hover:text-slate-650 p-1 rounded-lg">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleCreateRevision} className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">New Gross Salary</label>
                                        <input
                                            type="number" required min="0" value={revisionForm.grossSalary}
                                            onChange={e => setRevisionForm({ ...revisionForm, grossSalary: e.target.value })}
                                            placeholder="e.g. 90000"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Effective From</label>
                                        <input
                                            type="date" required value={revisionForm.effectiveFrom}
                                            onChange={e => setRevisionForm({ ...revisionForm, effectiveFrom: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                        />
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 dark:text-github-dark-text">Enable Overtime</p>
                                            <p className="text-[10px] text-slate-400">Calculate extra pay for additional working hours</p>
                                        </div>
                                        <input
                                            type="checkbox" checked={revisionForm.overtimeEnabled}
                                            onChange={e => setRevisionForm({ ...revisionForm, overtimeEnabled: e.target.checked })}
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                    </div>
                                    {revisionForm.overtimeEnabled && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-750">
                                            <label className="block text-[11px] font-semibold text-slate-655 dark:text-slate-300 mb-1">Overtime Rate (per hour)</label>
                                            <input
                                                type="number" required min="0" value={revisionForm.overtimeRate}
                                                onChange={e => setRevisionForm({ ...revisionForm, overtimeRate: e.target.value })}
                                                placeholder="e.g. 300"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button" onClick={() => setShowRevisionForm(false)}
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-github-dark-text rounded-lg transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-indigo-650 hover:bg-indigo-550 text-white rounded-lg shadow-md shadow-indigo-600/10 hover:scale-[1.01] active:scale-95 transition-all"
                                    >
                                        Add Revision
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ASSIGN PACKAGE MODAL --- */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/70 backdrop-blur-sm transition-all duration-200 animate-in fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative w-full max-w-sm bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border">
                                <h3 className="font-bold text-slate-900 dark:text-github-dark-text text-base">Assign Package</h3>
                                <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-650 p-1 rounded-lg">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4">
                                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl space-y-2 border border-slate-100 dark:border-github-dark-border">
                                    <p className="text-xs font-semibold text-slate-400">Employee</p>
                                    <p className="text-sm font-bold text-slate-905 dark:text-slate-100">{selectedEmployeeForAssign?.user_name}</p>
                                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-750 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400">Target Package</p>
                                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{selectedPackage?.package_name}</p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Effective From</label>
                                    <input
                                        type="date" required value={assignForm.effectiveFrom}
                                        onChange={e => setAssignForm({ ...assignForm, effectiveFrom: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">This package settings will apply from the selected date onwards.</p>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button" onClick={() => setShowAssignModal(false)}
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-github-dark-text rounded-lg transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-indigo-650 hover:bg-indigo-550 text-white rounded-lg transition-all shadow-md shadow-indigo-600/10"
                                    >
                                        Assign
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- UNASSIGN PACKAGE MODAL --- */}
            {showUnassignModal && (
                <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/70 backdrop-blur-sm transition-all duration-200 animate-in fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative w-full max-w-md bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border">
                                <h3 className="font-bold text-slate-900 dark:text-github-dark-text text-base">Unassign Package / Custom Salary</h3>
                                <button onClick={() => setShowUnassignModal(false)} className="text-slate-400 hover:text-slate-655 p-1 rounded-lg">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleUnassignSubmit} className="p-5 space-y-4">
                                <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                                    <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                                        <AlertTriangle size={14} /> Switching to Custom Salary Configuration
                                    </h4>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        Unassigning {selectedEmployeeForUnassign?.user_name} will switch them back to an individual salary config starting from the effective date.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Custom Gross Salary</label>
                                        <input
                                            type="number" required min="0" value={unassignForm.grossSalary}
                                            onChange={e => setUnassignForm({ ...unassignForm, grossSalary: e.target.value })}
                                            placeholder="e.g. 50000"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Effective From</label>
                                        <input
                                            type="date" required value={unassignForm.effectiveFrom}
                                            onChange={e => setUnassignForm({ ...unassignForm, effectiveFrom: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                        />
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 dark:text-github-dark-text">Enable Overtime</p>
                                            <p className="text-[10px] text-slate-400">Calculate extra pay for additional working hours</p>
                                        </div>
                                        <input
                                            type="checkbox" checked={unassignForm.overtimeEnabled}
                                            onChange={e => setUnassignForm({ ...unassignForm, overtimeEnabled: e.target.checked })}
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                    </div>
                                    {unassignForm.overtimeEnabled && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-750">
                                            <label className="block text-[11px] font-semibold text-slate-655 dark:text-slate-300 mb-1">Overtime Rate (per hour)</label>
                                            <input
                                                type="number" required min="0" value={unassignForm.overtimeRate}
                                                onChange={e => setUnassignForm({ ...unassignForm, overtimeRate: e.target.value })}
                                                placeholder="e.g. 200"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button" onClick={() => setShowUnassignModal(false)}
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-github-dark-text rounded-lg transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all shadow-md shadow-amber-500/10"
                                    >
                                        Switch to Custom
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- GLOBAL PAYROLL SETTINGS MODAL --- */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/70 backdrop-blur-sm transition-all duration-200 animate-in fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative w-full max-w-md bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                                <div className="flex items-center gap-2">
                                    <Settings className="text-indigo-500" size={18} />
                                    <h3 className="font-bold text-slate-900 dark:text-github-dark-text text-base">Global Payroll LOP Settings</h3>
                                </div>
                                <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
                                <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 rounded-xl space-y-1">
                                    <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                        Organization Payment Multipliers
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-github-dark-muted leading-relaxed">
                                        Adjust the daily salary multiplier for each attendance status. LOP deductions will be calculated dynamically based on these multipliers.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Present / Late status multiplier
                                            </label>
                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                {((settingsForm.lopFactorPresent || 0) * 100).toFixed(0)}% Pay
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            max="2"
                                            step="0.01"
                                            value={settingsForm.lopFactorPresent}
                                            onChange={e => setSettingsForm({ ...settingsForm, lopFactorPresent: parseFloat(e.target.value) || 0.0 })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text font-mono"
                                            placeholder="e.g. 1.0"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Multiplier applied for present days (typically 1.0 for 100% pay).</p>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Half Day status multiplier
                                            </label>
                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                {((settingsForm.lopFactorHalfDay || 0) * 100).toFixed(0)}% Pay
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            max="2"
                                            step="0.01"
                                            value={settingsForm.lopFactorHalfDay}
                                            onChange={e => setSettingsForm({ ...settingsForm, lopFactorHalfDay: parseFloat(e.target.value) || 0.0 })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text font-mono"
                                            placeholder="e.g. 0.5"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Multiplier applied for half-day shifts (typically 0.5 for 50% pay).</p>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Absent / Missed Punch status multiplier
                                            </label>
                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                {((settingsForm.lopFactorAbsent || 0) * 100).toFixed(0)}% Pay
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            max="2"
                                            step="0.01"
                                            value={settingsForm.lopFactorAbsent}
                                            onChange={e => setSettingsForm({ ...settingsForm, lopFactorAbsent: parseFloat(e.target.value) || 0.0 })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text font-mono"
                                            placeholder="e.g. 0.0"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Multiplier applied for absent days (typically 0.0 for 0% pay).</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowSettingsModal(false)}
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-github-dark-text rounded-lg transition-all"
                                        disabled={isSavingSettings}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
                                        disabled={isSavingSettings}
                                    >
                                        {isSavingSettings ? (
                                            <>
                                                <RefreshCw size={14} className="animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>Save Policy</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DELETE CONFIRMATION MODAL --- */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-all duration-200 animate-in fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative w-full max-w-lg bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 mx-auto">
                            <div className="p-10 text-center">
                                <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                                    <AlertTriangle size={40} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-github-dark-text mb-3">Delete Salary Package?</h3>
                                <p className="text-slate-500 dark:text-github-dark-muted mb-10 leading-relaxed">
                                    Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-github-dark-text">"{packageToDelete?.package_name}"</span>?<br />This action will delete the package. Revisions and historical configurations assigned to employees will remain, but you won't be able to make new assignments to this package.
                                </p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => { setIsDeleteModalOpen(false); setPackageToDelete(null); }}
                                        className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 dark:bg-github-dark-subtle/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-github-dark-text font-bold transition-all"
                                    >
                                        Keep it
                                    </button>
                                    <button
                                        onClick={confirmDeletePackage}
                                        className="flex-1 px-6 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default SalaryPackages;
