import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { labourService } from '../../services/labourService';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hammer, Plus, Search, Building, Calendar, DollarSign, Clock,
    UserPlus, Edit2, Trash2, Save, AlertTriangle, CheckCircle,
    XCircle, Info, HelpCircle, ChevronRight, User, Phone, Briefcase, X, Upload, Users
} from 'lucide-react';
import MinimalSelect from '../../components/MinimalSelect';
import DatePicker from '../../components/DatePicker';
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
    const [advanceForm, setAdvanceForm] = useState({ labour_id: '', site_id: '', name: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });

    // Phase 2 States
    const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
    const [bulkSourceSiteId, setBulkSourceSiteId] = useState('All');
    const [bulkDestinationSiteId, setBulkDestinationSiteId] = useState('');
    const [selectedLabourIds, setSelectedLabourIds] = useState([]);
    const [bulkRoleFilter, setBulkRoleFilter] = useState('All');

    const [showBorrowModal, setShowBorrowModal] = useState(false);
    const [borrowSearchQuery, setBorrowSearchQuery] = useState('');

    const [selectedHistoryLabour, setSelectedHistoryLabour] = useState(null);
    const [selectedHistoryLabourDetails, setSelectedHistoryLabourDetails] = useState(null);
    const [labourHistoryData, setLabourHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [historyTab, setHistoryTab] = useState('sites'); // 'sites', 'payouts'
    const [labourPayoutHistory, setLabourPayoutHistory] = useState([]);
    const [payoutForm, setPayoutForm] = useState({
        payout_id: null, labour_id: '', site_id: '', name: '', month: '', wage_type: '', monthly_salary: '',
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
        if (!selectedSite) return;
        try {
            const res = await labourService.getFinancesSummary(selectedSite.site_id);
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

    useEffect(() => {
        if (selectedSite) {
            setAttendanceSiteId(selectedSite.site_id.toString());
            setGridSiteId(selectedSite.site_id.toString());
        }
    }, [selectedSite]);

    const getMaxAttendanceDate = () => {
        if (selectedSite && selectedSite.status === 'Completed' && selectedSite.end_date) {
            const d = new Date(selectedSite.end_date);
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
        }
        return undefined;
    };

    useEffect(() => {
        if (selectedSite && selectedSite.status === 'Completed' && selectedSite.end_date) {
            const maxD = getMaxAttendanceDate();
            if (maxD && attendanceDate > maxD) {
                setAttendanceDate(maxD);
            }
        }
    }, [selectedSite, attendanceDate]);

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
    }, [attendanceSiteId, attendanceDate, gridSiteId, gridMonth, activeTab, selectedSite, subTab]);
    // Bulk upload CSV/Excel handlers
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
    };;

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
            setSelectedHistoryLabourDetails(res.labour || null);
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

    const handleDeleteLabour = (labourId) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Worker Profile',
            message: 'Are you sure you want to delete this labour worker? All history and data will be permanently deleted.',
            onConfirm: async () => {
                try {
                    await labourService.deleteLabour(labourId);
                    toast.success('Labour worker deleted successfully');
                    fetchLabours();
                } catch (err) {
                    toast.error(err.message || 'Failed to delete labour worker');
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
            site_id: selectedSite ? selectedSite.site_id.toString() : 'All',
            name: labour.name,
            amount: '',
            date: new Date().toISOString().split('T')[0],
            notes: '',
            accrued_credit: labour.accrued_credit,
            net_payable: labour.net_payable
        });
        setShowAdvanceModal(true);
    };

    const handleSaveAdvance = async (e) => {
        e.preventDefault();
        try {
            await labourService.logLabourAdvance({
                labour_id: Number(advanceForm.labour_id),
                site_id: advanceForm.site_id,
                amount: Number(advanceForm.amount),
                date: advanceForm.date,
                notes: advanceForm.notes
            });
            toast.success(`Advance logged successfully for ${advanceForm.name}`);
            setShowAdvanceModal(false);
            if (selectedHistoryLabour) {
                handleViewHistory(selectedHistoryLabour);
            } else {
                fetchFinances();
            }
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
            site_id: selectedSite ? selectedSite.site_id.toString() : 'All',
            name: row.name,
            month: monthKey,
            wage_type: row.wage_type,
            monthly_salary: row.monthly_salary,
            present_days: row.attendance?.present || 0,
            half_days: row.attendance?.half_day || 0,
            absent_days: row.attendance?.absent || 0,
            paid_leaves: row.attendance?.paid_leave || 0,
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
                payout_id: payoutForm.payout_id,
                labour_id: Number(payoutForm.labour_id),
                site_id: payoutForm.site_id,
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
            if (selectedHistoryLabour) {
                handleViewHistory(selectedHistoryLabour);
            } else {
                fetchFinances();
            }
        } catch (err) {
            toast.error(err.message || 'Failed to log monthly payout');
        }
    };

    const handleOpenGlobalPayout = () => {
        if (!selectedHistoryLabourDetails) return;
        const lab = selectedHistoryLabourDetails;
        const monthKey = new Date().toISOString().slice(0, 7);
        setPayoutForm({
            payout_id: null,
            labour_id: lab.labour_id,
            site_id: 'All',
            name: lab.name,
            month: monthKey,
            wage_type: lab.wage_type,
            monthly_salary: lab.monthly_salary,
            present_days: 0,
            half_days: 0,
            absent_days: 0,
            paid_leaves: 0,
            accrued_credit: lab.global_earned,
            advances_taken: lab.global_advances,
            net_payable: lab.global_net_payable,
            paid_amount: lab.global_net_payable,
            status: 'Paid',
            payment_date: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setShowPayoutModal(true);
    };

    const handleOpenGlobalAdvance = () => {
        if (!selectedHistoryLabourDetails) return;
        const lab = selectedHistoryLabourDetails;
        setAdvanceForm({
            labour_id: lab.labour_id,
            site_id: 'All',
            name: lab.name,
            amount: '',
            date: new Date().toISOString().split('T')[0],
            notes: '',
            accrued_credit: lab.global_earned,
            net_payable: lab.global_net_payable
        });
        setShowAdvanceModal(true);
    };

    // ==========================================
    // RENDERING
    // ==========================================

    return (
        <DashboardLayout title="Labour Management">
            <div className="space-y-3">

                {/* Upper tab switcher row */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 select-none">
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

                    {/* Action buttons aligned in the same row as the tab bar */}
                    {activeTab === 'directory' && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setSelectedLabourIds([]);
                                    setBulkSourceSiteId('All');
                                    setBulkDestinationSiteId(selectedSite ? String(selectedSite.site_id) : '');
                                    setBulkRoleFilter('All');
                                    setShowBulkTransferModal(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all border border-[#d0d7de] dark:border-[#30363d] cursor-pointer"
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
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                            >
                                <Upload size={14} />
                                <span>Bulk Add Labours</span>
                            </button>
                            <button
                                onClick={() => { setEditingLabour(null); setLabourForm({ name: '', phone: '', sex: 'Male', role: '', wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '' }); setShowLabourModal(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                            >
                                <UserPlus size={14} />
                                <span>Add Labour Worker</span>
                            </button>
                        </div>
                    )}

                    {activeTab === 'sites' && selectedSite === null && (
                        <button
                            onClick={() => { setEditingSite(null); setSiteForm({ site_name: '', location_details: '', status: 'Active' }); setShowSiteModal(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                        >
                            <Plus size={14} />
                            <span>Create Site</span>
                        </button>
                    )}
                </div>

                {activeTab === 'sites' && selectedSite !== null && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-450 dark:text-slate-500 select-none animate-in fade-in duration-200">
                        <span className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors" onClick={() => setSelectedSite(null)}>Sites Overview</span>
                        <ChevronRight size={12} className="text-slate-350 dark:text-slate-700" />
                        <span className="text-slate-700 dark:text-github-dark-text font-bold">{selectedSite.site_name}</span>
                    </div>
                )}

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
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    <div className="flex justify-between items-center bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm">
                                        <div>
                                            <h3 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">Project Construction Sites</h3>
                                            <p className="text-slate-500 dark:text-github-dark-muted dark:text-github-dark-muted text-[11px] mt-0.5">Manage building sites and click a site to access its daily attendance roll call, matrix grid, and salary ledger.</p>
                                        </div>
                                    </div>

                                    {/* Sites Table */}
                                    <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                                        {sites.length === 0 ? (
                                            <div className="border border-dashed border-slate-300 dark:border-github-dark-border rounded-xl p-10 text-center m-4">
                                                <Building className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={32} />
                                                <h4 className="text-xs font-bold text-slate-500">No Construction Sites Found</h4>
                                                <p className="text-[10px] text-slate-400 mt-1">Create a site first to start assigning labour forces.</p>
                                            </div>
                                        ) : (
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-github-dark-border/40 text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                        <th className="p-3">Site Name</th>
                                                        <th className="p-3">Location</th>
                                                        <th className="p-3 text-center">Status</th>
                                                        <th className="p-3 text-center">Workers Assigned</th>
                                                        <th className="p-3">Created On</th>
                                                        <th className="p-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sites.map(site => {
                                                        const assignedCount = labours.filter(l =>
                                                            (l.site_ids && Array.isArray(l.site_ids) && l.site_ids.includes(site.site_id)) ||
                                                            l.site_id === site.site_id
                                                        ).length;
                                                        return (
                                                            <tr
                                                                key={site.site_id}
                                                                onClick={() => setSelectedSite(site)}
                                                                className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 cursor-pointer transition-colors group"
                                                            >
                                                                <td className="p-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center shrink-0">
                                                                            <Building size={13} className="text-indigo-500" />
                                                                        </div>
                                                                        <span className="font-bold text-slate-800 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                                            {site.site_name}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 text-slate-500 dark:text-github-dark-muted max-w-[200px]">
                                                                    <span className="line-clamp-1">{site.location_details || <span className="italic text-slate-400">No details</span>}</span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${site.status === 'Active'
                                                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                            : site.status === 'Completed'
                                                                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                                        }`}>
                                                                        {site.status}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                                                                        <Users size={11} />
                                                                        {assignedCount}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-slate-400 dark:text-github-dark-muted">
                                                                    {new Date(site.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                </td>
                                                                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="flex justify-end gap-1.5">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleEditSite(site); }}
                                                                            className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-github-dark-border transition-colors"
                                                                            title="Edit site"
                                                                        >
                                                                            <Edit2 size={12} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleDeleteSite(site.site_id); }}
                                                                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded border border-slate-200 dark:border-github-dark-border transition-colors"
                                                                            title="Delete site"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Click-to-drill-down site details dashboard */
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border px-4 py-3 rounded-xl shadow-sm flex items-center justify-between gap-3 flex-wrap">
                                        {/* Left: site name + status */}
                                        <div className="flex items-center gap-2.5 shrink-0">
                                            <h3 className="font-extrabold text-sm text-slate-800 dark:text-github-dark-text">{selectedSite.site_name}</h3>
                                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${selectedSite.status === 'Active'
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {selectedSite.status}
                                            </span>
                                        </div>

                                        {/* Right: filters + tab switcher in one aligned row */}
                                        <div className="flex items-center gap-2 flex-wrap ml-auto">
                                            {/* Context-sensitive filters — same height as tabs (py-1.5) */}
                                            {subTab === 'attendance' && (
                                                <>
                                                    <MinimalSelect
                                                        value={attendanceRoleFilter}
                                                        onChange={(val) => setAttendanceRoleFilter(val)}
                                                        options={[
                                                            { value: '', label: 'All Roles' },
                                                            ...((() => { const seen = new Map(); labours.forEach(l => { const r = (l.role || '').trim(); if (r) { const key = r.toLowerCase(); if (!seen.has(key)) seen.set(key, r); } }); return [...seen.values()].sort(); })().map(r => ({ value: r, label: r })))
                                                        ]}
                                                        size="sm"
                                                        triggerClassName="bg-[#f6f8fa] dark:bg-[#161b22] border-[#d0d7de]/70 dark:border-[#30363d]/60 text-slate-700 dark:text-github-dark-text cursor-pointer h-[30px] text-[11px]"
                                                        variant="input"
                                                    />
                                                    <DatePicker
                                                        value={attendanceDate}
                                                        onChange={(val) => setAttendanceDate(val)}
                                                        maxDate={getMaxAttendanceDate()}
                                                        compact={true}
                                                    />
                                                </>
                                            )}
                                            {subTab === 'grid' && (
                                                <>
                                                    <MinimalSelect
                                                        value={gridRoleFilter}
                                                        onChange={(val) => setGridRoleFilter(val)}
                                                        options={[
                                                            { value: '', label: 'All Roles' },
                                                            ...((() => { const seen = new Map(); labours.forEach(l => { const r = (l.role || '').trim(); if (r) { const key = r.toLowerCase(); if (!seen.has(key)) seen.set(key, r); } }); return [...seen.values()].sort(); })().map(r => ({ value: r, label: r })))
                                                        ]}
                                                        size="sm"
                                                        triggerClassName="bg-[#f6f8fa] dark:bg-[#161b22] border-[#d0d7de]/70 dark:border-[#30363d]/60 text-slate-700 dark:text-github-dark-text cursor-pointer h-[30px] text-[11px]"
                                                        variant="input"
                                                    />
                                                    <MonthPicker
                                                        value={gridMonth}
                                                        onChange={(val) => setGridMonth(val)}
                                                        compact={true}
                                                    />
                                                </>
                                            )}
                                             {subTab === 'finances' && (
                                                 <>
                                                     <MinimalSelect
                                                         value={financeRoleFilter}
                                                         onChange={(val) => setFinanceRoleFilter(val)}
                                                         options={[
                                                             { value: '', label: 'All Roles' },
                                                             ...((() => { const seen = new Map(); labours.forEach(l => { const r = (l.role || '').trim(); if (r) { const key = r.toLowerCase(); if (!seen.has(key)) seen.set(key, r); } }); return [...seen.values()].sort(); })().map(r => ({ value: r, label: r })))
                                                         ]}
                                                         size="sm"
                                                         triggerClassName="bg-[#f6f8fa] dark:bg-[#161b22] border-[#d0d7de]/70 dark:border-[#30363d]/60 text-slate-700 dark:text-github-dark-text cursor-pointer h-[30px] text-[11px]"
                                                         variant="input"
                                                     />
                                                 </>
                                             )}

                                            {/* Divider between filters and tabs */}
                                            <div className="h-5 w-px bg-slate-200 dark:bg-[#30363d] shrink-0" />

                                            {/* Tab switcher */}
                                            <div className="flex bg-[#f6f8fa] dark:bg-[#161b22] p-0.5 rounded-lg border border-[#d0d7de]/70 dark:border-[#30363d]/60 select-none shrink-0 shadow-inner">
                                                {[
                                                    { id: 'attendance', label: 'Daily Roll Call', icon: <Calendar size={12} /> },
                                                    { id: 'grid', label: 'Monthly Matrix', icon: <Calendar size={12} /> },
                                                    { id: 'finances', label: 'Salary Ledger', icon: <DollarSign size={12} /> }
                                                ].map((tab) => {
                                                    const isSelected = subTab === tab.id;
                                                    return (
                                                        <button
                                                            key={tab.id}
                                                            onClick={() => setSubTab(tab.id)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 cursor-pointer ${isSelected
                                                                ? 'bg-white dark:bg-slate-800 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                                }`}
                                                        >
                                                            {tab.icon}
                                                            <span>{tab.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Component Renders (filtered for this site) */}
                                    {subTab === 'attendance' && (
                                        <div className="space-y-4 animate-in fade-in duration-150">
                                            {selectedSite?.status === 'Completed' && selectedSite.end_date && (
                                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3.5 rounded-xl text-amber-700 dark:text-amber-400 font-semibold text-xs flex items-center gap-2 shadow-sm">
                                                    <span>⚠️</span>
                                                    <span>
                                                        This site was marked completed on <strong>{new Date(selectedSite.end_date).toLocaleDateString()}</strong>. Attendance is restricted to dates strictly before completion.
                                                    </span>
                                                </div>
                                            )}

                                            {attendanceLoading ? (
                                                <div className="flex justify-center py-20">
                                                    <Clock className="animate-spin text-indigo-500" size={28} />
                                                </div>
                                            ) : (
                                                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                                                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center bg-slate-50/50 dark:bg-github-dark-border/10">
                                                        <div>
                                                            <span className="font-bold text-xs text-slate-800 dark:text-github-dark-text">Daily Roll Call Checklist</span>
                                                            <span className="ml-2 text-[10px] text-slate-500 dark:text-github-dark-muted dark:text-github-dark-muted font-mono">{attendanceRoster.length} workers registered</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedLabourIds([]);
                                                                    setBulkSourceSiteId('All');
                                                                    setBulkDestinationSiteId(selectedSite ? String(selectedSite.site_id) : '');
                                                                    setBulkRoleFilter('All');
                                                                    setShowBulkTransferModal(true);
                                                                }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer border border-[#d0d7de] dark:border-[#30363d]"
                                                            >
                                                                <Building size={14} />
                                                                <span>Bulk Import</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setShowBorrowModal(true)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer border border-[#d0d7de] dark:border-[#30363d]"
                                                            >
                                                                <Plus size={14} />
                                                                <span>Add Worker</span>
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

                                                    <motion.div
                                                        key={`attendance-${attendanceRoleFilter}-${attendanceDate}`}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.18, ease: 'easeOut' }}
                                                        className="overflow-x-auto"
                                                    >
                                                        <table className="w-full text-left border-collapse text-xs">
                                                            <thead>
                                                                <tr className="bg-slate-50/50 dark:bg-github-dark-border/20 text-slate-500 dark:text-github-dark-muted dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                                    <th className="p-3">Worker Name</th>
                                                                    <th className="p-3">Role</th>
                                                                    <th className="p-3">Wage Model</th>
                                                                    <th className="p-3 text-center">Status Assignment</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {attendanceRoster.filter(r => !attendanceRoleFilter || r.role.toLowerCase() === attendanceRoleFilter.toLowerCase()).length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan="4" className="p-10 text-center text-slate-400 italic">No labours assigned to this site or matching the role filter.</td>
                                                                    </tr>
                                                                ) : (
                                                                    attendanceRoster
                                                                        .filter(r => !attendanceRoleFilter || r.role.toLowerCase() === attendanceRoleFilter.toLowerCase())
                                                                        .map(item => (
                                                                            <tr key={item.labour_id} className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-slate-50/20 dark:hover:bg-slate-800/10 relative">
                                                                                <td className="p-3 font-semibold text-slate-800 dark:text-github-dark-text">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span>{item.name}</span>
                                                                                        {item.is_borrowed && (
                                                                                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-extrabold text-[8px] uppercase tracking-wider">Added</span>
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
                                                                                            ...(item.wage_type === 'Fixed Salary' ? [{ id: 'Paid Leave', label: 'Paid Leave', activeColor: 'bg-indigo-500 text-white dark:bg-indigo-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' }] : [])
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
                                                    </motion.div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {subTab === 'grid' && (
                                        <div className="space-y-4 animate-in fade-in duration-150">

                                            {gridLoading ? (
                                                <div className="flex justify-center py-20">
                                                    <Clock className="animate-spin text-indigo-500" size={28} />
                                                </div>
                                            ) : (
                                                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                                                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#010409]/40 flex justify-between items-center">
                                                        <span className="font-bold text-xs text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Attendance Grid Matrix</span>
                                                        {gridMonthDetails && (
                                                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase font-mono">
                                                                {getMonthNameAndYear(gridMonthDetails.month + "-01")}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <motion.div
                                                        key={`grid-${gridRoleFilter}-${gridMonth}`}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.18, ease: 'easeOut' }}
                                                        className="overflow-x-auto no-scrollbar" style={{ isolation: 'isolate' }}
                                                    >
                                                        <table className="w-full text-left border-collapse text-xs whitespace-nowrap" style={{ minWidth: 'max-content' }}>
                                                            <thead className="sticky top-0 z-30">
                                                                <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border">
                                                                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-github-dark-muted sticky left-0 bg-slate-50 dark:bg-[#161b22] z-40 min-w-[230px] border-r border-slate-200 dark:border-github-dark-border" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.10)' }}>Worker Name / Designation</th>
                                                                    {getDaysInMonthArray().map(day => {
                                                                        const d = new Date(day.dateStr + 'T00:00:00Z');
                                                                        return (
                                                                            <th key={day.dateStr} className="py-2 px-1 text-center min-w-[52px]">
                                                                                <div className="text-[8px] uppercase text-slate-400 leading-none tracking-wider">{d.toLocaleString('en-US', { month: 'short' })}</div>
                                                                                <div className="text-sm font-black text-slate-700 dark:text-white leading-tight">{d.getUTCDate()}</div>
                                                                                <div className="text-[8px] uppercase text-slate-400 leading-none tracking-wider">{d.toLocaleString('en-US', { weekday: 'short' })}</div>
                                                                            </th>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-github-dark-border">
                                                                {gridData.filter(row => !gridRoleFilter || row.role.toLowerCase() === gridRoleFilter.toLowerCase()).length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan={getDaysInMonthArray().length + 1} className="p-10 text-center text-slate-400 italic bg-white dark:bg-dark-card">No attendance matrix records found matching the filter.</td>
                                                                    </tr>
                                                                ) : (
                                                                    gridData
                                                                        .filter(row => !gridRoleFilter || row.role.toLowerCase() === gridRoleFilter.toLowerCase())
                                                                        .map(row => {
                                                                            const initials = row.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                                                            return (
                                                                                <tr key={row.labour_id} className="hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors group">
                                                                                    <td className="px-5 py-3.5 sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-[#1c2128] transition-colors z-10 border-r border-slate-200 dark:border-github-dark-border" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.08)' }}>
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shadow-inner shrink-0">
                                                                                                {initials || <User size={14} />}
                                                                                            </div>
                                                                                            <div>
                                                                                                <span className="block font-bold text-slate-800 dark:text-github-dark-text text-sm leading-tight">{row.name}</span>
                                                                                                <span className="block text-[10px] font-medium text-slate-400 dark:text-github-dark-muted mt-0.5">{row.role}</span>
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
                                                                                            <td key={day.dateStr} className="px-1 py-3 text-center align-middle">
                                                                                                <div className="flex justify-center items-center">
                                                                                                    <span
                                                                                                        className={`w-8 h-8 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all inline-flex items-center justify-center shadow-sm ${getStatusColor(status)}`}
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
                                                    </motion.div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {subTab === 'finances' && (
                                        <div className="space-y-4 animate-in fade-in duration-150">

                                            <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                                                <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#010409]/40 flex justify-between items-center">
                                                    <span className="font-bold text-xs text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Salary Ledger — {getMonthNameAndYear(financeMonth + '-01')}</span>
                                                </div>

                                                <motion.div
                                                    key={`finances-${financeRoleFilter}-${financeMonth}`}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.18, ease: 'easeOut' }}
                                                    className="overflow-x-auto"
                                                >
                                                     <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                                         <thead>
                                                             <tr className="bg-slate-50/50 dark:bg-github-dark-border/20 text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border text-[11px]">
                                                                 <th className="p-3 text-left">Worker Name</th>
                                                                 <th className="p-3 text-left">Role</th>
                                                                 <th className="p-3 text-left">Wage Type</th>
                                                                 <th className="p-3 text-right">Total Earned</th>
                                                                 <th className="p-3 text-right">Total Paid</th>
                                                                 <th className="p-3 text-right">Accrued to Pay</th>
                                                                 <th className="p-3 text-right">Advances Taken</th>
                                                                 <th className="p-3 text-right">Final Net Payable</th>
                                                                 <th className="p-3 text-right">Actions</th>
                                                             </tr>
                                                         </thead>
                                                         <tbody>
                                                             {financeSummary.filter(row => {
                                                                 const matchesSite = (row.site_ids && Array.isArray(row.site_ids) && row.site_ids.includes(selectedSite.site_id)) || row.site_id === selectedSite.site_id;
                                                                 const matchesRole = !financeRoleFilter || row.role.toLowerCase() === financeRoleFilter.toLowerCase();
                                                                 return matchesSite && matchesRole;
                                                             }).length === 0 ? (
                                                                 <tr>
                                                                     <td colSpan="9" className="p-10 text-center text-slate-400 italic">No salary ledger details for workers assigned to this site.</td>
                                                                 </tr>
                                                             ) : (
                                                                 financeSummary
                                                                     .filter(row => {
                                                                         const matchesSite = (row.site_ids && Array.isArray(row.site_ids) && row.site_ids.includes(selectedSite.site_id)) || row.site_id === selectedSite.site_id;
                                                                         const matchesRole = !financeRoleFilter || row.role.toLowerCase() === financeRoleFilter.toLowerCase();
                                                                         return matchesSite && matchesRole;
                                                                     })
                                                                     .map(row => {
                                                                         const advanceAlert = row.advances_taken > row.net_earned;
                                                                         return (
                                                                             <tr key={row.labour_id} className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-slate-50/20 dark:hover:bg-slate-800/10 align-middle">
                                                                                 <td className="p-3 font-bold text-slate-800 dark:text-github-dark-text whitespace-nowrap">{row.name}</td>
                                                                                 <td className="p-3">
                                                                                     <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.role}</span>
                                                                                 </td>
                                                                                 <td className="p-3">
                                                                                     <div className="flex flex-col items-start gap-1">
                                                                                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${row.wage_type === 'Fixed Salary'
                                                                                             ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                                                             : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                                             }`}>
                                                                                             {row.wage_type}
                                                                                         </span>
                                                                                         <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">Base: ₹{row.monthly_salary.toLocaleString()}</span>
                                                                                     </div>
                                                                                 </td>
                                                                                 <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">₹{row.accrued_credit.toLocaleString()}</td>
                                                                                 <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">₹{row.total_paid.toLocaleString()}</td>
                                                                                 <td className="p-3 font-semibold text-indigo-600 dark:text-indigo-400 text-right whitespace-nowrap">₹{row.net_earned.toLocaleString()}</td>
                                                                                 <td className={`p-3 font-semibold text-right whitespace-nowrap ${advanceAlert ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                                     <div className="flex items-center justify-end gap-1">
                                                                                         <span>₹{row.advances_taken.toLocaleString()}</span>
                                                                                         {advanceAlert && <AlertTriangle size={12} className="text-rose-500 animate-pulse" title="Advances exceed earned credit" />}
                                                                                     </div>
                                                                                 </td>
                                                                                 <td className={`p-3 font-extrabold text-xs text-right whitespace-nowrap ${row.net_payable < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                                                     ₹{row.net_payable.toLocaleString()}
                                                                                 </td>
                                                                                 <td className="p-3 text-right">
                                                                                     <div className="flex justify-end items-center gap-2 flex-nowrap">
                                                                                         {row.net_payable <= 0 ? (
                                                                                             <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                                                                 <CheckCircle size={10} /> Settled
                                                                                             </span>
                                                                                         ) : (
                                                                                             <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                                                                                 <Clock size={10} /> Pending
                                                                                             </span>
                                                                                         )}
                                                                                         <button
                                                                                             onClick={() => handleOpenAdvance(row)}
                                                                                             className="px-2.5 py-1 text-[10px] font-black bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded transition-all cursor-pointer whitespace-nowrap"
                                                                                         >
                                                                                             Advance
                                                                                         </button>
                                                                                         <button
                                                                                             onClick={() => handleOpenPayout(row)}
                                                                                             disabled={row.net_payable <= 0}
                                                                                             className={`px-2.5 py-1 text-[10px] font-black rounded border transition-all cursor-pointer whitespace-nowrap ${row.net_payable <= 0
                                                                                                 ? 'bg-slate-105 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'
                                                                                                 : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                                                                                                 }`}
                                                                                         >
                                                                                             Release Salary
                                                                                         </button>
                                                                                     </div>
                                                                                 </td>
                                                                             </tr>
                                                                         );
                                                                     })
                                                             )}
                                                         </tbody>
                                                     </table>
                                                </motion.div>
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
                            <div className="space-y-3 animate-in fade-in duration-200">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm">
                                    <div>
                                        <h3 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">Labour Force Directory</h3>
                                        <p className="text-slate-500 dark:text-github-dark-muted dark:text-github-dark-muted text-[11px] mt-0.5">Manage details, site assignments, monthly payouts, and logs for construction workers.</p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                        <div className="relative w-full sm:w-52">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search by name..."
                                                value={labourSearch}
                                                onChange={(e) => setLabourSearch(e.target.value)}
                                                className="pl-9 pr-4 py-1.5 w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none"
                                            />
                                        </div>
                                        <MinimalSelect
                                            value={labourRoleFilter}
                                            onChange={(val) => setLabourRoleFilter(val)}
                                            options={[
                                                { value: '', label: 'All Roles' },
                                                ...((() => { const seen = new Map(); labours.forEach(l => { const r = (l.role || '').trim(); if (r) { const key = r.toLowerCase(); if (!seen.has(key)) seen.set(key, r); } }); return [...seen.values()].sort(); })().map(r => ({ value: r, label: r })))
                                            ]}
                                            size="sm"
                                            triggerClassName="bg-slate-50 dark:bg-github-dark-subtle/50 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-github-dark-text cursor-pointer"
                                            variant="input"
                                        />
                                        <MinimalSelect
                                            value={labourSiteFilter}
                                            onChange={(val) => setLabourSiteFilter(val)}
                                            options={[
                                                { value: 'All', label: 'All Sites' },
                                                { value: 'Unassigned', label: 'Unassigned' },
                                                ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                            ]}
                                            size="sm"
                                            triggerClassName="bg-slate-50 dark:bg-github-dark-subtle/50 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-github-dark-text cursor-pointer"
                                            variant="input"
                                        />
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-github-dark-border/40 text-slate-500 dark:text-github-dark-muted dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                <th className="p-3">Labour Name</th>
                                                <th className="p-3">Phone Number</th>
                                                <th className="p-3">Gender</th>
                                                <th className="p-3">Role / Designation</th>
                                                <th className="p-3">Assigned Site</th>
                                                <th className="p-3">Daily Wage</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {labours
                                                .filter(lab => {
                                                    const matchesSearch = lab.name.toLowerCase().includes(labourSearch.toLowerCase());
                                                    const matchesRole = !labourRoleFilter || lab.role.toLowerCase() === labourRoleFilter.toLowerCase();

                                                    let matchesSite = true;
                                                    if (labourSiteFilter === 'Unassigned') {
                                                        const hasNoSites = (!lab.site_ids || lab.site_ids.length === 0) && lab.site_id === null;
                                                        matchesSite = hasNoSites;
                                                    } else if (labourSiteFilter !== 'All') {
                                                        const siteIdNum = Number(labourSiteFilter);
                                                        matchesSite = (lab.site_ids && Array.isArray(lab.site_ids) && lab.site_ids.includes(siteIdNum)) ||
                                                            lab.site_id === siteIdNum;
                                                    }

                                                    return matchesSearch && matchesRole && matchesSite;
                                                })
                                                .map(lab => (
                                                    <tr key={lab.labour_id} className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                                                        <td className="p-3 font-semibold text-slate-800 dark:text-github-dark-text cursor-pointer hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-400" onClick={() => handleViewHistory(lab)}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span>{lab.name}</span>
                                                                <Info size={12} className="text-slate-400" />
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-slate-655 dark:text-slate-400 font-mono">{lab.phone || 'No phone'}</td>
                                                        <td className="p-3 text-slate-655 dark:text-slate-400">{lab.sex}</td>
                                                        <td className="p-3 text-slate-650 dark:text-slate-400">{lab.role}</td>
                                                        <td className="p-3 text-slate-650 dark:text-slate-400">
                                                            {(() => {
                                                                // Build list of assigned site names
                                                                const assignedSites = lab.site_ids && Array.isArray(lab.site_ids) && lab.site_ids.length > 0
                                                                    ? lab.site_ids.map(sid => {
                                                                        const found = sites.find(s => s.site_id === sid);
                                                                        return found ? found.site_name : null;
                                                                    }).filter(Boolean)
                                                                    : (lab.site_name ? [lab.site_name] : []);

                                                                if (assignedSites.length === 0) {
                                                                    return <span className="text-amber-500 italic">Unassigned</span>;
                                                                }
                                                                return (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {assignedSites.map((sn, i) => (
                                                                            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                                                                                <Building size={10} className="text-slate-400" />
                                                                                {sn}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="p-3 font-medium text-slate-700 dark:text-github-dark-text dark:text-slate-300">
                                                            ₹{Number(lab.monthly_salary).toLocaleString()}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex justify-end gap-1.5">
                                                                <button
                                                                    onClick={() => handleEditLabour(lab)}
                                                                    className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-github-dark-border"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteLabour(lab.labour_id)}
                                                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-955/20 text-red-500 rounded border border-slate-200 dark:border-github-dark-border/40 dark:border-github-dark-border"
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
                                        <button onClick={() => setShowSiteModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                    </div>
                                    <form onSubmit={handleSaveSite} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar">
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-2">Site Name</label>
                                            <input
                                                type="text"
                                                value={siteForm.site_name}
                                                onChange={(e) => setSiteForm({ ...siteForm, site_name: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                                required
                                                placeholder="e.g., Phoenix Mall Project"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-2">Location Details / Address</label>
                                            <textarea
                                                value={siteForm.location_details}
                                                onChange={(e) => setSiteForm({ ...siteForm, location_details: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                                rows={4}
                                                placeholder="Site physical address, gate number, coordinates, or notes."
                                            />
                                        </div>
                                        {editingSite && (
                                            <div>
                                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-2">Status</label>
                                                <MinimalSelect
                                                    value={siteForm.status}
                                                    onChange={(val) => setSiteForm({ ...siteForm, status: val })}
                                                    options={[
                                                        { value: 'Active', label: 'Active' },
                                                        { value: 'Completed', label: 'Completed' },
                                                        { value: 'Inactive', label: 'Inactive' }
                                                    ]}
                                                    triggerClassName="w-full justify-between"
                                                    variant="input"
                                                />
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
                                        <button onClick={() => setShowLabourModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                    </div>
                                    <form onSubmit={handleSaveLabour} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Labour Full Name</label>
                                            <input
                                                type="text"
                                                value={labourForm.name}
                                                onChange={(e) => setLabourForm({ ...labourForm, name: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                                required
                                                placeholder="e.g., Ramesh Kumar"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Contact Phone</label>
                                            <input
                                                type="tel"
                                                value={labourForm.phone}
                                                onChange={(e) => setLabourForm({ ...labourForm, phone: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                                placeholder="10-digit mobile number"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Sex</label>
                                            <MinimalSelect
                                                value={labourForm.sex}
                                                onChange={(val) => setLabourForm({ ...labourForm, sex: val })}
                                                options={[
                                                    { value: 'Male', label: 'Male' },
                                                    { value: 'Female', label: 'Female' },
                                                    { value: 'Other', label: 'Other' }
                                                ]}
                                                triggerClassName="w-full justify-between"
                                                variant="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Role</label>
                                            <input
                                                type="text"
                                                value={labourForm.role}
                                                onChange={(e) => setLabourForm({ ...labourForm, role: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                                required
                                                placeholder="e.g., Mason, Carpenter, Helper"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Assign Construction Site</label>
                                            <MinimalSelect
                                                value={labourForm.site_id}
                                                onChange={(val) => setLabourForm({ ...labourForm, site_id: val })}
                                                options={[
                                                    { value: '', label: 'Unassigned / Independent' },
                                                    ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                ]}
                                                triggerClassName="w-full justify-between"
                                                variant="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Daily Wage (INR)</label>
                                            <input
                                                type="number"
                                                value={labourForm.monthly_salary}
                                                onChange={(e) => setLabourForm({ ...labourForm, monthly_salary: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                                required
                                                min="0"
                                                placeholder="e.g., 600"
                                            />
                                        </div>
                                        {editingLabour && (
                                            <div>
                                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Status</label>
                                                <MinimalSelect
                                                    value={labourForm.status}
                                                    onChange={(val) => setLabourForm({ ...labourForm, status: val })}
                                                    options={[
                                                        { value: 'Active', label: 'Active' },
                                                        { value: 'Inactive', label: 'Inactive' }
                                                    ]}
                                                    triggerClassName="w-full justify-between"
                                                    variant="input"
                                                />
                                            </div>
                                        )}

                                        <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                            <button
                                                type="button"
                                                onClick={() => setShowLabourModal(false)}
                                                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
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
                                        <button onClick={() => setShowAdvanceModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                    </div>
                                    <form onSubmit={handleSaveAdvance} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 p-3 rounded-lg text-slate-600 dark:text-slate-350">
                                            Logging salary advance for <strong>{advanceForm.name}</strong>. This amount will be automatically deducted from their next payroll payroll payout credit.
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Target Site</label>
                                            <MinimalSelect
                                                value={advanceForm.site_id}
                                                onChange={(val) => setAdvanceForm({ ...advanceForm, site_id: val })}
                                                options={[
                                                    { value: 'All', label: 'All Sites (Global / Unallocated)' },
                                                    ...sites.map(s => ({ value: s.site_id.toString(), label: s.site_name }))
                                                ]}
                                                triggerClassName="w-full justify-between"
                                                variant="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Advance Amount (INR)</label>
                                            {advanceForm.amount && Number(advanceForm.amount) > Number(advanceForm.net_payable || 0) && (
                                                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 p-3 rounded-lg text-rose-700 dark:text-rose-400 font-bold text-[11px] animate-in fade-in duration-200 flex items-start gap-1.5 shadow-sm mb-2">
                                                    <span>⚠️</span>
                                                    <span>
                                                        Warning: Advance amount (₹{Number(advanceForm.amount).toLocaleString()}) exceeds the worker's net payable balance (₹{Number(advanceForm.net_payable || 0).toLocaleString()}).
                                                    </span>
                                                </div>
                                            )}
                                            <input
                                                type="number"
                                                value={advanceForm.amount}
                                                onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                                required
                                                min="1"
                                                placeholder="e.g., 2000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Logging Date</label>
                                            <input
                                                type="date"
                                                value={advanceForm.date}
                                                onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-lg focus:outline-none focus:border-indigo-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Notes / Description</label>
                                            <input
                                                type="text"
                                                value={advanceForm.notes}
                                                onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
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
                                        <button onClick={() => setShowPayoutModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                    </div>
                                    <form onSubmit={handleSavePayout} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                        <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/40 p-3 rounded-lg text-slate-600 dark:text-slate-500 dark:text-github-dark-muted space-y-1">
                                            <div>Processing salary payout for <strong>{payoutForm.name}</strong></div>
                                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">Wage Type: {payoutForm.wage_type} | Month: {payoutForm.month}</div>
                                        </div>
                                            
                                        {/* Target Site Dropdown */}
                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Target Site</label>
                                            <MinimalSelect
                                                value={payoutForm.site_id}
                                                onChange={(val) => setPayoutForm({ ...payoutForm, site_id: val })}
                                                options={[
                                                    { value: 'All', label: 'All Sites (Auto-Distribute)' },
                                                    ...sites.map(s => ({ value: s.site_id.toString(), label: s.site_name }))
                                                ]}
                                                triggerClassName="w-full justify-between"
                                                variant="input"
                                            />
                                        </div>

                                        {/* Earnings Summary Grid */}
                                        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-[#161b22] p-3 rounded-lg border border-slate-200 dark:border-github-dark-border text-[11px]">
                                            <div className="space-y-1 col-span-2">
                                                <div className="text-slate-400 mb-1">Attendance Summary:</div>
                                                <div className="flex flex-wrap gap-1">
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                                        {payoutForm.present_days} Present
                                                    </span>
                                                    {payoutForm.half_days > 0 && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                                            {payoutForm.half_days} Half Day
                                                        </span>
                                                    )}
                                                    {payoutForm.paid_leaves > 0 && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                                                            {payoutForm.paid_leaves} Paid Leave
                                                        </span>
                                                    )}
                                                    {payoutForm.absent_days > 0 && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                                                            {payoutForm.absent_days} Absent
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-slate-500">Amount Earned:</div>
                                                <div className="font-bold text-slate-700 dark:text-slate-300">₹{payoutForm.accrued_credit.toLocaleString()}</div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-slate-500">Advances Taken:</div>
                                                <div className="font-bold text-amber-600 dark:text-amber-505">-₹{payoutForm.advances_taken.toLocaleString()}</div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-slate-500 dark:text-slate-400 font-bold">Net Payable:</div>
                                                <div className="font-bold text-slate-700 dark:text-slate-300">₹{payoutForm.net_payable.toLocaleString()}</div>
                                            </div>
                                        </div>

                                        {/* Amount to Release — Editable Input */}
                                        <div className="rounded-xl border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] p-4 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Amount to Release</p>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Remaining Balance: ₹{Math.max(0, payoutForm.net_payable - Number(payoutForm.paid_amount || 0)).toLocaleString()}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPayoutForm({ ...payoutForm, paid_amount: payoutForm.net_payable })}
                                                    className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:underline cursor-pointer bg-transparent border-none"
                                                >
                                                    Use Full Payout
                                                </button>
                                            </div>
                                            <div className="relative flex items-center">
                                                <span className="absolute left-3.5 text-slate-400 dark:text-slate-500 font-bold text-sm">₹</span>
                                                <input
                                                    type="number"
                                                    value={payoutForm.paid_amount}
                                                    onChange={(e) => setPayoutForm({ ...payoutForm, paid_amount: e.target.value })}
                                                    className="w-full pl-7 pr-3 py-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-850 dark:text-[#f0f6fc] text-xs font-bold rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                                                    required
                                                    min="1"
                                                    placeholder="Enter release amount"
                                                />
                                            </div>
                                        </div>

                                        {/* Negative balance warning */}
                                        {payoutForm.net_payable < 0 && (
                                            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40">
                                                <AlertTriangle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                                                    Advance taken (₹{payoutForm.advances_taken.toLocaleString()}) exceeds earned credit (₹{payoutForm.accrued_credit.toLocaleString()}). Salary cannot be released until the balance is cleared.
                                                </p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-3">
                                            <div>
                                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Payout Status</label>
                                                <MinimalSelect
                                                    value={payoutForm.status}
                                                    onChange={(val) => setPayoutForm({ ...payoutForm, status: val })}
                                                    options={[
                                                        { value: 'Paid', label: 'Paid' },
                                                        { value: 'Pending', label: 'Pending' }
                                                    ]}
                                                    triggerClassName="w-full justify-between"
                                                    variant="input"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Payment Date</label>
                                            <input
                                                type="date"
                                                value={payoutForm.payment_date}
                                                onChange={(e) => setPayoutForm({ ...payoutForm, payment_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-lg focus:outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Notes / Payment Details</label>
                                            <input
                                                type="text"
                                                value={payoutForm.notes}
                                                onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
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
                                                disabled={payoutForm.net_payable < 0}
                                                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-all"
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
                                    className="relative w-full max-w-xl h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#21262d] z-10"
                                >
                                    {/* ── Header ── */}
                                    <div className="flex-shrink-0">
                                        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 dark:border-[#21262d]">
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc]">Move Workers</h4>
                                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Reassign workers to a different site</p>
                                            </div>
                                            <button
                                                onClick={() => setShowBulkTransferModal(false)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <form onSubmit={handleExecuteBulkTransfer} className="flex-1 overflow-y-auto custom-scrollbar">
                                        {/* ── Site Selector Cards ── */}
                                        <div className="p-5 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                {/* From Site — dynamic dropdown, excludes current site */}
                                                <div className="rounded-xl border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] p-3 space-y-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-4 h-4 rounded-full bg-slate-400/20 dark:bg-slate-600/40 flex items-center justify-center">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                                        </div>
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">From Site</span>
                                                    </div>
                                                    <MinimalSelect
                                                        value={bulkSourceSiteId}
                                                        onChange={(val) => {
                                                            setBulkSourceSiteId(val);
                                                            setSelectedLabourIds([]);
                                                        }}
                                                        options={[
                                                            { value: 'All', label: 'All Sites' },
                                                            { value: 'Unassigned', label: 'Unassigned' },
                                                            ...sites
                                                                .filter(s => !selectedSite || s.site_id !== selectedSite.site_id)
                                                                .map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                        ]}
                                                        triggerClassName="w-full justify-between text-[11px]"
                                                        variant="input"
                                                    />
                                                </div>
                                                {/* Move To — locked to current site if on site view, otherwise free dropdown */}
                                                <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/10 p-3 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-4 h-4 rounded-full bg-indigo-400/20 dark:bg-indigo-600/30 flex items-center justify-center">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Move To</span>
                                                        </div>
                                                        {selectedSite && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">Locked</span>
                                                        )}
                                                    </div>
                                                    {selectedSite ? (
                                                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-indigo-100/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                                                            <Building size={11} className="text-indigo-500 flex-shrink-0" />
                                                            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 truncate">{selectedSite.site_name}</span>
                                                        </div>
                                                    ) : (
                                                        <MinimalSelect
                                                            value={bulkDestinationSiteId}
                                                            onChange={(val) => setBulkDestinationSiteId(val)}
                                                            options={[
                                                                { value: '', label: '-- Select a Site --' },
                                                                { value: 'Unassigned', label: 'No Site (Independent)' },
                                                                ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                            ]}
                                                            triggerClassName="w-full justify-between text-[11px]"
                                                            variant="input"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Divider ── */}
                                        <div className="mx-5 h-px bg-slate-100 dark:bg-[#21262d]" />

                                        {/* ── Role filter + worker list ── */}
                                        <div className="p-5 space-y-3">
                                            {/* Role pills */}
                                            {(() => {
                                                const sourcedLabours = labours.filter(lab => {
                                                    if (bulkSourceSiteId === 'Unassigned') return !lab.site_id;
                                                    if (bulkSourceSiteId !== 'All') return (lab.site_ids && lab.site_ids.includes(Number(bulkSourceSiteId))) || lab.site_id === Number(bulkSourceSiteId);
                                                    return true;
                                                });
                                                const roles = [...new Map(sourcedLabours.map(l => [(l.role || '').trim().toLowerCase(), (l.role || '').trim()]).filter(([k]) => k)).values()];
                                                return (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setBulkRoleFilter('All')}
                                                            className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${bulkRoleFilter === 'All'
                                                                    ? 'bg-indigo-600 text-white border-transparent shadow-sm shadow-indigo-500/30'
                                                                    : 'bg-white dark:bg-[#21262d] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#30363d] hover:border-indigo-300 dark:hover:border-indigo-700'
                                                                }`}
                                                        >
                                                            All &nbsp;<span className="opacity-70">{sourcedLabours.length}</span>
                                                        </button>
                                                        {roles.sort().map(role => {
                                                            const count = sourcedLabours.filter(l => (l.role || '').trim().toLowerCase() === role.toLowerCase()).length;
                                                            const isActive = bulkRoleFilter === role;
                                                            return (
                                                                <button
                                                                    key={role}
                                                                    type="button"
                                                                    onClick={() => setBulkRoleFilter(isActive ? 'All' : role)}
                                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${isActive
                                                                            ? 'bg-indigo-600 text-white border-transparent shadow-sm shadow-indigo-500/30'
                                                                            : 'bg-white dark:bg-[#21262d] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#30363d] hover:border-indigo-300 dark:hover:border-indigo-700'
                                                                        }`}
                                                                >
                                                                    {role} &nbsp;<span className="opacity-70">{count}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}

                                            {/* List header */}
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Choose workers to move</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const filtered = labours.filter(lab => {
                                                            const siteMatch = bulkSourceSiteId === 'Unassigned' ? !lab.site_id
                                                                : bulkSourceSiteId !== 'All' ? ((lab.site_ids && lab.site_ids.includes(Number(bulkSourceSiteId))) || lab.site_id === Number(bulkSourceSiteId))
                                                                    : true;
                                                            const roleMatch = bulkRoleFilter === 'All' || (lab.role || '').trim().toLowerCase() === bulkRoleFilter.toLowerCase();
                                                            return siteMatch && roleMatch;
                                                        });
                                                        const allSelected = filtered.every(l => selectedLabourIds.includes(l.labour_id));
                                                        if (allSelected) {
                                                            setSelectedLabourIds(prev => prev.filter(id => !filtered.map(l => l.labour_id).includes(id)));
                                                        } else {
                                                            setSelectedLabourIds(prev => [...new Set([...prev, ...filtered.map(l => l.labour_id)])]);
                                                        }
                                                    }}
                                                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                                                >
                                                    {bulkRoleFilter === 'All' ? 'Select / Remove All' : `Select All ${bulkRoleFilter}s`}
                                                </button>
                                            </div>

                                            {/* Worker list */}
                                            {(() => {
                                                const filtered = labours.filter(lab => {
                                                    const siteMatch = bulkSourceSiteId === 'Unassigned' ? !lab.site_id
                                                        : bulkSourceSiteId !== 'All' ? ((lab.site_ids && lab.site_ids.includes(Number(bulkSourceSiteId))) || lab.site_id === Number(bulkSourceSiteId))
                                                            : true;
                                                    const roleMatch = bulkRoleFilter === 'All' || (lab.role || '').trim().toLowerCase() === bulkRoleFilter.toLowerCase();
                                                    return siteMatch && roleMatch;
                                                });

                                                if (filtered.length === 0) {
                                                    return (
                                                        <div className="rounded-xl border border-dashed border-slate-200 dark:border-[#30363d] p-8 text-center">
                                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#21262d] flex items-center justify-center mx-auto mb-2">
                                                                <Building size={18} className="text-slate-400" />
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 dark:text-slate-500">No workers found for the selected site / job type.</p>
                                                        </div>
                                                    );
                                                }

                                                const grouped = filtered.reduce((acc, lab) => {
                                                    const role = (lab.role || '').trim() || 'No Role';
                                                    if (!acc[role]) acc[role] = [];
                                                    acc[role].push(lab);
                                                    return acc;
                                                }, {});

                                                const roleColorMap = {};
                                                const roleColors = [
                                                    'indigo', 'violet', 'emerald', 'amber', 'rose', 'sky', 'teal', 'orange'
                                                ];
                                                Object.keys(grouped).sort().forEach((role, i) => {
                                                    roleColorMap[role] = roleColors[i % roleColors.length];
                                                });

                                                const colorClasses = {
                                                    indigo: { badge: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50', header: 'from-indigo-500/10 to-transparent dark:from-indigo-500/8', dot: 'bg-indigo-500', avatar: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300' },
                                                    violet: { badge: 'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50', header: 'from-violet-500/10 to-transparent dark:from-violet-500/8', dot: 'bg-violet-500', avatar: 'bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300' },
                                                    emerald: { badge: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', header: 'from-emerald-500/10 to-transparent dark:from-emerald-500/8', dot: 'bg-emerald-500', avatar: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300' },
                                                    amber: { badge: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', header: 'from-amber-500/10 to-transparent dark:from-amber-500/8', dot: 'bg-amber-500', avatar: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300' },
                                                    rose: { badge: 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50', header: 'from-rose-500/10 to-transparent dark:from-rose-500/8', dot: 'bg-rose-500', avatar: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300' },
                                                    sky: { badge: 'bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/50', header: 'from-sky-500/10 to-transparent dark:from-sky-500/8', dot: 'bg-sky-500', avatar: 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300' },
                                                    teal: { badge: 'bg-teal-100 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/50', header: 'from-teal-500/10 to-transparent dark:from-teal-500/8', dot: 'bg-teal-500', avatar: 'bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-300' },
                                                    orange: { badge: 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50', header: 'from-orange-500/10 to-transparent dark:from-orange-500/8', dot: 'bg-orange-500', avatar: 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-300' },
                                                };

                                                return (
                                                    <div className="space-y-2">
                                                        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([role, workers]) => {
                                                            const allRoleSelected = workers.every(w => selectedLabourIds.includes(w.labour_id));
                                                            const someRoleSelected = workers.some(w => selectedLabourIds.includes(w.labour_id));
                                                            const clr = colorClasses[roleColorMap[role]] || colorClasses.indigo;
                                                            const selectedCount = workers.filter(w => selectedLabourIds.includes(w.labour_id)).length;
                                                            return (
                                                                <div key={role} className="rounded-xl border border-slate-200 dark:border-[#21262d] overflow-hidden">
                                                                    {/* Role group header */}
                                                                    <div className={`flex items-center justify-between px-3 py-2 bg-gradient-to-r ${clr.header} bg-slate-50 dark:bg-[#161b22] border-b border-slate-100 dark:border-[#21262d]`}>
                                                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={allRoleSelected}
                                                                                ref={el => { if (el) el.indeterminate = !allRoleSelected && someRoleSelected; }}
                                                                                onChange={() => {
                                                                                    if (allRoleSelected) {
                                                                                        setSelectedLabourIds(prev => prev.filter(id => !workers.map(w => w.labour_id).includes(id)));
                                                                                    } else {
                                                                                        setSelectedLabourIds(prev => [...new Set([...prev, ...workers.map(w => w.labour_id)])]);
                                                                                    }
                                                                                }}
                                                                                className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer"
                                                                            />
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className={`w-1.5 h-1.5 rounded-full ${clr.dot}`} />
                                                                                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{role}</span>
                                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${clr.badge}`}>{workers.length}</span>
                                                                            </div>
                                                                        </label>
                                                                        {selectedCount > 0 && (
                                                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                                                                                {selectedCount} chosen
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {/* Workers in this role */}
                                                                    <div className="divide-y divide-slate-100 dark:divide-[#21262d]/80 bg-white dark:bg-[#0d1117]">
                                                                        {workers.map(lab => {
                                                                            const isChecked = selectedLabourIds.includes(lab.labour_id);
                                                                            const initials = (lab.name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                                                            return (
                                                                                <label
                                                                                    key={lab.labour_id}
                                                                                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all ${isChecked
                                                                                            ? 'bg-indigo-50/70 dark:bg-indigo-950/15'
                                                                                            : 'hover:bg-slate-50 dark:hover:bg-[#161b22]/60'
                                                                                        }`}
                                                                                >
                                                                                    {/* Custom checkbox */}
                                                                                    <div className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 border transition-all ${isChecked
                                                                                            ? 'bg-indigo-600 border-indigo-600 shadow-sm shadow-indigo-500/30'
                                                                                            : 'border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22]'
                                                                                        }`}>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isChecked}
                                                                                            onChange={(e) => {
                                                                                                if (e.target.checked) {
                                                                                                    setSelectedLabourIds(prev => [...prev, lab.labour_id]);
                                                                                                } else {
                                                                                                    setSelectedLabourIds(prev => prev.filter(id => id !== lab.labour_id));
                                                                                                }
                                                                                            }}
                                                                                            className="sr-only"
                                                                                        />
                                                                                        {isChecked && (
                                                                                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                                                                                <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                                            </svg>
                                                                                        )}
                                                                                    </div>
                                                                                    {/* Avatar */}
                                                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${clr.avatar}`}>
                                                                                        {initials}
                                                                                    </div>
                                                                                    {/* Info */}
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className={`text-xs font-semibold truncate transition-colors ${isChecked ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-[#f0f6fc]'
                                                                                            }`}>{lab.name}</p>
                                                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{lab.site_name || 'No Site Assigned'}</p>
                                                                                    </div>
                                                                                    {isChecked && (
                                                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                                                                    )}
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </form>

                                    {/* ── Sticky Action Bar ── */}
                                    <div className="flex-shrink-0 p-4 border-t border-slate-100 dark:border-[#21262d] bg-white/90 dark:bg-[#0d1117]/90 backdrop-blur-sm">
                                        {selectedLabourIds.length > 0 && (
                                            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                                                <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-[9px] font-black text-white">{selectedLabourIds.length}</span>
                                                </div>
                                                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                                                    {selectedLabourIds.length} worker{selectedLabourIds.length !== 1 ? 's' : ''} selected to move
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setShowBulkTransferModal(false)}
                                                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#21262d] text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#30363d] transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                form="bulk-transfer-form"
                                                disabled={selectedLabourIds.length === 0}
                                                onClick={handleExecuteBulkTransfer}
                                                className="flex-[2] px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Building size={13} />
                                                Move {selectedLabourIds.length > 0 ? `${selectedLabourIds.length} ` : ''}Workers
                                            </button>
                                        </div>
                                    </div>
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
                                    className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-github-dark-border/40 dark:border-[#30363d] z-10"
                                >
                                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                                        <div className="flex items-center gap-1.5">
                                            <Plus size={16} className="text-indigo-500" />
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">Add Worker from Master Data</h4>
                                        </div>
                                        <button onClick={() => setShowBorrowModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search worker by name or designation..."
                                                value={borrowSearchQuery}
                                                onChange={(e) => setBorrowSearchQuery(e.target.value)}
                                                className="pl-9 pr-4 py-2 w-full bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
                                                            <span className="font-bold text-slate-800 dark:text-github-dark-text dark:text-[#f0f6fc] block">{lab.name}</span>
                                                            <span className="text-[10px] text-slate-400 font-mono">{lab.role} | Default: {lab.site_name || 'Independent'}</span>
                                                        </div>
                                                        <button className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 dark:text-indigo-400 rounded text-[10px] font-black cursor-pointer">
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
                                                    <div className="p-8 text-center text-slate-400 italic">No workers found.</div>
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
                                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-github-dark-border bg-amber-500/10 text-amber-800 dark:text-amber-400">
                                        <div className="flex items-center gap-1.5">
                                            <AlertTriangle size={18} />
                                            <h4 className="font-bold text-sm uppercase tracking-wider">Site Closure Reassignment</h4>
                                        </div>
                                        <button onClick={() => setShowSiteClosurePrompt(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                    </div>
                                    <form onSubmit={handleConfirmSiteClosure} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                                        <div className="text-slate-600 dark:text-slate-500 dark:text-github-dark-muted space-y-2">
                                            <p>
                                                You are marking the site <strong>{closureSiteName}</strong> as <strong>{siteStatusToSave}</strong>.
                                            </p>
                                            <p>
                                                There are currently <strong>{closureLabours.length} active workers</strong> assigned to this site. Please choose a new construction site to transfer them to:
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-slate-505 dark:text-slate-300 font-semibold mb-1">Select Destination Site</label>
                                            <MinimalSelect
                                                value={closureDestinationSiteId}
                                                onChange={(val) => setClosureDestinationSiteId(val)}
                                                options={[
                                                    { value: '', label: 'Leave Unassigned / Independent' },
                                                    ...sites
                                                        .filter(s => s.site_id !== Number(closureSiteId) && s.status === 'Active')
                                                        .map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                ]}
                                                triggerClassName="w-full justify-between"
                                                variant="input"
                                            />
                                        </div>

                                        <div className="border border-slate-200 dark:border-github-dark-border rounded-lg max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-[#161b22]/40 custom-scrollbar">
                                            <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Affected Workers:</span>
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
                                                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
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
                                            <p className="text-[10px] text-slate-500 dark:text-github-dark-muted dark:text-github-dark-muted font-mono uppercase mt-0.5">Work History & Insights | {selectedHistoryLabour.role}</p>
                                        </div>
                                        <button onClick={() => setSelectedHistoryLabour(null)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={20} /></button>
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
                                                {/* Global Ledger Card */}
                                                {selectedHistoryLabourDetails && (
                                                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-xl shadow-lg border border-indigo-950/40 space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <span className="block text-[9px] uppercase font-bold text-indigo-300 tracking-wider">All-Time Global Balance</span>
                                                                <span className="text-xl font-black">₹{selectedHistoryLabourDetails.global_net_payable.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={handleOpenGlobalAdvance}
                                                                    className="px-2.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded transition-all"
                                                                >
                                                                    Log Global Advance
                                                                </button>
                                                                <button
                                                                    onClick={handleOpenGlobalPayout}
                                                                    disabled={selectedHistoryLabourDetails.global_net_payable <= 0}
                                                                    className="px-2.5 py-1 text-[10px] font-bold bg-white text-indigo-950 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-all"
                                                                >
                                                                    Release Global Payment
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-900/60 text-[10px] font-mono text-indigo-200">
                                                            <div>
                                                                <span className="block text-[8px] uppercase text-indigo-400">Total Earned</span>
                                                                ₹{selectedHistoryLabourDetails.global_earned.toLocaleString()}
                                                            </div>
                                                            <div>
                                                                <span className="block text-[8px] uppercase text-indigo-400">Total Paid</span>
                                                                ₹{selectedHistoryLabourDetails.global_paid.toLocaleString()}
                                                            </div>
                                                            <div>
                                                                <span className="block text-[8px] uppercase text-indigo-400">Total Advances</span>
                                                                ₹{selectedHistoryLabourDetails.global_advances.toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

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
                                                                                <h6 className="font-bold text-xs text-slate-800 dark:text-github-dark-text dark:text-github-dark-text">{siteLog.site_name || 'Unassigned'}</h6>
                                                                                <span className="text-[9px] text-slate-400 font-mono">
                                                                                    {new Date(siteLog.first_date).toLocaleDateString()} to {new Date(siteLog.last_date).toLocaleDateString()}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">{attendanceRate}% Active</span>
                                                                        </div>

                                                                        <div className="grid grid-cols-4 gap-1.5 text-center mt-3 pt-3 border-t border-slate-100 dark:border-github-dark-border/40 text-[9px] font-bold">
                                                                            <div className="bg-emerald-50 dark:bg-emerald-950/10 p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400">
                                                                                <span className="block text-[8px] uppercase text-slate-400 font-medium">Present</span>
                                                                                {siteLog.present_days}
                                                                            </div>
                                                                            <div className="bg-amber-50 dark:bg-amber-500/10 p-1.5 rounded-lg text-amber-600 dark:text-amber-550 font-bold">
                                                                                <span className="block text-[8px] uppercase text-slate-400 font-medium">Half Day</span>
                                                                                {siteLog.half_day_days}
                                                                            </div>
                                                                            <div className="bg-indigo-50 dark:bg-indigo-950/10 p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 dark:text-indigo-400">
                                                                                <span className="block text-[8px] uppercase text-slate-400 font-medium">Paid L.</span>
                                                                                {siteLog.paid_leave_days}
                                                                            </div>
                                                                            <div className="bg-rose-50 dark:bg-rose-950/10 p-1.5 rounded-lg text-rose-600 dark:text-rose-455">
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
                                                        <h5 className="font-bold text-slate-700 dark:text-github-dark-text dark:text-github-dark-text uppercase tracking-wider text-[10px]">Logged Payroll Payouts</h5>
                                                        <div className="space-y-3">
                                                            {labourPayoutHistory.length === 0 ? (
                                                                <div className="text-center py-10 text-slate-400 italic text-[11px]">No logged salary payouts found.</div>
                                                            ) : (
                                                                labourPayoutHistory.map((payout) => (
                                                                    <div key={payout.payout_id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm hover:border-slate-350 dark:hover:border-github-dark-border-strong transition-all space-y-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">{getMonthNameAndYear(payout.month + "-01")}</span>
                                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${payout.status === 'Paid'
                                                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/30'
                                                                                : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/30'
                                                                                }`}>
                                                                                {payout.status === 'Paid' ? <CheckCircle size={10} /> : <Clock size={10} />} {payout.status}
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
                                                                                <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-bold">Paid Sum</span>
                                                                                ₹{payout.paid_amount}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                                                            <span>Site: {payout.site_name || 'Global / Unallocated'}</span>
                                                                            <span>Method: {payout.notes || 'Unspecified'}</span>
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 font-mono text-right mt-1">
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
                                        <button onClick={() => setShowBulkLabourModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar">
                                        {parsedLabours.length === 0 ? (
                                            <div className="space-y-4">
                                                <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/40 p-4 rounded-xl text-slate-600 dark:text-slate-500 dark:text-github-dark-muted space-y-2">
                                                    <h5 className="font-bold text-slate-850 dark:text-white">Instructions & Template</h5>
                                                    <p>Upload a CSV or Excel file containing your labour profiles. The columns must include:</p>
                                                    <ul className="list-disc pl-4 space-y-1 font-mono text-[10px]">
                                                        <li><strong>Name</strong> (Required)</li>
                                                        <li><strong>Role</strong> (Required, e.g. Mason, Carpenter)</li>
                                                        <li><strong>Daily Wage</strong> (Required, e.g. 600)</li>
                                                        <li><strong>Phone</strong> (Optional, 10 digit number)</li>
                                                        <li><strong>Sex</strong> (Optional, Male/Female, defaults to Male)</li>
                                                        <li><strong>Site Name</strong> (Optional, matches existing construction site name)</li>
                                                    </ul>
                                                    <div className="pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={downloadCSVTemplate}
                                                            className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                                        >
                                                            Download Excel Template
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="border-2 border-dashed border-slate-300 dark:border-github-dark-border rounded-xl p-8 text-center bg-slate-50 dark:bg-[#161b22]/30 flex flex-col items-center justify-center gap-3">
                                                    <Upload className="text-slate-400" size={32} />
                                                    <div>
                                                        <label className="cursor-pointer text-indigo-600 dark:text-indigo-400 dark:text-indigo-400 hover:underline font-bold">
                                                            Upload Excel or CSV File
                                                            <input
                                                                type="file"
                                                                accept=".csv,.xlsx"
                                                                onChange={handleCSVUpload}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                        <p className="text-[10px] text-slate-400 mt-1">Accepts .xlsx or .csv format up to 5MB</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center bg-slate-50 dark:bg-[#161b22] p-3 rounded-lg border border-slate-200 dark:border-github-dark-border">
                                                    <div>
                                                        <span className="font-bold text-slate-800 dark:text-github-dark-text dark:text-white">Parsed Workers Preview</span>
                                                        <p className="text-[10px] text-slate-500 dark:text-github-dark-muted dark:text-slate-400 mt-0.5">
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
                                                                <tr className="bg-slate-50 dark:bg-github-dark-border/40 text-slate-500 dark:text-github-dark-muted dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
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
                                                        className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
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
        </DashboardLayout>
    );
};

export default LabourManagement;
