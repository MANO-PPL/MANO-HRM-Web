import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Layers, Plus } from 'lucide-react';
import payrollService from '../../services/payrollService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import PackageDirectory from './components/PackageDirectory';
import PackageDetailsPanel from './components/PackageDetailsPanel';
import PackageStaffAssignment from './components/PackageStaffAssignment';
import PackageFormPanel from './components/PackageFormPanel';
import RevisionFormPanel from './components/RevisionFormPanel';
import AssignEmployeePanel from './components/AssignEmployeePanel';
import UnassignEmployeePanel from './components/UnassignEmployeePanel';
import PayrollSettingsPanel from './components/PayrollSettingsPanel';
import DeletePackageModal from './components/DeletePackageModal';

const SalaryPackages = ({ embedded = false }) => {
    const { avatarTimestamp } = useAuth();

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length === 3) {
            const [year, month, day] = parts;
            return `${Number(month)}/${Number(day)}/${year}`;
        }
        return new Date(dateStr).toLocaleDateString();
    };

    const formatVerboseDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length === 3) {
            const [year, month, day] = parts;
            const months = [
                'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
            ];
            const monthName = months[Number(month) - 1];
            return `${monthName} ${Number(day)}, ${year}`;
        }
        return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // ── PACKAGE STATE ─────────────────────────────────────────────────────────
    const [packages, setPackages] = useState([]);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [isLoadingPackages, setIsLoadingPackages] = useState(false);
    const [packageSearch, setPackageSearch] = useState('');
    const [revisions, setRevisions] = useState([]);
    const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);

    // Modals & Forms State
    const [showPackageForm, setShowPackageForm] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);
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

    const handleEditPackageClick = () => {
        if (!selectedPackage) return;
        setEditingPackage(selectedPackage);
        setPackageForm({
            name: selectedPackage.package_name,
            grossSalary: selectedPackage.active_rate?.gross_salary || 0,
            overtimeEnabled: !!selectedPackage.active_rate?.overtime_enabled,
            overtimeRate: selectedPackage.active_rate?.overtime_rate || 0,
            effectiveFrom: selectedPackage.active_rate?.effective_from ? selectedPackage.active_rate.effective_from.split('T')[0] : new Date().toISOString().split('T')[0]
        });
        setShowPackageForm(true);
    };

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
            if (editingPackage) {
                const res = await payrollService.updatePackageGroup(editingPackage.package_group_id, data);
                if (res.status === 'success') {
                    toast.success('Salary package updated successfully!');
                    setShowPackageForm(false);
                    setEditingPackage(null);
                    setPackageForm({
                        name: '',
                        grossSalary: '',
                        overtimeEnabled: false,
                        overtimeRate: '',
                        effectiveFrom: new Date().toISOString().split('T')[0]
                    });
                    loadPackages();
                }
            } else {
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
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to save package');
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
                loadRevisions(selectedPackage.package_group_id);
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
    ).sort((a, b) => {
        const aAssigned = selectedPackage && a.package_group_id === selectedPackage.package_group_id;
        const bAssigned = selectedPackage && b.package_group_id === selectedPackage.package_group_id;
        
        if (aAssigned && !bAssigned) return -1;
        if (!aAssigned && bAssigned) return 1;

        const aHasPkg = a.package_group_id !== null && a.package_group_id !== undefined;
        const bHasPkg = b.package_group_id !== null && b.package_group_id !== undefined;

        if (aHasPkg && !bHasPkg) return -1;
        if (!aHasPkg && bHasPkg) return 1;

        return (a.user_name || '').localeCompare(b.user_name || '');
    });

    const mainContent = (
        <>
            <div className={`flex ${embedded ? 'h-full p-0' : 'h-[calc(100vh-64px)] p-3'} gap-3 animate-in fade-in duration-300`}>
                {/* LEFT COLUMN: Package Directory */}
                <PackageDirectory
                    packages={packages}
                    filteredPackages={filteredPackages}
                    selectedPackage={selectedPackage}
                    setSelectedPackage={setSelectedPackage}
                    isLoadingPackages={isLoadingPackages}
                    packageSearch={packageSearch}
                    setPackageSearch={setPackageSearch}
                    employees={employees}
                    onOpenSettings={() => setShowSettingsModal(true)}
                    onOpenCreatePackage={() => setShowPackageForm(true)}
                />

                {/* CENTER COLUMN: Dynamic Details / Form Viewport */}
                <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                    {showSettingsModal ? (
                        <PayrollSettingsPanel
                            settingsForm={settingsForm}
                            setSettingsForm={setSettingsForm}
                            onSubmit={handleSaveSettings}
                            onClose={() => setShowSettingsModal(false)}
                            isSavingSettings={isSavingSettings}
                        />
                    ) : showPackageForm ? (
                        <PackageFormPanel
                            editingPackage={editingPackage}
                            packageForm={packageForm}
                            setPackageForm={setPackageForm}
                            onSubmit={handleCreatePackage}
                            onClose={() => { setShowPackageForm(false); setEditingPackage(null); }}
                        />
                    ) : showRevisionForm ? (
                        <RevisionFormPanel
                            selectedPackage={selectedPackage}
                            revisionForm={revisionForm}
                            setRevisionForm={setRevisionForm}
                            onSubmit={handleCreateRevision}
                            onClose={() => setShowRevisionForm(false)}
                        />
                    ) : showAssignModal ? (
                        <AssignEmployeePanel
                            selectedEmployeeForAssign={selectedEmployeeForAssign}
                            selectedPackage={selectedPackage}
                            assignForm={assignForm}
                            setAssignForm={setAssignForm}
                            onSubmit={handleAssignSubmit}
                            onClose={() => setShowAssignModal(false)}
                        />
                    ) : showUnassignModal ? (
                        <UnassignEmployeePanel
                            selectedEmployeeForUnassign={selectedEmployeeForUnassign}
                            unassignForm={unassignForm}
                            setUnassignForm={setUnassignForm}
                            onSubmit={handleUnassignSubmit}
                            onClose={() => setShowUnassignModal(false)}
                        />
                    ) : !selectedPackage ? (
                        <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-400">
                            <Layers size={48} className="opacity-20 text-indigo-500 animate-pulse" />
                            <p className="text-sm font-normal">Select a salary package to view details</p>
                            <button
                                onClick={() => setShowPackageForm(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                            >
                                <Plus size={16} /> New Package
                            </button>
                        </div>
                    ) : (
                        <PackageDetailsPanel
                            selectedPackage={selectedPackage}
                            revisions={revisions}
                            isLoadingRevisions={isLoadingRevisions}
                            formatDate={formatDate}
                            formatVerboseDate={formatVerboseDate}
                            onEditPackage={handleEditPackageClick}
                            onToggleActive={handleToggleActive}
                            onDeletePackage={handleDeleteClick}
                            onOpenRevisionForm={() => setShowRevisionForm(true)}
                        />
                    )}
                </div>

                {/* RIGHT COLUMN: Employee Assignment */}
                <PackageStaffAssignment
                    selectedPackage={selectedPackage}
                    employees={employees}
                    filteredEmployees={filteredEmployees}
                    isLoadingEmployees={isLoadingEmployees}
                    employeeSearch={employeeSearch}
                    setEmployeeSearch={setEmployeeSearch}
                    packages={packages}
                    avatarTimestamp={avatarTimestamp}
                    onAssignClick={handleAssignClick}
                    onUnassignClick={handleUnassignClick}
                />
            </div>

            {/* --- DELETE CONFIRMATION MODAL --- */}
            <DeletePackageModal
                isOpen={isDeleteModalOpen}
                packageToDelete={packageToDelete}
                onClose={() => { setIsDeleteModalOpen(false); setPackageToDelete(null); }}
                onConfirm={confirmDeletePackage}
            />
        </>
    );

    if (embedded) return mainContent;

    return (
        <DashboardLayout title="Salary Packages Management" noPadding={true}>
            {mainContent}
        </DashboardLayout>
    );
};

export default SalaryPackages;
