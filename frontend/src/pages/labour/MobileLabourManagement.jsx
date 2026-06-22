import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { labourService } from '../../services/labourService';
import { toast } from 'react-toastify';
import {
    Building, Calendar, DollarSign, Clock, Plus, Search,
    UserPlus, Edit2, Trash2, Save, AlertTriangle, User, Phone, X,
    CheckCircle, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MobileLabourManagement = () => {
    // Navigation / Tab state
    const [activeTab, setActiveTab] = useState('sites'); // 'sites', 'labours', 'attendance', 'finances'

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

    // ==========================================
    // DATA FETCHING HANDLERS
    // ==========================================

    const fetchSites = async () => {
        try {
            const data = await labourService.getAllSites();
            setSites(data);
            if (data.length > 0) {
                if (!attendanceSiteId) {
                    setAttendanceSiteId(data[0].site_id.toString());
                }
                if (!gridSiteId) {
                    setGridSiteId(data[0].site_id.toString());
                }
            }
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

    const loadTabInitialData = async (tab) => {
        setLoading(true);
        if (tab === 'sites') {
            await fetchSites();
            await fetchLabours();
        } else if (tab === 'labours') {
            await fetchSites();
            await fetchLabours();
        } else if (tab === 'attendance') {
            await fetchSites();
            await fetchLabours();
        } else if (tab === 'grid') {
            await fetchSites();
            await fetchGridData();
        } else if (tab === 'finances') {
            await fetchFinances();
        }
        setLoading(false);
    };

    useEffect(() => {
        loadTabInitialData(activeTab);
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'finances') {
            fetchFinances();
        }
    }, [financeMonth, activeTab]);

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

    useEffect(() => {
        if (activeTab === 'attendance') {
            loadAttendanceRoster();
        }
    }, [attendanceSiteId, attendanceDate, activeTab]);

    useEffect(() => {
        if (activeTab === 'grid') {
            fetchGridData();
        }
    }, [gridSiteId, gridMonth, showAllSitesAttendance, activeTab]);

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
        toast.success(`${lab.name} borrowed successfully`);
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
        if (!window.confirm('Delete this site? Assigned labours will be unassigned.')) return;
        try {
            await labourService.deleteSite(siteId);
            toast.success('Site deleted');
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

    const handleDeleteLabour = async (labourId) => {
        if (!window.confirm('Delete this worker? All data will be deleted.')) return;
        try {
            await labourService.deleteLabour(labourId);
            toast.success('Worker deleted');
            fetchLabours();
        } catch (err) {
            toast.error(err.message || 'Failed to delete worker');
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
                <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/5 sticky top-16 z-20">
                    {[
                        { id: 'sites', label: 'Sites' },
                        { id: 'labours', label: 'Labours' },
                        { id: 'attendance', label: 'Checklist' },
                        { id: 'grid', label: 'Grid' },
                        { id: 'finances', label: 'Ledger' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2.5 text-[10px] font-semibold rounded-xl transition-all ${
                                activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transform scale-[1.02]'
                                    : 'text-slate-500 dark:text-github-dark-muted'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Clock className="animate-spin text-indigo-500" size={24} />
                        <span className="text-[10px] text-slate-400">Loading data...</span>
                    </div>
                ) : (
                    <>
                        {/* ==========================================
                            TAB 1: SITES
                            ========================================== */}
                        {activeTab === 'sites' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3.5 rounded-2xl">
                                    <span className="font-bold text-slate-700 dark:text-white">Active Projects</span>
                                    <button
                                        onClick={() => { setEditingSite(null); setSiteForm({ site_name: '', location_details: '', status: 'Active' }); setShowSiteModal(true); }}
                                        className="p-1.5 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Add Site
                                    </button>
                                </div>

                                {sites.length === 0 ? (
                                    <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
                                        No construction sites found.
                                    </div>
                                ) : (
                                    sites.map(site => (
                                        <div key={site.site_id} className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-sm">
                                            <div>
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">{site.site_name}</h4>
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                                                        site.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        {site.status}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 dark:text-github-dark-muted mt-1.5">{site.location_details || 'No details.'}</p>
                                                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                                                    👥 {labours.filter(l => l.site_id === site.site_id).length} Assigned Workers
                                                </span>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-github-dark-border/40">
                                                <button onClick={() => handleEditSite(site)} className="p-1 text-slate-500 rounded border border-slate-200 dark:border-github-dark-border"><Edit2 size={12} /></button>
                                                <button onClick={() => handleDeleteSite(site.site_id)} className="p-1 text-red-500 rounded border border-slate-200 dark:border-github-dark-border"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* ==========================================
                            TAB 2: LABOURS DIRECTORY
                            ========================================== */}
                        {activeTab === 'labours' && (
                            <div className="space-y-3">
                                <div className="flex flex-col gap-2.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3 rounded-2xl">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Search worker by name or role..."
                                            value={labourSearch}
                                            onChange={(e) => setLabourSearch(e.target.value)}
                                            className="pl-8 pr-4 py-2 w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-700 dark:text-github-dark-text focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <select
                                            value={labourSiteFilter}
                                            onChange={(e) => setLabourSiteFilter(e.target.value)}
                                            className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl cursor-pointer"
                                        >
                                            <option value="All">All Sites</option>
                                            <option value="Unassigned">Unassigned</option>
                                            {sites.map(s => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => {
                                                setSelectedLabourIds([]);
                                                setBulkSourceSiteId('All');
                                                setBulkDestinationSiteId('');
                                                setShowBulkTransferModal(true);
                                            }}
                                            className="px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-1 border border-slate-200 dark:border-github-dark-border"
                                        >
                                            <Building size={14} /> Bulk
                                        </button>
                                        <button
                                            onClick={() => { setEditingLabour(null); setLabourForm({ name: '', phone: '', sex: 'Male', role: '', wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '' }); setShowLabourModal(true); }}
                                            className="px-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-1 shrink-0"
                                        >
                                            <Plus size={14} /> Add Labour
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    {labours
                                        .filter(lab => {
                                            const matchesSearch = lab.name.toLowerCase().includes(labourSearch.toLowerCase()) ||
                                                lab.role.toLowerCase().includes(labourSearch.toLowerCase());
                                            let matchesSite = true;
                                            if (labourSiteFilter === 'Unassigned') matchesSite = lab.site_id === null;
                                            else if (labourSiteFilter !== 'All') matchesSite = lab.site_id === Number(labourSiteFilter);
                                            return matchesSearch && matchesSite;
                                        })
                                        .map(lab => (
                                            <div key={lab.labour_id} className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                                                <div className="cursor-pointer" onClick={() => handleViewHistory(lab)}>
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-xs flex items-center gap-1.5">
                                                        <span>{lab.name}</span>
                                                        <span className="text-[8px] text-indigo-500 font-bold uppercase tracking-wider font-sans bg-indigo-50 dark:bg-indigo-950/20 px-1 rounded">History</span>
                                                    </h4>
                                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{lab.role} | {lab.wage_type}</p>
                                                    <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-wide flex items-center gap-1 font-semibold">
                                                        <Building size={10} />
                                                        {lab.site_name || 'Unassigned'}
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

                        {/* ==========================================
                            TAB 3: ATTENDANCE CHECKLIST
                            ========================================== */}
                        {activeTab === 'attendance' && (
                            <div className="space-y-3">
                                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3.5 rounded-2xl grid grid-cols-2 gap-2">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-400">Site</label>
                                        <select
                                            value={attendanceSiteId}
                                            onChange={(e) => setAttendanceSiteId(e.target.value)}
                                            className="px-2 py-1.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl cursor-pointer"
                                        >
                                            {sites.map(s => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-400">Date</label>
                                        <input
                                            type="date"
                                            value={attendanceDate}
                                            onChange={(e) => setAttendanceDate(e.target.value)}
                                            className="px-2 py-1 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl overflow-hidden shadow-sm">
                                    <div className="p-3 border-b border-slate-100 dark:border-github-dark-border flex justify-between items-center bg-slate-50 dark:bg-github-dark-border/40 gap-2">
                                        <span className="font-bold text-xs truncate">Roster ({attendanceRoster.length})</span>
                                        <div className="flex gap-1.5 shrink-0">
                                            <button
                                                onClick={() => setShowBorrowModal(true)}
                                                className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-1 border border-slate-200 dark:border-github-dark-border text-[9px] cursor-pointer"
                                            >
                                                <Plus size={10} /> Borrow
                                            </button>
                                            <button
                                                disabled={attendanceRoster.length === 0}
                                                onClick={handleSaveAttendance}
                                                className="px-2 py-1.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-1 shadow-sm disabled:opacity-50 text-[9px] cursor-pointer"
                                            >
                                                <Save size={10} /> Save
                                            </button>
                                        </div>
                                    </div>

                                    {attendanceLoading ? (
                                        <div className="py-10 flex justify-center"><Clock className="animate-spin text-indigo-500" size={20} /></div>
                                    ) : attendanceRoster.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 italic">No labours on this site.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3 p-3 bg-slate-50/50 dark:bg-transparent">
                                            {attendanceRoster.map(item => (
                                                <div key={item.labour_id} className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl p-3.5 flex flex-col gap-3.5 shadow-sm relative overflow-hidden">
                                                    {item.is_borrowed && (
                                                        <span className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded-bl uppercase">Borrowed</span>
                                                    )}
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 dark:text-white text-xs truncate pr-12">{item.name}</h4>
                                                        <p className="text-[9px] text-slate-450 dark:text-github-dark-muted font-mono uppercase mt-0.5">{item.role}</p>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 dark:border-github-dark-border/40">
                                                        {[
                                                            { id: 'Present', label: 'Full Day', activeColor: 'bg-emerald-500 text-white dark:bg-emerald-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-github-dark-border/60' },
                                                            { id: 'Half Day', label: 'Half Day', activeColor: 'bg-amber-500 text-white dark:bg-amber-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-github-dark-border/60' },
                                                            { id: 'Absent', label: 'Absent', activeColor: 'bg-rose-500 text-white dark:bg-rose-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-github-dark-border/60' },
                                                            { id: 'Paid Leave', label: 'Paid Leave', activeColor: 'bg-indigo-500 text-white dark:bg-indigo-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-github-dark-border/60' }
                                                        ].map(statusOpt => {
                                                            const isSelected = item.status === statusOpt.id;
                                                            return (
                                                                <button
                                                                    key={statusOpt.id}
                                                                    onClick={() => handleStatusChange(item.labour_id, statusOpt.id)}
                                                                    className={`py-1.5 rounded-lg text-[9px] font-bold text-center transition-all cursor-pointer ${
                                                                        isSelected ? statusOpt.activeColor + ' shadow-sm' : statusOpt.inactiveColor
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

                        {/* ==========================================
                            TAB 3.5: ATTENDANCE GRID VIEW
                            ========================================== */}
                        {activeTab === 'grid' && (
                            <div className="space-y-3">
                                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3.5 rounded-2xl grid grid-cols-2 gap-2">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-400">Site</label>
                                        <select
                                            value={gridSiteId}
                                            onChange={(e) => setGridSiteId(e.target.value)}
                                            className="px-2 py-1.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl cursor-pointer text-xs"
                                        >
                                            <option value="All">💼 All Labours (All Sites)</option>
                                            {sites.map(s => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-400">Month</label>
                                        <input
                                            type="month"
                                            value={gridMonth}
                                            onChange={(e) => setGridMonth(e.target.value)}
                                            className="px-2 py-1 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none text-xs"
                                        />
                                    </div>
                                    {gridSiteId !== 'All' && (
                                        <div className="col-span-2 mt-1.5 pt-2.5 border-t border-slate-100 dark:border-github-dark-border/40 flex items-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={showAllSitesAttendance}
                                                    onChange={(e) => setShowAllSitesAttendance(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-8 h-4 bg-slate-200 dark:bg-github-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 dark:after:border-none after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-650"></div>
                                                <span className="ml-2 text-[10px] font-semibold text-slate-550 dark:text-github-dark-text">Include attendance from other sites</span>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {gridLoading ? (
                                    <div className="py-10 flex justify-center"><Clock className="animate-spin text-indigo-500" size={20} /></div>
                                ) : (
                                    <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl overflow-hidden shadow-sm">
                                        <div className="p-3 border-b border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-border/40">
                                            <span className="font-bold text-xs">Attendance Matrix</span>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                                <thead>
                                                    <tr className="bg-slate-50/60 dark:bg-github-dark-border/20 border-b border-slate-200 dark:border-github-dark-border font-bold text-slate-400">
                                                        <th className="p-3 sticky left-0 bg-white dark:bg-[#0d1117] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[120px] border-r border-slate-250 dark:border-github-dark-border">Worker Name / Role</th>
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
                                                            <td colSpan={getDaysInMonthArray().length + 1} className="p-8 text-center text-slate-400 italic">
                                                                No active labours found.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        gridData.map(row => (
                                                            <tr key={row.labour_id} className="border-b border-slate-150 dark:border-github-dark-border/40">
                                                                <td className="p-3 sticky left-0 bg-white dark:bg-[#0d1117] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-250 dark:border-github-dark-border">
                                                                    <div className="font-bold text-slate-800 dark:text-github-dark-text text-[11px]">{row.name}</div>
                                                                    <div className="text-[8px] text-slate-400 dark:text-github-dark-muted font-mono mt-0.5">{row.role}</div>
                                                                </td>
                                                                {getDaysInMonthArray().map(day => {
                                                                    const attObj = row.attendance[day.dateStr];
                                                                    const statusStr = attObj && typeof attObj === 'object' ? attObj.status : attObj;
                                                                    const attSiteId = attObj && typeof attObj === 'object' ? attObj.site_id : null;
                                                                    const attSiteName = attObj && typeof attObj === 'object' ? attObj.site_name : null;
                                                                    
                                                                    const isOtherSite = gridSiteId !== 'All' && attSiteId !== null && Number(attSiteId) !== Number(gridSiteId);
                                                                    const tooltipText = isOtherSite 
                                                                        ? `${statusStr} (at ${attSiteName})` 
                                                                        : (gridSiteId === 'All' && attSiteName ? `${statusStr} (at ${attSiteName})` : statusStr);

                                                                    const dateObj = new Date(day.dateStr);
                                                                    const dayNum = dateObj.getDay();
                                                                    let cellContent = null;
                                                                    
                                                                    if (statusStr === 'Present') {
                                                                        cellContent = isOtherSite ? (
                                                                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 border border-emerald-300 dark:border-emerald-850/50 text-[8px] font-black shadow-sm" title={tooltipText}>P</span>
                                                                        ) : (
                                                                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[8px] font-black shadow-sm" title={tooltipText}>P</span>
                                                                        );
                                                                    } else if (statusStr === 'Half Day') {
                                                                        cellContent = isOtherSite ? (
                                                                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-50/90 dark:bg-amber-950/40 text-amber-600 dark:text-amber-450 border border-amber-300 dark:border-amber-850/50 text-[8px] font-black shadow-sm" title={tooltipText}>HD</span>
                                                                        ) : (
                                                                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[8px] font-black shadow-sm" title={tooltipText}>HD</span>
                                                                        );
                                                                    } else if (statusStr === 'Absent') {
                                                                        cellContent = isOtherSite ? (
                                                                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-rose-50/90 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 border border-rose-300 dark:border-rose-850/50 text-[8px] font-black shadow-sm" title={tooltipText}>A</span>
                                                                        ) : (
                                                                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[8px] font-black shadow-sm" title={tooltipText}>A</span>
                                                                        );
                                                                    } else if (statusStr === 'Paid Leave') {
                                                                        cellContent = isOtherSite ? (
                                                                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-450 border border-indigo-300 dark:border-indigo-850/50 text-[8px] font-black shadow-sm" title={tooltipText}>PL</span>
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

                        {/* ==========================================
                            TAB 4: FINANCES
                            ========================================== */}
                        {activeTab === 'finances' && (
                            <div className="space-y-3">
                                <div className="bg-white dark:bg-github-dark-subtle p-3 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between gap-3 text-xs">
                                    <span className="font-bold text-slate-800 dark:text-white">Select Month:</span>
                                    <input
                                        type="month"
                                        value={financeMonth}
                                        onChange={(e) => setFinanceMonth(e.target.value)}
                                        className="px-2.5 py-1 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-bold text-slate-700 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 cursor-pointer"
                                    />
                                </div>
                                {monthDetails && (
                                    <div className="bg-slate-100 dark:bg-github-dark-border p-2.5 rounded-xl text-[9px] font-bold text-slate-600 dark:text-github-dark-text text-center border border-slate-200/50">
                                        🗓️ {getMonthNameAndYear(monthDetails.start)} PERIOD: DAYS ELAPSED {monthDetails.elapsedDays} OF {monthDetails.totalDays}
                                    </div>
                                )}

                                <div className="grid gap-3">
                                    {financeSummary.length === 0 ? (
                                        <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
                                            No active labours to show ledger.
                                        </div>
                                    ) : (
                                        financeSummary.map(row => {
                                            const advanceAlert = row.advances_taken > row.accrued_credit;
                                            return (
                                                <div key={row.labour_id} className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-2xl border border-slate-200 dark:border-github-dark-border flex flex-col gap-2.5 shadow-sm">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 dark:text-white text-xs">{row.name}</h4>
                                                            <p className="text-[9px] text-slate-400">{row.site_name} | {row.wage_type}</p>
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 font-mono">
                                                            {row.attendance.present}P / {row.attendance.half_day}HD / {row.attendance.absent}A / {row.attendance.paid_leave || 0}PL
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-[#161b22]/40 p-2.5 rounded-xl border border-slate-100 dark:border-github-dark-border/40 text-[9px]">
                                                        <div>
                                                            <span className="block text-slate-400">Accrued Credit</span>
                                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">₹{row.accrued_credit}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-400">Advances Taken</span>
                                                            <span className="font-bold text-amber-500">₹{row.advances_taken}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-400">Net Payable</span>
                                                            <span className={`font-black flex items-center gap-0.5 ${advanceAlert ? 'text-rose-500' : 'text-slate-700 dark:text-white'}`}>
                                                                ₹{row.net_payable}
                                                                {advanceAlert && <AlertTriangle size={10} className="text-rose-500" />}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-github-dark-border/40 mt-1">
                                                         <div className="flex items-center gap-1.5">
                                                             <span className="text-[9px] text-slate-400">Base: ₹{row.monthly_salary}</span>
                                                             {row.payout ? (
                                                                 <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                                                     row.payout.status === 'Paid'
                                                                         ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border border-emerald-200/50'
                                                                         : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border border-amber-200/50'
                                                                 }`}>
                                                                     <span>{row.payout.status}</span>
                                                                 </span>
                                                             ) : (
                                                                 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-205">
                                                                     <span>Unprocessed</span>
                                                                 </span>
                                                             )}
                                                         </div>
                                                         <div className="flex gap-1.5">
                                                             <button
                                                                 onClick={() => handleOpenAdvance(row)}
                                                                 className="px-2 py-1 text-[9px] font-bold bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-705 dark:text-amber-400 hover:bg-amber-100 rounded-lg transition-colors"
                                                             >
                                                                 Log Advance
                                                             </button>
                                                             <button
                                                                 onClick={() => handleOpenPayout(row)}
                                                                 className={`px-2 py-1 text-[9px] font-bold border rounded-lg transition-colors ${
                                                                     row.payout
                                                                         ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                                                         : 'bg-indigo-600 dark:bg-indigo-700 text-white border-transparent'
                                                                 }`}
                                                             >
                                                                 {row.payout ? 'View Payout' : 'Release Salary'}
                                                             </button>
                                                         </div>
                                                     </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* MODALS */}
                {/* Site Modal (Same structure but mobile responsive sizing) */}
                {showSiteModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150 p-4 space-y-4">
                            <h4 className="font-bold text-slate-800 dark:text-white">
                                {editingSite ? 'Edit Site' : 'Create Site'}
                            </h4>
                            <form onSubmit={handleSaveSite} className="space-y-3">
                                <input
                                    type="text"
                                    value={siteForm.site_name}
                                    onChange={(e) => setSiteForm({ ...siteForm, site_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none"
                                    required
                                    placeholder="Site Name"
                                />
                                <textarea
                                    value={siteForm.location_details}
                                    onChange={(e) => setSiteForm({ ...siteForm, location_details: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none"
                                    rows={2}
                                    placeholder="Location details"
                                />
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowSiteModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold">Cancel</button>
                                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Labour Modal */}
                {showLabourModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150 p-4 space-y-4 max-h-[85vh] overflow-y-auto">
                            <h4 className="font-bold text-slate-800 dark:text-white">
                                {editingLabour ? 'Edit Worker' : 'Add Labour Worker'}
                            </h4>
                            <form onSubmit={handleSaveLabour} className="space-y-3">
                                <input
                                    type="text"
                                    value={labourForm.name}
                                    onChange={(e) => setLabourForm({ ...labourForm, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                    required
                                    placeholder="Worker Name"
                                />
                                <input
                                    type="tel"
                                    value={labourForm.phone}
                                    onChange={(e) => setLabourForm({ ...labourForm, phone: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                    placeholder="Phone number"
                                />
                                <select
                                    value={labourForm.sex}
                                    onChange={(e) => setLabourForm({ ...labourForm, sex: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                                <input
                                    type="text"
                                    value={labourForm.role}
                                    onChange={(e) => setLabourForm({ ...labourForm, role: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                    required
                                    placeholder="Role (e.g. Mason, Carpenter)"
                                />
                                <select
                                    value={labourForm.site_id}
                                    onChange={(e) => setLabourForm({ ...labourForm, site_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                >
                                    <option value="">Unassigned / Independent</option>
                                    {sites.map(s => (
                                        <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                    ))}
                                </select>
                                <select
                                    value={labourForm.wage_type}
                                    onChange={(e) => setLabourForm({ ...labourForm, wage_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                >
                                    <option value="Daily Wage">Daily Wage</option>
                                    <option value="Fixed Salary">Fixed Salary</option>
                                </select>
                                <input
                                    type="number"
                                    value={labourForm.monthly_salary}
                                    onChange={(e) => setLabourForm({ ...labourForm, monthly_salary: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                    required
                                    placeholder="Monthly Salary"
                                />
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowLabourModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold">Cancel</button>
                                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Advance Modal */}
                {showAdvanceModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-4 space-y-4">
                            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                                <DollarSign size={16} className="text-amber-500" />
                                <span>Log Advance ({advanceForm.name})</span>
                            </h4>
                            <form onSubmit={handleSaveAdvance} className="space-y-3">
                                <input
                                    type="number"
                                    value={advanceForm.amount}
                                    onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                    required
                                    placeholder="Advance Amount"
                                />
                                <input
                                    type="date"
                                    value={advanceForm.date}
                                    onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                    required
                                />
                                <input
                                    type="text"
                                    value={advanceForm.notes}
                                    onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                    placeholder="Notes (e.g. Festival)"
                                />
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowAdvanceModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold">Cancel</button>
                                    <button type="submit" className="flex-1 py-2 bg-amber-500 text-white rounded-xl font-bold">Record</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Payout Modal */}
                {showPayoutModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-4 space-y-4 text-xs">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-github-dark-border">
                                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                                    <DollarSign size={16} className="text-indigo-500" />
                                    <span>{payoutForm.payout_id ? 'Update Payout' : 'Process Payout'}</span>
                                </h4>
                                <button onClick={() => setShowPayoutModal(false)} className="text-slate-400"><XCircle size={16} /></button>
                            </div>
                            
                            <form onSubmit={handleSavePayout} className="space-y-3">
                                <div className="bg-indigo-50 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-150 dark:border-indigo-900/30 text-[10px]">
                                    <div className="font-bold text-slate-700 dark:text-slate-300">Name: {payoutForm.name}</div>
                                    <div className="text-slate-500 font-mono mt-0.5">{payoutForm.wage_type} | Month: {payoutForm.month}</div>
                                </div>

                                {/* Earnings Grid */}
                                <div className="grid grid-cols-2 gap-2 bg-slate-55 dark:bg-[#161b22]/60 p-2.5 rounded-xl border border-slate-150 dark:border-github-dark-border text-[10px]">
                                    <div>
                                        <span className="text-slate-400 block">Attendance:</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                            {payoutForm.present_days}P / {payoutForm.half_days}HD / {payoutForm.absent_days}A
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block">Accrued Credit:</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">₹{payoutForm.accrued_credit}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block">Advances Taken:</span>
                                        <span className="font-bold text-amber-500">-₹{payoutForm.advances_taken}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-450 font-bold block">Net Payable:</span>
                                        <span className="font-extrabold text-indigo-650 dark:text-indigo-400">₹{payoutForm.net_payable}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-slate-450 font-semibold mb-1 text-[10px]">Paid Amount</label>
                                        <input
                                            type="number"
                                            value={payoutForm.paid_amount}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, paid_amount: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none"
                                            required
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-455 font-semibold mb-1 text-[10px]">Status</label>
                                        <select
                                            value={payoutForm.status}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, status: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none"
                                        >
                                            <option value="Paid">Paid</option>
                                            <option value="Pending">Pending</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-slate-455 font-semibold mb-1 text-[10px]">Payment Date</label>
                                    <input
                                        type="date"
                                        value={payoutForm.payment_date}
                                        onChange={(e) => setPayoutForm({ ...payoutForm, payment_date: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#161b22] border border-slate-205 dark:border-github-dark-border rounded-lg text-xs focus:outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-455 font-semibold mb-1 text-[10px]">Notes</label>
                                    <input
                                        type="text"
                                        value={payoutForm.notes}
                                        onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none"
                                        placeholder="Payment method or Ref#"
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowPayoutModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold transition-colors">Cancel</button>
                                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-sm transition-colors">
                                        {payoutForm.payout_id ? 'Update' : 'Release'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    MODAL: BULK TRANSFER
                    ========================================== */}
                {showBulkTransferModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 text-xs">
                        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-4 space-y-4">
                            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                                <Building size={16} className="text-indigo-500" />
                                <span>Bulk Transfer Workers</span>
                            </h4>
                            <form onSubmit={handleExecuteBulkTransfer} className="space-y-3">
                                <div>
                                    <label className="block text-slate-400 font-bold mb-1 text-[10px] uppercase">Source Site</label>
                                    <select
                                        value={bulkSourceSiteId}
                                        onChange={(e) => {
                                            setBulkSourceSiteId(e.target.value);
                                            setSelectedLabourIds([]);
                                        }}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                    >
                                        <option value="All">All Sites</option>
                                        <option value="Unassigned">Unassigned</option>
                                        {sites.map(s => (
                                            <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-400 font-bold mb-1 text-[10px] uppercase">Destination Site</label>
                                    <select
                                        value={bulkDestinationSiteId}
                                        onChange={(e) => setBulkDestinationSiteId(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                        required
                                    >
                                        <option value="">-- Select Destination Site --</option>
                                        <option value="Unassigned">Unassigned / Independent</option>
                                        {sites.map(s => (
                                            <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <span className="block text-slate-400 font-bold text-[10px] uppercase">Select Workers:</span>
                                    <div className="border border-slate-200 dark:border-github-dark-border rounded-xl max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-[#161b22]/40 divide-y divide-slate-100 dark:divide-github-dark-border/40">
                                        {labours
                                            .filter(lab => {
                                                if (bulkSourceSiteId === 'Unassigned') return lab.site_id === null;
                                                if (bulkSourceSiteId !== 'All') return lab.site_id === Number(bulkSourceSiteId);
                                                return true;
                                            })
                                            .map(lab => (
                                                <label key={lab.labour_id} className="flex items-center gap-2 py-1.5">
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
                                                    />
                                                    <span className="font-semibold text-slate-800 dark:text-github-dark-text text-[11px]">{lab.name}</span>
                                                </label>
                                            ))}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowBulkTransferModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold">Cancel</button>
                                    <button type="submit" disabled={selectedLabourIds.length === 0} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">Transfer</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    MODAL: BORROW/ADD FLOATING WORKER
                    ========================================== */}
                {showBorrowModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 text-xs">
                        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-4 space-y-3">
                            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                                <Plus size={16} className="text-indigo-500" />
                                <span>Borrow Worker for Today</span>
                            </h4>
                            <input
                                type="text"
                                placeholder="Search by name..."
                                value={borrowSearchQuery}
                                onChange={(e) => setBorrowSearchQuery(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none"
                            />
                            <div className="border border-slate-200 dark:border-github-dark-border rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-github-dark-border/40">
                                {labours
                                    .filter(lab => {
                                        const isAlreadyInRoster = attendanceRoster.some(r => r.labour_id === lab.labour_id);
                                        const matchesSearch = lab.name.toLowerCase().includes(borrowSearchQuery.toLowerCase());
                                        return !isAlreadyInRoster && matchesSearch && lab.status === 'Active';
                                    })
                                    .map(lab => (
                                        <div
                                            key={lab.labour_id}
                                            onClick={() => handleBorrowLabour(lab)}
                                            className="flex justify-between items-center p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                        >
                                            <div>
                                                <span className="font-bold text-slate-800 dark:text-github-dark-text block">{lab.name}</span>
                                                <span className="text-[9px] text-slate-400">{lab.role}</span>
                                            </div>
                                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded">Select</span>
                                        </div>
                                    ))}
                            </div>
                            <button type="button" onClick={() => setShowBorrowModal(false)} className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold">Close</button>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    MODAL: SITE CLOSURE REASSIGNMENT PROMPT
                    ========================================== */}
                {showSiteClosurePrompt && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 text-xs">
                        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-4 space-y-3">
                            <h4 className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                <AlertTriangle size={18} />
                                <span>Reassign Workers ({closureLabours.length})</span>
                            </h4>
                            <p className="text-slate-500">
                                This site is now closed. Select where to transfer the assigned workers:
                            </p>
                            <form onSubmit={handleConfirmSiteClosure} className="space-y-3">
                                <select
                                    value={closureDestinationSiteId}
                                    onChange={(e) => setClosureDestinationSiteId(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl"
                                >
                                    <option value="">Leave Unassigned / Independent</option>
                                    {sites
                                        .filter(s => s.site_id !== Number(closureSiteId) && s.status === 'Active')
                                        .map(s => (
                                            <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                        ))}
                                </select>
                                <div className="flex gap-2 pt-1">
                                    <button type="button" onClick={() => setShowSiteClosurePrompt(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold">Cancel</button>
                                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold">Reassign</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    SLIDE-OVER: WORK HISTORY & INSIGHTS
                    ========================================== */}
                {selectedHistoryLabour && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-github-dark-subtle rounded-t-2xl shadow-xl w-full max-h-[80vh] overflow-hidden flex flex-col justify-between p-4 space-y-4 animate-in slide-in-from-bottom duration-200">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-github-dark-border">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{selectedHistoryLabour.name}</h4>
                                    <span className="text-[9px] text-slate-400">{selectedHistoryLabour.role} | Work Insights</span>
                                </div>
                                <button onClick={() => setSelectedHistoryLabour(null)} className="text-slate-400"><X size={18} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4 text-xs">
                                {/* Tab selector */}
                                <div className="flex bg-slate-100 dark:bg-[#161b22] p-1 rounded-xl border border-slate-200 dark:border-github-dark-border select-none">
                                    <button
                                        type="button"
                                        onClick={() => setHistoryTab('sites')}
                                        className={`flex-1 text-center py-1.5 font-bold rounded-lg text-[10px] transition-all ${
                                            historyTab === 'sites'
                                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        Sites
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHistoryTab('payouts')}
                                        className={`flex-1 text-center py-1.5 font-bold rounded-lg text-[10px] transition-all ${
                                            historyTab === 'payouts'
                                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        Payout History
                                    </button>
                                </div>

                                {historyLoading ? (
                                    <div className="py-10 flex justify-center"><Clock className="animate-spin text-indigo-500" size={20} /></div>
                                ) : historyTab === 'sites' ? (
                                    labourHistoryData.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 italic">No site history logged.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {labourHistoryData.map(siteLog => {
                                                const attendanceRate = siteLog.total_days > 0 
                                                    ? Math.round(((siteLog.present_days + siteLog.paid_leave_days + (0.5 * siteLog.half_day_days)) / siteLog.total_days) * 100)
                                                    : 0;
                                                return (
                                                    <div key={siteLog.site_id} className="bg-slate-50 dark:bg-[#161b22]/40 p-3 rounded-xl border border-slate-150 dark:border-github-dark-border">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className="font-bold text-[11px] block">{siteLog.site_name || 'Unassigned'}</span>
                                                                <span className="text-[8px] text-slate-400 block mt-0.5">
                                                                    {new Date(siteLog.first_date).toLocaleDateString()} - {new Date(siteLog.last_date).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">{attendanceRate}% Active</span>
                                                        </div>
                                                        <div className="grid grid-cols-4 gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-github-dark-border/40 text-center font-bold text-[9px]">
                                                            <div className="text-emerald-600">Pres: {siteLog.present_days}</div>
                                                            <div className="text-amber-505">HD: {siteLog.half_day_days}</div>
                                                            <div className="text-indigo-500">PL: {siteLog.paid_leave_days}</div>
                                                            <div className="text-rose-505">Abs: {siteLog.absent_days}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    labourPayoutHistory.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 italic">No payout history logged.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {labourPayoutHistory.map(payout => {
                                                const pDate = new Date(payout.payment_date);
                                                const monthYearFormatted = getMonthNameAndYear(payout.month + '-01');
                                                return (
                                                    <div key={payout.payout_id} className="bg-slate-50 dark:bg-[#161b22]/40 p-3.5 rounded-xl border border-slate-150 dark:border-github-dark-border space-y-2">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className="font-bold text-[11px] block">{monthYearFormatted}</span>
                                                                <span className="text-[8px] text-slate-400 block mt-0.5">
                                                                    Paid Date: {pDate.toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                                                payout.status === 'Paid'
                                                                    ? 'bg-emerald-55 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-250/30'
                                                                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-250/30'
                                                            }`}>
                                                                {payout.status}
                                                            </span>
                                                        </div>

                                                        {/* Summary Grid */}
                                                        <div className="grid grid-cols-2 gap-2 bg-white dark:bg-[#1c2128] p-2 rounded-lg border border-slate-100 dark:border-github-dark-border/40 text-[9px]">
                                                            <div>
                                                                <span className="text-slate-405 block">Wage Type:</span>
                                                                <span className="font-semibold text-slate-707 dark:text-slate-300">{payout.wage_type}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-450 block">Accrued Credit:</span>
                                                                <span className="font-bold text-slate-700 dark:text-slate-300">₹{payout.accrued_credit}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-450 block">Advances:</span>
                                                                <span className="font-semibold text-amber-600">₹{payout.advances_taken}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-450 font-bold block">Actual Paid:</span>
                                                                <span className="font-black text-indigo-650 dark:text-indigo-400">₹{payout.paid_amount}</span>
                                                            </div>
                                                        </div>

                                                        {payout.notes && (
                                                            <div className="text-[9px] text-slate-500 italic bg-white dark:bg-[#1c2128]/40 p-1.5 rounded border-l border-slate-350">
                                                                Notes: {payout.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                )}
                            </div>

                            <button onClick={() => setSelectedHistoryLabour(null)} className="w-full py-2 bg-slate-800 text-white rounded-xl font-bold">Close Panel</button>
                        </div>
                    </div>
                )}
            </div>
        </MobileDashboardLayout>
    );
};

export default MobileLabourManagement;
