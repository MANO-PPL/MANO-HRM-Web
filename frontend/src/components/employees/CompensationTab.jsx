import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { DollarSign, ToggleLeft, ToggleRight, Calendar, Plus, Save, Clock, History } from 'lucide-react';
import payrollService from '../../services/payrollService';

const CompensationTab = ({ employeeId }) => {
    const [loading, setLoading] = useState(true);
    const [salaryHistory, setSalaryHistory] = useState([]);
    const [activeSalary, setActiveSalary] = useState(null);
    const [showRevisionForm, setShowRevisionForm] = useState(false);

    // Form state
    const [grossMonthlySalary, setGrossMonthlySalary] = useState('');
    const [overtimeEnabled, setOvertimeEnabled] = useState(false);
    const [overtimeRate, setOvertimeRate] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (employeeId) {
            fetchCompensationData();
        }
    }, [employeeId]);

    const fetchCompensationData = async () => {
        setLoading(true);
        try {
            const historyRes = await payrollService.getEmployeeSalaryHistory(employeeId);
            const activeRes = await payrollService.getEmployeeSalary(employeeId);
            
            if (historyRes.status === 'success') {
                setSalaryHistory(historyRes.data);
            }
            if (activeRes.status === 'success') {
                setActiveSalary(activeRes.data);
            }
        } catch (err) {
            console.error('Error fetching compensation details:', err);
            toast.error('Failed to load compensation information.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRevision = async (e) => {
        e.preventDefault();
        
        if (!grossMonthlySalary || Number(grossMonthlySalary) <= 0) {
            toast.error('Please enter a valid gross monthly salary.');
            return;
        }
        if (!effectiveFrom) {
            toast.error('Please select an effective from date.');
            return;
        }

        setIsSaving(true);
        try {
            const data = {
                grossMonthlySalary: Number(grossMonthlySalary),
                overtimeEnabled,
                overtimeRate: overtimeEnabled ? Number(overtimeRate || 0) : 0,
                effectiveFrom
            };

            const res = await payrollService.updateEmployeeSalary(employeeId, data);
            if (res.status === 'success') {
                toast.success('Salary revision appended successfully.');
                setShowRevisionForm(false);
                setGrossMonthlySalary('');
                setOvertimeEnabled(false);
                setOvertimeRate('');
                setEffectiveFrom('');
                fetchCompensationData();
            }
        } catch (err) {
            console.error('Error saving salary revision:', err);
            toast.error(err.response?.data?.message || 'Failed to save salary revision.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 text-center text-slate-500 text-xs italic">
                Loading compensation data...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Active Salary Card */}
            <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-purple-950/10 p-5 rounded-2xl border border-indigo-100/80 dark:border-indigo-900/40 relative overflow-hidden shadow-sm">
                <div className="absolute right-0 bottom-0 opacity-5 dark:opacity-10 text-indigo-900 pointer-events-none translate-x-2 translate-y-2">
                    <DollarSign size={120} />
                </div>

                <h4 className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider mb-3">Active Salary Plan</h4>
                
                {activeSalary ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-800 dark:text-github-dark-text">
                                    ₹{Number(activeSalary.gross_monthly_salary).toLocaleString('en-IN')}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">/ month</span>
                            </div>
                            {activeSalary.package_name && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-150 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200/25">
                                    Package: {activeSalary.package_name}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-indigo-200/40 dark:border-indigo-900/30">
                            <div>
                                <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Overtime Rate</span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-github-dark-text mt-0.5 block">
                                    {activeSalary.overtime_enabled ? `₹${activeSalary.overtime_rate} / hr` : 'Disabled'}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Effective From</span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-github-dark-text mt-0.5 block">
                                    {new Date(activeSalary.effective_from).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 dark:text-github-dark-muted py-2 font-medium italic">
                        No active compensation configuration.
                    </div>
                )}
            </div>

            {/* Actions & Forms */}
            {!showRevisionForm ? (
                <button
                    onClick={() => {
                        // Pre-populate with active salary values for convenience
                        if (activeSalary) {
                            setGrossMonthlySalary(activeSalary.gross_monthly_salary);
                            setOvertimeEnabled(activeSalary.overtime_enabled === 1);
                            setOvertimeRate(activeSalary.overtime_rate);
                        }
                        setShowRevisionForm(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-indigo-400 hover:border-indigo-600 dark:border-indigo-700 dark:hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                    <Plus size={14} />
                    Create Salary Revision
                </button>
            ) : (
                <form onSubmit={handleSaveRevision} className="bg-slate-50/60 dark:bg-github-dark-subtle/30 p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border space-y-4 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-github-dark-border/50 pb-2 mb-2">
                        <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">New Compensation Details</h5>
                        <button 
                            type="button" 
                            onClick={() => setShowRevisionForm(false)} 
                            className="text-xs font-bold text-rose-500 hover:text-rose-600"
                        >
                            Cancel
                        </button>
                    </div>

                    <div className="space-y-3">
                        {/* Gross Salary */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Gross Monthly Salary (₹)</label>
                            <input
                                type="number"
                                value={grossMonthlySalary}
                                onChange={(e) => setGrossMonthlySalary(e.target.value)}
                                placeholder="e.g. 50000"
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-github-dark-subtle/50 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                required
                            />
                        </div>

                        {/* Overtime Enabled Toggle */}
                        <div className="flex items-center justify-between py-1 px-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Enable Overtime</span>
                            <button
                                type="button"
                                onClick={() => setOvertimeEnabled(!overtimeEnabled)}
                                className="text-indigo-600 dark:text-indigo-400 focus:outline-none"
                            >
                                {overtimeEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-slate-400" />}
                            </button>
                        </div>

                        {/* Overtime Rate */}
                        {overtimeEnabled && (
                            <div className="space-y-1 animate-in slide-in-from-top-2 duration-150">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Overtime Rate (₹ / hour)</label>
                                <input
                                    type="number"
                                    value={overtimeRate}
                                    onChange={(e) => setOvertimeRate(e.target.value)}
                                    placeholder="e.g. 200"
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-github-dark-subtle/50 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    required={overtimeEnabled}
                                />
                            </div>
                        )}

                        {/* Effective From */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Effective From Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={effectiveFrom}
                                    onChange={(e) => setEffectiveFrom(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-github-dark-subtle/50 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-75 cursor-pointer"
                    >
                        <Save size={14} />
                        {isSaving ? 'Appending...' : 'Save Salary Revision'}
                    </button>
                </form>
            )}

            {/* Salary Revision Logs */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-500">
                    <History size={16} />
                    <h5 className="text-[10px] font-black uppercase tracking-wider">Salary Revision History</h5>
                </div>

                <div className="border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden bg-white dark:bg-dark-card shadow-sm max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 dark:bg-github-dark-subtle sticky top-0">
                            <tr className="text-[9px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-200 dark:border-github-dark-border">
                                <th className="px-4 py-2">Monthly Gross</th>
                                <th className="px-4 py-2">Overtime</th>
                                <th className="px-4 py-2">Active Range</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                            {salaryHistory.length > 0 ? (
                                salaryHistory.map((history) => (
                                    <tr key={history.salary_history_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-github-dark-text">
                                            ₹{Number(history.gross_monthly_salary).toLocaleString('en-IN')}
                                            {history.package_name && (
                                                <span className="block text-[10px] text-indigo-500 font-semibold mt-0.5">
                                                    Package: {history.package_name}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {history.overtime_enabled ? `₹${history.overtime_rate}/hr` : 'No'}
                                        </td>
                                        <td className="px-4 py-3 text-[10px] font-mono text-slate-400">
                                            {history.effective_from} to {history.effective_to || 'Present'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" className="px-4 py-6 text-center text-slate-400 dark:text-github-dark-muted italic">
                                        No historical salary details recorded.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CompensationTab;
