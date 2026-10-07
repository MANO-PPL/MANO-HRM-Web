import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { holidayService, parseLocalDate } from '../../services/holidayService';
import { formatPlatformDate } from '../../utils/dateUtils';
import MobileLeaveApplication from './LeaveApplication-mv';
import { toast } from 'react-toastify';
import Papa from 'papaparse';
import {
    Calendar,
    Plus,
    Trash2,
    Search,
    X,
    FileText,
    Upload,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Edit3,
    PartyPopper,
    Download,
    Check,
    AlertCircle,
    Loader2,
    CheckCircle
} from 'lucide-react';
import DatePicker from '../../components/DatePicker';

// =============================================================================
// 1. HOLIDAY DETAIL DIALOG (Matching Flutter HolidayDetailDialog)
// =============================================================================
const HolidayDetailDialog = ({ holiday, onClose }) => {
    if (!holiday) return null;
    const date = parseLocalDate(holiday.holiday_date);

    return createPortal(
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#161B22] rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-[#30363D] animate-in zoom-in-95 duration-200">
                {/* Header Image/Icon Area */}
                <div className="h-28 w-full bg-[#6366F1]/10 dark:bg-[#6366F1]/15 flex items-center justify-center relative">
                    <div className="w-14 h-14 rounded-full bg-[#6366F1]/20 dark:bg-[#6366F1]/30 flex items-center justify-center text-[#6366F1] dark:text-[#818CF8]">
                        <PartyPopper size={30} />
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 text-center space-y-4">
                    {/* Date Badge */}
                    <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#6366F1]/10 text-[#6366F1] dark:bg-[#6366F1]/20 dark:text-[#818CF8]">
                        {formatPlatformDate(holiday.holiday_date)}
                    </div>

                    {/* Holiday Name */}
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                            {holiday.holiday_name}
                        </h3>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2 text-left">
                        <div className="bg-slate-50 dark:bg-[#0D1117] p-3 rounded-2xl border border-slate-100 dark:border-[#30363D]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Category</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {holiday.holiday_type || 'Public Holiday'}
                            </span>
                        </div>
                        <div className="bg-slate-50 dark:bg-[#0D1117] p-3 rounded-2xl border border-slate-100 dark:border-[#30363D]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Applicable</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                All Locations
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-[#6366F1] hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md active:scale-98 transition-all"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// =============================================================================
// 2. HOLIDAY FORM MODAL (Add / Edit - Matching Flutter HolidayFormDialog)
// =============================================================================
const HolidayFormModal = ({ isOpen, isEdit, initialData, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [type, setType] = useState('Public Holiday');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || initialData?.holiday_name || '');
            setDate(initialData?.date || initialData?.holiday_date || new Date().toISOString().split('T')[0]);
            setType(initialData?.type || initialData?.holiday_type || 'Public Holiday');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Please enter holiday name");
            return;
        }
        if (!date) {
            toast.error("Please select holiday date");
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                holiday_name: name.trim(),
                holiday_date: date,
                holiday_type: type,
                applicable_json: ['All Locations']
            });
            onClose();
        } catch (err) {
            toast.error(err.message || "Failed to save holiday");
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[600] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full bg-white dark:bg-[#161B22] rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+20px)] border-t border-slate-200 dark:border-[#30363D] animate-in slide-in-from-bottom duration-200">
                <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#30363D]">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-github-dark-text">
                        {isEdit ? 'Edit Holiday' : 'Create New Holiday'}
                    </h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Holiday Name
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. New Year's Day"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full py-2.5 px-3 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-xs font-semibold text-slate-800 dark:text-github-dark-text outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <DatePicker
                            label="Holiday Date"
                            value={date}
                            onChange={setDate}
                            placeholder="Select date"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Category / Type
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full py-2.5 px-3 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-xs font-semibold text-slate-800 dark:text-github-dark-text outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="Public Holiday">Public Holiday</option>
                            <option value="Optional Holiday">Optional Holiday</option>
                            <option value="National Holiday">National Holiday</option>
                            <option value="Festival Holiday">Festival Holiday</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-3 bg-[#6366F1] hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5 mt-2"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : (isEdit ? <Check size={16} /> : <Plus size={16} />)}
                        <span>{isSaving ? 'Saving...' : (isEdit ? 'Update Holiday' : 'Save Holiday')}</span>
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

// =============================================================================
// 3. BULK HOLIDAY IMPORT MODAL (Matching Flutter CSV Import)
// =============================================================================
const BulkHolidayImportModal = ({ isOpen, onClose, onImportSuccess }) => {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    if (!isOpen) return null;

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setIsParsing(true);
            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const parsed = (results.data || []).map(row => {
                        const name = row['Holiday Name'] || row['holiday_name'] || row['name'] || row['Name'];
                        const date = row['Date'] || row['holiday_date'] || row['date'];
                        const rawType = row['Type'] || row['holiday_type'] || row['type'] || 'Public';
                        return {
                            name: (name || '').trim(),
                            date: (date || '').trim(),
                            type: (rawType || 'Public').trim()
                        };
                    }).filter(r => r.name && r.date);

                    setPreviewData(parsed);
                    setIsParsing(false);
                },
                error: (err) => {
                    toast.error("Failed to parse CSV: " + err.message);
                    setIsParsing(false);
                }
            });
        }
    };

    const handleConfirmImport = async () => {
        if (!previewData.length) {
            toast.error("No valid holiday rows found in CSV");
            return;
        }

        setIsUploading(true);
        try {
            const batch = previewData.map(p => ({
                holiday_name: p.name,
                holiday_date: p.date,
                holiday_type: p.type || 'Public Holiday',
                applicable_json: ['All Locations']
            }));

            await holidayService.bulkCreateHolidaysJson(batch);
            toast.success(`Imported ${batch.length} holidays successfully`);
            onImportSuccess();
            onClose();
        } catch (err) {
            toast.error(err.message || "Bulk import failed");
        } finally {
            setIsUploading(false);
        }
    };

    const downloadSampleCSV = () => {
        const csvContent = "Holiday Name,Date,Type\nNew Year's Day,2026-01-01,National Holiday\nRepublic Day,2026-01-26,National Holiday\nTamil New Year,2026-04-14,Festival Holiday";
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "holiday_template.csv";
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return createPortal(
        <div className="fixed inset-0 z-[600] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full bg-white dark:bg-[#161B22] rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+20px)] border-t border-slate-200 dark:border-[#30363D] animate-in slide-in-from-bottom duration-200 space-y-4">
                <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2" />

                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#30363D]">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                            <Upload size={16} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-github-dark-text">Import Holidays from CSV</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
                        <X size={18} />
                    </button>
                </div>

                {/* Upload box */}
                <div className="space-y-3">
                    <label className="border-2 border-dashed border-slate-300 dark:border-[#30363D] hover:border-indigo-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 dark:bg-[#0D1117] transition-colors text-center">
                        <Upload size={28} className="text-indigo-500 mb-2" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {file ? file.name : "Tap to choose CSV file"}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Columns: Holiday Name, Date (YYYY-MM-DD), Type</span>
                        <input type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                    </label>

                    <div className="flex items-center justify-between text-xs px-1">
                        <span className="text-slate-400 text-[11px]">Need format example?</span>
                        <button
                            type="button"
                            onClick={downloadSampleCSV}
                            className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 hover:underline text-[11px]"
                        >
                            <Download size={13} />
                            <span>Download Template</span>
                        </button>
                    </div>
                </div>

                {/* Preview Table */}
                {isParsing && (
                    <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin text-indigo-600" />
                        <span>Parsing CSV file...</span>
                    </div>
                )}

                {previewData.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#30363D]">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Parsed Holidays ({previewData.length})
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle size={12} /> Ready to import
                            </span>
                        </div>

                        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#30363D] divide-y divide-slate-100 dark:divide-[#30363D]">
                            {previewData.map((row, idx) => (
                                <div key={idx} className="p-2.5 bg-white dark:bg-[#0D1117] flex items-center justify-between text-xs">
                                    <div className="min-w-0 flex-1 mr-2">
                                        <p className="font-bold text-slate-900 dark:text-white truncate">{row.name}</p>
                                        <p className="text-[10px] text-slate-400">{row.date}</p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                                        {row.type}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleConfirmImport}
                            disabled={isUploading}
                            className="w-full py-3 bg-[#6366F1] hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5 mt-2"
                        >
                            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            <span>{isUploading ? 'Importing...' : `Import ${previewData.length} Holidays`}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

// =============================================================================
// 4. HOLIDAY CALENDAR CARD (Matching Flutter HolidayCalendarCard)
// =============================================================================
const HolidayCalendarCard = ({
    currentMonth,
    selectedDate,
    holidays,
    onMonthChanged,
    onDateSelected,
    onTodayPressed
}) => {
    const now = new Date();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth(); // 0-indexed

    // Calculate 42 days grid starting on Sunday
    const firstDayOfMonth = new Date(year, month, 1);
    const leadingDays = firstDayOfMonth.getDay(); // 0 is Sunday
    const gridStartDate = new Date(year, month, 1 - leadingDays);

    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long' });
    const yearNum = currentMonth.getFullYear();

    // Generate 42 cells (6 rows x 7 days)
    const dayCells = useMemo(() => {
        const cells = [];
        for (let i = 0; i < 42; i++) {
            const cellDate = new Date(gridStartDate);
            cellDate.setDate(gridStartDate.getDate() + i);
            cells.push(cellDate);
        }
        return cells;
    }, [year, month, leadingDays]);

    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    return (
        <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200/80 dark:border-[#30363D] shadow-sm p-4 sm:p-5 space-y-4">
            {/* Header: Month/Year + Navigation Button Group */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                        {monthName}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400">
                        {yearNum}
                    </p>
                </div>

                {/* < TODAY > Navigation pill */}
                <div className="flex items-center bg-slate-100 dark:bg-[#0D1117] rounded-lg border border-slate-200 dark:border-[#30363D] overflow-hidden">
                    <button
                        onClick={() => onMonthChanged(new Date(year, month - 1, 1))}
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#21262D] transition-colors"
                        title="Previous Month"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div className="w-[1px] h-4 bg-slate-200 dark:bg-[#30363D]" />
                    <button
                        onClick={onTodayPressed}
                        className="px-2.5 py-1 text-[10.5px] font-bold tracking-wider text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-[#21262D] transition-colors"
                    >
                        TODAY
                    </button>
                    <div className="w-[1px] h-4 bg-slate-200 dark:bg-[#30363D]" />
                    <button
                        onClick={() => onMonthChanged(new Date(year, month + 1, 1))}
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#21262D] transition-colors"
                        title="Next Month"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Weekday Header Row */}
            <div className="grid grid-cols-7 text-center">
                {weekdays.map(w => (
                    <span key={w} className="text-[10px] font-bold tracking-wider text-slate-400">
                        {w}
                    </span>
                ))}
            </div>

            {/* 42-day Month Grid */}
            <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 text-center">
                {dayCells.map((cellDate, idx) => {
                    const isCurrentMonth = cellDate.getMonth() === month;
                    const isToday = cellDate.getFullYear() === now.getFullYear() &&
                        cellDate.getMonth() === now.getMonth() &&
                        cellDate.getDate() === now.getDate();

                    const isSelected = selectedDate &&
                        cellDate.getFullYear() === selectedDate.getFullYear() &&
                        cellDate.getMonth() === selectedDate.getMonth() &&
                        cellDate.getDate() === selectedDate.getDate();

                    const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
                    const dayHolidays = holidays.filter(h => (h.holiday_date || '').startsWith(dateStr));

                    const hasPublic = dayHolidays.any ? dayHolidays.some(h => (h.holiday_type || '').toLowerCase().includes('public') || (h.holiday_type || '').toLowerCase().includes('nh') || (h.holiday_type || '').toLowerCase().includes('national')) : false;
                    const hasOptional = dayHolidays.some(h => (h.holiday_type || '').toLowerCase().includes('optional') || (h.holiday_type || '').toLowerCase().includes('festival') || (h.holiday_type || '').toLowerCase().includes('fh'));

                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => onDateSelected(cellDate)}
                            className={`h-9 w-full rounded-full flex flex-col items-center justify-center relative transition-all ${
                                isToday
                                    ? 'bg-[#4F46E5] text-white font-bold shadow-sm'
                                    : isSelected
                                        ? 'border-2 border-[#6366F1] bg-indigo-50 dark:bg-[#21262D] text-indigo-600 dark:text-indigo-400 font-bold'
                                        : isCurrentMonth
                                            ? 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#21262D]'
                                            : 'text-slate-300 dark:text-[#484F58]'
                            }`}
                        >
                            <span className="text-xs leading-none">
                                {cellDate.getDate()}
                            </span>

                            {/* Holiday indicator dots */}
                            {(hasPublic || hasOptional) && (
                                <div className="flex items-center gap-0.5 mt-0.5">
                                    {hasPublic && (
                                        <span className="w-1 h-1 rounded-full bg-[#9333EA]" />
                                    )}
                                    {hasOptional && (
                                        <span className="w-1 h-1 rounded-full bg-[#F59E0B]" />
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 dark:border-[#30363D]" />

            {/* Legend Row */}
            <div className="flex items-center justify-center gap-6 text-[10.5px] font-bold tracking-wider text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-[2px] bg-[#9333EA]" />
                    <span>PUBLIC</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-[2px] bg-[#F59E0B]" />
                    <span>OPTIONAL</span>
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// MAIN HOLIDAY MANAGEMENT COMPONENT
// =============================================================================
const HolidayManagement = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const isAdmin = user?.user_type === 'admin' || user?.user_type === 'hr';

    // Tabs
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (['leaves', 'leave_application', 'my_leaves', 'requests', 'balances'].includes(tab)) {
            return 'leaves';
        }
        return 'holidays';
    });

    // Calendar state
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(null);

    // Holidays data
    const [holidays, setHolidays] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [selectedHoliday, setSelectedHoliday] = useState(null);
    const [formModal, setFormModal] = useState({ isOpen: false, isEdit: false, holiday: null });
    const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, holiday: null });

    // Sync tab with URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (['leaves', 'leave_application', 'my_leaves', 'requests', 'balances'].includes(tab)) {
            setActiveTab('leaves');
        } else if (tab === 'holidays') {
            setActiveTab('holidays');
        }
    }, [location.search]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        navigate(`/holidays?tab=${tabId}`);
    };

    // Load Holidays
    const fetchHolidays = async () => {
        setIsLoading(true);
        try {
            const res = await holidayService.getHolidays();
            if (res.ok && res.holidays) {
                setHolidays(res.holidays);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load holidays");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHolidays();
    }, []);

    // Filtered visible holidays
    const visibleHolidays = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        if (query) {
            return holidays.filter(h =>
                (h.holiday_name || '').toLowerCase().includes(query) ||
                (h.holiday_date || '').toLowerCase().includes(query) ||
                (h.holiday_type || '').toLowerCase().includes(query)
            );
        }

        if (selectedDate) {
            const selDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
            return holidays.filter(h => (h.holiday_date || '').startsWith(selDateStr));
        }

        const currYear = currentMonth.getFullYear();
        const currMonth = currentMonth.getMonth();
        return holidays.filter(h => {
            const d = parseLocalDate(h.holiday_date);
            return d.getFullYear() === currYear && d.getMonth() === currMonth;
        });
    }, [holidays, searchTerm, selectedDate, currentMonth]);

    // Group visible holidays by Month Year
    const monthGroups = useMemo(() => {
        const groups = {};
        visibleHolidays.forEach(h => {
            const d = parseLocalDate(h.holiday_date);
            const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            if (!groups[key]) groups[key] = [];
            groups[key].push(h);
        });

        // Sort items inside each month
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date));
        });

        return groups;
    }, [visibleHolidays]);

    // CRUD Handlers
    const handleSaveHoliday = async (payload) => {
        if (formModal.isEdit && formModal.holiday) {
            const targetId = formModal.holiday.holiday_id || formModal.holiday.id;
            await holidayService.updateHoliday(targetId, payload);
            toast.success("Holiday updated successfully");
        } else {
            await holidayService.addHoliday(payload);
            toast.success("Holiday added successfully");
        }
        await fetchHolidays();
    };

    const handleDeleteHoliday = async () => {
        if (!deleteModal.holiday) return;
        try {
            const targetId = deleteModal.holiday.holiday_id || deleteModal.holiday.id;
            await holidayService.deleteHolidays([targetId]);
            toast.success("Holiday deleted successfully");
            setDeleteModal({ isOpen: false, holiday: null });
            await fetchHolidays();
        } catch (err) {
            toast.error(err.message || "Failed to delete holiday");
        }
    };

    return (
        <MobileDashboardLayout title="Holidays & Leave" contentClassName="px-0 pt-0 pb-4">
            <div className="w-full bg-slate-50 dark:bg-[#0D1117] transition-colors duration-300">
                {/* STICKY TOP TAB BAR (Matching Flutter LeavePage _tabController) */}
                <div className="sticky z-20 bg-white/95 dark:bg-[#0D1117]/95 backdrop-blur-md px-2.5 sm:px-3 pt-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 w-full" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
                    <div className="bg-slate-100 dark:bg-[#161B22] p-1 flex rounded-xl border border-slate-200/70 dark:border-[#30363D] shadow-sm w-full">
                        <button
                            onClick={() => handleTabChange('holidays')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'holidays'
                                    ? 'bg-white dark:bg-[#2D3139] text-indigo-600 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <CalendarDays size={14} className={activeTab === 'holidays' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'} />
                            <span>Holidays List</span>
                        </button>

                        <button
                            onClick={() => handleTabChange('leaves')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'leaves'
                                    ? 'bg-white dark:bg-[#2D3139] text-indigo-600 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <FileText size={14} className={activeTab === 'leaves' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'} />
                            <span>{isAdmin ? 'Leave Requests' : 'Leave'}</span>
                        </button>
                    </div>
                </div>

                {/* TAB 1: HOLIDAYS LIST */}
                {activeTab === 'holidays' && (
                    <div className="w-full px-2.5 sm:px-3 pt-2.5 space-y-3 pb-6">
                        {/* SubBar: Search + (Admin) Import & Add buttons */}
                        <div className="flex items-center gap-2 w-full">
                            <div className="relative flex-1 h-9">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                <input
                                    type="text"
                                    placeholder="Search holidays..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-9 pl-9 pr-8 text-xs bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D] rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-github-dark-text placeholder:text-slate-400"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {isAdmin && (
                                <>
                                    <button
                                        onClick={() => setBulkImportModalOpen(true)}
                                        className="h-9 px-2.5 sm:px-3.5 bg-white dark:bg-[#21262D] border border-slate-200 dark:border-[#30363D] text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
                                        title="Import CSV"
                                    >
                                        <Upload size={14} />
                                        <span>Import</span>
                                    </button>
                                    <button
                                        onClick={() => setFormModal({ isOpen: true, isEdit: false, holiday: null })}
                                        className="h-9 px-3 bg-[#6366F1] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
                                    >
                                        <Plus size={15} />
                                        <span>Add</span>
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Calendar Card (Matching Flutter HolidayCalendarCard) */}
                        <HolidayCalendarCard
                            currentMonth={currentMonth}
                            selectedDate={selectedDate}
                            holidays={holidays}
                            onMonthChanged={(newMonth) => {
                                setCurrentMonth(newMonth);
                                setSelectedDate(null);
                            }}
                            onDateSelected={(date) => {
                                if (selectedDate && date.getTime() === selectedDate.getTime()) {
                                    setSelectedDate(null);
                                } else {
                                    setSelectedDate(date);
                                    if (date.getMonth() !== currentMonth.getMonth() || date.getFullYear() !== currentMonth.getFullYear()) {
                                        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                                    }
                                }
                            }}
                            onTodayPressed={() => {
                                const now = new Date();
                                setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                                setSelectedDate(now);
                            }}
                        />

                        {/* Month Grouped Holidays List (Matching Flutter _buildMainHolidayCard) */}
                        {isLoading ? (
                            <div className="py-12 flex items-center justify-center">
                                <Loader2 size={28} className="animate-spin text-indigo-600" />
                            </div>
                        ) : visibleHolidays.length === 0 ? (
                            <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200/80 dark:border-[#30363D] p-8 text-center shadow-sm">
                                <p className="text-sm font-semibold text-[#2563EB] dark:text-[#58A6FF]">
                                    {searchTerm.trim()
                                        ? `No holidays found matching '${searchTerm.trim()}'`
                                        : selectedDate
                                            ? `No holidays on ${formatPlatformDate(selectedDate.toISOString())}`
                                            : `No holidays in ${currentMonth.toLocaleDateString('en-US', { month: 'long' })}`}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(monthGroups).map(([monthYear, hList]) => (
                                    <div
                                        key={monthYear}
                                        className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200/80 dark:border-[#30363D] shadow-sm overflow-hidden"
                                    >
                                        {/* Month Heading with Indigo Pill Accent */}
                                        <div className="p-3.5 sm:p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-4 bg-[#6366F1] rounded-full" />
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                                    {monthYear}
                                                </h4>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-[#21262D] border border-slate-200 dark:border-[#30363D] text-slate-600 dark:text-slate-300">
                                                {hList.length} {hList.length === 1 ? 'Holiday' : 'Holidays'}
                                            </span>
                                        </div>

                                        <div className="border-t border-slate-100 dark:border-[#30363D]" />

                                        {/* Holiday items in month */}
                                        <div className="divide-y divide-slate-100 dark:divide-[#21262D]">
                                            {hList.map((holiday) => {
                                                const d = parseLocalDate(holiday.holiday_date);
                                                const dayNum = d.getDate();
                                                const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                                                const isPublic = (holiday.holiday_type || '').toLowerCase().includes('public') ||
                                                    (holiday.holiday_type || '').toLowerCase().includes('nh') ||
                                                    (holiday.holiday_type || '').toLowerCase().includes('national');

                                                return (
                                                    <div
                                                        key={holiday.holiday_id || holiday.id}
                                                        onClick={() => setSelectedHoliday(holiday)}
                                                        className="p-3 sm:p-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] active:scale-[0.99] transition-all cursor-pointer"
                                                    >
                                                        {/* Date Badge (Day + Weekday) */}
                                                        <div className="w-[52px] h-[52px] rounded-xl bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] flex flex-col items-center justify-center shrink-0">
                                                            <span className="text-base font-extrabold text-slate-900 dark:text-white leading-none">
                                                                {dayNum}
                                                            </span>
                                                            <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase leading-none">
                                                                {weekday}
                                                            </span>
                                                        </div>

                                                        {/* Holiday Name & Date */}
                                                        <div className="flex-1 min-w-0">
                                                            <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                                                {holiday.holiday_name}
                                                            </h5>
                                                            <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5 truncate font-medium">
                                                                {formatPlatformDate(holiday.holiday_date)}
                                                            </p>
                                                        </div>

                                                        {/* Type Chip */}
                                                        <div className="shrink-0 flex items-center gap-1.5">
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider border ${
                                                                isPublic
                                                                    ? 'bg-[#9333EA]/10 border-[#9333EA]/30 text-[#A855F7]'
                                                                    : 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#FBBF24]'
                                                            }`}>
                                                                {isPublic ? 'PUBLIC' : 'OPTIONAL'}
                                                            </span>

                                                            {/* Admin Action Buttons */}
                                                            {isAdmin && (
                                                                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                                                    <button
                                                                        onClick={() => setFormModal({ isOpen: true, isEdit: true, holiday })}
                                                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit3 size={15} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setDeleteModal({ isOpen: true, holiday })}
                                                                        className="p-1.5 text-red-400 hover:text-red-600 rounded-lg transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: LEAVE & LEAVE REQUESTS */}
                {activeTab === 'leaves' && (
                    <div className="w-full">
                        <MobileLeaveApplication isEmbedded={true} />
                    </div>
                )}

                {/* MODALS */}
                {selectedHoliday && (
                    <HolidayDetailDialog
                        holiday={selectedHoliday}
                        onClose={() => setSelectedHoliday(null)}
                    />
                )}

                {formModal.isOpen && (
                    <HolidayFormModal
                        isOpen={formModal.isOpen}
                        isEdit={formModal.isEdit}
                        initialData={formModal.holiday}
                        onClose={() => setFormModal({ isOpen: false, isEdit: false, holiday: null })}
                        onSave={handleSaveHoliday}
                    />
                )}

                {bulkImportModalOpen && (
                    <BulkHolidayImportModal
                        isOpen={bulkImportModalOpen}
                        onClose={() => setBulkImportModalOpen(false)}
                        onImportSuccess={fetchHolidays}
                    />
                )}

                {deleteModal.isOpen && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, holiday: null })} />
                        <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#161B22] rounded-2xl p-5 border border-slate-200 dark:border-[#30363D] shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                                <Trash2 size={24} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Holiday?</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">"{deleteModal.holiday?.holiday_name}"</span>?
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                    onClick={() => setDeleteModal({ isOpen: false, holiday: null })}
                                    className="py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#21262D] text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteHoliday}
                                    className="py-2.5 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MobileDashboardLayout>
    );
};

export default HolidayManagement;
