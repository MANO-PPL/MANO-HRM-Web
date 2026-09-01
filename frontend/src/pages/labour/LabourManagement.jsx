import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { labourService } from '../../services/labourService';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { Clock } from 'lucide-react';

// Modals
import SiteModal from './components/modals/SiteModal';
import DailyScheduleModal from './components/modals/DailyScheduleModal';
import LabourModal from './components/modals/LabourModal';
import AdvanceModal from './components/modals/AdvanceModal';
import PayoutModal from './components/modals/PayoutModal';
import BulkTransferModal from './components/modals/BulkTransferModal';
import BorrowWorkerModal from './components/modals/BorrowWorkerModal';
import SiteClosurePromptModal from './components/modals/SiteClosurePromptModal';
import WorkerHistoryDrawer from './components/modals/WorkerHistoryDrawer';
import BulkLabourUploadModal from './components/modals/BulkLabourUploadModal';
import ConfirmDialogModal from './components/modals/ConfirmDialogModal';

// Views & Header
import LabourHeader from './components/LabourHeader';
import SitesListView from './components/sites/SitesListView';
import SiteDailyAttendanceTab from './components/sites/SiteDailyAttendanceTab';
import SiteMonthlyGridTab from './components/sites/SiteMonthlyGridTab';
import SiteFinancesTab from './components/sites/SiteFinancesTab';
import LabourDirectoryTab from './components/directory/LabourDirectoryTab';

// Shared Utilities
import { DEFAULT_PREVIEW_WORKERS } from './utils/labourUtils';

const LabourManagement = () => {
    // Navigation / Tab state
    const [activeTab, setActiveTab] = useState('sites'); // 'sites', 'directory'
    const [selectedSite, setSelectedSite] = useState(null);
    const [subTab, setSubTab] = useState('attendance'); // 'attendance', 'grid', 'finances'
    const [ledgerViewMode, setLedgerViewMode] = useState('matrix'); // 'matrix' (3-Row Spreadsheet Matrix) or 'summary' (Summary Cards/Table)

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
    const [savingRoster, setSavingRoster] = useState(false);
    const [selectedRosterIds, setSelectedRosterIds] = useState([]);
    const [rosterSearch, setRosterSearch] = useState('');
    const [rosterStatusFilter, setRosterStatusFilter] = useState('all');
    const [hasUnsavedRosterChanges, setHasUnsavedRosterChanges] = useState(false);

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
        wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '',
        overtime_pay_per_hour: '0'
    });

    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [advanceForm, setAdvanceForm] = useState({ labour_id: '', site_id: '', name: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
    const [advanceHistory, setAdvanceHistory] = useState([]);
    const [advancePayouts, setAdvancePayouts] = useState([]);
    const [advanceHistoryLoading, setAdvanceHistoryLoading] = useState(false);
    const [advanceHistoryView, setAdvanceHistoryView] = useState('month'); // 'month' | 'all'
    const [advanceHistoryMonth, setAdvanceHistoryMonth] = useState(new Date().toISOString().slice(0, 7));

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

    // Daily Schedule Planner States
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedScheduleLabour, setSelectedScheduleLabour] = useState(null);
    const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
    const [scheduleSites, setScheduleSites] = useState([]);
    const [scheduleLoading, setScheduleLoading] = useState(false);

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
    const [parsedLabours, setParsedLabours] = useState(DEFAULT_PREVIEW_WORKERS);
    const [csvPreviewError, setCsvPreviewError] = useState('');
    const [isUploadingBulk, setIsUploadingBulk] = useState(false);
    const bulkFileInputRef = useRef(null);

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

    const fetchFinances = async (m = financeMonth) => {
        if (!selectedSite) return;
        try {
            const res = await labourService.getFinancesSummary(selectedSite.site_id, m);
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
            setSelectedRosterIds([]);
            setHasUnsavedRosterChanges(false);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch attendance roster');
            setAttendanceRoster([]);
            setSelectedRosterIds([]);
            setHasUnsavedRosterChanges(false);
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
                fetchFinances(financeMonth);
            }
        }
    }, [attendanceSiteId, attendanceDate, gridSiteId, gridMonth, financeMonth, activeTab, selectedSite, subTab]);
    // Instant Client-Side / Backend Bulk upload CSV & Excel handlers
    const handleInstantFileParse = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingBulk(true);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!rawRows || rawRows.length === 0) {
                toast.error("The selected file contains no data rows.");
                setIsUploadingBulk(false);
                return;
            }

            const siteMap = {};
            sites.forEach(s => {
                siteMap[s.site_name.trim().toLowerCase()] = s.site_id;
            });

            const parsed = rawRows.map((row, idx) => {
                const getVal = (...keys) => {
                    for (const k of Object.keys(row)) {
                        const cleanKey = k.trim().toLowerCase();
                        if (keys.some(expected => expected.toLowerCase() === cleanKey)) {
                            return String(row[k] || '').trim();
                        }
                    }
                    return '';
                };

                const name = getVal('name', 'worker name', 'worker_name', 'full name');
                const role = getVal('role', 'designation', 'job', 'job_type', 'job title');
                const salaryStr = getVal('daily wage', 'daily_wage', 'dailywage', 'salary', 'monthly salary', 'wage', 'pay');
                const monthly_salary = salaryStr ? Number(salaryStr.replace(/[^0-9.]/g, '')) : NaN;
                const phone = getVal('phone', 'mobile', 'phone number', 'contact');
                const sex = getVal('sex', 'gender') || 'Male';
                const site_name = getVal('site', 'site name', 'site_name', 'project site');
                const otPayVal = getVal('overtime pay per hour', 'overtime_pay_per_hour', 'overtime pay', 'ot rate');
                const overtime_pay_per_hour = otPayVal ? Number(otPayVal.replace(/[^0-9.]/g, '')) : 0;

                const errors = [];
                if (!name) errors.push('Missing Name');
                if (!role) errors.push('Missing Role');
                if (isNaN(monthly_salary) || monthly_salary <= 0) errors.push('Invalid Daily Wage');

                const matchedSiteId = site_name && siteMap[site_name.toLowerCase()] ? siteMap[site_name.toLowerCase()] : null;

                return {
                    id: `uploaded-${idx}-${Date.now()}`,
                    name: name || 'Unnamed Worker',
                    role: role || '',
                    monthly_salary: isNaN(monthly_salary) ? 0 : monthly_salary,
                    wage_type: 'Daily Wage',
                    sex: sex.toLowerCase().startsWith('f') ? 'Female' : 'Male',
                    phone,
                    overtime_pay_per_hour: isNaN(overtime_pay_per_hour) ? 0 : overtime_pay_per_hour,
                    site_name: site_name || (selectedSite ? selectedSite.site_name : ''),
                    site_id: matchedSiteId || (selectedSite ? selectedSite.site_id : null),
                    isValid: errors.length === 0,
                    error: errors.join(', '),
                    selected: errors.length === 0
                };
            });

            setParsedLabours(parsed);
            setCsvPreviewError('');
            toast.success(`Instantly loaded preview for ${parsed.length} workers!`);
        } catch (err) {
            console.error("Instant file parse error:", err);
            // Fallback to backend parser
            try {
                const formData = new FormData();
                formData.append('file', file);
                const backendParsed = await labourService.parseBulkLabours(formData);
                setParsedLabours(backendParsed.map((p, i) => ({
                    ...p,
                    id: `backend-${i}-${Date.now()}`,
                    selected: p.isValid
                })));
                toast.success(`Loaded preview for ${backendParsed.length} workers!`);
            } catch (backendErr) {
                toast.error(backendErr.message || "Failed to parse file. Please verify format.");
                setCsvPreviewError(backendErr.message);
            }
        } finally {
            setIsUploadingBulk(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleSaveBulkLabours = async () => {
        const validLabours = parsedLabours
            .filter(l => l.selected !== false && l.isValid)
            .map(l => ({
                name: l.name,
                role: l.role,
                monthly_salary: l.monthly_salary,
                wage_type: l.wage_type || 'Daily Wage',
                sex: l.sex || 'Male',
                phone: l.phone || '',
                overtime_pay_per_hour: l.overtime_pay_per_hour || 0,
                site_id: l.site_id || (selectedSite ? selectedSite.site_id : null)
            }));

        if (validLabours.length === 0) {
            toast.error("No valid labour rows selected to import.");
            return;
        }
        setIsUploadingBulk(true);
        try {
            await labourService.bulkCreateLabours(validLabours);
            toast.success(`Successfully imported ${validLabours.length} workers.`);
            setShowBulkLabourModal(false);
            setParsedLabours(DEFAULT_PREVIEW_WORKERS);
            await fetchLabours();
        } catch (err) {
            toast.error(err.message || "Failed to bulk create labours.");
        } finally {
            setIsUploadingBulk(false);
        }
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
                wage_type: 'Daily Wage',
                monthly_salary: Number(labourForm.monthly_salary),
                allowed_leaves: 0,
                site_id: labourForm.site_id ? Number(labourForm.site_id) : null,
                overtime_pay_per_hour: Number(labourForm.overtime_pay_per_hour || 0)
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
                wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '',
                overtime_pay_per_hour: '0'
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
            wage_type: 'Daily Wage',
            monthly_salary: lab.monthly_salary,
            allowed_leaves: '0',
            site_id: lab.site_id?.toString() || '',
            overtime_pay_per_hour: lab.overtime_pay_per_hour?.toString() || '0'
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

    const fetchScheduleForLabour = async (labourId, date) => {
        setScheduleLoading(true);
        try {
            const res = await labourService.getLabourSchedule(labourId, date);
            setScheduleSites(res.site_ids || []);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch schedule');
            setScheduleSites([]);
        }
        setScheduleLoading(false);
    };

    const handleOpenScheduleModal = async (labour) => {
        setSelectedScheduleLabour(labour);
        const todayStr = new Date().toISOString().split('T')[0];
        setScheduleDate(todayStr);
        setShowScheduleModal(true);
        await fetchScheduleForLabour(labour.labour_id, todayStr);
    };

    const handleScheduleDateChange = async (date) => {
        setScheduleDate(date);
        if (selectedScheduleLabour) {
            await fetchScheduleForLabour(selectedScheduleLabour.labour_id, date);
        }
    };

    const handleToggleScheduleSite = (siteId) => {
        setScheduleSites(prev =>
            prev.includes(siteId)
                ? prev.filter(id => id !== siteId)
                : [...prev, siteId]
        );
    };

    const handleSaveSchedule = async () => {
        if (!selectedScheduleLabour) return;
        try {
            await labourService.saveLabourSchedule({
                labour_id: selectedScheduleLabour.labour_id,
                date: scheduleDate,
                site_ids: scheduleSites
            });
            toast.success(`Schedule updated for ${selectedScheduleLabour.name}`);
            setShowScheduleModal(false);
            fetchLabours();
        } catch (err) {
            toast.error(err.message || 'Failed to save daily schedule');
        }
    };

    // ==========================================
    // ATTENDANCE HANDLERS & BULK ACTIONS
    // ==========================================

    const rosterStats = React.useMemo(() => {
        const total = attendanceRoster.length;
        const present = attendanceRoster.filter(r => r.status === 'Present').length;
        const halfDay = attendanceRoster.filter(r => r.status === 'Half Day').length;
        const absent = attendanceRoster.filter(r => r.status === 'Absent').length;
        const paidLeave = attendanceRoster.filter(r => r.status === 'Paid Leave').length;
        const unmarked = attendanceRoster.filter(r => !r.status).length;
        return { total, present, halfDay, absent, paidLeave, unmarked };
    }, [attendanceRoster]);

    const filteredRoster = React.useMemo(() => {
        return attendanceRoster.filter(r => {
            // Role filter from upper bar
            if (attendanceRoleFilter && (r.role || '').toLowerCase() !== attendanceRoleFilter.toLowerCase()) {
                return false;
            }
            // In-card Search query
            if (rosterSearch.trim()) {
                const query = rosterSearch.toLowerCase();
                const matchesName = (r.name || '').toLowerCase().includes(query);
                const matchesRole = (r.role || '').toLowerCase().includes(query);
                if (!matchesName && !matchesRole) return false;
            }
            // Status filter pill
            if (rosterStatusFilter !== 'all') {
                if (rosterStatusFilter === 'Unmarked') {
                    if (r.status) return false;
                } else if (r.status !== rosterStatusFilter) {
                    return false;
                }
            }
            return true;
        });
    }, [attendanceRoster, attendanceRoleFilter, rosterSearch, rosterStatusFilter]);

    const handleStatusChange = (labourId, newStatus) => {
        setAttendanceRoster(prev =>
            prev.map(item => {
                if (item.labour_id !== labourId) return item;
                const updatedStatus = item.status === newStatus ? '' : newStatus;
                return {
                    ...item,
                    status: updatedStatus,
                    overtime_hours: updatedStatus === 'Present' ? (item.overtime_hours || 0) : 0
                };
            })
        );
        setHasUnsavedRosterChanges(true);
    };

    const handleOvertimeChange = (labourId, otHours) => {
        setAttendanceRoster(prev =>
            prev.map(item => item.labour_id === labourId ? { ...item, overtime_hours: otHours } : item)
        );
        setHasUnsavedRosterChanges(true);
    };

    const handleSaveAttendance = async () => {
        if (savingRoster) return;
        setSavingRoster(true);
        try {
            await labourService.saveSiteAttendance(attendanceSiteId, attendanceDate, attendanceRoster);
            toast.success('Daily attendance checklist saved successfully!');
            setHasUnsavedRosterChanges(false);
        } catch (err) {
            toast.error(err.message || 'Failed to save attendance roster');
        } finally {
            setSavingRoster(false);
        }
    };

    // Bulk Attendance Fast Actions
    const handleMarkAllVisible = (targetStatus) => {
        const visibleIds = new Set(filteredRoster.map(r => r.labour_id));
        let count = 0;
        setAttendanceRoster(prev =>
            prev.map(item => {
                if (!visibleIds.has(item.labour_id)) return item;
                // Check if worker is locked on another site
                if ((targetStatus === 'Present' || targetStatus === 'Half Day' || targetStatus === 'Paid Leave') &&
                    item.already_marked_at && !item.is_scheduled_multi_site) {
                    return item;
                }
                count++;
                return {
                    ...item,
                    status: targetStatus,
                    overtime_hours: targetStatus === 'Present' ? (item.overtime_hours || 0) : 0
                };
            })
        );
        setHasUnsavedRosterChanges(true);
        toast.success(`Marked all ${count} visible workers as ${targetStatus}`);
    };

    const handleMarkUnmarkedVisible = (targetStatus) => {
        const visibleIds = new Set(filteredRoster.filter(r => !r.status).map(r => r.labour_id));
        let count = 0;
        setAttendanceRoster(prev =>
            prev.map(item => {
                if (!visibleIds.has(item.labour_id)) return item;
                if ((targetStatus === 'Present' || targetStatus === 'Half Day' || targetStatus === 'Paid Leave') &&
                    item.already_marked_at && !item.is_scheduled_multi_site) {
                    return item;
                }
                count++;
                return {
                    ...item,
                    status: targetStatus,
                    overtime_hours: targetStatus === 'Present' ? (item.overtime_hours || 0) : 0
                };
            })
        );
        setHasUnsavedRosterChanges(true);
        toast.success(`Marked ${count} previously unmarked workers as ${targetStatus}`);
    };

    const handleResetAllVisible = () => {
        const visibleIds = new Set(filteredRoster.map(r => r.labour_id));
        setAttendanceRoster(prev =>
            prev.map(item => {
                if (!visibleIds.has(item.labour_id)) return item;
                return {
                    ...item,
                    status: '',
                    overtime_hours: 0
                };
            })
        );
        setHasUnsavedRosterChanges(true);
        toast.info('Reset attendance marks for visible workers');
    };

    const handleBatchSetStatus = (targetStatus) => {
        if (selectedRosterIds.length === 0) return;
        const selectedSet = new Set(selectedRosterIds);
        let count = 0;
        setAttendanceRoster(prev =>
            prev.map(item => {
                if (!selectedSet.has(item.labour_id)) return item;
                if ((targetStatus === 'Present' || targetStatus === 'Half Day' || targetStatus === 'Paid Leave') &&
                    item.already_marked_at && !item.is_scheduled_multi_site) {
                    return item;
                }
                count++;
                return {
                    ...item,
                    status: targetStatus,
                    overtime_hours: targetStatus === 'Present' ? (item.overtime_hours || 0) : 0
                };
            })
        );
        setHasUnsavedRosterChanges(true);
        toast.success(`Set ${count} selected workers to ${targetStatus}`);
    };

    const handleBatchSetOvertime = (hours) => {
        if (selectedRosterIds.length === 0) return;
        const selectedSet = new Set(selectedRosterIds);
        setAttendanceRoster(prev =>
            prev.map(item => {
                if (!selectedSet.has(item.labour_id)) return item;
                return {
                    ...item,
                    status: item.status === 'Present' ? 'Present' : (item.status || 'Present'),
                    overtime_hours: hours
                };
            })
        );
        setHasUnsavedRosterChanges(true);
        toast.success(`Set ${hours} hrs overtime for ${selectedRosterIds.length} workers`);
    };

    const handleToggleSelectRoster = (labourId) => {
        setSelectedRosterIds(prev =>
            prev.includes(labourId) ? prev.filter(id => id !== labourId) : [...prev, labourId]
        );
    };

    const handleSelectAllVisibleToggle = (visibleItems) => {
        const visibleIds = visibleItems.map(item => item.labour_id);
        const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedRosterIds.includes(id));
        if (allSelected) {
            setSelectedRosterIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedRosterIds(prev => [...new Set([...prev, ...visibleIds])]);
        }
    };

    // Keyboard shortcut (Ctrl+S / Cmd+S) to quickly save attendance roster
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                if (activeTab === 'sites' && selectedSite && subTab === 'attendance' && attendanceRoster.length > 0) {
                    e.preventDefault();
                    handleSaveAttendance();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, selectedSite, subTab, attendanceRoster, attendanceSiteId, attendanceDate, savingRoster]);

    // ==========================================
    // FINANCES HANDLERS
    // ==========================================

    const loadAdvanceHistory = async (labourId, month = advanceHistoryMonth) => {
        if (!labourId) return;
        setAdvanceHistoryLoading(true);
        try {
            const res = await labourService.getLabourAdvances(labourId, month, selectedSite ? selectedSite.site_id : null);
            setAdvanceHistory(res.advances || []);
            setAdvancePayouts(res.payouts || []);
        } catch (err) {
            console.error('Failed to load advance history', err);
            setAdvanceHistory([]);
            setAdvancePayouts([]);
        } finally {
            setAdvanceHistoryLoading(false);
        }
    };

    const handleOpenAdvance = (labour) => {
        const initialMonth = financeMonth || new Date().toISOString().slice(0, 7);
        setAdvanceHistoryMonth(initialMonth);
        const todayStr = new Date().toISOString().split('T')[0];
        const initialDate = todayStr.startsWith(initialMonth) ? todayStr : `${initialMonth}-01`;

        setAdvanceForm({
            labour_id: labour.labour_id,
            site_id: selectedSite ? selectedSite.site_id.toString() : 'All',
            name: labour.name,
            amount: '',
            date: initialDate,
            notes: '',
            accrued_credit: labour.accrued_credit,
            net_payable: labour.net_payable
        });
        setAdvanceHistoryView('month');
        loadAdvanceHistory(labour.labour_id, initialMonth);
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
            setAdvanceForm(prev => ({ ...prev, amount: '', notes: '' }));
            loadAdvanceHistory(advanceForm.labour_id, advanceHistoryView === 'month' ? financeMonth : null);
            if (selectedHistoryLabour) {
                handleViewHistory(selectedHistoryLabour);
            } else {
                fetchFinances(financeMonth);
            }
        } catch (err) {
            toast.error(err.message || 'Failed to log advance payment');
        }
    };

    const handleDeleteAdvance = async (advanceId) => {
        if (!window.confirm('Are you sure you want to delete this advance record?')) return;
        try {
            await labourService.deleteLabourAdvance(advanceId);
            toast.success('Advance record deleted');
            loadAdvanceHistory(advanceForm.labour_id, advanceHistoryView === 'month' ? financeMonth : null);
            if (selectedHistoryLabour) {
                handleViewHistory(selectedHistoryLabour);
            } else {
                fetchFinances(financeMonth);
            }
        } catch (err) {
            toast.error(err.message || 'Failed to delete advance');
        }
    };

    const handleOpenPayout = (row) => {
        const monthKey = financeMonth || (monthDetails?.month ? monthDetails.month : new Date().toISOString().slice(0, 7));
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
            paid_amount: isExisting ? row.payout.paid_amount : Math.max(0, row.net_payable),
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
                fetchFinances(financeMonth);
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

                {/* Header & Filter Controls */}
                <LabourHeader
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    selectedSite={selectedSite}
                    setSelectedSite={setSelectedSite}
                    labourSearch={labourSearch}
                    setLabourSearch={setLabourSearch}
                    labourRoleFilter={labourRoleFilter}
                    setLabourRoleFilter={setLabourRoleFilter}
                    labourSiteFilter={labourSiteFilter}
                    setLabourSiteFilter={setLabourSiteFilter}
                    labours={labours}
                    sites={sites}
                    setSelectedLabourIds={setSelectedLabourIds}
                    setBulkSourceSiteId={setBulkSourceSiteId}
                    setBulkDestinationSiteId={setBulkDestinationSiteId}
                    setBulkRoleFilter={setBulkRoleFilter}
                    setShowBulkTransferModal={setShowBulkTransferModal}
                    parsedLabours={parsedLabours}
                    setParsedLabours={setParsedLabours}
                    setCsvPreviewError={setCsvPreviewError}
                    setShowBulkLabourModal={setShowBulkLabourModal}
                    setEditingLabour={setEditingLabour}
                    setLabourForm={setLabourForm}
                    setShowLabourModal={setShowLabourModal}
                    siteSearch={siteSearch}
                    setSiteSearch={setSiteSearch}
                    setEditingSite={setEditingSite}
                    setSiteForm={setSiteForm}
                    setShowSiteModal={setShowSiteModal}
                    subTab={subTab}
                    setSubTab={setSubTab}
                    attendanceRoleFilter={attendanceRoleFilter}
                    setAttendanceRoleFilter={setAttendanceRoleFilter}
                    attendanceDate={attendanceDate}
                    setAttendanceDate={setAttendanceDate}
                    getMaxAttendanceDate={getMaxAttendanceDate}
                    gridRoleFilter={gridRoleFilter}
                    setGridRoleFilter={setGridRoleFilter}
                    gridMonth={gridMonth}
                    setGridMonth={setGridMonth}
                    financeRoleFilter={financeRoleFilter}
                    setFinanceRoleFilter={setFinanceRoleFilter}
                    financeMonth={financeMonth}
                    setFinanceMonth={setFinanceMonth}
                    ledgerViewMode={ledgerViewMode}
                    setLedgerViewMode={setLedgerViewMode}
                />

                {/* Main Content Pane */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Clock className="animate-spin text-indigo-500" size={32} />
                        <span className="text-xs text-slate-500 font-medium">Fetching details...</span>
                    </div>
                ) : (
                    <>
                        {/* TAB 1: SITES OVERVIEW & DRILL-DOWN DETAILS */}
                        {activeTab === 'sites' && (
                            selectedSite === null ? (
                                <SitesListView
                                    sites={sites}
                                    labours={labours}
                                    siteSearch={siteSearch}
                                    setSelectedSite={setSelectedSite}
                                    handleEditSite={handleEditSite}
                                    handleDeleteSite={handleDeleteSite}
                                />
                            ) : (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    {subTab === 'attendance' && (
                                        <SiteDailyAttendanceTab
                                            selectedSite={selectedSite}
                                            attendanceLoading={attendanceLoading}
                                            rosterStats={rosterStats}
                                            rosterStatusFilter={rosterStatusFilter}
                                            setRosterStatusFilter={setRosterStatusFilter}
                                            rosterSearch={rosterSearch}
                                            setRosterSearch={setRosterSearch}
                                            setSelectedLabourIds={setSelectedLabourIds}
                                            setBulkSourceSiteId={setBulkSourceSiteId}
                                            setBulkDestinationSiteId={setBulkDestinationSiteId}
                                            setBulkRoleFilter={setBulkRoleFilter}
                                            setShowBulkTransferModal={setShowBulkTransferModal}
                                            setShowBorrowModal={setShowBorrowModal}
                                            handleSaveAttendance={handleSaveAttendance}
                                            attendanceRoster={attendanceRoster}
                                            savingRoster={savingRoster}
                                            hasUnsavedRosterChanges={hasUnsavedRosterChanges}
                                            selectedRosterIds={selectedRosterIds}
                                            setSelectedRosterIds={setSelectedRosterIds}
                                            handleMarkAllVisible={handleMarkAllVisible}
                                            handleMarkUnmarkedVisible={handleMarkUnmarkedVisible}
                                            handleResetAllVisible={handleResetAllVisible}
                                            handleBatchSetStatus={handleBatchSetStatus}
                                            handleBatchSetOvertime={handleBatchSetOvertime}
                                            attendanceRoleFilter={attendanceRoleFilter}
                                            attendanceDate={attendanceDate}
                                            filteredRoster={filteredRoster}
                                            handleSelectAllVisibleToggle={handleSelectAllVisibleToggle}
                                            handleToggleSelectRoster={handleToggleSelectRoster}
                                            handleStatusChange={handleStatusChange}
                                            handleOvertimeChange={handleOvertimeChange}
                                        />
                                    )}

                                    {subTab === 'grid' && (
                                        <SiteMonthlyGridTab
                                            gridLoading={gridLoading}
                                            gridMonthDetails={gridMonthDetails}
                                            gridRoleFilter={gridRoleFilter}
                                            gridMonth={gridMonth}
                                            gridData={gridData}
                                        />
                                    )}

                                    {subTab === 'finances' && (
                                        <SiteFinancesTab
                                            ledgerViewMode={ledgerViewMode}
                                            selectedSite={selectedSite}
                                            financeMonth={financeMonth}
                                            handleOpenAdvance={handleOpenAdvance}
                                            handleOpenPayout={handleOpenPayout}
                                            financeRoleFilter={financeRoleFilter}
                                            financeSummary={financeSummary}
                                        />
                                    )}
                                </div>
                            )
                        )}

                        {/* TAB 2: LABOUR FORCE DIRECTORY */}
                        {activeTab === 'directory' && (
                            <LabourDirectoryTab
                                labours={labours}
                                labourSearch={labourSearch}
                                labourRoleFilter={labourRoleFilter}
                                labourSiteFilter={labourSiteFilter}
                                sites={sites}
                                handleViewHistory={handleViewHistory}
                                handleOpenScheduleModal={handleOpenScheduleModal}
                                handleEditLabour={handleEditLabour}
                                handleDeleteLabour={handleDeleteLabour}
                            />
                        )}
                    </>
                )}

                {/* MODALS */}
                <SiteModal
                    showSiteModal={showSiteModal}
                    setShowSiteModal={setShowSiteModal}
                    editingSite={editingSite}
                    siteForm={siteForm}
                    setSiteForm={setSiteForm}
                    handleSaveSite={handleSaveSite}
                />

                <DailyScheduleModal
                    showScheduleModal={showScheduleModal}
                    setShowScheduleModal={setShowScheduleModal}
                    selectedScheduleLabour={selectedScheduleLabour}
                    scheduleDate={scheduleDate}
                    handleScheduleDateChange={handleScheduleDateChange}
                    scheduleSites={scheduleSites}
                    scheduleLoading={scheduleLoading}
                    sites={sites}
                    handleToggleScheduleSite={handleToggleScheduleSite}
                    handleSaveSchedule={handleSaveSchedule}
                />

                <LabourModal
                    showLabourModal={showLabourModal}
                    setShowLabourModal={setShowLabourModal}
                    editingLabour={editingLabour}
                    labourForm={labourForm}
                    setLabourForm={setLabourForm}
                    handleSaveLabour={handleSaveLabour}
                    sites={sites}
                />

                <AdvanceModal
                    showAdvanceModal={showAdvanceModal}
                    setShowAdvanceModal={setShowAdvanceModal}
                    advanceForm={advanceForm}
                    setAdvanceForm={setAdvanceForm}
                    handleSaveAdvance={handleSaveAdvance}
                    handleDeleteAdvance={handleDeleteAdvance}
                    sites={sites}
                    financeMonth={financeMonth}
                    advanceHistory={advanceHistory}
                    advancePayouts={advancePayouts}
                    advanceHistoryLoading={advanceHistoryLoading}
                    advanceHistoryView={advanceHistoryView}
                    setAdvanceHistoryView={setAdvanceHistoryView}
                    loadAdvanceHistory={loadAdvanceHistory}
                />

                <PayoutModal
                    showPayoutModal={showPayoutModal}
                    setShowPayoutModal={setShowPayoutModal}
                    payoutForm={payoutForm}
                    setPayoutForm={setPayoutForm}
                    handleSavePayout={handleSavePayout}
                    sites={sites}
                />

                <BulkTransferModal
                    showBulkTransferModal={showBulkTransferModal}
                    setShowBulkTransferModal={setShowBulkTransferModal}
                    bulkSourceSiteId={bulkSourceSiteId}
                    setBulkSourceSiteId={setBulkSourceSiteId}
                    bulkDestinationSiteId={bulkDestinationSiteId}
                    setBulkDestinationSiteId={setBulkDestinationSiteId}
                    selectedLabourIds={selectedLabourIds}
                    setSelectedLabourIds={setSelectedLabourIds}
                    bulkRoleFilter={bulkRoleFilter}
                    setBulkRoleFilter={setBulkRoleFilter}
                    sites={sites}
                    selectedSite={selectedSite}
                    labours={labours}
                    handleExecuteBulkTransfer={handleExecuteBulkTransfer}
                />

                <BorrowWorkerModal
                    showBorrowModal={showBorrowModal}
                    setShowBorrowModal={setShowBorrowModal}
                    borrowSearchQuery={borrowSearchQuery}
                    setBorrowSearchQuery={setBorrowSearchQuery}
                    labours={labours}
                    attendanceRoster={attendanceRoster}
                    handleBorrowLabour={handleBorrowLabour}
                />

                <SiteClosurePromptModal
                    showSiteClosurePrompt={showSiteClosurePrompt}
                    setShowSiteClosurePrompt={setShowSiteClosurePrompt}
                    closureSiteName={closureSiteName}
                    siteStatusToSave={siteStatusToSave}
                    closureLabours={closureLabours}
                    closureDestinationSiteId={closureDestinationSiteId}
                    setClosureDestinationSiteId={setClosureDestinationSiteId}
                    closureSiteId={closureSiteId}
                    sites={sites}
                    handleConfirmSiteClosure={handleConfirmSiteClosure}
                />

                <WorkerHistoryDrawer
                    selectedHistoryLabour={selectedHistoryLabour}
                    setSelectedHistoryLabour={setSelectedHistoryLabour}
                    historyLoading={historyLoading}
                    labourHistoryData={labourHistoryData}
                    selectedHistoryLabourDetails={selectedHistoryLabourDetails}
                    handleOpenGlobalAdvance={handleOpenGlobalAdvance}
                    handleOpenGlobalPayout={handleOpenGlobalPayout}
                    historyTab={historyTab}
                    setHistoryTab={setHistoryTab}
                    labourPayoutHistory={labourPayoutHistory}
                />

                <BulkLabourUploadModal
                    showBulkLabourModal={showBulkLabourModal}
                    setShowBulkLabourModal={setShowBulkLabourModal}
                    bulkFileInputRef={bulkFileInputRef}
                    handleInstantFileParse={handleInstantFileParse}
                    downloadCSVTemplate={downloadCSVTemplate}
                    isUploadingBulk={isUploadingBulk}
                    parsedLabours={parsedLabours}
                    setParsedLabours={setParsedLabours}
                    selectedSite={selectedSite}
                    handleSaveBulkLabours={handleSaveBulkLabours}
                />

                <ConfirmDialogModal
                    confirmDialog={confirmDialog}
                    setConfirmDialog={setConfirmDialog}
                />
            </div>
        </DashboardLayout>
    );
};

export default LabourManagement;
