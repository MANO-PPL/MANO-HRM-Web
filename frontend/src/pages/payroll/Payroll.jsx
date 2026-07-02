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
    HelpCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import payrollService from '../../services/payrollService';

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
    const [activeTab, setActiveTab] = useState('run');
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
            <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden p-3 bg-slate-50 dark:bg-dark-bg space-y-3">
                
                {/* Stats cards strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Gross Payroll ({selectedMonth})</span>
                            <h3 className="text-xl font-black text-slate-800 dark:text-github-dark-text mt-1">₹{totals.gross.toLocaleString()}</h3>
                            <p className="text-[10px] text-slate-455 dark:text-github-dark-muted mt-1">Basic + Allowances</p>
                        </div>
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 rounded-xl">
                            <DollarSign size={20} />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Net Disbursed</span>
                            <h3 className="text-xl font-black text-slate-800 dark:text-github-dark-text mt-1">₹{totals.net.toLocaleString()}</h3>
                            <p className="text-[10px] text-slate-455 dark:text-github-dark-muted mt-1">After LOP Deductions</p>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <CreditCard size={20} />
                        </div>
                    </div>
                </div>

                {/* View Switcher Tabs & Period Picker */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <div className="flex w-fit items-center gap-3 p-1.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0">
                        {[
                            { id: 'run', label: 'Run Monthly Payroll', icon: CreditCard },
                            { id: 'audit', label: 'Audit Trail', icon: History }
                        ].map((tab) => {
                            const isSelected = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                        isSelected
                                            ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <tab.icon size={14} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="px-3.5 py-2 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-[#21262d] flex items-center gap-2 select-none"
                            >
                                <Calendar size={14} className="text-slate-400" />
                                <span>{selectedMonth}</span>
                                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {isDropdownOpen && (
                                    <>
                                        {/* Click away overlay */}
                                        <div 
                                            className="fixed inset-0 z-10" 
                                            onClick={() => setIsDropdownOpen(false)} 
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl shadow-xl z-20 py-1.5 overflow-hidden max-h-60 overflow-y-auto no-scrollbar"
                                        >
                                            {allMonths.map((m) => {
                                                const isSelected = selectedMonth === m;
                                                return (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedMonth(m);
                                                            setPayrollStatus(processedMonths.includes(m) ? 'Released' : 'Draft');
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                                                            isSelected
                                                                ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400'
                                                                : 'text-slate-650 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-[#21262d]'
                                                        }`}
                                                    >
                                                        <span>{m}</span>
                                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />}
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        {activeTab === 'run' && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                                employees.filter(e => e.status === 'Finalized' || e.status === 'Paid').length === employees.length && employees.length > 0
                                    ? 'bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
                            }`}>
                                <Lock size={10} />
                                {employees.filter(e => e.status === 'Finalized' || e.status === 'Paid').length}/{employees.length} Locked
                            </span>
                        )}
                    </div>
                </div>

                {/* Main Content Card */}
                <div className="flex-1 min-h-0 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                    
                    {/* Search & Actions Toolbar */}
                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-github-dark-subtle/10">
                        <div className="relative w-72">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleExport}
                                className="px-3.5 py-2 bg-[#f6f8fa] hover:bg-[#eaeef2] dark:bg-[#21262d] dark:hover:bg-[#30363d] text-[#24292f] dark:text-[#c9d1d9] border border-[#d0d7de] dark:border-[#30363d] font-bold uppercase tracking-wider rounded-xl shadow-sm text-[10px] cursor-pointer flex items-center gap-1.5"
                            >
                                <Download size={12} />
                                <span>{activeTab === 'run' ? 'Export Wage Register' : 'Export Audit Trail'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Tab Panels */}
                    <div className="flex-1 overflow-auto no-scrollbar">
                        {activeTab === 'run' && (
                            loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-8 h-8 border-3 border-indigo-150 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading real-time payroll data...</p>
                                </div>
                            ) : filteredEmployees.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Users className="text-slate-200 dark:text-slate-700" size={48} />
                                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">No payroll entries found for this month.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border">
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Employee</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted text-right">Basic Salary</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted text-right">LOP Deductions</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted text-right">Net Payout</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted text-center">Status</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted text-center">Lock</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 dark:divide-github-dark-border">
                                        {filteredEmployees.map((emp) => {
                                            const netPay = emp.net_salary;
                                            const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2);

                                            return (
                                                <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-github-dark-subtle/5 transition-colors">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shadow-inner shrink-0">
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <span className="block font-bold text-slate-800 dark:text-github-dark-text text-sm leading-none">{emp.name}</span>
                                                                <span className="block text-[10px] font-semibold text-slate-400 mt-1">{emp.designation} · {emp.department}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-semibold text-slate-700 dark:text-github-dark-text">₹{emp.basic.toLocaleString()}</td>
                                                    <td className="px-5 py-4 text-right font-semibold text-rose-500">
                                                        {emp.lop_deduction > 0 ? `-₹${emp.lop_deduction.toLocaleString()}` : '₹0'}
                                                        {emp.lates > 0 && <span className="block text-[8px] font-bold text-slate-450 dark:text-github-dark-muted mt-0.5">{emp.lates} LOP days</span>}
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-black text-indigo-600 dark:text-indigo-400">
                                                        ₹{netPay.toLocaleString()}
                                                        {emp.overtime_amount > 0 && <span className="block text-[8px] font-bold text-emerald-500 mt-0.5">+₹{emp.overtime_amount.toLocaleString()} (OT)</span>}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                         {(() => {
                                                             const s = emp.status;
                                                             const isPaid = s === 'Paid';
                                                             const isFinalized = s === 'Finalized';
                                                             return (
                                                                 <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                     isPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                     : isFinalized ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                                                                     : 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                                                 }`}>
                                                                     {s || 'Draft'}
                                                                 </span>
                                                             );
                                                         })()}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                         <button
                                                             onClick={() => handleLockToggle(emp)}
                                                             disabled={lockingId === emp.id || emp.status === 'Paid'}
                                                             title={emp.status === 'Finalized' || emp.status === 'Paid' ? 'Unlock payroll' : 'Lock & finalize payroll'}
                                                             className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                                                                 emp.status === 'Finalized' || emp.status === 'Paid'
                                                                     ? 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200'
                                                                     : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-amber-100 hover:text-amber-600'
                                                             }`}
                                                         >
                                                             {lockingId === emp.id
                                                                 ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                                                 : emp.status === 'Finalized' || emp.status === 'Paid'
                                                                     ? <Lock size={13} />
                                                                     : <Unlock size={13} />}
                                                         </button>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => setSelectedPayslipEmp(emp)}
                                                                className="px-2.5 py-1.5 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-text hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold uppercase rounded-lg shadow-sm cursor-pointer inline-flex items-center gap-1"
                                                            >
                                                                <Printer size={10} />
                                                                <span>Slip</span>
                                                            </button>
                                                            <button
                                                                onClick={() => openConfig(emp)}
                                                                title="Configure adjustments"
                                                                className="w-7 h-7 flex items-center justify-center border border-slate-200 dark:border-github-dark-border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer"
                                                            >
                                                                <SlidersHorizontal size={11} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )
                        )}

                        {activeTab === 'audit' && (
                            loadingAudit ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-8 h-8 border-3 border-indigo-150 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading detailed audit trails...</p>
                                </div>
                            ) : auditLogs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <History className="text-slate-200 dark:text-slate-700" size={48} />
                                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">No audit trail records found for this period.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border">
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Timestamp</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted text-center">Action</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Performed By</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Employee</th>
                                            <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 dark:divide-github-dark-border text-xs font-semibold text-slate-700 dark:text-[#c9d1d9]">
                                        {auditLogs.map((log) => {
                                            const actionColors = {
                                                'PACKAGE_CREATE': 'bg-purple-100 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400',
                                                'PACKAGE_REVISION_CREATE': 'bg-purple-100 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400',
                                                'PACKAGE_UPDATE': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/20 dark:text-fuchsia-400',
                                                'PACKAGE_DELETE': 'bg-rose-100 text-rose-700 dark:bg-rose-955/20 dark:text-rose-400',
                                                'PACKAGE_ASSIGN': 'bg-blue-100 text-blue-700 dark:bg-blue-955/20 dark:text-blue-400',
                                                'PACKAGE_UNASSIGN': 'bg-orange-100 text-orange-700 dark:bg-orange-955/20 dark:text-orange-400',
                                                'LOCK': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-955/20 dark:text-indigo-400',
                                                'UNLOCK': 'bg-amber-100 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400',
                                                'ADJUSTMENT_UPDATE': 'bg-sky-100 text-sky-700 dark:bg-sky-955/20 dark:text-sky-400',
                                                'PAY': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-955/20 dark:text-emerald-400'
                                            };
                                            const colorClass = actionColors[log.action] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
                                            return (
                                                <tr key={log.log_id} className="hover:bg-slate-50/50 dark:hover:bg-github-dark-subtle/5 transition-colors">
                                                    <td className="px-5 py-4 whitespace-nowrap text-slate-400 dark:text-github-dark-muted font-bold text-[10.5px]">
                                                        {new Date(log.created_at).toLocaleString('en-IN', {
                                                            year: 'numeric', month: 'short', day: 'numeric',
                                                            hour: '2-digit', minute: '2-digit', hour12: true
                                                        })}
                                                    </td>
                                                    <td className="px-5 py-4 text-center whitespace-nowrap">
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${colorClass}`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap text-slate-700 dark:text-github-dark-text">{log.performed_by_name}</td>
                                                    <td className="px-5 py-4 whitespace-nowrap text-slate-705 dark:text-github-dark-text">{log.employee_name || '—'}</td>
                                                    <td className="px-5 py-4 text-slate-500 dark:text-github-dark-muted">{log.details}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Employee Config Drawer */}
            <AnimatePresence>
                {configEmp && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }}
                            onClick={() => setConfigEmp(null)}
                            className="fixed inset-0 bg-black z-40"
                        />
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'tween', duration: 0.3 }}
                            className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl z-50 flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-github-dark-border/80 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="font-extrabold text-slate-800 dark:text-github-dark-text text-base flex items-center gap-2">
                                        <SlidersHorizontal className="text-indigo-500" size={17} />
                                        Employee Config
                                    </h3>
                                    <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-1">{configEmp.name} · {selectedMonth}</p>
                                </div>
                                <button onClick={() => setConfigEmp(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-xl transition-all">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                                {/* Salary snapshot */}
                                <div className="bg-slate-50/60 dark:bg-[#161b22]/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/60 space-y-3">
                                    <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">Salary Snapshot</h4>
                                    {[
                                        { label: 'Basic Pay', value: configEmp.basic },
                                        { label: 'Allowances', value: configEmp.allowance },
                                        { label: 'LOP Deduction', value: -configEmp.lop_deduction },
                                        { label: 'Overtime', value: configEmp.overtime_amount },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 dark:text-github-dark-muted font-medium">{label}</span>
                                            <span className={`font-extrabold ${ value < 0 ? 'text-rose-500' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                {value < 0 ? `-₹${Math.abs(value).toLocaleString('en-IN')}` : `₹${value.toLocaleString('en-IN')}`}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="border-t border-dashed border-slate-200 dark:border-github-dark-border/40 pt-3 flex justify-between items-center">
                                        <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">Net Payout</span>
                                        <span className="text-sm font-black text-indigo-700 dark:text-indigo-400">₹{(configEmp.basic + configEmp.allowance + configEmp.overtime_amount - configEmp.lop_deduction).toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                    {/* Locked warning banner */}
                                    {(() => {
                                        const isLocked = configEmp.status === 'Finalized' || configEmp.status === 'Paid';
                                        return isLocked && (
                                            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex items-start gap-2.5">
                                                <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={15} />
                                                <span className="text-[10.5px] text-amber-700 dark:text-amber-450 font-bold leading-normal">
                                                    This payroll is locked ({configEmp.status}). Click the "Unlock" button below to return it to Draft status before editing manual adjustments.
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    {/* Manual Adjustments */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">Manual Adjustments</h4>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => addAdjustment('addition')}
                                                    disabled={configEmp.status === 'Finalized' || configEmp.status === 'Paid'}
                                                    className="px-2 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-40 disabled:hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg flex items-center gap-1 transition-all"
                                                >
                                                    <Plus size={10} /> Addition
                                                </button>
                                                <button
                                                    onClick={() => addAdjustment('deduction')}
                                                    disabled={configEmp.status === 'Finalized' || configEmp.status === 'Paid'}
                                                    className="px-2 py-1 text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-40 disabled:hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 rounded-lg flex items-center gap-1 transition-all"
                                                >
                                                    <Minus size={10} /> Deduction
                                                </button>
                                            </div>
                                        </div>

                                        {configAdjustments.length === 0 && (
                                            <div className="py-6 text-center text-[11px] text-slate-400 dark:text-github-dark-muted font-semibold bg-slate-50 dark:bg-[#161b22]/30 rounded-xl border border-dashed border-slate-200 dark:border-github-dark-border/40">
                                                No adjustments added. Use the buttons above to add bonus or deduction entries.
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            {configAdjustments.map((adj, idx) => {
                                                const isLocked = configEmp.status === 'Finalized' || configEmp.status === 'Paid';
                                                return (
                                                    <div key={idx} className={`p-3 rounded-xl border flex flex-col gap-2 ${adj.type === 'addition' ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-6 rounded-full shrink-0 ${adj.type === 'addition' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                            <input
                                                                type="text"
                                                                placeholder="Label (e.g. Bonus)"
                                                                value={adj.label}
                                                                disabled={isLocked}
                                                                onChange={e => updateAdjustment(idx, 'label', e.target.value)}
                                                                className="flex-1 bg-transparent text-xs font-semibold text-slate-700 dark:text-github-dark-text outline-none placeholder:text-slate-355 dark:placeholder:text-slate-600 disabled:text-slate-400 dark:disabled:text-slate-500"
                                                            />
                                                            <span className="text-xs text-slate-400">₹</span>
                                                            <input
                                                                type="number"
                                                                placeholder="0"
                                                                value={adj.amount}
                                                                disabled={isLocked}
                                                                onChange={e => updateAdjustment(idx, 'amount', e.target.value)}
                                                                className="w-20 bg-transparent text-xs font-extrabold text-slate-800 dark:text-github-dark-text outline-none text-right placeholder:text-slate-350 disabled:text-slate-400 dark:disabled:text-slate-500"
                                                            />
                                                            <button
                                                                onClick={() => removeAdjustment(idx)}
                                                                disabled={isLocked}
                                                                className="text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400 ml-1 transition-all"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                        <div className="pl-3.5">
                                                            <input
                                                                type="text"
                                                                placeholder="Reason/Justification (required)"
                                                                value={adj.reason || ''}
                                                                disabled={isLocked}
                                                                onChange={e => updateAdjustment(idx, 'reason', e.target.value)}
                                                                className="w-full bg-transparent text-[11px] font-semibold text-slate-500 dark:text-github-dark-muted outline-none placeholder:text-slate-350 dark:placeholder:text-slate-650 border-b border-dashed border-slate-200 dark:border-github-dark-border/40 focus:border-indigo-500 pb-0.5 disabled:text-slate-400 dark:disabled:text-slate-500"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">Current Status</h4>
                                        <div className="flex items-center gap-3">
                                            {(() => {
                                                const s = configEmp.status || 'Draft';
                                                const isLocked = s === 'Finalized' || s === 'Paid';
                                                return (
                                                    <>
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                            s === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                            : s === 'Finalized' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                                                        }`}>
                                                            {isLocked ? <Lock size={9} /> : <Unlock size={9} />}
                                                            {s}
                                                        </span>
                                                        <button
                                                            onClick={() => { handleLockToggle(configEmp); setConfigEmp(null); }}
                                                            disabled={s === 'Paid'}
                                                            className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isLocked ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'}`}
                                                        >
                                                            {isLocked ? 'Unlock' : 'Lock & Finalize'}
                                                        </button>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-6 border-t border-slate-100 dark:border-github-dark-border/80 flex gap-3 shrink-0">
                                    <button
                                        onClick={() => setConfigEmp(null)}
                                        className="flex-1 py-2.5 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold uppercase transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveConfig}
                                        disabled={savingConfig || configEmp.status === 'Finalized' || configEmp.status === 'Paid'}
                                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md"
                                    >
                                        {configEmp.status === 'Finalized' || configEmp.status === 'Paid' ? 'Locked (Read-Only)' : savingConfig ? 'Saving...' : 'Save Config'}
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

             {/* Payslip Details Sidebar Drawer */}
            <AnimatePresence>
                {selectedPayslipEmp && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedPayslipEmp(null)}
                            className="fixed inset-0 bg-black z-40"
                        />

                        {/* Drawer Container */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'tween', duration: 0.3 }}
                            className="fixed right-0 top-0 bottom-0 w-full sm:w-[580px] bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl z-50 flex flex-col"
                        >
                            {/* Drawer Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-github-dark-border/80 flex items-center justify-between">
                                <div>
                                    <h3 className="font-extrabold text-slate-800 dark:text-github-dark-text text-base flex items-center gap-2">
                                        <FileText className="text-indigo-500" size={18} />
                                        Payslip Details
                                    </h3>
                                    <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-1">Period: {selectedMonth}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedPayslipEmp(null)}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Drawer Body */}
                            {(() => {
                                const snap = selectedPayslipEmp.rawEntry;
                                const adjustments = snap?.adjustments_json
                                    ? (typeof snap.adjustments_json === 'string' ? JSON.parse(snap.adjustments_json) : snap.adjustments_json)
                                    : [];
                                const additionsSum = adjustments.filter(a => a.type === 'addition').reduce((sum, a) => sum + Number(a.amount), 0);
                                const deductionsSum = adjustments.filter(a => a.type === 'deduction').reduce((sum, a) => sum + Number(a.amount), 0);
                                const netPay = selectedPayslipEmp.net_salary;
                                const totalEarnings = selectedPayslipEmp.basic + selectedPayslipEmp.allowance + selectedPayslipEmp.overtime_amount + additionsSum;
                                const totalDeductions = selectedPayslipEmp.lop_deduction + deductionsSum;

                                // Helper for parsing snapshots
                                const salarySnap = snap?.salary_snapshot_json
                                    ? (typeof snap.salary_snapshot_json === 'string' ? JSON.parse(snap.salary_snapshot_json) : snap.salary_snapshot_json)
                                    : null;
                                const calcSnap = snap?.calculation_snapshot_json
                                    ? (typeof snap.calculation_snapshot_json === 'string' ? JSON.parse(snap.calculation_snapshot_json) : snap.calculation_snapshot_json)
                                    : null;

                                // Helper to find days in month
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
                                const dailyRate = selectedPayslipEmp.gross / calendarDays;

                                return (
                                    <>
                                        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                                            {/* employeeMetadata Section */}
                                            <div className="bg-slate-50/50 dark:bg-[#161b22]/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/60 grid grid-cols-2 gap-y-4 gap-x-6">
                                                <div>
                                                    <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Employee</span>
                                                    <span className="text-sm font-extrabold text-slate-800 dark:text-github-dark-text mt-1.5 block leading-none">{selectedPayslipEmp.name}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Department</span>
                                                    <span className="text-sm font-extrabold text-slate-800 dark:text-github-dark-text mt-1.5 block leading-none">{selectedPayslipEmp.department}</span>
                                                </div>
                                                <div className="col-span-2 border-t border-slate-100 dark:border-github-dark-border/40 pt-4 grid grid-cols-2 gap-x-6">
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Designation</span>
                                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-350 mt-1.5 block leading-none">{selectedPayslipEmp.designation}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Payment Method</span>
                                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-350 mt-1.5 block leading-none">Bank Direct Deposit</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* attendanceSummary */}
                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                    Attendance Summary
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {[
                                                        { label: 'Present Days', val: snap?.present_days },
                                                        { label: 'Half Days', val: snap?.half_days },
                                                        { label: 'Absent Days', val: snap?.absent_days },
                                                        { label: 'Paid Leave', val: snap?.paid_leave_days },
                                                        { label: 'Holidays', val: snap?.holiday_days },
                                                        { label: 'Week Offs', val: snap?.weekly_off_days }
                                                    ].map((item, idx) => (
                                                        <div key={idx} className="bg-slate-50/30 dark:bg-[#161b22]/30 border border-slate-100 dark:border-github-dark-border/40 p-3 rounded-xl text-center shadow-sm">
                                                            <span className="block text-[9px] font-bold text-slate-400 dark:text-[#8b949e] uppercase tracking-wider">{item.label}</span>
                                                            <span className="text-sm font-extrabold text-slate-800 dark:text-github-dark-text mt-1.5 block leading-none">
                                                                {Number(item.val || 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* lopDeductionDetails */}
                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                    LOP Deduction Details
                                                </h4>
                                                <div className="bg-slate-50/30 dark:bg-[#161b22]/30 border border-slate-100 dark:border-github-dark-border/40 p-5 rounded-2xl shadow-sm space-y-3 text-xs font-semibold">
                                                    <div className="flex justify-between items-center py-0.5">
                                                        <span className="text-slate-500 dark:text-github-dark-muted">Gross Monthly Salary</span>
                                                        <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                            ₹{Number(selectedPayslipEmp.gross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-0.5">
                                                        <span className="text-slate-500 dark:text-github-dark-muted">Calendar Days</span>
                                                        <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                            {calendarDays} days
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-0.5">
                                                        <span className="text-slate-500 dark:text-github-dark-muted">Daily Rate</span>
                                                        <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                            ₹{Number(dailyRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    <div className="border-t border-slate-100 dark:border-github-dark-border/40 my-2" />
                                                    <div className="flex justify-between items-center py-0.5">
                                                        <span className="text-slate-850 dark:text-github-dark-text font-bold">Total LOP Days</span>
                                                        <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                            {Number(snap?.lop_days || 0).toFixed(2)} days
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-0.5">
                                                        <span className="text-rose-500 font-bold">LOP Deduction Amount</span>
                                                        <span className="font-extrabold text-rose-500">
                                                            ₹{Number(selectedPayslipEmp.lop_deduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* overtimeCalculations */}
                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                    Overtime Calculations
                                                </h4>
                                                <div className="bg-slate-50/30 dark:bg-[#161b22]/30 border border-slate-100 dark:border-github-dark-border/40 p-5 rounded-2xl shadow-sm space-y-3 text-xs font-semibold">
                                                    <div className="flex justify-between items-center py-0.5">
                                                        <span className="text-slate-500 dark:text-github-dark-muted">Overtime Enabled</span>
                                                        <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                            {salarySnap?.overtime_enabled ? 'Yes' : 'No'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-0.5">
                                                        <span className="text-slate-500 dark:text-github-dark-muted">Overtime Rate</span>
                                                        <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                            ₹{Number(salarySnap?.overtime_rate || 0).toLocaleString('en-IN')}/ hr
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-0.5">
                                                        <span className="text-slate-500 dark:text-github-dark-muted">Total Overtime Hours</span>
                                                        <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                            {Number(snap?.overtime_hours || 0).toFixed(2)} hrs
                                                        </span>
                                                    </div>
                                                    <div className="border-t border-slate-100 dark:border-github-dark-border/40 my-2" />
                                                    <div className="flex justify-between items-center py-0.5">
                                                        <span className="text-emerald-500 font-bold">Overtime Allowance Amount</span>
                                                        <span className="font-extrabold text-emerald-500">
                                                            ₹{Number(selectedPayslipEmp.overtime_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* netPayableSalarySummary */}
                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                    Net Payable Salary Summary
                                                </h4>
                                                <div className="bg-slate-50/30 dark:bg-[#161b22]/30 border border-slate-200 dark:border-[#30363d]/80 p-5 rounded-2xl shadow-sm space-y-3 text-xs font-semibold">
                                                    <div className="space-y-2.5 text-slate-700 dark:text-[#c9d1d9]">
                                                        <div className="flex justify-between items-center">
                                                            <span>Gross Salary</span>
                                                            <span className="font-extrabold text-slate-850 dark:text-github-dark-text">
                                                                ₹{Number(selectedPayslipEmp.gross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        
                                                        <div className="flex justify-between items-center text-rose-500">
                                                            <span>Deduction (LOP)</span>
                                                            <span className="font-extrabold">
                                                                -₹{Number(selectedPayslipEmp.lop_deduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>

                                                        {selectedPayslipEmp.pf > 0 && (
                                                            <div className="flex justify-between items-center text-rose-500">
                                                                <span>Deduction (PF)</span>
                                                                <span className="font-extrabold">
                                                                    -₹{Number(selectedPayslipEmp.pf || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {deductionsSum > 0 && (
                                                            <div className="flex justify-between items-center text-rose-500">
                                                                <span>Other Deductions</span>
                                                                <span className="font-extrabold">
                                                                    -₹{Number(deductionsSum || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                                                            <span>Allowance (OT)</span>
                                                            <span className="font-extrabold">
                                                                +₹{Number(selectedPayslipEmp.overtime_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>

                                                        {additionsSum > 0 && (
                                                            <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                                                                <span>Bonus / Additions</span>
                                                                <span className="font-extrabold">
                                                                    +₹{Number(additionsSum || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="border-t border-slate-200 dark:border-github-dark-border/80 pt-3 flex justify-between items-center">
                                                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-github-dark-text">Net Payable Salary</span>
                                                        <span className="text-base font-black text-indigo-650 dark:text-indigo-400">
                                                            ₹{Number(netPay).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Definitions & Guide Section */}
                                            <div className="space-y-3 pt-2">
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                    <HelpCircle size={12} className="text-indigo-500" />
                                                    <span>Glossary & Abbreviations</span>
                                                </div>
                                                <div className="space-y-3 text-[11px] leading-relaxed">
                                                    <div>
                                                        <span className="font-extrabold text-slate-850 dark:text-github-dark-text block">LOP (Loss of Pay)</span>
                                                        <span className="text-slate-500 dark:text-[#8b949e] block">
                                                            Deduction applied for unauthorized absences, excessive lates, or unpaid leave. Calculated as: Gross Salary / Calendar Days.
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="font-extrabold text-slate-855 dark:text-github-dark-text block">OT (Overtime)</span>
                                                        <span className="text-slate-550 dark:text-[#8b949e] block">
                                                            Compensation paid for additional hours worked outside regular shifts. Computed as: OT Hours × OT Rate.
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Drawer Footer */}
                                        <div className="p-6 border-t border-slate-100 dark:border-github-dark-border/80 flex gap-3 shrink-0">
                                            <button
                                                onClick={() => handlePrintPayslip(selectedPayslipEmp)}
                                                className="flex-1 py-3 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold uppercase transition-all shadow-sm flex items-center justify-center gap-1.5"
                                            >
                                                <Printer size={14} />
                                                <span>Print</span>
                                            </button>
                                            <button
                                                onClick={() => setSelectedPayslipEmp(null)}
                                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
};

export default Payroll;
