import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { labourService } from '../../services/labourService';
import { toast } from 'react-toastify';
import {
    Building, Calendar, DollarSign, Clock, Plus, Search,
    UserPlus, Edit2, Trash2, Save, AlertTriangle, User, Phone, X,
    CheckCircle, CheckCircle2, XCircle, Upload, ChevronRight, ChevronLeft,
    Loader2, ArrowLeft, ArrowRight, HardHat, Wrench, Users, Wallet,
    Filter, FileSpreadsheet, Download, RefreshCw, Undo2, Check, Minus,
    Tag, History, Layers, Eye, CheckSquare, Sparkles, Building2,
    CalendarCheck, UserCheck, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MinimalSelect from '../../components/MinimalSelect';
import MobileDatePicker from '../../components/MobileDatePicker';
import MonthPicker from '../../components/MonthPicker';
import LoadingScreen from '../../components/LoadingScreen';
import { formatPlatformDate } from '../../utils/dateUtils';

// ============================================================================
// DESIGN SYSTEM TOKENS & BADGE HELPERS (MATCHING FLUTTER REFERENCE)
// ============================================================================

const getSkillColor = (skillName) => {
    const s = (skillName || '').toLowerCase().trim();
    switch (s) {
        case 'mason':
            return { color: '#6366F1', bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.35)' };
        case 'electrician':
            return { color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.35)' };
        case 'carpenter':
            return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)' };
        case 'plumber':
            return { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.35)' };
        case 'welder':
            return { color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.35)' };
        case 'painter':
            return { color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.35)' };
        case 'foreman':
        case 'supervisor':
            return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)' };
        case 'bar bender':
        case 'tile layer':
            return { color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.35)' };
        case 'helper':
        default:
            return { color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.35)' };
    }
};

const SkillBadge = ({ skill }) => {
    const { color, bg, border } = getSkillColor(skill);
    return (
        <span
            className="px-2 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider inline-block"
            style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
        >
            {skill || 'HELPER'}
        </span>
    );
};

const SiteStatusBadge = ({ status }) => {
    const s = (status || '').toLowerCase();
    let color = '#10B981';
    let bg = 'rgba(16, 185, 129, 0.12)';
    let border = 'rgba(16, 185, 129, 0.3)';
    let label = 'ACTIVE';

    if (s === 'completed') {
        color = '#3B82F6';
        bg = 'rgba(59, 130, 246, 0.12)';
        border = 'rgba(59, 130, 246, 0.3)';
        label = 'COMPLETED';
    } else if (s === 'on hold' || s === 'inactive') {
        color = '#F59E0B';
        bg = 'rgba(245, 158, 11, 0.12)';
        border = 'rgba(245, 158, 11, 0.3)';
        label = s === 'inactive' ? 'INACTIVE' : 'ON HOLD';
    }

    return (
        <span
            className="px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 shrink-0"
            style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{label}</span>
        </span>
    );
};

const LabourStatCard = ({ title, value, icon: Icon, iconColor, subtitle }) => {
    return (
        <div className="p-3 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] shadow-2xs flex items-center gap-2.5">
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${iconColor}1f` }}
            >
                <Icon size={16} style={{ color: iconColor }} />
            </div>
            <div className="min-w-0 flex-1">
                <span className="block text-[9px] font-semibold text-slate-500 dark:text-[#8B949E] uppercase tracking-wider truncate">
                    {title}
                </span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                    {value}
                </span>
                {subtitle && (
                    <span className="block text-[8.5px] text-slate-400 dark:text-[#6E7681] truncate">
                        {subtitle}
                    </span>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT: MOBILE LABOUR MANAGEMENT
// ============================================================================

const MobileLabourManagement = () => {
    // ------------------------------------------------------------------------
    // TOP NAVIGATION & DRILL-DOWN STATES
    // ------------------------------------------------------------------------
    // 'sites' (Sites Overview / Drill-down) or 'directory' (Worker Directory)
    const [activeTab, setActiveTab] = useState('sites');
    // Selected site for drill-down (null = Site Directory view, object = Site Dashboard)
    const [selectedSite, setSelectedSite] = useState(null);
    // Sub-tab inside Site Dashboard: 'attendance' | 'grid' | 'finances'
    const [subTab, setSubTab] = useState('attendance');
    // Monthly Grid View Mode: false = Mobile Cards, true = Full Spreadsheet Table
    const [isGridTableMode, setIsGridTableMode] = useState(false);

    // ------------------------------------------------------------------------
    // DATA STATES (MATCHING FLUTTER MODELS)
    // ------------------------------------------------------------------------
    const [sites, setSites] = useState([]);
    const [labours, setLabours] = useState([]);
    const [attendanceRoster, setAttendanceRoster] = useState([]);
    const [gridData, setGridData] = useState([]);
    const [financeSummary, setFinanceSummary] = useState([]);
    const [loading, setLoading] = useState(true);

    // Unsaved Changes Tracking & Batch Selection
    const [selectedRosterIds, setSelectedRosterIds] = useState(new Set());
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [savingRoster, setSavingRoster] = useState(false);

    // ------------------------------------------------------------------------
    // FILTERS & LOCAL SEARCH STATES
    // ------------------------------------------------------------------------
    // Sites Overview filters
    const [siteSearch, setSiteSearch] = useState('');
    const [siteStatusFilter, setSiteStatusFilter] = useState('All'); // 'All' | 'Active' | 'Completed' | 'On Hold'

    // Attendance Tab filters & dates
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceSearch, setAttendanceSearch] = useState('');
    const [attendanceRoleFilter, setAttendanceRoleFilter] = useState('All');
    const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('All'); // 'All' | 'Present' | 'Half Day' | 'Absent' | 'Paid Leave' | 'Unmarked'
    const [showAttendanceSearch, setShowAttendanceSearch] = useState(false);
    const [attendanceLoading, setAttendanceLoading] = useState(false);

    // Monthly Grid filters & dates
    const [gridMonth, setGridMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [gridRoleFilter, setGridRoleFilter] = useState('All');
    const [gridLoading, setGridLoading] = useState(false);

    // Finances filters & dates
    const [financeMonth, setFinanceMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [financeRoleFilter, setFinanceRoleFilter] = useState('All');
    const [financeLoading, setFinanceLoading] = useState(false);

    // Worker Directory filters
    const [directorySearch, setDirectorySearch] = useState('');
    const [directorySiteFilter, setDirectorySiteFilter] = useState('All'); // 'All' | 'Unassigned' | site_id
    const [directoryRoleFilter, setDirectoryRoleFilter] = useState('All');

    // ------------------------------------------------------------------------
    // MODAL DIALOG / BOTTOM-SHEET STATES
    // ------------------------------------------------------------------------
    const [showSiteModal, setShowSiteModal] = useState(false);
    const [editingSite, setEditingSite] = useState(null);
    const [siteForm, setSiteForm] = useState({ site_name: '', location_details: '', status: 'Active' });

    const [showLabourModal, setShowLabourModal] = useState(false);
    const [editingLabour, setEditingLabour] = useState(null);
    const [labourForm, setLabourForm] = useState({
        name: '', phone: '', sex: 'Male', role: '',
        wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '',
        overtime_pay_per_hour: '0', status: 'Active'
    });

    const [showBorrowModal, setShowBorrowModal] = useState(false);
    const [borrowSearchQuery, setBorrowSearchQuery] = useState('');

    const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
    const [bulkSourceSiteId, setBulkSourceSiteId] = useState('All');
    const [bulkDestinationSiteId, setBulkDestinationSiteId] = useState('');
    const [selectedTransferLabourIds, setSelectedTransferLabourIds] = useState([]);

    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [advanceForm, setAdvanceForm] = useState({
        labour_id: '', site_id: '', name: '', amount: '',
        date: new Date().toISOString().split('T')[0], notes: '',
        accrued_credit: 0, net_payable: 0
    });
    const [advanceHistory, setAdvanceHistory] = useState([]);
    const [advancePayouts, setAdvancePayouts] = useState([]);
    const [advanceHistoryLoading, setAdvanceHistoryLoading] = useState(false);
    const [advanceHistoryView, setAdvanceHistoryView] = useState('month'); // 'month' | 'all'

    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [payoutForm, setPayoutForm] = useState({
        payout_id: null, labour_id: '', site_id: '', name: '', month: '',
        wage_type: 'Daily Wage', monthly_salary: '', present_days: 0,
        half_days: 0, absent_days: 0, paid_leaves: 0, accrued_credit: 0,
        advances_taken: 0, net_payable: 0, paid_amount: '', status: 'Paid',
        payment_date: new Date().toISOString().split('T')[0], notes: ''
    });

    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedScheduleLabour, setSelectedScheduleLabour] = useState(null);
    const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
    const [scheduleSites, setScheduleSites] = useState([]);
    const [scheduleLoading, setScheduleLoading] = useState(false);

    const [selectedHistoryLabour, setSelectedHistoryLabour] = useState(null);
    const [selectedHistoryLabourDetails, setSelectedHistoryLabourDetails] = useState(null);
    const [labourHistoryData, setLabourHistoryData] = useState([]);
    const [labourPayoutHistory, setLabourPayoutHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTab, setHistoryTab] = useState('sites'); // 'sites' | 'payouts' | 'wages'

    // Wage Revision Modal
    const [wageRevisionWorker, setWageRevisionWorker] = useState(null);
    const [wageRevisionList, setWageRevisionList] = useState([]);
    const [wageRevisionLoading, setWageRevisionLoading] = useState(false);
    const [showAddRevisionForm, setShowAddRevisionForm] = useState(false);
    const [newRevisionForm, setNewRevisionForm] = useState({
        effective_date: new Date().toISOString().split('T')[0],
        daily_rate: '',
        overtime_pay_per_hour: '',
        notes: ''
    });

    const [showBulkLabourModal, setShowBulkLabourModal] = useState(false);
    const [parsedLabours, setParsedLabours] = useState([]);
    const [isUploadingBulk, setIsUploadingBulk] = useState(false);

    // Custom Generic Confirmation Dialog
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        isDestructive: false,
        onConfirm: null
    });

    // ------------------------------------------------------------------------
    // DATA FETCHING HANDLERS
    // ------------------------------------------------------------------------
    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [sitesData, laboursData] = await Promise.all([
                labourService.getAllSites(),
                labourService.getAllLabours()
            ]);
            setSites(sitesData || []);
            setLabours(laboursData || []);
        } catch (err) {
            toast.error(err.message || 'Failed to load labour management data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadAttendanceRoster = async () => {
        if (!selectedSite) return;
        setAttendanceLoading(true);
        try {
            const res = await labourService.getSiteAttendance(selectedSite.site_id, attendanceDate);
            setAttendanceRoster(res.roster || []);
            setSelectedRosterIds(new Set());
            setHasUnsavedChanges(false);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch attendance roster');
            setAttendanceRoster([]);
        } finally {
            setAttendanceLoading(false);
        }
    };

    const loadMonthlyGrid = async () => {
        if (!selectedSite) return;
        setGridLoading(true);
        try {
            const res = await labourService.getMonthlyGridAttendance(selectedSite.site_id, gridMonth, false);
            setGridData(res.grid || []);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch monthly grid');
            setGridData([]);
        } finally {
            setGridLoading(false);
        }
    };

    const loadFinances = async () => {
        if (!selectedSite) return;
        setFinanceLoading(true);
        try {
            const res = await labourService.getFinancesSummary(selectedSite.site_id, financeMonth);
            setFinanceSummary(res.summary || []);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch financial ledger');
            setFinanceSummary([]);
        } finally {
            setFinanceLoading(false);
        }
    };

    // Load data upon site selection or subtab switch
    useEffect(() => {
        if (selectedSite) {
            if (subTab === 'attendance') {
                loadAttendanceRoster();
            } else if (subTab === 'grid') {
                loadMonthlyGrid();
            } else if (subTab === 'finances') {
                loadFinances();
            }
        }
    }, [selectedSite, subTab, attendanceDate, gridMonth, financeMonth]);

    // ------------------------------------------------------------------------
    // SITE SELECTION & NAVIGATION HANDLERS
    // ------------------------------------------------------------------------
    const handleSelectSite = (site) => {
        setSelectedSite(site);
        setSubTab('attendance');
        setAttendanceStatusFilter('All');
        setSelectedRosterIds(new Set());
        setHasUnsavedChanges(false);
        setGridMonth(attendanceDate.slice(0, 7));
        setFinanceMonth(attendanceDate.slice(0, 7));
    };

    const handleBackToSites = () => {
        setSelectedSite(null);
        setSelectedRosterIds(new Set());
        setHasUnsavedChanges(false);
    };

    // ------------------------------------------------------------------------
    // ATTENDANCE SUB-TAB HANDLERS & BATCH ACTIONS
    // ------------------------------------------------------------------------
    const handleSaveAttendance = async () => {
        if (!selectedSite || savingRoster) return;
        setSavingRoster(true);
        try {
            await labourService.saveSiteAttendance(selectedSite.site_id, attendanceDate, attendanceRoster);
            toast.success('Attendance saved successfully!');
            setHasUnsavedChanges(false);
            setSelectedRosterIds(new Set());
            await loadAttendanceRoster();
            if (gridData.length > 0) loadMonthlyGrid();
        } catch (err) {
            toast.error(err.message || 'Failed to save attendance roster');
        } finally {
            setSavingRoster(false);
        }
    };

    const toggleSelectRosterItem = (labourId) => {
        setSelectedRosterIds(prev => {
            const next = new Set(prev);
            if (next.has(labourId)) next.delete(labourId);
            else next.add(labourId);
            return next;
        });
    };

    const toggleSelectAllVisible = (visibleRoster) => {
        setSelectedRosterIds(prev => {
            const visibleIds = visibleRoster.map(r => r.labour_id || r.labourId);
            const allSelected = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
            const next = new Set(prev);
            if (allSelected) {
                visibleIds.forEach(id => next.delete(id));
            } else {
                visibleIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const setItemStatus = (labourId, newStatus) => {
        const item = attendanceRoster.find(r => (r.labour_id || r.labourId) === labourId);
        const isConflict = (newStatus === 'Present' || newStatus === 'Half Day' || newStatus === 'Paid Leave') &&
            item?.already_marked_at && !item?.is_scheduled_multi_site;

        if (isConflict) {
            toast.error(`Worker is already marked ${item.already_marked_at.status} at ${item.already_marked_at.site_name}.`);
            return;
        }

        setAttendanceRoster(prev =>
            prev.map(r => {
                const id = r.labour_id || r.labourId;
                if (id !== labourId) return r;
                const nextStatus = r.status === newStatus ? '' : newStatus;
                return {
                    ...r,
                    status: nextStatus,
                    overtime_hours: nextStatus === 'Present' ? (r.overtime_hours || 0) : 0
                };
            })
        );
        setHasUnsavedChanges(true);
    };

    const setItemOvertime = (labourId, otHours) => {
        const clamped = Math.max(0, Math.min(12, Number(otHours || 0)));
        setAttendanceRoster(prev =>
            prev.map(r => (r.labour_id || r.labourId) === labourId ? { ...r, overtime_hours: clamped } : r)
        );
        setHasUnsavedChanges(true);
    };

    const batchSetStatus = (status) => {
        if (selectedRosterIds.size === 0) return;
        let count = 0;
        setAttendanceRoster(prev =>
            prev.map(r => {
                const id = r.labour_id || r.labourId;
                if (!selectedRosterIds.has(id)) return r;

                const isConflict = (status === 'Present' || status === 'Half Day' || status === 'Paid Leave') &&
                    r.already_marked_at && !r.is_scheduled_multi_site;
                if (isConflict) return r;

                if (status === 'Paid Leave' && !(r.wage_type || '').toLowerCase().includes('fixed')) {
                    return r;
                }

                count++;
                return {
                    ...r,
                    status,
                    overtime_hours: status === 'Present' ? (r.overtime_hours || 0) : 0
                };
            })
        );
        setHasUnsavedChanges(true);
        toast.success(`Updated ${count} selected worker(s) to ${status}`);
    };

    const batchAdjustOvertime = (delta) => {
        if (selectedRosterIds.size === 0) return;
        setAttendanceRoster(prev =>
            prev.map(r => {
                const id = r.labour_id || r.labourId;
                if (selectedRosterIds.has(id) && r.status === 'Present') {
                    const nextOt = Math.max(0, Math.min(12, Number(r.overtime_hours || 0) + delta));
                    return { ...r, overtime_hours: nextOt };
                }
                return r;
            })
        );
        setHasUnsavedChanges(true);
    };

    const markAllVisible = (visibleRoster, status) => {
        setAttendanceRoster(prev =>
            prev.map(r => {
                const isVisible = visibleRoster.some(vr => (vr.labour_id || vr.labourId) === (r.labour_id || r.labourId));
                if (!isVisible) return r;

                const isConflict = (status === 'Present' || status === 'Half Day' || status === 'Paid Leave') &&
                    r.already_marked_at && !r.is_scheduled_multi_site;
                if (isConflict) return r;

                if (status === 'Paid Leave' && !(r.wage_type || '').toLowerCase().includes('fixed')) {
                    return r;
                }

                return {
                    ...r,
                    status,
                    overtime_hours: status === 'Present' ? (r.overtime_hours || 0) : 0
                };
            })
        );
        setHasUnsavedChanges(true);
        if (attendanceStatusFilter === 'Unmarked' && status) setAttendanceStatusFilter('All');
        toast.info(`Marked visible workers as ${status}. Click 'Save Roster' to commit.`);
    };

    const markUnmarkedVisible = (visibleRoster, status) => {
        let changed = 0;
        setAttendanceRoster(prev =>
            prev.map(r => {
                const isVisible = visibleRoster.some(vr => (vr.labour_id || vr.labourId) === (r.labour_id || r.labourId));
                if (!isVisible || r.status) return r;

                const isConflict = (status === 'Present' || status === 'Half Day' || status === 'Paid Leave') &&
                    r.already_marked_at && !r.is_scheduled_multi_site;
                if (isConflict) return r;

                if (status === 'Paid Leave' && !(r.wage_type || '').toLowerCase().includes('fixed')) {
                    return r;
                }

                changed++;
                return {
                    ...r,
                    status,
                    overtime_hours: status === 'Present' ? (r.overtime_hours || 0) : 0
                };
            })
        );
        if (changed > 0) setHasUnsavedChanges(true);
        if (attendanceStatusFilter === 'Unmarked') setAttendanceStatusFilter('All');
        toast.info(`Marked ${changed} unmarked worker(s) as ${status}.`);
    };

    const resetAllVisible = (visibleRoster) => {
        setAttendanceRoster(prev =>
            prev.map(r => {
                const isVisible = visibleRoster.some(vr => (vr.labour_id || vr.labourId) === (r.labour_id || r.labourId));
                if (!isVisible) return r;
                return { ...r, status: '', overtime_hours: 0 };
            })
        );
        setHasUnsavedChanges(true);
        toast.info('Cleared marks for visible workers.');
    };

    // ------------------------------------------------------------------------
    // MONTHLY GRID EXPORT & HELPERS
    // ------------------------------------------------------------------------
    const exportMonthlyGridToExcel = () => {
        if (!gridData || gridData.length === 0) {
            toast.warn('No grid data available to export');
            return;
        }

        const [yr, mo] = gridMonth.split('-').map(Number);
        const daysInMonth = new Date(yr, mo, 0).getDate();

        // Build CSV content
        const headers = ['Worker Name', 'Role', ...Array.from({ length: daysInMonth }, (_, i) => `Day ${i + 1}`), 'Present (P)', 'Half Day (HD)', 'Absent (A)', 'Paid Leave (PL)', 'Overtime (OT hrs)'];
        const rows = gridData.map(row => {
            const dayValues = [];
            for (let d = 1; d <= daysInMonth; d++) {
                let st = row.days ? row.days[String(d)] || '' : '';
                if (!st) {
                    const dt = new Date(yr, mo - 1, d);
                    if (dt.getDay() === 0) st = 'WO';
                }
                dayValues.push(st || '-');
            }
            return [
                `"${row.name || ''}"`,
                `"${row.role || ''}"`,
                ...dayValues.map(v => `"${v}"`),
                row.total_present || row.totalPresent || 0,
                row.total_half_days || row.totalHalfDays || 0,
                row.total_absent || row.totalAbsent || 0,
                row.total_paid_leaves || row.totalPaidLeaves || 0,
                (row.total_overtime_hours || row.totalOvertimeHours || 0).toFixed(1)
            ];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedSite?.site_name || 'Site'}_Monthly_Grid_${gridMonth}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast.success('Monthly attendance exported successfully!');
    };

    const exportPayoutsToExcel = async () => {
        if (!selectedSite) return;
        try {
            await labourService.exportMonthlyWageExcel(selectedSite.site_id, financeMonth);
            toast.success('Payout ledger exported to Excel!');
        } catch (err) {
            toast.error(err.message || 'Failed to export payroll ledger');
        }
    };

    // ------------------------------------------------------------------------
    // WAGE REVISION HISTORY HANDLERS
    // ------------------------------------------------------------------------
    const openWageRevisionDialog = async (worker) => {
        setWageRevisionWorker(worker);
        setShowAddRevisionForm(false);
        setNewRevisionForm({
            effective_date: new Date().toISOString().split('T')[0],
            daily_rate: String(worker.monthly_salary || 500),
            overtime_pay_per_hour: String(worker.overtime_pay_per_hour || 0),
            notes: ''
        });
        setWageRevisionLoading(true);
        try {
            const res = await labourService.getLabourWageHistory(worker.labour_id || worker.labourId);
            setWageRevisionList(res.history || []);
        } catch (err) {
            toast.error(err.message || 'Failed to load wage history');
            setWageRevisionList([]);
        } finally {
            setWageRevisionLoading(false);
        }
    };

    const handleSaveNewRevision = async (e) => {
        e.preventDefault();
        if (!wageRevisionWorker) return;
        try {
            await labourService.addLabourWageRevision(wageRevisionWorker.labour_id || wageRevisionWorker.labourId, {
                effective_date: newRevisionForm.effective_date,
                daily_rate: Number(newRevisionForm.daily_rate),
                overtime_pay_per_hour: Number(newRevisionForm.overtime_pay_per_hour || 0),
                notes: newRevisionForm.notes
            });
            toast.success('Wage revision logged!');
            setShowAddRevisionForm(false);
            openWageRevisionDialog(wageRevisionWorker);
            loadInitialData();
        } catch (err) {
            toast.error(err.message || 'Failed to add wage revision');
        }
    };

    const handleDeleteRevision = (revisionId) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Wage Revision',
            message: 'Are you sure you want to remove this wage revision record?',
            confirmText: 'Delete',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await labourService.deleteLabourWageRevision(revisionId);
                    toast.success('Wage revision deleted');
                    if (wageRevisionWorker) openWageRevisionDialog(wageRevisionWorker);
                    loadInitialData();
                } catch (err) {
                    toast.error(err.message || 'Failed to delete revision');
                }
            }
        });
    };

    // ------------------------------------------------------------------------
    // ADVANCE & PAYOUT HANDLERS
    // ------------------------------------------------------------------------
    const loadAdvanceHistory = async (labourId, month = financeMonth) => {
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
        const todayStr = new Date().toISOString().split('T')[0];
        const initialDate = todayStr.startsWith(initialMonth) ? todayStr : `${initialMonth}-01`;

        setAdvanceForm({
            labour_id: labour.labour_id || labour.labourId,
            site_id: selectedSite ? selectedSite.site_id.toString() : 'All',
            name: labour.name,
            amount: '',
            date: initialDate,
            notes: '',
            accrued_credit: labour.accrued_credit || 0,
            net_payable: labour.net_payable || 0
        });
        setAdvanceHistoryView('month');
        loadAdvanceHistory(labour.labour_id || labour.labourId, initialMonth);
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
            toast.success(`Advance logged for ${advanceForm.name}`);
            setAdvanceForm(prev => ({ ...prev, amount: '', notes: '' }));
            loadAdvanceHistory(advanceForm.labour_id, advanceHistoryView === 'month' ? financeMonth : null);
            if (selectedSite) loadFinances();
            if (selectedHistoryLabour) handleViewHistory(selectedHistoryLabour);
        } catch (err) {
            toast.error(err.message || 'Failed to log advance payment');
        }
    };

    const handleDeleteAdvance = async (advanceId) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Advance Entry',
            message: 'Are you sure you want to delete this advance payment record?',
            confirmText: 'Delete Entry',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await labourService.deleteLabourAdvance(advanceId);
                    toast.success('Advance record deleted');
                    loadAdvanceHistory(advanceForm.labour_id, advanceHistoryView === 'month' ? financeMonth : null);
                    if (selectedSite) loadFinances();
                    if (selectedHistoryLabour) handleViewHistory(selectedHistoryLabour);
                } catch (err) {
                    toast.error(err.message || 'Failed to delete advance');
                }
            }
        });
    };

    const handleOpenPayout = (row) => {
        const isExisting = Boolean(row.payout);
        setPayoutForm({
            payout_id: isExisting ? row.payout.payout_id : null,
            labour_id: row.labour_id || row.labourId,
            site_id: selectedSite ? selectedSite.site_id.toString() : 'All',
            name: row.name,
            month: financeMonth,
            wage_type: row.wage_type || 'Daily Wage',
            monthly_salary: row.monthly_salary || 0,
            present_days: row.attendance?.present || row.present_days || 0,
            half_days: row.attendance?.half_day || row.half_days || 0,
            absent_days: row.attendance?.absent || row.absent_days || 0,
            paid_leaves: row.attendance?.paid_leave || row.paid_leaves || 0,
            accrued_credit: row.accrued_credit || 0,
            advances_taken: row.advances_taken || row.total_advance || 0,
            net_payable: row.net_payable || 0,
            paid_amount: isExisting ? row.payout.paid_amount : Math.max(0, row.net_payable || 0),
            status: isExisting ? row.payout.status : 'Paid',
            payment_date: isExisting ? row.payout.payment_date?.split('T')[0] : new Date().toISOString().split('T')[0],
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
            toast.success(`Payout processed for ${payoutForm.name}`);
            setShowPayoutModal(false);
            if (selectedSite) loadFinances();
            if (selectedHistoryLabour) handleViewHistory(selectedHistoryLabour);
        } catch (err) {
            toast.error(err.message || 'Failed to log payout');
        }
    };

    const handleViewHistory = async (lab) => {
        setSelectedHistoryLabour(lab);
        setHistoryTab('sites');
        setHistoryLoading(true);
        try {
            const res = await labourService.getLabourWorkHistory(lab.labour_id || lab.labourId);
            setLabourHistoryData(res.history || []);
            setLabourPayoutHistory(res.payouts || []);
            setSelectedHistoryLabourDetails(res.labour || null);
        } catch (err) {
            toast.error(err.message || 'Failed to load work history');
        } finally {
            setHistoryLoading(false);
        }
    };

    // ------------------------------------------------------------------------
    // SITE MANAGEMENT HANDLERS
    // ------------------------------------------------------------------------
    const handleSaveSite = async (e) => {
        e.preventDefault();
        try {
            if (editingSite) {
                await labourService.updateSite(editingSite.site_id, siteForm);
                toast.success('Site updated successfully');
            } else {
                await labourService.createSite(siteForm);
                toast.success('Site created successfully');
            }
            setShowSiteModal(false);
            setEditingSite(null);
            setSiteForm({ site_name: '', location_details: '', status: 'Active' });
            loadInitialData();
        } catch (err) {
            toast.error(err.message || 'Failed to save site');
        }
    };

    const handleConfirmDeleteSite = (siteId) => {
        const site = sites.find(s => s.site_id === siteId);
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Construction Site',
            message: `Are you sure you want to delete '${site?.site_name || 'this site'}'? This will permanently remove its site allocations.`,
            confirmText: 'Delete Site',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await labourService.deleteSite(siteId);
                    toast.success('Site deleted successfully');
                    if (selectedSite?.site_id === siteId) setSelectedSite(null);
                    loadInitialData();
                } catch (err) {
                    toast.error(err.message || 'Failed to delete site');
                }
            }
        });
    };

    // ------------------------------------------------------------------------
    // WORKER DIRECTORY HANDLERS
    // ------------------------------------------------------------------------
    const handleSaveLabour = async (e) => {
        e.preventDefault();
        try {
            const cleanPhone = labourForm.phone ? labourForm.phone.trim().replace(/[\s\-()]/g, '') : '';
            if (cleanPhone) {
                const phoneRegex = /^(?:\+91|91)?[6-9]\d{9}$/;
                if (!phoneRegex.test(cleanPhone)) {
                    toast.error('Please enter a valid 10-digit contact number');
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
                await labourService.updateLabour(editingLabour.labour_id || editingLabour.labourId, payload);
                toast.success('Worker profile updated');
            } else {
                await labourService.createLabour(payload);
                toast.success('Worker registered successfully');
            }
            setShowLabourModal(false);
            setEditingLabour(null);
            setLabourForm({
                name: '', phone: '', sex: 'Male', role: '',
                wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '',
                overtime_pay_per_hour: '0', status: 'Active'
            });
            loadInitialData();
            if (selectedSite) loadAttendanceRoster();
        } catch (err) {
            toast.error(err.message || 'Failed to save worker');
        }
    };

    const handleConfirmDeleteLabour = (labourId) => {
        const worker = labours.find(w => (w.labour_id || w.labourId) === labourId);
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Worker Profile',
            message: `Are you sure you want to delete '${worker?.name || 'this worker'}'? This action cannot be undone.`,
            confirmText: 'Delete Worker',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await labourService.deleteLabour(labourId);
                    toast.success('Worker deleted successfully');
                    loadInitialData();
                    if (selectedSite) loadAttendanceRoster();
                } catch (err) {
                    toast.error(err.message || 'Failed to delete worker');
                }
            }
        });
    };

    // ------------------------------------------------------------------------
    // BORROW WORKER HANDLER
    // ------------------------------------------------------------------------
    const handleBorrowLabour = (lab) => {
        setAttendanceRoster(prev => [
            ...prev,
            {
                labour_id: lab.labour_id || lab.labourId,
                name: lab.name,
                role: lab.role,
                wage_type: lab.wage_type || 'Daily Wage',
                overtime_pay_per_hour: Number(lab.overtime_pay_per_hour || 0),
                status: 'Present',
                overtime_hours: 0,
                is_borrowed: true
            }
        ]);
        setHasUnsavedChanges(true);
        setShowBorrowModal(false);
        setBorrowSearchQuery('');
        toast.info(`Added ${lab.name} to roster. Click 'Save Roster' to confirm.`);
    };

    // ------------------------------------------------------------------------
    // BULK TRANSFER HANDLER
    // ------------------------------------------------------------------------
    const handleExecuteBulkTransfer = async (e) => {
        e.preventDefault();
        if (selectedTransferLabourIds.length === 0) {
            toast.warn('Select at least one worker to transfer');
            return;
        }
        try {
            await labourService.bulkTransferLabours({
                source_site_id: bulkSourceSiteId === 'All' ? null : Number(bulkSourceSiteId),
                destination_site_id: bulkDestinationSiteId === 'Unassigned' || !bulkDestinationSiteId ? null : Number(bulkDestinationSiteId),
                labour_ids: selectedTransferLabourIds
            });
            toast.success(`Transferred ${selectedTransferLabourIds.length} worker(s) successfully!`);
            setShowBulkTransferModal(false);
            setSelectedTransferLabourIds([]);
            await loadInitialData();
            if (selectedSite) loadAttendanceRoster();
        } catch (err) {
            toast.error(err.message || 'Failed to transfer workers');
        }
    };

    // ------------------------------------------------------------------------
    // DAILY SCHEDULE PLANNER HANDLER
    // ------------------------------------------------------------------------
    const handleOpenScheduleModal = async (labour) => {
        setSelectedScheduleLabour(labour);
        const todayStr = new Date().toISOString().split('T')[0];
        setScheduleDate(todayStr);
        setShowScheduleModal(true);
        setScheduleLoading(true);
        try {
            const res = await labourService.getLabourSchedule(labour.labour_id || labour.labourId, todayStr);
            setScheduleSites(res.site_ids || []);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch schedule');
            setScheduleSites([]);
        } finally {
            setScheduleLoading(false);
        }
    };

    const handleSaveSchedule = async () => {
        if (!selectedScheduleLabour) return;
        try {
            await labourService.saveLabourSchedule({
                labour_id: selectedScheduleLabour.labour_id || selectedScheduleLabour.labourId,
                date: scheduleDate,
                site_ids: scheduleSites
            });
            toast.success(`Schedule updated for ${selectedScheduleLabour.name}`);
            setShowScheduleModal(false);
            loadInitialData();
        } catch (err) {
            toast.error(err.message || 'Failed to save daily schedule');
        }
    };

    // ------------------------------------------------------------------------
    // BULK UPLOAD EXCEL HANDLERS
    // ------------------------------------------------------------------------
    const handleCSVUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        setIsUploadingBulk(true);
        try {
            const parsed = await labourService.parseBulkLabours(formData);
            if (!parsed || parsed.length === 0) {
                toast.error('The uploaded file appears to be empty or invalid.');
                return;
            }
            setParsedLabours(parsed);
        } catch (err) {
            toast.error(err.message || 'Failed to parse file. Please verify columns.');
        } finally {
            setIsUploadingBulk(false);
        }
    };

    const handleSaveBulkLabours = async () => {
        const valid = parsedLabours.filter(l => l.isValid);
        if (valid.length === 0) {
            toast.warn('No valid labour rows to import.');
            return;
        }
        setIsUploadingBulk(true);
        try {
            await labourService.bulkCreateLabours(valid);
            toast.success(`Successfully imported ${valid.length} worker(s)!`);
            setShowBulkLabourModal(false);
            setParsedLabours([]);
            loadInitialData();
        } catch (err) {
            toast.error(err.message || 'Failed to bulk import workers');
        } finally {
            setIsUploadingBulk(false);
        }
    };

    const downloadCSVTemplate = async () => {
        try {
            const data = await labourService.downloadBulkTemplate();
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'labour_bulk_upload_template.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(err.message || 'Failed to download template');
        }
    };

    // ------------------------------------------------------------------------
    // RENDER: PRIMARY TAB BAR (SITES OVERVIEW VS WORKER DIRECTORY)
    // ------------------------------------------------------------------------
    return (
        <MobileDashboardLayout title="Labour Management">
            <div className="space-y-3.5 pb-24 text-xs font-sans">
                {/* Top Tab Bar: Only displayed when not drilled down into a specific site */}
                {selectedSite === null && (
                    <div className="bg-slate-200/80 dark:bg-[#161B22] p-1 flex rounded-xl border border-slate-300 dark:border-[#30363D] sticky top-16 z-20 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setActiveTab('sites')}
                            className={`flex-1 py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeTab === 'sites'
                                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Building2 size={14} />
                            <span>Sites Overview</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                activeTab === 'sites' ? 'bg-white/20 text-white' : 'bg-slate-300 dark:bg-[#30363D] text-slate-700 dark:text-slate-300'
                            }`}>
                                {sites.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('directory')}
                            className={`flex-1 py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeTab === 'directory'
                                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Users size={14} />
                            <span>Worker Directory</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                activeTab === 'directory' ? 'bg-white/20 text-white' : 'bg-slate-300 dark:bg-[#30363D] text-slate-700 dark:text-slate-300'
                            }`}>
                                {labours.length}
                            </span>
                        </button>
                    </div>
                )}

                {/* Main Body Content */}
                {loading ? (
                    <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-2xl p-8 shadow-2xs my-4">
                        <LoadingScreen message="Loading workforce data..." fullScreen={false} />
                    </div>
                ) : (
                    <>
                        {/* ====================================================
                            TAB 1: SITES OVERVIEW OR DRILL-DOWN DASHBOARD
                            ==================================================== */}
                        {activeTab === 'sites' && (
                            selectedSite === null ? (
                                /* SITES OVERVIEW (NO SITE SELECTED) */
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    {/* 4 KPI Stat Cards (2x2 Grid) */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <LabourStatCard
                                            title="Active Sites"
                                            value={sites.filter(s => s.status === 'Active').length}
                                            icon={HardHat}
                                            iconColor="#10B981"
                                            subtitle="Ongoing operations"
                                        />
                                        <LabourStatCard
                                            title="Completed"
                                            value={sites.filter(s => s.status === 'Completed').length}
                                            icon={CheckCircle2}
                                            iconColor="#3B82F6"
                                            subtitle="Past projects"
                                        />
                                        <LabourStatCard
                                            title="Registered Labours"
                                            value={labours.length}
                                            icon={Users}
                                            iconColor="#6366F1"
                                            subtitle="Active workforce"
                                        />
                                        <LabourStatCard
                                            title="Total Sites"
                                            value={sites.length}
                                            icon={Building}
                                            iconColor="#F59E0B"
                                            subtitle="All contracts"
                                        />
                                    </div>

                                    {/* Search & Add Site Action Row */}
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                value={siteSearch}
                                                onChange={(e) => setSiteSearch(e.target.value)}
                                                placeholder="Search site or location..."
                                                className="w-full pl-8 pr-7 py-2 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-xl text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                                            />
                                            {siteSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSiteSearch('')}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                >
                                                    <X size={13} />
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingSite(null);
                                                setSiteForm({ site_name: '', location_details: '', status: 'Active' });
                                                setShowSiteModal(true);
                                            }}
                                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-1.5 text-xs shadow-xs shrink-0 cursor-pointer transition-all active:scale-95"
                                        >
                                            <Plus size={14} strokeWidth={2.5} />
                                            <span>Add Site</span>
                                        </button>
                                    </div>

                                    {/* Status Filter Chips */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                        {['All', 'Active', 'Completed', 'On Hold'].map(st => {
                                            const isSelected = siteStatusFilter === st;
                                            let count = sites.length;
                                            if (st === 'Active') count = sites.filter(s => s.status === 'Active').length;
                                            else if (st === 'Completed') count = sites.filter(s => s.status === 'Completed').length;
                                            else if (st === 'On Hold') count = sites.filter(s => s.status === 'On Hold' || s.status === 'Inactive').length;

                                            return (
                                                <button
                                                    key={st}
                                                    type="button"
                                                    onClick={() => setSiteStatusFilter(st)}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                                                            : 'bg-white dark:bg-[#161B22] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#30363D] hover:bg-slate-50 dark:hover:bg-[#21262D]'
                                                    }`}
                                                >
                                                    <span>{st}</span>
                                                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-[#30363D] text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Filtered Sites List */}
                                    <div className="space-y-2">
                                        {(() => {
                                            const filteredSites = sites.filter(s => {
                                                if (siteStatusFilter === 'Active' && s.status !== 'Active') return false;
                                                if (siteStatusFilter === 'Completed' && s.status !== 'Completed') return false;
                                                if (siteStatusFilter === 'On Hold' && s.status !== 'On Hold' && s.status !== 'Inactive') return false;
                                                if (siteSearch.trim()) {
                                                    const q = siteSearch.toLowerCase();
                                                    const matchName = s.site_name?.toLowerCase().includes(q);
                                                    const matchLoc = s.location_details?.toLowerCase().includes(q);
                                                    if (!matchName && !matchLoc) return false;
                                                }
                                                return true;
                                            });

                                            if (filteredSites.length === 0) {
                                                return (
                                                    <div className="p-8 border border-dashed border-slate-200 dark:border-[#30363D] rounded-2xl text-center bg-white dark:bg-[#161B22] space-y-2">
                                                        <Building className="mx-auto text-slate-300 dark:text-slate-600" size={32} />
                                                        <p className="text-slate-500 dark:text-slate-400 font-medium">No construction sites found.</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingSite(null);
                                                                setSiteForm({ site_name: '', location_details: '', status: 'Active' });
                                                                setShowSiteModal(true);
                                                            }}
                                                            className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:underline"
                                                        >
                                                            + Create Construction Site
                                                        </button>
                                                    </div>
                                                );
                                            }

                                            return filteredSites.map(site => {
                                                const assignedCount = labours.filter(l => l.site_id === site.site_id || (l.site_ids && l.site_ids.includes(site.site_id))).length;
                                                return (
                                                    <div
                                                        key={site.site_id}
                                                        onClick={() => handleSelectSite(site)}
                                                        className="p-3.5 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] shadow-2xs hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer flex flex-col gap-2.5"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/40">
                                                                    <Building size={16} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <h4 className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                                                        {site.site_name}
                                                                    </h4>
                                                                    {site.location_details && (
                                                                        <p className="text-[10px] text-slate-500 dark:text-[#8B949E] truncate">
                                                                            {site.location_details}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <SiteStatusBadge status={site.status} />
                                                        </div>

                                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#30363D]/60 text-xs">
                                                            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px]">
                                                                <Users size={13} />
                                                                <span>{assignedCount} Worker{assignedCount === 1 ? '' : 's'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingSite(site);
                                                                        setSiteForm({
                                                                            site_name: site.site_name,
                                                                            location_details: site.location_details || '',
                                                                            status: site.status
                                                                        });
                                                                        setShowSiteModal(true);
                                                                    }}
                                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363D] transition-colors"
                                                                    title="Edit Site"
                                                                >
                                                                    <Edit2 size={13} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleConfirmDeleteSite(site.site_id)}
                                                                    className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                                                    title="Delete Site"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectSite(site)}
                                                                    className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                                                                    title="Open Dashboard"
                                                                >
                                                                    <ChevronRight size={15} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                /* ====================================================
                                   SITE DRILL-DOWN DASHBOARD (WITH 3 SUB-TABS)
                                   ==================================================== */
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    {/* Unified Site Header */}
                                    <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] p-3 rounded-2xl shadow-2xs space-y-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <button
                                                type="button"
                                                onClick={handleBackToSites}
                                                className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold text-xs py-0.5 px-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
                                            >
                                                <ChevronLeft size={16} />
                                                <span>Sites</span>
                                            </button>
                                            <div className="min-w-0 flex-1 truncate text-center">
                                                <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                    {selectedSite.site_name}
                                                </h3>
                                            </div>
                                            <SiteStatusBadge status={selectedSite.status} />
                                        </div>

                                        {/* Sleek Sub-Tab Switcher (Attendance, Monthly Grid, Finances) */}
                                        <div className="bg-slate-100 dark:bg-[#0D1117] p-1 rounded-xl flex border border-slate-200/80 dark:border-[#30363D]">
                                            {[
                                                { id: 'attendance', label: 'Attendance', icon: CheckSquare },
                                                { id: 'grid', label: 'Monthly Grid', icon: Calendar },
                                                { id: 'finances', label: 'Finances', icon: Wallet }
                                            ].map(tab => {
                                                const Icon = tab.icon;
                                                const isSelected = subTab === tab.id;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        type="button"
                                                        onClick={() => setSubTab(tab.id)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                        }`}
                                                    >
                                                        <Icon size={13} />
                                                        <span>{tab.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ------------------------------------------------
                                        SUB-TAB 1: DAILY ATTENDANCE
                                        ------------------------------------------------ */}
                                    {subTab === 'attendance' && (
                                        <div className="space-y-3 animate-in fade-in duration-150">
                                            {/* Completed Site Restriction Banner */}
                                            {selectedSite.status === 'Completed' && selectedSite.end_date && (
                                                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl flex items-start gap-2 text-[10px] text-amber-800 dark:text-amber-300">
                                                    <AlertTriangle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                                                    <span>
                                                        This site completed on <strong>{formatPlatformDate(selectedSite.end_date)}</strong>. Attendance is restricted to dates strictly before completion.
                                                    </span>
                                                </div>
                                            )}

                                            {/* 1. Date Navigation & Quick Actions Bar */}
                                            <div className="p-2.5 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] shadow-2xs flex items-center justify-between gap-1.5">
                                                {/* Prev Day */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date(attendanceDate);
                                                        d.setDate(d.getDate() - 1);
                                                        setAttendanceDate(d.toISOString().split('T')[0]);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#21262D] transition-colors"
                                                    title="Previous Day"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>

                                                {/* Date Selector Display */}
                                                <div className="flex-1 min-w-0">
                                                    <MobileDatePicker
                                                        value={attendanceDate}
                                                        onChange={(val) => setAttendanceDate(val)}
                                                    />
                                                </div>

                                                {/* Next Day */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date(attendanceDate);
                                                        d.setDate(d.getDate() + 1);
                                                        setAttendanceDate(d.toISOString().split('T')[0]);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#21262D] transition-colors"
                                                    title="Next Day"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>

                                                {/* Toggle Search/Filter */}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAttendanceSearch(prev => !prev)}
                                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                        showAttendanceSearch || attendanceSearch || attendanceRoleFilter !== 'All'
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50'
                                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#21262D]'
                                                    }`}
                                                    title="Search & Role Filter"
                                                >
                                                    <Search size={16} />
                                                </button>

                                                {/* Quick Borrow Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBorrowModal(true)}
                                                    className="px-2 py-1 rounded-lg border border-emerald-500/60 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer hover:bg-emerald-100/50 transition-colors"
                                                >
                                                    <UserPlus size={12} />
                                                    <span>+ Borrow</span>
                                                </button>
                                            </div>

                                            {/* 2. Expandable Search & Role Filter Bar */}
                                            {(showAttendanceSearch || attendanceSearch || attendanceRoleFilter !== 'All') && (
                                                <div className="p-2.5 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] shadow-2xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                                    <div className="relative flex-1">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                                        <input
                                                            type="text"
                                                            value={attendanceSearch}
                                                            onChange={(e) => setAttendanceSearch(e.target.value)}
                                                            placeholder="Search workers..."
                                                            className="w-full pl-7 pr-6 py-1.5 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-[11px] text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none"
                                                        />
                                                        {attendanceSearch && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setAttendanceSearch('')}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="w-32">
                                                        <MinimalSelect
                                                            options={[
                                                                { value: 'All', label: 'All Roles' },
                                                                ...Array.from(new Set(attendanceRoster.map(r => r.role).filter(Boolean))).map(r => ({ value: r, label: r }))
                                                            ]}
                                                            value={attendanceRoleFilter}
                                                            onChange={(val) => setAttendanceRoleFilter(val)}
                                                            variant="input"
                                                            size="sm"
                                                            triggerClassName="w-full justify-between py-1 px-2 rounded-lg text-[10px] font-medium"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* 3. Interactive Status Filter Pills */}
                                            {(() => {
                                                const totalCount = attendanceRoster.length;
                                                const presentCount = attendanceRoster.filter(r => r.status === 'Present').length;
                                                const halfCount = attendanceRoster.filter(r => r.status === 'Half Day').length;
                                                const absentCount = attendanceRoster.filter(r => r.status === 'Absent').length;
                                                const plCount = attendanceRoster.filter(r => r.status === 'Paid Leave').length;
                                                const unmarkedCount = attendanceRoster.filter(r => !r.status).length;

                                                const pills = [
                                                    { id: 'All', label: 'All', count: totalCount, color: '#6366F1' },
                                                    { id: 'Present', label: 'Present', count: presentCount, color: '#10B981' },
                                                    { id: 'Half Day', label: 'Half Day', count: halfCount, color: '#F59E0B' },
                                                    { id: 'Absent', label: 'Absent', count: absentCount, color: '#EF4444' }
                                                ];
                                                if (plCount > 0) pills.push({ id: 'Paid Leave', label: 'Leave', count: plCount, color: '#3B82F6' });
                                                if (unmarkedCount > 0) pills.push({ id: 'Unmarked', label: 'Unmarked', count: unmarkedCount, color: '#8B5CF6' });

                                                return (
                                                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                                        {pills.map(p => {
                                                            const isSelected = attendanceStatusFilter === p.id;
                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => setAttendanceStatusFilter(p.id)}
                                                                    className={`px-2.5 py-1 rounded-full text-[10.5px] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                                                        isSelected
                                                                            ? 'text-white font-semibold shadow-2xs'
                                                                            : 'bg-white dark:bg-[#161B22] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#30363D]'
                                                                    }`}
                                                                    style={isSelected ? { backgroundColor: p.color } : {}}
                                                                >
                                                                    <span
                                                                        className="w-1.5 h-1.5 rounded-full"
                                                                        style={{ backgroundColor: isSelected ? '#FFFFFF' : p.color }}
                                                                    />
                                                                    <span>{p.label}</span>
                                                                    <span
                                                                        className="px-1.5 py-0.2 rounded-full text-[9px] font-bold"
                                                                        style={{
                                                                            backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : `${p.color}1f`,
                                                                            color: isSelected ? '#FFFFFF' : p.color
                                                                        }}
                                                                    >
                                                                        {p.count}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}

                                            {/* 4. Quick Fill Bar (0 Selected) OR Batch Action Bar (>= 1 Selected) */}
                                            {(() => {
                                                const filteredRoster = attendanceRoster.filter(r => {
                                                    if (attendanceRoleFilter !== 'All' && r.role !== attendanceRoleFilter) return false;
                                                    if (attendanceStatusFilter === 'Present' && r.status !== 'Present') return false;
                                                    if (attendanceStatusFilter === 'Half Day' && r.status !== 'Half Day') return false;
                                                    if (attendanceStatusFilter === 'Absent' && r.status !== 'Absent') return false;
                                                    if (attendanceStatusFilter === 'Paid Leave' && r.status !== 'Paid Leave') return false;
                                                    if (attendanceStatusFilter === 'Unmarked' && r.status) return false;
                                                    if (attendanceSearch.trim()) {
                                                        const q = attendanceSearch.toLowerCase();
                                                        if (!r.name?.toLowerCase().includes(q) && !r.role?.toLowerCase().includes(q)) return false;
                                                    }
                                                    return true;
                                                });

                                                const hasSelection = selectedRosterIds.size > 0;
                                                const allVisibleSelected = filteredRoster.length > 0 && filteredRoster.every(r => selectedRosterIds.has(r.labour_id || r.labourId));
                                                const unmarkedCount = filteredRoster.filter(r => !r.status).length;

                                                return (
                                                    <div className={`p-2 rounded-xl border transition-all ${
                                                        hasSelection
                                                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40'
                                                            : 'bg-white dark:bg-[#161B22] border-slate-200 dark:border-[#30363D]'
                                                    }`}>
                                                        {hasSelection ? (
                                                            /* BATCH ACTIONS (N SELECTED) */
                                                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                                                <span className="px-2 py-1 rounded-md bg-indigo-600 text-white font-bold text-[10px] flex items-center gap-1 shrink-0">
                                                                    <Check size={11} strokeWidth={3} />
                                                                    <span>{selectedRosterIds.size} Selected</span>
                                                                </span>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => batchSetStatus('Present')}
                                                                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] shrink-0 transition-colors"
                                                                >
                                                                    Set Present
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => batchSetStatus('Half Day')}
                                                                    className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] shrink-0 transition-colors"
                                                                >
                                                                    Set Half Day
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => batchSetStatus('Absent')}
                                                                    className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10px] shrink-0 transition-colors"
                                                                >
                                                                    Set Absent
                                                                </button>

                                                                {/* Batch OT Stepper */}
                                                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] shrink-0">
                                                                    <span className="text-[9.5px] font-medium text-slate-500 dark:text-slate-400">OT:</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => batchAdjustOvertime(-0.5)}
                                                                        className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-[#21262D] text-slate-700 dark:text-white font-bold text-xs"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => batchAdjustOvertime(+0.5)}
                                                                        className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-[#21262D] text-slate-700 dark:text-white font-bold text-xs"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedRosterIds(new Set())}
                                                                    className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-[10px] font-medium shrink-0 ml-auto px-1"
                                                                >
                                                                    Deselect All
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            /* QUICK FILL BAR (0 SELECTED) */
                                                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[10px]">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleSelectAllVisible(filteredRoster)}
                                                                    className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-semibold shrink-0 px-1 hover:text-indigo-600"
                                                                >
                                                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                                                                        allVisibleSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'
                                                                    }`}>
                                                                        {allVisibleSelected && <Check size={10} strokeWidth={3} />}
                                                                    </div>
                                                                    <span>Select All</span>
                                                                </button>

                                                                <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
                                                                <span className="text-slate-400 font-medium text-[9.5px] shrink-0">Quick Fill:</span>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => markAllVisible(filteredRoster, 'Present')}
                                                                    className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 font-semibold shrink-0 hover:bg-emerald-100 transition-colors"
                                                                >
                                                                    All Present
                                                                </button>

                                                                {unmarkedCount > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => markUnmarkedVisible(filteredRoster, 'Present')}
                                                                        className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 font-semibold shrink-0 hover:bg-indigo-100 transition-colors"
                                                                    >
                                                                        Unmarked ({unmarkedCount})
                                                                    </button>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    onClick={() => markAllVisible(filteredRoster, 'Absent')}
                                                                    className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 font-semibold shrink-0 hover:bg-rose-100 transition-colors"
                                                                >
                                                                    All Absent
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => resetAllVisible(filteredRoster)}
                                                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5 shrink-0 px-1 font-medium"
                                                                >
                                                                    <Undo2 size={11} />
                                                                    <span>Reset</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* 5. Attendance Roster Items List */}
                                            {attendanceLoading ? (
                                                <div className="py-8 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D]">
                                                    <LoadingScreen size="sm" message="Loading attendance roster..." fullScreen={false} />
                                                </div>
                                            ) : attendanceRoster.length === 0 ? (
                                                <div className="p-8 text-center bg-white dark:bg-[#161B22] rounded-xl border border-dashed border-slate-200 dark:border-[#30363D] space-y-2">
                                                    <Users className="mx-auto text-slate-300 dark:text-slate-600" size={30} />
                                                    <p className="text-slate-500 dark:text-slate-400">No workers assigned to this site.</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowBorrowModal(true)}
                                                        className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:underline"
                                                    >
                                                        + Add or Borrow Worker to Roster
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2.5">
                                                    {attendanceRoster
                                                        .filter(r => {
                                                            if (attendanceRoleFilter !== 'All' && r.role !== attendanceRoleFilter) return false;
                                                            if (attendanceStatusFilter === 'Present' && r.status !== 'Present') return false;
                                                            if (attendanceStatusFilter === 'Half Day' && r.status !== 'Half Day') return false;
                                                            if (attendanceStatusFilter === 'Absent' && r.status !== 'Absent') return false;
                                                            if (attendanceStatusFilter === 'Paid Leave' && r.status !== 'Paid Leave') return false;
                                                            if (attendanceStatusFilter === 'Unmarked' && r.status) return false;
                                                            if (attendanceSearch.trim()) {
                                                                const q = attendanceSearch.toLowerCase();
                                                                if (!r.name?.toLowerCase().includes(q) && !r.role?.toLowerCase().includes(q)) return false;
                                                            }
                                                            return true;
                                                        })
                                                        .map(item => {
                                                            const labourId = item.labour_id || item.labourId;
                                                            const isChecked = selectedRosterIds.has(labourId);
                                                            const isFixedSalary = (item.wage_type || item.wageType || '').toLowerCase().includes('fixed');
                                                            const isPresent = item.status === 'Present';

                                                            return (
                                                                <div
                                                                    key={labourId}
                                                                    className={`p-3 rounded-xl border transition-all ${
                                                                        isChecked
                                                                            ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-700/60 shadow-xs'
                                                                            : 'bg-white dark:bg-[#161B22] border-slate-200 dark:border-[#30363D] shadow-2xs'
                                                                    }`}
                                                                >
                                                                    {/* Row 1: Checkbox + Worker Info + Badges */}
                                                                    <div className="flex items-start gap-2.5">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={() => toggleSelectRosterItem(labourId)}
                                                                            className="mt-0.5 rounded text-indigo-600 cursor-pointer"
                                                                        />
                                                                        <div className="min-w-0 flex-1 space-y-1">
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                                                    {item.name}
                                                                                </h4>
                                                                                {item.is_borrowed && (
                                                                                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 uppercase">
                                                                                        Added
                                                                                    </span>
                                                                                )}
                                                                                {!item.status && (
                                                                                    <span className="px-1.5 py-0.2 rounded text-[8px] font-medium bg-slate-100 dark:bg-[#21262D] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#30363D]">
                                                                                        Unmarked
                                                                                    </span>
                                                                                )}
                                                                                {item.is_scheduled_multi_site && (
                                                                                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40 uppercase">
                                                                                        Multi-Site
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            <div className="flex items-center gap-2 text-[9.5px] text-slate-500 dark:text-[#8B949E] flex-wrap">
                                                                                <SkillBadge skill={item.role} />
                                                                                <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-semibold ${
                                                                                    isFixedSalary
                                                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                                                                                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                                                }`}>
                                                                                    {isFixedSalary ? 'Fixed Salary' : 'Daily Wage'}
                                                                                </span>
                                                                                <span>OT: ₹{Number(item.overtime_pay_per_hour || item.overtimePayPerHour || 0)}/h</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Warning Banner if Already Marked */}
                                                                    {item.already_marked_at && (
                                                                        <div className="mt-2 p-1.5 px-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-lg flex items-center gap-1.5 text-[9.5px] text-amber-800 dark:text-amber-300 font-medium">
                                                                            <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                                                                            <span className="truncate">Marked {item.already_marked_at.status} at {item.already_marked_at.site_name}</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Row 2: Tactile Status Buttons */}
                                                                    <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                                                                        {[
                                                                            { id: 'Present', label: 'Present', color: 'bg-emerald-600 text-white shadow-xs', inactive: 'bg-slate-50 dark:bg-[#0D1117] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#30363D]' },
                                                                            { id: 'Half Day', label: 'Half Day', color: 'bg-amber-500 text-white shadow-xs', inactive: 'bg-slate-50 dark:bg-[#0D1117] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#30363D]' },
                                                                            { id: 'Absent', label: 'Absent', color: 'bg-rose-600 text-white shadow-xs', inactive: 'bg-slate-50 dark:bg-[#0D1117] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#30363D]' }
                                                                        ].map(btn => {
                                                                            const isSelected = item.status === btn.id;
                                                                            return (
                                                                                <button
                                                                                    key={btn.id}
                                                                                    type="button"
                                                                                    onClick={() => setItemStatus(labourId, btn.id)}
                                                                                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer text-center ${
                                                                                        isSelected ? btn.color : btn.inactive
                                                                                    }`}
                                                                                >
                                                                                    {btn.label}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>

                                                                    {/* Row 3: Overtime Stepper (Visible when Present) */}
                                                                    {isPresent && (
                                                                        <div className="mt-2.5 p-2 bg-slate-50 dark:bg-[#0D1117] rounded-xl border border-slate-200 dark:border-[#30363D] flex items-center justify-between text-xs animate-in fade-in duration-150">
                                                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold text-[11px]">
                                                                                <Clock size={13} className="text-indigo-600 dark:text-indigo-400" />
                                                                                <span>Overtime:</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setItemOvertime(labourId, Math.max(0, Number(item.overtime_hours || 0) - 0.5))}
                                                                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-white dark:bg-[#21262D] border border-slate-200 dark:border-[#30363D] text-slate-800 dark:text-white font-bold cursor-pointer active:scale-90"
                                                                                >
                                                                                    -
                                                                                </button>
                                                                                <span className="w-10 text-center font-mono font-bold text-slate-900 dark:text-white text-xs">
                                                                                    {Number(item.overtime_hours || 0).toFixed(1)}h
                                                                                </span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setItemOvertime(labourId, Math.min(12, Number(item.overtime_hours || 0) + 0.5))}
                                                                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-white dark:bg-[#21262D] border border-slate-200 dark:border-[#30363D] text-slate-800 dark:text-white font-bold cursor-pointer active:scale-90"
                                                                                >
                                                                                    +
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setItemOvertime(labourId, Math.min(12, Number(item.overtime_hours || 0) + 1))}
                                                                                    className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50"
                                                                                >
                                                                                    +1h
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}

                                            {/* 6. Bottom Sticky Progress & Save Bar */}
                                            {attendanceRoster.length > 0 && (
                                                <div className="sticky bottom-2 z-20 p-2.5 bg-white/95 dark:bg-[#161B22]/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-[#30363D] shadow-lg flex items-center justify-between gap-3">
                                                    {(() => {
                                                        const total = attendanceRoster.length;
                                                        const marked = attendanceRoster.filter(r => r.status).length;
                                                        const isDone = marked === total && total > 0;
                                                        return (
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                                                    isDone ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-500'
                                                                }`}>
                                                                    {isDone ? <CheckCircle size={15} /> : <Clock size={15} />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                                        {marked} / {total} Marked
                                                                    </p>
                                                                    <p className={`text-[9.5px] font-medium truncate ${
                                                                        isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                                                                    }`}>
                                                                        {isDone ? 'Ready to save' : `${total - marked} remaining`}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    <button
                                                        type="button"
                                                        onClick={handleSaveAttendance}
                                                        disabled={savingRoster}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                                                    >
                                                        {savingRoster ? (
                                                            <>
                                                                <Loader2 size={14} className="animate-spin" />
                                                                <span>Saving...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Save size={14} />
                                                                <span>Save Roster</span>
                                                                {hasUnsavedChanges && (
                                                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                                                )}
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ------------------------------------------------
                                        SUB-TAB 2: MONTHLY ATTENDANCE GRID
                                        ------------------------------------------------ */}
                                    {subTab === 'grid' && (
                                        <div className="space-y-3 animate-in fade-in duration-150">
                                            {/* Top Month Selector, View Toggle, Export Excel */}
                                            <div className="p-2.5 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] shadow-2xs flex items-center justify-between gap-1.5">
                                                {/* Prev Month */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const [y, m] = gridMonth.split('-').map(Number);
                                                        const d = new Date(y, m - 2, 1);
                                                        setGridMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#21262D]"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <MonthPicker
                                                        value={gridMonth}
                                                        onChange={(val) => setGridMonth(val)}
                                                        compact={true}
                                                    />
                                                </div>

                                                {/* Next Month */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const [y, m] = gridMonth.split('-').map(Number);
                                                        const d = new Date(y, m, 1);
                                                        setGridMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#21262D]"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>

                                                {/* View Mode Toggle Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setIsGridTableMode(prev => !prev)}
                                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-[#30363D] bg-slate-50 dark:bg-[#0D1117] text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#21262D] transition-colors"
                                                    title={isGridTableMode ? "Switch to Cards View" : "Switch to Spreadsheet View"}
                                                >
                                                    {isGridTableMode ? <Layers size={15} /> : <FileSpreadsheet size={15} />}
                                                </button>

                                                {/* Export Excel */}
                                                <button
                                                    type="button"
                                                    onClick={exportMonthlyGridToExcel}
                                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] flex items-center gap-1 shrink-0 shadow-2xs transition-colors"
                                                >
                                                    <Download size={12} />
                                                    <span>Export</span>
                                                </button>
                                            </div>

                                            {/* Role Filter */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <MinimalSelect
                                                        options={[
                                                            { value: 'All', label: 'All Roles' },
                                                            ...Array.from(new Set(gridData.map(r => r.role).filter(Boolean))).map(r => ({ value: r, label: r }))
                                                        ]}
                                                        value={gridRoleFilter}
                                                        onChange={(val) => setGridRoleFilter(val)}
                                                        variant="input"
                                                        size="sm"
                                                        triggerClassName="w-full justify-between py-1.5 px-3 rounded-xl text-xs font-medium"
                                                    />
                                                </div>
                                            </div>

                                            {/* Grid View Content */}
                                            {gridLoading ? (
                                                <div className="py-8 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D]">
                                                    <LoadingScreen size="sm" message="Loading monthly grid..." fullScreen={false} />
                                                </div>
                                            ) : gridData.length === 0 ? (
                                                <div className="p-8 text-center bg-white dark:bg-[#161B22] rounded-xl border border-dashed border-slate-200 dark:border-[#30363D] space-y-2">
                                                    <Calendar className="mx-auto text-slate-300 dark:text-slate-600" size={30} />
                                                    <p className="text-slate-500 dark:text-slate-400">No attendance logged for {gridMonth}.</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {isGridTableMode ? (
                                                        /* FULL SPREADSHEET TABLE VIEW */
                                                        <div className="bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] overflow-x-auto shadow-2xs">
                                                            {(() => {
                                                                const [yr, mo] = gridMonth.split('-').map(Number);
                                                                const daysInMonth = new Date(yr, mo, 0).getDate();
                                                                const filteredGrid = gridData.filter(r => gridRoleFilter === 'All' || r.role === gridRoleFilter);

                                                                return (
                                                                    <table className="w-full border-collapse text-[10px] text-center">
                                                                        <thead>
                                                                            <tr className="bg-slate-50 dark:bg-[#0D1117] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-[#30363D]">
                                                                                <th className="p-2 text-left sticky left-0 bg-slate-50 dark:bg-[#0D1117] z-10 min-w-[100px]">Worker</th>
                                                                                <th className="p-2 min-w-[60px]">Role</th>
                                                                                {Array.from({ length: daysInMonth }, (_, i) => (
                                                                                    <th key={i} className="p-1 min-w-[24px] font-bold">{i + 1}</th>
                                                                                ))}
                                                                                <th className="p-2 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 font-bold">P</th>
                                                                                <th className="p-2 bg-amber-50/50 dark:bg-amber-950/20 text-amber-600 font-bold">HD</th>
                                                                                <th className="p-2 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 font-bold">A</th>
                                                                                <th className="p-2 bg-purple-50/50 dark:bg-purple-950/20 text-purple-600 font-bold">OT</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100 dark:divide-[#21262D]">
                                                                            {filteredGrid.map((row, idx) => (
                                                                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#21262D]/40">
                                                                                    <td className="p-2 text-left font-bold text-slate-800 dark:text-white sticky left-0 bg-white dark:bg-[#161B22] z-10 truncate max-w-[120px]">
                                                                                        {row.name}
                                                                                    </td>
                                                                                    <td className="p-2 truncate"><SkillBadge skill={row.role} /></td>
                                                                                    {Array.from({ length: daysInMonth }, (_, i) => {
                                                                                        const dayNum = i + 1;
                                                                                        let st = row.days ? row.days[String(dayNum)] || '' : '';
                                                                                        if (!st) {
                                                                                            const dt = new Date(yr, mo - 1, dayNum);
                                                                                            if (dt.getDay() === 0) st = 'WO';
                                                                                        }
                                                                                        return (
                                                                                            <td key={i} className="p-1 font-bold">
                                                                                                <span className={`inline-block w-5 h-5 leading-5 rounded text-[9px] ${
                                                                                                    st === 'P' || st === 'Present' ? 'bg-emerald-500/10 text-emerald-600' :
                                                                                                    st === 'HD' || st === 'Half Day' ? 'bg-amber-500/10 text-amber-600' :
                                                                                                    st === 'A' || st === 'Absent' ? 'bg-rose-500/10 text-rose-600' :
                                                                                                    st === 'PL' || st === 'Paid Leave' ? 'bg-blue-500/10 text-blue-600' :
                                                                                                    st === 'WO' ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' :
                                                                                                    'text-slate-300 dark:text-slate-600'
                                                                                                }`}>
                                                                                                    {st === 'Present' ? 'P' : st === 'Half Day' ? 'HD' : st === 'Absent' ? 'A' : st === 'Paid Leave' ? 'PL' : st || '-'}
                                                                                                </span>
                                                                                            </td>
                                                                                        );
                                                                                    })}
                                                                                    <td className="p-2 font-bold text-emerald-600">{row.total_present || row.totalPresent || 0}</td>
                                                                                    <td className="p-2 font-bold text-amber-600">{row.total_half_days || row.totalHalfDays || 0}</td>
                                                                                    <td className="p-2 font-bold text-rose-600">{row.total_absent || row.totalAbsent || 0}</td>
                                                                                    <td className="p-2 font-bold text-purple-600">{(row.total_overtime_hours || row.totalOvertimeHours || 0).toFixed(1)}h</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        /* MOBILE CARD VIEW WITH HORIZONTAL DAY STRIP */
                                                        <div className="space-y-2.5">
                                                            {(() => {
                                                                const [yr, mo] = gridMonth.split('-').map(Number);
                                                                const daysInMonth = new Date(yr, mo, 0).getDate();
                                                                const filteredGrid = gridData.filter(r => gridRoleFilter === 'All' || r.role === gridRoleFilter);

                                                                return filteredGrid.map((row, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="p-3 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] shadow-2xs space-y-2"
                                                                    >
                                                                        {/* Card Header: Name & Role */}
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                                                {row.name}
                                                                            </h4>
                                                                            <SkillBadge skill={row.role} />
                                                                        </div>

                                                                        {/* Mini KPI badges row */}
                                                                        <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-bold">
                                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                                                                                P: {row.total_present || row.totalPresent || 0}
                                                                            </span>
                                                                            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50">
                                                                                HD: {row.total_half_days || row.totalHalfDays || 0}
                                                                            </span>
                                                                            <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50">
                                                                                A: {row.total_absent || row.totalAbsent || 0}
                                                                            </span>
                                                                            {(row.total_paid_leaves || row.totalPaidLeaves || 0) > 0 && (
                                                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200/50">
                                                                                    PL: {row.total_paid_leaves || row.totalPaidLeaves || 0}
                                                                                </span>
                                                                            )}
                                                                            <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200/50 ml-auto">
                                                                                OT: {(row.total_overtime_hours || row.totalOvertimeHours || 0).toFixed(1)}h
                                                                            </span>
                                                                        </div>

                                                                        {/* Horizontal Day-by-Day Scrollable Strip */}
                                                                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
                                                                            {Array.from({ length: daysInMonth }, (_, d) => {
                                                                                const dayNum = d + 1;
                                                                                let st = row.days ? row.days[String(dayNum)] || '' : '';
                                                                                if (!st) {
                                                                                    const dt = new Date(yr, mo - 1, dayNum);
                                                                                    if (dt.getDay() === 0) st = 'WO';
                                                                                }

                                                                                let bg = 'bg-slate-50 dark:bg-[#0D1117] text-slate-400 border-slate-200 dark:border-[#30363D]';
                                                                                if (st === 'P' || st === 'Present') bg = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60 font-bold';
                                                                                else if (st === 'HD' || st === 'Half Day') bg = 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800/60 font-bold';
                                                                                else if (st === 'A' || st === 'Absent') bg = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800/60 font-bold';
                                                                                else if (st === 'PL' || st === 'Paid Leave') bg = 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800/60 font-bold';
                                                                                else if (st === 'WO') bg = 'bg-slate-100 dark:bg-[#21262D] text-slate-400 border-transparent';

                                                                                return (
                                                                                    <div
                                                                                        key={d}
                                                                                        className={`w-7 h-10 rounded-lg border flex flex-col items-center justify-center shrink-0 ${bg}`}
                                                                                    >
                                                                                        <span className="text-[7.5px] text-slate-400 font-medium">{dayNum}</span>
                                                                                        <span className="text-[9px]">
                                                                                            {st === 'Present' ? 'P' : st === 'Half Day' ? 'HD' : st === 'Absent' ? 'A' : st === 'Paid Leave' ? 'PL' : st || '-'}
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    )}

                                                    {/* Legend */}
                                                    <div className="p-2.5 bg-slate-50 dark:bg-[#0D1117] rounded-xl border border-slate-200 dark:border-[#30363D] flex items-center justify-center gap-3 text-[9.5px] font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> P = Present</span>
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> HD = Half Day</span>
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> A = Absent</span>
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> PL = Paid Leave</span>
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> WO = Week Off</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* ------------------------------------------------
                                        SUB-TAB 3: FINANCES & SALARY CREDIT
                                        ------------------------------------------------ */}
                                    {subTab === 'finances' && (
                                        <div className="space-y-3 animate-in fade-in duration-150">
                                            {/* 4 Financial KPI Stat Cards */}
                                            {(() => {
                                                const filteredFinances = financeSummary.filter(f => financeRoleFilter === 'All' || f.role === financeRoleFilter);
                                                let totalAccrued = 0;
                                                let totalAdvances = 0;
                                                let totalNet = 0;
                                                let totalPaid = 0;

                                                filteredFinances.forEach(f => {
                                                    totalAccrued += Number(f.accrued_credit || f.accruedCredit || 0);
                                                    totalAdvances += Number(f.advances_taken || f.totalAdvance || 0);
                                                    totalNet += Number(f.net_payable || f.netPayable || 0);
                                                    totalPaid += Number(f.total_paid || f.paidAmount || 0);
                                                });

                                                return (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <LabourStatCard
                                                            title="Total Accrued"
                                                            value={`₹${Math.round(totalAccrued).toLocaleString()}`}
                                                            icon={Wallet}
                                                            iconColor="#6366F1"
                                                        />
                                                        <LabourStatCard
                                                            title="Advances Paid"
                                                            value={`₹${Math.round(totalAdvances).toLocaleString()}`}
                                                            icon={DollarSign}
                                                            iconColor="#F59E0B"
                                                        />
                                                        <LabourStatCard
                                                            title="Net Payable"
                                                            value={`₹${Math.round(totalNet).toLocaleString()}`}
                                                            icon={Clock}
                                                            iconColor="#10B981"
                                                        />
                                                        <LabourStatCard
                                                            title="Total Paid"
                                                            value={`₹${Math.round(totalPaid).toLocaleString()}`}
                                                            icon={CheckCircle2}
                                                            iconColor="#3B82F6"
                                                        />
                                                    </div>
                                                );
                                            })()}

                                            {/* Month Selector & Role Filter & Export Payroll Button */}
                                            <div className="p-2.5 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] shadow-2xs flex items-center justify-between gap-2">
                                                <div className="w-28">
                                                    <MonthPicker
                                                        value={financeMonth}
                                                        onChange={(val) => setFinanceMonth(val)}
                                                        compact={true}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <MinimalSelect
                                                        options={[
                                                            { value: 'All', label: 'All Roles' },
                                                            ...Array.from(new Set(financeSummary.map(f => f.role).filter(Boolean))).map(r => ({ value: r, label: r }))
                                                        ]}
                                                        value={financeRoleFilter}
                                                        onChange={(val) => setFinanceRoleFilter(val)}
                                                        variant="input"
                                                        size="sm"
                                                        triggerClassName="w-full justify-between py-1.5 px-2 rounded-xl text-xs font-medium"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={exportPayoutsToExcel}
                                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] flex items-center gap-1 shrink-0 shadow-2xs transition-colors"
                                                >
                                                    <Download size={12} />
                                                    <span>Payroll</span>
                                                </button>
                                            </div>

                                            {/* Financial Ledger Cards */}
                                            {financeLoading ? (
                                                <div className="py-8 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D]">
                                                    <LoadingScreen size="sm" message="Loading financial ledger..." fullScreen={false} />
                                                </div>
                                            ) : financeSummary.length === 0 ? (
                                                <div className="p-8 text-center bg-white dark:bg-[#161B22] rounded-xl border border-dashed border-slate-200 dark:border-[#30363D] space-y-2">
                                                    <Wallet className="mx-auto text-slate-300 dark:text-slate-600" size={30} />
                                                    <p className="text-slate-500 dark:text-slate-400">No financial ledger entries for this site.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2.5">
                                                    {financeSummary
                                                        .filter(f => financeRoleFilter === 'All' || f.role === financeRoleFilter)
                                                        .map(row => {
                                                            const accrued = Number(row.accrued_credit || row.accruedCredit || 0);
                                                            const advances = Number(row.advances_taken || row.totalAdvance || 0);
                                                            const net = Number(row.net_payable || row.netPayable || 0);
                                                            const paid = Number(row.total_paid || row.paidAmount || 0);
                                                            const isSettled = net <= 0;

                                                            return (
                                                                <div
                                                                    key={row.labour_id || row.labourId}
                                                                    className="p-3 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] shadow-2xs space-y-2.5"
                                                                >
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="min-w-0 flex-1">
                                                                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                                                {row.name}
                                                                            </h4>
                                                                            <p className="text-[10px] text-slate-500 dark:text-[#8B949E] mt-0.5">
                                                                                ₹{row.monthly_salary}/day • ₹{Number(row.overtime_pay_per_hour || 0)}/hr OT
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <SkillBadge skill={row.role} />
                                                                            <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider ${
                                                                                isSettled
                                                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50'
                                                                                    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50'
                                                                            }`}>
                                                                                {isSettled ? 'Settled' : 'Pending'}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* 4-Metric Grid */}
                                                                    <div className="grid grid-cols-4 gap-1 p-2 bg-slate-50 dark:bg-[#0D1117] rounded-lg border border-slate-200/60 dark:border-[#30363D]/60 text-center">
                                                                        <div>
                                                                            <span className="block text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Earned</span>
                                                                            <span className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400">₹{accrued.toLocaleString()}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="block text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Advances</span>
                                                                            <span className="font-bold text-[11px] text-amber-600 dark:text-amber-400">₹{advances.toLocaleString()}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="block text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Net Pay</span>
                                                                            <span className={`font-bold text-[11px] ${net < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                                ₹{net.toLocaleString()}
                                                                            </span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="block text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Paid</span>
                                                                            <span className="font-bold text-[11px] text-blue-600 dark:text-blue-400">₹{paid.toLocaleString()}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Action Buttons */}
                                                                    <div className="flex items-center justify-between pt-1 text-xs">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleViewHistory(row)}
                                                                            className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                                                                        >
                                                                            <History size={12} />
                                                                            <span>History</span>
                                                                        </button>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleOpenAdvance(row)}
                                                                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 text-[10px] font-semibold transition-colors cursor-pointer"
                                                                            >
                                                                                Advance
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleOpenPayout(row)}
                                                                                disabled={net <= 0}
                                                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                                                                                    net <= 0
                                                                                        ? 'bg-slate-100 dark:bg-[#21262D] text-slate-400 border border-slate-200 dark:border-[#30363D] cursor-not-allowed'
                                                                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
                                                                                }`}
                                                                            >
                                                                                Settle
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        {/* ====================================================
                            TAB 2: WORKER DIRECTORY
                            ==================================================== */}
                        {activeTab === 'directory' && (
                            <div className="space-y-3 animate-in fade-in duration-200">
                                {/* Action Buttons Bar (+ Add Worker, Transfer, Bulk Upload) */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingLabour(null);
                                            setLabourForm({
                                                name: '', phone: '', sex: 'Male', role: '',
                                                wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '',
                                                overtime_pay_per_hour: '0', status: 'Active'
                                            });
                                            setShowLabourModal(true);
                                        }}
                                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer transition-all active:scale-95"
                                    >
                                        <Plus size={14} strokeWidth={2.5} />
                                        <span>Add Worker</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedTransferLabourIds([]);
                                            setBulkSourceSiteId('All');
                                            setBulkDestinationSiteId('');
                                            setShowBulkTransferModal(true);
                                        }}
                                        className="flex-1 py-2 bg-white dark:bg-[#161B22] hover:bg-slate-50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 rounded-xl font-semibold flex items-center justify-center gap-1.5 text-xs shadow-2xs cursor-pointer transition-all"
                                    >
                                        <ArrowRight size={14} />
                                        <span>Transfer</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setParsedLabours([]);
                                            setShowBulkLabourModal(true);
                                        }}
                                        className="p-2 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                                        title="Bulk Upload Excel"
                                    >
                                        <Upload size={16} />
                                    </button>
                                </div>

                                {/* Search Bar */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        value={directorySearch}
                                        onChange={(e) => setDirectorySearch(e.target.value)}
                                        placeholder="Search name, phone or role..."
                                        className="w-full pl-8 pr-7 py-2 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-xl text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                                    />
                                    {directorySearch && (
                                        <button
                                            type="button"
                                            onClick={() => setDirectorySearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>

                                {/* Filters Row (Site & Role Dropdowns) */}
                                <div className="grid grid-cols-2 gap-2">
                                    <MinimalSelect
                                        options={[
                                            { value: 'All', label: 'All Sites' },
                                            { value: 'Unassigned', label: 'Unassigned' },
                                            ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                        ]}
                                        value={directorySiteFilter}
                                        onChange={(val) => setDirectorySiteFilter(val)}
                                        variant="input"
                                        size="sm"
                                        triggerClassName="w-full justify-between py-1.5 px-3 rounded-xl text-xs font-medium"
                                    />
                                    <MinimalSelect
                                        options={[
                                            { value: 'All', label: 'All Roles' },
                                            ...Array.from(new Set(labours.map(l => l.role).filter(Boolean))).map(r => ({ value: r, label: r }))
                                        ]}
                                        value={directoryRoleFilter}
                                        onChange={(val) => setDirectoryRoleFilter(val)}
                                        variant="input"
                                        size="sm"
                                        triggerClassName="w-full justify-between py-1.5 px-3 rounded-xl text-xs font-medium"
                                    />
                                </div>

                                {/* Worker Directory Cards List */}
                                <div className="space-y-2.5">
                                    {(() => {
                                        const filteredLabours = labours.filter(w => {
                                            if (directoryRoleFilter !== 'All' && w.role !== directoryRoleFilter) return false;
                                            if (directorySiteFilter === 'Unassigned' && (w.site_id !== null && (!w.site_ids || w.site_ids.length > 0))) return false;
                                            if (directorySiteFilter !== 'All' && directorySiteFilter !== 'Unassigned') {
                                                const sId = Number(directorySiteFilter);
                                                if (w.site_id !== sId && (!w.site_ids || !w.site_ids.includes(sId))) return false;
                                            }
                                            if (directorySearch.trim()) {
                                                const q = directorySearch.toLowerCase();
                                                const matchName = w.name?.toLowerCase().includes(q);
                                                const matchPhone = w.phone?.toLowerCase().includes(q);
                                                const matchRole = w.role?.toLowerCase().includes(q);
                                                if (!matchName && !matchPhone && !matchRole) return false;
                                            }
                                            return true;
                                        });

                                        if (filteredLabours.length === 0) {
                                            return (
                                                <div className="p-8 border border-dashed border-slate-200 dark:border-[#30363D] rounded-2xl text-center bg-white dark:bg-[#161B22] space-y-2">
                                                    <Users className="mx-auto text-slate-300 dark:text-slate-600" size={30} />
                                                    <p className="text-slate-500 dark:text-slate-400">No worker profiles found matching filter.</p>
                                                </div>
                                            );
                                        }

                                        return filteredLabours.map(worker => {
                                            const initials = worker.name ? worker.name.charAt(0).toUpperCase() : 'W';
                                            return (
                                                <div
                                                    key={worker.labour_id || worker.labourId}
                                                    className="p-3 bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] shadow-2xs space-y-2.5"
                                                >
                                                    <div className="flex items-start gap-2.5">
                                                        {/* Avatar Circle with Gradient */}
                                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                                                            {initials}
                                                        </div>

                                                        {/* Name & Subtitle Details */}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleViewHistory(worker)}
                                                                    className="font-bold text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate text-left cursor-pointer"
                                                                >
                                                                    {worker.name}
                                                                </button>
                                                                <SkillBadge skill={worker.role} />
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 dark:text-[#8B949E] mt-0.5 truncate">
                                                                Phone: {worker.phone || 'N/A'} • Site: {worker.site_name || 'Unassigned'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Rates & Actions Row */}
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#30363D]/60 text-xs">
                                                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                                                            Wage: ₹{worker.monthly_salary}/day • OT: ₹{Number(worker.overtime_pay_per_hour || 0)}/h
                                                        </span>

                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenScheduleModal(worker)}
                                                                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
                                                                title="Daily Schedule Planner"
                                                            >
                                                                <Calendar size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openWageRevisionDialog(worker)}
                                                                className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                                                                title="Wage Revision History"
                                                            >
                                                                <History size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingLabour(worker);
                                                                    setLabourForm({
                                                                        name: worker.name,
                                                                        phone: worker.phone || '',
                                                                        sex: worker.sex || 'Male',
                                                                        role: worker.role,
                                                                        wage_type: 'Daily Wage',
                                                                        monthly_salary: worker.monthly_salary,
                                                                        allowed_leaves: '0',
                                                                        site_id: worker.site_id?.toString() || '',
                                                                        overtime_pay_per_hour: worker.overtime_pay_per_hour?.toString() || '0',
                                                                        status: worker.status || 'Active'
                                                                    });
                                                                    setShowLabourModal(true);
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363D] rounded-lg transition-colors"
                                                                title="Edit Profile"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleConfirmDeleteLabour(worker.labour_id || worker.labourId)}
                                                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                                                title="Delete Worker"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ============================================================
                    ALL MODAL BOTTOM-SHEETS (SLIDING UP FROM BOTTOM OF SCREEN)
                    ============================================================ */}

                {/* BOTTOM-SHEET 1: ADD / EDIT SITE */}
                {createPortal(
                    <AnimatePresence>
                        {showSiteModal && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowSiteModal(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                                {editingSite ? 'Edit Construction Site' : 'Create Construction Site'}
                                            </h4>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                                Site Configuration Profile
                                            </span>
                                        </div>
                                        <button onClick={() => setShowSiteModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <form onSubmit={handleSaveSite} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Site Name *</label>
                                            <input
                                                type="text"
                                                value={siteForm.site_name}
                                                onChange={(e) => setSiteForm({ ...siteForm, site_name: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                                                required
                                                placeholder="e.g. Skyline Towers Phase 2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Location Details / Address</label>
                                            <textarea
                                                value={siteForm.location_details}
                                                onChange={(e) => setSiteForm({ ...siteForm, location_details: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                                                rows={2}
                                                placeholder="Plot 42, Sector 15..."
                                            />
                                        </div>
                                        {editingSite && (
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Site Status</label>
                                                <MinimalSelect
                                                    options={[
                                                        { value: 'Active', label: 'Active' },
                                                        { value: 'Completed', label: 'Completed' },
                                                        { value: 'On Hold', label: 'On Hold' }
                                                    ]}
                                                    value={siteForm.status}
                                                    onChange={(val) => setSiteForm({ ...siteForm, status: val })}
                                                    variant="input"
                                                    size="sm"
                                                    triggerClassName="w-full justify-between py-2 px-3 rounded-xl font-medium"
                                                />
                                            </div>
                                        )}
                                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-[#30363D]">
                                            <button type="button" onClick={() => setShowSiteModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-300 rounded-xl font-semibold">
                                                Cancel
                                            </button>
                                            <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs">
                                                Save Site
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* BOTTOM-SHEET 2: ADD / EDIT WORKER */}
                {createPortal(
                    <AnimatePresence>
                        {showLabourModal && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowLabourModal(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[90vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                                {editingLabour ? 'Edit Worker Profile' : 'Add Labour Worker'}
                                            </h4>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                                Workforce Profile Configuration
                                            </span>
                                        </div>
                                        <button onClick={() => setShowLabourModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <form onSubmit={handleSaveLabour} className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Worker Full Name *</label>
                                            <input
                                                type="text"
                                                value={labourForm.name}
                                                onChange={(e) => setLabourForm({ ...labourForm, name: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                                                required
                                                placeholder="e.g. Ramesh Kumar"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Phone Number</label>
                                                <input
                                                    type="tel"
                                                    value={labourForm.phone}
                                                    onChange={(e) => setLabourForm({ ...labourForm, phone: e.target.value })}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                                                    placeholder="9876543210"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Sex</label>
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
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Trade / Role *</label>
                                            <input
                                                type="text"
                                                value={labourForm.role}
                                                onChange={(e) => setLabourForm({ ...labourForm, role: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                                                required
                                                placeholder="Mason, Electrician, Plumber, Helper..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Assigned Base Site</label>
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
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Daily Wage (INR) *</label>
                                                <input
                                                    type="number"
                                                    value={labourForm.monthly_salary}
                                                    onChange={(e) => setLabourForm({ ...labourForm, monthly_salary: e.target.value })}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-mono"
                                                    required
                                                    placeholder="600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">OT Pay / Hour (INR)</label>
                                                <input
                                                    type="number"
                                                    value={labourForm.overtime_pay_per_hour}
                                                    onChange={(e) => setLabourForm({ ...labourForm, overtime_pay_per_hour: e.target.value })}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-mono"
                                                    placeholder="80"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-[#30363D]">
                                            <button type="button" onClick={() => setShowLabourModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-300 rounded-xl font-semibold">
                                                Cancel
                                            </button>
                                            <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs">
                                                Save Worker
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* BOTTOM-SHEET 3: BORROW / ADD WORKER TO ROSTER */}
                {createPortal(
                    <AnimatePresence>
                        {showBorrowModal && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowBorrowModal(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Borrow Worker for Today</h4>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                                Site: {selectedSite?.site_name}
                                            </span>
                                        </div>
                                        <button onClick={() => setShowBorrowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="p-4 border-b border-slate-100 dark:border-[#30363D]">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                value={borrowSearchQuery}
                                                onChange={(e) => setBorrowSearchQuery(e.target.value)}
                                                placeholder="Search worker by name or role..."
                                                className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100 dark:divide-[#21262D]">
                                        {labours
                                            .filter(lab => {
                                                const inRoster = attendanceRoster.some(r => (r.labour_id || r.labourId) === (lab.labour_id || lab.labourId));
                                                if (inRoster) return false;
                                                if (borrowSearchQuery.trim()) {
                                                    const q = borrowSearchQuery.toLowerCase();
                                                    return lab.name?.toLowerCase().includes(q) || lab.role?.toLowerCase().includes(q);
                                                }
                                                return true;
                                            })
                                            .map(lab => (
                                                <div
                                                    key={lab.labour_id || lab.labourId}
                                                    onClick={() => handleBorrowLabour(lab)}
                                                    className="pt-2 first:pt-0 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-[#161B22] p-2 rounded-xl transition-colors"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">{lab.name}</h5>
                                                        <p className="text-[10px] text-slate-500 dark:text-[#8B949E] mt-0.5 truncate">
                                                            {lab.role} • Base: {lab.site_name || 'Unassigned'}
                                                        </p>
                                                    </div>
                                                    <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 rounded-lg text-[10px] font-semibold shrink-0">
                                                        + Add
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* BOTTOM-SHEET 4: BULK TRANSFER WORKERS */}
                {createPortal(
                    <AnimatePresence>
                        {showBulkTransferModal && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowBulkTransferModal(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Bulk Move Workers</h4>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                                Reallocate to New Construction Site
                                            </span>
                                        </div>
                                        <button onClick={() => setShowBulkTransferModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <form onSubmit={handleExecuteBulkTransfer} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">From Site</label>
                                                <MinimalSelect
                                                    options={[
                                                        { value: 'All', label: 'All Sites' },
                                                        { value: 'Unassigned', label: 'Unassigned' },
                                                        ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                    ]}
                                                    value={bulkSourceSiteId}
                                                    onChange={(val) => {
                                                        setBulkSourceSiteId(val);
                                                        setSelectedTransferLabourIds([]);
                                                    }}
                                                    variant="input"
                                                    size="sm"
                                                    triggerClassName="w-full justify-between py-1.5 px-2 rounded-xl text-xs font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">To Site *</label>
                                                <MinimalSelect
                                                    options={[
                                                        { value: '', label: '-- Choose Destination --' },
                                                        { value: 'Unassigned', label: 'Unassigned / Independent' },
                                                        ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                    ]}
                                                    value={bulkDestinationSiteId}
                                                    onChange={(val) => setBulkDestinationSiteId(val)}
                                                    variant="input"
                                                    size="sm"
                                                    triggerClassName="w-full justify-between py-1.5 px-2 rounded-xl text-xs font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                    Select Workers ({selectedTransferLabourIds.length})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const available = labours.filter(l => {
                                                            if (bulkSourceSiteId === 'Unassigned') return l.site_id === null;
                                                            if (bulkSourceSiteId !== 'All') return l.site_id === Number(bulkSourceSiteId);
                                                            return true;
                                                        });
                                                        if (selectedTransferLabourIds.length === available.length) {
                                                            setSelectedTransferLabourIds([]);
                                                        } else {
                                                            setSelectedTransferLabourIds(available.map(l => l.labour_id || l.labourId));
                                                        }
                                                    }}
                                                    className="text-indigo-600 dark:text-indigo-400 font-semibold text-[11px]"
                                                >
                                                    Toggle All
                                                </button>
                                            </div>
                                            <div className="border border-slate-200 dark:border-[#30363D] rounded-xl max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-[#161B22] space-y-1 divide-y divide-slate-100 dark:divide-[#21262D]">
                                                {labours
                                                    .filter(l => {
                                                        if (bulkSourceSiteId === 'Unassigned') return l.site_id === null;
                                                        if (bulkSourceSiteId !== 'All') return l.site_id === Number(bulkSourceSiteId);
                                                        return true;
                                                    })
                                                    .map(lab => {
                                                        const id = lab.labour_id || lab.labourId;
                                                        const isChecked = selectedTransferLabourIds.includes(id);
                                                        return (
                                                            <label key={id} className="pt-1.5 first:pt-0 flex items-center gap-2 py-1 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {
                                                                        setSelectedTransferLabourIds(prev =>
                                                                            isChecked ? prev.filter(x => x !== id) : [...prev, id]
                                                                        );
                                                                    }}
                                                                    className="rounded text-indigo-600 cursor-pointer"
                                                                />
                                                                <span className="font-medium text-xs text-slate-800 dark:text-white truncate">{lab.name}</span>
                                                                <span className="text-[10px] text-slate-400">({lab.role})</span>
                                                            </label>
                                                        );
                                                    })}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-[#30363D]">
                                            <button type="button" onClick={() => setShowBulkTransferModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-300 rounded-xl font-semibold">
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={selectedTransferLabourIds.length === 0}
                                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50"
                                            >
                                                Transfer ({selectedTransferLabourIds.length})
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* BOTTOM-SHEET 5: LOG SALARY ADVANCE */}
                {createPortal(
                    <AnimatePresence>
                        {showAdvanceModal && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowAdvanceModal(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">₹</div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Log Salary Advance</h4>
                                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{advanceForm.name}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => setShowAdvanceModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <form onSubmit={handleSaveAdvance} className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Target Site</label>
                                                <MinimalSelect
                                                    options={[
                                                        { value: 'All', label: 'All Sites' },
                                                        ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                    ]}
                                                    value={advanceForm.site_id}
                                                    onChange={(val) => setAdvanceForm({ ...advanceForm, site_id: val })}
                                                    variant="input"
                                                    size="sm"
                                                    triggerClassName="w-full justify-between py-1.5 px-2 rounded-xl text-xs font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Payment Date *</label>
                                                <MobileDatePicker
                                                    value={advanceForm.date}
                                                    onChange={(val) => setAdvanceForm({ ...advanceForm, date: val })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Advance Amount (INR) *</label>
                                            <input
                                                type="number"
                                                value={advanceForm.amount}
                                                onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                                                required
                                                min="1"
                                                placeholder="e.g. 1000"
                                            />
                                        </div>
                                        {Number(advanceForm.amount) > Number(advanceForm.net_payable || 0) && (
                                            <div className="p-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-xl text-[10px] text-rose-700 dark:text-rose-400 flex items-center gap-1.5 font-medium">
                                                <AlertTriangle size={13} className="shrink-0 text-rose-600" />
                                                <span>Warning: Amount exceeds accrued balance (₹{Number(advanceForm.net_payable || 0).toLocaleString()}).</span>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Notes / Reason</label>
                                            <input
                                                type="text"
                                                value={advanceForm.notes}
                                                onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none"
                                                placeholder="Emergency medical, festival, travel..."
                                            />
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#30363D]">
                                            <button type="button" onClick={() => setShowAdvanceModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-300 rounded-xl font-semibold">
                                                Cancel
                                            </button>
                                            <button type="submit" className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold shadow-xs">
                                                Record Advance
                                            </button>
                                        </div>

                                        {/* Advance Timeline & Past Records */}
                                        <div className="pt-3 border-t border-slate-100 dark:border-[#30363D] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-xs text-slate-800 dark:text-white">Past Advances ({advanceHistory.length})</span>
                                                <div className="flex bg-slate-100 dark:bg-[#161B22] p-0.5 rounded-lg text-[9.5px]">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setAdvanceHistoryView('month'); loadAdvanceHistory(advanceForm.labour_id, financeMonth); }}
                                                        className={`px-2 py-0.5 rounded font-medium ${advanceHistoryView === 'month' ? 'bg-amber-500 text-white' : 'text-slate-500'}`}
                                                    >
                                                        Month
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setAdvanceHistoryView('all'); loadAdvanceHistory(advanceForm.labour_id, null); }}
                                                        className={`px-2 py-0.5 rounded font-medium ${advanceHistoryView === 'all' ? 'bg-amber-500 text-white' : 'text-slate-500'}`}
                                                    >
                                                        All
                                                    </button>
                                                </div>
                                            </div>

                                            {advanceHistoryLoading ? (
                                                <div className="py-4 text-center text-slate-400">Loading history...</div>
                                            ) : advanceHistory.length === 0 ? (
                                                <p className="text-center text-slate-400 italic py-2 text-[10px]">No advance payments logged for this worker.</p>
                                            ) : (
                                                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                                    {advanceHistory.map(adv => (
                                                        <div key={adv.advance_id} className="p-2 bg-slate-50 dark:bg-[#161B22] rounded-lg border border-slate-200 dark:border-[#30363D] flex items-center justify-between text-xs">
                                                            <div>
                                                                <span className="font-bold text-amber-600 dark:text-amber-400">₹{adv.amount}</span>
                                                                <span className="text-[10px] text-slate-400 ml-2">{formatPlatformDate(adv.date)}</span>
                                                                {adv.notes && <p className="text-[9.5px] text-slate-500 dark:text-slate-400">{adv.notes}</p>}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteAdvance(adv.advance_id)}
                                                                className="text-rose-400 hover:text-rose-600 p-1"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* BOTTOM-SHEET 6: PROCESS PAYOUT / RELEASE */}
                {createPortal(
                    <AnimatePresence>
                        {showPayoutModal && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowPayoutModal(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Settle Wage Payout</h4>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                                {payoutForm.name} ({payoutForm.month})
                                            </span>
                                        </div>
                                        <button onClick={() => setShowPayoutModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <form onSubmit={handleSavePayout} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
                                        {/* Financial Breakdown Card */}
                                        <div className="p-3 bg-slate-50 dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] grid grid-cols-2 gap-2 text-center text-[10px]">
                                            <div>
                                                <span className="text-slate-400 uppercase text-[8px] block font-semibold">Accrued</span>
                                                <span className="font-bold text-slate-800 dark:text-white">₹{payoutForm.accrued_credit}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 uppercase text-[8px] block font-semibold">Advances</span>
                                                <span className="font-bold text-amber-500">-₹{payoutForm.advances_taken}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 uppercase text-[8px] block font-semibold">Net Payable</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{payoutForm.net_payable}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 uppercase text-[8px] block font-semibold">Attendance</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{payoutForm.present_days}P / {payoutForm.half_days}HD / {payoutForm.absent_days}A</span>
                                            </div>
                                        </div>

                                        {/* Paid Amount */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase">Release Amount (INR) *</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setPayoutForm({ ...payoutForm, paid_amount: String(payoutForm.net_payable) })}
                                                    className="text-indigo-600 dark:text-indigo-400 text-[10px] font-bold hover:underline"
                                                >
                                                    Use Full Payout
                                                </button>
                                            </div>
                                            <input
                                                type="number"
                                                value={payoutForm.paid_amount}
                                                onChange={(e) => setPayoutForm({ ...payoutForm, paid_amount: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
                                                required
                                                min="0"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Status</label>
                                                <MinimalSelect
                                                    options={[
                                                        { value: 'Paid', label: 'Paid' },
                                                        { value: 'Pending', label: 'Pending' }
                                                    ]}
                                                    value={payoutForm.status}
                                                    onChange={(val) => setPayoutForm({ ...payoutForm, status: val })}
                                                    variant="input"
                                                    size="sm"
                                                    triggerClassName="w-full justify-between py-2 px-3 rounded-xl font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Payment Date</label>
                                                <MobileDatePicker
                                                    value={payoutForm.payment_date}
                                                    onChange={(val) => setPayoutForm({ ...payoutForm, payment_date: val })}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Notes / Reference</label>
                                            <input
                                                type="text"
                                                value={payoutForm.notes}
                                                onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none"
                                                placeholder="Cash, Bank Ref #, Cheque..."
                                            />
                                        </div>

                                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-[#30363D]">
                                            <button type="button" onClick={() => setShowPayoutModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-300 rounded-xl font-semibold">
                                                Cancel
                                            </button>
                                            <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs">
                                                Release Payout
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* BOTTOM-SHEET 7: DAILY SCHEDULE PLANNER */}
                {createPortal(
                    <AnimatePresence>
                        {showScheduleModal && selectedScheduleLabour && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowScheduleModal(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Daily Site Schedule</h4>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                                Plan Shift for {selectedScheduleLabour.name}
                                            </span>
                                        </div>
                                        <button onClick={() => setShowScheduleModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Target Date</label>
                                            <MobileDatePicker
                                                value={scheduleDate}
                                                onChange={async (val) => {
                                                    setScheduleDate(val);
                                                    setScheduleLoading(true);
                                                    try {
                                                        const res = await labourService.getLabourSchedule(selectedScheduleLabour.labour_id || selectedScheduleLabour.labourId, val);
                                                        setScheduleSites(res.site_ids || []);
                                                    } catch (e) {
                                                        setScheduleSites([]);
                                                    } finally {
                                                        setScheduleLoading(false);
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase">
                                                Assign Sites for this Day ({scheduleSites.length} selected)
                                            </label>
                                            {scheduleLoading ? (
                                                <div className="py-4 text-center text-slate-400">Loading site schedule...</div>
                                            ) : (
                                                <div className="border border-slate-200 dark:border-[#30363D] rounded-xl p-2 bg-slate-50 dark:bg-[#161B22] space-y-1 max-h-48 overflow-y-auto">
                                                    {sites.map(site => {
                                                        const isChecked = scheduleSites.includes(site.site_id);
                                                        const isPrimary = (selectedScheduleLabour.site_id === site.site_id);
                                                        return (
                                                            <div
                                                                key={site.site_id}
                                                                onClick={() => {
                                                                    setScheduleSites(prev =>
                                                                        isChecked ? prev.filter(x => x !== site.site_id) : [...prev, site.site_id]
                                                                    );
                                                                }}
                                                                className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                                                                    isChecked
                                                                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700/60 font-semibold text-indigo-700 dark:text-indigo-400'
                                                                        : 'border-slate-200 dark:border-[#30363D] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#21262D]'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => {}}
                                                                        className="rounded text-indigo-600 pointer-events-none"
                                                                    />
                                                                    <span>{site.site_name}</span>
                                                                </div>
                                                                {isPrimary && (
                                                                    <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 text-[8px] font-bold uppercase">
                                                                        Base Site
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-[9.5px] text-slate-400 italic">
                                            If no daily schedule is set, worker automatically appears on their base site checklist.
                                        </p>

                                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-[#30363D]">
                                            <button type="button" onClick={() => setShowScheduleModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-300 rounded-xl font-semibold">
                                                Cancel
                                            </button>
                                            <button type="button" onClick={handleSaveSchedule} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs">
                                                Save Schedule
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* BOTTOM-SHEET 8: WAGE REVISION HISTORY */}
                {createPortal(
                    <AnimatePresence>
                        {wageRevisionWorker && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setWageRevisionWorker(null)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Wage Revision History</h4>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                                {wageRevisionWorker.name} ({wageRevisionWorker.role})
                                            </span>
                                        </div>
                                        <button onClick={() => setWageRevisionWorker(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-xs text-slate-800 dark:text-white">Past Revisions ({wageRevisionList.length})</span>
                                            <button
                                                type="button"
                                                onClick={() => setShowAddRevisionForm(prev => !prev)}
                                                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg font-semibold text-[10px] border border-indigo-200/50"
                                            >
                                                {showAddRevisionForm ? 'Cancel' : '+ Add Revision'}
                                            </button>
                                        </div>

                                        {showAddRevisionForm && (
                                            <form onSubmit={handleSaveNewRevision} className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 space-y-2.5">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Effective Date *</label>
                                                        <MobileDatePicker
                                                            value={newRevisionForm.effective_date}
                                                            onChange={(val) => setNewRevisionForm({ ...newRevisionForm, effective_date: val })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Daily Wage (INR) *</label>
                                                        <input
                                                            type="number"
                                                            value={newRevisionForm.daily_rate}
                                                            onChange={(e) => setNewRevisionForm({ ...newRevisionForm, daily_rate: e.target.value })}
                                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-lg text-xs font-mono font-bold"
                                                            required
                                                            placeholder="650"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">OT Pay / Hr</label>
                                                        <input
                                                            type="number"
                                                            value={newRevisionForm.overtime_pay_per_hour}
                                                            onChange={(e) => setNewRevisionForm({ ...newRevisionForm, overtime_pay_per_hour: e.target.value })}
                                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-lg text-xs font-mono font-bold"
                                                            placeholder="90"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">Notes</label>
                                                        <input
                                                            type="text"
                                                            value={newRevisionForm.notes}
                                                            onChange={(e) => setNewRevisionForm({ ...newRevisionForm, notes: e.target.value })}
                                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] text-slate-900 dark:text-white rounded-lg text-xs"
                                                            placeholder="Promoted to Lead..."
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="submit"
                                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs"
                                                >
                                                    Commit Revision
                                                </button>
                                            </form>
                                        )}

                                        {wageRevisionLoading ? (
                                            <div className="py-6 text-center text-slate-400">Loading revisions...</div>
                                        ) : wageRevisionList.length === 0 ? (
                                            <p className="text-center text-slate-400 italic py-4">No revisions logged. Base wage active.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {wageRevisionList.map(rev => (
                                                    <div key={rev.revision_id} className="p-3 bg-slate-50 dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] flex items-center justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">₹{rev.daily_rate}/day</span>
                                                                <span className="text-[10px] text-slate-400 font-medium">Effective: {formatPlatformDate(rev.effective_date)}</span>
                                                            </div>
                                                            <p className="text-[9.5px] text-slate-500 dark:text-[#8B949E] mt-0.5">
                                                                OT: ₹{Number(rev.overtime_pay_per_hour || 0)}/h {rev.notes ? `• ${rev.notes}` : ''}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteRevision(rev.revision_id)}
                                                            className="text-rose-400 hover:text-rose-600 p-1.5"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* BOTTOM-SHEET 9: WORK HISTORY & SETTLEMENTS */}
                {createPortal(
                    <AnimatePresence>
                        {selectedHistoryLabour && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setSelectedHistoryLabour(null)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{selectedHistoryLabour.name}</h4>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                                Work History & Settlement Records
                                            </span>
                                        </div>
                                        <button onClick={() => setSelectedHistoryLabour(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                                        {/* Global Ledger Banner */}
                                        {selectedHistoryLabourDetails && (
                                            <div className="p-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl shadow-md border border-indigo-950/40 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <span className="block text-[8px] uppercase font-bold text-indigo-300 tracking-wider">All-Time Global Balance</span>
                                                        <span className="text-base font-bold text-emerald-400">₹{selectedHistoryLabourDetails.global_net_payable.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenAdvance(selectedHistoryLabour)}
                                                            className="px-2.5 py-1 text-[9.5px] font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all"
                                                        >
                                                            Advance
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenPayout(selectedHistoryLabour)}
                                                            disabled={selectedHistoryLabourDetails.global_net_payable <= 0}
                                                            className="px-2.5 py-1 text-[9.5px] font-semibold bg-white text-indigo-950 hover:bg-indigo-50 disabled:opacity-40 rounded-lg transition-all"
                                                        >
                                                            Release
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-indigo-900/60 text-[8px] font-mono text-indigo-200">
                                                    <div>
                                                        <span className="block text-[7.5px] uppercase text-indigo-400">Earned</span>
                                                        ₹{selectedHistoryLabourDetails.global_earned.toLocaleString()}
                                                    </div>
                                                    <div>
                                                        <span className="block text-[7.5px] uppercase text-indigo-400">Paid</span>
                                                        ₹{selectedHistoryLabourDetails.global_paid.toLocaleString()}
                                                    </div>
                                                    <div>
                                                        <span className="block text-[7.5px] uppercase text-indigo-400">Advances</span>
                                                        ₹{selectedHistoryLabourDetails.global_advances.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Subtab Switcher */}
                                        <div className="flex bg-slate-100 dark:bg-[#161B22] p-0.5 rounded-lg border border-slate-200 dark:border-[#30363D]">
                                            <button
                                                type="button"
                                                onClick={() => setHistoryTab('sites')}
                                                className={`flex-1 py-1 rounded font-semibold text-[10.5px] transition-all ${
                                                    historyTab === 'sites' ? 'bg-white dark:bg-[#21262D] text-indigo-600 dark:text-white shadow-2xs' : 'text-slate-500'
                                                }`}
                                            >
                                                Site Timeline
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHistoryTab('payouts')}
                                                className={`flex-1 py-1 rounded font-semibold text-[10.5px] transition-all ${
                                                    historyTab === 'payouts' ? 'bg-white dark:bg-[#21262D] text-indigo-600 dark:text-white shadow-2xs' : 'text-slate-500'
                                                }`}
                                            >
                                                Payout Records
                                            </button>
                                        </div>

                                        {historyLoading ? (
                                            <div className="py-6 text-center text-slate-400">Loading history...</div>
                                        ) : historyTab === 'sites' ? (
                                            <div className="space-y-2">
                                                {labourHistoryData.length === 0 ? (
                                                    <p className="text-center text-slate-400 italic py-4">No site work history recorded.</p>
                                                ) : (
                                                    labourHistoryData.map(siteLog => {
                                                        const rate = siteLog.total_days > 0 ? Math.round(((siteLog.present_days + siteLog.paid_leave_days + (0.5 * siteLog.half_day_days)) / siteLog.total_days) * 100) : 0;
                                                        return (
                                                            <div key={siteLog.site_id} className="p-3 bg-slate-50 dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D]">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-bold text-xs text-slate-900 dark:text-white">{siteLog.site_name || 'Unassigned'}</span>
                                                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">{rate}% Active</span>
                                                                </div>
                                                                <span className="text-[9px] text-slate-400 block mt-0.5">
                                                                    {formatPlatformDate(siteLog.first_date)} to {formatPlatformDate(siteLog.last_date)} ({siteLog.total_days} Days logged)
                                                                </span>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {labourPayoutHistory.length === 0 ? (
                                                    <p className="text-center text-slate-400 italic py-4">No payout records found.</p>
                                                ) : (
                                                    labourPayoutHistory.map(payout => (
                                                        <div key={payout.payout_id} className="p-3 bg-slate-50 dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#30363D] space-y-1">
                                                            <div className="flex justify-between items-center font-bold">
                                                                <span className="text-indigo-600 dark:text-indigo-400">{payout.month}</span>
                                                                <span className="text-slate-900 dark:text-white">₹{payout.paid_amount}</span>
                                                            </div>
                                                            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                                                                <span>Site: {payout.site_name || 'Global'}</span>
                                                                <span>Status: {payout.status}</span>
                                                            </div>
                                                            <p className="text-[8.5px] text-slate-400 text-right">{formatPlatformDate(payout.payment_date)}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* BOTTOM-SHEET 10: BULK UPLOAD EXCEL / CSV */}
                {createPortal(
                    <AnimatePresence>
                        {showBulkLabourModal && (
                            <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowBulkLabourModal(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="flex justify-between items-center px-5 pb-3 border-b border-slate-100 dark:border-[#30363D]">
                                        <div className="flex items-center gap-2">
                                            <Upload size={16} className="text-indigo-600" />
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Bulk Upload Labours</h4>
                                        </div>
                                        <button onClick={() => setShowBulkLabourModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
                                        {parsedLabours.length === 0 ? (
                                            <div className="space-y-3">
                                                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 rounded-xl space-y-1.5">
                                                    <h5 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">Excel / CSV Template</h5>
                                                    <p className="text-[10px] text-slate-500 dark:text-[#8B949E] leading-relaxed">
                                                        Ensure file contains: Name, Role, Monthly Salary (or Daily Wage), Phone, Sex, Site Name.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={downloadCSVTemplate}
                                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-[10px] shadow-2xs"
                                                    >
                                                        Download Template
                                                    </button>
                                                </div>

                                                <div className="border-2 border-dashed border-slate-200 dark:border-[#30363D] rounded-xl p-8 text-center bg-slate-50 dark:bg-[#161B22] flex flex-col items-center justify-center gap-2">
                                                    <Upload size={28} className="text-slate-400" />
                                                    <label className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-xs">
                                                        Upload .xlsx or .csv
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
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="font-bold text-slate-800 dark:text-white">
                                                        Preview ({parsedLabours.filter(l => l.isValid).length} Valid)
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setParsedLabours([])}
                                                        className="text-rose-500 text-[10px] font-semibold"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                                <div className="border border-slate-200 dark:border-[#30363D] rounded-xl max-h-56 overflow-y-auto">
                                                    <table className="w-full text-left text-[10px]">
                                                        <thead className="bg-slate-50 dark:bg-[#161B22] border-b border-slate-200 dark:border-[#30363D]">
                                                            <tr>
                                                                <th className="p-2">Name</th>
                                                                <th className="p-2">Role</th>
                                                                <th className="p-2">Wage</th>
                                                                <th className="p-2">Site</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-[#21262D]">
                                                            {parsedLabours.map((r, i) => (
                                                                <tr key={i}>
                                                                    <td className={`p-2 font-bold ${r.isValid ? 'text-slate-900 dark:text-white' : 'line-through text-slate-400'}`}>{r.name}</td>
                                                                    <td className="p-2">{r.role}</td>
                                                                    <td className="p-2">₹{r.monthly_salary}</td>
                                                                    <td className="p-2">{r.site_name || 'Unassigned'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#30363D]">
                                                    <button type="button" onClick={() => setParsedLabours([])} className="flex-1 py-2.5 bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-300 rounded-xl font-semibold">
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleSaveBulkLabours}
                                                        disabled={isUploadingBulk}
                                                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs"
                                                    >
                                                        {isUploadingBulk ? 'Importing...' : 'Confirm Import'}
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

                {/* BOTTOM-SHEET 11: CONFIRM ACTION DIALOG */}
                {createPortal(
                    <AnimatePresence>
                        {confirmDialog.isOpen && (
                            <div className="fixed inset-0 z-[2000] flex items-end justify-center overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                                    className="relative w-full max-h-[85vh] bg-white dark:bg-[#0D1117] rounded-t-3xl shadow-2xl flex flex-col border-t border-slate-200 dark:border-[#30363D] z-10"
                                >
                                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
                                    <div className="p-6 space-y-3">
                                        <div className="flex items-center gap-2.5 text-rose-500">
                                            <AlertTriangle size={20} />
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                                {confirmDialog.title}
                                            </h4>
                                        </div>
                                        <p className="text-slate-600 dark:text-[#8B949E] text-xs leading-relaxed">
                                            {confirmDialog.message}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 p-4 bg-slate-50 dark:bg-[#161B22] border-t border-slate-100 dark:border-[#30363D]">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                                            className="flex-1 py-2.5 bg-slate-200/80 dark:bg-[#21262D] text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                            }}
                                            className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs ${
                                                confirmDialog.isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                            }`}
                                        >
                                            {confirmDialog.confirmText}
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
