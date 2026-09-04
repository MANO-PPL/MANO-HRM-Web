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

// Returns badge background/text classes for attendance statuses
export const getStatusColor = (status) => {
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

// Returns short 1-2 character label for attendance badges in the matrix
export const getStatusLabel = (status) => {
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
