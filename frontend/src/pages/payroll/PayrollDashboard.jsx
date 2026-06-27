import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
    Calendar, DollarSign, Clock, CheckCircle, CreditCard, Lock, Unlock,
    ArrowRight, Download, Search, AlertCircle, Eye, X, HelpCircle,
    Sliders, Plus, Trash2
} from 'lucide-react';
import { toast } from 'react-toastify';
import payrollService from '../../services/payrollService';

const PayrollDashboard = () => {
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    
    const [loading, setLoading] = useState(true);
    const [isFinalized, setIsFinalized] = useState(false);
    const [payrollRun, setPayrollRun] = useState(null);
    const [payrollData, setPayrollData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFinalizing, setIsFinalizing] = useState(false);

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isRunningPeriod = month >= currentMonthStr;
    
    // Details drawer state
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailData, setDetailData] = useState(null);

    // Adjustments modal state
    const [isAdjustmentsModalOpen, setIsAdjustmentsModalOpen] = useState(false);
    const [adjustmentsEmployee, setAdjustmentsEmployee] = useState(null);
    const [adjustmentsList, setAdjustmentsList] = useState([]);
    const [newAdjustment, setNewAdjustment] = useState({ type: 'addition', label: '', amount: '', reason: '' });
    const [savingAdjustments, setSavingAdjustments] = useState(false);

    const handleOpenAdjustments = (record) => {
        setAdjustmentsEmployee(record);
        const adjs = record.adjustments_json 
            ? (typeof record.adjustments_json === 'string' ? JSON.parse(record.adjustments_json) : record.adjustments_json) 
            : [];
        setAdjustmentsList(adjs);
        setNewAdjustment({ type: 'addition', label: '', amount: '', reason: '' });
        setIsAdjustmentsModalOpen(true);
    };

    const handleAddAdjustment = async (e) => {
        e.preventDefault();
        if (!newAdjustment.label.trim() || !newAdjustment.amount || !newAdjustment.reason.trim()) {
            toast.error('Please fill in all fields.');
            return;
        }
        const amount = parseFloat(newAdjustment.amount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Amount must be a positive number.');
            return;
        }

        const updatedList = [
            ...adjustmentsList,
            {
                type: newAdjustment.type,
                label: newAdjustment.label.trim(),
                amount: amount,
                reason: newAdjustment.reason.trim()
            }
        ];

        setSavingAdjustments(true);
        try {
            const res = await payrollService.updateAdjustments(adjustmentsEmployee.entry_id, updatedList);
            if (res.status === 'success') {
                toast.success('Adjustment added successfully.');
                setAdjustmentsList(res.data.adjustments || []);
                setNewAdjustment({ type: 'addition', label: '', amount: '', reason: '' });
                setAdjustmentsEmployee({
                    ...adjustmentsEmployee,
                    adjustments_json: res.data.adjustments,
                    net_salary: res.data.net_salary
                });
                fetchDashboardData();
            }
        } catch (err) {
            console.error('Error adding adjustment:', err);
            toast.error(err.response?.data?.message || 'Failed to add adjustment.');
        } finally {
            setSavingAdjustments(false);
        }
    };

    const handleDeleteAdjustment = async (id) => {
        if (!window.confirm('Are you sure you want to remove this adjustment?')) {
            return;
        }

        const updatedList = adjustmentsList.filter(a => a.id !== id);

        setSavingAdjustments(true);
        try {
            const res = await payrollService.updateAdjustments(adjustmentsEmployee.entry_id, updatedList);
            if (res.status === 'success') {
                toast.success('Adjustment removed successfully.');
                setAdjustmentsList(res.data.adjustments || []);
                setAdjustmentsEmployee({
                    ...adjustmentsEmployee,
                    adjustments_json: res.data.adjustments,
                    net_salary: res.data.net_salary
                });
                fetchDashboardData();
            }
        } catch (err) {
            console.error('Error removing adjustment:', err);
            toast.error(err.response?.data?.message || 'Failed to remove adjustment.');
        } finally {
            setSavingAdjustments(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [month]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const res = await payrollService.getPayrollDashboard(month);
            if (res.status === 'success') {
                setIsFinalized(res.isFinalized);
                setPayrollRun(res.run);
                setPayrollData(res.data);
            }
        } catch (err) {
            console.error('Error fetching payroll dashboard:', err);
            toast.error('Failed to load payroll dashboard.');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!window.confirm(`Are you sure you want to finalize payroll for ${month}? This will lock the records and freeze attendance and salary snapshot data.`)) {
            return;
        }

        setIsFinalizing(true);
        try {
            const res = await payrollService.finalizePayroll(month);
            if (res.status === 'success') {
                toast.success('Payroll finalized successfully.');
                fetchDashboardData();
            }
        } catch (err) {
            console.error('Error finalizing payroll:', err);
            toast.error(err.response?.data?.message || 'Failed to finalize payroll.');
        } finally {
            setIsFinalizing(false);
        }
    };

    const handleMarkAsPaid = async (runId) => {
        if (!window.confirm('Mark this payroll run as paid? This records payment confirmation and locks the run forever.')) {
            return;
        }

        try {
            const res = await payrollService.markRunAsPaid(runId);
            if (res.status === 'success') {
                toast.success('Payroll run marked as Paid.');
                fetchDashboardData();
            }
        } catch (err) {
            console.error('Error marking as paid:', err);
            toast.error(err.response?.data?.message || 'Failed to record payment.');
        }
    };

    const handleFinalizeEmployee = async (employee) => {
        if (!window.confirm(`Lock/Finalize payroll for ${employee.user_name} for ${month}? This will freeze their attendance and salary snapshot data.`)) {
            return;
        }
        try {
            const res = await payrollService.finalizeEmployee(employee.employee_id, month);
            if (res.status === 'success') {
                toast.success(`Payroll locked for ${employee.user_name}.`);
                fetchDashboardData();
            }
        } catch (err) {
            console.error('Error locking employee payroll:', err);
            toast.error(err.response?.data?.message || 'Failed to lock employee payroll.');
        }
    };

    const handlePayEmployee = async (employee) => {
        if (!window.confirm(`Mark payroll as Paid for ${employee.user_name}?`)) {
            return;
        }
        try {
            const res = await payrollService.payEmployee(employee.employee_id, month);
            if (res.status === 'success') {
                toast.success(`Payroll paid for ${employee.user_name}.`);
                fetchDashboardData();
            }
        } catch (err) {
            console.error('Error paying employee payroll:', err);
            toast.error(err.response?.data?.message || 'Failed to pay employee payroll.');
        }
    };



    const handleViewDetails = async (employee) => {
        setSelectedEmployee(employee);
        setDetailLoading(true);
        setDetailData(null);
        try {
            const employeeId = employee.employee_id;
            const res = await payrollService.getEmployeeProjectedDetails(employeeId, month);
            if (res.status === 'success') {
                setDetailData(res.data);
            }
        } catch (err) {
            console.error('Error fetching employee payroll details:', err);
            toast.error('Failed to load detail breakdown.');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleDownloadPayslip = async (entryId, employeeName) => {
        try {
            const months = [
                'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
            ];
            const [y, mStr] = month.split('-');
            const mName = months[parseInt(mStr, 10) - 1];

            toast.info('Generating payslip PDF...');
            await payrollService.downloadPayslip(entryId, employeeName, mName, y);
            toast.success('Payslip downloaded.');
        } catch (err) {
            console.error('Error downloading payslip:', err);
            toast.error('Failed to download payslip.');
        }
    };

    // Filter table records
    const filteredRecords = payrollData.filter(rec => 
        (rec.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sum aggregates for summary widgets
    const totalGross = payrollData.reduce((sum, r) => sum + Number(r.gross_salary || 0), 0);
    const totalLOP = payrollData.reduce((sum, r) => sum + Number(r.lop_deduction || 0), 0);
    const totalOT = payrollData.reduce((sum, r) => sum + Number(r.overtime_amount || 0), 0);
    const totalNet = payrollData.reduce((sum, r) => sum + Number(r.net_salary || 0), 0);

    return (
        <DashboardLayout title="Payroll Dashboard">
            <div className="space-y-6">
                {/* Month Picker & Finalize Bar */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-github-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm transition-colors duration-300">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <Calendar size={22} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Payroll Period</label>
                            <input 
                                type="month" 
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-github-dark-text outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Status Actions */}
                    <div className="flex items-center gap-3">
                        {!isFinalized ? (
                            <div className="flex items-center gap-3">
                                {isRunningPeriod ? (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 rounded-lg">
                                        <Clock size={14} className="animate-pulse" />
                                        Running Month (Projected)
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 rounded-lg">
                                        <Clock size={14} className="animate-pulse" />
                                        Live Projection
                                    </span>
                                )}
                                <button
                                    onClick={handleFinalize}
                                    disabled={isFinalizing || payrollData.length === 0}
                                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-indigo-100 dark:shadow-none active:scale-[0.98] cursor-pointer"
                                >
                                    <Lock size={14} />
                                    {isFinalizing ? 'Finalizing...' : 'Finalize Payroll'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                {payrollRun.status === 'Finalized' ? (
                                    <>
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                                            <Lock size={14} />
                                            Frozen & Finalized
                                        </span>
                                        <button
                                            onClick={() => handleMarkAsPaid(payrollRun.run_id)}
                                            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100 dark:shadow-none active:scale-[0.98] cursor-pointer"
                                        >
                                            <CreditCard size={14} />
                                            Mark as Paid
                                        </button>
                                    </>
                                ) : (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 rounded-lg">
                                        <CheckCircle size={14} />
                                        Paid & Locked
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isRunningPeriod && !isFinalized && (
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-100/50 dark:border-indigo-900/40 p-4 rounded-2xl flex items-start gap-3 text-xs text-indigo-700 dark:text-indigo-300">
                        <HelpCircle size={16} className="shrink-0 mt-0.5 text-indigo-500" />
                        <div>
                            <p className="font-bold uppercase tracking-wider text-[10px] mb-0.5">Running Month Active Projection</p>
                            <p className="font-medium opacity-90">This payroll period is currently active. Today and future days are projected as worked with no LOP deductions. LOP deductions are calculated dynamically from past absences up to yesterday.</p>
                        </div>
                    </div>
                )}

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Gross */}
                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between transition-colors duration-300">
                        <div>
                            <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Total Gross Salary</span>
                            <span className="text-xl font-black text-slate-800 dark:text-github-dark-text">
                                ₹{totalGross.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="p-3 bg-slate-100 dark:bg-github-dark-subtle text-slate-500 rounded-xl">
                            <DollarSign size={20} />
                        </div>
                    </div>

                    {/* LOP */}
                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between transition-colors duration-300">
                        <div>
                            <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">LOP Deductions</span>
                            <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                                ₹{totalLOP.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                            {isRunningPeriod && !isFinalized && (
                                <span className="text-[8px] font-bold text-slate-400 block mt-1">(Accumulated to date)</span>
                            )}
                        </div>
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-xl">
                            <AlertCircle size={20} />
                        </div>
                    </div>

                    {/* OT */}
                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between transition-colors duration-300">
                        <div>
                            <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Overtime Allowance</span>
                            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                ₹{totalOT.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-xl">
                            <Clock size={20} />
                        </div>
                    </div>

                    {/* Net */}
                    <div className="bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white p-5 rounded-2xl border border-transparent shadow-md flex items-center justify-between">
                        <div>
                            <span className="block text-[10px] font-bold uppercase text-indigo-200 tracking-wider mb-1">Net Payable Salary</span>
                            <span className="text-xl font-black">
                                ₹{totalNet.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                            {isRunningPeriod && !isFinalized && (
                                <span className="text-[8px] font-bold text-indigo-200/80 block mt-1">(Projected for full month)</span>
                            )}
                        </div>
                        <div className="p-3 bg-white/10 text-white rounded-xl">
                            <DollarSign size={20} />
                        </div>
                    </div>
                </div>

                {/* Table List Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden transition-colors duration-300">
                    {/* Search and Filters */}
                    <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-github-dark-subtle/25">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-700 dark:text-github-dark-text outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div className="text-xs text-slate-400 dark:text-github-dark-muted font-medium">
                            Showing {filteredRecords.length} records
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border bg-slate-50/70 dark:bg-github-dark-subtle/70">
                                    <th className="px-6 py-3.5">Employee</th>
                                    <th className="px-6 py-3.5 text-center">Gross Salary</th>
                                    <th className="px-6 py-3.5 text-center">LOP Deduction</th>
                                    <th className="px-6 py-3.5 text-center">Overtime Amount</th>
                                    <th className="px-6 py-3.5 text-center font-bold text-slate-800 dark:text-github-dark-text">Net salary</th>
                                    <th className="px-6 py-3.5 text-center">Details</th>
                                    <th className="px-6 py-3.5 text-center">Status & Actions</th>
                                    <th className="px-6 py-3.5 text-center">Payslip</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400 dark:text-github-dark-muted italic">
                                            Loading payroll records...
                                        </td>
                                    </tr>
                                ) : filteredRecords.length > 0 ? (
                                    filteredRecords.map((record) => (
                                        <tr key={record.employee_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/10 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center border border-indigo-100/50 dark:border-indigo-900/30">
                                                        {record.user_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800 dark:text-github-dark-text">{record.user_name}</p>
                                                        <p className="text-xs text-slate-400 dark:text-github-dark-muted opacity-80">{record.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                ₹{Number(record.gross_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-center text-rose-600 dark:text-rose-400">
                                                {Number(record.lop_deduction) > 0 ? `-₹${Number(record.lop_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                                            </td>
                                            <td className="px-6 py-4 text-center text-emerald-600 dark:text-emerald-400">
                                                {Number(record.overtime_amount) > 0 ? `+₹${Number(record.overtime_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-800 dark:text-github-dark-text">
                                                ₹{Number(record.net_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button
                                                        onClick={() => handleViewDetails(record)}
                                                        className="inline-flex items-center justify-center p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors cursor-pointer"
                                                        title="Breakdown details"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenAdjustments(record)}
                                                        className="inline-flex items-center justify-center p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors cursor-pointer relative"
                                                        title="Manual adjustments & audit"
                                                    >
                                                        <Sliders size={18} />
                                                        {record.adjustments_json && (() => {
                                                            const adjs = typeof record.adjustments_json === 'string' ? JSON.parse(record.adjustments_json) : record.adjustments_json;
                                                            if (adjs && adjs.length > 0) {
                                                                return (
                                                                    <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[7px] font-black bg-amber-500 text-white rounded-full leading-none">
                                                                        {adjs.length}
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {(record.status === 'Draft' || !record.status) && (
                                                        <>
                                                            <span className="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">Live</span>
                                                            <button
                                                                onClick={() => handleFinalizeEmployee(record)}
                                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors cursor-pointer"
                                                                title="Lock & Freeze"
                                                            >
                                                                <Lock size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {record.status === 'Finalized' && (
                                                        <>
                                                            <span className="px-2 py-1 text-[10px] font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">Locked</span>
                                                            <button
                                                                onClick={() => handlePayEmployee(record)}
                                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors cursor-pointer"
                                                                title="Mark as Paid"
                                                            >
                                                                <CreditCard size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {record.status === 'Paid' && (
                                                        <span className="px-2 py-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded">Paid</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {record.entry_id ? (
                                                    <button
                                                        onClick={() => handleDownloadPayslip(record.entry_id, record.user_name)}
                                                        className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                        title="Download Payslip PDF"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">Not Frozen</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400 dark:text-github-dark-muted italic">
                                            No payroll records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Details Breakdown Drawer */}
                {selectedEmployee && (
                    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-[2px] flex justify-end">
                        {/* Drawer Backdrop Close */}
                        <div className="absolute inset-0" onClick={() => setSelectedEmployee(null)}></div>

                        <div className="relative w-full max-w-[500px] h-full bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-250 z-10">
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-github-dark-text">Calculation Breakdown</h4>
                                    <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-0.5">{selectedEmployee.user_name}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedEmployee(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                                {detailLoading ? (
                                    <div className="text-center text-slate-500 text-xs italic py-12">
                                        Loading breakdown metrics...
                                    </div>
                                ) : detailData ? (
                                    <div className="space-y-6">
                                        {detailData.is_running_month && (
                                            <div className="bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-100 dark:border-indigo-900/40 p-3 rounded-xl text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
                                                Active Running Month Projection: Future days and today are assumed worked without LOP. LOP deduction is computed up to yesterday.
                                            </div>
                                        )}
                                        {/* Attendance Summary */}
                                        <div className="bg-slate-50/70 dark:bg-github-dark-subtle/30 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 space-y-3">
                                            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Attendance Summary</h5>
                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                <div className="bg-white dark:bg-dark-card py-2 border border-slate-100 dark:border-github-dark-border/50 rounded-xl">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Present</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{detailData.present_days}</span>
                                                </div>
                                                <div className="bg-white dark:bg-dark-card py-2 border border-slate-100 dark:border-github-dark-border/50 rounded-xl">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Half Days</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{detailData.half_days}</span>
                                                </div>
                                                <div className="bg-white dark:bg-dark-card py-2 border border-slate-100 dark:border-github-dark-border/50 rounded-xl">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Absent</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{detailData.absent_days}</span>
                                                </div>
                                                <div className="bg-white dark:bg-dark-card py-2 border border-slate-100 dark:border-github-dark-border/50 rounded-xl">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Paid Leave</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{detailData.paid_leave_days}</span>
                                                </div>
                                                <div className="bg-white dark:bg-dark-card py-2 border border-slate-100 dark:border-github-dark-border/50 rounded-xl">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Holidays</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{detailData.holiday_days}</span>
                                                </div>
                                                <div className="bg-white dark:bg-dark-card py-2 border border-slate-100 dark:border-github-dark-border/50 rounded-xl">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Week Offs</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{detailData.weekly_off_days}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* LOP Calculation details */}
                                        <div className="bg-slate-50/70 dark:bg-github-dark-subtle/30 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 space-y-3">
                                            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">LOP Deduction details</h5>
                                            
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-medium">Gross Monthly Salary:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text">₹{Number(detailData.gross_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-medium">Calendar Days in Month:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text">{detailData.calculation_snapshot?.calendar_days || detailData.calculation_snapshot_json?.calendar_days} days</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-medium">Daily Rate:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text">₹{(detailData.calculation_snapshot?.daily_rate || detailData.calculation_snapshot_json?.daily_rate || 0).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between border-t border-slate-200/50 dark:border-github-dark-border/50 pt-2 font-bold">
                                                    <span className="text-slate-700 dark:text-github-dark-text">Total LOP Days:</span>
                                                    <span className="text-slate-800 dark:text-github-dark-text">{detailData.lop_days} days</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400">
                                                    <span>LOP Deduction Amount:</span>
                                                    <span>₹{Number(detailData.lop_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Overtime Details */}
                                        <div className="bg-slate-50/70 dark:bg-github-dark-subtle/30 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 space-y-3">
                                            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Overtime Calculations</h5>
                                            
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-medium">Overtime Enabled:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text">
                                                        {(detailData.calculation_snapshot?.overtime_enabled || detailData.calculation_snapshot_json?.overtime_enabled) ? 'Yes' : 'No'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-medium">Overtime Rate:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text">₹{detailData.salary_snapshot?.overtime_rate || detailData.salary_snapshot_json?.overtime_rate || 0.00} / hr</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-medium">Total Overtime Hours:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text">{detailData.overtime_hours} hrs</span>
                                                </div>
                                                <div className="flex justify-between border-t border-slate-200/50 dark:border-github-dark-border/50 pt-2 font-bold text-emerald-600 dark:text-emerald-400">
                                                    <span>Overtime Allowance Amount:</span>
                                                    <span>₹{Number(detailData.overtime_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Manual Adjustments List inside Details Drawer */}
                                        {(() => {
                                            const adjs = detailData.adjustments_json 
                                                ? (typeof detailData.adjustments_json === 'string' ? JSON.parse(detailData.adjustments_json) : detailData.adjustments_json) 
                                                : [];
                                            if (adjs.length === 0) return null;
                                            return (
                                                <div className="bg-slate-50/70 dark:bg-github-dark-subtle/30 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 space-y-3">
                                                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Manual Adjustments</h5>
                                                    <div className="space-y-3">
                                                        {adjs.map(a => (
                                                            <div key={a.id} className="text-xs space-y-0.5 border-l-2 border-amber-400 pl-3">
                                                                <div className="flex justify-between font-semibold">
                                                                    <span className="text-slate-700 dark:text-github-dark-text">{a.label}</span>
                                                                    <span className={a.type === 'addition' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                                                        {a.type === 'addition' ? '+' : '-'}₹{Number(a.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                                <p className="text-slate-500 dark:text-slate-400 italic font-medium">"{a.reason}"</p>
                                                                <div className="text-[9px] text-slate-400 dark:text-github-dark-muted font-bold">Added by {a.added_by}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Final Calculation summary */}
                                        <div className="bg-indigo-600 text-white p-5 rounded-2xl space-y-2">
                                            <div className="flex justify-between text-xs font-semibold text-indigo-200">
                                                <span>Gross Salary</span>
                                                <span>₹{Number(detailData.gross_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-semibold text-rose-300">
                                                <span>Deduction (LOP)</span>
                                                <span>-₹{Number(detailData.lop_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-semibold text-emerald-300">
                                                <span>Allowance (OT)</span>
                                                <span>+₹{Number(detailData.overtime_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>

                                            {/* Dynamic rendering of adjustments inside the details card */}
                                            {(() => {
                                                const adjs = detailData.adjustments_json 
                                                    ? (typeof detailData.adjustments_json === 'string' ? JSON.parse(detailData.adjustments_json) : detailData.adjustments_json) 
                                                    : [];
                                                const additions = adjs.filter(a => a.type === 'addition');
                                                const deductions = adjs.filter(a => a.type === 'deduction');
                                                
                                                return (
                                                    <>
                                                        {additions.map(a => (
                                                            <div key={a.id} className="flex justify-between text-xs font-semibold text-emerald-300">
                                                                <span>{a.label}</span>
                                                                <span>+₹{Number(a.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        ))}
                                                        {deductions.map(d => (
                                                            <div key={d.id} className="flex justify-between text-xs font-semibold text-rose-300">
                                                                <span>{d.label}</span>
                                                                <span>-₹{Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        ))}
                                                    </>
                                                );
                                            })()}

                                            <div className="flex justify-between font-black text-base border-t border-indigo-500 pt-2 mt-2">
                                                <span>Net Payable Salary</span>
                                                <span>₹{Number(detailData.net_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-500 text-xs italic py-12">
                                        Failed to load details.
                                    </div>
                                )}
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-5 border-t border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20">
                                <button
                                    onClick={() => setSelectedEmployee(null)}
                                    className="w-full px-4 py-2.5 text-xs font-bold uppercase tracking-widest bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-github-dark-muted rounded-xl transition-all cursor-pointer"
                                >
                                    Dismiss details
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Manual Adjustments Modal */}
                {isAdjustmentsModalOpen && adjustmentsEmployee && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-github-dark-text">Manual Adjustments & Audit</h4>
                                    <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-0.5">Edit additions/deductions for {adjustmentsEmployee.user_name}</p>
                                </div>
                                <button
                                    onClick={() => setIsAdjustmentsModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                                {/* Form: Add Adjustment (Only if Draft) */}
                                {(adjustmentsEmployee.status === 'Draft' || !adjustmentsEmployee.status) ? (
                                    <form onSubmit={handleAddAdjustment} className="bg-slate-50/70 dark:bg-github-dark-subtle/30 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 space-y-4">
                                        <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Add Addition / Deduction</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Adjustment Type</label>
                                                <select
                                                    value={newAdjustment.type}
                                                    onChange={(e) => setNewAdjustment({ ...newAdjustment, type: e.target.value })}
                                                    className="w-full bg-white dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-github-dark-text outline-none focus:ring-2 focus:ring-indigo-500/25"
                                                >
                                                    <option value="addition">Addition (+)</option>
                                                    <option value="deduction">Deduction (-)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Label</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Bonus, Tax, Advance"
                                                    value={newAdjustment.label}
                                                    onChange={(e) => setNewAdjustment({ ...newAdjustment, label: e.target.value })}
                                                    className="w-full bg-white dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-github-dark-text outline-none focus:ring-2 focus:ring-indigo-500/25"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Amount (₹)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Amount"
                                                    value={newAdjustment.amount}
                                                    onChange={(e) => setNewAdjustment({ ...newAdjustment, amount: e.target.value })}
                                                    className="w-full bg-white dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-github-dark-text outline-none focus:ring-2 focus:ring-indigo-500/25"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Audit Reason / Description</label>
                                            <textarea
                                                rows="2"
                                                placeholder="Please explain the reason for this manual salary adjustment..."
                                                value={newAdjustment.reason}
                                                onChange={(e) => setNewAdjustment({ ...newAdjustment, reason: e.target.value })}
                                                className="w-full bg-white dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-github-dark-text outline-none resize-none focus:ring-2 focus:ring-indigo-500/25"
                                                required
                                            ></textarea>
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                type="submit"
                                                disabled={savingAdjustments}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                                            >
                                                <Plus size={12} />
                                                {savingAdjustments ? 'Saving...' : 'Add Adjustment'}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-2xl text-xs text-blue-700 dark:text-blue-300 font-medium">
                                        🔒 This employee's payroll status is <strong>{adjustmentsEmployee.status}</strong>. Manual adjustments are frozen and cannot be modified.
                                    </div>
                                )}

                                {/* Adjustments List & Audit Logs */}
                                <div className="space-y-3">
                                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Adjustment Audit Log</h5>
                                    {adjustmentsList.length > 0 ? (
                                        <div className="border border-slate-100 dark:border-github-dark-border rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                                            {adjustmentsList.map((adj) => (
                                                <div key={adj.id} className="p-4 flex items-start justify-between gap-4 bg-white dark:bg-dark-card hover:bg-slate-50/30 transition-colors">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded ${
                                                                adj.type === 'addition' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                                                            }`}>
                                                                {adj.type === 'addition' ? 'Addition (+)' : 'Deduction (-)'}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-800 dark:text-github-dark-text">{adj.label}</span>
                                                            <span className={`text-xs font-black ${adj.type === 'addition' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {adj.type === 'addition' ? '+' : '-'}₹{Number(adj.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium italic">"{adj.reason}"</p>
                                                        <div className="text-[9px] text-slate-400 font-bold">
                                                            Added by {adj.added_by} on {new Date(adj.added_at).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Delete Action (Only if Draft) */}
                                                    {(adjustmentsEmployee.status === 'Draft' || !adjustmentsEmployee.status) && (
                                                        <button
                                                            onClick={() => handleDeleteAdjustment(adj.id)}
                                                            disabled={savingAdjustments}
                                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-colors cursor-pointer"
                                                            title="Delete Adjustment"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-slate-400 italic text-xs py-8">
                                            No manual adjustments recorded.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-5 border-t border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 flex items-center justify-between">
                                <div className="text-xs font-bold text-slate-500">
                                    Total Adjustments:{' '}
                                    <span className="text-slate-700 dark:text-github-dark-text font-black">
                                        ₹{(
                                            adjustmentsList.filter(a => a.type === 'addition').reduce((sum, a) => sum + a.amount, 0) -
                                            adjustmentsList.filter(a => a.type === 'deduction').reduce((sum, a) => sum + a.amount, 0)
                                        ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setIsAdjustmentsModalOpen(false)}
                                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-all cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default PayrollDashboard;
