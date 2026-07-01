import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Download,
    Calendar,
    ChevronDown,
    History as HistoryIcon,
    Eye,
    FileText,
    Clock,
    Table,
    TrendingUp,
    Activity,
    CheckCircle2,
    ArrowRight,
    Search,
    X,
    AlertCircle,
    DownloadCloud,
    FileSpreadsheet,
    FileType,
    User,
    MapPin
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import MonthPicker from '../../components/MonthPicker';
import MobileDatePicker from '../../components/MobileDatePicker';

const getAlignmentClass = (colHeader) => {
    if (!colHeader) return 'center';
    const header = colHeader.toLowerCase();
    if (['name', 'department', 'dept', 'employee', 'reason', 'location', 'in location', 'out location', 'email', 'phone', 'role', 'designation', 'position'].some(k => header.includes(k))) {
        return 'left';
    }
    return 'center';
};

const getCellStyle = (cellValue, colHeader, isTotalsRow, isEven) => {
    const val = cellValue?.toString().trim() || '';
    const header = colHeader.toLowerCase();

    // 1. Totals row styling
    if (isTotalsRow) {
        return {
            fontWeight: 'bold',
            color: '#1F4E78',
            backgroundColor: '#F2F4F7',
            borderTop: '2px solid #1F4E78',
            borderBottom: '4px double #1F4E78',
            borderLeft: '1px solid #CBD5E1',
            borderRight: '1px solid #CBD5E1',
            paddingTop: '6px',
            paddingBottom: '6px',
        };
    }

    // Default borders
    const defaultBorder = '1px solid #CBD5E1';

    // 2. Conditional formatting based on cell values (Excel replica colors)
    // Present or 1.0 status (Green)
    if (val === 'Present' || val === '1.0') {
        return {
            backgroundColor: '#E6F4EA',
            color: '#137333',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    // Absent or 0.0 status (Red)
    if (val === 'Absent' || val === '0.0') {
        return {
            backgroundColor: '#FCE8E6',
            color: '#C5221F',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    // Late or Late Minutes/Count > 0 (Orange)
    if (val.toLowerCase().includes('late') || (header.includes('late') && Number(val) > 0)) {
        return {
            backgroundColor: '#FEF7E0',
            color: '#B06000',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    // Weekend Sat/Sun/WEEK_OFF (Lavender)
    if (val === 'Sun' || val === 'Sat' || val === 'WEEK_OFF') {
        return {
            backgroundColor: '#F1F3F4',
            color: '#5F6368',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    // Not Recorded status (Soft grey font)
    if (val === 'Not Recorded') {
        return {
            backgroundColor: '#F1F3F4',
            color: '#8E8E93',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    // Leaves status
    if (val.toLowerCase() === 'on leave' || val.toLowerCase() === 'leave' || val.toLowerCase() === 'half day') {
        return {
            backgroundColor: '#E8F0FE',
            color: '#1A73E8',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }

    // Default Zebra Striping Styles
    return {
        backgroundColor: isEven ? '#F8FAFC' : '#FFFFFF',
        color: '#333333',
        border: defaultBorder
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
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-[#161b22]/40 p-3 rounded-xl">
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

const mvGetStatusColor = (status) => {
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

const mvGetStatusLabel = (status) => {
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

const MobileReports = () => {
    // Attendance View Filters State
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

    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [shifts, setShifts] = useState([]);

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

    // Shift states
    const [attendanceShiftId, setAttendanceShiftId] = useState('');
    const [attendanceShiftSearchQuery, setAttendanceShiftSearchQuery] = useState('');
    const [attendanceIsShiftDropdownOpen, setAttendanceIsShiftDropdownOpen] = useState(false);

    const [tableShiftId, setTableShiftId] = useState('');
    const [tableShiftSearchQuery, setTableShiftSearchQuery] = useState('');
    const [tableIsShiftDropdownOpen, setTableIsShiftDropdownOpen] = useState(false);

    // Refs
    const attendanceEmpDropdownRef = React.useRef(null);
    const attendanceWeekDropdownRef = React.useRef(null);
    const attendanceDeptDropdownRef = React.useRef(null);
    const attendanceDesgDropdownRef = React.useRef(null);
    const attendanceShiftDropdownRef = React.useRef(null);
    const tableEmpDropdownRef = React.useRef(null);
    const tableTypeDropdownRef = React.useRef(null);
    const tableWeekDropdownRef = React.useRef(null);
    const tableColsDropdownRef = React.useRef(null);
    const tableDeptDropdownRef = React.useRef(null);
    const tableDesgDropdownRef = React.useRef(null);
    const tableShiftDropdownRef = React.useRef(null);

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
            if (attendanceShiftDropdownRef.current && !attendanceShiftDropdownRef.current.contains(event.target)) {
                setAttendanceIsShiftDropdownOpen(false);
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
            if (tableShiftDropdownRef.current && !tableShiftDropdownRef.current.contains(event.target)) {
                setTableIsShiftDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const attendanceSelectedEmployeeName = employees.find(emp => emp.user_id === attendanceEmployeeId)?.user_name || 'All Employees';
    const attendanceFilteredEmployees = employees.filter(emp => {
        const matchesDept = !attendanceDeptId || String(emp.dept_id) === String(attendanceDeptId);
        const matchesDesg = !attendanceDesgId || String(emp.desg_id) === String(attendanceDesgId);
        const matchesShift = !attendanceShiftId || String(emp.shift_id) === String(attendanceShiftId);
        const matchesQuery = emp.user_name.toLowerCase().includes(attendanceEmpSearchQuery.toLowerCase());
        return matchesDept && matchesDesg && matchesShift && matchesQuery;
    });

    const tableSelectedEmployeeName = employees.find(emp => emp.user_id === tableEmployeeId)?.user_name || 'All Employees';
    const tableFilteredEmployees = employees.filter(emp => {
        const matchesDept = !tableDeptId || String(emp.dept_id) === String(tableDeptId);
        const matchesDesg = !tableDesgId || String(emp.desg_id) === String(tableDesgId);
        const matchesShift = !tableShiftId || String(emp.shift_id) === String(tableShiftId);
        const matchesQuery = emp.user_name.toLowerCase().includes(tableEmpSearchQuery.toLowerCase());
        return matchesDept && matchesDesg && matchesShift && matchesQuery;
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
                const shiftMismatch = attendanceShiftId && String(emp.shift_id) !== String(attendanceShiftId);
                if (deptMismatch || desgMismatch || shiftMismatch) {
                    setAttendanceEmployeeId('');
                }
            }
        }
    }, [attendanceDeptId, attendanceDesgId, attendanceShiftId, employees, attendanceEmployeeId]);

    useEffect(() => {
        if (tableEmployeeId) {
            const emp = employees.find(e => e.user_id === tableEmployeeId);
            if (emp) {
                const deptMismatch = tableDeptId && String(emp.dept_id) !== String(tableDeptId);
                const desgMismatch = tableDesgId && String(emp.desg_id) !== String(tableDesgId);
                const shiftMismatch = tableShiftId && String(emp.shift_id) !== String(tableShiftId);
                if (deptMismatch || desgMismatch || shiftMismatch) {
                    setTableEmployeeId('');
                }
            }
        }
    }, [tableDeptId, tableDesgId, tableShiftId, employees, tableEmployeeId]);

    useEffect(() => {
        const fetchEmployeesAndDepts = async () => {
            try {
                const [empRes, deptRes, desgRes, shiftRes] = await Promise.all([
                    adminService.getAllUsers(),
                    adminService.getDepartments(),
                    adminService.getDesignations(),
                    adminService.getShifts()
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
                if (shiftRes && shiftRes.shifts) {
                    const sortedShifts = [...shiftRes.shifts].sort((a, b) => a.shift_name.localeCompare(b.shift_name));
                    setShifts(sortedShifts);
                }
            } catch (err) {
                console.error("Failed to load filter metadata (mobile)", err);
            }
        };
        fetchEmployeesAndDepts();
    }, []);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: 'preview' }
        }));
    }, []);

    const reportTypes = [
        { id: 'attendance_matrix_daily', label: 'Daily Attendance Matrix' },
        { id: 'matrix_daily', label: 'Daily Attendance Report' },
        { id: 'attendance_detailed', label: 'Detailed Log' },
        { id: 'employee_master', label: 'Employee Master Data' },
        { id: 'lateness_report', label: 'Lateness Report' },
        { id: 'attendance_matrix_monthly', label: 'Monthly Attendance Matrix' },
        { id: 'matrix_monthly', label: 'Monthly Attendance Report' },
        { id: 'attendance_summary', label: 'Monthly Summary Report' },
        { id: 'attendance_matrix_weekly', label: 'Weekly Attendance Matrix' },
        { id: 'matrix_weekly', label: 'Weekly Attendance Report' }
    ];

    const fileFormats = [
        { id: 'xlsx', label: 'XLSX', icon: FileSpreadsheet, color: 'emerald' },
        { id: 'csv', label: 'CSV', icon: FileType, color: 'blue' },
        { id: 'pdf', label: 'PDF', icon: FileText, color: 'rose' }
    ];

    // Export History
    const [exportHistory, setExportHistory] = useState(() => {
        const savedHistory = localStorage.getItem('attendance_export_history');
        return savedHistory ? JSON.parse(savedHistory) : [];
    });

    useEffect(() => {
        localStorage.setItem('attendance_export_history', JSON.stringify(exportHistory));
    }, [exportHistory]);

    // Preview Data State
    const [previewData, setPreviewData] = useState({ columns: [], rows: [] });
    const [loadingPreview, setLoadingPreview] = useState(false);

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
        const selectedShiftId = isCard ? attendanceShiftId : tableShiftId;
        const useCustomRange = isCard ? false : tableUseCustomRange;
        const customStartDate = isCard ? '' : tableCustomStartDate;
        const customEndDate = isCard ? '' : tableCustomEndDate;
        const exportColumnsObj = isCard ? {
            shift: true,
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
            selectedShiftId,
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
        attendanceReportType, attendanceMonth, attendanceDate, attendanceWeek, attendanceEmployeeId, attendanceDeptId, attendanceDesgId, attendanceShiftId,
        tableReportType, tableMonth, tableDate, tableWeek, tableEmployeeId, tableDeptId, tableDesgId, tableShiftId, tableUseCustomRange, tableCustomStartDate, tableCustomEndDate, tableExportColumns
    ]);

    // Fetch Preview
    useEffect(() => {
        let cancelled = false;
        const fetchPreview = async () => {
            setLoadingPreview(true);
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
                    activeFilters.selectedDesgId,
                    activeFilters.selectedShiftId
                );
                if (!cancelled && res.ok) {
                    setPreviewData(res.data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("fetchPreview failed (mobile):", error);
                    toast.error("Failed to load preview data");
                }
            } finally {
                if (!cancelled) setLoadingPreview(false);
            }
        };
        fetchPreview();
        return () => { cancelled = true; };
    }, [activeFilters]);

    // Reset selection states when active filter settings or view modes change
    useEffect(() => {
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
                tableDesgId,
                tableShiftId
            );
            if (res.ok) {
                const reportId = res.reportId;
                const filename = `Report_${tableReportType}_${tableUseCustomRange ? `${tableCustomStartDate}_to_${tableCustomEndDate}` : (tableMonth || dateToUse)}.${tableFileFormat}`;
                const reportTypeLabel = reportTypes.find(r => r.id === tableReportType)?.label || tableReportType;
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
            console.error(error);
            toast.error(error.message || "Failed to queue report");
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

    const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(activeFilters.reportType);
    const displayedPeriod = activeFilters.useCustomRange
        ? `${activeFilters.customStartDate} to ${activeFilters.customEndDate}`
        : (isWeekly ? (tableWeeks.find(w => w.value === activeFilters.selectedWeek)?.label || activeFilters.selectedWeek) : (activeFilters.selectedMonth || activeFilters.selectedDate));
    const selectedReportTypeLabel = reportTypes.find(opt => opt.id === activeFilters.reportType)?.label || activeFilters.reportType;
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
        <MobileDashboardLayout title="Reports & Exports">
            <div className="min-h-screen bg-slate-50 dark:bg-black pb-24 transition-colors duration-300">

                {/* --- HEADER AREA --- */}
                <div className="px-5 pt-6 space-y-6">
                    {/* Quick Info Bar */}
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                <FileText size={16} />
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase leading-none">{reportType.replace(/_/g, ' ')}</h3>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Live Data & Past Exports</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full">
                            <Clock size={10} className="text-slate-400" />
                            <span className="text-[9px] font-black text-slate-500">{displayedPeriod}</span>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-6 space-y-6">
                    {/* View Switcher Tabs (tab bar is kept below the header) */}
                    <div className="bg-[#f6f8fa] dark:bg-github-dark-subtle p-1 flex rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm">
                        {[
                            { id: 'card', label: 'Attendance View' },
                            { id: 'table', label: 'Full Report' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setPreviewMode(tab.id)}
                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${previewMode === tab.id
                                        ? 'bg-white dark:bg-[#21262d] text-indigo-600 dark:text-indigo-400 transform scale-[1.01] shadow-sm border border-slate-200 dark:border-github-dark-border'
                                        : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-100 dark:hover:bg-[#21262d]/50'
                                    }`}
                            >
                                {tab.id === 'card' ? <TrendingUp size={12} /> : <Table size={12} />}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Stats Dashboard */}
                    {previewData && previewData.rows && previewData.rows.length > 0 && (
                        <div className="grid grid-cols-2 gap-3.5 mt-2 animate-in fade-in duration-300">
                            <div className="bg-white dark:bg-black border border-slate-200 dark:border-github-dark-border p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-[8px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider block">Records</span>
                                    <h4 className="text-lg font-black text-slate-800 dark:text-github-dark-text mt-1">{stats.total}</h4>
                                </div>
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                    <User size={14} />
                                </div>
                            </div>

                            <div className="bg-white dark:bg-black border border-slate-200 dark:border-github-dark-border p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-[8px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider block">Avg Hours</span>
                                    <h4 className="text-lg font-black text-slate-800 dark:text-github-dark-text mt-1">{stats.avgHrs}h</h4>
                                </div>
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                    <Clock size={14} />
                                </div>
                            </div>

                            <div className="bg-white dark:bg-black border border-slate-200 dark:border-github-dark-border p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-[8px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider block">Present %</span>
                                    <h4 className="text-lg font-black text-slate-800 dark:text-github-dark-text mt-1">
                                        {stats.presentRate !== null ? `${stats.presentRate}%` : 'N/A'}
                                    </h4>
                                </div>
                                <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-purple-650 dark:text-purple-400 rounded-xl">
                                    <CheckCircle2 size={14} />
                                </div>
                            </div>

                            <div className="bg-white dark:bg-black border border-slate-200 dark:border-github-dark-border p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-[8px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider block">Late Count</span>
                                    <h4 className="text-lg font-black text-slate-800 dark:text-github-dark-text mt-1">
                                        {stats.lateCount !== null ? stats.lateCount : 0}
                                    </h4>
                                </div>
                                <div className="p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl">
                                    <AlertCircle size={14} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CONFIGURATION PANEL --- */}
                    {previewMode === 'table' ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Custom Report Type Dropdown */}
                                <div className="space-y-1.5 relative animate-none" ref={tableTypeDropdownRef}>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Type</label>
                                    <button
                                        type="button"
                                        onClick={() => setTableIsTypeDropdownOpen(!tableIsTypeDropdownOpen)}
                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                    >
                                        <span className="truncate">{selectedReportTypeLabel}</span>
                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${tableIsTypeDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {tableIsTypeDropdownOpen && (
                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                            {reportTypes.map((t) => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setTableReportType(t.id);
                                                        setTableIsTypeDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${tableReportType === t.id
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                        }`}
                                                >
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Custom Searchable Department Selector */}
                                <div className="space-y-1.5 relative animate-none" ref={tableDeptDropdownRef}>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Department</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTableIsDeptDropdownOpen(!tableIsDeptDropdownOpen);
                                            setTableDeptSearchQuery('');
                                        }}
                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                    >
                                        <span className="truncate">
                                            {departments.find(d => d.dept_id === tableDeptId)?.dept_name || 'All Departments'}
                                        </span>
                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${tableIsDeptDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {tableIsDeptDropdownOpen && (
                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                            <div className="relative mb-2">
                                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search departments..."
                                                    value={tableDeptSearchQuery}
                                                    onChange={(e) => setTableDeptSearchQuery(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTableDeptId('');
                                                        setTableIsDeptDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${tableDeptId === ''
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${tableDeptId === d.dept_id
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                <div className="space-y-1.5 relative animate-none" ref={tableDesgDropdownRef}>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Designation</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTableIsDesgDropdownOpen(!tableIsDesgDropdownOpen);
                                            setTableDesgSearchQuery('');
                                        }}
                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                    >
                                        <span className="truncate">
                                            {designations.find(d => String(d.desg_id) === String(tableDesgId))?.desg_name || 'All Designations'}
                                        </span>
                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${tableIsDesgDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {tableIsDesgDropdownOpen && (
                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                            <div className="relative mb-2">
                                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search designations..."
                                                    value={tableDesgSearchQuery}
                                                    onChange={(e) => setTableDesgSearchQuery(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTableDesgId('');
                                                        setTableIsDesgDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${tableDesgId === ''
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${String(tableDesgId) === String(d.desg_id)
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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

                                {/* Custom Searchable Shift Selector */}
                                <div className="space-y-1.5 relative animate-none" ref={tableShiftDropdownRef}>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Shift</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTableIsShiftDropdownOpen(!tableIsShiftDropdownOpen);
                                            setTableShiftSearchQuery('');
                                        }}
                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                    >
                                        <span className="truncate">
                                            {shifts.find(s => String(s.shift_id) === String(tableShiftId))?.shift_name || 'All Shifts'}
                                        </span>
                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${tableIsShiftDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {tableIsShiftDropdownOpen && (
                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                            <div className="relative mb-2">
                                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search shifts..."
                                                    value={tableShiftSearchQuery}
                                                    onChange={(e) => setTableShiftSearchQuery(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTableShiftId('');
                                                        setTableIsShiftDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${tableShiftId === ''
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                        }`}
                                                >
                                                    All Shifts
                                                </button>
                                                {shifts.filter(s => s.shift_name.toLowerCase().includes(tableShiftSearchQuery.toLowerCase())).length > 0 ? (
                                                    shifts.filter(s => s.shift_name.toLowerCase().includes(tableShiftSearchQuery.toLowerCase())).map(s => (
                                                        <button
                                                            key={s.shift_id}
                                                            type="button"
                                                            onClick={() => {
                                                                setTableShiftId(s.shift_id);
                                                                setTableIsShiftDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${String(tableShiftId) === String(s.shift_id)
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                                }`}
                                                        >
                                                            {s.shift_name}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                                        No shifts found
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Employee Selector */}
                            <div className="space-y-1.5 relative animate-none" ref={tableEmpDropdownRef}>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Employee</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTableIsEmpDropdownOpen(!tableIsEmpDropdownOpen);
                                        setTableEmpSearchQuery('');
                                    }}
                                    className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                >
                                    <span className="truncate">{tableSelectedEmployeeName}</span>
                                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${tableIsEmpDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {tableIsEmpDropdownOpen && (
                                    <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                        <div className="relative mb-2">
                                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search..."
                                                value={tableEmpSearchQuery}
                                                onChange={(e) => setTableEmpSearchQuery(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTableEmployeeId('');
                                                    setTableIsEmpDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${tableEmployeeId === ''
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${tableEmployeeId === emp.user_id
                                                                ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                            }`}
                                                    >
                                                        {emp.user_name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-[10px] text-slate-400 dark:text-github-dark-muted text-center py-3 font-bold uppercase tracking-widest">
                                                    No results
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Date Picker Section */}
                            {tableUseCustomRange ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <MobileDatePicker
                                        label="Start Date"
                                        value={tableCustomStartDate}
                                        onChange={setTableCustomStartDate}
                                    />
                                    <MobileDatePicker
                                        label="End Date"
                                        value={tableCustomEndDate}
                                        onChange={setTableCustomEndDate}
                                    />
                                </div>
                            ) : (
                                tableReportType !== 'employee_master' && (
                                    <div className="w-full">
                                        {['matrix_monthly', 'attendance_matrix_monthly', 'lateness_report', 'attendance_detailed', 'attendance_summary'].includes(tableReportType) ? (
                                            <MonthPicker
                                                label="Period"
                                                value={tableMonth}
                                                onChange={setTableMonth}
                                            />
                                        ) : ['matrix_weekly', 'attendance_matrix_weekly'].includes(tableReportType) ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <MonthPicker
                                                    label="Period"
                                                    value={tableMonth}
                                                    onChange={setTableMonth}
                                                />
                                                <div className="space-y-1.5 relative" ref={tableWeekDropdownRef}>
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Select Week</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setTableIsWeekDropdownOpen(!tableIsWeekDropdownOpen)}
                                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                                    >
                                                        <span className="truncate">{tableWeeks.find(w => w.value === tableWeek)?.label || 'Select Week'}</span>
                                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${tableIsWeekDropdownOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {tableIsWeekDropdownOpen && (
                                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                            {tableWeeks.map((w, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setTableWeek(w.value);
                                                                        setTableIsWeekDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${tableWeek === w.value
                                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                            <MobileDatePicker
                                                label="Period"
                                                value={tableDate}
                                                onChange={setTableDate}
                                            />
                                        )}
                                    </div>
                                )
                            )}

                            {/* Custom Date Range Toggle */}
                            <button
                                type="button"
                                id="useCustomRangeMobile"
                                onClick={() => setTableUseCustomRange(!tableUseCustomRange)}
                                className="flex items-center gap-2.5 px-1 cursor-pointer focus:outline-none"
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${tableUseCustomRange
                                        ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                                        : 'bg-white dark:bg-black border-slate-300 dark:border-white/10'
                                    }`}>
                                    {tableUseCustomRange && (
                                        <svg className="w-2.5 h-2.5 stroke-[3] stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-[10px] font-black text-slate-500 dark:text-github-dark-muted select-none uppercase tracking-widest">
                                    Use Custom Date Range
                                </span>
                            </button>

                            {/* Columns Selection Dropdown */}
                            {tableReportType !== 'employee_master' && (
                                <div className="space-y-1.5 relative animate-none" ref={tableColsDropdownRef}>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Columns to Include</label>
                                    <button
                                        type="button"
                                        onClick={() => setTableIsColsDropdownOpen(!tableIsColsDropdownOpen)}
                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                    >
                                        <span className="truncate">
                                            {Object.values(tableExportColumns).filter(Boolean).length} Columns Selected
                                        </span>
                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${tableIsColsDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {tableIsColsDropdownOpen && (
                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-3 space-y-3">
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
                                                            ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                                                            : 'bg-white dark:bg-black border-slate-300 dark:border-white/10 group-hover:border-indigo-400'
                                                        }`}>
                                                        {tableExportColumns[col.id] && (
                                                            <svg className="w-2.5 h-2.5 stroke-[3] stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-600 dark:text-github-dark-muted select-none">
                                                        {col.label}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Format Selection */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">File Format</label>
                                <div className="flex gap-2">
                                    {fileFormats.map((f) => (
                                        <button
                                            key={f.id}
                                            onClick={() => setTableFileFormat(f.id)}
                                            className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border transition-all duration-300 ${tableFileFormat === f.id
                                                    ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                    : 'bg-slate-50 dark:bg-black/20 border-slate-100 dark:border-white/5 text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            <f.icon size={14} />
                                            <span className="text-[10px] font-black uppercase">{f.id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-2.5">
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="w-full py-4 bg-[#1f2937] dark:bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} strokeWidth={3} />
                                            <span>Generate & Download</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsHistorySidebarOpen(true)}
                                    className="w-full py-3.5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl text-xs font-bold text-slate-700 dark:text-[#c9d1d9] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                                >
                                    <HistoryIcon size={14} />
                                    <span>View Export History</span>
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        /* Compact filters for Attendance View on mobile */
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Custom Searchable Department Selector */}
                                <div className="space-y-1.5 relative animate-none" ref={attendanceDeptDropdownRef}>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Department</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAttendanceIsDeptDropdownOpen(!attendanceIsDeptDropdownOpen);
                                            setAttendanceDeptSearchQuery('');
                                        }}
                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                    >
                                        <span className="truncate">
                                            {departments.find(d => d.dept_id === attendanceDeptId)?.dept_name || 'All Departments'}
                                        </span>
                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${attendanceIsDeptDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {attendanceIsDeptDropdownOpen && (
                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                            <div className="relative mb-2">
                                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search departments..."
                                                    value={attendanceDeptSearchQuery}
                                                    onChange={(e) => setAttendanceDeptSearchQuery(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAttendanceDeptId('');
                                                        setAttendanceIsDeptDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${attendanceDeptId === ''
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${attendanceDeptId === d.dept_id
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                <div className="space-y-1.5 relative animate-none" ref={attendanceDesgDropdownRef}>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Designation</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAttendanceIsDesgDropdownOpen(!attendanceIsDesgDropdownOpen);
                                            setAttendanceDesgSearchQuery('');
                                        }}
                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                    >
                                        <span className="truncate">
                                            {designations.find(d => String(d.desg_id) === String(attendanceDesgId))?.desg_name || 'All Designations'}
                                        </span>
                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${attendanceIsDesgDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {attendanceIsDesgDropdownOpen && (
                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                            <div className="relative mb-2">
                                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search designations..."
                                                    value={attendanceDesgSearchQuery}
                                                    onChange={(e) => setAttendanceDesgSearchQuery(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAttendanceDesgId('');
                                                        setAttendanceIsDesgDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${attendanceDesgId === ''
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${String(attendanceDesgId) === String(d.desg_id)
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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

                                {/* Custom Searchable Shift Selector */}
                                <div className="space-y-1.5 relative animate-none" ref={attendanceShiftDropdownRef}>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Shift</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAttendanceIsShiftDropdownOpen(!attendanceIsShiftDropdownOpen);
                                            setAttendanceShiftSearchQuery('');
                                        }}
                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                    >
                                        <span className="truncate">
                                            {shifts.find(s => String(s.shift_id) === String(attendanceShiftId))?.shift_name || 'All Shifts'}
                                        </span>
                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${attendanceIsShiftDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {attendanceIsShiftDropdownOpen && (
                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                            <div className="relative mb-2">
                                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search shifts..."
                                                    value={attendanceShiftSearchQuery}
                                                    onChange={(e) => setAttendanceShiftSearchQuery(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAttendanceShiftId('');
                                                        setAttendanceIsShiftDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${attendanceShiftId === ''
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                        }`}
                                                >
                                                    All Shifts
                                                </button>
                                                {shifts.filter(s => s.shift_name.toLowerCase().includes(attendanceShiftSearchQuery.toLowerCase())).length > 0 ? (
                                                    shifts.filter(s => s.shift_name.toLowerCase().includes(attendanceShiftSearchQuery.toLowerCase())).map(s => (
                                                        <button
                                                            key={s.shift_id}
                                                            type="button"
                                                            onClick={() => {
                                                                setAttendanceShiftId(s.shift_id);
                                                                setAttendanceIsShiftDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${String(attendanceShiftId) === String(s.shift_id)
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                                }`}
                                                        >
                                                            {s.shift_name}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                                        No shifts found
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Employee Selector */}
                                <div className="space-y-1.5 relative animate-none col-span-2" ref={attendanceEmpDropdownRef}>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Employee</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAttendanceIsEmpDropdownOpen(!attendanceIsEmpDropdownOpen);
                                            setAttendanceEmpSearchQuery('');
                                        }}
                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                    >
                                        <span className="truncate">{attendanceSelectedEmployeeName}</span>
                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${attendanceIsEmpDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {attendanceIsEmpDropdownOpen && (
                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                            <div className="relative mb-2">
                                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search..."
                                                    value={attendanceEmpSearchQuery}
                                                    onChange={(e) => setAttendanceEmpSearchQuery(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-white"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAttendanceEmployeeId('');
                                                        setAttendanceIsEmpDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${attendanceEmployeeId === ''
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${attendanceEmployeeId === emp.user_id
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                                }`}
                                                        >
                                                            {emp.user_name}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="text-[10px] text-slate-400 dark:text-github-dark-muted text-center py-3 font-bold uppercase tracking-widest">
                                                        No results
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Period Picker */}
                                {attendanceReportType !== 'employee_master' && (
                                    <div className="col-span-2 w-full">
                                        {['matrix_monthly', 'attendance_matrix_monthly', 'lateness_report', 'attendance_detailed', 'attendance_summary'].includes(attendanceReportType) ? (
                                            <MonthPicker
                                                label="Period"
                                                value={attendanceMonth}
                                                onChange={setAttendanceMonth}
                                            />
                                        ) : ['matrix_weekly', 'attendance_matrix_weekly'].includes(attendanceReportType) ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <MonthPicker
                                                    label="Period"
                                                    value={attendanceMonth}
                                                    onChange={setAttendanceMonth}
                                                />
                                                <div className="space-y-1.5 relative" ref={attendanceWeekDropdownRef}>
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Select Week</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAttendanceIsWeekDropdownOpen(!attendanceIsWeekDropdownOpen)}
                                                        className="w-full flex items-center justify-between pl-3 pr-4 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer text-left"
                                                    >
                                                        <span className="truncate">{attendanceWeeks.find(w => w.value === attendanceWeek)?.label || 'Select Week'}</span>
                                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${attendanceIsWeekDropdownOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {attendanceIsWeekDropdownOpen && (
                                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl shadow-xl z-50 p-2 max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                            {attendanceWeeks.map((w, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setAttendanceWeek(w.value);
                                                                        setAttendanceIsWeekDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition-colors ${attendanceWeek === w.value
                                                                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                            <MobileDatePicker
                                                label="Period"
                                                value={attendanceDate}
                                                onChange={setAttendanceDate}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* --- PREVIEW AREA --- */}
                    {previewMode === 'card' ? (
                        /* Attendance View: Direct full-page rendering without outer card wrapper */
                        loadingPreview ? (
                            <div className="bg-white dark:bg-github-dark-subtle rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm p-8 flex flex-col items-center justify-center gap-3">
                                <div className="w-8 h-8 border-3 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-500 rounded-full animate-spin" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Crunching records...</p>
                            </div>
                        ) : (matrixData.employees && matrixData.employees.length > 0) ? (
                            <div className="w-full overflow-auto rounded-2xl border border-slate-100 dark:border-white/5 bg-white dark:bg-github-dark-subtle shadow-sm animate-none" style={{ maxHeight: 'calc(100vh - 280px)', isolation: 'isolate' }}>
                                <table className="text-left border-collapse" style={{ minWidth: 'max-content' }}>
                                    <thead className="sticky top-0 z-20">
                                        <tr className="bg-slate-50 dark:bg-github-dark-bg/60 border-b border-slate-100 dark:border-white/10">
                                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-github-dark-muted sticky left-0 bg-slate-50 dark:bg-github-dark-bg/60 z-30 min-w-[160px] border-r border-slate-100 dark:border-white/10" style={{ boxShadow: '1px 0 4px rgba(0,0,0,0.05)' }}>Employee</th>
                                            {matrixData.dates.map(rawDate => {
                                                const d = new Date(rawDate + 'T00:00:00Z');
                                                return (
                                                    <th key={rawDate} className="py-1.5 px-0.5 text-center min-w-[44px]">
                                                        <div className="text-[7px] uppercase text-slate-400 leading-none">{d.toLocaleString('en-US', { month: 'short' })}</div>
                                                        <div className="text-xs font-black text-slate-700 dark:text-white leading-tight">{d.getUTCDate()}</div>
                                                        <div className="text-[7px] uppercase text-slate-400 leading-none">{d.toLocaleString('en-US', { weekday: 'short' })}</div>
                                                    </th>
                                                );
                                            })}
                                            <th className="py-1.5 px-1 text-center min-w-[40px] border-l border-slate-100 dark:border-white/10 bg-emerald-50/50 dark:bg-emerald-950/20">
                                                <div className="text-[7px] uppercase text-slate-400 leading-none">Total</div>
                                                <div className="text-xs font-black text-emerald-700 dark:text-emerald-400 leading-tight">P</div>
                                            </th>
                                            <th className="py-1.5 px-1 text-center min-w-[40px] bg-rose-50/50 dark:bg-rose-950/20">
                                                <div className="text-[7px] uppercase text-slate-400 leading-none">Total</div>
                                                <div className="text-xs font-black text-rose-700 dark:text-rose-400 leading-tight">A</div>
                                            </th>
                                            <th className="py-1.5 px-1 text-center min-w-[40px] bg-sky-50/50 dark:bg-sky-950/20">
                                                <div className="text-[7px] uppercase text-slate-400 leading-none">Total</div>
                                                <div className="text-xs font-black text-sky-700 dark:text-sky-400 leading-tight">L</div>
                                            </th>
                                            <th className="py-1.5 px-1 text-center min-w-[40px] bg-indigo-50/50 dark:bg-indigo-950/20">
                                                <div className="text-[7px] uppercase text-slate-400 leading-none">Total</div>
                                                <div className="text-xs font-black text-indigo-700 dark:text-indigo-400 leading-tight">HD</div>
                                            </th>
                                            <th className="py-1.5 px-1 text-center min-w-[40px] bg-slate-100/50 dark:bg-slate-800/40">
                                                <div className="text-[7px] uppercase text-slate-400 leading-none">Total</div>
                                                <div className="text-xs font-black text-slate-600 dark:text-slate-400 leading-tight">WO</div>
                                            </th>
                                            <th className="py-1.5 px-1 text-center min-w-[48px] bg-purple-50/50 dark:bg-purple-950/20">
                                                <div className="text-[7px] uppercase text-slate-400 leading-none">Total</div>
                                                <div className="text-xs font-black text-purple-700 dark:text-purple-400 leading-tight">OT (h)</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                        {matrixData.employees.map((emp) => {
                                            const initials = emp.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                            return (
                                                <tr key={emp.user_id} className="group active:bg-slate-50 dark:active:bg-white/5 transition-colors">
                                                    <td className="px-3 py-3 sticky left-0 bg-white dark:bg-github-dark-subtle group-hover:bg-slate-50/80 dark:group-hover:bg-github-dark-bg/20 transition-colors z-20 border-r border-slate-100 dark:border-white/10" style={{ boxShadow: '1px 0 3px rgba(0,0,0,0.04)' }}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[9px] shadow-inner shrink-0">
                                                                {initials || <User size={10} />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="block font-bold text-slate-800 dark:text-white text-[10px] leading-tight truncate max-w-[105px]">{emp.user_name}</span>
                                                                <span className="block text-[7px] font-medium text-slate-400 mt-0.5 truncate max-w-[105px]">{emp.department}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {matrixData.dates.map(rawDate => {
                                                        const record = emp.records[rawDate];
                                                        const status = record?.status || '-';
                                                        const isNonClickableStatus = ['Sun', 'Sat', 'WEEK_OFF', 'Not Recorded', '-'].includes(status);
                                                        const isClickable = !!record && !isNonClickableStatus;
                                                        return (
                                                            <td key={rawDate} className="px-0.5 py-2.5 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { if (isClickable) { setSelectedRecord(record); setIsDetailSidebarOpen(true); } }}
                                                                    title={record ? `${status} — ${record.date}` : 'No data'}
                                                                    className={`w-8 h-8 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all inline-flex items-center justify-center shadow-sm ${mvGetStatusColor(status)} ${isClickable ? 'cursor-pointer active:scale-90' : 'cursor-default'}`}
                                                                >
                                                                    {mvGetStatusLabel(status)}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-1 py-2.5 text-center border-l border-slate-100 dark:border-white/10 bg-emerald-50/20 dark:bg-emerald-950/10 font-bold text-xs text-emerald-700 dark:text-emerald-400">
                                                        {emp.stats?.present || 0}
                                                    </td>
                                                    <td className="px-1 py-2.5 text-center bg-rose-50/20 dark:bg-rose-950/10 font-bold text-xs text-rose-700 dark:text-rose-400">
                                                        {emp.stats?.absent || 0}
                                                    </td>
                                                    <td className="px-1 py-2.5 text-center bg-sky-50/20 dark:bg-sky-950/10 font-bold text-xs text-sky-700 dark:text-sky-400">
                                                        {emp.stats?.leave || 0}
                                                    </td>
                                                    <td className="px-1 py-2.5 text-center bg-indigo-50/20 dark:bg-indigo-950/10 font-bold text-xs text-indigo-700 dark:text-indigo-400">
                                                        {emp.stats?.halfDay || 0}
                                                    </td>
                                                    <td className="px-1 py-2.5 text-center bg-slate-50 dark:bg-slate-800/20 font-bold text-xs text-slate-500 dark:text-slate-400">
                                                        {emp.stats?.weeklyOff || 0}
                                                    </td>
                                                    <td className="px-1 py-2.5 text-center bg-purple-50/20 dark:bg-purple-950/10 font-bold text-xs text-purple-700 dark:text-purple-400">
                                                        {emp.stats?.overtimeHrs ? emp.stats.overtimeHrs.toFixed(1) : '0.0'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-slate-200 dark:border-white/5 rounded-2xl bg-white dark:bg-github-dark-subtle shadow-sm">
                                <Activity size={32} className="text-slate-200 dark:text-white/5" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">No results for this selection</p>
                            </div>
                        )
                    ) : (
                        /* Full Report View: Render Spreadsheet table inside the Card layout */
                        <div className="bg-white dark:bg-github-dark-subtle rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-github-dark-bg/10 flex flex-row items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
                                        <Table className="text-slate-400" size={14} />
                                        Preview Data
                                    </h3>
                                </div>
                                {previewData.rows?.length > 0 && (
                                    <span className="text-[8px] font-black text-slate-400 px-2.5 py-1 bg-slate-100 dark:bg-white/5 rounded-full border border-slate-200 dark:border-white/10">
                                        {previewData.rows.filter(row => row[0]?.toString().toUpperCase() !== 'TOTALS' && row[0]?.toString().toUpperCase() !== 'TOTAL').length} Records
                                    </span>
                                )}
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-[#0d1117] min-h-[200px]">
                                {loadingPreview ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                                        <div className="w-8 h-8 border-3 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-500 rounded-full animate-spin" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Crunching records...</p>
                                    </div>
                                ) : (previewData.rows && previewData.rows.length > 0) ? (
                                    /* Spreadsheet View: Render Original Excel replica table in scroll container */
                                    <div className="overflow-x-auto no-scrollbar">
                                        <table className="w-full text-left border-collapse min-w-max bg-white text-slate-800 shadow-sm rounded border border-slate-300" style={{ fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                                            <thead className="sticky top-0 z-10 bg-white/95 dark:bg-github-dark-bg/95 backdrop-blur-md">
                                                {previewData.headers ? (
                                                    <>
                                                        <tr className="text-[10px] uppercase font-bold border-b border-slate-200 dark:border-[#30363d]">
                                                            {previewData.headers[0].map((cell, idx) => (
                                                                <th
                                                                    key={idx}
                                                                    rowSpan={cell.rowspan}
                                                                    colSpan={cell.colspan}
                                                                    className="px-3 py-2.5 whitespace-nowrap tracking-wider text-center border border-[#3A6085]"
                                                                    style={{ backgroundColor: '#1F4E78', color: '#FFFFFF' }}
                                                                >
                                                                    {cell.label}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                        <tr className="text-[10px] uppercase font-bold">
                                                            {previewData.headers[1].map((cell, idx) => (
                                                                <th
                                                                    key={idx}
                                                                    className="px-3 py-2 whitespace-nowrap tracking-wider text-center border border-[#3A6085]"
                                                                    style={{ backgroundColor: '#1F4E78', color: '#FFFFFF' }}
                                                                >
                                                                    {cell.label}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </>
                                                ) : (
                                                    <tr className="text-[10px] uppercase font-bold border-b border-slate-200 dark:border-[#30363d]">
                                                        {previewData.columns.map((col, idx) => {
                                                            const alignment = getAlignmentClass(col);
                                                            return (
                                                                <th
                                                                    key={idx}
                                                                    className="px-3 py-2.5 whitespace-nowrap tracking-wider border border-[#3A6085]"
                                                                    style={{
                                                                        backgroundColor: '#1F4E78',
                                                                        color: '#FFFFFF',
                                                                        textAlign: alignment
                                                                    }}
                                                                >
                                                                    {col?.toString().split('\n').map((line, lIdx) => (
                                                                        <div key={lIdx} className="leading-tight">{line}</div>
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
                                                        <tr key={rIdx} className="transition-colors hover:bg-slate-100/50">
                                                            {row.map((cell, cIdx) => {
                                                                const colHeader = previewData.columns[cIdx]?.toString() || '';
                                                                const cellStyle = getCellStyle(cell, colHeader, isTotalsRow, isEven);
                                                                const alignment = getAlignmentClass(colHeader);
                                                                return (
                                                                    <td
                                                                        key={cIdx}
                                                                        className="px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors"
                                                                        style={{ ...cellStyle, textAlign: alignment }}
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
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-slate-200 dark:border-white/5 rounded-2xl bg-white dark:bg-github-dark-subtle/50">
                                        <Activity size={32} className="text-slate-200 dark:text-white/5" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">No results for this selection</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Mobile Export History Drawer */}
                    <AnimatePresence>
                        {isHistorySidebarOpen && (
                            <>
                                {/* Backdrop */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 0.4 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsHistorySidebarOpen(false)}
                                    className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-xs"
                                />
                                {/* Drawer Panel */}
                                <motion.div
                                    initial={{ x: '100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    className="fixed right-0 top-0 bottom-0 w-4/5 max-w-[320px] bg-white dark:bg-[#161b22] border-l border-slate-200 dark:border-[#30363d] shadow-2xl z-[101] flex flex-col"
                                >
                                    {/* Header */}
                                    <div className="p-4 border-b border-slate-200 dark:border-[#30363d] bg-slate-50/50 dark:bg-github-dark-subtle/10 flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                                            <DownloadCloud className="text-slate-400" size={14} />
                                            History
                                        </h3>
                                        <button
                                            onClick={() => setIsHistorySidebarOpen(false)}
                                            className="p-1 hover:bg-slate-100 dark:hover:bg-[#30363d] rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-text transition-colors cursor-pointer"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>

                                    {/* Body */}
                                    <div className="p-4 overflow-y-auto flex-1 no-scrollbar space-y-3 bg-[#f6f8fa] dark:bg-[#0d1117]">
                                        {exportHistory.length > 0 ? (
                                            exportHistory.map((report) => (
                                                <div key={report.id} className="bg-white dark:bg-[#161b22] p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm space-y-2">
                                                    <div className="flex items-start gap-2.5">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${report.name.endsWith('.pdf') ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10'
                                                                : report.name.endsWith('.csv') ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10'
                                                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                                                            }`}>
                                                            {report.name.endsWith('.pdf') ? <FileText size={14} /> : report.name.endsWith('.csv') ? <FileType size={14} /> : <FileSpreadsheet size={14} />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="text-[10px] font-black text-slate-800 dark:text-white truncate uppercase">{report.type}</h4>
                                                            <p className="text-[8px] font-bold text-slate-400 truncate mt-0.5">{report.name}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-50 dark:border-[#30363d]">
                                                        <span className="text-[8px] font-medium text-slate-400">{report.date.split(',')[0]}</span>
                                                        {report.status === 'Ready' ? (
                                                            <a
                                                                href={report.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                download={report.name}
                                                                className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 hover:bg-emerald-100 transition-all cursor-pointer"
                                                            >
                                                                DOWNLOAD
                                                            </a>
                                                        ) : report.status === 'Generating' ? (
                                                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 shrink-0 animate-pulse flex items-center gap-1">
                                                                <div className="w-2 h-2 border border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div> COMPILING
                                                            </span>
                                                        ) : (
                                                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-600 dark:bg-rose-500/10 shrink-0">FAILED</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                                                <DownloadCloud size={24} className="text-slate-200 dark:text-white/10" />
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No past exports</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Attendance Detail Bottom Sheet */}
                    <AnimatePresence>
                        {isDetailSidebarOpen && selectedRecord && (
                            <>
                                {/* Backdrop */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsDetailSidebarOpen(false)}
                                    className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-[2px]"
                                />

                                {/* Bottom Sheet Panel */}
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                                    className="fixed bottom-0 left-0 right-0 z-[201] bg-white dark:bg-[#0d1117] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
                                    style={{ maxHeight: '85vh' }}
                                >
                                    {/* Drag Handle */}
                                    <div className="flex justify-center pt-3 pb-1 shrink-0">
                                        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                    </div>

                                    {/* Header */}
                                    <div className="flex items-center justify-between py-3 px-5 border-b border-slate-100 dark:border-[#30363d] shrink-0">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                <Clock size={15} />
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-800 dark:text-white">Attendance Details</h3>
                                        </div>
                                        <button
                                            onClick={() => setIsDetailSidebarOpen(false)}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#21262d] rounded-lg transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>

                                    {/* Scrollable Body */}
                                    <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">

                                        {/* Profile Card — Avatar + Name + Date + Status */}
                                        <div className="flex items-center gap-4">
                                            <div className="relative shrink-0">
                                                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-15 rounded-full" />
                                                <div className="relative w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xl overflow-hidden border-2 border-white dark:border-[#30363d] shadow-lg">
                                                    {(() => {
                                                        const name = selectedRecord.user_name || '';
                                                        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                                        return initials || <User size={20} />;
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">{selectedRecord.user_name || 'Employee'}</h4>
                                                {selectedRecord.designation && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{selectedRecord.designation} · {selectedRecord.department}</p>}
                                                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{selectedRecord.date}</p>
                                                <div className={`mt-1 inline-flex items-center px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full border shadow-sm ${mvGetStatusColor(selectedRecord.status)}`}>
                                                    {selectedRecord.status}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Absent / Leave states */}
                                        {selectedRecord.status === 'Absent' ? (
                                            <div className="p-4 bg-rose-50/60 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-800/20 rounded-2xl">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Absent</p>
                                                <p className="text-xs font-medium text-rose-500/80 mt-1">No attendance recorded. Marked absent.</p>
                                            </div>
                                        ) : selectedRecord.status === 'On Leave' ? (
                                            <div className="p-4 bg-sky-50/60 dark:bg-sky-950/15 border border-sky-200/50 dark:border-sky-800/20 rounded-2xl">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">On Leave</p>
                                                <p className="text-xs font-medium text-sky-500/80 mt-1">Approved leave for this day.</p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Punch In / Out */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    {[
                                                        { label: 'Punch In', value: selectedRecord.time_in || '—', color: 'emerald' },
                                                        { label: 'Punch Out', value: selectedRecord.time_out || '—', color: 'rose' },
                                                    ].map((item, i) => (
                                                        <div key={i} className="bg-slate-50/60 dark:bg-[#161b22]/70 p-3.5 rounded-2xl border border-slate-100 dark:border-[#30363d]/70">
                                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-70">{item.label}</span>
                                                            <span className="text-sm font-bold text-slate-800 dark:text-white">{item.value}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Work Hrs vs Req Hrs + Late Mins */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-slate-50/60 dark:bg-[#161b22]/70 p-3.5 rounded-2xl border border-slate-100 dark:border-[#30363d]/70">
                                                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-70">Work / Req Hrs</span>
                                                        <span className="text-sm font-bold text-slate-800 dark:text-white">
                                                            {selectedRecord.worked_hours != null ? selectedRecord.worked_hours.toFixed(2) : '—'}
                                                            <span className="text-slate-400 font-medium mx-1">/</span>
                                                            {selectedRecord.required_hours != null ? selectedRecord.required_hours.toFixed(2) : '—'}<span className="text-xs text-slate-400 ml-0.5">h</span>
                                                        </span>
                                                        {selectedRecord.worked_hours != null && selectedRecord.required_hours > 0 && (
                                                            <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${selectedRecord.worked_hours >= selectedRecord.required_hours ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                                                    style={{ width: `${Math.min((selectedRecord.worked_hours / selectedRecord.required_hours) * 100, 100)}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className={`p-3.5 rounded-2xl border ${selectedRecord.late_minutes > 0 ? 'bg-amber-50/60 dark:bg-amber-950/15 border-amber-200/50 dark:border-amber-800/20' : 'bg-slate-50/60 dark:bg-[#161b22]/70 border-slate-100 dark:border-[#30363d]/70'}`}>
                                                        <span className="block text-[8px] font-black uppercase tracking-widest mb-1 opacity-70 text-slate-400">Late Mins</span>
                                                        <span className={`text-sm font-bold ${selectedRecord.late_minutes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
                                                            {selectedRecord.late_minutes != null ? `${selectedRecord.late_minutes} min` : '—'}
                                                        </span>
                                                        {selectedRecord.late_minutes > 0 && (
                                                            <>
                                                                <span className="block text-[9px] text-amber-500 font-semibold mt-1">Arrived late</span>
                                                                {selectedRecord.late_reason && selectedRecord.late_reason !== '-' && (
                                                                    <span className="block text-[9px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-snug">
                                                                        Message: <span className="italic">"{selectedRecord.late_reason}"</span>
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Punch Photos */}
                                                {(selectedRecord.time_in_image || selectedRecord.time_out_image) && (
                                                    <div className="bg-slate-50/60 dark:bg-[#161b22]/70 p-3.5 rounded-2xl border border-slate-100 dark:border-[#30363d]/70 space-y-3">
                                                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-70">Punch Selfies</span>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {[
                                                                { label: 'In', img: selectedRecord.time_in_image },
                                                                { label: 'Out', img: selectedRecord.time_out_image }
                                                            ].map((item, i) => (
                                                                <div key={i} className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-[#30363d] bg-slate-100 dark:bg-[#21262d] shadow-sm flex flex-col">
                                                                    {item.img
                                                                        ? <img src={item.img} alt={item.label} className="w-full h-28 object-contain" />
                                                                        : <div className="flex h-28 items-center justify-center text-slate-400 text-[10px]">No photo</div>
                                                                    }
                                                                    <span className={`text-[9px] font-black uppercase tracking-wider text-center py-1.5 border-t border-slate-100 dark:border-[#30363d] ${item.label === 'In' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                        Punch {item.label}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Punch Locations */}
                                                {(selectedRecord.time_in_address && selectedRecord.time_in_address !== '-') || (selectedRecord.time_out_address && selectedRecord.time_out_address !== '-') ? (
                                                    <div className="bg-slate-50/60 dark:bg-[#161b22]/70 p-3.5 rounded-2xl border border-slate-100 dark:border-[#30363d]/70 space-y-3">
                                                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-70">Location</span>
                                                        {selectedRecord.time_in_address && selectedRecord.time_in_address !== '-' && (
                                                            <div className="flex items-start gap-2">
                                                                <MapPin size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                                                                <div>
                                                                    <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">Punch In</p>
                                                                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-snug">{selectedRecord.time_in_address}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {selectedRecord.time_out_address && selectedRecord.time_out_address !== '-' && (
                                                            <div className="flex items-start gap-2">
                                                                <MapPin size={12} className="text-rose-400 mt-0.5 shrink-0" />
                                                                <div>
                                                                    <p className="text-[8px] font-black uppercase tracking-widest text-rose-500 dark:text-rose-400 mb-0.5">Punch Out</p>
                                                                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-snug">{selectedRecord.time_out_address}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

// Simple wrapper to fix naming conflict if any
const MobileReportsWrapper = ({ children }) => children;

export default MobileReports;
