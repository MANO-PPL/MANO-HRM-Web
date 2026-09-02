import React, { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
    CreditCard, 
    Calendar, 
    Search, 
    Download, 
    Settings, 
    Printer, 
    DollarSign, 
    Users, 
    AlertCircle,
    User,
    ArrowRight,
    TrendingUp,
    FileText,
    Lock,
    Unlock,
    SlidersHorizontal,
    X,
    Plus,
    Minus,
    ChevronDown,
    History,
    HelpCircle,
    FileSpreadsheet
} from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import payrollService from '../../services/payrollService';


import PayrollSummaryCards from './components/PayrollSummaryCards';
import PayrollToolbar from './components/PayrollToolbar';
import PayrollRunTab from './components/PayrollRunTab';
import PayrollAuditTab from './components/PayrollAuditTab';
import EmployeeConfigDrawer from './components/EmployeeConfigDrawer';
import PayslipModal from './components/PayslipModal';

const Payroll = () => {
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

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('run'); // 'run' | 'audit'
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessingAll, setIsProcessingAll] = useState(false);
    const [processedMonths, setProcessedMonths] = useState(['May 2026', 'April 2026']);
    
    // Status state for current month payroll release
    const [payrollStatus, setPayrollStatus] = useState('Draft'); // Draft, Processing, Released

    // Custom month dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Editing Salary Structure
    const [editingEmployeeId, setEditingEmployeeId] = useState(null);
    const [editForm, setEditForm] = useState({ basic: 0, allowance: 0, pf: 0 });

    // Audit logs state
    const [auditLogs, setAuditLogs] = useState([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    const fetchAuditLogs = async (monthStr) => {
        setLoadingAudit(true);
        try {
            const queryMonth = getMonthQueryParam(monthStr);
            const res = await payrollService.getAuditLogs(queryMonth);
            if (res && res.data) {
                setAuditLogs(res.data);
            }
        } catch (err) {
            console.error("Error fetching audit logs:", err);
        } finally {
            setLoadingAudit(false);
        }
    };

    // Payslip Modal State
    const [selectedPayslipEmp, setSelectedPayslipEmp] = useState(null);

    // Per-employee config drawer
    const [configEmp, setConfigEmp] = useState(null);
    const [lockingId, setLockingId] = useState(null);
    const [configNote, setConfigNote] = useState('');
    const [configAdjustments, setConfigAdjustments] = useState([]);
    const [savingConfig, setSavingConfig] = useState(false);

    const getMonthQueryParam = (monthStr) => {
        const parts = monthStr.split(' ');
        if (parts.length === 2) {
            const monthNames = {
                'January': '01', 'February': '02', 'March': '03', 'April': '04',
                'May': '05', 'June': '06', 'July': '07', 'August': '08',
                'September': '09', 'October': '10', 'November': '11', 'December': '12'
            };
            const m = monthNames[parts[0]];
            const y = parts[1];
            if (m && y) return `${y}-${m}`;
        }
        const now = new Date();
        const curM = String(now.getMonth() + 1).padStart(2, '0');
        const curY = now.getFullYear();
        return `${curY}-${curM}`;
    };

    const fetchPayroll = async (monthStr) => {
        setLoading(true);
        try {
            const queryMonth = getMonthQueryParam(monthStr);
            const res = await payrollService.getPayrollDashboard(queryMonth);
            if (res && res.data) {
                const mapped = res.data.map(entry => {
                    const gross = Number(entry.gross_salary || 0);
                    const basic = Math.round(gross * 0.40);
                    const hra = Math.round(basic * 0.50);
                    const pf = 0;
                    const specialAllowance = Math.max(0, gross - (basic + hra));
                    const allowances = hra + specialAllowance;

                    return {
                        id: entry.employee_id,
                        name: entry.user_name || entry.email,
                        designation: entry.designation || 'Staff',
                        department: entry.department || 'General',
                        gross: gross,
                        basic: basic,
                        allowance: allowances,
                        pf: pf,
                        lates: entry.lop_days || 0,
                        lop_deduction: Number(entry.lop_deduction || 0),
                        overtime_hours: Number(entry.overtime_hours || 0),
                        overtime_amount: Number(entry.overtime_amount || 0),
                        net_salary: Number(entry.net_salary || 0),
                        status: entry.status || 'Draft',
                        rawEntry: entry
                    };
                });
                setEmployees(mapped);
                if (res.run) {
                    setPayrollStatus(res.run.status === 'Live' ? 'Draft' : res.run.status);
                }
            }
        } catch (err) {
            console.error("Error fetching payroll data:", err);
            toast.error("Failed to load real-time payroll data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'audit') {
            fetchAuditLogs(selectedMonth);
        } else {
            fetchPayroll(selectedMonth);
        }
    }, [selectedMonth, activeTab]);

    // Search filter
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => 
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.department.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [employees, searchTerm]);

    // Audit logs filter
    const filteredAuditLogs = useMemo(() => {
        if (!searchTerm) return auditLogs;
        const term = searchTerm.toLowerCase();
        return auditLogs.filter(log => 
            (log.performed_by_name && log.performed_by_name.toLowerCase().includes(term)) ||
            (log.employee_name && log.employee_name.toLowerCase().includes(term)) ||
            (log.action && log.action.toLowerCase().includes(term)) ||
            (log.details && log.details.toLowerCase().includes(term))
        );
    }, [auditLogs, searchTerm]);

    // Financial calculations
    const totals = useMemo(() => {
        let gross = 0;
        let net = 0;

        employees.forEach(emp => {
            gross += emp.gross;
            net += emp.net_salary;
        });

        return { gross, net };
    }, [employees]);

    const handleLockToggle = async (emp) => {
        const isLocked = emp.status === 'Finalized' || emp.status === 'Paid';
        setLockingId(emp.id);
        try {
            const queryMonth = getMonthQueryParam(selectedMonth);
            if (isLocked) {
                await payrollService.unlockEmployee(emp.id, queryMonth);
                toast.success(`${emp.name}'s payroll unlocked.`);
            } else {
                await payrollService.finalizeEmployee(emp.id, queryMonth);
                toast.success(`${emp.name}'s payroll locked & finalized.`);
            }
            fetchPayroll(selectedMonth);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed.');
        } finally {
            setLockingId(null);
        }
    };

    const openConfig = (emp) => {
        setConfigEmp(emp);
        const existing = emp.rawEntry?.adjustments_json
            ? (typeof emp.rawEntry.adjustments_json === 'string'
                ? JSON.parse(emp.rawEntry.adjustments_json)
                : emp.rawEntry.adjustments_json)
            : [];
        setConfigAdjustments(existing);
        setConfigNote(emp.rawEntry?.notes || '');
    };

    const addAdjustment = (type) => {
        setConfigAdjustments(prev => [...prev, { type, label: '', amount: '', reason: '' }]);
    };

    const removeAdjustment = (idx) => {
        setConfigAdjustments(prev => prev.filter((_, i) => i !== idx));
    };

    const updateAdjustment = (idx, field, value) => {
        setConfigAdjustments(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
    };

    const handleSaveConfig = async () => {
        if (!configEmp?.rawEntry?.entry_id) {
            toast.error('No payroll entry found. Lock the employee first to save config.');
            return;
        }

        // Validate adjustments on frontend
        for (const adj of configAdjustments) {
            if (!adj.label?.trim()) {
                toast.warn("Please enter a label/name for each manual adjustment.");
                return;
            }
            if (!adj.amount || Number(adj.amount) <= 0) {
                toast.warn("Please enter a valid amount greater than 0 for each manual adjustment.");
                return;
            }
            if (!adj.reason?.trim()) {
                toast.warn(`Please provide a reason/justification for "${adj.label}".`);
                return;
            }
        }

        setSavingConfig(true);
        try {
            await payrollService.updateAdjustments(configEmp.rawEntry.entry_id, configAdjustments);
            toast.success(`Config saved for ${configEmp.name}.`);
            setConfigEmp(null);
            fetchPayroll(selectedMonth);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save config.');
        } finally {
            setSavingConfig(false);
        }
    };

    const downloadFile = (content, filename, contentType) => {
        const blob = new Blob(["\uFEFF" + content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintPayslip = (emp) => {
        const snap = emp.rawEntry;
        const salarySnap = snap?.salary_snapshot_json 
            ? (typeof snap.salary_snapshot_json === 'string' ? JSON.parse(snap.salary_snapshot_json) : snap.salary_snapshot_json)
            : {};
        const attSnap = snap?.attendance_snapshot_json 
            ? (typeof snap.attendance_snapshot_json === 'string' ? JSON.parse(snap.attendance_snapshot_json) : snap.attendance_snapshot_json)
            : {};
        const adjustments = snap?.adjustments_json
            ? (typeof snap.adjustments_json === 'string' ? JSON.parse(snap.adjustments_json) : snap.adjustments_json)
            : [];
        const additionsSum = adjustments.filter(a => a.type === 'addition').reduce((sum, a) => sum + Number(a.amount), 0);
        const deductionsSum = adjustments.filter(a => a.type === 'deduction').reduce((sum, a) => sum + Number(a.amount), 0);
        
        const getDaysInMonth = (monthStr) => {
            const parts = monthStr.split(' ');
            if (parts.length === 2) {
                const months = {
                    'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
                    'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
                };
                const m = months[parts[0]];
                const y = parseInt(parts[1], 10);
                if (m !== undefined && !isNaN(y)) {
                    return new Date(y, m + 1, 0).getDate();
                }
            }
            return 30; // fallback
        };
        const calendarDays = getDaysInMonth(selectedMonth);
        const dailyRate = emp.gross / calendarDays;
        

        const totalEarnings = emp.basic + emp.allowance + emp.overtime_amount + additionsSum;
        const totalDeductions = emp.lop_deduction + deductionsSum;
        const netPay = emp.net_salary;

        const printWindow = window.open('', '_blank', 'width=800,height=950');
        printWindow.document.write(`
            <html>
            <head>
                <title>Payslip - ${emp.name}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        color: #1e293b;
                        margin: 0;
                        padding: 12mm 15mm;
                        line-height: 1.4;
                        font-size: 11px;
                        background: #fff;
                    }
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 12px;
                        margin-bottom: 15px;
                    }
                    .company-details h1 {
                        font-size: 18px;
                        font-weight: 800;
                        margin: 0;
                        color: #4f46e5;
                    }
                    .payslip-title {
                        text-align: right;
                    }
                    .payslip-title h2 {
                        font-size: 15px;
                        font-weight: 800;
                        margin: 0;
                        color: #0f172a;
                        letter-spacing: 0.05em;
                    }
                    .payslip-title p {
                        margin: 4px 0 0 0;
                        font-weight: 600;
                        font-size: 10px;
                        background: #f1f5f9;
                        padding: 3px 10px;
                        border-radius: 6px;
                        display: inline-block;
                    }
                    .info-grid {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 15px;
                        background: #f8fafc;
                        padding: 12px 16px;
                        border-radius: 10px;
                        border: 1px solid #f1f5f9;
                    }
                    .info-column {
                        width: 48%;
                    }
                    .info-column p {
                        margin: 4px 0;
                        display: flex;
                        justify-content: space-between;
                    }
                    .info-column span.label {
                        color: #64748b;
                        font-weight: 500;
                    }
                    .info-column span.value {
                        font-weight: 700;
                        color: #0f172a;
                    }
                    .section-title {
                        font-size: 9px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: #64748b;
                        margin: 15px 0 8px 0;
                        border-bottom: 1px solid #e2e8f0;
                        padding-bottom: 4px;
                    }
                    .attendance-grid {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
                    }
                    .attendance-box {
                        width: calc(33.33% - 4px);
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        padding: 8px 4px;
                        border-radius: 6px;
                        text-align: center;
                        box-sizing: border-box;
                    }
                    .attendance-box span.label {
                        display: block;
                        font-size: 8px;
                        font-weight: 700;
                        color: #64748b;
                    }
                    .attendance-box span.value {
                        font-size: 12px;
                        font-weight: 800;
                        color: #0f172a;
                        margin-top: 2px;
                        display: block;
                    }
                    .details-list {
                        background: #fff;
                        border: 1px solid #e2e8f0;
                        border-radius: 10px;
                        padding: 10px 14px;
                        box-sizing: border-box;
                    }
                    .details-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 5px 0;
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .details-row.total {
                        border-top: 1px solid #e2e8f0;
                        padding-top: 8px;
                        margin-top: 3px;
                    }
                    .text-rose {
                        color: #e11d48;
                    }
                    .text-emerald {
                        color: #059669;
                    }
                    .summary-container {
                        border: 1px solid #cbd5e1;
                        border-radius: 10px;
                        padding: 12px 16px;
                        background: #f8fafc;
                        box-sizing: border-box;
                    }
                    .summary-container .details-row {
                        font-size: 11px;
                    }
                    .summary-container .net-payable {
                        border-top: 1px dashed #cbd5e1;
                        padding-top: 10px;
                        margin-top: 8px;
                        font-size: 12px;
                        font-weight: 900;
                    }
                    .summary-container .net-payable .value {
                        font-size: 15px;
                        color: #4f46e5;
                    }
                    .footer-note {
                        text-align: center;
                        color: #94a3b8;
                        font-size: 9px;
                        margin-top: 25px;
                        border-top: 1px solid #f1f5f9;
                        padding-top: 10px;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 12mm 15mm;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="company-details">
                        <h1>MANO Attendance</h1>
                    </div>
                    <div class="payslip-title">
                        <h2>SALARY PAYSLIP</h2>
                        <p>${selectedMonth}</p>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-column">
                        <p><span class="label">Employee</span> <span class="value">${emp.name}</span></p>
                        <p><span class="label">Designation</span> <span class="value">${emp.designation}</span></p>
                        <p><span class="label">Department</span> <span class="value">${emp.department}</span></p>
                    </div>
                    <div class="info-column">
                        <p><span class="label">Payment Method</span> <span class="value">Bank Direct Deposit</span></p>
                    </div>
                </div>

                <div class="section-title">Attendance Summary</div>
                <div class="attendance-grid">
                    <div class="attendance-box">
                        <span class="label">Present Days</span>
                        <span class="value">${Number(attSnap.present_days || 0).toFixed(2)}</span>
                    </div>
                    <div class="attendance-box">
                        <span class="label">Half Days</span>
                        <span class="value">${Number(attSnap.half_days || 0).toFixed(2)}</span>
                    </div>
                    <div class="attendance-box">
                        <span class="label">Absent Days</span>
                        <span class="value">${Number(attSnap.absent_days || 0).toFixed(2)}</span>
                    </div>
                    <div class="attendance-box">
                        <span class="label">Paid Leave</span>
                        <span class="value">${Number(attSnap.paid_leave_days || 0).toFixed(2)}</span>
                    </div>
                    <div class="attendance-box">
                        <span class="label">Holidays</span>
                        <span class="value">${Number(attSnap.holiday_days || 0).toFixed(2)}</span>
                    </div>
                    <div class="attendance-box">
                        <span class="label">Week Offs</span>
                        <span class="value">${Number(attSnap.weekly_off_days || 0).toFixed(2)}</span>
                    </div>
                </div>

                <div class="section-title">LOP Deduction Details</div>
                <div class="details-list">
                    <div class="details-row">
                        <span>Gross Monthly Salary</span>
                        <span>₹${Number(emp.gross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="details-row">
                        <span>Calendar Days</span>
                        <span>${calendarDays} days</span>
                    </div>
                    <div class="details-row">
                        <span>Daily Rate</span>
                        <span>₹${Number(dailyRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="details-row total">
                        <span>Total LOP Days</span>
                        <span>${Number(snap?.lop_days || 0).toFixed(2)} days</span>
                    </div>
                    <div class="details-row text-rose">
                        <span>LOP Deduction Amount</span>
                        <span>₹${Number(emp.lop_deduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>

                <div class="section-title">Overtime Calculations</div>
                <div class="details-list">
                    <div class="details-row">
                        <span>Overtime Enabled</span>
                        <span>${salarySnap?.overtime_enabled ? 'Yes' : 'No'}</span>
                    </div>
                    <div class="details-row">
                        <span>Overtime Rate</span>
                        <span>₹${Number(salarySnap?.overtime_rate || 0).toLocaleString('en-IN')}/ hr</span>
                    </div>
                    <div class="details-row">
                        <span>Total Overtime Hours</span>
                        <span>${Number(snap?.overtime_hours || 0).toFixed(2)} hrs</span>
                    </div>
                    <div class="details-row total text-emerald">
                        <span>Overtime Allowance Amount</span>
                        <span>₹${Number(emp.overtime_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>

                <div class="section-title">Net Payable Salary Summary</div>
                <div class="summary-container">
                    <div class="details-row">
                        <span>Gross Salary</span>
                        <span>₹${Number(emp.gross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="details-row text-rose">
                        <span>Deduction (LOP)</span>
                        <span>-₹${Number(emp.lop_deduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ${emp.pf > 0 ? `
                    <div class="details-row text-rose">
                        <span>Deduction (PF)</span>
                        <span>-₹${Number(emp.pf || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    ${deductionsSum > 0 ? `
                    <div class="details-row text-rose">
                        <span>Other Deductions</span>
                        <span>-₹${Number(deductionsSum || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    <div class="details-row text-emerald">
                        <span>Allowance (OT)</span>
                        <span>+₹${Number(emp.overtime_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ${additionsSum > 0 ? `
                    <div class="details-row text-emerald">
                        <span>Bonus / Additions</span>
                        <span>+₹${Number(additionsSum || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    <div class="net-payable details-row">
                        <span>Net Payable Salary</span>
                        <span class="value">₹${Number(netPay).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>

                <div class="footer-note">
                    <p>This is a system generated salary payslip and does not require a physical signature.</p>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleExport = () => {
        if (activeTab === 'run') {
            if (employees.length === 0) {
                toast.warn("No payroll entries available to export.");
                return;
            }

            const headers = [
                'Employee ID',
                'Employee Name',
                'Designation',
                'Department',
                'Gross CTC (Monthly)',
                'Basic Salary',
                'HRA & Allowances',
                'Present Days',
                'Half Days',
                'Absent Days',
                'Paid Leaves',
                'Holidays',
                'Weekly Offs',
                'LOP Days',
                'LOP Deduction',
                'Overtime Hours',
                'Overtime Rate (₹/hr)',
                'Overtime Amount',
                'Manual Adjustments Sum',
                'Net Payout',
                'Status'
            ];

            const rows = employees.map(emp => {
                const snap = emp.rawEntry;
                const salarySnap = snap?.salary_snapshot_json 
                    ? (typeof snap.salary_snapshot_json === 'string' ? JSON.parse(snap.salary_snapshot_json) : snap.salary_snapshot_json)
                    : {};
                const attSnap = snap?.attendance_snapshot_json 
                    ? (typeof snap.attendance_snapshot_json === 'string' ? JSON.parse(snap.attendance_snapshot_json) : snap.attendance_snapshot_json)
                    : {};

                const adjustments = snap?.adjustments_json
                    ? (typeof snap.adjustments_json === 'string' ? JSON.parse(snap.adjustments_json) : snap.adjustments_json)
                    : [];
                const additionsSum = adjustments.filter(a => a.type === 'addition').reduce((sum, a) => sum + Number(a.amount), 0);
                const deductionsSum = adjustments.filter(a => a.type === 'deduction').reduce((sum, a) => sum + Number(a.amount), 0);
                const adjustmentsNet = additionsSum - deductionsSum;

                const netPay = emp.net_salary - emp.pf;

                return [
                    emp.id,
                    emp.name,
                    emp.designation,
                    emp.department,
                    emp.gross,
                    emp.basic,
                    emp.allowance,
                    attSnap.present_days ?? (emp.lates > 0 ? (30 - emp.lates) : 30),
                    attSnap.half_days ?? 0,
                    attSnap.absent_days ?? 0,
                    attSnap.paid_leave_days ?? 0,
                    attSnap.holiday_days ?? 0,
                    attSnap.weekly_off_days ?? 0,
                    emp.lates,
                    emp.lop_deduction,
                    emp.overtime_hours,
                    salarySnap.overtime_rate ?? 0,
                    emp.overtime_amount,
                    adjustmentsNet,
                    netPay,
                    emp.status
                ];
            });

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(val => {
                    if (typeof val === 'string') {
                        return `"${val.replace(/"/g, '""')}"`;
                    }
                    return val === null || val === undefined ? '' : val;
                }).join(','))
            ].join('\n');

            downloadFile(csvContent, `Wage_Register_${selectedMonth.replace(' ', '_')}.csv`, 'text/csv;charset=utf-8;');
            toast.success("Wage Register exported successfully!");
        } else if (activeTab === 'audit') {
            if (auditLogs.length === 0) {
                toast.warn("No audit trail logs available to export.");
                return;
            }

            const headers = [
                'Log ID',
                'Timestamp',
                'Action',
                'Performed By',
                'Employee Name',
                'Details'
            ];

            const rows = auditLogs.map(log => [
                log.log_id,
                new Date(log.created_at).toLocaleString('en-IN'),
                log.action,
                log.performed_by_name,
                log.employee_name || 'N/A',
                log.details
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(val => {
                    if (typeof val === 'string') {
                        return `"${val.replace(/"/g, '""')}"`;
                    }
                    return val === null || val === undefined ? '' : val;
                }).join(','))
            ].join('\n');

            downloadFile(csvContent, `Audit_Trail_${selectedMonth.replace(' ', '_')}.csv`, 'text/csv;charset=utf-8;');
            toast.success("Audit Trail logs exported successfully!");
        }
    };

    return (
        <DashboardLayout title="Payroll Management" noPadding={true}>
            <div className="w-full min-h-[calc(100vh-64px)] px-2.5 pt-2 pb-10 bg-slate-50 dark:bg-dark-bg space-y-2.5">
                
                {/* Stats cards strip */}
                <PayrollSummaryCards
                    selectedMonth={selectedMonth}
                    totals={totals}
                />

                {/* View Switcher Tabs, Search, & Actions Toolbar */}
                <PayrollToolbar
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                    isDropdownOpen={isDropdownOpen}
                    setIsDropdownOpen={setIsDropdownOpen}
                    allMonths={allMonths}
                    setPayrollStatus={setPayrollStatus}
                    processedMonths={processedMonths}
                    employees={employees}
                    handleExport={handleExport}
                />

                {/* List directly on the page */}
                <div className="w-full overflow-x-auto bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm">
                    {activeTab === 'run' && (
                        <PayrollRunTab
                            loading={loading}
                            filteredEmployees={filteredEmployees}
                            lockingId={lockingId}
                            handleLockToggle={handleLockToggle}
                            setSelectedPayslipEmp={setSelectedPayslipEmp}
                            openConfig={openConfig}
                        />
                    )}

                    {activeTab === 'audit' && (
                        <PayrollAuditTab
                            loadingAudit={loadingAudit}
                            filteredAuditLogs={filteredAuditLogs}
                        />
                    )}
                </div>
            </div>

            {/* Employee Config Drawer */}
            <EmployeeConfigDrawer
                configEmp={configEmp}
                setConfigEmp={setConfigEmp}
                selectedMonth={selectedMonth}
                configAdjustments={configAdjustments}
                addAdjustment={addAdjustment}
                updateAdjustment={updateAdjustment}
                removeAdjustment={removeAdjustment}
                handleLockToggle={handleLockToggle}
                handleSaveConfig={handleSaveConfig}
                savingConfig={savingConfig}
            />

            {/* Payslip Details Sidebar Drawer */}
            <PayslipModal
                selectedPayslipEmp={selectedPayslipEmp}
                setSelectedPayslipEmp={setSelectedPayslipEmp}
                selectedMonth={selectedMonth}
                handlePrintPayslip={handlePrintPayslip}
            />
        </DashboardLayout>
    );
};

export default Payroll;
