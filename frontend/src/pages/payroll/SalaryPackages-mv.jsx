import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Layers, Plus, Search, RefreshCw, Users, ChevronRight, X,
    Edit2, Trash2, Settings, Calendar, Check, AlertCircle, Clock
} from 'lucide-react';
import payrollService from '../../services/payrollService';
import { toast } from 'react-toastify';
import { formatPlatformDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import ProfilePictureModal from '../../components/modals/ProfilePictureModal';

const SalaryPackagesMobile = ({ embedded = false }) => {
    const { avatarTimestamp } = useAuth();
    const [previewAvatarData, setPreviewAvatarData] = useState(null);

    const openAvatarPreview = (emp) => {
        if (!emp) return;
        setPreviewAvatarData({
            imageUrl: emp.profile_image_url ? `${emp.profile_image_url}?t=${avatarTimestamp}` : null,
            name: emp.user_name || 'Staff Member',
            role: emp.desg_name || 'Staff',
            department: emp.dept_name,
            email: emp.email,
            phone: emp.phone_no
        });
    };

    // Data State
    const [packages, setPackages] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [revisions, setRevisions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal / Bottom Sheet States
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isPackageFormOpen, setIsPackageFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isRevisionOpen, setIsRevisionOpen] = useState(false);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Form States
    const [packageForm, setPackageForm] = useState({
        name: '',
        grossSalary: '',
        overtimeEnabled: false,
        overtimeRate: '',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    const [revisionForm, setRevisionForm] = useState({
        grossSalary: '',
        overtimeEnabled: false,
        overtimeRate: '',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    const [settingsForm, setSettingsForm] = useState({
        lopCalculationMethod: 'Calendar Days',
        lopFixedDaysValue: 30,
        lopFactorPresent: 1.00,
        lopFactorHalfDay: 0.50,
        lopFactorAbsent: 0.00
    });

    // Staff Assignment modal state
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [assigningUserId, setAssigningUserId] = useState(null);

    // Load Data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [pkgRes, empRes] = await Promise.all([
                payrollService.getPackages(),
                payrollService.getAssignments()
            ]);

            if (pkgRes.status === 'success' || pkgRes.ok) {
                setPackages(pkgRes.data || []);
            }
            if (empRes.status === 'success' || empRes.ok) {
                setEmployees(empRes.data || []);
            }
        } catch {
            toast.error('Failed to load salary package data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadRevisions = useCallback(async (packageGroupId) => {
        if (!packageGroupId) return;
        try {
            const res = await payrollService.getPackageRevisions(packageGroupId);
            if (res.status === 'success' || res.ok) {
                setRevisions(res.data || []);
            }
        } catch {
            setRevisions([]);
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
        } catch {
            // Ignore settings load errors
        }
    }, []);

    useEffect(() => {
        loadData();
        loadSettings();
    }, [loadData, loadSettings]);

    useEffect(() => {
        if (selectedPackage) {
            loadRevisions(selectedPackage.package_group_id);
        } else {
            setRevisions([]);
        }
    }, [selectedPackage, loadRevisions]);

    // Format currency
    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return `₹${num.toLocaleString('en-IN')}`;
    };

    // Filter packages
    const filteredPackages = packages.filter(p =>
        (p.package_name || p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handlers
    const handleOpenAdd = () => {
        setIsEditing(false);
        setPackageForm({
            name: '',
            grossSalary: '',
            overtimeEnabled: false,
            overtimeRate: '',
            effectiveFrom: new Date().toISOString().split('T')[0]
        });
        setIsPackageFormOpen(true);
    };

    const handleOpenEdit = (pkg) => {
        setIsEditing(true);
        setPackageForm({
            name: pkg.package_name || pkg.name || '',
            grossSalary: pkg.active_rate?.gross_salary || pkg.gross_salary || '',
            overtimeEnabled: !!(pkg.active_rate?.overtime_enabled ?? pkg.overtime_enabled),
            overtimeRate: pkg.active_rate?.overtime_rate || pkg.overtime_rate || '',
            effectiveFrom: pkg.active_rate?.effective_from ? pkg.active_rate.effective_from.split('T')[0] : new Date().toISOString().split('T')[0]
        });
        setIsDetailOpen(false);
        setIsPackageFormOpen(true);
    };

    const handleSavePackage = async (e) => {
        e.preventDefault();
        if (!packageForm.name.trim()) {
            toast.error('Package name is required');
            return;
        }

        const data = {
            name: packageForm.name,
            grossSalary: Number(packageForm.grossSalary) || 0,
            overtimeEnabled: packageForm.overtimeEnabled,
            overtimeRate: Number(packageForm.overtimeRate) || 0,
            effectiveFrom: packageForm.effectiveFrom
        };

        try {
            if (isEditing && selectedPackage) {
                const res = await payrollService.updatePackage(selectedPackage.package_group_id, data);
                if (res.status === 'success' || res.ok) {
                    toast.success('Package updated successfully');
                    setIsPackageFormOpen(false);
                    loadData();
                }
            } else {
                const res = await payrollService.createPackage(data);
                if (res.status === 'success' || res.ok) {
                    toast.success('Package created successfully');
                    setIsPackageFormOpen(false);
                    loadData();
                }
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to save package');
        }
    };

    const handleToggleActive = async (pkg) => {
        try {
            const newActive = pkg.is_active === 1 ? 0 : 1;
            const res = await payrollService.updatePackage(pkg.package_group_id, { is_active: newActive });
            if (res.status === 'success' || res.ok) {
                toast.success(`Package ${newActive ? 'activated' : 'deactivated'} successfully`);
                loadData();
                if (selectedPackage && selectedPackage.package_group_id === pkg.package_group_id) {
                    setSelectedPackage(prev => ({ ...prev, is_active: newActive }));
                }
            }
        } catch {
            toast.error('Failed to update package status');
        }
    };

    const handleDeletePackage = async () => {
        if (!selectedPackage) return;
        try {
            const res = await payrollService.deletePackage(selectedPackage.package_group_id);
            if (res.status === 'success' || res.ok) {
                toast.success('Package deleted successfully');
                setIsDeleteConfirmOpen(false);
                setIsDetailOpen(false);
                setSelectedPackage(null);
                loadData();
            }
        } catch {
            toast.error('Failed to delete package');
        }
    };

    const handleSaveRevision = async (e) => {
        e.preventDefault();
        if (!selectedPackage) return;
        try {
            const data = {
                grossSalary: Number(revisionForm.grossSalary) || 0,
                overtimeEnabled: revisionForm.overtimeEnabled,
                overtimeRate: Number(revisionForm.overtimeRate) || 0,
                effectiveFrom: revisionForm.effectiveFrom
            };
            const res = await payrollService.createPackageRevision(selectedPackage.package_group_id, data);
            if (res.status === 'success' || res.ok) {
                toast.success('Rate revision added successfully');
                setIsRevisionOpen(false);
                loadData();
                loadRevisions(selectedPackage.package_group_id);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to add revision');
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            const res = await payrollService.updatePayrollSettings({
                lopCalculationMethod: settingsForm.lopCalculationMethod,
                lopFixedDaysValue: Number(settingsForm.lopFixedDaysValue || 30),
                lopFactorPresent: Number(settingsForm.lopFactorPresent),
                lopFactorHalfDay: Number(settingsForm.lopFactorHalfDay),
                lopFactorAbsent: Number(settingsForm.lopFactorAbsent)
            });
            if (res.status === 'success' || res.ok) {
                toast.success('Payroll settings updated successfully');
                setIsSettingsOpen(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to update settings');
        }
    };

    const handleAssignEmployee = async (userId) => {
        if (!selectedPackage) return;
        setAssigningUserId(userId);
        try {
            const effectiveFrom = new Date().toISOString().split('T')[0];
            const res = await payrollService.assignPackageToEmployee(userId, selectedPackage.package_group_id, effectiveFrom);
            if (res.status === 'success' || res.ok) {
                toast.success('Employee assigned successfully');
                loadData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to assign employee');
        } finally {
            setAssigningUserId(null);
        }
    };

    const handleUnassignEmployee = async (userId) => {
        setAssigningUserId(userId);
        try {
            const res = await payrollService.unassignPackageFromEmployee(userId, {
                effective_to: new Date().toISOString().split('T')[0]
            });
            if (res.status === 'success' || res.ok) {
                toast.success('Employee unassigned successfully');
                loadData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to unassign employee');
        } finally {
            setAssigningUserId(null);
        }
    };

    return (
        <div className="w-full px-3 pt-2.5 pb-6 space-y-3">
            {/* Top Toolbar: Search + Refresh + Settings + Add */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search package..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text placeholder:text-slate-400 shadow-2xs"
                    />
                </div>
                <button
                    onClick={loadData}
                    disabled={isLoading}
                    className="p-2.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                    title="Refresh Packages"
                >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                    title="LOP Settings"
                >
                    <Settings size={14} />
                </button>
                <button
                    onClick={handleOpenAdd}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
                >
                    <Plus size={15} />
                    <span>Add</span>
                </button>
            </div>

            {/* List / Empty State */}
            {isLoading && packages.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">Loading salary packages...</div>
            ) : filteredPackages.length === 0 ? (
                <div className="py-14 text-center space-y-2 bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border p-6 shadow-2xs">
                    <Layers size={36} className="mx-auto text-indigo-400 opacity-60" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-github-dark-text">No salary packages found</p>
                    <p className="text-[11px] text-slate-400">Create salary package groups with overtime and loss of pay rules.</p>
                    <button
                        onClick={handleOpenAdd}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>Add First Package</span>
                    </button>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filteredPackages.map((pkg) => {
                        const name = pkg.package_name || pkg.name || 'Unnamed Package';
                        const gross = pkg.active_rate?.gross_salary ?? pkg.gross_salary ?? 0;
                        const hasOvertime = !!(pkg.active_rate?.overtime_enabled ?? pkg.overtime_enabled);
                        const overtimeRate = pkg.active_rate?.overtime_rate ?? pkg.overtime_rate ?? 0;
                        const rawDate = pkg.active_rate?.effective_from ?? pkg.effective_from ?? '';
                        const effectiveFrom = rawDate ? rawDate.split('T')[0] : 'N/A';
                        const assignedCount = employees.filter(e => e.package_group_id === pkg.package_group_id).length;

                        return (
                            <div
                                key={pkg.package_group_id}
                                onClick={() => {
                                    setSelectedPackage(pkg);
                                    setIsDetailOpen(true);
                                }}
                                className="w-full bg-white dark:bg-dark-card rounded-2xl p-3.5 border border-slate-200/80 dark:border-github-dark-border shadow-2xs active:scale-[0.99] transition-all cursor-pointer"
                            >
                                {/* Top Row: Title + Assigned Pill + Chevron */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                            <Layers size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-xs font-semibold text-slate-900 dark:text-github-dark-text truncate">
                                                {name}
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-normal">
                                                {pkg.is_active === 0 ? 'Inactive' : 'Active'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                            {assignedCount} Staff
                                        </span>
                                        <ChevronRight size={15} className="text-slate-400" />
                                    </div>
                                </div>

                                {/* Metrics Strip */}
                                <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-github-dark-border/60">
                                    <div>
                                        <p className="text-[10px] font-medium text-slate-400">Monthly Gross</p>
                                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                                            {formatCurrency(gross)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium text-slate-400">Overtime</p>
                                        <p className={`text-xs font-medium mt-0.5 ${hasOvertime ? 'text-amber-600 dark:text-amber-400 font-mono' : 'text-slate-400 font-normal'}`}>
                                            {hasOvertime ? `${formatCurrency(overtimeRate)}/hr` : 'Disabled'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium text-slate-400">Effective From</p>
                                        <p className="text-[11px] font-normal text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                                            {effectiveFrom}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* PACKAGE DETAILS BOTTOM SHEET */}
            {isDetailOpen && selectedPackage && createPortal(
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsDetailOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-dark-card w-full rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden"
                    >
                        {/* Drag Handle */}
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />

                        {/* Sheet Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                                    <Layers size={18} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text truncate">
                                        {selectedPackage.package_name || selectedPackage.name}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-normal">
                                        Created: {selectedPackage.created_at ? formatPlatformDate(selectedPackage.created_at) : 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    onClick={() => handleToggleActive(selectedPackage)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${selectedPackage.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    {selectedPackage.is_active ? 'Active' : 'Inactive'}
                                </button>
                                <button
                                    onClick={() => handleOpenEdit(selectedPackage)}
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title="Edit package"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => setIsDeleteConfirmOpen(true)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                                    title="Delete package"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <button
                                    onClick={() => setIsDetailOpen(false)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Sheet Content */}
                        <div className="p-4 overflow-y-auto space-y-4 no-scrollbar pb-10">
                            {/* Active Rate Breakdown Card */}
                            <div className="bg-slate-50/70 dark:bg-github-dark-subtle/30 rounded-2xl p-4 border border-slate-200/80 dark:border-github-dark-border">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                                        <Clock size={13} className="text-indigo-500" />
                                        <span>Active Rate Configuration</span>
                                    </h4>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                        Effective: {selectedPackage.active_rate?.effective_from ? formatPlatformDate(selectedPackage.active_rate.effective_from) : 'N/A'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white dark:bg-dark-card rounded-xl p-3 border border-slate-100 dark:border-github-dark-border">
                                        <p className="text-[10px] text-slate-400 font-medium">Monthly Gross</p>
                                        <p className="text-base font-semibold text-slate-900 dark:text-github-dark-text font-mono mt-1">
                                            {formatCurrency(selectedPackage.active_rate?.gross_salary ?? selectedPackage.gross_salary)}
                                        </p>
                                    </div>
                                    <div className="bg-white dark:bg-dark-card rounded-xl p-3 border border-slate-100 dark:border-github-dark-border">
                                        <p className="text-[10px] text-slate-400 font-medium">Overtime Allowance</p>
                                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 font-mono">
                                            {selectedPackage.active_rate?.overtime_enabled === 1 ? `${formatCurrency(selectedPackage.active_rate.overtime_rate)}/hr` : 'Disabled'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setRevisionForm({
                                            grossSalary: selectedPackage.active_rate?.gross_salary || 0,
                                            overtimeEnabled: !!selectedPackage.active_rate?.overtime_enabled,
                                            overtimeRate: selectedPackage.active_rate?.overtime_rate || 0,
                                            effectiveFrom: new Date().toISOString().split('T')[0]
                                        });
                                        setIsRevisionOpen(true);
                                    }}
                                    className="py-2.5 px-3 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border text-slate-800 dark:text-github-dark-text rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 shadow-2xs hover:bg-slate-50 cursor-pointer"
                                >
                                    <Plus size={14} className="text-indigo-600" />
                                    <span>Add Rate Revision</span>
                                </button>
                                <button
                                    onClick={() => setIsStaffModalOpen(true)}
                                    className="py-2.5 px-3 bg-indigo-600 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm hover:bg-indigo-700 cursor-pointer"
                                >
                                    <Users size={14} />
                                    <span>Manage Staff ({employees.filter(e => e.package_group_id === selectedPackage.package_group_id).length})</span>
                                </button>
                            </div>

                            {/* Revisions History Timeline */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text mb-2.5 flex items-center gap-1.5">
                                    <Calendar size={13} className="text-indigo-500" />
                                    <span>Revision History ({revisions.length})</span>
                                </h4>
                                {revisions.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">No revision history found.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {revisions.map((rev, idx) => (
                                            <div
                                                key={rev.package_id || idx}
                                                className="bg-white dark:bg-dark-card rounded-xl p-3 border border-slate-200/80 dark:border-github-dark-border flex items-center justify-between text-xs"
                                            >
                                                <div>
                                                    <span className="font-semibold text-slate-900 dark:text-github-dark-text font-mono">
                                                        {formatCurrency(rev.gross_salary)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 ml-2">
                                                        OT: {rev.overtime_enabled ? `${formatCurrency(rev.overtime_rate)}/hr` : 'Disabled'}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {rev.effective_from ? formatPlatformDate(rev.effective_from) : 'N/A'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ADD / EDIT PACKAGE MODAL */}
            {isPackageFormOpen && createPortal(
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsPackageFormOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-dark-card w-full rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden"
                    >
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text">
                                {isEditing ? 'Edit Salary Package' : 'Create New Salary Package'}
                            </h3>
                            <button onClick={() => setIsPackageFormOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSavePackage} className="p-4 space-y-4 overflow-y-auto no-scrollbar pb-10">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Package Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Standard Full-time 2026"
                                    value={packageForm.name}
                                    onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-800 dark:text-github-dark-text outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Gross Monthly Salary (₹) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="e.g. 35000"
                                    value={packageForm.grossSalary}
                                    onChange={(e) => setPackageForm({ ...packageForm, grossSalary: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-mono text-slate-800 dark:text-github-dark-text outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="p-3 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-800 dark:text-github-dark-text">Overtime Allowance</p>
                                        <p className="text-[10px] text-slate-400">Allow extra pay for overtime hours</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={packageForm.overtimeEnabled}
                                            onChange={(e) => setPackageForm({ ...packageForm, overtimeEnabled: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus-visible:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                {packageForm.overtimeEnabled && (
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                            Overtime Hourly Rate (₹/hr)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="e.g. 150"
                                            value={packageForm.overtimeRate}
                                            onChange={(e) => setPackageForm({ ...packageForm, overtimeRate: e.target.value })}
                                            className="w-full px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-mono outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Effective From Date
                                </label>
                                <input
                                    type="date"
                                    value={packageForm.effectiveFrom}
                                    onChange={(e) => setPackageForm({ ...packageForm, effectiveFrom: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                                >
                                    {isEditing ? 'Save Changes' : 'Create Package'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* RATE REVISION MODAL */}
            {isRevisionOpen && selectedPackage && createPortal(
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsRevisionOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-dark-card w-full rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden"
                    >
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text">
                                Add Rate Revision for {selectedPackage.package_name || selectedPackage.name}
                            </h3>
                            <button onClick={() => setIsRevisionOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveRevision} className="p-4 space-y-4 overflow-y-auto no-scrollbar pb-10">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    New Gross Salary (₹) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={revisionForm.grossSalary}
                                    onChange={(e) => setRevisionForm({ ...revisionForm, grossSalary: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="p-3 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-slate-800 dark:text-github-dark-text">Overtime Allowance</p>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={revisionForm.overtimeEnabled}
                                            onChange={(e) => setRevisionForm({ ...revisionForm, overtimeEnabled: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus-visible:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                {revisionForm.overtimeEnabled && (
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                            Overtime Hourly Rate (₹/hr)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={revisionForm.overtimeRate}
                                            onChange={(e) => setRevisionForm({ ...revisionForm, overtimeRate: e.target.value })}
                                            className="w-full px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-mono outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Effective From Date
                                </label>
                                <input
                                    type="date"
                                    value={revisionForm.effectiveFrom}
                                    onChange={(e) => setRevisionForm({ ...revisionForm, effectiveFrom: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                                >
                                    Save Revision
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* STAFF ASSIGNMENTS MODAL */}
            {isStaffModalOpen && selectedPackage && createPortal(
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsStaffModalOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-dark-card w-full rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden"
                    >
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text">
                                    Staff Assignment
                                </h3>
                                <p className="text-[10px] text-slate-400">
                                    Package: {selectedPackage.package_name || selectedPackage.name}
                                </p>
                            </div>
                            <button onClick={() => setIsStaffModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Search staff */}
                        <div className="p-3 border-b border-slate-100 dark:border-github-dark-border/60">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                <input
                                    type="text"
                                    placeholder="Search staff..."
                                    value={staffSearchQuery}
                                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="p-3 overflow-y-auto space-y-4 no-scrollbar pb-10">
                            {(() => {
                                const filtered = employees.filter(e =>
                                    (e.user_name || '').toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                                    (e.desg_name || '').toLowerCase().includes(staffSearchQuery.toLowerCase())
                                );
                                const assigned = filtered.filter(e => e.package_group_id === selectedPackage.package_group_id);
                                const available = filtered.filter(e => e.package_group_id !== selectedPackage.package_group_id);

                                return (
                                    <>
                                        {/* Assigned Staff */}
                                        <div>
                                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                                                Assigned Staff ({assigned.length})
                                            </p>
                                            {assigned.length === 0 ? (
                                                <p className="text-[11px] text-slate-400 italic">No employees assigned to this package.</p>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {assigned.map((emp) => (
                                                        <div
                                                            key={emp.user_id}
                                                            className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-xl border border-slate-100 dark:border-github-dark-border"
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div
                                                                    onClick={() => emp.profile_image_url && openAvatarPreview(emp)}
                                                                    className={`w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden transition-transform ${
                                                                        emp.profile_image_url ? 'cursor-pointer active:scale-95 ring-1 ring-indigo-500/30' : ''
                                                                    }`}
                                                                    title={emp.profile_image_url ? `View ${emp.user_name}'s photo` : emp.user_name}
                                                                >
                                                                    {emp.profile_image_url ? (
                                                                        <img src={`${emp.profile_image_url}?t=${avatarTimestamp}`} alt="" className="w-full h-full object-cover" />
                                                                    ) : emp.user_name?.charAt(0)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-slate-900 dark:text-github-dark-text truncate">{emp.user_name}</p>
                                                                    <p className="text-[10px] text-slate-400 truncate">{emp.desg_name || 'Staff'}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleUnassignEmployee(emp.user_id)}
                                                                disabled={assigningUserId === emp.user_id}
                                                                className="px-2.5 py-1 text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg text-[11px] font-medium hover:bg-rose-100 transition-colors cursor-pointer"
                                                            >
                                                                {assigningUserId === emp.user_id ? '...' : 'Unassign'}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Available Staff */}
                                        <div className="pt-2">
                                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                                Available Staff ({available.length})
                                            </p>
                                            {available.length === 0 ? (
                                                <p className="text-[11px] text-slate-400 italic">No available staff.</p>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {available.map((emp) => (
                                                        <div
                                                            key={emp.user_id}
                                                            className="flex items-center justify-between p-2.5 bg-white dark:bg-dark-card rounded-xl border border-slate-200/80 dark:border-github-dark-border"
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div
                                                                    onClick={() => emp.profile_image_url && openAvatarPreview(emp)}
                                                                    className={`w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden transition-transform ${
                                                                        emp.profile_image_url ? 'cursor-pointer active:scale-95 ring-1 ring-slate-300 dark:ring-slate-700' : ''
                                                                    }`}
                                                                    title={emp.profile_image_url ? `View ${emp.user_name}'s photo` : emp.user_name}
                                                                >
                                                                    {emp.profile_image_url ? (
                                                                        <img src={`${emp.profile_image_url}?t=${avatarTimestamp}`} alt="" className="w-full h-full object-cover" />
                                                                    ) : emp.user_name?.charAt(0)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-slate-900 dark:text-github-dark-text truncate">{emp.user_name}</p>
                                                                    <p className="text-[10px] text-slate-400 truncate">{emp.desg_name || 'Staff'}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleAssignEmployee(emp.user_id)}
                                                                disabled={assigningUserId === emp.user_id}
                                                                className="px-2.5 py-1 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-[11px] font-medium hover:bg-indigo-100 transition-colors cursor-pointer"
                                                            >
                                                                {assigningUserId === emp.user_id ? '...' : '+ Assign'}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* GLOBAL LOP SETTINGS MODAL */}
            {isSettingsOpen && createPortal(
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsSettingsOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-dark-card w-full rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden"
                    >
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text">
                                Global Payroll LOP Settings
                            </h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSettings} className="p-4 space-y-4 overflow-y-auto no-scrollbar pb-10">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Loss of Pay (LOP) Divisor Method
                                </label>
                                <select
                                    value={settingsForm.lopCalculationMethod}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, lopCalculationMethod: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs outline-none focus:border-indigo-500"
                                >
                                    <option value="Calendar Days">Actual Calendar Days in Month (28-31)</option>
                                    <option value="Fixed Days (30)">Fixed 30 Days Every Month</option>
                                    <option value="Working Days Only">Working Days Only (Excludes Weekly Offs)</option>
                                </select>
                            </div>

                            {settingsForm.lopCalculationMethod === 'Fixed Days (30)' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Fixed Days Value
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={settingsForm.lopFixedDaysValue}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, lopFixedDaysValue: Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                                    />
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                                >
                                    Save Settings
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {isDeleteConfirmOpen && selectedPackage && createPortal(
                <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-github-dark-border space-y-4">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-2.5 rounded-full bg-rose-50 dark:bg-rose-950/40">
                                <AlertCircle size={22} />
                            </div>
                            <h3 className="font-semibold text-sm text-slate-900 dark:text-github-dark-text">Delete Package?</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Are you sure you want to delete <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedPackage.package_name || selectedPackage.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={() => setIsDeleteConfirmOpen(false)}
                                className="flex-1 py-2 bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeletePackage}
                                className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-medium hover:bg-rose-700 transition-colors cursor-pointer"
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

export default SalaryPackagesMobile;
