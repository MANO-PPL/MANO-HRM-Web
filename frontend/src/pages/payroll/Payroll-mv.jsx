import React, { useState, useMemo } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { 
    CreditCard, 
    Calendar, 
    Search, 
    Download, 
    Settings, 
    Printer, 
    DollarSign, 
    Users, 
    CheckCircle, 
    AlertCircle,
    User,
    ChevronDown,
    FileText
} from 'lucide-react';
import { toast } from 'react-toastify';

const INITIAL_EMPLOYEES = [
    { id: 1, name: 'Aarav Sharma', designation: 'Senior Engineer', department: 'Engineering', basic: 75000, allowance: 12000, pf: 0, lates: 2 },
    { id: 2, name: 'Ananya Iyer', designation: 'Product Manager', department: 'Product', basic: 85000, allowance: 15000, pf: 0, lates: 0 },
    { id: 3, name: 'Kabir Verma', designation: 'UX Designer', department: 'Design', basic: 55000, allowance: 8000, pf: 0, lates: 4 },
    { id: 4, name: 'Diya Patel', designation: 'QA Lead', department: 'Engineering', basic: 60000, allowance: 9500, pf: 0, lates: 1 },
    { id: 5, name: 'Rohan Gupta', designation: 'HR Specialist', department: 'HR', basic: 45000, allowance: 7000, pf: 0, lates: 0 }
];

const PayrollMobile = () => {
    const getMonthsList = () => {
        const months = [];
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const now = new Date();
        for (let i = 3; i >= -8; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            months.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
        }
        return months;
    };
    const allMonths = useMemo(() => getMonthsList(), []);

    const initialMonth = () => {
        const now = new Date();
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    };

    const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
    const [activeTab, setActiveTab] = useState('run');
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessingAll, setIsProcessingAll] = useState(false);
    const [processedMonths, setProcessedMonths] = useState(['May 2026', 'April 2026']);
    const [payrollStatus, setPayrollStatus] = useState('Draft');

    // Drawer states
    const [selectedPayslipEmp, setSelectedPayslipEmp] = useState(null);
    const [editingEmp, setEditingEmp] = useState(null);
    const [editForm, setEditForm] = useState({ basic: 0, allowance: 0, pf: 0 });

    // Search filter
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => 
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.designation.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [employees, searchTerm]);

    // Financial calculations
    const totals = useMemo(() => {
        let gross = 0;
        let deductions = 0;
        let net = 0;

        employees.forEach(emp => {
            const lateDeduction = emp.lates * 500;
            const empGross = emp.basic + emp.allowance;
            const empDeductions = lateDeduction;
            gross += empGross;
            deductions += empDeductions;
            net += (empGross - empDeductions);
        });

        return { gross, deductions, net };
    }, [employees]);

    const handleStartProcessing = () => {
        setIsProcessingAll(true);
        toast.info("Connecting to Razorpay gateway payouts...");
        setTimeout(() => {
            setIsProcessingAll(false);
            setPayrollStatus('Released');
            toast.success(`Payroll processed successfully for ${selectedMonth}!`);
            if (!processedMonths.includes(selectedMonth)) {
                setProcessedMonths([selectedMonth, ...processedMonths]);
            }
        }, 2000);
    };

    const handleSaveSalary = (id) => {
        setEmployees(prev => prev.map(emp => {
            if (emp.id === id) {
                return {
                    ...emp,
                    basic: Number(editForm.basic),
                    allowance: Number(editForm.allowance),
                    pf: Number(editForm.pf)
                };
            }
            return emp;
        }));
        setEditingEmp(null);
        toast.success("Salary config updated successfully.");
    };

    return (
        <MobileDashboardLayout title="Payroll Management">
            <div className="px-4 pt-4 space-y-4 pb-24">
                
                {/* Visual Stats Cards for Mobile */}
                <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="bg-white dark:bg-github-dark-subtle border border-slate-205 dark:border-github-dark-border p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
                        <span className="text-[8px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider block">Gross Payroll</span>
                        <h4 className="text-base font-black text-slate-800 dark:text-github-dark-text mt-1">₹{totals.gross.toLocaleString()}</h4>
                        <span className="text-[8px] text-slate-455 font-semibold mt-1">Basic + Allowances</span>
                    </div>

                    <div className="bg-white dark:bg-github-dark-subtle border border-slate-205 dark:border-github-dark-border p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
                        <span className="text-[8px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider block">Net Payout</span>
                        <h4 className="text-base font-black text-indigo-650 dark:text-indigo-400 mt-1">₹{totals.net.toLocaleString()}</h4>
                        <span className="text-[8px] text-slate-455 font-semibold mt-1">After Deductions</span>
                    </div>
                </div>

                {/* Sub Tabs Segmented Control */}
                <div className="bg-[#f6f8fa] dark:bg-github-dark-subtle p-1 flex rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm">
                    {[
                        { id: 'run', label: 'Run', icon: CreditCard },
                        { id: 'structure', label: 'Salary structure', icon: Settings },
                        { id: 'payslips', label: 'Payslips', icon: FileText }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                activeTab === tab.id
                                    ? 'bg-white dark:bg-[#21262d] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-github-dark-border'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-100 dark:hover:bg-[#21262d]/50'
                            }`}
                        >
                            <tab.icon size={11} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Period Picker & Action Row */}
                <div className="flex gap-3 justify-between items-center bg-white dark:bg-github-dark-subtle p-3 rounded-2xl border border-slate-200 dark:border-github-dark-border">
                    <select
                        value={selectedMonth}
                        onChange={(e) => {
                            setSelectedMonth(e.target.value);
                            setPayrollStatus(processedMonths.includes(e.target.value) ? 'Released' : 'Draft');
                        }}
                        className="px-2.5 py-1.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-github-dark-border rounded-xl text-[11px] font-black text-slate-700 dark:text-github-dark-text shadow-sm outline-none cursor-pointer"
                    >
                        {allMonths.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>

                    {activeTab === 'run' && (
                        <button
                            onClick={handleStartProcessing}
                            disabled={isProcessingAll || payrollStatus === 'Released'}
                            className="px-4 py-2 bg-indigo-600 disabled:bg-slate-350 disabled:dark:bg-slate-800 text-white font-bold text-[10px] uppercase rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1"
                        >
                            {isProcessingAll ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <CreditCard size={12} />
                            )}
                            <span>{payrollStatus === 'Released' ? 'Paid' : 'Disburse'}</span>
                        </button>
                    )}
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search employee name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl text-xs"
                    />
                </div>

                {/* Operations & Records List */}
                <div className="space-y-3">
                    {activeTab === 'run' && (
                        filteredEmployees.map(emp => {
                            const lateDeduction = emp.lates * 500;
                            const netPay = emp.basic + emp.allowance - lateDeduction;

                            return (
                                <div key={emp.id} className="bg-white dark:bg-github-dark-subtle p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex flex-col space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-sm leading-tight">{emp.name}</h4>
                                            <p className="text-[10px] text-slate-455 mt-1 font-semibold">{emp.designation} · {emp.department}</p>
                                        </div>
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                            payrollStatus === 'Released' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {payrollStatus === 'Released' ? 'Paid' : 'Draft'}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
                                        <div>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Basic + Allow</p>
                                            <p className="font-bold text-slate-700 dark:text-github-dark-text mt-0.5">₹{(emp.basic + emp.allowance).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Deduction</p>
                                            <p className="font-bold text-rose-500 mt-0.5">₹{lateDeduction.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Net Payout</p>
                                            <p className="font-black text-indigo-650 dark:text-indigo-400 mt-0.5">₹{netPay.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 border-t pt-3">
                                        <button
                                            onClick={() => setSelectedPayslipEmp(emp)}
                                            className="flex-1 py-2 border border-slate-200 dark:border-github-dark-border rounded-xl text-[10px] font-black text-slate-700 dark:text-github-dark-text uppercase tracking-wider flex items-center justify-center gap-1 hover:bg-slate-50"
                                        >
                                            <Printer size={12} />
                                            <span>Payslip Preview</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {activeTab === 'structure' && (
                        filteredEmployees.map(emp => (
                            <div key={emp.id} className="bg-white dark:bg-github-dark-subtle p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex flex-col space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-sm leading-tight">{emp.name}</h4>
                                        <p className="text-[10px] text-slate-455 mt-1 font-semibold">{emp.designation}</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 border-t pt-3 text-center text-xs">
                                        <div>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Basic Pay</p>
                                            <p className="font-bold text-slate-705 dark:text-github-dark-text mt-0.5">₹{emp.basic.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex border-t pt-3">
                                    <button
                                        onClick={() => {
                                            setEditingEmp(emp);
                                            setEditForm({ basic: emp.basic, allowance: emp.allowance, pf: emp.pf });
                                        }}
                                        className="flex-1 py-2 bg-slate-50 dark:bg-github-dark-border rounded-xl text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-center gap-1 active:scale-[0.98] transition-all"
                                    >
                                        <Settings size={12} />
                                        <span>Edit Salary Config</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    {activeTab === 'payslips' && (
                        <div className="space-y-3">
                            <h3 className="font-black text-slate-800 dark:text-github-dark-text text-[11px] uppercase tracking-wider pl-1">Processed Months</h3>
                            {processedMonths.map((m, idx) => (
                                <div key={idx} className="p-4 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 flex items-center justify-center">
                                            <Calendar size={16} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-xs leading-tight">{m}</h4>
                                            <p className="text-[9px] text-slate-400 font-semibold mt-1">Status: Ready</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toast.success("Downloading CSV Wage Register...")}
                                        className="p-2 bg-slate-50 dark:bg-github-dark-border rounded-xl border border-slate-200 dark:border-github-dark-border text-slate-550 cursor-pointer shadow-sm active:scale-95 transition-all"
                                    >
                                        <Download size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Sheets / Modals */}
            {editingEmp && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
                    <div className="absolute inset-0" onClick={() => setEditingEmp(null)}></div>
                    <div className="relative z-10 w-full bg-white dark:bg-github-dark-bg rounded-t-[2rem] p-6 animate-in slide-in-from-bottom duration-300 space-y-4">
                        <div className="flex justify-center">
                            <span className="w-12 h-1 bg-slate-200 rounded-full"></span>
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 dark:text-github-dark-text text-sm">Configure Salary</h3>
                            <p className="text-[10px] text-slate-400 mt-1 font-semibold">{editingEmp.name} · {editingEmp.designation}</p>
                        </div>
                        
                        <div className="space-y-3.5 pt-2">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Basic Pay</label>
                                <input
                                    type="number"
                                    value={editForm.basic}
                                    onChange={(e) => setEditForm({ ...editForm, basic: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-[#161b22] text-xs font-semibold text-slate-700 dark:text-github-dark-text"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">HRA / Allowance</label>
                                <input
                                    type="number"
                                    value={editForm.allowance}
                                    onChange={(e) => setEditForm({ ...editForm, allowance: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-[#161b22] text-xs font-semibold text-slate-700 dark:text-github-dark-text"
                                />
                            </div>
                            </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => handleSaveSalary(editingEmp.id)}
                                className="flex-1 py-3 bg-indigo-600 text-white text-xs font-bold uppercase rounded-xl shadow-md cursor-pointer"
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={() => setEditingEmp(null)}
                                className="flex-1 py-3 border border-slate-200 text-slate-650 text-xs font-bold uppercase rounded-xl shadow-sm cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Payslip Preview Sheet */}
            {selectedPayslipEmp && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
                    <div className="absolute inset-0" onClick={() => setSelectedPayslipEmp(null)}></div>
                    <div className="relative z-10 w-full bg-white dark:bg-github-dark-bg rounded-t-[2.5rem] p-6 animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[85vh]">
                        <div className="flex justify-center shrink-0 mb-4">
                            <span className="w-12 h-1 bg-slate-200 rounded-full"></span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pr-1">
                            <div className="border-b pb-3 flex justify-between items-start">
                                <div>
                                    <h3 className="text-sm font-black text-indigo-650 uppercase tracking-widest">Payslip Invoice</h3>
                                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">{selectedMonth}</p>
                                </div>
                                <div className="text-right">
                                    <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-xs">LabsKraft Tech</h4>
                                </div>
                            </div>

                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-400">Employee:</span><span className="font-bold text-slate-700 dark:text-github-dark-text">{selectedPayslipEmp.name}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Designation:</span><span className="font-bold text-slate-700 dark:text-github-dark-text">{selectedPayslipEmp.designation}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Department:</span><span className="font-bold text-slate-700 dark:text-github-dark-text">{selectedPayslipEmp.department}</span></div>
                            </div>

                            <div className="border-t pt-4 space-y-4">
                                <div className="space-y-1.5 text-xs">
                                    <h5 className="font-bold text-[9px] uppercase tracking-wider text-slate-400">Earnings & Allowances</h5>
                                    <div className="flex justify-between"><span className="text-slate-500">Basic Salary</span><span className="font-bold text-slate-750">₹{selectedPayslipEmp.basic.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">HRA & Special Allowances</span><span className="font-bold text-slate-750">₹{selectedPayslipEmp.allowance.toLocaleString()}</span></div>
                                </div>

                                <div className="space-y-1.5 text-xs">
                                    <h5 className="font-bold text-[9px] uppercase tracking-wider text-slate-400">Lates Deductions</h5>
                                    <div className="flex justify-between"><span className="text-slate-500">Lateness Flags</span><span className="font-bold text-rose-500">₹{(selectedPayslipEmp.lates * 500).toLocaleString()}</span></div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-github-dark-border/20 rounded-2xl flex justify-between items-center border border-slate-100/50 mt-4">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Net Released</span>
                                <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                    ₹{(selectedPayslipEmp.basic + selectedPayslipEmp.allowance - (selectedPayslipEmp.lates * 500)).toLocaleString()}
                                </h3>
                            </div>
                        </div>

                        <div className="border-t pt-4 flex gap-3 justify-end shrink-0 mt-4">
                            <button
                                onClick={() => setSelectedPayslipEmp(null)}
                                className="flex-1 py-3 bg-indigo-650 text-white text-xs font-bold uppercase rounded-xl shadow-md cursor-pointer"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MobileDashboardLayout>
    );
};

export default PayrollMobile;
