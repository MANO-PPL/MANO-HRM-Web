// Alignment helper for table headers
export const getAlignmentClass = (colHeader) => {
    if (!colHeader) return 'center';
    const header = colHeader.toLowerCase();
    if (['name', 'department', 'dept', 'employee', 'reason', 'location', 'in location', 'out location', 'email', 'phone', 'role', 'designation', 'position'].some(k => header.includes(k))) {
        return 'left';
    }
    return 'center';
};

// Excel-style cell styling
export const getCellStyle = (cellValue, colHeader, isTotalsRow, isEven, rowIdx) => {
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
    const cat = classifyAttendanceStatus(val);
    if (cat === 'present') {
        return { ...baseFont, backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: '700', border: defaultBorder };
    }
    if (cat === 'absent') {
        return { ...baseFont, backgroundColor: '#FEE2E2', color: '#B91C1C', fontWeight: '700', border: defaultBorder };
    }
    if (cat === 'missedPunch') {
        return { ...baseFont, backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: '700', border: defaultBorder };
    }
    if (cat === 'halfDay') {
        return { ...baseFont, backgroundColor: '#FEF9C3', color: '#854D0E', fontWeight: '700', border: defaultBorder };
    }
    if (cat === 'leave') {
        return { ...baseFont, backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: '700', border: defaultBorder };
    }
    if (cat === 'weeklyOff') {
        return { ...baseFont, backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: '600', fontStyle: 'italic', border: defaultBorder };
    }
    if (val.toLowerCase().includes('late') || (header.includes('late') && Number(val) > 0)) {
        return { ...baseFont, backgroundColor: '#FFF7ED', color: '#C2410C', fontWeight: '700', border: defaultBorder };
    }
    if (val === 'Not Recorded' || val === '-' || val === '') {
        return { ...baseFont, backgroundColor: '#F8FAFC', color: '#94A3B8', fontWeight: '500', border: defaultBorder };
    }
    if ((header.includes('salary') || header.includes('pay') || header.includes('amount') || header.includes('₹')) && val.includes('₹')) {
        return { ...baseFont, backgroundColor: isEven ? '#F0FDF4' : '#FFFFFF', color: '#065F46', fontWeight: '700', border: defaultBorder };
    }
    if (header.includes('overtime') || header.includes('ot') && Number(val) > 0) {
        return { ...baseFont, backgroundColor: '#F5F3FF', color: '#6D28D9', fontWeight: '700', border: defaultBorder };
    }
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

// Returns weekly intervals within a given month
export const getWeeksOfMonth = (monthStr) => {
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

// Check if a column header represents a date
export const isDateColumn = (colName) => {
    const cleanName = colName?.toString().trim() || '';
    return /^\d+/.test(cleanName) || ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].some(m => cleanName.toLowerCase().includes(m));
};

// ─── Sortable preview columns ──────────────────────────────────────────────
// A column whose header names it a clock-time field needs chronological
// (earliest → latest) comparison, not alphabetical — a plain string sort of
// 12-hour "hh:mm AM/PM" values breaks the moment a column mixes AM and PM
// (e.g. "01:15 PM" sorts before "11:45 AM" alphabetically).
const isTimeColumn = (colHeader) => {
    const h = (colHeader || '').toString().toLowerCase();
    return h.includes('time in') || h.includes('time out') || h.includes('in time') || h.includes('out time');
};

// Parses a formatted 12-hour time string ("09:04 AM") into minutes-since-midnight.
// Returns null for anything that doesn't match (blank, "-", "N/A", ...).
const parseTimeToMinutes = (val) => {
    const s = (val ?? '').toString().trim();
    const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return null;
    let hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ampm = m[3];
    if (ampm) {
        const isPM = ampm.toUpperCase() === 'PM';
        if (hh === 12) hh = isPM ? 12 : 0;
        else if (isPM) hh += 12;
    }
    return hh * 60 + mm;
};

// Classifies + extracts a comparable value from a raw preview cell for a given column.
// `isBlank` cells (empty/"-"/"N/A", or an unparseable time) always sort last regardless
// of direction — handled by the caller, compareSortValues.
const parseSortValue = (cell, columnName) => {
    const raw = (cell === null || cell === undefined) ? '' : cell.toString().trim();
    const isBlank = raw === '' || raw === '-' || raw.toUpperCase() === 'N/A';

    if (isTimeColumn(columnName)) {
        const mins = isBlank ? null : parseTimeToMinutes(raw);
        return { type: 'time', value: mins, isBlank: mins === null };
    }

    if (!isBlank) {
        const num = Number(raw.replace(/,/g, ''));
        if (raw !== '' && !isNaN(num)) {
            return { type: 'number', value: num, isBlank: false };
        }
    }

    return { type: 'text', value: raw.toLowerCase(), isBlank };
};

// Comparator for Array.prototype.sort: compares two raw cell values from the same column.
// `direction` is 'asc' or 'desc'. Blank/unparseable values always sort last either way.
export const compareSortValues = (cellA, cellB, columnName, direction) => {
    const a = parseSortValue(cellA, columnName);
    const b = parseSortValue(cellB, columnName);

    if (a.isBlank && b.isBlank) return 0;
    if (a.isBlank) return 1;
    if (b.isBlank) return -1;

    const result = a.type === 'text' ? a.value.localeCompare(b.value) : a.value - b.value;
    return direction === 'desc' ? -result : result;
};

// Normalize attendance status: prioritize Overtime over Late & Overtime
export const normalizeAttendanceStatus = (status) => {
    const s = status || '';
    if (s.toLowerCase().includes('late') && s.toLowerCase().includes('overtime')) {
        return 'Overtime';
    }
    return s;
};

// Returns badge background/text classes for attendance statuses
export const getStatusColor = (status) => {
    const s = (status || '').toString().trim();
    if (!s || s === '-' || s === 'Not Recorded') return 'bg-slate-50 text-slate-300 dark:bg-slate-900/50 dark:text-slate-700 border border-slate-200 dark:border-slate-800 opacity-60';
    const sLower = s.toLowerCase();
    const sUpper = s.toUpperCase();

    if (sLower.includes('missed') || sUpper === 'MP' || sUpper === 'MISSED_PUNCH') {
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50';
    }
    if (s === 'Present' || s === '1.0' || s === '1' || sUpper === 'P' || sLower.includes('present')) {
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50';
    }
    if (s === 'Absent' || s === '0.0' || s === '0' || sUpper === 'A' || sLower.includes('absent')) {
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800/50';
    }
    if (sLower.includes('overtime') || sUpper === 'OT') {
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-800/50';
    }
    if (sLower.includes('late')) {
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50';
    }
    if (sLower.includes('holiday') || sUpper === 'H') {
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800/50';
    }
    if (s === 'Sun' || s === 'Sat' || sUpper === 'WO' || sLower.includes('week') || sLower.includes('sun') || sLower.includes('sat')) {
        return 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500';
    }
    if (sLower.includes('leave') || sUpper === 'L') {
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800/50';
    }
    if (sLower.includes('half') || sUpper === 'HD') {
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800/50';
    }
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
};

// Returns short 1-2 character label for attendance badges in the matrix
export const getStatusLabel = (status) => {
    const s = (status || '').toString().trim();
    if (!s || s === '-' || s === 'Not Recorded') return '·';
    const sLower = s.toLowerCase();
    const sUpper = s.toUpperCase();

    if (sLower.includes('missed') || sUpper === 'MP' || sUpper === 'MISSED_PUNCH') return 'MP';
    if (s === 'Present' || s === '1.0' || s === '1' || sUpper === 'P') return 'P';
    if (s === 'Absent' || s === '0.0' || s === '0' || sUpper === 'A') return 'A';
    if (sLower.includes('holiday') || sUpper === 'H') return 'H';
    if (s === 'Sun' || sLower === 'sun' || sLower.includes('sunday')) return 'Su';
    if (s === 'Sat' || sLower === 'sat' || sLower.includes('saturday')) return 'Sa';
    if (sUpper === 'WO' || sLower.includes('week')) return 'WO';
    if (sLower.includes('leave') || sUpper === 'L') return 'L';
    if (sLower.includes('half') || sUpper === 'HD') return 'HD';
    if (sLower.includes('overtime') || sUpper === 'OT') return 'OT';
    if (sLower.includes('late')) return 'Lt';
    return s.slice(0, 2);
};

// Classifies any raw attendance status into standard metric buckets
export const classifyAttendanceStatus = (status) => {
    if (!status || status === '-' || status === 'Not Recorded' || status === '·') {
        return 'unrecorded';
    }
    const s = String(status).trim();
    const sLower = s.toLowerCase();
    const sUpper = s.toUpperCase();

    // 1. Missed Punch
    if (sLower.includes('missed') || sUpper === 'MP' || sUpper === 'MISSED_PUNCH') {
        return 'missedPunch';
    }

    // 2. On Leave
    if (sLower.includes('leave') || sUpper === 'L' || sLower === 'on_leave') {
        return 'leave';
    }

    // 3. Half Day
    if (sLower.includes('half') || sUpper === 'HD' || sLower === 'half_day') {
        return 'halfDay';
    }

    // 4. Weekend / Weekly Off / Holiday
    if (
        s === 'Sun' || s === 'Sat' || sLower === 'sun' || sLower === 'sat' ||
        sLower.includes('sunday') || sLower.includes('saturday') ||
        sUpper === 'WO' || sLower === 'wo' ||
        sLower.includes('week_off') || sLower.includes('weekly_off') ||
        sLower.includes('week off') || sLower.includes('weekly off') ||
        sLower.includes('holiday') || sUpper === 'H'
    ) {
        return 'weeklyOff';
    }

    // 5. Present (including Present, 1.0, 1, P, Late, Overtime, On Duty, Work From Home)
    if (
        sLower.includes('present') || s === '1.0' || s === '1' || sUpper === 'P' ||
        sLower.includes('late') || sLower.includes('overtime') || sUpper === 'OT' ||
        sLower.includes('on duty') || sUpper === 'OD' ||
        sLower.includes('work from home') || sUpper === 'WFH'
    ) {
        return 'present';
    }

    // 6. Absent (including Absent, 0.0, 0, A)
    if (
        sLower.includes('absent') || s === '0.0' || s === '0' || sUpper === 'A'
    ) {
        return 'absent';
    }

    return 'unrecorded';
};

// Available attendance status filter options for matrix filtering
export const ATTENDANCE_STATUS_OPTIONS = [
    {
        key: 'present',
        label: 'Present',
        abbr: 'P',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800',
        activeCard: 'bg-emerald-50/90 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 shadow-2xs',
        badge: 'bg-emerald-600 text-white dark:bg-emerald-500',
        dot: 'bg-emerald-500',
    },
    {
        key: 'absent',
        label: 'Absent',
        abbr: 'A',
        color: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800',
        activeCard: 'bg-rose-50/90 border-rose-300 dark:bg-rose-950/40 dark:border-rose-700 text-rose-900 dark:text-rose-200 shadow-2xs',
        badge: 'bg-rose-600 text-white dark:bg-rose-500',
        dot: 'bg-rose-500',
    },
    {
        key: 'halfDay',
        label: 'Half Day',
        abbr: 'HD',
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950/40 dark:border-indigo-800',
        activeCard: 'bg-indigo-50/90 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 shadow-2xs',
        badge: 'bg-indigo-600 text-white dark:bg-indigo-500',
        dot: 'bg-indigo-500',
    },
    {
        key: 'leave',
        label: 'Leave',
        abbr: 'L',
        color: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-950/40 dark:border-sky-800',
        activeCard: 'bg-sky-50/90 border-sky-300 dark:bg-sky-950/40 dark:border-sky-700 text-sky-900 dark:text-sky-200 shadow-2xs',
        badge: 'bg-sky-600 text-white dark:bg-sky-500',
        dot: 'bg-sky-500',
    },
    {
        key: 'missedPunch',
        label: 'Missed Punch',
        abbr: 'MP',
        color: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800',
        activeCard: 'bg-amber-50/90 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-2xs',
        badge: 'bg-amber-600 text-white dark:bg-amber-500',
        dot: 'bg-amber-500',
    },
    {
        key: 'weeklyOff',
        label: 'Weekly Off',
        abbr: 'WO',
        color: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700',
        activeCard: 'bg-slate-100/95 border-slate-300 dark:bg-slate-800/60 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs',
        badge: 'bg-slate-600 text-white dark:bg-slate-500',
        dot: 'bg-slate-500',
    },
    {
        key: 'overtime',
        label: 'Overtime',
        abbr: 'OT',
        color: 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-800',
        activeCard: 'bg-purple-50/90 border-purple-300 dark:bg-purple-950/40 dark:border-purple-700 text-purple-900 dark:text-purple-200 shadow-2xs',
        badge: 'bg-purple-600 text-white dark:bg-purple-500',
        dot: 'bg-purple-500',
    },
];

// Mapping of short abbreviations to full descriptive names
export const STATUS_FULL_FORMS = {
    P: 'Present',
    A: 'Absent',
    MP: 'Missed Punch',
    L: 'Leave',
    HD: 'Half Day',
    WO: 'Weekly Off',
    OT: 'Overtime (Hours)',
    'OT (h)': 'Overtime (Hours)',
    H: 'Holiday',
    Su: 'Sunday (Weekly Off)',
    Sa: 'Saturday (Weekly Off)',
    Lt: 'Late Arrival',
    OD: 'On Duty',
    WFH: 'Work From Home'
};

// Returns the full form name for any abbreviation or status
export const getStatusFullForm = (statusOrAbbr) => {
    if (!statusOrAbbr || statusOrAbbr === '-' || statusOrAbbr === '·' || statusOrAbbr === 'Not Recorded') {
        return 'Not Recorded';
    }
    const s = String(statusOrAbbr).trim();
    if (STATUS_FULL_FORMS[s]) return STATUS_FULL_FORMS[s];

    const cat = classifyAttendanceStatus(s);
    switch (cat) {
        case 'present': return 'Present';
        case 'absent': return 'Absent';
        case 'missedPunch': return 'Missed Punch';
        case 'leave': return 'Leave';
        case 'halfDay': return 'Half Day';
        case 'weeklyOff': return 'Weekly Off';
        default: return s;
    }
};
