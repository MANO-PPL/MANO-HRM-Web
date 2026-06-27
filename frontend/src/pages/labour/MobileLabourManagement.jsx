import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { labourService } from '../../services/labourService';
import { toast } from 'react-toastify';
import {
    Building, Calendar, DollarSign, Clock, Plus, Search,
    UserPlus, Edit2, Trash2, Save, AlertTriangle, User, Phone, X,
    CheckCircle, XCircle, Upload, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MinimalSelect from '../../components/MinimalSelect';
import MobileDatePicker from '../../components/MobileDatePicker';
import MonthPicker from '../../components/MonthPicker';

const getStatusColor = (status) => {
    const s = status || '';
    if (!s || s === '-') return 'bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-700 border border-slate-200 dark:border-slate-800';
    if (s === 'Present' || s.includes('Present')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50';
    if (s === 'Absent') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800/50';
    if (s.toLowerCase().includes('late') && s.toLowerCase().includes('overtime')) return 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800/50';
    if (s.toLowerCase().includes('late')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50';
    if (s.toLowerCase().includes('overtime')) return 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-800/50';
    if (s === 'Sun' || s === 'Sat' || s === 'SU' || s === 'SA' || s === 'Sunday' || s === 'Saturday') return 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500';
    if (s.toLowerCase() === 'on leave' || s.toLowerCase() === 'paid leave') return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800/50';
    if (s.toLowerCase() === 'half day') return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800/50';
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
};

const getStatusLabel = (status) => {
    const s = status || '';
    if (!s || s === '-') return '·';
    if (s === 'Present') return 'P';
    if (s === 'Absent') return 'A';
    if (s === 'Sun' || s === 'SU' || s === 'Sunday') return 'Su';
    if (s === 'Sat' || s === 'SA' || s === 'Saturday') return 'Sa';
    if (s.toLowerCase() === 'on leave') return 'L';
    if (s.toLowerCase() === 'paid leave') return 'PL';
    if (s.toLowerCase() === 'half day') return 'HD';
    if (s.toLowerCase().includes('late') && s.toLowerCase().includes('overtime')) return 'LO';
    if (s.toLowerCase().includes('late')) return 'Lt';
    if (s.toLowerCase().includes('overtime')) return 'OT';
    return s.slice(0, 2);
};

const MobileLabourManagement = () => {
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
    const [financeRoleFilter, setFinanceRoleFilter] = useState('');
    const [gridRoleFilter, setGridRoleFilter] = useState('');
    const [labourRoleFilter, setLabourRoleFilter] = useState('');
    const [attendanceRoleFilter, setAttendanceRoleFilter] = useState('');

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

    // Custom Confirmation Dialog State
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    });

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
            const res = await labourService.getMonthlyGridAttendance(gridSiteId, gridMonth, false);
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
            toast.error(err.message || 'Failed to fetch roster');
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
    }, [attendanceSiteId, attendanceDate, gridSiteId, gridMonth, financeMonth, activeTab, selectedSite, subTab]);

    // Bulk upload CSV/Excel handlers for Mobile
    const handleCSVUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        setIsUploadingBulk(true);
        try {
            const parsed = await labourService.parseBulkLabours(formData);
            if (parsed.length === 0) {
                toast.error("The file seems to be empty or invalid.");
                return;
            }
            setParsedLabours(parsed);
            setCsvPreviewError('');
        } catch (err) {
            toast.error(err.message || "Failed to parse file. Please check template format.");
            setCsvPreviewError(err.message);
        }
        setIsUploadingBulk(false);
    };

    const handleSaveBulkLabours = async () => {
        const validLabours = parsedLabours.filter(l => l.isValid);
        if (validLabours.length === 0) {
            toast.error("No valid labour rows.");
            return;
        }
        setIsUploadingBulk(true);
        try {
            await labourService.bulkCreateLabours(validLabours);
            toast.success(`Successfully imported ${validLabours.length} workers.`);
            setShowBulkLabourModal(false);
            setParsedLabours([]);
            await fetchLabours();
        } catch (err) {
            toast.error(err.message || "Failed to bulk create.");
        }
        setIsUploadingBulk(false);
    };

    const downloadCSVTemplate = async () => {
        try {
            const data = await labourService.downloadBulkTemplate();
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "labour_bulk_upload_template.xlsx");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            toast.error(err.message || "Failed to download template.");
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
                toast.success('Site updated');
            } else {
                await labourService.createSite(siteForm);
                toast.success('Site created');
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
            toast.error('Select at least one worker to transfer');
            return;
        }
        try {
            await labourService.bulkTransferLabours({
                source_site_id: bulkSourceSiteId === 'All' ? null : Number(bulkSourceSiteId),
                destination_site_id: bulkDestinationSiteId === 'Unassigned' || !bulkDestinationSiteId ? null : Number(bulkDestinationSiteId),
                labour_ids: selectedLabourIds
            });
            toast.success(`Transferred ${selectedLabourIds.length} workers.`);
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
            toast.error(err.message || 'Failed to load history');
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

    const handleDeleteSite = (siteId) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Construction Site',
            message: 'Are you sure you want to delete this site? Assigned workers will be unassigned.',
            onConfirm: async () => {
                try {
                    await labourService.deleteSite(siteId);
                    toast.success('Site deleted successfully');
                    fetchSites();
                } catch (err) {
                    toast.error(err.message || 'Failed to delete site');
                }
            }
        });
    };

    // ==========================================
    // LABOUR HANDLERS
    // ==========================================

    const handleSaveLabour = async (e) => {
        e.preventDefault();
        try {
            const cleanPhone = labourForm.phone ? labourForm.phone.trim().replace(/[\s\-()]/g, '') : '';
            if (cleanPhone) {
                const phoneRegex = /^(?:\+91|91)?[6-9]\d{9}$/;
                if (!phoneRegex.test(cleanPhone)) {
                    toast.error('Please enter a valid 10-digit contact number (e.g. 9876543210)');
                    return;
                }
            }

            const payload = {
                ...labourForm,
                phone: cleanPhone || null,
                monthly_salary: Number(labourForm.monthly_salary),
                allowed_leaves: 0,
                site_id: labourForm.site_id ? Number(labourForm.site_id) : null
            };

            if (editingLabour) {
                await labourService.updateLabour(editingLabour.labour_id, payload);
                toast.success('Worker updated');
            } else {
                await labourService.createLabour(payload);
                toast.success('Worker added');
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

    const handleDeleteLabour = (labourId) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Worker Profile',
            message: 'Are you sure you want to delete this labour worker? All history and data will be permanently deleted.',
            onConfirm: async () => {
                try {
                    await labourService.deleteLabour(labourId);
                    toast.success('Worker deleted successfully');
                    fetchLabours();
                } catch (err) {
                    toast.error(err.message || 'Failed to delete worker');
                }
            }
        });
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
            toast.success('Daily attendance checklist saved!');
            loadAttendanceRoster();
        } catch (err) {
            toast.error(err.message || 'Failed to save attendance roster');
        }
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
            toast.success(`Advance logged for ${advanceForm.name}`);
            setShowAdvanceModal(false);
            fetchFinances();
        } catch (err) {
            toast.error(err.message || 'Failed to log advance');
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

    return (
        <MobileDashboardLayout title="Labour Management">
            <div className="space-y-4 pb-24 text-xs">

                {/* Status Tabs - Pill Style */}
                <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1 flex rounded-xl border border-slate-200 dark:border-github-dark-border/50 sticky top-16 z-20">
                    {[
                        { id: 'sites', label: 'Sites Overview' },
                        { id: 'directory', label: 'Labour Directory' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2 text-[10px] font-semibold rounded-lg transition-all ${activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 dark:text-github-dark-muted'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'sites' && selectedSite !== null && (
                    <div className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-450 dark:text-slate-500 px-1 select-none animate-in fade-in duration-200">
                        <span className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors" onClick={() => setSelectedSite(null)}>Sites Overview</span>
                        <ChevronRight size={10} className="text-slate-350 dark:text-slate-700" />
                        <span className="text-slate-700 dark:text-github-dark-text font-bold truncate max-w-[150px]">{selectedSite.site_name}</span>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Clock className="animate-spin text-indigo-500" size={24} />
                        <span className="text-[10px] text-slate-400">Loading data...</span>
                    </div>
                ) : (
                    <>
                        {/* ==========================================
                            TAB 1: SITES OVERVIEW & SITE DETAIL DASHBOARD
                            ========================================== */}
                        {activeTab === 'sites' && (
                            selectedSite === null ? (
                                <div className="space-y-4 animate-in fade-in duration-150">
                                    <div className="flex justify-between items-center bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3 rounded-xl shadow-sm">
                                        <span className="font-bold text-slate-700 dark:text-white">Active Projects</span>
                                        <button
                                            onClick={() => { setEditingSite(null); setSiteForm({ site_name: '', location_details: '', status: 'Active' }); setShowSiteModal(true); }}
                                            className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-1 text-[10px]"
                                        >
                                            <Plus size={12} /> Add Site
                                        </button>
                                    </div>

                                    {sites.length === 0 ? (
                                        <div className="p-10 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 bg-white dark:bg-github-dark-subtle">
                                            No construction sites found.
                                        </div>
                                    ) : (
                                        sites.map(site => (
                                            <div
                                                key={site.site_id}
                                                onClick={() => setSelectedSite(site)}
                                                className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3.5 rounded-xl flex flex-col justify-between gap-2 shadow-sm cursor-pointer hover:border-indigo-500 transition-all"
                                            >
                                                <div>
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="font-bold text-xs text-slate-800 dark:text-white">{site.site_name}</h4>
                                                        <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full uppercase ${site.status === 'Active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-github-dark-muted'
                                                            }`}>
                                                            {site.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 dark:text-github-dark-muted mt-1">{site.location_details || 'No details.'}</p>
                                                    <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                                                        👥 {labours.filter(l => l.site_id === site.site_id).length} Assigned Workers
                                                    </span>
                                                </div>
                                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-github-dark-border/40">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEditSite(site); }} className="p-1.5 text-slate-500 rounded border border-slate-200 dark:border-github-dark-border"><Edit2 size={10} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSite(site.site_id); }} className="p-1.5 text-red-500 rounded border border-slate-200 dark:border-github-dark-border"><Trash2 size={10} /></button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                /* Selected Site Detail Dashboard */
                                <div className="space-y-4 animate-in fade-in duration-150">
                                    <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3.5 rounded-xl shadow-sm space-y-3">
                                        <div>
                                            <h3 className="font-extrabold text-xs text-slate-800 dark:text-white">{selectedSite.site_name}</h3>
                                        </div>

                                        <div className="flex bg-slate-100 dark:bg-[#161b22] p-0.5 rounded-lg select-none border border-slate-250 dark:border-github-dark-border">
                                            {[
                                                { id: 'attendance', label: 'Checklist' },
                                                { id: 'grid', label: 'Matrix' },
                                                { id: 'finances', label: 'Ledger' }
                                            ].map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setSubTab(tab.id)}
                                                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${subTab === tab.id
                                                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-[#f0f6fc] shadow-sm'
                                                            : 'text-slate-500 dark:text-slate-400'
                                                        }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Component views filtered for selectedSite */}
                                    {subTab === 'attendance' && (
                                         <div className="space-y-3 animate-in fade-in duration-100">
                                             <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3.5 rounded-xl shadow-sm flex flex-col gap-2.5">
                                                      <MobileDatePicker
                                                          label="Roster Date"
                                                          value={attendanceDate}
                                                          onChange={(val) => setAttendanceDate(val)}
                                                      />
                                                      <MinimalSelect
                                                          options={[
                                                              { value: '', label: 'All Roles' },
                                                              ...((() => {
                                                                  const seen = new Map();
                                                                  labours.forEach(l => {
                                                                      const r = (l.role || '').trim();
                                                                      if (r) {
                                                                          const key = r.toLowerCase();
                                                                          if (!seen.has(key)) seen.set(key, r);
                                                                      }
                                                                  });
                                                                  return [...seen.values()].sort();
                                                              })().map(r => ({ value: r, label: r })))
                                                          ]}
                                                          value={attendanceRoleFilter}
                                                          onChange={(val) => setAttendanceRoleFilter(val)}
                                                          variant="input"
                                                          size="sm"
                                                          triggerClassName="w-full justify-between py-1.5 px-3 rounded-xl font-medium"
                                                      />
                                             </div>

                                             <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden shadow-sm">
                                                 <div className="p-3 border-b border-slate-105 dark:border-github-dark-border flex justify-between items-center bg-slate-50 dark:bg-github-dark-border/40 gap-2">
                                                     <span className="font-bold text-[11px] truncate">Roster ({attendanceRoster.filter(item => !attendanceRoleFilter || item.role.toLowerCase() === attendanceRoleFilter.toLowerCase()).length})</span>
                                                     <div className="flex gap-1.5 shrink-0">
                                                         <button
                                                             type="button"
                                                             onClick={() => {
                                                                 setSelectedLabourIds([]);
                                                                 setBulkSourceSiteId('All');
                                                                 setBulkDestinationSiteId(selectedSite ? String(selectedSite.site_id) : '');
                                                                 setShowBulkTransferModal(true);
                                                             }}
                                                             className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-bold flex items-center gap-1 border border-slate-200 dark:border-github-dark-border text-[9px]"
                                                         >
                                                             <Building size={10} /> Bulk Move
                                                         </button>
                                                         <button
                                                             type="button"
                                                             onClick={() => setShowBorrowModal(true)}
                                                             className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-bold flex items-center gap-1 border border-slate-200 dark:border-github-dark-border text-[9px]"
                                                         >
                                                             <Plus size={10} /> Add Worker
                                                         </button>
                                                         <button
                                                             disabled={attendanceRoster.length === 0}
                                                             onClick={handleSaveAttendance}
                                                             className="px-2 py-1 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-1 shadow-sm disabled:opacity-50 text-[9px]"
                                                         >
                                                             <Save size={10} /> Save
                                                         </button>
                                                     </div>
                                                 </div>

                                                 {attendanceLoading ? (
                                                     <div className="py-10 flex justify-center"><Clock className="animate-spin text-indigo-500" size={20} /></div>
                                                 ) : attendanceRoster.length === 0 ? (
                                                     <div className="p-8 text-center text-slate-400 italic">No labours on this site. Assign them in Directory.</div>
                                                 ) : attendanceRoster.filter(item => !attendanceRoleFilter || item.role.toLowerCase() === attendanceRoleFilter.toLowerCase()).length === 0 ? (
                                                     <div className="p-8 text-center text-slate-400 italic">No labours match the selected role filter.</div>
                                                 ) : (
                                                     <div className="divide-y divide-slate-100 dark:divide-github-dark-border/50 bg-slate-50/30 dark:bg-transparent">
                                                         {attendanceRoster
                                                             .filter(item => !attendanceRoleFilter || item.role.toLowerCase() === attendanceRoleFilter.toLowerCase())
                                                             .map(item => (
                                                             <div key={item.labour_id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/50 dark:hover:bg-[#161b22]/20 transition-colors">
                                                                 <div className="flex items-center justify-between gap-3">
                                                                     <div>
                                                                         <div className="flex items-center gap-2">
                                                                             <h4 className="font-bold text-slate-800 dark:text-white text-xs truncate">{item.name}</h4>
                                                                             {item.is_borrowed && (
                                                                                 <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-extrabold text-[8px] uppercase tracking-wider">Added</span>
                                                                             )}
                                                                         </div>
                                                                         <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400 dark:text-github-dark-muted font-mono uppercase">
                                                                             <span>{item.role}</span>
                                                                             <span>•</span>
                                                                             <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold ${item.wage_type === 'Fixed Salary'
                                                                                 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                                                 : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                                 }`}>
                                                                                 {item.wage_type}
                                                                             </span>
                                                                         </div>
                                                                     </div>
                                                                 </div>

                                                                 <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                                                     {[
                                                                         { id: 'Present', label: 'Present (Full Day)', activeColor: 'bg-emerald-500 text-white dark:bg-emerald-600', inactiveColor: 'bg-slate-50 dark:bg-[#161b22] text-slate-600 dark:text-[#c9d1d9] border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' },
                                                                         { id: 'Half Day', label: 'Half Day', activeColor: 'bg-amber-500 text-white dark:bg-amber-600', inactiveColor: 'bg-slate-50 dark:bg-[#161b22] text-slate-600 dark:text-[#c9d1d9] border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' },
                                                                         { id: 'Absent', label: 'Absent', activeColor: 'bg-rose-500 text-white dark:bg-rose-600', inactiveColor: 'bg-slate-50 dark:bg-[#161b22] text-slate-600 dark:text-[#c9d1d9] border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' },
                                                                         ...(item.wage_type === 'Fixed Salary' ? [{ id: 'Paid Leave', label: 'Paid Leave', activeColor: 'bg-indigo-500 text-white dark:bg-indigo-600', inactiveColor: 'bg-slate-50 dark:bg-[#161b22] text-slate-600 dark:text-[#c9d1d9] border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' }] : [])
                                                                     ].map(statusOpt => {
                                                                         const isSelected = item.status === statusOpt.id;
                                                                         return (
                                                                             <button
                                                                                 key={statusOpt.id}
                                                                                 onClick={() => handleStatusChange(item.labour_id, statusOpt.id)}
                                                                                 className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${isSelected ? statusOpt.activeColor + ' shadow-sm' : statusOpt.inactiveColor
                                                                                     }`}
                                                                             >
                                                                                 {statusOpt.label}
                                                                             </button>
                                                                         );
                                                                     })}
                                                                 </div>
                                                             </div>
                                                         ))}
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     )}

                                     {subTab === 'grid' && (
                                         <div className="space-y-3 animate-in fade-in duration-100">
                                            <div className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm flex flex-col gap-2.5">
                                                 <MinimalSelect
                                                     options={[
                                                         { value: '', label: 'All Roles' },
                                                         ...((() => {
                                                             const seen = new Map();
                                                             labours.forEach(l => {
                                                                 const r = (l.role || '').trim();
                                                                 if (r) {
                                                                     const key = r.toLowerCase();
                                                                     if (!seen.has(key)) seen.set(key, r);
                                                                 }
                                                             });
                                                             return [...seen.values()].sort();
                                                         })().map(r => ({ value: r, label: r })))
                                                     ]}
                                                     value={gridRoleFilter}
                                                     onChange={(val) => setGridRoleFilter(val)}
                                                     variant="input"
                                                     size="sm"
                                                     triggerClassName="w-full justify-between py-1.5 px-3 rounded-xl font-medium"
                                                 />
                                                 <MonthPicker
                                                     label="Month"
                                                     value={gridMonth}
                                                     onChange={(val) => setGridMonth(val)}
                                                     compact={true}
                                                 />
                                            </div>

                                            {gridLoading ? (
                                                <div className="py-10 flex justify-center"><Clock className="animate-spin text-indigo-500" size={20} /></div>
                                            ) : (
                                                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden shadow-sm">
                                                    <div className="p-3 border-b border-slate-105 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-border/40 flex justify-between items-center">
                                                        <span className="font-bold text-xs">Attendance Matrix</span>
                                                    </div>

                                                    <div className="overflow-x-auto no-scrollbar" style={{ isolation: 'isolate' }}>
                                                        <table className="w-full text-left border-collapse text-xs whitespace-nowrap" style={{ minWidth: 'max-content' }}>
                                                            <thead className="sticky top-0 z-30">
                                                                <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border">
                                                                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-github-dark-muted sticky left-0 bg-slate-50 dark:bg-[#161b22] z-40 w-[130px] min-w-[130px] max-w-[130px] border-r border-slate-200 dark:border-github-dark-border" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.10)' }}>Worker Name / Role</th>
                                                                    {getDaysInMonthArray().map(day => {
                                                                        const d = new Date(day.dateStr + 'T00:00:00Z');
                                                                        return (
                                                                            <th key={day.dateStr} className="py-2 px-1 text-center min-w-[46px]">
                                                                                <div className="text-[7px] uppercase text-slate-400 leading-none tracking-wider">{d.toLocaleString('en-US', { month: 'short' })}</div>
                                                                                <div className="text-[12px] font-black text-slate-700 dark:text-white leading-tight">{d.getUTCDate()}</div>
                                                                                <div className="text-[7px] uppercase text-slate-400 leading-none tracking-wider">{d.toLocaleString('en-US', { weekday: 'short' })}</div>
                                                                            </th>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-github-dark-border">
                                                                {gridData.filter(row => !gridRoleFilter || row.role.toLowerCase() === gridRoleFilter.toLowerCase()).length === 0 ? (
                                                                     <tr>
                                                                         <td colSpan={getDaysInMonthArray().length + 1} className="p-8 text-center text-slate-400 italic bg-white dark:bg-dark-card">No matrix records matching filter.</td>
                                                                     </tr>
                                                                 ) : (
                                                                     gridData
                                                                         .filter(row => !gridRoleFilter || row.role.toLowerCase() === gridRoleFilter.toLowerCase())
                                                                         .map(row => {
                                                                        const initials = row.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                                                        return (
                                                                            <tr key={row.labour_id} className="hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors group">
                                                                                <td className="px-3 py-2.5 sticky left-0 bg-white dark:bg-[#0d1117] group-hover:bg-slate-50 dark:group-hover:bg-[#1c2128] transition-colors z-10 w-[130px] min-w-[130px] max-w-[130px] border-r border-slate-200 dark:border-github-dark-border" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.08)' }}>
                                                                                     <div className="flex items-center gap-2 overflow-hidden">
                                                                                         <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px] shadow-inner shrink-0">
                                                                                             {initials || <User size={12} />}
                                                                                         </div>
                                                                                         <div className="min-w-0 flex-1">
                                                                                             <span className="block font-bold text-slate-800 dark:text-github-dark-text text-[10px] leading-tight truncate">{row.name}</span>
                                                                                             <span className="block text-[8px] font-medium text-slate-400 dark:text-github-dark-muted mt-0.5 truncate">{row.role}</span>
                                                                                         </div>
                                                                                     </div>
                                                                                </td>
                                                                                {getDaysInMonthArray().map(day => {
                                                                                    const attObj = row.attendance[day.dateStr];
                                                                                    let status = attObj && typeof attObj === 'object' ? attObj.status : (attObj || '-');

                                                                                    if (status === '-' || !status) {
                                                                                        const dateObj = new Date(day.dateStr);
                                                                                        const dayNum = dateObj.getDay();
                                                                                        if (dayNum === 6) status = 'Sat';
                                                                                        else if (dayNum === 0) status = 'Sun';
                                                                                    }

                                                                                    return (
                                                                                        <td key={day.dateStr} className="px-1 py-2 text-center align-middle">
                                                                                            <div className="flex justify-center items-center">
                                                                                                <span
                                                                                                    className={`w-7 h-7 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all inline-flex items-center justify-center shadow-sm ${getStatusColor(status)}`}
                                                                                                    title={status !== '-' ? status : undefined}
                                                                                                >
                                                                                                    {getStatusLabel(status)}
                                                                                                </span>
                                                                                            </div>
                                                                                        </td>
                                                                                    );
                                                                                })}
                                                                            </tr>
                                                                        );
                                                                    })
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {subTab === 'finances' && (
                                        <div className="space-y-3 animate-in fade-in duration-100">
                                            <div className="bg-white dark:bg-github-dark-subtle p-3 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm flex flex-col gap-2">
                                                 <MinimalSelect
                                                     options={[
                                                         { value: '', label: 'All Roles' },
                                                         ...((() => {
                                                             const seen = new Map();
                                                             labours.forEach(l => {
                                                                 const r = (l.role || '').trim();
                                                                 if (r) {
                                                                     const key = r.toLowerCase();
                                                                     if (!seen.has(key)) seen.set(key, r);
                                                                 }
                                                             });
                                                             return [...seen.values()].sort();
                                                         })().map(r => ({ value: r, label: r })))
                                                     ]}
                                                     value={financeRoleFilter}
                                                     onChange={(val) => setFinanceRoleFilter(val)}
                                                     variant="input"
                                                     size="sm"
                                                     triggerClassName="w-full justify-between py-1.5 px-3 rounded-xl font-medium"
                                                 />
                                                 <MonthPicker
                                                     label="Select Month"
                                                     value={financeMonth}
                                                     onChange={(val) => setFinanceMonth(val)}
                                                     compact={true}
                                                 />
                                            </div>
                                            {monthDetails && (
                                                <div className="bg-slate-100 dark:bg-github-dark-border p-2.5 rounded-lg text-[9px] font-bold text-slate-600 dark:text-github-dark-text text-center border border-slate-200/50">
                                                    🗓️ {getMonthNameAndYear(monthDetails.start)} PERIOD: DAYS ELAPSED {monthDetails.elapsedDays} OF {monthDetails.totalDays}
                                                </div>
                                            )}

                                            <div className="grid gap-3">
                                                {financeSummary.filter(row => row.site_id === selectedSite.site_id && (!financeRoleFilter || row.role.toLowerCase() === financeRoleFilter.toLowerCase())).length === 0 ? (
                                                    <div className="p-10 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 bg-white dark:bg-github-dark-subtle">
                                                        No finances ledger for workers matching filter.
                                                    </div>
                                                ) : (
                                                    financeSummary
                                                        .filter(row => row.site_id === selectedSite.site_id && (!financeRoleFilter || row.role.toLowerCase() === financeRoleFilter.toLowerCase()))
                                                        .map(row => {
                                                            const advanceAlert = row.advances_taken > row.accrued_credit;
                                                            return (
                                                                <div key={row.labour_id} className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm space-y-3">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="cursor-pointer" onClick={() => handleViewHistory(row)}>
                                                                            <h4 className="font-bold text-slate-800 dark:text-white text-xs">{row.name}</h4>
                                                                            <span className="text-[9px] text-slate-450 dark:text-github-dark-muted block font-mono">{row.role} | {row.wage_type}</span>
                                                                        </div>
                                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${row.wage_type === 'Fixed Salary'
                                                                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30'
                                                                            }`}>
                                                                            {row.wage_type}
                                                                        </span>
                                                                    </div>

                                                                    <div className="grid grid-cols-4 gap-1 bg-slate-50 dark:bg-github-dark-border/20 p-2 rounded-lg text-center text-[9px]">
                                                                        <div>
                                                                            <span className="block text-slate-400 dark:text-github-dark-muted text-[8px] uppercase">Attendance</span>
                                                                            <span className="font-bold text-slate-750 dark:text-github-dark-text">{row.attendance.present}P / {row.attendance.half_day}HD</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="block text-slate-400 dark:text-github-dark-muted text-[8px] uppercase">Credit</span>
                                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{row.accrued_credit}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="block text-slate-400 dark:text-github-dark-muted text-[8px] uppercase">Advances</span>
                                                                            <span className="font-bold text-amber-600 dark:text-amber-500">₹{row.advances_taken}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="block text-slate-400 dark:text-github-dark-muted text-[8px] uppercase">Net Pay</span>
                                                                            <span className={`font-black ${advanceAlert ? 'text-rose-500' : 'text-indigo-600 dark:text-indigo-400'}`}>₹{row.net_payable}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-github-dark-border/40 mt-1">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[9px] text-slate-400 dark:text-github-dark-muted font-semibold">Base: ₹{row.monthly_salary}</span>
                                                                            {row.payout ? (
                                                                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${row.payout.status === 'Paid'
                                                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30'
                                                                                        : 'bg-amber-500 text-white rounded'
                                                                                    }`}>
                                                                                    {row.payout.status}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-200 dark:border-rose-900/30 whitespace-nowrap">
                                                                                     <XCircle size={8} /> Not Paid
                                                                                 </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex gap-1.5">
                                                                            <button onClick={() => handleOpenAdvance(row)} className="px-2 py-1 text-[9px] font-bold bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg transition-colors">Advance</button>
                                                                            <button onClick={() => handleOpenPayout(row)} className={`px-2 py-1 text-[9px] font-bold border rounded-lg transition-colors ${row.payout ? 'bg-emerald-50 dark:bg-emerald-950/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30' : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'}`}>{row.payout ? 'View Payout' : 'Release'}</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        {/* ==========================================
                            TAB 2: LABOUR DIRECTORY
                            ========================================== */}
                        {activeTab === 'directory' && (
                            <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                                <div className="flex flex-col gap-2.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3.5 rounded-xl shadow-sm">
                                    <span className="font-bold text-slate-700 dark:text-white block">Labour Directory</span>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Search worker by name or role..."
                                            value={labourSearch}
                                            onChange={(e) => setLabourSearch(e.target.value)}
                                            className="pl-8 pr-4 py-2 w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex gap-2.5">
                                        <MinimalSelect
                                            options={[
                                                { value: 'All', label: 'All Sites' },
                                                { value: 'Unassigned', label: 'Unassigned' },
                                                ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                            ]}
                                            value={labourSiteFilter}
                                            onChange={(val) => setLabourSiteFilter(val)}
                                            variant="input"
                                            size="sm"
                                            triggerClassName="flex-1 justify-between py-1.5 px-3 rounded-xl font-medium"
                                        />
                                        <MinimalSelect
                                            options={[
                                                { value: '', label: 'All Roles' },
                                                ...((() => {
                                                    const seen = new Map();
                                                    labours.forEach(l => {
                                                        const r = (l.role || '').trim();
                                                        if (r) {
                                                            const key = r.toLowerCase();
                                                            if (!seen.has(key)) seen.set(key, r);
                                                        }
                                                    });
                                                    return [...seen.values()].sort();
                                                })().map(r => ({ value: r, label: r })))
                                            ]}
                                            value={labourRoleFilter}
                                            onChange={(val) => setLabourRoleFilter(val)}
                                            variant="input"
                                            size="sm"
                                            triggerClassName="flex-1 justify-between py-1.5 px-3 rounded-xl font-medium"
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end border-t border-slate-100 dark:border-github-dark-border/40 pt-2.5">
                                        <button
                                            onClick={() => {
                                                setSelectedLabourIds([]);
                                                setBulkSourceSiteId('All');
                                                setBulkDestinationSiteId('');
                                                setShowBulkTransferModal(true);
                                            }}
                                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-1 border border-slate-200 dark:border-github-dark-border text-[9px]"
                                        >
                                            <Building size={12} /> Bulk Move
                                        </button>
                                        <button
                                            onClick={() => {
                                                setParsedLabours([]);
                                                setCsvPreviewError('');
                                                setShowBulkLabourModal(true);
                                            }}
                                            className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-1 text-[9px] shrink-0"
                                        >
                                            <Upload size={12} /> Bulk Add
                                        </button>
                                        <button
                                            onClick={() => { setEditingLabour(null); setLabourForm({ name: '', phone: '', sex: 'Male', role: '', wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '' }); setShowLabourModal(true); }}
                                            className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-1 text-[9px] shrink-0"
                                        >
                                            <Plus size={12} /> Add Worker
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    {labours
                                        .filter(lab => {
                                            const matchesSearch = lab.name.toLowerCase().includes(labourSearch.toLowerCase()) ||
                                                lab.role.toLowerCase().includes(labourSearch.toLowerCase());
                                            const matchesRole = !labourRoleFilter || lab.role.toLowerCase() === labourRoleFilter.toLowerCase();
                                            let matchesSite = true;
                                            if (labourSiteFilter === 'Unassigned') matchesSite = lab.site_id === null;
                                            else if (labourSiteFilter !== 'All') matchesSite = lab.site_id === Number(labourSiteFilter);
                                            return matchesSearch && matchesRole && matchesSite;
                                        })
                                        .map(lab => (
                                            <div key={lab.labour_id} className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                                                <div className="cursor-pointer" onClick={() => handleViewHistory(lab)}>
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-xs flex items-center gap-1.5">
                                                        <span>{lab.name}</span>
                                                        <span className="text-[8px] text-indigo-500 font-bold uppercase bg-indigo-50 dark:bg-indigo-950/20 px-1 rounded">History</span>
                                                    </h4>
                                                    <p className="text-[9px] text-slate-500 dark:text-github-dark-muted mt-0.5">{lab.role} | {lab.wage_type}</p>
                                                    <p className="text-[9px] text-slate-500 dark:text-github-dark-muted mt-0.5">{lab.phone || 'No phone'} | {lab.sex}</p>
                                                    <p className="text-[9px] text-slate-500 dark:text-github-dark-muted mt-1 uppercase flex items-center gap-1 font-semibold">
                                                        <Building size={10} /> {lab.site_name || 'Unassigned'}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleEditLabour(lab)} className="p-2 text-slate-400 rounded-xl border border-slate-200 dark:border-github-dark-border"><Edit2 size={12} /></button>
                                                    <button onClick={() => handleDeleteLabour(lab.labour_id)} className="p-2 text-red-500 rounded-xl border border-slate-200 dark:border-github-dark-border"><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* BOTTOM-SHEET SLIDE-OVER DRAWERS (PORTALS) */}
                    {/* DRAWERS: SITE FORM */}
                    {createPortal(
                        <AnimatePresence>
                            {showSiteModal && (
                                <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowSiteModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-h-[85vh] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                <div className="flex justify-between items-center px-5 pb-4 border-b border-slate-100 dark:border-[#30363d]">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-[#f0f6fc] text-sm">
                                            {editingSite ? 'Edit Construction Site' : 'Create Construction Site'}
                                        </h4>
                                        <span className="text-[9px] text-slate-500 dark:text-github-dark-muted font-bold uppercase tracking-wider">Site Configuration Profile</span>
                                    </div>
                                    <button onClick={() => setShowSiteModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d]"><X size={16} /></button>
                                </div>
                                <form onSubmit={handleSaveSite} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs custom-scrollbar">
                                    <input
                                        type="text"
                                        value={siteForm.site_name}
                                        onChange={(e) => setSiteForm({ ...siteForm, site_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs"
                                        required
                                        placeholder="Site Name"
                                    />
                                    <textarea
                                        value={siteForm.location_details}
                                        onChange={(e) => setSiteForm({ ...siteForm, location_details: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs"
                                        rows={3}
                                        placeholder="Location details / Address"
                                    />
                                    {editingSite && (
                                        <MinimalSelect
                                            options={[
                                                { value: 'Active', label: 'Active' },
                                                { value: 'Completed', label: 'Completed' },
                                                { value: 'Inactive', label: 'Inactive' }
                                            ]}
                                            value={siteForm.status}
                                            onChange={(val) => setSiteForm({ ...siteForm, status: val })}
                                            variant="input"
                                            size="sm"
                                            triggerClassName="w-full justify-between py-2 px-3 rounded-xl font-medium"
                                        />
                                    )}
                                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#30363d]">
                                        <button type="button" onClick={() => setShowSiteModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-500 dark:text-[#c9d1d9] rounded-xl font-bold transition-all">Cancel</button>
                                        <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">Save</button>
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
                                <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowLabourModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-h-[90vh] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                <div className="flex justify-between items-center px-5 pb-4 border-b border-slate-100 dark:border-[#30363d]">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-[#f0f6fc] text-sm">
                                            {editingLabour ? 'Edit Worker Profile' : 'Add Labour Worker'}
                                        </h4>
                                        <span className="text-[9px] text-slate-500 dark:text-github-dark-muted font-bold uppercase tracking-wider">Worker Configuration Profile</span>
                                    </div>
                                    <button onClick={() => setShowLabourModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d]"><X size={16} /></button>
                                </div>
                                <form onSubmit={handleSaveLabour} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs custom-scrollbar">
                                    <input
                                        type="text"
                                        value={labourForm.name}
                                        onChange={(e) => setLabourForm({ ...labourForm, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs"
                                        required
                                        placeholder="Worker Full Name"
                                    />
                                    <input
                                        type="tel"
                                        value={labourForm.phone}
                                        onChange={(e) => setLabourForm({ ...labourForm, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs"
                                        placeholder="Phone number"
                                    />
                                    <MinimalSelect
                                        options={[
                                            { value: 'Male', label: 'Male' },
                                            { value: 'Female', label: 'Female' },
                                            { value: 'Other', label: 'Other' }
                                        ]}
                                        value={labourForm.sex}
                                        onChange={(val) => setLabourForm({ ...labourForm, sex: val })}
                                        variant="input"
                                        size="sm"
                                        triggerClassName="w-full justify-between py-2 px-3 rounded-xl font-medium"
                                    />
                                    <input
                                        type="text"
                                        value={labourForm.role}
                                        onChange={(e) => setLabourForm({ ...labourForm, role: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs"
                                        required
                                        placeholder="Role (e.g. Mason, Carpenter)"
                                    />
                                    <MinimalSelect
                                        options={[
                                            { value: '', label: 'Unassigned / Independent' },
                                            ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                        ]}
                                        value={labourForm.site_id}
                                        onChange={(val) => setLabourForm({ ...labourForm, site_id: val })}
                                        variant="input"
                                        size="sm"
                                        triggerClassName="w-full justify-between py-2 px-3 rounded-xl font-medium"
                                    />
                                    <MinimalSelect
                                        options={[
                                            { value: 'Daily Wage', label: 'Daily Wage' },
                                            { value: 'Fixed Salary', label: 'Fixed Monthly Salary' }
                                        ]}
                                        value={labourForm.wage_type}
                                        onChange={(val) => setLabourForm({ ...labourForm, wage_type: val })}
                                        variant="input"
                                        size="sm"
                                        triggerClassName="w-full justify-between py-2 px-3 rounded-xl font-medium"
                                    />
                                    <input
                                        type="number"
                                        value={labourForm.monthly_salary}
                                        onChange={(e) => setLabourForm({ ...labourForm, monthly_salary: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs"
                                        required
                                        placeholder="Monthly Wage Salary"
                                    />
                                    {editingLabour && (
                                        <MinimalSelect
                                            options={[
                                                { value: 'Active', label: 'Active' },
                                                { value: 'Inactive', label: 'Inactive' }
                                            ]}
                                            value={labourForm.status}
                                            onChange={(val) => setLabourForm({ ...labourForm, status: val })}
                                            variant="input"
                                            size="sm"
                                            triggerClassName="w-full justify-between py-2 px-3 rounded-xl font-medium"
                                        />
                                    )}
                                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#30363d]">
                                        <button type="button" onClick={() => setShowLabourModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-500 dark:text-[#c9d1d9] rounded-xl font-bold transition-all">Cancel</button>
                                        <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">Save</button>
                                    </div>
                                </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: ADVANCE FORM */}
                    {createPortal(
                        <AnimatePresence>
                            {showAdvanceModal && (
                                <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowAdvanceModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-h-[80vh] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                <div className="flex justify-between items-center px-5 pb-4 border-b border-slate-100 dark:border-[#30363d]">
                                    <div className="flex items-center gap-1">
                                        <DollarSign size={16} className="text-amber-500" />
                                        <h4 className="font-bold text-slate-800 dark:text-[#f0f6fc] text-sm">Log Salary Advance ({advanceForm.name})</h4>
                                    </div>
                                    <button onClick={() => setShowAdvanceModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={16} /></button>
                                </div>
                                <form onSubmit={handleSaveAdvance} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs custom-scrollbar">
                                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 p-3 rounded-lg text-slate-600 dark:text-slate-300">
                                        Logging salary advance for <strong>{advanceForm.name}</strong>.
                                    </div>
                                    <input
                                        type="number"
                                        value={advanceForm.amount}
                                        onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs focus:outline-none"
                                        required
                                        placeholder="Advance Amount (INR)"
                                    />
                                    <input
                                        type="date"
                                        value={advanceForm.date}
                                        onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs focus:outline-none"
                                        required
                                    />
                                    <input
                                        type="text"
                                        value={advanceForm.notes}
                                        onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs focus:outline-none"
                                        placeholder="Notes (e.g. medical / festival)"
                                    />
                                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#30363d]">
                                        <button type="button" onClick={() => setShowAdvanceModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-500 dark:text-[#c9d1d9] rounded-xl font-bold transition-all">Cancel</button>
                                        <button type="submit" className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold">Record</button>
                                    </div>
                                </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: PAYOUT FORM */}
                    {createPortal(
                        <AnimatePresence>
                            {showPayoutModal && (
                                <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowPayoutModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-h-[90vh] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                <div className="flex justify-between items-center px-5 pb-4 border-b border-slate-100 dark:border-[#30363d]">
                                    <div className="flex items-center gap-1">
                                        <DollarSign size={16} className="text-indigo-500" />
                                        <h4 className="font-bold text-slate-800 dark:text-[#f0f6fc] text-sm">
                                            {payoutForm.payout_id ? 'Update Payout' : 'Process Payout'}
                                        </h4>
                                    </div>
                                    <button onClick={() => setShowPayoutModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d]"><X size={16} /></button>
                                </div>
                                <form onSubmit={handleSavePayout} className="flex-1 overflow-y-auto px-5 pt-4 pb-12 space-y-4 text-xs custom-scrollbar">
                                    <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-xl border border-slate-200 dark:border-indigo-900/35 text-[11px]">
                                        <div className="font-extrabold text-slate-800 dark:text-white">Worker: {payoutForm.name}</div>
                                        <div className="text-slate-500 dark:text-github-dark-muted font-mono mt-0.5 font-semibold">{payoutForm.wage_type} | Month: {payoutForm.month}</div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2.5 bg-slate-50 dark:bg-[#161b22]/60 p-3 rounded-xl border border-slate-200 dark:border-github-dark-border text-[10px]">
                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 dark:text-github-dark-muted block uppercase tracking-wider text-[8px] font-bold">Attendance:</span>
                                            <span className="font-extrabold text-slate-800 dark:text-white text-xs">
                                                {payoutForm.present_days}P / {payoutForm.half_days}HD / {payoutForm.absent_days}A
                                            </span>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 dark:text-github-dark-muted block uppercase tracking-wider text-[8px] font-bold">Accrued Credit:</span>
                                            <span className="font-extrabold text-slate-800 dark:text-white text-xs">₹{payoutForm.accrued_credit}</span>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 dark:text-github-dark-muted block uppercase tracking-wider text-[8px] font-bold">Advances Taken:</span>
                                            <span className="font-extrabold text-amber-500 text-xs">-₹{payoutForm.advances_taken}</span>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 dark:text-github-dark-muted block uppercase tracking-wider text-[8px] font-bold">Net Payable:</span>
                                            <span className="font-black text-indigo-600 dark:text-indigo-400 text-xs">₹{payoutForm.net_payable}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-slate-500 dark:text-github-dark-muted font-semibold mb-1 text-[10px]">Paid Amount</label>
                                            <input
                                                type="number"
                                                value={payoutForm.paid_amount}
                                                onChange={(e) => setPayoutForm({ ...payoutForm, paid_amount: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-lg text-xs font-bold focus:outline-none"
                                                required
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-github-dark-muted font-semibold mb-1 text-[10px]">Status</label>
                                            <MinimalSelect
                                                options={[
                                                    { value: 'Paid', label: 'Paid' },
                                                    { value: 'Pending', label: 'Pending' }
                                                ]}
                                                value={payoutForm.status}
                                                onChange={(val) => setPayoutForm({ ...payoutForm, status: val })}
                                                variant="input"
                                                size="sm"
                                                triggerClassName="w-full justify-between py-2 px-3 rounded-lg font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 dark:text-github-dark-muted font-semibold mb-1 text-[10px]">Payment Date</label>
                                        <input
                                            type="date"
                                            value={payoutForm.payment_date}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, payment_date: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-lg text-xs font-bold focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 dark:text-github-dark-muted font-semibold mb-1 text-[10px]">Notes</label>
                                        <input
                                            type="text"
                                            value={payoutForm.notes}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-lg text-xs font-semibold focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
                                            placeholder="Payment method or Ref#"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-[#30363d] mt-2">
                                        <button type="button" onClick={() => setShowPayoutModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-505 dark:text-[#c9d1d9] rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-slate-200 dark:border-github-dark-border">Cancel</button>
                                        <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm">
                                            {payoutForm.payout_id ? 'Update' : 'Release'}
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
                                <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowBulkTransferModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-h-[85vh] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                <div className="flex justify-between items-center px-5 pb-4 border-b border-slate-100 dark:border-[#30363d]">
                                    <div className="flex items-center gap-1.5">
                                        <Building size={16} className="text-indigo-500" />
                                        <h4 className="font-bold text-slate-800 dark:text-[#f0f6fc] text-sm">Bulk Move Workers</h4>
                                    </div>
                                    <button onClick={() => setShowBulkTransferModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={16} /></button>
                                </div>
                                <form onSubmit={handleExecuteBulkTransfer} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-slate-500 dark:text-github-dark-muted font-semibold mb-1 text-[10px]">From Site</label>
                                            <MinimalSelect
                                                options={[
                                                    { value: 'All', label: 'All Sites' },
                                                    { value: 'Unassigned', label: 'Unassigned' },
                                                    ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                ]}
                                                value={bulkSourceSiteId}
                                                onChange={(val) => {
                                                    setBulkSourceSiteId(val);
                                                    setSelectedLabourIds([]);
                                                }}
                                                variant="input"
                                                size="sm"
                                                triggerClassName="w-full justify-between py-1.5 px-2 rounded-xl font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-github-dark-muted font-semibold mb-1 text-[10px]">To Site</label>
                                            <MinimalSelect
                                                options={[
                                                    { value: '', label: '-- Choose New Project --' },
                                                    { value: 'Unassigned', label: 'Unassigned / Independent' },
                                                    ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                ]}
                                                value={bulkDestinationSiteId}
                                                onChange={(val) => setBulkDestinationSiteId(val)}
                                                variant="input"
                                                size="sm"
                                                triggerClassName="w-full justify-between py-1.5 px-2 rounded-xl font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-slate-500 dark:text-github-dark-muted font-bold">
                                            <span>Select Workers ({selectedLabourIds.length})</span>
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
                                                className="text-indigo-600 dark:text-indigo-400 font-black text-[10px]"
                                            >
                                                Select All
                                            </button>
                                        </div>

                                        <div className="border border-slate-200 dark:border-github-dark-border rounded-xl max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-[#161b22]/40 custom-scrollbar space-y-1.5">
                                            {labours
                                                .filter(lab => {
                                                    if (bulkSourceSiteId === 'Unassigned') return lab.site_id === null;
                                                    if (bulkSourceSiteId !== 'All') return lab.site_id === Number(bulkSourceSiteId);
                                                    return true;
                                                })
                                                .map(lab => (
                                                    <label key={lab.labour_id} className="flex items-center gap-2 py-1.5 cursor-pointer px-1 border-b border-slate-100/50 dark:border-github-dark-border/40">
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
                                                            className="rounded text-indigo-600 cursor-pointer"
                                                        />
                                                        <div className="truncate">
                                                            <span className="font-bold text-slate-800 dark:text-github-dark-text text-xs">{lab.name}</span>
                                                            <span className="ml-1.5 text-[9px] text-slate-500 dark:text-github-dark-muted">({lab.role})</span>
                                                        </div>
                                                    </label>
                                                ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#30363d]">
                                        <button type="button" onClick={() => setShowBulkTransferModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-500 dark:text-[#c9d1d9] rounded-xl font-bold transition-all">Cancel</button>
                                        <button
                                            type="submit"
                                            disabled={selectedLabourIds.length === 0}
                                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50"
                                        >
                                            Transfer {selectedLabourIds.length}
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
                                <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowBorrowModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-h-[85vh] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                <div className="flex justify-between items-center px-5 pb-4 border-b border-slate-100 dark:border-[#30363d]">
                                    <div className="flex items-center gap-1.5">
                                        <Plus size={16} className="text-indigo-500" />
                                        <h4 className="font-bold text-slate-800 dark:text-[#f0f6fc] text-sm">Add Worker from Master Data</h4>
                                    </div>
                                    <button onClick={() => setShowBorrowModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={16} /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs custom-scrollbar">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Search worker by name or role..."
                                            value={borrowSearchQuery}
                                            onChange={(e) => setBorrowSearchQuery(e.target.value)}
                                            className="pl-8 pr-4 py-2 w-full bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-xl text-xs focus:outline-none"
                                        />
                                    </div>

                                    <div className="border border-slate-200 dark:border-github-dark-border rounded-xl max-h-[50vh] overflow-y-auto p-1 bg-slate-50 dark:bg-[#161b22]/40 divide-y divide-slate-100 dark:divide-github-dark-border/40 custom-scrollbar">
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
                                                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-800/30"
                                                >
                                                    <div>
                                                        <span className="font-bold text-slate-800 dark:text-[#f0f6fc] block">{lab.name}</span>
                                                        <span className="text-[9px] text-slate-500 dark:text-github-dark-muted font-mono">{lab.role} | Base: {lab.site_name || 'Independent'}</span>
                                                    </div>
                                                    <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded text-[9px] font-bold">Select</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: SITE CLOSURE REASSIGNMENT */}
                    {createPortal(
                        <AnimatePresence>
                            {showSiteClosurePrompt && (
                                <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowSiteClosurePrompt(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                className="relative w-full max-h-[85vh] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363d] z-10"
                            >
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                <div className="flex justify-between items-center px-5 pb-4 border-b border-slate-100 dark:border-[#30363d] bg-amber-500/10 text-amber-800 dark:text-amber-400">
                                    <div className="flex items-center gap-1">
                                        <AlertTriangle size={16} />
                                        <span className="font-bold text-xs uppercase">Site Closure</span>
                                    </div>
                                    <button onClick={() => setShowSiteClosurePrompt(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={16} /></button>
                                </div>
                                <form onSubmit={handleConfirmSiteClosure} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs custom-scrollbar">
                                    <p className="text-slate-600 dark:text-slate-300 text-[10px]">
                                        Transfer workers from closed site <strong>{closureSiteName}</strong>:
                                    </p>
                                    <MinimalSelect
                                        options={[
                                            { value: '', label: 'Leave Unassigned / Independent' },
                                            ...sites
                                                .filter(s => s.site_id !== Number(closureSiteId) && s.status === 'Active')
                                                .map(s => ({ value: String(s.site_id), label: s.site_name }))
                                        ]}
                                        value={closureDestinationSiteId}
                                        onChange={(val) => setClosureDestinationSiteId(val)}
                                        variant="input"
                                        size="sm"
                                        triggerClassName="w-full justify-between py-2 px-3 rounded-xl font-medium"
                                    />
                                    <div className="border border-slate-200 dark:border-github-dark-border rounded-xl max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-[#161b22]/40">
                                        <ul className="list-disc pl-4 space-y-1 font-semibold text-[10px]">
                                            {closureLabours.map(l => <li key={l.labour_id} className="text-slate-700 dark:text-slate-300">{l.name} ({l.role})</li>)}
                                        </ul>
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-github-dark-border">
                                        <button type="button" onClick={() => setShowSiteClosurePrompt(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-500 dark:text-[#c9d1d9] rounded-xl font-bold transition-all">Cancel</button>
                                        <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">Transfer & Save</button>
                                    </div>
                                </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                    {/* DRAWERS: WORK HISTORY */}
                    {createPortal(
                        <AnimatePresence>
                            {selectedHistoryLabour && (
                                <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setSelectedHistoryLabour(null)}
                                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                                    />
                                    <motion.div
                                        initial={{ y: '100%' }}
                                        animate={{ y: 0 }}
                                        exit={{ y: '100%' }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                        className="relative w-full max-h-[90vh] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363d] z-10"
                                    >
                                        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                        <div className="flex justify-between items-center px-5 pb-4 border-b border-slate-100 dark:border-[#30363d]">
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-[#f0f6fc] text-xs">{selectedHistoryLabour.name}</h4>
                                                <span className="text-[8px] text-slate-500 dark:text-github-dark-muted block font-mono font-semibold">Work History Timeline | {selectedHistoryLabour.role}</span>
                                            </div>
                                            <button onClick={() => setSelectedHistoryLabour(null)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={16} /></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-[10px]">
                                            {historyLoading ? (
                                                <div className="py-10 flex justify-center"><Clock className="animate-spin text-indigo-500" size={20} /></div>
                                            ) : (
                                                <>
                                                    <div className="flex bg-slate-100 dark:bg-[#161b22] p-0.5 rounded-lg border border-slate-200 dark:border-github-dark-border">
                                                        <button type="button" onClick={() => setHistoryTab('sites')} className={`flex-1 py-1 text-center font-bold rounded-md transition-all ${historyTab === 'sites' ? 'bg-white dark:bg-slate-850 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>Timeline</button>
                                                        <button type="button" onClick={() => setHistoryTab('payouts')} className={`flex-1 py-1 text-center font-bold rounded-md transition-all ${historyTab === 'payouts' ? 'bg-white dark:bg-slate-850 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>Payouts</button>
                                                    </div>

                                                    {historyTab === 'sites' ? (
                                                        <div className="space-y-3">
                                                            {labourHistoryData.map((siteLog) => {
                                                                const rate = siteLog.total_days > 0 ? Math.round(((siteLog.present_days + siteLog.paid_leave_days + (0.5 * siteLog.half_day_days)) / siteLog.total_days) * 100) : 0;
                                                                return (
                                                                    <div key={siteLog.site_id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border p-3 rounded-xl shadow-sm">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-bold text-slate-800 dark:text-github-dark-text text-xs">{siteLog.site_name || 'Unassigned'}</span>
                                                                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 rounded">{rate}% Active</span>
                                                                        </div>
                                                                        <span className="text-[8px] text-slate-400 dark:text-[#8b949e] block mt-0.5">{new Date(siteLog.first_date).toLocaleDateString()} to {new Date(siteLog.last_date).toLocaleDateString()} ({siteLog.total_days} Days logged)</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {labourPayoutHistory.length === 0 ? (
                                                                <div className="text-center text-slate-400 italic py-6">No payouts.</div>
                                                            ) : (
                                                                labourPayoutHistory.map((payout) => (
                                                                    <div key={payout.payout_id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border p-3 rounded-xl shadow-sm space-y-1.5">
                                                                        <div className="flex justify-between items-center font-bold">
                                                                            <span className="text-indigo-600 dark:text-indigo-400">{getMonthNameAndYear(payout.month + "-01")}</span>
                                                                            <span className="text-slate-700 dark:text-slate-300">₹{payout.paid_amount} ({payout.status})</span>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <div className="p-4 border-t border-slate-100 dark:border-github-dark-border flex justify-end">
                                            <button onClick={() => setSelectedHistoryLabour(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all">Close</button>
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
                                <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowBulkLabourModal(false)}
                                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                                    />
                                    <motion.div
                                        initial={{ y: '100%' }}
                                        animate={{ y: 0 }}
                                        exit={{ y: '100%' }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                        className="relative w-full max-h-[90vh] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363d] z-10"
                                    >
                                        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                        <div className="flex justify-between items-center px-5 pb-4 border-b border-slate-100 dark:border-[#30363d]">
                                            <div className="flex items-center gap-1">
                                                <Upload size={16} className="text-indigo-500" />
                                                <h4 className="font-bold text-slate-800 dark:text-[#f0f6fc] text-sm">Bulk Add Labours</h4>
                                            </div>
                                            <button onClick={() => setShowBulkLabourModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={16} /></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs custom-scrollbar">
                                            {parsedLabours.length === 0 ? (
                                                <div className="space-y-3">
                                                    <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 p-3.5 rounded-xl text-slate-600 dark:text-slate-300">
                                                        <h5 className="font-bold text-slate-800 dark:text-white mb-1">Excel & CSV Bulk Upload Template</h5>
                                                        <p className="text-[10px] text-slate-500 dark:text-github-dark-muted leading-relaxed mb-2.5">
                                                            Ensure columns: Name, Role, Monthly Salary, Phone, Sex, Wage Type, Site Name.
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={downloadCSVTemplate}
                                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all text-[10px]"
                                                        >
                                                            Download Template
                                                        </button>
                                                    </div>

                                                    <div className="border-2 border-dashed border-slate-200 dark:border-github-dark-border rounded-xl p-6 text-center bg-slate-50 dark:bg-[#161b22]/30 flex flex-col items-center justify-center gap-2">
                                                        <Upload className="text-slate-400" size={24} />
                                                        <label className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline font-bold">
                                                            Upload Excel or CSV File
                                                            <input
                                                                type="file"
                                                                accept=".csv,.xlsx"
                                                                onChange={handleCSVUpload}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-[#161b22] p-2.5 rounded-lg border border-slate-200 dark:border-github-dark-border text-[10px]">
                                                        <div>
                                                            <span className="font-bold text-slate-800 dark:text-github-dark-text">Preview parsed rows</span>
                                                            <p className="text-slate-400 dark:text-github-dark-muted">{parsedLabours.filter(l => l.isValid).length} of {parsedLabours.length} valid.</p>
                                                        </div>
                                                        <button type="button" onClick={() => setParsedLabours([])} className="text-slate-500 hover:text-red-500 font-bold">Clear</button>
                                                    </div>

                                                    <div className="border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                                                        <table className="w-full text-left border-collapse text-[10px]">
                                                            <thead>
                                                                <tr className="bg-slate-50 dark:bg-[#161b22] text-slate-400 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-[#30363d]">
                                                                    <th className="p-2">Name</th>
                                                                    <th className="p-2">Role</th>
                                                                    <th className="p-2">Salary</th>
                                                                    <th className="p-2">Site</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {parsedLabours.map((row, idx) => (
                                                                    <tr key={idx} className="border-b border-slate-100 dark:border-github-dark-border/50">
                                                                        <td className={`p-2 font-bold ${row.isValid ? 'text-slate-800 dark:text-white' : 'text-slate-400 line-through'}`}>{row.name || 'Unnamed'}</td>
                                                                        <td className="p-2 text-slate-500 dark:text-github-dark-muted">{row.role || 'Missing'}</td>
                                                                        <td className="p-2 text-slate-500 dark:text-github-dark-muted">{isNaN(row.monthly_salary) ? 'Missing' : `₹${row.monthly_salary}`}</td>
                                                                        <td className="p-2 text-slate-500 dark:text-github-dark-muted">{row.site_name || 'Unassigned'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#30363d]">
                                                        <button type="button" onClick={() => setParsedLabours([])} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-500 dark:text-[#c9d1d9] rounded-xl font-bold transition-all">Cancel</button>
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveBulkLabours}
                                                            disabled={isUploadingBulk || parsedLabours.filter(l => l.isValid).length === 0}
                                                            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all"
                                                        >
                                                            {isUploadingBulk ? 'Importing...' : `Import (${parsedLabours.filter(l => l.isValid).length})`}
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
                    {/* CUSTOM CONFIRMATION MODAL */}
                    {createPortal(
                        <AnimatePresence>
                            {confirmDialog.isOpen && (
                                <div className="fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden p-4">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                                    />
                                    <motion.div
                                        initial={{ scale: 0.95, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.95, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="relative w-full max-w-md bg-white dark:bg-[#0d1117] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-[#30363d] overflow-hidden z-10"
                                    >
                                        <div className="p-6">
                                            <div className="flex items-center gap-3 mb-3 text-red-500">
                                                <AlertTriangle size={20} />
                                                <h4 className="font-bold text-slate-900 dark:text-[#f0f6fc] text-sm">
                                                    {confirmDialog.title}
                                                </h4>
                                            </div>
                                            <p className="text-slate-600 dark:text-github-dark-muted text-[11px] leading-relaxed">
                                                {confirmDialog.message}
                                            </p>
                                        </div>
                                        <div className="flex gap-2.5 p-4 bg-slate-50 dark:bg-[#010409]/40 border-t border-slate-100 dark:border-[#30363d]">
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                                                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-505 dark:text-[#c9d1d9] rounded-xl font-bold transition-all text-xs border border-slate-200 dark:border-github-dark-border"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                                                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                                }}
                                                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all text-xs shadow-sm"
                                            >
                                                Confirm
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}
            </div>
        </MobileDashboardLayout>
    );
};

export default MobileLabourManagement;
