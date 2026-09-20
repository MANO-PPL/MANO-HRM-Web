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
    if (val === 'Present' || val === '1.0' || val === '1') {
        return { ...baseFont, backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: '700', border: defaultBorder };
    }
    if (val === 'Absent' || val === '0.0' || val === '0') {
        return { ...baseFont, backgroundColor: '#FEE2E2', color: '#B91C1C', fontWeight: '700', border: defaultBorder };
    }
    if (val.toLowerCase().includes('missed') || val === 'MP') {
        return { ...baseFont, backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: '700', border: defaultBorder };
    }
    if (val.toLowerCase() === 'half day') {
        return { ...baseFont, backgroundColor: '#FEF9C3', color: '#854D0E', fontWeight: '700', border: defaultBorder };
    }
    if (val.toLowerCase() === 'on leave' || val.toLowerCase() === 'leave') {
        return { ...baseFont, backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: '700', border: defaultBorder };
    }
    if (val.toLowerCase().includes('late') || (header.includes('late') && Number(val) > 0)) {
        return { ...baseFont, backgroundColor: '#FFF7ED', color: '#C2410C', fontWeight: '700', border: defaultBorder };
    }
    if (val === 'Sun' || val === 'Sat' || val === 'WEEK_OFF') {
        return { ...baseFont, backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: '600', fontStyle: 'italic', border: defaultBorder };
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
    const s = status || '';
    if (!s || s === '-' || s === 'Not Recorded') return 'bg-slate-50 text-slate-300 dark:bg-slate-900/50 dark:text-slate-700 border border-slate-200 dark:border-slate-800 opacity-60';
    if (s === 'Present' || s.includes('Present')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50';
    if (s.toLowerCase().includes('missed') || s === 'MP') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50';
    if (s === 'Absent') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800/50';
    if (s.toLowerCase().includes('overtime')) return 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-800/50';
    if (s.toLowerCase().includes('late')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50';
    if (s === 'Holiday' || s === 'HOLIDAY') return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800/50';
    if (s === 'Sun' || s === 'Sat' || s === 'WEEK_OFF' || s === 'Week Off') return 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500';
    if (s.toLowerCase() === 'on leave') return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800/50';
    if (s.toLowerCase() === 'half day') return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800/50';
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
};

// Returns short 1-2 character label for attendance badges in the matrix
export const getStatusLabel = (status) => {
    const s = status || '';
    if (!s || s === '-' || s === 'Not Recorded') return '·';
    if (s.toLowerCase().includes('missed') || s === 'MP') return 'MP';
    if (s === 'Present') return 'P';
    if (s === 'Absent') return 'A';
    if (s === 'Holiday' || s === 'HOLIDAY') return 'H';
    if (s === 'Sun') return 'Su';
    if (s === 'Sat') return 'Sa';
    if (s === 'WEEK_OFF' || s === 'Week Off') return 'WO';
    if (s.toLowerCase() === 'on leave') return 'L';
    if (s.toLowerCase() === 'half day') return 'HD';
    if (s.toLowerCase().includes('overtime')) return 'OT';
    if (s.toLowerCase().includes('late')) return 'Lt';
    return s.slice(0, 2);
};
