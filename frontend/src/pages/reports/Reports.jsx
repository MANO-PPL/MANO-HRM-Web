import React, { useState, useEffect, useRef } from 'react';

// ─── Module-level Attendance View Cache ────────────────────────────────────────
// Persists across re-renders and tab switches within the same browser session.
// Key: serialised query params string → Value: { data, fetchedAt }
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const attendanceViewCache = new Map();
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../components/DashboardLayout';
import {
    FileText,
    Download,
    Calendar,
    FileSpreadsheet,
    FileType,
    CheckCircle,
    AlertCircle,
    DownloadCloud,
    Eye,
    Table,
    ChevronDown,
    Search,
    User,
    Clock,
    ChevronRight,
    MapPin,
    TrendingUp,
    History,
    X,
    XCircle
} from 'lucide-react';

import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import DatePicker from '../../components/DatePicker';
import MonthPicker from '../../components/MonthPicker';
import { useTour } from '../../context/TourContext';

const PAGE_KEY = 'admin_reports';

const getAlignmentClass = (colHeader) => {
    if (!colHeader) return 'center';
    const header = colHeader.toLowerCase();
    if (['name', 'department', 'dept', 'employee', 'reason', 'location', 'in location', 'out location', 'email', 'phone', 'role', 'designation', 'position'].some(k => header.includes(k))) {
        return 'left';
    }
    return 'center';
};

const getCellStyle = (cellValue, colHeader, isTotalsRow, isEven, rowIdx) => {
    const val = cellValue?.toString().trim() || '';
    const header = colHeader.toLowerCase();

    // 1. Totals / summary row styling
    if (isTotalsRow) {
        return {
            fontWeight: '800',
            fontSize: '11px',
            color: '#1a3a5c',
            backgroundColor: '#dce8f5',
            borderTop: '2.5px solid #2563EB',
            borderBottom: '3px double #1e40af',
            borderLeft: '1px solid #bfdbfe',
            borderRight: '1px solid #bfdbfe',
            paddingTop: '9px',
            paddingBottom: '9px',
            letterSpacing: '0.01em',
        };
    }

    // Default borders - thin Excel-like grid
    const defaultBorder = '1px solid #E2E8F0';
    const baseFont = { fontSize: '11.5px', fontFamily: '"Segoe UI", Arial, sans-serif' };

    // 2. Status-based conditional formatting
    // Present
    if (val === 'Present' || val === '1.0' || val === '1') {
        return { ...baseFont, backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: '700', border: defaultBorder };
    }
    // Absent
    if (val === 'Absent' || val === '0.0' || val === '0') {
        return { ...baseFont, backgroundColor: '#FEE2E2', color: '#B91C1C', fontWeight: '700', border: defaultBorder };
    }
    // Half Day
    if (val.toLowerCase() === 'half day') {
        return { ...baseFont, backgroundColor: '#FEF9C3', color: '#854D0E', fontWeight: '700', border: defaultBorder };
    }
    // On Leave / Leave
    if (val.toLowerCase() === 'on leave' || val.toLowerCase() === 'leave') {
        return { ...baseFont, backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: '700', border: defaultBorder };
    }
    // Late
    if (val.toLowerCase().includes('late') || (header.includes('late') && Number(val) > 0)) {
        return { ...baseFont, backgroundColor: '#FFF7ED', color: '#C2410C', fontWeight: '700', border: defaultBorder };
    }
    // Weekend / Week Off
    if (val === 'Sun' || val === 'Sat' || val === 'WEEK_OFF') {
        return { ...baseFont, backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: '600', fontStyle: 'italic', border: defaultBorder };
    }
    // Not Recorded
    if (val === 'Not Recorded' || val === '-' || val === '') {
        return { ...baseFont, backgroundColor: '#F8FAFC', color: '#94A3B8', fontWeight: '500', border: defaultBorder };
    }
    // Numeric columns – overtime, salary, counts
    if ((header.includes('salary') || header.includes('pay') || header.includes('amount') || header.includes('₹')) && val.includes('₹')) {
        return { ...baseFont, backgroundColor: isEven ? '#F0FDF4' : '#FFFFFF', color: '#065F46', fontWeight: '700', border: defaultBorder };
    }
    // Overtime hours
    if (header.includes('overtime') || header.includes('ot') && Number(val) > 0) {
        return { ...baseFont, backgroundColor: '#F5F3FF', color: '#6D28D9', fontWeight: '700', border: defaultBorder };
    }
    // Numeric count > 0 with green tint for present-like columns
    if (header.includes('present') && !isNaN(Number(val)) && Number(val) > 0) {
        return { ...baseFont, backgroundColor: '#F0FDF4', color: '#166534', fontWeight: '700', border: defaultBorder };
    }
    if (header.includes('absent') && !isNaN(Number(val)) && Number(val) > 0) {
        return { ...baseFont, backgroundColor: '#FFF1F2', color: '#9F1239', fontWeight: '700', border: defaultBorder };
    }

    // Default: clean alternating rows like Excel
    return {
        ...baseFont,
        backgroundColor: isEven ? '#F8FAFD' : '#FFFFFF',
        color: '#1E293B',
        border: defaultBorder,
        fontWeight: header.includes('name') || header.includes('employee') ? '600' : '400',
    };
};

const getWeeksOfMonth = (monthStr) => {
    if (!monthStr) return [];
    const [year, monthNum] = monthStr.split('-').map(Number);
    const weeks = [];
    const firstDate = new Date(year, monthNum - 1, 1);
    const lastDate = new Date(year, monthNum, 0);

    let currentStart = new Date(firstDate);
    while (currentStart <= lastDate) {
        let currentEnd = new Date(currentStart);
        const dayOfWeek = currentStart.getDay(); // 0 is Sunday, 1 is Monday...
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        currentEnd.setDate(currentStart.getDate() + daysToSunday);

        if (currentEnd > lastDate) {
            currentEnd = new Date(lastDate);
        }

        const weekLabel = `Week ${weeks.length + 1} (${currentStart.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} - ${currentEnd.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })})`;
        const startVal = currentStart.toISOString().slice(0, 10);
        weeks.push({ label: weekLabel, value: startVal });

        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
    }
    return weeks;
};

const isDateColumn = (colName) => {
    const cleanName = colName?.toString().trim() || '';
    return /^\d+/.test(cleanName) || ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].some(m => cleanName.toLowerCase().includes(m));
};

const getEmployeeCardData = (row, columns) => {
    let name = 'Unknown Employee';
    let dept = '';
    let designation = '';
    let status = '';
    const metrics = [];
    const dates = [];

    columns.forEach((col, idx) => {
        const val = row[idx]?.toString() || '';
        const colStr = col?.toString() || '';
        const colLower = colStr.toLowerCase();

        if (colLower === 'sr no.' || colLower === 'sr. no.') {
            return;
        }

        if (colLower === 'name' || colLower === 'employee') {
            name = val;
        } else if (colLower === 'department' || colLower === 'dept') {
            dept = val;
        } else if (colLower === 'position' || colLower === 'designation' || colLower === 'role') {
            designation = val;
        } else if (colLower === 'status' || colLower === 'attendance') {
            status = val;
        } else if (isDateColumn(colStr)) {
            dates.push({ label: colStr, value: val });
        } else {
            metrics.push({ label: colStr, value: val });
        }
    });

    return { name, dept, designation, status, metrics, dates };
};

const groupDatesByPrefix = (dates) => {
    const groups = {};
    dates.forEach(d => {
        const parts = d.label.split('\n');
        const prefix = parts[0];
        const label = parts[1] || 'Status';
        if (!groups[prefix]) {
            groups[prefix] = {};
        }
        groups[prefix][label] = d.value;
    });
    return groups;
};

const EmployeeCard = ({ row, columns }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const { name, dept, designation, status, metrics, dates } = getEmployeeCardData(row, columns);
    const dateGroups = groupDatesByPrefix(dates);
    const keys = Object.keys(dateGroups);
    const isTimelineOnly = keys.every(k => Object.keys(dateGroups[k]).length === 1 && Object.keys(dateGroups[k])[0] === 'Status');

    const initials = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    let statusColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    if (status.includes('Present') || status === '1.0') {
        statusColor = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400';
    } else if (status.includes('Absent') || status === '0.0') {
        statusColor = 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400';
    } else if (status.toLowerCase().includes('late')) {
        statusColor = 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400';
    } else if (status.toLowerCase() === 'on leave' || status.toLowerCase() === 'leave' || status.toLowerCase() === 'half day') {
        statusColor = 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400';
    }

    return (
        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-sm shadow-inner">
                        {initials || <User size={16} />}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-sm leading-tight">{name}</h4>
                        <p className="text-[11px] font-medium text-slate-400 dark:text-github-dark-muted mt-0.5">
                            {designation ? `${designation} • ` : ''}{dept}
                        </p>
                    </div>
                </div>
                {status && (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColor}`}>
                        {status}
                    </span>
                )}
            </div>

            {metrics.length > 0 && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-github-dark-bg/60 p-3 rounded-xl">
                    {metrics.map((m, idx) => (
                        <div key={idx} className="space-y-0.5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-github-dark-muted block">
                                {m.label}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 dark:text-github-dark-text block truncate" title={m.value}>
                                {m.value || '-'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {keys.length > 0 && isTimelineOnly && (
                <div className="pt-1">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-github-dark-muted mb-2 px-1">
                        Attendance Timeline
                    </h5>
                    <div className="flex flex-wrap gap-1 bg-slate-50/50 dark:bg-black/10 p-2 rounded-xl">
                        {keys.map((dateKey) => {
                            const info = dateGroups[dateKey];
                            const statusVal = info.Status || '';
                            const dayMatch = dateKey.match(/^\d+/);
                            const dayDisplay = dayMatch ? dayMatch[0] : dateKey;

                            let colorClass = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700';
                            if (statusVal === '1.0' || statusVal === 'Present') {
                                colorClass = 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                            } else if (statusVal === '0.0' || statusVal === 'Absent') {
                                colorClass = 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-500/20';
                            } else if (statusVal.toLowerCase().includes('late')) {
                                colorClass = 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-500/20';
                            } else if (statusVal.toLowerCase() === 'on leave' || statusVal.toLowerCase() === 'leave' || statusVal.toLowerCase() === 'half day') {
                                colorClass = 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
                            } else if (statusVal === 'Sun' || statusVal === 'Sat' || statusVal === 'WEEK_OFF') {
                                colorClass = 'bg-slate-100 dark:bg-slate-800/45 text-slate-400 border border-slate-200 dark:border-slate-700/50';
                            } else if (statusVal === 'Not Recorded') {
                                colorClass = 'bg-slate-100/50 dark:bg-slate-800/20 text-slate-400/60 border border-slate-200/50 dark:border-slate-700/30 opacity-60';
                            }

                            return (
                                <div
                                    key={dateKey}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold cursor-help transition-all hover:scale-105 shadow-sm ${colorClass}`}
                                    title={`${dateKey}: ${statusVal}`}
                                >
                                    {dayDisplay}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {keys.length > 0 && !isTimelineOnly && (
                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full py-2 px-3 border border-slate-200 dark:border-github-dark-border hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
                    >
                        <span>{isExpanded ? 'Hide Daily Details' : 'View Daily Details'}</span>
                        <ChevronDown size={14} className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                        <div className="mt-3.5 space-y-2 max-h-60 overflow-y-auto pr-1 no-scrollbar border-t border-slate-100 dark:border-github-dark-border pt-3">
                            {keys.map((dateKey) => {
                                const info = dateGroups[dateKey];
                                const hasPunch = info['In Time'] && info['In Time'] !== '-';

                                return (
                                    <div key={dateKey} className="bg-slate-50 dark:bg-[#161b22] border border-slate-100 dark:border-[#30363d] p-3 rounded-xl space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{dateKey}</span>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${hasPunch
                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                {hasPunch ? 'Clocked In' : 'No Punch'}
                                            </span>
                                        </div>
                                        {hasPunch ? (
                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                <div>
                                                    <span className="text-slate-400 font-medium block">In / Out:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text block">
                                                        {info['In Time']} - {info['Out Time'] || '-'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 font-medium block">Worked / Req:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text block">
                                                        {info['Work Hrs'] || '-'} / {info['Req Hrs'] || '-'} hrs
                                                    </span>
                                                </div>
                                                {info['Late Mins'] && info['Late Mins'] !== '0' && (
                                                    <div className="col-span-2">
                                                        <span className="text-amber-500 font-semibold">
                                                            Late: {info['Late Mins']} mins
                                                        </span>
                                                    </div>
                                                )}
                                                {(info['In Location'] || info['Out Location']) && (
                                                    <div className="col-span-2 text-slate-500 dark:text-github-dark-muted flex items-start gap-1">
                                                        <MapPin size={10} className="shrink-0 mt-0.5 text-slate-400" />
                                                        <span className="truncate">
                                                            {info['In Location'] || '-'} (In) / {info['Out Location'] || '-'} (Out)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-slate-400 italic">
                                                Non-working day or absent
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const getStatusColor = (status) => {
    const s = status || '';
    if (!s || s === '-' || s === 'Not Recorded') return 'bg-slate-50 text-slate-300 dark:bg-slate-900/50 dark:text-slate-700 border border-slate-200 dark:border-slate-800 opacity-60';
    if (s === 'Present' || s.includes('Present')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50';
    if (s === 'Absent') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800/50';
    if (s.toLowerCase().includes('late') && s.toLowerCase().includes('overtime')) return 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800/50';
    if (s.toLowerCase().includes('late')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50';
    if (s.toLowerCase().includes('overtime')) return 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-800/50';
    if (s === 'Sun' || s === 'Sat' || s === 'WEEK_OFF') return 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500';
    if (s.toLowerCase() === 'on leave') return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800/50';
    if (s.toLowerCase() === 'half day') return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800/50';
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
};

const getStatusLabel = (status) => {
    const s = status || '';
    if (!s || s === '-' || s === 'Not Recorded') return '·';
    if (s === 'Present') return 'P';
    if (s === 'Absent') return 'A';
    if (s === 'Sun') return 'Su';
    if (s === 'Sat') return 'Sa';
    if (s === 'WEEK_OFF') return 'WO';
    if (s.toLowerCase() === 'on leave') return 'L';
    if (s.toLowerCase() === 'half day') return 'HD';
    if (s.toLowerCase().includes('late') && s.toLowerCase().includes('overtime')) return 'LO';
    if (s.toLowerCase().includes('late')) return 'Lt';
    if (s.toLowerCase().includes('overtime')) return 'OT';
    return s.slice(0, 2);
};

const Reports = () => {

    const navigate = useNavigate();
    const { startTour, hasSeenPage, wasSkippedThisSession, tourEnabled } = useTour();

    const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
    const [attendanceEmployeeId, setAttendanceEmployeeId] = useState('');
    const [attendanceWeek, setAttendanceWeek] = useState('');
    const [attendanceReportType, setAttendanceReportType] = useState('matrix_monthly');
    const [attendanceIsEmpDropdownOpen, setAttendanceIsEmpDropdownOpen] = useState(false);
    const [attendanceEmpSearchQuery, setAttendanceEmpSearchQuery] = useState('');
    const [attendanceIsWeekDropdownOpen, setAttendanceIsWeekDropdownOpen] = useState(false);

    // Full Report Filters State
    const [tableMonth, setTableMonth] = useState(new Date().toISOString().slice(0, 7));
    const [tableDate, setTableDate] = useState(new Date().toISOString().slice(0, 10));
    const [tableEmployeeId, setTableEmployeeId] = useState('');
    const [tableWeek, setTableWeek] = useState('');
    const [tableReportType, setTableReportType] = useState('matrix_monthly');
    const [tableUseCustomRange, setTableUseCustomRange] = useState(false);
    const [tableCustomStartDate, setTableCustomStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [tableCustomEndDate, setTableCustomEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [tableExportColumns, setTableExportColumns] = useState({
        timeIn: true,
        timeOut: true,
        status: true,
        workedHours: true,
        requiredHours: false,
        late: false,
        location: false,
        attendanceDays: true
    });
    const [tableFileFormat, setTableFileFormat] = useState('xlsx');
    const [tableIsEmpDropdownOpen, setTableIsEmpDropdownOpen] = useState(false);
    const [tableEmpSearchQuery, setTableEmpSearchQuery] = useState('');
    const [tableIsTypeDropdownOpen, setTableIsTypeDropdownOpen] = useState(false);
    const [tableIsWeekDropdownOpen, setTableIsWeekDropdownOpen] = useState(false);
    const [tableIsColsDropdownOpen, setTableIsColsDropdownOpen] = useState(false);

    const [isGenerating, setIsGenerating] = useState(false);
    const [previewMode, setPreviewMode] = useState('card'); // 'card' | 'table'
    const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [isDetailSidebarOpen, setIsDetailSidebarOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [hoveredRecord, setHoveredRecord] = useState(null);
    const [hoveredPosition, setHoveredPosition] = useState({ top: 0, left: 0 });

    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);

    // Department states
    const [attendanceDeptId, setAttendanceDeptId] = useState('');
    const [attendanceDeptSearchQuery, setAttendanceDeptSearchQuery] = useState('');
    const [attendanceIsDeptDropdownOpen, setAttendanceIsDeptDropdownOpen] = useState(false);

    const [tableDeptId, setTableDeptId] = useState('');
    const [tableDeptSearchQuery, setTableDeptSearchQuery] = useState('');
    const [tableIsDeptDropdownOpen, setTableIsDeptDropdownOpen] = useState(false);

    // Designation states
    const [attendanceDesgId, setAttendanceDesgId] = useState('');
    const [attendanceDesgSearchQuery, setAttendanceDesgSearchQuery] = useState('');
    const [attendanceIsDesgDropdownOpen, setAttendanceIsDesgDropdownOpen] = useState(false);

    const [tableDesgId, setTableDesgId] = useState('');
    const [tableDesgSearchQuery, setTableDesgSearchQuery] = useState('');
    const [tableIsDesgDropdownOpen, setTableIsDesgDropdownOpen] = useState(false);

    const attendanceEmpDropdownRef = React.useRef(null);
    const attendanceWeekDropdownRef = React.useRef(null);
    const attendanceDeptDropdownRef = React.useRef(null);
    const attendanceDesgDropdownRef = React.useRef(null);
    const tableEmpDropdownRef = React.useRef(null);
    const tableTypeDropdownRef = React.useRef(null);
    const tableWeekDropdownRef = React.useRef(null);
    const tableColsDropdownRef = React.useRef(null);
    const tableDeptDropdownRef = React.useRef(null);
    const tableDesgDropdownRef = React.useRef(null);

    const tourSteps = React.useMemo(() => [
        {
            targetId: 'reports-attendance-view-tab',
            title: 'Attendance View',
            description: 'Switch to the Attendance View to display an interactive matrix showing a visual summary of daily attendance, leaves, and shift statuses.',
            action: () => setPreviewMode('card')
        },
        {
            targetId: 'reports-filters',
            title: 'Data Filters',
            description: 'Filter your report by date range, department, and specific employees.',
            action: () => setPreviewMode('card')
        },
        {
            targetId: 'reports-full-report-tab',
            title: 'Full Report',
            description: 'Switch to the Full Report tab to configure, generate, and export detailed reports for all activities, including Attendance, Daily Activity Reports (DAR), and Leaves in CSV or Excel format.',
            action: () => setPreviewMode('table')
        }
    ], [setPreviewMode]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (attendanceEmpDropdownRef.current && !attendanceEmpDropdownRef.current.contains(event.target)) {
                setAttendanceIsEmpDropdownOpen(false);
            }
            if (attendanceWeekDropdownRef.current && !attendanceWeekDropdownRef.current.contains(event.target)) {
                setAttendanceIsWeekDropdownOpen(false);
            }
            if (attendanceDeptDropdownRef.current && !attendanceDeptDropdownRef.current.contains(event.target)) {
                setAttendanceIsDeptDropdownOpen(false);
            }
            if (attendanceDesgDropdownRef.current && !attendanceDesgDropdownRef.current.contains(event.target)) {
                setAttendanceIsDesgDropdownOpen(false);
            }
            if (tableEmpDropdownRef.current && !tableEmpDropdownRef.current.contains(event.target)) {
                setTableIsEmpDropdownOpen(false);
            }
            if (tableTypeDropdownRef.current && !tableTypeDropdownRef.current.contains(event.target)) {
                setTableIsTypeDropdownOpen(false);
            }
            if (tableWeekDropdownRef.current && !tableWeekDropdownRef.current.contains(event.target)) {
                setTableIsWeekDropdownOpen(false);
            }
            if (tableColsDropdownRef.current && !tableColsDropdownRef.current.contains(event.target)) {
                setTableIsColsDropdownOpen(false);
            }
            if (tableDeptDropdownRef.current && !tableDeptDropdownRef.current.contains(event.target)) {
                setTableIsDeptDropdownOpen(false);
            }
            if (tableDesgDropdownRef.current && !tableDesgDropdownRef.current.contains(event.target)) {
                setTableIsDesgDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const attendanceSelectedEmployeeName = employees.find(emp => emp.user_id === attendanceEmployeeId)?.user_name || 'All Employees';
    const attendanceFilteredEmployees = employees.filter(emp => {
        const matchesDept = !attendanceDeptId || String(emp.dept_id) === String(attendanceDeptId);
        const matchesDesg = !attendanceDesgId || String(emp.desg_id) === String(attendanceDesgId);
        const matchesQuery = emp.user_name.toLowerCase().includes(attendanceEmpSearchQuery.toLowerCase());
        return matchesDept && matchesDesg && matchesQuery;
    });

    const tableSelectedEmployeeName = employees.find(emp => emp.user_id === tableEmployeeId)?.user_name || 'All Employees';
    const tableFilteredEmployees = employees.filter(emp => {
        const matchesDept = !tableDeptId || String(emp.dept_id) === String(tableDeptId);
        const matchesDesg = !tableDesgId || String(emp.desg_id) === String(tableDesgId);
        const matchesQuery = emp.user_name.toLowerCase().includes(tableEmpSearchQuery.toLowerCase());
        return matchesDept && matchesDesg && matchesQuery;
    });

    const attendanceWeeks = React.useMemo(() => getWeeksOfMonth(attendanceMonth), [attendanceMonth]);
    const tableWeeks = React.useMemo(() => getWeeksOfMonth(tableMonth), [tableMonth]);

    useEffect(() => {
        if (attendanceWeeks.length > 0) {
            setAttendanceWeek(attendanceWeeks[0].value);
        }
    }, [attendanceWeeks]);

    useEffect(() => {
        if (tableWeeks.length > 0) {
            setTableWeek(tableWeeks[0].value);
        }
    }, [tableWeeks]);

    useEffect(() => {
        if (attendanceEmployeeId) {
            const emp = employees.find(e => e.user_id === attendanceEmployeeId);
            if (emp) {
                const deptMismatch = attendanceDeptId && String(emp.dept_id) !== String(attendanceDeptId);
                const desgMismatch = attendanceDesgId && String(emp.desg_id) !== String(attendanceDesgId);
                if (deptMismatch || desgMismatch) {
                    setAttendanceEmployeeId('');
                }
            }
        }
    }, [attendanceDeptId, attendanceDesgId, employees, attendanceEmployeeId]);

    useEffect(() => {
        if (tableEmployeeId) {
            const emp = employees.find(e => e.user_id === tableEmployeeId);
            if (emp) {
                const deptMismatch = tableDeptId && String(emp.dept_id) !== String(tableDeptId);
                const desgMismatch = tableDesgId && String(emp.desg_id) !== String(tableDesgId);
                if (deptMismatch || desgMismatch) {
                    setTableEmployeeId('');
                }
            }
        }
    }, [tableDeptId, tableDesgId, employees, tableEmployeeId]);

    useEffect(() => {
        const fetchEmployeesAndDepts = async () => {
            try {
                const [empRes, deptRes, desgRes] = await Promise.all([
                    adminService.getAllUsers(),
                    adminService.getDepartments(),
                    adminService.getDesignations()
                ]);
                if (empRes.success && empRes.users) {
                    const sorted = [...empRes.users].sort((a, b) => a.user_name.localeCompare(b.user_name));
                    setEmployees(sorted);
                }
                if (deptRes && deptRes.departments) {
                    const sortedDepts = [...deptRes.departments].sort((a, b) => a.dept_name.localeCompare(b.dept_name));
                    setDepartments(sortedDepts);
                }
                if (desgRes && desgRes.designations) {
                    const sortedDesgs = [...desgRes.designations].sort((a, b) => a.desg_name.localeCompare(b.desg_name));
                    setDesignations(sortedDesgs);
                }
            } catch (err) {
                console.error("Failed to load filter metadata", err);
            }
        };
        fetchEmployeesAndDepts();
    }, []);



    React.useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: 'preview' }
        }));
    }, []);


    // Export History with Persistence
    const [exportHistory, setExportHistory] = useState(() => {
        const savedHistory = localStorage.getItem('attendance_export_history');
        return savedHistory ? JSON.parse(savedHistory) : [];
    });

    // Save history to localStorage whenever it changes
    React.useEffect(() => {
        localStorage.setItem('attendance_export_history', JSON.stringify(exportHistory));
    }, [exportHistory]);

    // Real Preview Data State
    const [previewData, setPreviewData] = useState({ columns: [], rows: [] });
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [cacheHit, setCacheHit] = useState(false); // true when currently showing cached data
    const bgRefreshTimerRef = useRef(null);

    // Compute activeFilters based on previewMode (card vs table)
    const activeFilters = React.useMemo(() => {
        const isCard = previewMode === 'card';
        const rType = isCard ? attendanceReportType : tableReportType;
        const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(rType);
        
        const selectedMonth = isCard ? attendanceMonth : tableMonth;
        const selectedDate = isCard ? attendanceDate : tableDate;
        const selectedWeek = isCard ? attendanceWeek : tableWeek;
        const selectedEmployeeId = isCard ? attendanceEmployeeId : tableEmployeeId;
        const selectedDeptId = isCard ? attendanceDeptId : tableDeptId;
        const selectedDesgId = isCard ? attendanceDesgId : tableDesgId;
        const useCustomRange = isCard ? false : tableUseCustomRange;
        const customStartDate = isCard ? '' : tableCustomStartDate;
        const customEndDate = isCard ? '' : tableCustomEndDate;
        const exportColumnsObj = isCard ? {
            timeIn: true,
            timeOut: true,
            status: true,
            workedHours: true,
            requiredHours: true,
            late: true,
            location: true,
            attendanceDays: true
        } : tableExportColumns;

        const dateToUse = (isWeekly && !useCustomRange) ? selectedWeek : selectedDate;
        const qStart = useCustomRange ? customStartDate : '';
        const qEnd = useCustomRange ? customEndDate : '';
        const exportColumnsKey = JSON.stringify(exportColumnsObj);

        return {
            reportType: rType,
            selectedMonth,
            selectedDate,
            selectedWeek,
            selectedEmployeeId,
            selectedDeptId,
            selectedDesgId,
            useCustomRange,
            customStartDate,
            customEndDate,
            exportColumnsKey,
            dateToUse,
            qStart,
            qEnd
        };
    }, [
        previewMode,
        attendanceReportType, attendanceMonth, attendanceDate, attendanceWeek, attendanceEmployeeId, attendanceDeptId, attendanceDesgId,
        tableReportType, tableMonth, tableDate, tableWeek, tableEmployeeId, tableDeptId, tableDesgId, tableUseCustomRange, tableCustomStartDate, tableCustomEndDate, tableExportColumns
    ]);

    // Build a stable cache key from activeFilters
    const cacheKey = React.useMemo(() => {
        return JSON.stringify({
            selectedMonth: activeFilters.selectedMonth,
            reportType: activeFilters.reportType,
            dateToUse: activeFilters.dateToUse,
            selectedEmployeeId: activeFilters.selectedEmployeeId,
            selectedDeptId: activeFilters.selectedDeptId,
            selectedDesgId: activeFilters.selectedDesgId,
            useCustomRange: activeFilters.useCustomRange,
            customStartDate: activeFilters.customStartDate,
            customEndDate: activeFilters.customEndDate,
            exportColumnsKey: activeFilters.exportColumnsKey
        });
    }, [activeFilters]);

    const fetchAndCachePreview = React.useCallback(async ({ key, cancelled, showLoadingIfNoCache }) => {
        // Show loading spinner only if there's no cached data to display
        if (showLoadingIfNoCache) setLoadingPreview(true);

        try {
            const res = await adminService.getReportPreview(
                activeFilters.selectedMonth,
                activeFilters.reportType,
                activeFilters.dateToUse,
                activeFilters.selectedEmployeeId,
                activeFilters.qStart,
                activeFilters.qEnd,
                activeFilters.exportColumnsKey,
                activeFilters.selectedDeptId,
                activeFilters.selectedDesgId
            );
            if (!cancelled && res.ok) {
                attendanceViewCache.set(key, { data: res.data, fetchedAt: Date.now() });
                setPreviewData(res.data);
                setCacheHit(false);
            }
        } catch (error) {
            if (!cancelled) {
                console.error('fetchPreview failed:', error);
                toast.error('Failed to load preview data');
            }
        } finally {
            if (!cancelled) setLoadingPreview(false);
        }
    }, [activeFilters]);

    // Reset hover and detail states when active filter settings or view modes change
    React.useEffect(() => {
        setHoveredRecord(null);
        setSelectedRecord(null);
        setIsDetailSidebarOpen(false);
    }, [
        attendanceDeptId,
        attendanceDesgId,
        attendanceMonth,
        attendanceDate,
        attendanceWeek,
        attendanceEmployeeId,
        attendanceReportType,
        tableDeptId,
        tableDesgId,
        tableMonth,
        tableDate,
        tableWeek,
        tableEmployeeId,
        tableReportType,
        tableUseCustomRange,
        tableCustomStartDate,
        tableCustomEndDate,
        previewMode
    ]);

    // Clear hover record if loading starts
    React.useEffect(() => {
        if (loadingPreview) {
            setHoveredRecord(null);
        }
    }, [loadingPreview]);

    React.useEffect(() => {
        let cancelled = false;

        const cached = attendanceViewCache.get(cacheKey);
        const now = Date.now();
        const isStale = !cached || (now - cached.fetchedAt) >= CACHE_TTL_MS;

        if (cached) {
            // Serve cache immediately
            setPreviewData(cached.data);
            setCacheHit(true);
            setLoadingPreview(false);
        }

        if (isStale) {
            // Fetch fresh data in background (no spinner if cache was served)
            fetchAndCachePreview({ key: cacheKey, cancelled, showLoadingIfNoCache: !cached });
        }

        return () => { cancelled = true; };
    }, [cacheKey, fetchAndCachePreview]);

    // ── Background refresh every 15 minutes ──────────────────────────────────
    React.useEffect(() => {
        if (bgRefreshTimerRef.current) clearInterval(bgRefreshTimerRef.current);

        bgRefreshTimerRef.current = setInterval(() => {
            let cancelled = false;
            // Invalidate the current cache entry so next call fetches fresh
            attendanceViewCache.delete(cacheKey);
            fetchAndCachePreview({ key: cacheKey, cancelled, showLoadingIfNoCache: false });
        }, CACHE_TTL_MS);

        return () => {
            if (bgRefreshTimerRef.current) clearInterval(bgRefreshTimerRef.current);
        };
    }, [cacheKey, fetchAndCachePreview]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(tableReportType);
            const dateToUse = (isWeekly && !tableUseCustomRange) ? tableWeek : tableDate;

            const qStart = tableUseCustomRange ? tableCustomStartDate : "";
            const qEnd = tableUseCustomRange ? tableCustomEndDate : "";

            const res = await adminService.queueReport(
                tableMonth,
                tableReportType,
                tableFileFormat,
                tableEmployeeId,
                dateToUse,
                qStart,
                qEnd,
                JSON.stringify(tableExportColumns),
                tableDeptId,
                tableDesgId
            );
            if (res.ok) {
                const reportId = res.reportId;
                const filename = `Report_${tableReportType}_${tableUseCustomRange ? `${tableCustomStartDate}_to_${tableCustomEndDate}` : (tableMonth || dateToUse)}.${tableFileFormat}`;
                const reportTypeLabel = tableReportType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                const newReport = {
                    id: reportId || Date.now().toString(),
                    reportId: reportId,
                    name: filename,
                    type: reportTypeLabel,
                    date: new Date().toLocaleString(),
                    status: 'Generating',
                    size: 'Pending'
                };
                setExportHistory(prev => [newReport, ...prev]);
                toast.info("Report is compiling in the background! Track it in Export History.");
            }

        } catch (error) {
            toast.error(error.message || "Failed to generate report");
        } finally {
            setIsGenerating(false);
        }
    };

    // Poll status of generating reports in history
    useEffect(() => {
        const generatingReports = exportHistory.filter(item => item.status === 'Generating');
        if (generatingReports.length === 0) return;

        const interval = setInterval(async () => {
            let updated = false;
            const nextHistory = await Promise.all(exportHistory.map(async (item) => {
                if (item.status === 'Generating' && item.reportId) {
                    try {
                        const res = await adminService.getReportStatus(item.reportId);
                        if (res.ok && res.data) {
                            const { status, file_url, error_message } = res.data;
                            if (status === 'completed') {
                                updated = true;
                                toast.success(`Report Ready: ${item.type} has compiled successfully.`);
                                // Trigger automatic download in background
                                const link = document.createElement('a');
                                link.href = file_url;
                                link.setAttribute('download', item.name);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                return {
                                    ...item,
                                    status: 'Ready',
                                    file_url,
                                    size: 'S3 Link'
                                };
                            } else if (status === 'failed') {
                                updated = true;
                                toast.error(`Report Failed: ${error_message || 'Compilation failed'}`);
                                return {
                                    ...item,
                                    status: 'Failed',
                                    size: 'Error'
                                };
                            }
                        }
                    } catch (err) {
                        console.error("Failed to poll status for report", item.reportId, err);
                    }
                }
                return item;
            }));

            if (updated) {
                setExportHistory(nextHistory);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [exportHistory]);

    const reportTypeOptions = [
        { value: 'attendance_matrix_daily', label: 'Daily Attendance Matrix' },
        { value: 'matrix_daily', label: 'Daily Attendance Report' },
        { value: 'employee_master', label: 'Employee Master Data' },
        { value: 'attendance_matrix_monthly', label: 'Monthly Attendance Matrix' },
        { value: 'matrix_monthly', label: 'Monthly Attendance Report' },
        { value: 'attendance_summary', label: 'Monthly Summary Report' },
        { value: 'attendance_matrix_weekly', label: 'Weekly Attendance Matrix' },
        { value: 'matrix_weekly', label: 'Weekly Attendance Report' }
    ];

    const selectedReportTypeLabel = reportTypeOptions.find(opt => opt.value === activeFilters.reportType)?.label || activeFilters.reportType;
    const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(activeFilters.reportType);

    const stats = React.useMemo(() => {
        if (!previewData || !previewData.rows || previewData.rows.length === 0) {
            return { total: 0, avgHrs: 0, presentRate: null, lateCount: null };
        }

        const dataRows = previewData.rows.filter(row => {
            const firstCell = row[0]?.toString().toUpperCase();
            return firstCell !== 'TOTALS' && firstCell !== 'TOTAL';
        });

        const total = dataRows.length;
        if (total === 0) return { total: 0, avgHrs: 0, presentRate: null, lateCount: null };

        let sumHrs = 0;
        let hrsCount = 0;
        let presentCount = 0;
        let hasPresentMetric = false;
        let lateCount = 0;
        let hasLateMetric = false;

        const columns = previewData.columns || [];
        const workHrsIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl.includes('work hrs') || cl.includes('worked hours') || cl.includes('total hrs') || cl.includes('total hours');
        });

        const presentIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl === 'present' || cl === 'present days' || cl === 'attendance';
        });

        const statusIdx = columns.findIndex(c => (c?.toString().toLowerCase() || '') === 'status');

        const lateIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl.includes('late');
        });

        dataRows.forEach(row => {
            if (workHrsIdx !== -1) {
                const val = parseFloat(row[workHrsIdx]);
                if (!isNaN(val)) {
                    sumHrs += val;
                    hrsCount++;
                }
            }

            if (presentIdx !== -1) {
                hasPresentMetric = true;
                const val = row[presentIdx]?.toString().trim();
                if (val === '1.0' || val === '1' || val.toLowerCase() === 'present' || Number(val) > 0) {
                    presentCount++;
                }
            } else if (statusIdx !== -1) {
                hasPresentMetric = true;
                const val = row[statusIdx]?.toString().trim().toLowerCase() || '';
                if (val.includes('present') || val.includes('late') || val.includes('overtime') || val === '1.0' || val === '1') {
                    presentCount++;
                }
            }

            if (lateIdx !== -1) {
                hasLateMetric = true;
                const val = row[lateIdx]?.toString().trim();
                const valNum = parseFloat(val);
                if ((!isNaN(valNum) && valNum > 0) || val.toLowerCase().includes('late') || (val !== '-' && val !== '0' && val !== '0.0' && val !== '')) {
                    lateCount++;
                }
            }
        });

        const avgHrs = hrsCount > 0 ? (sumHrs / hrsCount).toFixed(2) : '0.00';
        const presentRate = hasPresentMetric ? Math.round((presentCount / total) * 100) : null;

        return {
            total,
            avgHrs,
            presentRate,
            lateCount: hasLateMetric ? lateCount : null
        };
    }, [previewData]);

    const reportsSummary = React.useMemo(() => {
        const summary = {
            present: 0,
            absent: 0,
            leave: 0,
            halfDay: 0,
            overtime: 0,
            hasData: false
        };

        if (!previewData || !previewData.rows || previewData.rows.length === 0) {
            return summary;
        }

        // 1. If we have cardRecords, we can calculate from daily records directly
        if (previewData.cardRecords && previewData.cardRecords.length > 0) {
            summary.hasData = true;
            previewData.cardRecords.forEach(record => {
                const status = record.status || '';
                const statusLower = status.toLowerCase();

                if (status === 'Present' || statusLower.includes('present')) {
                    summary.present += 1;
                } else if (status === 'Absent' || statusLower.includes('absent')) {
                    summary.absent += 1;
                } else if (statusLower === 'on leave' || statusLower === 'leave') {
                    summary.leave += 1;
                } else if (statusLower === 'half day') {
                    summary.halfDay += 1;
                } else if (statusLower.includes('late') || statusLower.includes('overtime')) {
                    summary.present += 1; // late/overtime counts as present
                }

                const otHrs = parseFloat(record.overtime_hours);
                if (!isNaN(otHrs) && otHrs > 0) {
                    summary.overtime += otHrs;
                }
            });
            return summary;
        }

        // 2. Otherwise, parse spreadsheet columns
        const columns = previewData.columns || [];
        const rows = previewData.rows || [];

        const dataRows = rows.filter(row => {
            const firstCell = row[0]?.toString().toUpperCase();
            return firstCell !== 'TOTALS' && firstCell !== 'TOTAL';
        });

        if (dataRows.length === 0) return summary;

        // Find indices of relevant columns
        const presentIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl === 'present' || cl === 'present days';
        });
        const absentIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl === 'absent' || cl === 'absent days';
        });
        const leaveIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl === 'on leave' || cl === 'leave' || cl === 'leave days';
        });
        const halfDayIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl === 'half day' || cl === 'half days';
        });
        const overtimeIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl.includes('overtime') || cl === 'ot' || cl === 'ot hrs';
        });
        const statusIdx = columns.findIndex(c => (c?.toString().toLowerCase() || '') === 'status');

        if (presentIdx !== -1 || absentIdx !== -1 || leaveIdx !== -1 || halfDayIdx !== -1 || overtimeIdx !== -1) {
            summary.hasData = true;
            dataRows.forEach(row => {
                if (presentIdx !== -1) summary.present += parseInt(row[presentIdx]) || 0;
                if (absentIdx !== -1) summary.absent += parseInt(row[absentIdx]) || 0;
                if (leaveIdx !== -1) summary.leave += parseInt(row[leaveIdx]) || 0;
                if (halfDayIdx !== -1) summary.halfDay += parseInt(row[halfDayIdx]) || 0;
                if (overtimeIdx !== -1) summary.overtime += parseFloat(row[overtimeIdx]) || 0;
            });
        } else if (statusIdx !== -1) {
            summary.hasData = true;
            dataRows.forEach(row => {
                const status = row[statusIdx]?.toString() || '';
                const statusLower = status.toLowerCase();

                if (status === 'Present' || statusLower.includes('present')) {
                    summary.present += 1;
                } else if (status === 'Absent' || statusLower.includes('absent')) {
                    summary.absent += 1;
                } else if (statusLower === 'on leave' || statusLower === 'leave') {
                    summary.leave += 1;
                } else if (statusLower === 'half day') {
                    summary.halfDay += 1;
                } else if (statusLower.includes('late') || statusLower.includes('overtime')) {
                    summary.present += 1;
                }
            });
        }

        return summary;
    }, [previewData]);

    const matrixData = React.useMemo(() => {
        if (!previewData.cardRecords || previewData.cardRecords.length === 0) {
            return { employees: [], dates: [] };
        }
        const empMap = new Map();
        const dateSet = new Set();
        previewData.cardRecords.forEach(record => {
            if (!empMap.has(record.user_id)) {
                empMap.set(record.user_id, {
                    user_id: record.user_id,
                    user_name: record.user_name,
                    designation: record.designation,
                    department: record.department,
                    records: {}
                });
            }
            empMap.get(record.user_id).records[record.rawDate] = record;
            dateSet.add(record.rawDate);
        });
        const dates = Array.from(dateSet).sort();
        const employees = Array.from(empMap.values());

        // Calculate aggregate statistics for each employee based on the dates displayed
        employees.forEach(emp => {
            const stats = {
                present: 0,
                absent: 0,
                leave: 0, // Note: Future version might split this into paid vs unpaid leaves
                halfDay: 0,
                weeklyOff: 0,
                overtimeHrs: 0
            };

            dates.forEach(rawDate => {
                const record = emp.records[rawDate];
                if (!record) return;

                const status = record.status || '';
                const statusLower = status.toLowerCase();

                if (status === 'Present' || statusLower.includes('present')) {
                    stats.present += 1;
                } else if (status === 'Absent' || statusLower.includes('absent')) {
                    stats.absent += 1;
                } else if (statusLower === 'on leave' || statusLower === 'leave') {
                    stats.leave += 1;
                } else if (statusLower === 'half day') {
                    stats.halfDay += 1;
                } else if (status === 'Sun' || status === 'Sat' || statusLower.includes('weekly off') || statusLower === 'wo') {
                    stats.weeklyOff += 1;
                } else if (statusLower.includes('late') || statusLower.includes('overtime')) {
                    // Late/Overtime counts as present
                    stats.present += 1;
                }

                const otHrs = parseFloat(record.overtime_hours);
                if (!isNaN(otHrs) && otHrs > 0) {
                    stats.overtimeHrs += otHrs;
                }
            });

            emp.stats = stats;
        });

        return {
            employees,
            dates
        };
    }, [previewData.cardRecords]);

    return (
        <DashboardLayout title="Reports & Exports" noPadding={true} tourPageKey={PAGE_KEY} tourSteps={tourSteps}>
            <div className="min-h-[calc(100vh-64px)] p-4 flex flex-col space-y-4">
                {/* Switcher & Parallel Filters Row (Tabs are kept below the header) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    {/* View Switcher Tabs */}
                    <div className="flex w-fit items-center gap-3 p-1.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0">
                        {[
                            { id: 'card', label: 'Attendance View', icon: TrendingUp, tourId: 'reports-attendance-view-tab' },
                            { id: 'table', label: 'Full Report', icon: Table, tourId: 'reports-full-report-tab' }
                        ].map((tab) => {
                            const isSelected = previewMode === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    data-tour-id={tab.tourId}
                                    onClick={() => setPreviewMode(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${isSelected
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

                    {/* Parallel Filters: Only visible in Attendance View tab */}
                    {previewMode === 'card' && (
                        <div data-tour-id="reports-filters" className="flex flex-wrap items-center gap-3 animate-none">
                            {/* Month / Week / Date Pickers */}
                            {attendanceReportType !== 'employee_master' && (
                                <div className="flex items-center gap-2">
                                    {['matrix_monthly', 'attendance_matrix_monthly', 'attendance_detailed', 'attendance_summary'].includes(attendanceReportType) ? (
                                        <MonthPicker
                                            value={attendanceMonth}
                                            onChange={(val) => setAttendanceMonth(val)}
                                            compact={true}
                                        />
                                    ) : ['matrix_weekly', 'attendance_matrix_weekly'].includes(attendanceReportType) ? (
                                        <div className="flex items-center gap-2">
                                            <MonthPicker
                                                value={attendanceMonth}
                                                onChange={(val) => setAttendanceMonth(val)}
                                                compact={true}
                                            />
                                            <div className="relative" ref={attendanceWeekDropdownRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setAttendanceIsWeekDropdownOpen(!attendanceIsWeekDropdownOpen)}
                                                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[150px]"
                                                >
                                                    <span className="truncate">{attendanceWeeks.find(w => w.value === attendanceWeek)?.label || 'Select Week'}</span>
                                                    <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
                                                </button>

                                                {attendanceIsWeekDropdownOpen && (
                                                    <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5 animate-in fade-in duration-200">
                                                        {attendanceWeeks.map((w, idx) => (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                onClick={() => {
                                                                    setAttendanceWeek(w.value);
                                                                    setAttendanceIsWeekDropdownOpen(false);
                                                                }}
                                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${attendanceWeek === w.value
                                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                    }`}
                                                            >
                                                                {w.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <DatePicker
                                            value={attendanceDate}
                                            onChange={(val) => setAttendanceDate(val)}
                                            compact={true}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Searchable Department Selector */}
                            <div className="relative" ref={attendanceDeptDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAttendanceIsDeptDropdownOpen(!attendanceIsDeptDropdownOpen);
                                        setAttendanceDeptSearchQuery('');
                                    }}
                                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[180px]"
                                >
                                    <span className="truncate">
                                        {departments.find(d => d.dept_id === attendanceDeptId)?.dept_name || 'All Departments'}
                                    </span>
                                    <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
                                </button>

                                {attendanceIsDeptDropdownOpen && (
                                    <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col animate-in fade-in duration-200">
                                        <div className="relative mb-2">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search departments..."
                                                value={attendanceDeptSearchQuery}
                                                onChange={(e) => setAttendanceDeptSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAttendanceDeptId('');
                                                    setAttendanceIsDeptDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${attendanceDeptId === ''
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                All Departments
                                            </button>
                                            {departments.filter(d => d.dept_name.toLowerCase().includes(attendanceDeptSearchQuery.toLowerCase())).length > 0 ? (
                                                departments.filter(d => d.dept_name.toLowerCase().includes(attendanceDeptSearchQuery.toLowerCase())).map(d => (
                                                    <button
                                                        key={d.dept_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setAttendanceDeptId(d.dept_id);
                                                            setAttendanceIsDeptDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${attendanceDeptId === d.dept_id
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                            }`}
                                                    >
                                                        {d.dept_name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                                    No departments found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Searchable Designation Selector */}
                            <div className="relative" ref={attendanceDesgDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAttendanceIsDesgDropdownOpen(!attendanceIsDesgDropdownOpen);
                                        setAttendanceDesgSearchQuery('');
                                    }}
                                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[180px]"
                                >
                                    <span className="truncate">
                                        {designations.find(d => String(d.desg_id) === String(attendanceDesgId))?.desg_name || 'All Designations'}
                                    </span>
                                    <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
                                </button>

                                {attendanceIsDesgDropdownOpen && (
                                    <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col animate-in fade-in duration-200">
                                        <div className="relative mb-2">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search designations..."
                                                value={attendanceDesgSearchQuery}
                                                onChange={(e) => setAttendanceDesgSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAttendanceDesgId('');
                                                    setAttendanceIsDesgDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${attendanceDesgId === ''
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                All Designations
                                            </button>
                                            {designations.filter(d => d.desg_name.toLowerCase().includes(attendanceDesgSearchQuery.toLowerCase())).length > 0 ? (
                                                designations.filter(d => d.desg_name.toLowerCase().includes(attendanceDesgSearchQuery.toLowerCase())).map(d => (
                                                    <button
                                                        key={d.desg_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setAttendanceDesgId(d.desg_id);
                                                            setAttendanceIsDesgDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${String(attendanceDesgId) === String(d.desg_id)
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                                : 'text-slate-600 dark:text-[#8b949e] hover:bg-slate-50 dark:hover:bg-slate-800'
                                                            }`}
                                                    >
                                                        {d.desg_name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                                    No designations found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Searchable Employee Selector */}
                            <div className="relative" ref={attendanceEmpDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAttendanceIsEmpDropdownOpen(!attendanceIsEmpDropdownOpen);
                                        setAttendanceEmpSearchQuery('');
                                    }}
                                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[180px]"
                                >
                                    <span className="truncate">{attendanceSelectedEmployeeName}</span>
                                    <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
                                </button>

                                {attendanceIsEmpDropdownOpen && (
                                    <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col animate-in fade-in duration-200">
                                        <div className="relative mb-2">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search employees..."
                                                value={attendanceEmpSearchQuery}
                                                onChange={(e) => setAttendanceEmpSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAttendanceEmployeeId('');
                                                    setAttendanceIsEmpDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${attendanceEmployeeId === ''
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                All Employees
                                            </button>
                                            {attendanceFilteredEmployees.length > 0 ? (
                                                attendanceFilteredEmployees.map(emp => (
                                                    <button
                                                        key={emp.user_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setAttendanceEmployeeId(emp.user_id);
                                                            setAttendanceIsEmpDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${attendanceEmployeeId === emp.user_id
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                            }`}
                                                    >
                                                        {emp.user_name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                                    No employees found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Top Control Bar: Generate Report (Only shown on Full Report view) */}
                {previewMode === 'table' && (
                    <div data-tour-id="reports-filters" className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-4 space-y-4 shrink-0">
                        {/* Row 1: Parameters Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-end">
                            {/* Custom Report Type Dropdown */}
                            <div className="relative xl:col-span-2" ref={tableTypeDropdownRef}>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Report Type</label>
                                <button
                                    type="button"
                                    onClick={() => setTableIsTypeDropdownOpen(!tableIsTypeDropdownOpen)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                >
                                    <span className="truncate">{reportTypeOptions.find(opt => opt.value === tableReportType)?.label || tableReportType}</span>
                                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsTypeDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {tableIsTypeDropdownOpen && (
                                    <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                        {reportTypeOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    setTableReportType(opt.value);
                                                    setTableIsTypeDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${tableReportType === opt.value
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Custom Searchable Department Selector */}
                            <div className="relative xl:col-span-2" ref={tableDeptDropdownRef}>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Department</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTableIsDeptDropdownOpen(!tableIsDeptDropdownOpen);
                                        setTableDeptSearchQuery('');
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                >
                                    <span className="truncate">
                                        {departments.find(d => d.dept_id === tableDeptId)?.dept_name || 'All Departments'}
                                    </span>
                                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsDeptDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {tableIsDeptDropdownOpen && (
                                    <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                        <div className="relative mb-2">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search departments..."
                                                value={tableDeptSearchQuery}
                                                onChange={(e) => setTableDeptSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTableDeptId('');
                                                    setTableIsDeptDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${tableDeptId === ''
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                All Departments
                                            </button>
                                            {departments.filter(d => d.dept_name.toLowerCase().includes(tableDeptSearchQuery.toLowerCase())).length > 0 ? (
                                                departments.filter(d => d.dept_name.toLowerCase().includes(tableDeptSearchQuery.toLowerCase())).map(d => (
                                                    <button
                                                        key={d.dept_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setTableDeptId(d.dept_id);
                                                            setTableIsDeptDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${tableDeptId === d.dept_id
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                            }`}
                                                    >
                                                        {d.dept_name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                                    No departments found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Custom Searchable Designation Selector */}
                            <div className="relative xl:col-span-2" ref={tableDesgDropdownRef}>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Designation</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTableIsDesgDropdownOpen(!tableIsDesgDropdownOpen);
                                        setTableDesgSearchQuery('');
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                >
                                    <span className="truncate">
                                        {designations.find(d => String(d.desg_id) === String(tableDesgId))?.desg_name || 'All Designations'}
                                    </span>
                                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsDesgDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {tableIsDesgDropdownOpen && (
                                    <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                        <div className="relative mb-2">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search designations..."
                                                value={tableDesgSearchQuery}
                                                onChange={(e) => setTableDesgSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTableDesgId('');
                                                    setTableIsDesgDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${tableDesgId === ''
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                All Designations
                                            </button>
                                            {designations.filter(d => d.desg_name.toLowerCase().includes(tableDesgSearchQuery.toLowerCase())).length > 0 ? (
                                                designations.filter(d => d.desg_name.toLowerCase().includes(tableDesgSearchQuery.toLowerCase())).map(d => (
                                                    <button
                                                        key={d.desg_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setTableDesgId(d.desg_id);
                                                            setTableIsDesgDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${String(tableDesgId) === String(d.desg_id)
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                            }`}
                                                    >
                                                        {d.desg_name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                                    No designations found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Custom Searchable Employee Select */}
                            <div className="relative xl:col-span-2" ref={tableEmpDropdownRef}>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Employee</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTableIsEmpDropdownOpen(!tableIsEmpDropdownOpen);
                                        setTableEmpSearchQuery('');
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                >
                                    <span className="truncate">{tableSelectedEmployeeName}</span>
                                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsEmpDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {tableIsEmpDropdownOpen && (
                                    <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                        <div className="relative mb-2">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search employees..."
                                                value={tableEmpSearchQuery}
                                                onChange={(e) => setTableEmpSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTableEmployeeId('');
                                                    setTableIsEmpDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${tableEmployeeId === ''
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                All Employees
                                            </button>
                                            {tableFilteredEmployees.length > 0 ? (
                                                tableFilteredEmployees.map(emp => (
                                                    <button
                                                        key={emp.user_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setTableEmployeeId(emp.user_id);
                                                            setTableIsEmpDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${tableEmployeeId === emp.user_id
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                            }`}
                                                    >
                                                        {emp.user_name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                                    No employees found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                        {/* Date Picker Grid Item */}
                        {tableReportType !== 'employee_master' && (
                            <div className="xl:col-span-2">
                                {tableUseCustomRange ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <DatePicker
                                            label="Start Date"
                                            value={tableCustomStartDate}
                                            onChange={(val) => setTableCustomStartDate(val)}
                                            compact={true}
                                        />
                                        <DatePicker
                                            label="End Date"
                                            value={tableCustomEndDate}
                                            onChange={(val) => setTableCustomEndDate(val)}
                                            compact={true}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        {['matrix_monthly', 'attendance_matrix_monthly', 'attendance_detailed', 'attendance_summary'].includes(tableReportType) ? (
                                            <MonthPicker
                                                label="Select Month"
                                                value={tableMonth}
                                                onChange={(val) => setTableMonth(val)}
                                                compact={true}
                                            />
                                        ) : ['matrix_weekly', 'attendance_matrix_weekly'].includes(tableReportType) ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                                <MonthPicker
                                                    label="Select Month"
                                                    value={tableMonth}
                                                    onChange={(val) => setTableMonth(val)}
                                                    compact={true}
                                                />
                                                <div className="relative" ref={tableWeekDropdownRef}>
                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Select Week</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setTableIsWeekDropdownOpen(!tableIsWeekDropdownOpen)}
                                                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                                    >
                                                        <span className="truncate">{tableWeeks.find(w => w.value === tableWeek)?.label || 'Select Week'}</span>
                                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsWeekDropdownOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {tableIsWeekDropdownOpen && (
                                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                                            {tableWeeks.map((w, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setTableWeek(w.value);
                                                                        setTableIsWeekDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${tableWeek === w.value
                                                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                                            : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                        }`}
                                                                >
                                                                    {w.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <DatePicker
                                                label="Select Date"
                                                value={tableDate}
                                                onChange={(val) => setTableDate(val)}
                                                compact={true}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Columns Selection Dropdown */}
                        {tableReportType !== 'employee_master' && (
                            <div className="relative xl:col-span-2" ref={tableColsDropdownRef}>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Columns to Include</label>
                                <button
                                    type="button"
                                    onClick={() => setTableIsColsDropdownOpen(!tableIsColsDropdownOpen)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                >
                                    <span className="truncate">
                                        {Object.values(tableExportColumns).filter(Boolean).length} Columns Selected
                                    </span>
                                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsColsDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {tableIsColsDropdownOpen && (
                                    <div className="absolute right-0 mt-1 w-full min-w-[220px] bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-3 space-y-2.5">
                                        {[
                                            { id: 'timeIn', label: 'Time In' },
                                            { id: 'timeOut', label: 'Time Out' },
                                            { id: 'status', label: 'Status' },
                                            { id: 'workedHours', label: 'Worked Hours' },
                                            { id: 'requiredHours', label: 'Required Hours' },
                                            { id: 'late', label: 'Lateness Info' },
                                            { id: 'location', label: 'Locations' },
                                            { id: 'attendanceDays', label: 'Attendance Summary' }
                                        ].map((col) => (
                                            <button
                                                key={col.id}
                                                type="button"
                                                onClick={() => {
                                                    setTableExportColumns(prev => ({
                                                        ...prev,
                                                        [col.id]: !prev[col.id]
                                                    }));
                                                }}
                                                className="w-full flex items-center gap-2.5 cursor-pointer focus:outline-none group text-left"
                                            >
                                                <div className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all ${tableExportColumns[col.id]
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                                        : 'bg-white dark:bg-github-dark-subtle border-slate-300 dark:border-github-dark-border group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                                                    }`}>
                                                    {tableExportColumns[col.id] && (
                                                        <svg className="w-2.5 h-2.5 stroke-[3] stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className="text-xs font-semibold text-slate-600 dark:text-github-dark-muted select-none">
                                                    {col.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        </div>

                        {/* Row 2: Divider & Action Toolbar */}
                        <div className="border-t border-slate-100 dark:border-github-dark-border pt-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
                            {/* Custom Date Range Toggle */}
                            <div className="flex items-center">
                                <button
                                    type="button"
                                    id="useCustomRangeWeb"
                                    onClick={() => setTableUseCustomRange(!tableUseCustomRange)}
                                    className="flex items-center gap-2.5 cursor-pointer focus:outline-none group"
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${tableUseCustomRange
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                            : 'bg-white dark:bg-[#161b22] border-slate-300 dark:border-[#30363d] group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                                        }`}>
                                        {tableUseCustomRange && (
                                            <svg className="w-2.5 h-2.5 stroke-[3] stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted select-none">
                                        Use Custom Date Range
                                    </span>
                                </button>
                            </div>

                            {/* Format Switcher & Download Button */}
                            <div data-tour-id="reports-actions" className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
                                {/* File Format Tabs Selector */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Format:</span>
                                    <div className="h-8 flex items-center p-1 bg-slate-100 dark:bg-[#161b22] rounded-md border border-slate-200 dark:border-[#30363d]">
                                        {[
                                            { id: 'xlsx', label: 'Excel' },
                                            { id: 'csv', label: 'CSV' },
                                            { id: 'pdf', label: 'PDF' }
                                        ].map((format) => {
                                            const isSelected = tableFileFormat === format.id;
                                            return (
                                                <button
                                                    key={format.id}
                                                    type="button"
                                                    onClick={() => setTableFileFormat(format.id)}
                                                    className={`h-full px-3 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${isSelected
                                                            ? 'bg-indigo-600 text-white shadow-sm'
                                                            : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-github-dark-text'
                                                        }`}
                                                >
                                                    {format.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Download Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider rounded-md shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-8 text-[10px] cursor-pointer"
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={12} />
                                            <span>Download Report</span>
                                        </>
                                    )}
                                </button>

                                {/* Export History Drawer Toggle Button */}
                                <button
                                    onClick={() => setIsHistorySidebarOpen(true)}
                                    className="px-4 py-1.5 bg-[#f6f8fa] hover:bg-[#eaeef2] dark:bg-[#21262d] dark:hover:bg-[#30363d] text-[#24292f] dark:text-[#c9d1d9] border border-[#d0d7de] dark:border-[#30363d] font-bold uppercase tracking-wider rounded-md shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 h-8 text-[10px] cursor-pointer"
                                >
                                    <History size={12} />
                                    <span>Export History</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {previewMode === 'card' ? (
                    /* Attendance View: Direct full-page rendering without outer card wrapper */
                    loadingPreview ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm">
                            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-slate-500 text-sm font-medium">Crunching and parsing preview records...</p>
                        </div>
                    ) : (matrixData.employees && matrixData.employees.length > 0) ? (
                        <div className="w-full overflow-x-auto no-scrollbar rounded-xl border border-slate-200 dark:border-github-dark-border bg-white dark:bg-dark-card shadow-sm animate-none" style={{ isolation: 'isolate' }}>
                            <table className="w-full text-left border-collapse" style={{ minWidth: 'max-content' }}>
                                <thead className="sticky top-0 z-30">
                                    <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border">
                                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-github-dark-muted sticky left-0 bg-slate-50 dark:bg-[#161b22] z-40 min-w-[230px] border-r border-slate-200 dark:border-github-dark-border" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.10)' }}>Employee</th>
                                        {matrixData.dates.map(rawDate => {
                                            const d = new Date(rawDate + 'T00:00:00Z');
                                            return (
                                                <th key={rawDate} className="py-2 px-1 text-center min-w-[52px]">
                                                    <div className="text-[8px] uppercase text-slate-400 leading-none tracking-wider">{d.toLocaleString('en-US', { month: 'short' })}</div>
                                                    <div className="text-sm font-black text-slate-700 dark:text-white leading-tight">{d.getUTCDate()}</div>
                                                    <div className="text-[8px] uppercase text-slate-400 leading-none tracking-wider">{d.toLocaleString('en-US', { weekday: 'short' })}</div>
                                                </th>
                                            );
                                        })}
                                        <th className="py-2 px-2 text-center min-w-[50px] border-l border-slate-200 dark:border-github-dark-border bg-emerald-50/50 dark:bg-emerald-950/20">
                                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                                            <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 leading-tight">P</div>
                                        </th>
                                        <th className="py-2 px-2 text-center min-w-[50px] bg-rose-50/50 dark:bg-rose-950/20">
                                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                                            <div className="text-sm font-black text-rose-700 dark:text-rose-400 leading-tight">A</div>
                                        </th>
                                        <th className="py-2 px-2 text-center min-w-[50px] bg-sky-50/50 dark:bg-sky-950/20">
                                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                                            <div className="text-sm font-black text-sky-700 dark:text-sky-400 leading-tight">L</div>
                                        </th>
                                        <th className="py-2 px-2 text-center min-w-[50px] bg-indigo-50/50 dark:bg-indigo-950/20">
                                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                                            <div className="text-sm font-black text-indigo-700 dark:text-indigo-400 leading-tight">HD</div>
                                        </th>
                                        <th className="py-2 px-2 text-center min-w-[50px] bg-slate-100/50 dark:bg-slate-800/40">
                                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                                            <div className="text-sm font-black text-slate-600 dark:text-slate-400 leading-tight">WO</div>
                                        </th>
                                        <th className="py-2 px-2 text-center min-w-[60px] bg-purple-50/50 dark:bg-purple-950/20">
                                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                                            <div className="text-sm font-black text-purple-700 dark:text-purple-400 leading-tight">OT (h)</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-github-dark-border">
                                    {matrixData.employees.map((emp) => {
                                        const initials = emp.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                        return (
                                            <tr key={emp.user_id} className="hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors group">
                                                <td className="px-5 py-3.5 sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-[#1c2128] transition-colors z-10 border-r border-slate-200 dark:border-github-dark-border" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.08)' }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shadow-inner shrink-0">
                                                            {initials || <User size={14} />}
                                                        </div>
                                                        <div>
                                                            <span className="block font-bold text-slate-800 dark:text-github-dark-text text-sm leading-tight">{emp.user_name}</span>
                                                            <span className="block text-[10px] font-medium text-slate-400 dark:text-github-dark-muted mt-0.5">{emp.designation} · {emp.department}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                {matrixData.dates.map(rawDate => {
                                                    const record = emp.records[rawDate];
                                                    const status = record?.status || '-';
                                                    const isNonClickableStatus = ['Sun', 'Sat', 'WEEK_OFF', 'Not Recorded', '-'].includes(status);
                                                    const isClickable = !!record && !isNonClickableStatus;
                                                    return (
                                                        <td key={rawDate} className="px-1 py-3 text-center">
                                                            <button
                                                                type="button"
                                                                onMouseEnter={(e) => {
                                                                    if (record) {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        setHoveredRecord(record);
                                                                        setHoveredPosition({
                                                                            top: rect.top,
                                                                            left: rect.left + rect.width / 2
                                                                        });
                                                                    }
                                                                }}
                                                                onMouseLeave={() => setHoveredRecord(null)}
                                                                onClick={() => {
                                                                    if (isClickable) {
                                                                        setSelectedRecord(record);
                                                                        setIsDetailSidebarOpen(true);
                                                                        setHoveredRecord(null);
                                                                    }
                                                                }}
                                                                title={!record ? 'No data' : undefined}
                                                                className={`w-9 h-9 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all inline-flex items-center justify-center shadow-sm ${getStatusColor(status)} ${isClickable ? 'cursor-pointer hover:brightness-95 hover:shadow-md active:scale-95' : 'cursor-default'}`}
                                                            >
                                                                {getStatusLabel(status)}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-2 py-3 text-center border-l border-slate-200 dark:border-github-dark-border bg-emerald-50/20 dark:bg-emerald-950/10 font-bold text-xs text-emerald-700 dark:text-emerald-400">
                                                    {emp.stats?.present || 0}
                                                </td>
                                                <td className="px-2 py-3 text-center bg-rose-50/20 dark:bg-rose-950/10 font-bold text-xs text-rose-700 dark:text-rose-400">
                                                    {emp.stats?.absent || 0}
                                                </td>
                                                <td className="px-2 py-3 text-center bg-sky-50/20 dark:bg-sky-950/10 font-bold text-xs text-sky-700 dark:text-sky-400">
                                                    {emp.stats?.leave || 0}
                                                </td>
                                                <td className="px-2 py-3 text-center bg-indigo-50/20 dark:bg-indigo-950/10 font-bold text-xs text-indigo-700 dark:text-indigo-400">
                                                    {emp.stats?.halfDay || 0}
                                                </td>
                                                <td className="px-2 py-3 text-center bg-slate-50 dark:bg-slate-800/20 font-bold text-xs text-slate-500 dark:text-slate-400">
                                                    {emp.stats?.weeklyOff || 0}
                                                </td>
                                                <td className="px-2 py-3 text-center bg-purple-50/20 dark:bg-purple-950/10 font-bold text-xs text-purple-700 dark:text-purple-400">
                                                    {emp.stats?.overtimeHrs ? emp.stats.overtimeHrs.toFixed(1) : '0.0'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 bg-white dark:bg-dark-card border border-dashed border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm">
                            <Table className="text-slate-200 dark:text-slate-700" size={48} />
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">No preview records loaded for this filter.</p>
                        </div>
                    )
                ) : (
                    /* Full Report View: Render Spreadsheet table inside the Card layout */
                    <div className="w-full flex flex-col bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden">
                        {/* Card Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/10 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2 text-sm">
                                    <Table className="text-slate-400" size={16} />
                                    Report Preview Data
                                </h3>
                                <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-1 leading-none">
                                    Active report: <span className="font-bold text-slate-600 dark:text-slate-300">{activeFilters.reportType.replace(/_/g, ' ')}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {previewData.rows?.length > 0 && (
                                    <span className="px-2.5 py-1 text-[10px] font-bold text-[#57606a] dark:text-[#8b949e] bg-[#f6f8fa] dark:bg-[#161b22] rounded-full border border-[#d0d7de] dark:border-[#30363d]">
                                        {previewData.rows.filter(row => {
                                            const firstCell = row[0]?.toString().toUpperCase();
                                            return firstCell !== 'TOTALS' && firstCell !== 'TOTAL';
                                        }).length} Records
                                    </span>
                                )}
                                {cacheHit && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 rounded-full border border-indigo-200/50 dark:border-indigo-800/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                        Refreshing
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Preview Body */}
                        <div className="w-full no-scrollbar bg-slate-100 dark:bg-github-dark-bg border-t border-slate-200 dark:border-github-dark-border overflow-x-auto px-4 pb-4 pt-4">
                            {loadingPreview ? (
                                <div className="flex flex-col items-center justify-center py-24 gap-4">
                                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <p className="text-slate-500 text-sm font-medium">Crunching and parsing preview records...</p>
                                </div>
                            ) : (previewData.rows && previewData.rows.length > 0) ? (
                                <>
                                    {/* Attendance Summary Section */}
                                    {activeFilters.reportType !== 'employee_master' && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4 shrink-0 animate-in fade-in duration-300">
                                            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Total Present</span>
                                                    <h3 className="text-xl font-black text-emerald-600 mt-1">{reportsSummary.present}</h3>
                                                    <p className="text-[9px] text-slate-450 dark:text-github-dark-muted mt-1">Present days</p>
                                                </div>
                                                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                                    <CheckCircle size={18} />
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Total Absent</span>
                                                    <h3 className="text-xl font-black text-rose-600 mt-1">{reportsSummary.absent}</h3>
                                                    <p className="text-[9px] text-slate-450 dark:text-github-dark-muted mt-1">Absent days</p>
                                                </div>
                                                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl">
                                                    <XCircle size={18} />
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Total Leave</span>
                                                    <h3 className="text-xl font-black text-sky-600 mt-1">{reportsSummary.leave}</h3>
                                                    <p className="text-[9px] text-slate-450 dark:text-github-dark-muted mt-1">Leave days</p>
                                                </div>
                                                <div className="p-2.5 bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 rounded-xl">
                                                    <Calendar size={18} />
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Total Half Day</span>
                                                    <h3 className="text-xl font-black text-indigo-650 mt-1">{reportsSummary.halfDay}</h3>
                                                    <p className="text-[9px] text-slate-450 dark:text-github-dark-muted mt-1">Half day occurrences</p>
                                                </div>
                                                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                                    <Clock size={18} />
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Total Overtime</span>
                                                    <h3 className="text-xl font-black text-purple-600 mt-1">{reportsSummary.overtime.toFixed(1)}h</h3>
                                                    <p className="text-[9px] text-slate-450 dark:text-github-dark-muted mt-1">Accumulated hours</p>
                                                </div>
                                                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-xl">
                                                    <TrendingUp size={18} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Spreadsheet View: Premium Excel-replica table */}
                                    <div className="rounded-xl overflow-hidden border border-slate-300 dark:border-[#30363d] shadow-md">
                                        {/* Row number + freeze bar header */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#217346]/10 border-b border-[#217346]/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#217346] animate-pulse" />
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-[#217346]">Live Preview · Excel Format</span>
                                            <span className="ml-auto text-[9px] font-semibold text-slate-400">{previewData.rows?.filter(r => r[0]?.toString().toUpperCase() !== 'TOTALS').length} rows</span>
                                        </div>
                                        <table
                                            className="w-full text-left border-collapse bg-white"
                                            style={{ fontFamily: '"Segoe UI", Calibri, Arial, sans-serif', fontSize: '11.5px' }}
                                        >
                                            <thead className="sticky top-0 z-10">
                                                {previewData.headers ? (
                                                    <>
                                                        {/* Row 1 – group headers */}
                                                        <tr>
                                                            {/* Row # column */}
                                                            <th style={{ backgroundColor: '#1F4E78', color: '#FFFFFF', border: '1px solid #2563EB', width: '36px', minWidth: '36px' }}
                                                                className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-wider">#</th>
                                                            {previewData.headers[0].map((cell, idx) => (
                                                                <th
                                                                    key={idx}
                                                                    rowSpan={cell.rowspan}
                                                                    colSpan={cell.colspan}
                                                                    className="px-4 py-2.5 whitespace-nowrap tracking-wide text-center text-[10px] font-black uppercase"
                                                                    style={{ backgroundColor: '#1F4E78', color: '#FFFFFF', border: '1px solid #2563EB', letterSpacing: '0.04em' }}
                                                                >
                                                                    {cell.label}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                        {/* Row 2 – sub-headers */}
                                                        <tr>
                                                            {previewData.headers[1].map((cell, idx) => (
                                                                <th
                                                                    key={idx}
                                                                    className="px-3 py-2 whitespace-nowrap tracking-wide text-center text-[10px] font-bold uppercase"
                                                                    style={{ backgroundColor: '#2E6DA4', color: '#E8F4FD', border: '1px solid #3B82F6', letterSpacing: '0.03em' }}
                                                                >
                                                                    {cell.label}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </>
                                                ) : (
                                                    <tr>
                                                        {/* Row # column */}
                                                        <th style={{ backgroundColor: '#1F4E78', color: '#FFFFFF', border: '1px solid #2563EB', width: '36px', minWidth: '36px' }}
                                                            className="px-2 py-3 text-center text-[9px] font-bold uppercase">#</th>
                                                        {previewData.columns.map((col, idx) => {
                                                            const alignment = getAlignmentClass(col);
                                                            return (
                                                                <th
                                                                    key={idx}
                                                                    className="px-4 py-3 whitespace-nowrap tracking-wide text-[10px] font-black uppercase"
                                                                    style={{
                                                                        backgroundColor: '#1F4E78',
                                                                        color: '#FFFFFF',
                                                                        border: '1px solid #2563EB',
                                                                        textAlign: alignment,
                                                                        letterSpacing: '0.04em'
                                                                    }}
                                                                >
                                                                    {col?.toString().split('\n').map((line, lIdx) => (
                                                                        <div key={lIdx} className="leading-snug">{line}</div>
                                                                    ))}
                                                                </th>
                                                            );
                                                        })}
                                                    </tr>
                                                )}
                                            </thead>
                                            <tbody>
                                                {previewData.rows.map((row, rIdx) => {
                                                    const isTotalsRow = row[0]?.toString().toUpperCase() === 'TOTALS';
                                                    const isEven = rIdx % 2 === 0;
                                                    return (
                                                        <tr
                                                            key={rIdx}
                                                            className={`transition-colors ${isTotalsRow ? '' : 'hover:brightness-95'}`}
                                                            style={isTotalsRow ? { position: 'relative' } : {}}
                                                        >
                                                            {/* Row number cell */}
                                                            <td
                                                                className="text-center text-[9px] font-semibold select-none"
                                                                style={{
                                                                    backgroundColor: isTotalsRow ? '#dce8f5' : isEven ? '#EFF6FF' : '#F8FAFD',
                                                                    color: '#64748B',
                                                                    border: '1px solid #E2E8F0',
                                                                    borderRight: '2px solid #CBD5E1',
                                                                    width: '36px',
                                                                    minWidth: '36px',
                                                                    paddingTop: '6px',
                                                                    paddingBottom: '6px',
                                                                }}
                                                            >
                                                                {isTotalsRow ? '∑' : rIdx + 1}
                                                            </td>
                                                            {row.map((cell, cIdx) => {
                                                                const colHeader = previewData.columns[cIdx]?.toString() || '';
                                                                const cellStyle = getCellStyle(cell, colHeader, isTotalsRow, isEven, rIdx);
                                                                const alignment = getAlignmentClass(colHeader);
                                                                return (
                                                                    <td
                                                                        key={cIdx}
                                                                        className="px-4 whitespace-nowrap transition-colors"
                                                                        style={{ ...cellStyle, textAlign: alignment, paddingTop: '6px', paddingBottom: '6px' }}
                                                                    >
                                                                        {cell?.toString().split('\n').map((line, lIdx) => (
                                                                            <div key={lIdx} className="leading-normal">{line}</div>
                                                                        ))}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white dark:bg-dark-card border border-dashed border-slate-200 dark:border-github-dark-border rounded-xl">
                                    <Table className="text-slate-200 dark:text-slate-700" size={48} />
                                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">No preview records loaded for this filter.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Slide-over Export History Drawer */}
                {createPortal(
                <AnimatePresence>
                    {isHistorySidebarOpen && (
                        <>
                            {/* Backdrop overlay */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.4 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsHistorySidebarOpen(false)}
                                className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-xs"
                            />
                            {/* Drawer container */}
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-white dark:bg-[#161b22] border-l border-slate-200 dark:border-[#30363d] shadow-2xl z-[101] flex flex-col"
                            >
                                {/* Header */}
                                <div className="p-4 border-b border-slate-200 dark:border-[#30363d] bg-slate-50/50 dark:bg-github-dark-subtle/10 flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2 text-xs uppercase tracking-wider">
                                        <DownloadCloud className="text-slate-400" size={16} />
                                        Export History
                                    </h3>
                                    <button
                                        onClick={() => setIsHistorySidebarOpen(false)}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-[#30363d] rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-text transition-colors cursor-pointer"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="p-4 overflow-y-auto flex-1 no-scrollbar space-y-3 bg-[#f6f8fa] dark:bg-[#0d1117] min-h-[300px]">
                                    {exportHistory.length > 0 ? (
                                        exportHistory.map((file) => (
                                            <div
                                                key={file.id}
                                                className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl p-3.5 space-y-2.5 transition-all hover:bg-slate-50 dark:hover:bg-[#21262d] shadow-sm"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg shrink-0 ${file.name.endsWith('.pdf') ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' :
                                                            file.name.endsWith('.csv') ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20' :
                                                                'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                                                        }`}>
                                                        {file.name.endsWith('.pdf') ? <FileText size={16} /> : file.name.endsWith('.csv') ? <FileType size={16} /> : <FileSpreadsheet size={16} />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[11px] font-bold text-slate-800 dark:text-github-dark-text truncate leading-tight uppercase">{file.type}</p>
                                                        <p className="text-[9px] text-slate-400 dark:text-github-dark-muted mt-0.5">{file.size}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#30363d]">
                                                    <span className="text-[9px] font-medium text-slate-400 dark:text-github-dark-muted">{file.date.split(',')[0]}</span>
                                                    <div>
                                                        {file.status === 'Ready' ? (
                                                            <a
                                                                href={file.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                download={file.name}
                                                                className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded cursor-pointer uppercase hover:bg-emerald-100 transition-colors"
                                                            >
                                                                <CheckCircle size={10} /> Download
                                                            </a>
                                                        ) : file.status === 'Generating' ? (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-1 rounded uppercase animate-pulse">
                                                                <div className="w-2.5 h-2.5 border border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div> Compiling
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded uppercase">
                                                                <AlertCircle size={10} /> Failed
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                                            <DownloadCloud className="text-slate-200 dark:text-slate-700" size={32} />
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">No past exports</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
                , document.body)}

                {/* Attendance Detail Sidebar — rendered via Portal so fixed positioning is relative to true viewport */}
                {createPortal(
                <AnimatePresence>
                    {isDetailSidebarOpen && selectedRecord && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsDetailSidebarOpen(false)}
                                className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-[2px] cursor-pointer"
                            />

                            {/* Sidebar Panel */}
                            <motion.div
                                initial={{ x: '100%', opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: '100%', opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] z-[201] bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                            <Clock size={20} />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-github-dark-text">Attendance Details</h3>
                                    </div>
                                    <button
                                        onClick={() => setIsDetailSidebarOpen(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">

                                    {/* Profile Card — Avatar + Name + Date + Status */}
                                    <div className="flex flex-col items-center gap-4 text-center">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-10 rounded-full" />
                                            <div className="relative w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-3xl overflow-hidden border-4 border-white dark:border-github-dark-border shadow-lg">
                                                {(selectedRecord.user_name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || <User size={30} />}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-slate-900 dark:text-github-dark-text tracking-tight">{selectedRecord.user_name || 'Employee'}</h4>
                                            <p className="text-sm font-medium text-slate-500 dark:text-github-dark-muted mt-1">{selectedRecord.date}</p>
                                            {selectedRecord.designation && (
                                                <p className="text-xs font-semibold text-slate-400 dark:text-github-dark-muted mt-1">{selectedRecord.designation} · {selectedRecord.department}</p>
                                            )}
                                            <div className={`mt-3 inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm ${getStatusColor(selectedRecord.status)}`}>
                                                {selectedRecord.status}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attendance Details */}
                                    {selectedRecord.status === 'Absent' ? (
                                        <div className="p-5 bg-rose-50/50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-800/20 rounded-2xl space-y-1.5">
                                            <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Absent Status</p>
                                            <p className="text-xs font-semibold text-rose-500/80">No attendance recorded for this day. Employee was marked absent.</p>
                                        </div>
                                    ) : selectedRecord.status === 'On Leave' ? (
                                        <div className="p-5 bg-sky-50/50 dark:bg-sky-950/15 border border-sky-200/50 dark:border-sky-800/20 rounded-2xl space-y-1.5">
                                            <p className="text-xs font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">Leave Status</p>
                                            <p className="text-xs font-semibold text-sky-500/80">On approved leave. Leave was approved for this day.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* Details Grid */}
                                            <div className="grid grid-cols-2 gap-4">
                                                {[
                                                    { label: 'Punch In', value: selectedRecord.time_in || '—' },
                                                    { label: 'Punch Out', value: selectedRecord.time_out || '—' },
                                                ].map((item, i) => (
                                                    <div key={i} className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 group hover:border-indigo-500/30 transition-colors">
                                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">{item.label}</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Work Hours vs Required + Late Mins */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 group hover:border-indigo-500/30 transition-colors">
                                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Work Hrs / Req Hrs</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">
                                                        {selectedRecord.worked_hours != null ? selectedRecord.worked_hours.toFixed(2) : '—'}
                                                        <span className="text-slate-400 font-medium mx-1">/</span>
                                                        {selectedRecord.required_hours != null ? selectedRecord.required_hours.toFixed(2) : '—'} hrs
                                                    </span>
                                                    {selectedRecord.worked_hours != null && selectedRecord.required_hours != null && selectedRecord.required_hours > 0 && (
                                                        <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${selectedRecord.worked_hours >= selectedRecord.required_hours ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                                                style={{ width: `${Math.min((selectedRecord.worked_hours / selectedRecord.required_hours) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`p-4 rounded-2xl border transition-colors ${selectedRecord.late_minutes > 0 ? 'bg-amber-50/60 dark:bg-amber-950/15 border-amber-200/50 dark:border-amber-800/20 hover:border-amber-400/40' : 'bg-slate-50/50 dark:bg-github-dark-subtle/40 border-slate-100 dark:border-github-dark-border/50 hover:border-indigo-500/30'}`}>
                                                    <span className="block text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-60 text-slate-400">Late Mins</span>
                                                    <span className={`text-sm font-bold ${selectedRecord.late_minutes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-github-dark-text'}`}>
                                                        {selectedRecord.late_minutes != null ? `${selectedRecord.late_minutes} min` : '—'}
                                                    </span>
                                                    {selectedRecord.late_minutes > 0 && (
                                                        <>
                                                            <span className="block text-[9px] text-amber-500 font-semibold mt-1">Arrived late</span>
                                                            {selectedRecord.late_reason && selectedRecord.late_reason !== '-' && (
                                                                <span className="block text-[9px] text-slate-500 dark:text-github-dark-muted font-medium mt-1 leading-snug">
                                                                    Message: <span className="italic">"{selectedRecord.late_reason}"</span>
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Punch Locations */}
                                            {selectedRecord.time_in_address && selectedRecord.time_in_address !== '-' && (
                                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400/50" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 opacity-80">Punch In Location</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <MapPin size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{selectedRecord.time_in_address}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedRecord.time_out && selectedRecord.time_out !== '-' ? (
                                                selectedRecord.time_out_address && selectedRecord.time_out_address !== '-' && (
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-400/50" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 opacity-80">Punch Out Location</span>
                                                        </div>
                                                        <div className="flex items-start gap-2">
                                                            <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{selectedRecord.time_out_address}</p>
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50">
                                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">Punch Out Info</span>
                                                    <p className="text-xs font-semibold text-slate-400 mt-2 italic">Punch out not yet recorded.</p>
                                                </div>
                                            )}

                                            {/* Selfie Previews */}
                                            {(selectedRecord.time_in_image || selectedRecord.time_out_image) && (
                                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50">
                                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 opacity-60">Punch Selfies</span>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {[
                                                            { label: 'In', img: selectedRecord.time_in_image, color: 'text-emerald-600 dark:text-emerald-400' },
                                                            { label: 'Out', img: selectedRecord.time_out_image, color: 'text-rose-600 dark:text-rose-400' }
                                                        ].map((item, i) => (
                                                            <div key={i} className="flex flex-col">
                                                                {item.img ? (
                                                                    <div className="flex justify-center w-full mt-2">
                                                                        <div className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border group/img cursor-pointer shadow-sm bg-transparent" onClick={() => setPreviewImage(item.img)}>
                                                                            <img src={item.img} alt={`${item.label} Selfie`} className="max-h-48 max-w-full w-auto block object-contain transition-transform duration-500 group-hover/img:scale-110" />
                                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                                <Search size={16} className="text-white" />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full h-28 rounded-xl bg-slate-50 dark:bg-github-dark-subtle/20 border border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center gap-1">
                                                                        <XCircle size={14} className="text-slate-350" />
                                                                        <span className="text-[9px] text-slate-400 font-medium">No Selfie {item.label}</span>
                                                                    </div>
                                                                )}
                                                                <span className={`text-[9px] font-black uppercase tracking-wider text-center mt-2.5 ${item.color}`}>
                                                                    Punch {item.label}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                             </motion.div>
                        </>
                    )}
                </AnimatePresence>
                , document.body)}

                {/* Attendance Detail Hover Tooltip */}
                {hoveredRecord && (
                    <div
                        className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-950/95 dark:bg-[#161b22]/95 backdrop-blur-xs text-white text-[11px] rounded-xl p-3.5 shadow-2xl border border-slate-800 dark:border-[#30363d] w-64 space-y-2 text-left"
                        style={{
                            top: hoveredPosition.top - 8,
                            left: hoveredPosition.left,
                        }}
                    >
                        {/* Header: Employee Name & Date */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-800 dark:border-[#30363d] pb-2">
                            <div>
                                <h4 className="font-bold text-xs text-slate-100 dark:text-[#f0f6fc] leading-tight">
                                    {hoveredRecord.user_name}
                                </h4>
                                <p className="text-[9px] text-slate-400 dark:text-[#8b949e] mt-0.5 font-semibold">
                                    {hoveredRecord.date}
                                </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${getStatusColor(hoveredRecord.status)}`}>
                                {hoveredRecord.status}
                            </span>
                        </div>

                        {/* Details based on status */}
                        {hoveredRecord.status === 'Absent' ? (
                            <p className="text-[10px] text-rose-400 font-medium italic">No attendance recorded. Marked absent.</p>
                        ) : hoveredRecord.status === 'On Leave' ? (
                            <p className="text-[10px] text-sky-400 font-medium italic">Approved leave for this day.</p>
                        ) : (
                            <div className="space-y-2">
                                {/* Punch Times */}
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div>
                                        <span className="text-slate-400 dark:text-[#8b949e] block font-medium">Punch In</span>
                                        <span className="font-bold text-slate-200 dark:text-[#c9d1d9]">{hoveredRecord.time_in || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 dark:text-[#8b949e] block font-medium">Punch Out</span>
                                        <span className="font-bold text-slate-200 dark:text-[#c9d1d9]">{hoveredRecord.time_out || '—'}</span>
                                    </div>
                                </div>

                                {/* Work Hrs vs Req Hrs + Late */}
                                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-slate-800/60 dark:border-[#30363d]/60">
                                    <div>
                                        <span className="text-slate-400 dark:text-[#8b949e] block font-medium">Work / Req Hrs</span>
                                        <span className="font-bold text-slate-200 dark:text-[#c9d1d9]">
                                            {hoveredRecord.worked_hours != null ? hoveredRecord.worked_hours.toFixed(2) : '—'}
                                            <span className="text-slate-500 mx-0.5">/</span>
                                            {hoveredRecord.required_hours != null ? hoveredRecord.required_hours.toFixed(2) : '—'}h
                                        </span>
                                        {hoveredRecord.worked_hours != null && hoveredRecord.required_hours > 0 && (
                                            <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${hoveredRecord.worked_hours >= hoveredRecord.required_hours ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                                    style={{ width: `${Math.min((hoveredRecord.worked_hours / hoveredRecord.required_hours) * 100, 100)}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-slate-400 dark:text-[#8b949e] block font-medium">Late Mins</span>
                                        <span className={`font-bold ${hoveredRecord.late_minutes > 0 ? 'text-amber-400' : 'text-slate-200 dark:text-[#c9d1d9]'}`}>
                                            {hoveredRecord.late_minutes != null ? `${hoveredRecord.late_minutes} min` : '—'}
                                        </span>
                                        {hoveredRecord.late_minutes > 0 && hoveredRecord.late_reason && hoveredRecord.late_reason !== '-' && (
                                            <span className="block text-[8px] text-slate-400 dark:text-github-dark-muted italic truncate max-w-[120px] mt-0.5" title={hoveredRecord.late_reason}>
                                                "{hoveredRecord.late_reason}"
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Locations */}
                                {(hoveredRecord.time_in_address && hoveredRecord.time_in_address !== '-') || 
                                 (hoveredRecord.time_out_address && hoveredRecord.time_out_address !== '-') ? (
                                    <div className="space-y-1 pt-1.5 border-t border-slate-800/60 dark:border-[#30363d]/60">
                                        {hoveredRecord.time_in_address && hoveredRecord.time_in_address !== '-' && (
                                            <div className="flex items-start gap-1 text-[9px] text-slate-300 dark:text-[#c9d1d9]">
                                                <MapPin size={10} className="text-emerald-400 shrink-0 mt-0.5" />
                                                <span className="line-clamp-2 leading-tight">In: {hoveredRecord.time_in_address}</span>
                                            </div>
                                        )}
                                        {hoveredRecord.time_out_address && hoveredRecord.time_out_address !== '-' && (
                                            <div className="flex items-start gap-1 text-[9px] text-slate-300 dark:text-[#c9d1d9]">
                                                <MapPin size={10} className="text-rose-400 shrink-0 mt-0.5" />
                                                <span className="line-clamp-2 leading-tight">Out: {hoveredRecord.time_out_address}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : null}

                                {/* Selfie Thumbnails */}
                                {(hoveredRecord.time_in_image || hoveredRecord.time_out_image) && (
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 dark:border-[#30363d]/60">
                                        {[
                                            { label: 'In', img: hoveredRecord.time_in_image },
                                            { label: 'Out', img: hoveredRecord.time_out_image }
                                        ].map((item, i) => (
                                            <div key={i} className="relative h-14 rounded-lg border border-slate-700 dark:border-[#30363d] overflow-hidden bg-slate-900 shadow-sm flex flex-col justify-between">
                                                {item.img ? (
                                                    <img src={item.img} alt={`Selfie ${item.label}`} className="w-full h-full object-contain" />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full pb-2 gap-0.5 opacity-40">
                                                        <span className="text-sm">📷</span>
                                                        <span className="text-[5px] font-bold uppercase tracking-wider text-slate-400">No Photo</span>
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-[6px] text-center uppercase py-0.5 font-black tracking-wider text-white leading-none border-t border-slate-800/40">
                                                    Punch {item.label}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Image Preview Lightbox */}
            {previewImage && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setPreviewImage(null)}
                    >
                        <button
                            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                            onClick={() => setPreviewImage(null)}
                        >
                            <XCircle size={32} />
                        </button>
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={previewImage}
                            alt="Selfie Preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </DashboardLayout>
    );
};

export default Reports;
