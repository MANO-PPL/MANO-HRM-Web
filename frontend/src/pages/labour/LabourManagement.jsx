import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { labourService } from '../../services/labourService';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hammer, Plus, Search, Building, Calendar, DollarSign, Clock,
    UserPlus, Edit2, Trash2, Save, AlertTriangle, CheckCircle,
    XCircle, Info, HelpCircle, ChevronRight, User, Phone, Briefcase, X, Upload
} from 'lucide-react';

const LabourManagement = () => {
    // Navigation / Tab state
    const [activeTab, setActiveTab] = useState('sites'); // 'sites', 'directory'
    const [selectedSite, setSelectedSite] = useState(null);
    const [subTab, setSubTab] = useState('attendance'); // 'attendance', 'grid', 'finances'

    // Data States
    const [sites, setSites] = useState([]);
    const [labours, setLabours] = useState([]);
    const [financeSummary, setFinanceSummary] = useState([]);
    const [monthDetails, setMonthDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    // Filter/Search States
    const [siteSearch, setSiteSearch] = useState('');
    const [labourSearch, setLabourSearch] = useState('');
    const [labourSiteFilter, setLabourSiteFilter] = useState('All');

    // Attendance States
    const [attendanceSiteId, setAttendanceSiteId] = useState('');
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceRoster, setAttendanceRoster] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);

    // Monthly Grid States
    const [gridSiteId, setGridSiteId] = useState('');
    const [gridMonth, setGridMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [gridData, setGridData] = useState([]);
    const [gridLoading, setGridLoading] = useState(false);
    const [gridMonthDetails, setGridMonthDetails] = useState(null);
    const [showAllSitesAttendance, setShowAllSitesAttendance] = useState(false);

    // Modal Control States
    const [showSiteModal, setShowSiteModal] = useState(false);
    const [editingSite, setEditingSite] = useState(null);
    const [siteForm, setSiteForm] = useState({ site_name: '', location_details: '', status: 'Active' });

    const [showLabourModal, setShowLabourModal] = useState(false);
    const [editingLabour, setEditingLabour] = useState(null);
    const [labourForm, setLabourForm] = useState({
        name: '', phone: '', sex: 'Male', role: '',
        wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: ''
    });

    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [advanceForm, setAdvanceForm] = useState({ labour_id: '', name: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });

    // Phase 2 States
    const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
    const [bulkSourceSiteId, setBulkSourceSiteId] = useState('All');
    const [bulkDestinationSiteId, setBulkDestinationSiteId] = useState('');
    const [selectedLabourIds, setSelectedLabourIds] = useState([]);

    const [showBorrowModal, setShowBorrowModal] = useState(false);
    const [borrowSearchQuery, setBorrowSearchQuery] = useState('');

    const [selectedHistoryLabour, setSelectedHistoryLabour] = useState(null);
    const [labourHistoryData, setLabourHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [historyTab, setHistoryTab] = useState('sites'); // 'sites', 'payouts'
    const [labourPayoutHistory, setLabourPayoutHistory] = useState([]);
    const [payoutForm, setPayoutForm] = useState({
        payout_id: null, labour_id: '', name: '', month: '', wage_type: '', monthly_salary: '',
        present_days: 0, half_days: 0, absent_days: 0, paid_leaves: 0,
        accrued_credit: 0, advances_taken: 0, net_payable: 0, paid_amount: '',
        status: 'Paid', payment_date: new Date().toISOString().split('T')[0], notes: ''
    });

    const [financeMonth, setFinanceMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const [showSiteClosurePrompt, setShowSiteClosurePrompt] = useState(false);
    const [closureSiteId, setClosureSiteId] = useState('');
    const [closureSiteName, setClosureSiteName] = useState('');
    const [closureDestinationSiteId, setClosureDestinationSiteId] = useState('');
    const [closureLabours, setClosureLabours] = useState([]);
    const [siteStatusToSave, setSiteStatusToSave] = useState('');
    const [siteFormToSave, setSiteFormToSave] = useState(null);

    // Bulk upload states
    const [showBulkLabourModal, setShowBulkLabourModal] = useState(false);
    const [parsedLabours, setParsedLabours] = useState([]);
    const [csvPreviewError, setCsvPreviewError] = useState('');
    const [isUploadingBulk, setIsUploadingBulk] = useState(false);

    // ==========================================
    // DATA FETCHING HANDLERS
    // ==========================================

    const fetchSites = async () => {
        try {
            const data = await labourService.getAllSites();
            setSites(data);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch sites');
        }
    };

    const fetchLabours = async () => {
        try {
            const data = await labourService.getAllLabours();
            setLabours(data);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch labours');
        }
    };

    const fetchFinances = async () => {
        try {
            const res = await labourService.getFinancesSummary(financeMonth ? `${financeMonth}-01` : '');
            setFinanceSummary(res.summary || []);
            setMonthDetails(res.monthDetails || null);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch financial details');
        }
    };

    const fetchGridData = async () => {
        if (!gridSiteId || !gridMonth) return;
        setGridLoading(true);
        try {
            const res = await labourService.getMonthlyGridAttendance(gridSiteId, gridMonth, showAllSitesAttendance);
            setGridData(res.grid || []);
            setGridMonthDetails(res.monthDetails || null);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch monthly grid data');
            setGridData([]);
        }
        setGridLoading(false);
    };

    const loadAttendanceRoster = async () => {
        if (!attendanceSiteId || !attendanceDate) return;
        setAttendanceLoading(true);
        try {
            const res = await labourService.getSiteAttendance(attendanceSiteId, attendanceDate);
            setAttendanceRoster(res.roster || []);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch attendance roster');
            setAttendanceRoster([]);
        }
        setAttendanceLoading(false);
    };

    // Load initial sites and labours
    useEffect(() => {
        const loadInitial = async () => {
            setLoading(true);
            await fetchSites();
            await fetchLabours();
            setLoading(false);
        };
        loadInitial();
    }, []);

    // Sync site select ids when selectedSite changes
    useEffect(() => {
        if (selectedSite) {
            setAttendanceSiteId(selectedSite.site_id.toString());
            setGridSiteId(selectedSite.site_id.toString());
        }
    }, [selectedSite]);

    // Handle nested data dependencies inside clicked site dashboard
    useEffect(() => {
        if (activeTab === 'sites' && selectedSite) {
            if (subTab === 'attendance') {
                loadAttendanceRoster();
            } else if (subTab === 'grid') {
                fetchGridData();
            } else if (subTab === 'finances') {
                fetchFinances();
            }
        }
    }, [attendanceSiteId, attendanceDate, gridSiteId, gridMonth, showAllSitesAttendance, financeMonth, activeTab, selectedSite, subTab]);

    // Bulk upload CSV handlers
    const handleCSVUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            try {
                const parsed = parseLabourCSV(text);
                if (parsed.length === 0) {
                    toast.error("The CSV file seems to be empty or invalid.");
                    return;
                }
                setParsedLabours(parsed);
                setCsvPreviewError('');
            } catch (err) {
                toast.error("Failed to parse CSV file. Please check template format.");
                setCsvPreviewError(err.message);
            }
        };
        reader.readAsText(file);
    };

    const parseLabourCSV = (text) => {
        const lines = text.split(/\r?\n/);
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name');
        const roleIdx = headers.findIndex(h => h.toLowerCase() === 'role');
        const salaryIdx = headers.findIndex(h => h.toLowerCase() === 'monthly salary' || h.toLowerCase() === 'salary');
        const sexIdx = headers.findIndex(h => h.toLowerCase() === 'sex' || h.toLowerCase() === 'gender');
        const phoneIdx = headers.findIndex(h => h.toLowerCase() === 'phone' || h.toLowerCase() === 'mobile');
        const wageTypeIdx = headers.findIndex(h => h.toLowerCase() === 'wage type' || h.toLowerCase() === 'wage_type');
        const siteNameIdx = headers.findIndex(h => h.toLowerCase() === 'site name' || h.toLowerCase() === 'site_name');

        if (nameIdx === -1 || roleIdx === -1 || salaryIdx === -1) {
            throw new Error("Missing required columns: Name, Role, and Monthly Salary must be defined in the header row.");
        }

        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Handle quotes and commas correctly
            const values = [];
            let inQuotes = false;
            let currentVal = '';
            for (let c = 0; c < line.length; c++) {
                const char = line[c];
                if (char === '"' || char === "'") {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentVal.trim());
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim());

            if (values.length === 0 || (values.length === 1 && !values[0])) continue;

            const name = values[nameIdx] || '';
            const role = values[roleIdx] || '';
            const monthly_salary = values[salaryIdx] ? Number(values[salaryIdx]) : NaN;
            const sex = sexIdx !== -1 ? (values[sexIdx] || 'Male') : 'Male';
            const phone = phoneIdx !== -1 ? (values[phoneIdx] || '') : '';
            const wage_type = wageTypeIdx !== -1 ? (values[wageTypeIdx] || 'Daily Wage') : 'Daily Wage';
            const site_name = siteNameIdx !== -1 ? (values[siteNameIdx] || '') : '';

            const isValid = name && role && !isNaN(monthly_salary);

            results.push({
                name,
                role,
                monthly_salary,
                sex,
                phone,
                wage_type,
                site_name,
                isValid
            });
        }
        return results;
    };

    const handleSaveBulkLabours = async () => {
        const validLabours = parsedLabours.filter(l => l.isValid);
        if (validLabours.length === 0) {
            toast.error("No valid labour rows to import.");
            return;
        }
        setIsUploadingBulk(true);
        try {
            await labourService.bulkCreateLabours(validLabours);
            toast.success(`Successfully imported ${validLabours.length} workers.`);
            setShowBulkLabourModal(false);
            setParsedLabours([]);
            // Refresh local labours list
            await fetchLabours();
        } catch (err) {
            toast.error(err.message || "Failed to bulk create labours.");
        }
        setIsUploadingBulk(false);
    };

    const downloadCSVTemplate = () => {
        const headers = ['Name', 'Phone', 'Sex', 'Role', 'Wage Type', 'Monthly Salary', 'Site Name'];
        const sampleRow = ['Ramesh Kumar', '9876543210', 'Male', 'Mason', 'Daily Wage', '15000', ''];
        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), sampleRow.join(',')].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "labour_bulk_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ==========================================
    // SITE HANDLERS
    // ==========================================

    const handleSaveSite = async (e) => {
        e.preventDefault();
        try {
            if (editingSite) {
                // If status is changed from Active to Completed or Inactive, check for active labours
                const statusChanged = editingSite.status === 'Active' && (siteForm.status === 'Completed' || siteForm.status === 'Inactive');
                const siteLabours = statusChanged ? labours.filter(l => l.site_id === editingSite.site_id) : [];

                if (statusChanged && siteLabours.length > 0) {
                    setClosureSiteId(editingSite.site_id);
                    setClosureSiteName(editingSite.site_name);
                    setClosureLabours(siteLabours);
                    setSiteStatusToSave(siteForm.status);
                    setSiteFormToSave({ ...siteForm });
                    setShowSiteModal(false);
                    setClosureDestinationSiteId('');
                    setShowSiteClosurePrompt(true);
                    return;
                }

                await labourService.updateSite(editingSite.site_id, siteForm);
                toast.success('Site updated successfully');
            } else {
                await labourService.createSite(siteForm);
                toast.success('Site created successfully');
            }
            setShowSiteModal(false);
            setEditingSite(null);
            setSiteForm({ site_name: '', location_details: '', status: 'Active' });
            fetchSites();
        } catch (err) {
            toast.error(err.message || 'Failed to save site');
        }
    };

    const handleConfirmSiteClosure = async (e) => {
        e.preventDefault();
        try {
            const labourIdsToTransfer = closureLabours.map(l => l.labour_id);
            await labourService.bulkTransferLabours({
                source_site_id: closureSiteId,
                destination_site_id: closureDestinationSiteId ? Number(closureDestinationSiteId) : null,
                labour_ids: labourIdsToTransfer
            });

            await labourService.updateSite(closureSiteId, siteFormToSave);
            toast.success(`Site status updated. Transferred ${labourIdsToTransfer.length} workers.`);
            setShowSiteClosurePrompt(false);
            setEditingSite(null);
            setSiteForm({ site_name: '', location_details: '', status: 'Active' });
            fetchSites();
            fetchLabours();
        } catch (err) {
            toast.error(err.message || 'Failed during site closure reassignment');
        }
    };

    const handleExecuteBulkTransfer = async (e) => {
        e.preventDefault();
        if (selectedLabourIds.length === 0) {
            toast.error('Please select at least one worker to transfer');
            return;
        }
        try {
            await labourService.bulkTransferLabours({
                source_site_id: bulkSourceSiteId === 'All' ? null : Number(bulkSourceSiteId),
                destination_site_id: bulkDestinationSiteId === 'Unassigned' || !bulkDestinationSiteId ? null : Number(bulkDestinationSiteId),
                labour_ids: selectedLabourIds
            });
            toast.success(`Successfully transferred ${selectedLabourIds.length} workers.`);
            setShowBulkTransferModal(false);
            setSelectedLabourIds([]);
            fetchLabours();
        } catch (err) {
            toast.error(err.message || 'Failed to transfer workers');
        }
    };

    const handleViewHistory = async (lab) => {
        setSelectedHistoryLabour(lab);
        setHistoryTab('sites');
        setHistoryLoading(true);
        try {
            const res = await labourService.getLabourWorkHistory(lab.labour_id);
            setLabourHistoryData(res.history || []);
            setLabourPayoutHistory(res.payouts || []);
        } catch (err) {
            toast.error(err.message || 'Failed to load work history');
        }
        setHistoryLoading(false);
    };

    const handleBorrowLabour = (lab) => {
        setAttendanceRoster(prev => [
            ...prev,
            {
                labour_id: lab.labour_id,
                name: lab.name,
                role: lab.role,
                wage_type: lab.wage_type,
                status: '',
                is_borrowed: true
            }
        ]);
        setShowBorrowModal(false);
        setBorrowSearchQuery('');
        toast.success(`${lab.name} added to today's daily checklist`);
    };

    const handleEditSite = (site) => {
        setEditingSite(site);
        setSiteForm({
            site_name: site.site_name,
            location_details: site.location_details || '',
            status: site.status
        });
        setShowSiteModal(true);
    };

    const handleDeleteSite = async (siteId) => {
        if (!window.confirm('Are you sure you want to delete this site? assigned labours will be unassigned.')) return;
        try {
            await labourService.deleteSite(siteId);
            toast.success('Site deleted successfully');
            fetchSites();
        } catch (err) {
            toast.error(err.message || 'Failed to delete site');
        }
    };

    // ==========================================
    // LABOUR HANDLERS
    // ==========================================

    const handleSaveLabour = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...labourForm,
                monthly_salary: Number(labourForm.monthly_salary),
                allowed_leaves: 0,
                site_id: labourForm.site_id ? Number(labourForm.site_id) : null
            };

            if (editingLabour) {
                await labourService.updateLabour(editingLabour.labour_id, payload);
                toast.success('Labour profile updated successfully');
            } else {
                await labourService.createLabour(payload);
                toast.success('Labour profile created successfully');
            }
            setShowLabourModal(false);
            setEditingLabour(null);
            setLabourForm({
                name: '', phone: '', sex: 'Male', role: '',
                wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: ''
            });
            fetchLabours();
        } catch (err) {
            toast.error(err.message || 'Failed to save labour worker');
        }
    };

    const handleEditLabour = (lab) => {
        setEditingLabour(lab);
        setLabourForm({
            name: lab.name,
            phone: lab.phone || '',
            sex: lab.sex || 'Male',
            role: lab.role,
            wage_type: lab.wage_type,
            monthly_salary: lab.monthly_salary,
            allowed_leaves: lab.allowed_leaves?.toString() || '0',
            site_id: lab.site_id?.toString() || ''
        });
        setShowLabourModal(true);
    };

    const handleDeleteLabour = async (labourId) => {
        if (!window.confirm('Are you sure you want to delete this labour worker? All history will be deleted.')) return;
        try {
            await labourService.deleteLabour(labourId);
            toast.success('Labour deleted successfully');
            fetchLabours();
        } catch (err) {
            toast.error(err.message || 'Failed to delete labour worker');
        }
    };

    // ==========================================
    // ATTENDANCE HANDLERS
    // ==========================================

    const handleStatusChange = (labourId, newStatus) => {
        setAttendanceRoster(prev =>
            prev.map(item => item.labour_id === labourId ? { ...item, status: newStatus } : item)
        );
    };

    const handleSaveAttendance = async () => {
        try {
            await labourService.saveSiteAttendance(attendanceSiteId, attendanceDate, attendanceRoster);
            toast.success('Daily attendance checklist saved successfully!');
            loadAttendanceRoster();
        } catch (err) {
            toast.error(err.message || 'Failed to save attendance roster');
        }
    };

    const getDaysInMonthArray = () => {
        if (!gridMonth) return [];
        const [yr, mo] = gridMonth.split('-');
        const year = Number(yr);
        const monthNum = Number(mo);
        const daysCount = new Date(year, monthNum, 0).getDate();

        const arr = [];
        for (let d = 1; d <= daysCount; d++) {
            const dateObj = new Date(year, monthNum - 1, d);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3).toUpperCase();
            arr.push({
                dayNum: d,
                dayName,
                dateStr: `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            });
        }
        return arr;
    };

    const getMonthNameAndYear = (startDateStr) => {
        if (!startDateStr) return '';
        const date = new Date(startDateStr);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    };

    // ==========================================
    // FINANCES HANDLERS
    // ==========================================

    const handleOpenAdvance = (labour) => {
        setAdvanceForm({
            labour_id: labour.labour_id,
            name: labour.name,
            amount: '',
            date: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setShowAdvanceModal(true);
    };

    const handleSaveAdvance = async (e) => {
        e.preventDefault();
        try {
            await labourService.logLabourAdvance({
                labour_id: Number(advanceForm.labour_id),
                amount: Number(advanceForm.amount),
                date: advanceForm.date,
                notes: advanceForm.notes
            });
            toast.success(`Advance logged successfully for ${advanceForm.name}`);
            setShowAdvanceModal(false);
            fetchFinances();
        } catch (err) {
            toast.error(err.message || 'Failed to log advance payment');
        }
    };

    const handleOpenPayout = (row) => {
        const monthKey = monthDetails?.start ? monthDetails.start.slice(0, 7) : new Date().toISOString().slice(0, 7);
        const isExisting = !!row.payout;

        setPayoutForm({
            payout_id: isExisting ? row.payout.payout_id : null,
            labour_id: row.labour_id,
            name: row.name,
            month: monthKey,
            wage_type: row.wage_type,
            monthly_salary: row.monthly_salary,
            present_days: row.attendance.present,
            half_days: row.attendance.half_day,
            absent_days: row.attendance.absent,
            paid_leaves: row.attendance.paid_leave || 0,
            accrued_credit: row.accrued_credit,
            advances_taken: row.advances_taken,
            net_payable: row.net_payable,
            paid_amount: isExisting ? row.payout.paid_amount : row.net_payable,
            status: isExisting ? row.payout.status : 'Paid',
            payment_date: isExisting ? row.payout.payment_date.split('T')[0] : new Date().toISOString().split('T')[0],
            notes: isExisting ? row.payout.notes || '' : ''
        });
        setShowPayoutModal(true);
    };

    const handleSavePayout = async (e) => {
        e.preventDefault();
        try {
            await labourService.logLabourPayout({
                labour_id: Number(payoutForm.labour_id),
                month: payoutForm.month,
                wage_type: payoutForm.wage_type,
                monthly_salary: Number(payoutForm.monthly_salary),
                present_days: Number(payoutForm.present_days),
                half_days: Number(payoutForm.half_days),
                absent_days: Number(payoutForm.absent_days),
                paid_leaves: Number(payoutForm.paid_leaves),
                accrued_credit: Number(payoutForm.accrued_credit),
                advances_taken: Number(payoutForm.advances_taken),
                net_payable: Number(payoutForm.net_payable),
                paid_amount: Number(payoutForm.paid_amount),
                status: payoutForm.status,
                payment_date: payoutForm.payment_date,
                notes: payoutForm.notes
            });
            toast.success(`Payout successfully processed for ${payoutForm.name}`);
            setShowPayoutModal(false);
            fetchFinances();
        } catch (err) {
            toast.error(err.message || 'Failed to log monthly payout');
        }
    };

    // ==========================================
    // RENDERING
    // ==========================================

    return (
        <DashboardLayout title="Labour Management">
            <div className="space-y-6">

                {/* Upper tab switcher */}
                <div className="flex bg-[#f6f8fa] dark:bg-[#161b22] p-1 rounded-xl border border-[#d0d7de] dark:border-[#30363d] w-fit select-none">
                    {[
                        { id: 'sites', label: 'Sites Overview', icon: <Building size={14} /> },
                        { id: 'directory', label: 'Labour Force Directory', icon: <User size={14} /> }
                    ].map((tab) => {
                        const isSelected = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${isSelected
                                        ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Main Content Pane */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Clock className="animate-spin text-indigo-500" size={32} />
                        <span className="text-xs text-slate-500 font-medium">Fetching details...</span>
                    </div>
                ) : (
                    <>
                        {/* ==========================================
                            TAB 1: SITES OVERVIEW & DRILL-DOWN DETAILS
                            ========================================== */}
                        {activeTab === 'sites' && (
                            selectedSite === null ? (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="flex justify-between items-center bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm">
                                        <div>
                                            <h3 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">Project Construction Sites</h3>
                                            <p className="text-slate-450 dark:text-github-dark-muted text-[11px] mt-0.5">Manage building sites and click a site to access its daily attendance roll call, matrix grid, and salary ledger.</p>
                                        </div>
                                        <button
                                            onClick={() => { setEditingSite(null); setSiteForm({ site_name: '', location_details: '', status: 'Active' }); setShowSiteModal(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                                        >
                                            <Plus size={14} />
                                            <span>Create Site</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {sites.length === 0 ? (
                                            <div className="col-span-full border border-dashed border-slate-300 dark:border-github-dark-border rounded-xl p-10 text-center">
                                                <Building className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={32} />
                                                <h4 className="text-xs font-bold text-slate-500">No Construction Sites Found</h4>
                                                <p className="text-[10px] text-slate-400 mt-1">Create a site first to start assigning labour forces.</p>
                                            </div>
                                        ) : (
                                            sites.map(site => (
                                                <div
                                                    key={site.site_id}
                                                    onClick={() => setSelectedSite(site)}
                                                    className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl p-4 shadow-sm hover:shadow hover:border-indigo-500 transition-all flex flex-col justify-between h-40 cursor-pointer group"
                                                >
                                                    <div>
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{site.site_name}</h4>
                                                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${site.status === 'Active'
                                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                    : site.status === 'Completed'
                                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                                }`}>
                                                                {site.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-505 dark:text-github-dark-muted mt-2 min-h-[3em] line-clamp-2">
                                                            {site.location_details || 'No location details registered.'}
                                                        </p>
                                                    </div>

                                                    <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-github-dark-border/40 text-xs">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-slate-400 dark:text-github-dark-muted text-[10px]">
                                                                Created {new Date(site.created_at).toLocaleDateString()}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400">
                                                                👥 {labours.filter(l => l.site_id === site.site_id).length} Assigned
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEditSite(site); }}
                                                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-github-dark-border"
                                                            >
                                                                <Edit2 size={12} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteSite(site.site_id); }}
                                                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded border border-slate-200 dark:border-github-dark-border"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Click-to-drill-down site details dashboard */
                                <div className="space-y-6 animate-in fade-in duration-200">
                                    <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <button
                                                onClick={() => setSelectedSite(null)}
                                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mb-1.5"
                                            >
                                                &larr; Back to Sites Overview
                                            </button>
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-extrabold text-base text-slate-800 dark:text-github-dark-text">{selectedSite.site_name}</h3>
                                                <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${selectedSite.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                        : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {selectedSite.status}
                                                </span>
                                            </div>
                                            <p className="text-slate-450 dark:text-github-dark-muted text-[11px] mt-0.5">{selectedSite.location_details || 'No location details registered.'}</p>
                                        </div>
                                        <div className="flex bg-[#f6f8fa] dark:bg-[#161b22] p-0.5 rounded-lg border border-[#d0d7de]/70 dark:border-[#30363d]/60 w-fit select-none shrink-0 shadow-inner">
                                            {[
                                                { id: 'attendance', label: 'Daily Roll Call', icon: <Calendar size={13} /> },
                                                { id: 'grid', label: 'Monthly Matrix', icon: <Calendar size={13} /> },
                                                { id: 'finances', label: 'Salary Ledger', icon: <DollarSign size={13} /> }
                                            ].map((tab) => {
                                                const isSelected = subTab === tab.id;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setSubTab(tab.id)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 cursor-pointer ${isSelected
                                                                ? 'bg-white dark:bg-slate-800 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                                                : 'text-slate-505 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                            }`}
                                                    >
                                                        {tab.icon}
                                                        <span>{tab.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Component Renders (filtered for this site) */}
                                    {subTab === 'attendance' && (
                                        <div className="space-y-4 animate-in fade-in duration-150">
                                            <div className="flex justify-between items-center bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm">
                                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                                    <div className="flex flex-col gap-1 w-full">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400">Roster Attendance Date</label>
                                                        <input
                                                            type="date"
                                                            value={attendanceDate}
                                                            onChange={(e) => setAttendanceDate(e.target.value)}
                                                            className="px-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {attendanceLoading ? (
                                                <div className="flex justify-center py-20">
                                                    <Clock className="animate-spin text-indigo-500" size={28} />
                                                </div>
                                            ) : (
                                                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                                                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center bg-slate-50/50 dark:bg-github-dark-border/10">
                                                        <div>
                                                            <span className="font-bold text-xs text-slate-800 dark:text-github-dark-text">Daily Roll Call Checklist</span>
                                                            <span className="ml-2 text-[10px] text-slate-450 dark:text-github-dark-muted font-mono">{attendanceRoster.length} workers registered</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setShowBorrowModal(true)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer border border-[#d0d7de] dark:border-[#30363d]"
                                                            >
                                                                <Plus size={14} />
                                                                <span>Borrow Worker</span>
                                                            </button>
                                                            <button
                                                                onClick={handleSaveAttendance}
                                                                disabled={attendanceRoster.length === 0}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                                                            >
                                                                <Save size={14} />
                                                                <span>Save Roster</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left border-collapse text-xs">
                                                            <thead>
                                                                <tr className="bg-slate-50/50 dark:bg-github-dark-border/20 text-slate-450 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                                    <th className="p-3">Worker Name</th>
                                                                    <th className="p-3">Role / Designation</th>
                                                                    <th className="p-3">Wage Model</th>
                                                                    <th className="p-3 text-center">Status Assignment</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {attendanceRoster.length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan="4" className="p-10 text-center text-slate-400 italic">No labours assigned to this site. Assign labours in Labour Force Directory.</td>
                                                                    </tr>
                                                                ) : (
                                                                    attendanceRoster.map(item => (
                                                                        <tr key={item.labour_id} className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-slate-50/20 dark:hover:bg-slate-800/10 relative">
                                                                            <td className="p-3 font-semibold text-slate-800 dark:text-github-dark-text">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span>{item.name}</span>
                                                                                    {item.is_borrowed && (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-extrabold text-[8px] uppercase tracking-wider">Borrowed</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="p-3 text-slate-650 dark:text-slate-400">{item.role}</td>
                                                                            <td className="p-3">
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.wage_type === 'Fixed Salary'
                                                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                                                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                                    }`}>
                                                                                    {item.wage_type}
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-3">
                                                                                <div className="flex justify-center items-center gap-2">
                                                                                    {[
                                                                                        { id: 'Present', label: 'Present (Full Day)', activeColor: 'bg-emerald-500 text-white dark:bg-emerald-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' },
                                                                                        { id: 'Half Day', label: 'Half Day', activeColor: 'bg-amber-500 text-white dark:bg-amber-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' },
                                                                                        { id: 'Absent', label: 'Absent', activeColor: 'bg-rose-500 text-white dark:bg-rose-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' },
                                                                                        { id: 'Paid Leave', label: 'Paid Leave', activeColor: 'bg-indigo-500 text-white dark:bg-indigo-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' }
                                                                                    ].map(statusOpt => {
                                                                                        const isSelected = item.status === statusOpt.id;
                                                                                        return (
                                                                                            <button
                                                                                                key={statusOpt.id}
                                                                                                onClick={() => handleStatusChange(item.labour_id, statusOpt.id)}
                                                                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-150 cursor-pointer ${isSelected ? statusOpt.activeColor + ' shadow-sm' : statusOpt.inactiveColor
                                                                                                    }`}
                                                                                            >
                                                                                                {statusOpt.label}
                                                                                            </button>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {subTab === 'grid' && (
                                        <div className="space-y-4 animate-in fade-in duration-150">
                                            <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm">
                                                <div className="flex-1 flex flex-col gap-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400">Roster Month</label>
                                                    <input
                                                        type="month"
                                                        value={gridMonth}
                                                        onChange={(e) => setGridMonth(e.target.value)}
                                                        className="px-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex-1 flex items-center pt-4">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={showAllSitesAttendance}
                                                            onChange={(e) => setShowAllSitesAttendance(e.target.checked)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 dark:bg-github-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-none after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                                        <span className="ml-3 text-xs font-semibold text-slate-600 dark:text-github-dark-text">Include attendance logged for other sites</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {gridLoading ? (
                                                <div className="flex justify-center py-20">
                                                    <Clock className="animate-spin text-indigo-500" size={28} />
                                                </div>
                                            ) : (
                                                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                                                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#010409]/40 flex justify-between items-center">
                                                        <span className="font-bold text-xs text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Attendance Grid Matrix</span>
                                                        {gridMonthDetails && (
                                                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase font-mono">
                                                                {getMonthNameAndYear(gridMonthDetails.month + "-01")}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="overflow-x-auto custom-scrollbar">
                                                        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                                            <thead>
                                                                <tr className="bg-slate-50/40 dark:bg-github-dark-border/20 border-b border-slate-200 dark:border-github-dark-border font-bold text-slate-400">
                                                                    <th className="p-3 sticky left-0 bg-white dark:bg-[#0d1117] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-200 dark:border-github-dark-border">Worker Name / Designation</th>
                                                                    {getDaysInMonthArray().map(day => (
                                                                        <th key={day.dateStr} className="p-2 text-center min-w-[36px]">
                                                                            <div className="flex flex-col items-center">
                                                                                <span className="text-[8px] font-bold text-slate-400">{day.dayName}</span>
                                                                                <span className="text-[9px] font-black text-slate-700 dark:text-github-dark-text mt-0.5">{day.dayNum}</span>
                                                                            </div>
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {gridData.length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan={getDaysInMonthArray().length + 1} className="p-10 text-center text-slate-400 italic">No attendance matrix records found for this site.</td>
                                                                    </tr>
                                                                ) : (
                                                                    gridData.map(row => (
                                                                        <tr key={row.labour_id} className="border-b border-slate-150 dark:border-github-dark-border/40">
                                                                            <td className="p-3 sticky left-0 bg-white dark:bg-[#0d1117] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-200 dark:border-github-dark-border">
                                                                                <div className="font-bold text-slate-800 dark:text-github-dark-text text-[11px]">{row.name}</div>
                                                                                <div className="text-[9px] text-slate-400 dark:text-github-dark-muted font-mono mt-0.5">{row.role}</div>
                                                                            </td>
                                                                            {getDaysInMonthArray().map(day => {
                                                                                const attObj = row.attendance[day.dateStr];
                                                                                const statusStr = attObj && typeof attObj === 'object' ? attObj.status : attObj;
                                                                                const attSiteId = attObj && typeof attObj === 'object' ? attObj.site_id : null;
                                                                                const attSiteName = attObj && typeof attObj === 'object' ? attObj.site_name : null;

                                                                                const isOtherSite = attSiteId !== null && Number(attSiteId) !== Number(selectedSite.site_id);
                                                                                const tooltipText = isOtherSite
                                                                                    ? `${statusStr} (at ${attSiteName})`
                                                                                    : (attSiteName ? `${statusStr} (at ${attSiteName})` : statusStr);

                                                                                const dateObj = new Date(day.dateStr);
                                                                                const dayNum = dateObj.getDay();
                                                                                let cellContent = null;

                                                                                if (statusStr === 'Present') {
                                                                                    cellContent = isOtherSite ? (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-455 border border-emerald-300 dark:border-emerald-850/50 text-[8px] font-black shadow-sm" title={tooltipText}>P</span>
                                                                                    ) : (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[8px] font-black shadow-sm" title={tooltipText}>P</span>
                                                                                    );
                                                                                } else if (statusStr === 'Half Day') {
                                                                                    cellContent = isOtherSite ? (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-50/90 dark:bg-amber-950/40 text-amber-600 dark:text-amber-455 border border-amber-300 dark:border-amber-850/50 text-[8px] font-black shadow-sm" title={tooltipText}>HD</span>
                                                                                    ) : (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[8px] font-black shadow-sm" title={tooltipText}>HD</span>
                                                                                    );
                                                                                } else if (statusStr === 'Absent') {
                                                                                    cellContent = isOtherSite ? (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-rose-50/90 dark:bg-rose-950/40 text-rose-600 dark:text-rose-455 border border-rose-300 dark:border-rose-850/50 text-[8px] font-black shadow-sm" title={tooltipText}>A</span>
                                                                                    ) : (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[8px] font-black shadow-sm" title={tooltipText}>A</span>
                                                                                    );
                                                                                } else if (statusStr === 'Paid Leave') {
                                                                                    cellContent = isOtherSite ? (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-455 border border-indigo-300 dark:border-indigo-850/50 text-[8px] font-black shadow-sm" title={tooltipText}>PL</span>
                                                                                    ) : (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-500 text-white text-[8px] font-black shadow-sm" title={tooltipText}>PL</span>
                                                                                    );
                                                                                } else if (dayNum === 6) { // Saturday
                                                                                    cellContent = (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[8px] font-bold">SA</span>
                                                                                    );
                                                                                } else if (dayNum === 0) { // Sunday
                                                                                    cellContent = (
                                                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-[#161b22] text-slate-500 dark:text-slate-400 text-[8px] font-bold">SU</span>
                                                                                    );
                                                                                } else {
                                                                                    cellContent = (
                                                                                        <span className="text-slate-350 dark:text-slate-650">-</span>
                                                                                    );
                                                                                }

                                                                                return (
                                                                                    <td key={day.dateStr} className="p-2 text-center align-middle">
                                                                                        <div className="flex justify-center items-center">
                                                                                            {cellContent}
                                                                                        </div>
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    ))
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {subTab === 'finances' && (
                                        <div className="space-y-4 animate-in fade-in duration-150">
                                            <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm justify-between items-center">
                                                <div className="flex flex-col gap-1 w-full sm:w-auto">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400">Payroll Month</label>
                                                    <input
                                                        type="month"
                                                        value={financeMonth}
                                                        onChange={(e) => setFinanceMonth(e.target.value)}
                                                        className="px-3 py-1.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-bold text-slate-700 dark:text-github-dark-text focus:outline-none"
                                                    />
                                                </div>
                                                {monthDetails && (
                                                    <div className="bg-slate-100 dark:bg-github-dark-border/40 p-2.5 rounded-lg border border-slate-200/50 dark:border-[#30363d] text-[10px] font-bold text-slate-600 dark:text-[#f0f6fc] font-mono">
                                                        🗓️ {getMonthNameAndYear(monthDetails.start)} PERIOD | DAYS ELAPSED {monthDetails.elapsedDays} OF {monthDetails.totalDays}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                                                <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#010409]/40 flex justify-between items-center">
                                                    <span className="font-bold text-xs text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Salary credit Ledger (Filtered for {selectedSite.site_name})</span>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                                        <thead>
                                                            <tr className="bg-slate-50/50 dark:bg-github-dark-border/20 text-slate-450 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                                <th className="p-3">Worker Details</th>
                                                                <th className="p-3">Wage Type</th>
                                                                <th className="p-3 text-center">Attendance Counts</th>
                                                                <th className="p-3">Accrued Credit</th>
                                                                <th className="p-3">Advances Taken</th>
                                                                <th className="p-3">Net Payable</th>
                                                                <th className="p-3 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {financeSummary.filter(row => row.site_id === selectedSite.site_id).length === 0 ? (
                                                                <tr>
                                                                    <td colSpan="7" className="p-10 text-center text-slate-400 italic">No salary ledger details for workers on this site this month.</td>
                                                                </tr>
                                                            ) : (
                                                                financeSummary
                                                                    .filter(row => row.site_id === selectedSite.site_id)
                                                                    .map(row => {
                                                                        const advanceAlert = row.advances_taken > row.accrued_credit;
                                                                        return (
                                                                            <tr key={row.labour_id} className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-slate-50/20 dark:hover:bg-slate-800/10">
                                                                                <td className="p-3">
                                                                                    <div className="font-bold text-slate-800 dark:text-github-dark-text">{row.name}</div>
                                                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.role}</div>
                                                                                </td>
                                                                                <td className="p-3">
                                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.wage_type === 'Fixed Salary'
                                                                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                                                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                                        }`}>
                                                                                        {row.wage_type}
                                                                                    </span>
                                                                                    <div className="text-[10px] text-slate-450 dark:text-slate-400 mt-1">Base: ₹{row.monthly_salary.toLocaleString()}</div>
                                                                                </td>
                                                                                <td className="p-3 text-center font-bold text-slate-655 dark:text-slate-350">
                                                                                    <div className="flex items-center justify-center gap-1.5 font-mono text-[10px]">
                                                                                        <span className="text-emerald-600 dark:text-emerald-400" title="Present">{row.attendance.present}P</span>
                                                                                        <span>/</span>
                                                                                        <span className="text-amber-500" title="Half Days">{row.attendance.half_day}HD</span>
                                                                                        <span>/</span>
                                                                                        <span className="text-indigo-500" title="Paid Leaves">{row.attendance.paid_leave}PL</span>
                                                                                        <span>/</span>
                                                                                        <span className="text-rose-500" title="Absent">{row.attendance.absent}A</span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">₹{row.accrued_credit.toLocaleString()}</td>
                                                                                <td className={`p-3 font-semibold ${advanceAlert ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span>₹{row.advances_taken.toLocaleString()}</span>
                                                                                        {advanceAlert && <AlertTriangle size={12} className="text-rose-500 animate-pulse" title="Advances exceed earned credit" />}
                                                                                    </div>
                                                                                </td>
                                                                                <td className={`p-3 font-extrabold text-xs ${row.net_payable < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-650 dark:text-indigo-400'}`}>
                                                                                    ₹{row.net_payable.toLocaleString()}
                                                                                </td>
                                                                                <td className="p-3 text-right">
                                                                                    <div className="flex justify-end items-center gap-2">
                                                                                        {row.payout ? (
                                                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${row.payout.status === 'Paid'
                                                                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450 border border-emerald-250/30'
                                                                                                    : 'bg-amber-50 text-amber-600 dark:bg-amber-955/20 dark:text-amber-450 border border-amber-250/30'
                                                                                                }`}>
                                                                                                <span>{row.payout.status}</span>
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-205">
                                                                                                <span>Unprocessed</span>
                                                                                            </span>
                                                                                        )}
                                                                                        <button
                                                                                            onClick={() => handleOpenAdvance(row)}
                                                                                            className="px-2.5 py-1 text-[10px] font-black bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/35 text-amber-705 dark:text-amber-400 hover:bg-amber-100 rounded transition-all cursor-pointer"
                                                                                        >
                                                                                            Advance
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleOpenPayout(row)}
                                                                                            className={`px-2.5 py-1 text-[10px] font-black rounded border transition-all cursor-pointer ${row.payout
                                                                                                    ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                                                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                                                                                                }`}
                                                                                        >
                                                                                            {row.payout ? 'Payout Rec' : 'Release Salary'}
                                                                                        </button>
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
                                </div>
                            )
                        )}

                        {/* ==========================================
                            TAB 2: LABOUR FORCE DIRECTORY
                            ========================================== */}
                        {activeTab === 'directory' && (
                            <div className="space-y-4 pt-2 animate-in fade-in duration-200">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm">
                                    <div>
                                        <h3 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">Labour Force Directory</h3>
                                        <p className="text-slate-450 dark:text-github-dark-muted text-[11px] mt-0.5">Manage details, site assignments, monthly payouts, and logs for construction workers.</p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                        <div className="relative w-full sm:w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search labour by name or role..."
                                                value={labourSearch}
                                                onChange={(e) => setLabourSearch(e.target.value)}
                                                className="pl-9 pr-4 py-1.5 w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none"
                                            />
                                        </div>
                                        <select
                                            value={labourSiteFilter}
                                            onChange={(e) => setLabourSiteFilter(e.target.value)}
                                            className="px-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-700 dark:text-github-dark-text cursor-pointer"
                                        >
                                            <option value="All">All Sites</option>
                                            <option value="Unassigned">Unassigned</option>
                                            {sites.map(s => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedLabourIds([]);
                                                setBulkSourceSiteId('All');
                                                setBulkDestinationSiteId('');
                                                setShowBulkTransferModal(true);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all border border-[#d0d7de] dark:border-[#30363d]"
                                        >
                                            <Building size={14} />
                                            <span>Bulk Transfer</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setParsedLabours([]);
                                                setCsvPreviewError('');
                                                setShowBulkLabourModal(true);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                                        >
                                            <Upload size={14} />
                                            <span>Bulk Add Labours</span>
                                        </button>
                                        <button
                                            onClick={() => { setEditingLabour(null); setLabourForm({ name: '', phone: '', sex: 'Male', role: '', wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '' }); setShowLabourModal(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                                        >
                                            <UserPlus size={14} />
                                            <span>Add Labour Worker</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-github-dark-border/40 text-slate-450 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                <th className="p-3">Labour Name</th>
                                                <th className="p-3">Role / Designation</th>
                                                <th className="p-3">Assigned Site</th>
                                                <th className="p-3">Wage Model</th>
                                                <th className="p-3">Monthly Salary</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {labours
                                                .filter(lab => {
                                                    const matchesSearch = lab.name.toLowerCase().includes(labourSearch.toLowerCase()) ||
                                                        lab.role.toLowerCase().includes(labourSearch.toLowerCase());

                                                    let matchesSite = true;
                                                    if (labourSiteFilter === 'Unassigned') {
                                                        matchesSite = lab.site_id === null;
                                                    } else if (labourSiteFilter !== 'All') {
                                                        matchesSite = lab.site_id === Number(labourSiteFilter);
                                                    }

                                                    return matchesSearch && matchesSite;
                                                })
                                                .map(lab => (
                                                    <tr key={lab.labour_id} className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                                                        <td className="p-3 font-semibold text-slate-800 dark:text-github-dark-text cursor-pointer hover:text-indigo-650 dark:hover:text-indigo-400" onClick={() => handleViewHistory(lab)}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span>{lab.name}</span>
                                                                <Info size={12} className="text-slate-400" />
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{lab.phone || 'No phone'} | {lab.sex}</div>
                                                        </td>
                                                        <td className="p-3 text-slate-650 dark:text-slate-400">{lab.role}</td>
                                                        <td className="p-3 text-slate-650 dark:text-slate-400">
                                                            {lab.site_name ? (
                                                                <span className="flex items-center gap-1">
                                                                    <Building size={12} className="text-slate-400" />
                                                                    {lab.site_name}
                                                                </span>
                                                            ) : (
                                                                <span className="text-amber-500 italic">Unassigned</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lab.wage_type === 'Fixed Salary'
                                                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-955/20 dark:text-emerald-400'
                                                                }`}>
                                                                {lab.wage_type}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-medium text-slate-705 dark:text-slate-300">
                                                            ₹{Number(lab.monthly_salary).toLocaleString()}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex justify-end gap-1.5">
                                                                <button
                                                                    onClick={() => handleEditLabour(lab)}
                                                                    className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-505 rounded border border-slate-200 dark:border-github-dark-border"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteLabour(lab.labour_id)}
                                                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-955/20 text-red-500 rounded border border-slate-202 dark:border-github-dark-border"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ==========================================
                    SLIDE-OVER DRAWERS (PORTALS)
                    ========================================== */}
                    {/* DRAWERS: SITE FORM */}
                    {createPortal(
                        <AnimatePresence>
                            {showSiteModal && (
                                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowSiteModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">
                                            {editingSite ? 'Edit Construction Site' : 'Create Construction Site'}
                                        </h4>
                                        <p className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted mt-0.5 tracking-wider uppercase">Site Configuration Profile</p>
                                    </div>
                                    <button onClick={() => setShowSiteModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                </div>
                                <form onSubmit={handleSaveSite} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar">
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-2">Site Name</label>
                                        <input
                                            type="text"
                                            value={siteForm.site_name}
                                            onChange={(e) => setSiteForm({ ...siteForm, site_name: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            required
                                            placeholder="e.g., Phoenix Mall Project"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-2">Location Details / Address</label>
                                        <textarea
                                            value={siteForm.location_details}
                                            onChange={(e) => setSiteForm({ ...siteForm, location_details: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            rows={4}
                                            placeholder="Site physical address, gate number, coordinates, or notes."
                                        />
                                    </div>
                                    {editingSite && (
                                        <div>
                                            <label className="block text-slate-450 font-semibold mb-2">Status</label>
                                            <select
                                                value={siteForm.status}
                                                onChange={(e) => setSiteForm({ ...siteForm, status: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                        <button
                                            type="button"
                                            onClick={() => setShowSiteModal(false)}
                                            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-all"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: LABOUR FORM */}
                    {createPortal(
                        <AnimatePresence>
                            {showLabourModal && (
                                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowLabourModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">
                                            {editingLabour ? 'Edit Labour Profile' : 'Add New Labour Worker'}
                                        </h4>
                                        <p className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted mt-0.5 tracking-wider uppercase">Worker Configuration Profile</p>
                                    </div>
                                    <button onClick={() => setShowLabourModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                </div>
                                <form onSubmit={handleSaveLabour} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Labour Full Name</label>
                                        <input
                                            type="text"
                                            value={labourForm.name}
                                            onChange={(e) => setLabourForm({ ...labourForm, name: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            required
                                            placeholder="e.g., Ramesh Kumar"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Contact Phone</label>
                                        <input
                                            type="tel"
                                            value={labourForm.phone}
                                            onChange={(e) => setLabourForm({ ...labourForm, phone: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            placeholder="10-digit mobile number"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Sex</label>
                                        <select
                                            value={labourForm.sex}
                                            onChange={(e) => setLabourForm({ ...labourForm, sex: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none cursor-pointer focus:border-indigo-500"
                                        >
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Role</label>
                                        <input
                                            type="text"
                                            value={labourForm.role}
                                            onChange={(e) => setLabourForm({ ...labourForm, role: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            required
                                            placeholder="e.g., Mason, Carpenter, Helper"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Assign Construction Site</label>
                                        <select
                                            value={labourForm.site_id}
                                            onChange={(e) => setLabourForm({ ...labourForm, site_id: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none cursor-pointer focus:border-indigo-500"
                                        >
                                            <option value="">Unassigned / Independent</option>
                                            {sites.map(s => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Wage Model</label>
                                        <select
                                            value={labourForm.wage_type}
                                            onChange={(e) => setLabourForm({ ...labourForm, wage_type: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none cursor-pointer focus:border-indigo-500"
                                        >
                                            <option value="Daily Wage">Daily Wage (strictly pro-rated)</option>
                                            <option value="Fixed Salary">Fixed Monthly Salary</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Monthly Salary (INR)</label>
                                        <input
                                            type="number"
                                            value={labourForm.monthly_salary}
                                            onChange={(e) => setLabourForm({ ...labourForm, monthly_salary: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            required
                                            min="0"
                                            placeholder="e.g., 25000"
                                        />
                                    </div>
                                    {editingLabour && (
                                        <div>
                                            <label className="block text-slate-450 font-semibold mb-1">Status</label>
                                            <select
                                                value={labourForm.status}
                                                onChange={(e) => setLabourForm({ ...labourForm, status: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-205 dark:border-github-dark-border rounded-lg focus:outline-none cursor-pointer focus:border-indigo-500"
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                        <button
                                            type="button"
                                            onClick={() => setShowLabourModal(false)}
                                            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 text-slate-505 rounded-lg font-bold transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-all"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: LOG ADVANCE */}
                    {createPortal(
                        <AnimatePresence>
                            {showAdvanceModal && (
                                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowAdvanceModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                                    <div className="flex items-center gap-1.5">
                                        <DollarSign size={16} className="text-amber-500" />
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">Log Salary Advance</h4>
                                    </div>
                                    <button onClick={() => setShowAdvanceModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                </div>
                                <form onSubmit={handleSaveAdvance} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                    <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded-lg text-slate-600 dark:text-slate-350">
                                        Logging salary advance for <strong>{advanceForm.name}</strong>. This amount will be automatically deducted from their next payroll payout credit.
                                    </div>
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Advance Amount (INR)</label>
                                        <input
                                            type="number"
                                            value={advanceForm.amount}
                                            onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            required
                                            min="1"
                                            placeholder="e.g., 2000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Logging Date</label>
                                        <input
                                            type="date"
                                            value={advanceForm.date}
                                            onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-455 font-semibold mb-1">Notes / Description</label>
                                        <input
                                            type="text"
                                            value={advanceForm.notes}
                                            onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            placeholder="e.g., Festival Advance, Medical emergency"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvanceModal(false)}
                                            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-sm transition-all"
                                        >
                                            Record Payment
                                        </button>
                                    </div>
                                </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: LOG PAYOUT */}
                    {createPortal(
                        <AnimatePresence>
                            {showPayoutModal && (
                                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowPayoutModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                                    <div className="flex items-center gap-1.5">
                                        <DollarSign size={16} className="text-indigo-500" />
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">{payoutForm.payout_id ? 'Update Monthly Payout' : 'Process Monthly Payout'}</h4>
                                    </div>
                                    <button onClick={() => setShowPayoutModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                </div>
                                <form onSubmit={handleSavePayout} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                    <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/40 p-3 rounded-lg text-slate-600 dark:text-slate-350 space-y-1">
                                        <div>Processing salary payout for <strong>{payoutForm.name}</strong></div>
                                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">Wage Type: {payoutForm.wage_type} | Month: {payoutForm.month}</div>
                                    </div>

                                    {/* Earnings Summary Grid */}
                                    <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-[#161b22] p-3 rounded-lg border border-slate-150 dark:border-github-dark-border text-[11px]">
                                        <div className="space-y-0.5">
                                            <div className="text-slate-400">Attendance:</div>
                                            <div className="font-bold text-slate-700 dark:text-slate-300">
                                                {payoutForm.present_days}P / {payoutForm.half_days}HD / {payoutForm.absent_days}A / {payoutForm.paid_leaves}PL
                                            </div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="text-slate-405">Accrued Credit:</div>
                                            <div className="font-bold text-slate-700 dark:text-slate-300">₹{payoutForm.accrued_credit.toLocaleString()}</div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="text-slate-405">Advances Taken:</div>
                                            <div className="font-bold text-amber-600 dark:text-amber-505">-₹{payoutForm.advances_taken.toLocaleString()}</div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="text-slate-455 font-bold">Net Payable:</div>
                                            <div className="font-extrabold text-indigo-650 dark:text-indigo-400 text-xs">₹{payoutForm.net_payable.toLocaleString()}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-slate-450 font-semibold mb-1">Paid Amount (INR)</label>
                                            <input
                                                type="number"
                                                value={payoutForm.paid_amount}
                                                onChange={(e) => setPayoutForm({ ...payoutForm, paid_amount: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-205 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                                required
                                                min="0"
                                                placeholder="e.g. 15000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-450 font-semibold mb-1">Payout Status</label>
                                            <select
                                                value={payoutForm.status}
                                                onChange={(e) => setPayoutForm({ ...payoutForm, status: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                                            >
                                                <option value="Paid">Paid</option>
                                                <option value="Pending">Pending</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1">Payment Date</label>
                                        <input
                                            type="date"
                                            value={payoutForm.payment_date}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, payment_date: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-205 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-455 font-semibold mb-1">Notes / Payment Details</label>
                                        <input
                                            type="text"
                                            value={payoutForm.notes}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:border-indigo-500"
                                            placeholder="e.g. Paid via Bank Transfer, Ref# 9812739"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                        <button
                                            type="button"
                                            onClick={() => setShowPayoutModal(false)}
                                            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-all"
                                        >
                                            {payoutForm.payout_id ? 'Update Payout' : 'Release Payment'}
                                        </button>
                                    </div>
                                </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: BULK TRANSFER */}
                    {createPortal(
                        <AnimatePresence>
                            {showBulkTransferModal && (
                                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowBulkTransferModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                                    <div className="flex items-center gap-1.5">
                                        <Building size={16} className="text-indigo-500" />
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">Bulk Transfer Workers</h4>
                                    </div>
                                    <button onClick={() => setShowBulkTransferModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                </div>
                                <form onSubmit={handleExecuteBulkTransfer} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-slate-455 font-semibold mb-1">Source Site (Filter)</label>
                                            <select
                                                value={bulkSourceSiteId}
                                                onChange={(e) => {
                                                    setBulkSourceSiteId(e.target.value);
                                                    setSelectedLabourIds([]); // reset selection
                                                }}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-205 dark:border-github-dark-border rounded-lg focus:outline-none cursor-pointer focus:border-indigo-500"
                                            >
                                                <option value="All">All Sites</option>
                                                <option value="Unassigned">Unassigned</option>
                                                {sites.map(s => (
                                                    <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-slate-455 font-semibold mb-1">Destination Site</label>
                                            <select
                                                value={bulkDestinationSiteId}
                                                onChange={(e) => setBulkDestinationSiteId(e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-205 dark:border-github-dark-border rounded-lg focus:outline-none cursor-pointer focus:border-indigo-500"
                                                required
                                            >
                                                <option value="">-- Choose New Project Site --</option>
                                                <option value="Unassigned">Unassigned / Independent</option>
                                                {sites.map(s => (
                                                    <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <div className="flex justify-between items-center text-slate-450 font-semibold">
                                            <span>Select Workers to Move</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const filtered = labours.filter(lab => {
                                                        if (bulkSourceSiteId === 'Unassigned') return lab.site_id === null;
                                                        if (bulkSourceSiteId !== 'All') return lab.site_id === Number(bulkSourceSiteId);
                                                        return true;
                                                    });
                                                    if (selectedLabourIds.length === filtered.length) {
                                                        setSelectedLabourIds([]);
                                                    } else {
                                                        setSelectedLabourIds(filtered.map(l => l.labour_id));
                                                    }
                                                }}
                                                className="text-indigo-650 hover:underline font-bold"
                                            >
                                                Select / Deselect All
                                            </button>
                                        </div>

                                        <div className="border border-slate-200 dark:border-github-dark-border rounded-lg max-h-56 overflow-y-auto p-2.5 bg-slate-50 dark:bg-[#161b22]/40 divide-y divide-slate-100 dark:divide-github-dark-border/40 custom-scrollbar">
                                            {labours
                                                .filter(lab => {
                                                    if (bulkSourceSiteId === 'Unassigned') return lab.site_id === null;
                                                    if (bulkSourceSiteId !== 'All') return lab.site_id === Number(bulkSourceSiteId);
                                                    return true;
                                                })
                                                .map(lab => (
                                                    <label key={lab.labour_id} className="flex items-center gap-2 py-2 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/20 px-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLabourIds.includes(lab.labour_id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedLabourIds(prev => [...prev, lab.labour_id]);
                                                                } else {
                                                                    setSelectedLabourIds(prev => prev.filter(id => id !== lab.labour_id));
                                                                }
                                                            }}
                                                            className="rounded text-indigo-650 cursor-pointer"
                                                        />
                                                        <div>
                                                            <span className="font-semibold text-slate-800 dark:text-[#f0f6fc]">{lab.name}</span>
                                                            <span className="ml-2 text-[10px] text-slate-450 font-mono">({lab.role} | {lab.site_name || 'Unassigned'})</span>
                                                        </div>
                                                    </label>
                                                ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                        <button
                                            type="button"
                                            onClick={() => setShowBulkTransferModal(false)}
                                            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-505 rounded-lg font-bold transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={selectedLabourIds.length === 0}
                                            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-sm transition-all"
                                        >
                                            Transfer {selectedLabourIds.length} Workers
                                        </button>
                                    </div>
                                </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: BORROW WORKER */}
                    {createPortal(
                        <AnimatePresence>
                            {showBorrowModal && (
                                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowBorrowModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-202 dark:border-[#30363d] z-10"
                            >
                                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                                    <div className="flex items-center gap-1.5">
                                        <Plus size={16} className="text-indigo-500" />
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">Borrow Worker for Today</h4>
                                    </div>
                                    <button onClick={() => setShowBorrowModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search worker by name or designation..."
                                            value={borrowSearchQuery}
                                            onChange={(e) => setBorrowSearchQuery(e.target.value)}
                                            className="pl-9 pr-4 py-2 w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    <div className="border border-slate-200 dark:border-github-dark-border rounded-lg max-h-[60vh] overflow-y-auto p-1 bg-slate-50 dark:bg-[#161b22]/40 divide-y divide-slate-100 dark:divide-github-dark-border/40 custom-scrollbar">
                                        {labours
                                            .filter(lab => {
                                                const isAlreadyInRoster = attendanceRoster.some(r => r.labour_id === lab.labour_id);
                                                const matchesSearch = lab.name.toLowerCase().includes(borrowSearchQuery.toLowerCase()) ||
                                                    lab.role.toLowerCase().includes(borrowSearchQuery.toLowerCase());
                                                return !isAlreadyInRoster && matchesSearch && lab.status === 'Active';
                                            })
                                            .map(lab => (
                                                <div
                                                    key={lab.labour_id}
                                                    onClick={() => handleBorrowLabour(lab)}
                                                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-[#161b22] transition-colors"
                                                >
                                                    <div>
                                                        <span className="font-bold text-slate-805 dark:text-[#f0f6fc] block">{lab.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{lab.role} | Default: {lab.site_name || 'Independent'}</span>
                                                    </div>
                                                    <button className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/35 text-indigo-650 dark:text-indigo-400 rounded text-[10px] font-black cursor-pointer">
                                                        Select
                                                    </button>
                                                </div>
                                            ))}
                                        {labours.filter(lab => {
                                            const isAlreadyInRoster = attendanceRoster.some(r => r.labour_id === lab.labour_id);
                                            const matchesSearch = lab.name.toLowerCase().includes(borrowSearchQuery.toLowerCase()) ||
                                                lab.role.toLowerCase().includes(borrowSearchQuery.toLowerCase());
                                            return !isAlreadyInRoster && matchesSearch && lab.status === 'Active';
                                        }).length === 0 && (
                                                <div className="p-8 text-center text-slate-400 italic">No borrowable workers found.</div>
                                            )}
                                    </div>
                                </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: SITE CLOSURE REASSIGNMENT PROMPT */}
                    {createPortal(
                        <AnimatePresence>
                            {showSiteClosurePrompt && (
                                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowSiteClosurePrompt(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-github-dark-border bg-amber-500/10 text-amber-800 dark:text-amber-450">
                                    <div className="flex items-center gap-1.5">
                                        <AlertTriangle size={18} />
                                        <h4 className="font-bold text-sm uppercase tracking-wider">Site Closure Reassignment</h4>
                                    </div>
                                    <button onClick={() => setShowSiteClosurePrompt(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                </div>
                                <form onSubmit={handleConfirmSiteClosure} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                    <div className="text-slate-600 dark:text-slate-350 space-y-2">
                                        <p>
                                            You are marking the site <strong>{closureSiteName}</strong> as <strong>{siteStatusToSave}</strong>.
                                        </p>
                                        <p>
                                            There are currently <strong>{closureLabours.length} active workers</strong> assigned to this site. Please choose a new construction site to transfer them to:
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-slate-455 font-semibold mb-1">Select Destination Site</label>
                                        <select
                                            value={closureDestinationSiteId}
                                            onChange={(e) => setClosureDestinationSiteId(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-205 dark:border-github-dark-border rounded-lg focus:outline-none cursor-pointer focus:border-indigo-500"
                                        >
                                            <option value="">Leave Unassigned / Independent</option>
                                            {sites
                                                .filter(s => s.site_id !== Number(closureSiteId) && s.status === 'Active')
                                                .map(s => (
                                                    <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                                ))}
                                        </select>
                                    </div>

                                    <div className="border border-slate-200 dark:border-github-dark-border rounded-lg max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-[#161b22]/40 custom-scrollbar">
                                        <span className="block text-[9px] font-bold text-slate-455 uppercase mb-1">Affected Workers:</span>
                                        <ul className="list-disc pl-4 space-y-1 font-semibold">
                                            {closureLabours.map(l => (
                                                <li key={l.labour_id} className="text-slate-700 dark:text-slate-300">{l.name} <span className="text-[10px] text-slate-400 font-normal">({l.role})</span></li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                        <button
                                            type="button"
                                            onClick={() => setShowSiteClosurePrompt(false)}
                                            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-505 rounded-lg font-bold transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-all"
                                        >
                                            Transfer & Complete
                                        </button>
                                    </div>
                                </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: WORK HISTORY & INSIGHTS */}
                    {createPortal(
                        <AnimatePresence>
                            {selectedHistoryLabour && (
                                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setSelectedHistoryLabour(null)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-w-lg h-full bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col justify-between z-10"
                            >
                                <div className="p-5 border-b border-slate-100 dark:border-github-dark-border flex justify-between items-center bg-slate-50/30 dark:bg-[#010409]/40">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">{selectedHistoryLabour.name}</h4>
                                        <p className="text-[10px] text-slate-450 dark:text-github-dark-muted font-mono uppercase mt-0.5">Work History & Insights | {selectedHistoryLabour.role}</p>
                                    </div>
                                    <button onClick={() => setSelectedHistoryLabour(null)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={20} /></button>
                                </div>

                                <div className="flex-1 p-5 overflow-y-auto space-y-6 text-xs custom-scrollbar">
                                    {historyLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-2">
                                            <Clock className="animate-spin text-indigo-500" size={24} />
                                            <span className="text-[10px] text-slate-400">Loading history...</span>
                                        </div>
                                    ) : labourHistoryData.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 italic">No historical attendance logged for this worker.</div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-slate-50 dark:bg-github-dark-border/20 p-3 rounded-xl border border-slate-100 dark:border-github-dark-border/40">
                                                    <span className="block text-[10px] text-slate-405 uppercase font-bold mb-1">Total Engagements</span>
                                                    <span className="text-lg font-black text-slate-800 dark:text-github-dark-text">{labourHistoryData.length} Sites</span>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-github-dark-border/20 p-3 rounded-xl border border-slate-100 dark:border-github-dark-border/40">
                                                    <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Total Days Logged</span>
                                                    <span className="text-lg font-black text-indigo-650 dark:text-indigo-400">
                                                        {labourHistoryData.reduce((acc, curr) => acc + curr.total_days, 0)} Days
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex bg-[#f6f8fa] dark:bg-[#161b22] p-1 rounded-lg border border-[#d0d7de] dark:border-[#30363d] select-none">
                                                <button
                                                    type="button"
                                                    onClick={() => setHistoryTab('sites')}
                                                    className={`flex-1 text-center py-1.5 font-bold rounded-md transition-all cursor-pointer ${historyTab === 'sites'
                                                            ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-github-dark-text shadow-sm'
                                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                                        }`}
                                                >
                                                    Site Timeline
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setHistoryTab('payouts')}
                                                    className={`flex-1 text-center py-1.5 font-bold rounded-md transition-all cursor-pointer ${historyTab === 'payouts'
                                                            ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-github-dark-text shadow-sm'
                                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                                        }`}
                                                >
                                                    Salary & Payout History
                                                </button>
                                            </div>

                                            {historyTab === 'sites' ? (
                                                <div className="space-y-4">
                                                    <h5 className="font-bold text-slate-700 dark:text-github-dark-text uppercase tracking-wider text-[10px]">Site Wise Timeline</h5>
                                                    <div className="space-y-3">
                                                        {labourHistoryData.map((siteLog) => {
                                                            const attendanceRate = siteLog.total_days > 0
                                                                ? Math.round(((siteLog.present_days + siteLog.paid_leave_days + (0.5 * siteLog.half_day_days)) / siteLog.total_days) * 100)
                                                                : 0;

                                                            return (
                                                                <div key={siteLog.site_id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm hover:border-slate-350 dark:hover:border-github-dark-border-strong transition-all">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div>
                                                                            <h6 className="font-bold text-xs text-slate-805 dark:text-github-dark-text">{siteLog.site_name || 'Unassigned'}</h6>
                                                                            <span className="text-[9px] text-slate-400 font-mono">
                                                                                {new Date(siteLog.first_date).toLocaleDateString()} to {new Date(siteLog.last_date).toLocaleDateString()}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">{attendanceRate}% Active</span>
                                                                    </div>

                                                                    <div className="grid grid-cols-4 gap-1.5 text-center mt-3 pt-3 border-t border-slate-100 dark:border-github-dark-border/40 text-[9px] font-bold">
                                                                        <div className="bg-emerald-50 dark:bg-emerald-955/10 p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400">
                                                                            <span className="block text-[8px] uppercase text-slate-400 font-medium">Present</span>
                                                                            {siteLog.present_days}
                                                                        </div>
                                                                        <div className="bg-amber-50 dark:bg-amber-955/10 p-1.5 rounded-lg text-amber-600 dark:text-amber-550 font-bold">
                                                                            <span className="block text-[8px] uppercase text-slate-400 font-medium">Half Day</span>
                                                                            {siteLog.half_day_days}
                                                                        </div>
                                                                        <div className="bg-indigo-50 dark:bg-indigo-955/10 p-1.5 rounded-lg text-indigo-650 dark:text-indigo-400">
                                                                            <span className="block text-[8px] uppercase text-slate-400 font-medium">Paid L.</span>
                                                                            {siteLog.paid_leave_days}
                                                                        </div>
                                                                        <div className="bg-rose-50 dark:bg-rose-955/10 p-1.5 rounded-lg text-rose-600 dark:text-rose-455">
                                                                            <span className="block text-[8px] uppercase text-slate-400 font-medium">Absent</span>
                                                                            {siteLog.absent_days}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <h5 className="font-bold text-slate-705 dark:text-github-dark-text uppercase tracking-wider text-[10px]">Logged Payroll Payouts</h5>
                                                    <div className="space-y-3">
                                                        {labourPayoutHistory.length === 0 ? (
                                                            <div className="text-center py-10 text-slate-400 italic text-[11px]">No logged salary payouts found.</div>
                                                        ) : (
                                                            labourPayoutHistory.map((payout) => (
                                                                <div key={payout.payout_id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm hover:border-slate-350 dark:hover:border-github-dark-border-strong transition-all space-y-2">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">{getMonthNameAndYear(payout.month + "-01")}</span>
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${payout.status === 'Paid'
                                                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                                : 'bg-amber-50 text-amber-600 dark:bg-[#2c1f00] dark:text-amber-400'
                                                                            }`}>
                                                                            {payout.status}
                                                                        </span>
                                                                    </div>

                                                                    <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-slate-100 dark:border-github-dark-border/40 text-[10px] font-mono">
                                                                        <div>
                                                                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Earned</span>
                                                                            ₹{payout.accrued_credit}
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Deductions</span>
                                                                            -₹{payout.advances_taken}
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-455 block text-[9px] uppercase font-bold">Paid Sum</span>
                                                                            ₹{payout.paid_amount}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                                                        <span>Method: {payout.notes || 'Unspecified'}</span>
                                                                        <span>{new Date(payout.payment_date).toLocaleDateString()}</span>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="p-5 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#010409]/40 flex justify-end shrink-0">
                                    <button onClick={() => setSelectedHistoryLabour(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold">Close Insights</button>
                                </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: BULK LABOUR UPLOAD */}
                    {createPortal(
                        <AnimatePresence>
                            {showBulkLabourModal && (
                                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowBulkLabourModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-w-2xl h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                                    <div className="flex items-center gap-1.5">
                                        <Upload size={16} className="text-indigo-500" />
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">Bulk Add Labours</h4>
                                    </div>
                                    <button onClick={() => setShowBulkLabourModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar">
                                    {parsedLabours.length === 0 ? (
                                        <div className="space-y-4">
                                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/40 p-4 rounded-xl text-slate-600 dark:text-slate-350 space-y-2">
                                                <h5 className="font-bold text-slate-850 dark:text-white">Instructions & Template</h5>
                                                <p>Upload a CSV file containing your labour profiles. The columns must include:</p>
                                                <ul className="list-disc pl-4 space-y-1 font-mono text-[10px]">
                                                    <li><strong>Name</strong> (Required)</li>
                                                    <li><strong>Role</strong> (Required, e.g. Mason, Carpenter)</li>
                                                    <li><strong>Monthly Salary</strong> (Required, e.g. 15000)</li>
                                                    <li><strong>Phone</strong> (Optional, 10 digit number)</li>
                                                    <li><strong>Sex</strong> (Optional, Male/Female, defaults to Male)</li>
                                                    <li><strong>Wage Type</strong> (Optional, "Daily Wage" or "Fixed Salary")</li>
                                                    <li><strong>Site Name</strong> (Optional, matches existing construction site name)</li>
                                                </ul>
                                                <div className="pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={downloadCSVTemplate}
                                                        className="px-3 py-1.5 bg-indigo-650 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                                    >
                                                        Download CSV Template
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="border-2 border-dashed border-slate-300 dark:border-github-dark-border rounded-xl p-8 text-center bg-slate-50 dark:bg-[#161b22]/30 flex flex-col items-center justify-center gap-3">
                                                <Upload className="text-slate-400" size={32} />
                                                <div>
                                                    <label className="cursor-pointer text-indigo-650 dark:text-indigo-400 hover:underline font-bold">
                                                        Upload CSV File
                                                        <input
                                                            type="file"
                                                            accept=".csv"
                                                            onChange={handleCSVUpload}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                    <p className="text-[10px] text-slate-400 mt-1">Accepts .csv format up to 5MB</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center bg-slate-50 dark:bg-[#161b22] p-3 rounded-lg border border-slate-200 dark:border-github-dark-border">
                                                <div>
                                                    <span className="font-bold text-slate-805 dark:text-white">Parsed Workers Preview</span>
                                                    <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-0.5">
                                                        Found {parsedLabours.length} rows. {parsedLabours.filter(l => l.isValid).length} are valid and ready to import.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setParsedLabours([])}
                                                    className="text-slate-500 hover:text-red-500 hover:underline font-bold"
                                                >
                                                    Clear & Upload New
                                                </button>
                                            </div>

                                            <div className="border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden shadow-sm">
                                                <div className="overflow-x-auto max-h-96 custom-scrollbar">
                                                    <table className="w-full text-left border-collapse text-[11px]">
                                                        <thead>
                                                            <tr className="bg-slate-50 dark:bg-github-dark-border/40 text-slate-450 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                                <th className="p-2.5">Status</th>
                                                                <th className="p-2.5">Name</th>
                                                                <th className="p-2.5">Role</th>
                                                                <th className="p-2.5">Salary (INR)</th>
                                                                <th className="p-2.5">Wage Type</th>
                                                                <th className="p-2.5">Site Name</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {parsedLabours.map((row, idx) => (
                                                                <tr key={idx} className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                                                                    <td className="p-2.5">
                                                                        {row.isValid ? (
                                                                            <CheckCircle size={14} className="text-emerald-500" />
                                                                        ) : (
                                                                            <AlertTriangle size={14} className="text-rose-500" title="Missing required fields" />
                                                                        )}
                                                                    </td>
                                                                    <td className={`p-2.5 font-bold ${row.isValid ? 'text-slate-800 dark:text-github-dark-text' : 'text-slate-400 line-through'}`}>{row.name || 'Unnamed'}</td>
                                                                    <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.role || <span className="text-rose-500">Missing</span>}</td>
                                                                    <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                                                        {isNaN(row.monthly_salary) ? <span className="text-rose-500">Missing</span> : `₹${row.monthly_salary}`}
                                                                    </td>
                                                                    <td className="p-2.5 text-slate-500">{row.wage_type}</td>
                                                                    <td className="p-2.5 text-slate-500">{row.site_name || <span className="italic text-slate-400">Unassigned</span>}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setParsedLabours([])}
                                                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-505 rounded-lg font-bold transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveBulkLabours}
                                                    disabled={isUploadingBulk || parsedLabours.filter(l => l.isValid).length === 0}
                                                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-sm transition-all"
                                                >
                                                    {isUploadingBulk ? 'Importing...' : `Import ${parsedLabours.filter(l => l.isValid).length} Workers`}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
            </div>
        </DashboardLayout>
    );
};

export default LabourManagement;
