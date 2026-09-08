import React from 'react';

export const DEFAULT_PREVIEW_WORKERS = [
    {
        id: 'sample-1',
        name: 'Ramesh Kumar',
        role: 'Mason',
        monthly_salary: 750,
        wage_type: 'Daily Wage',
        phone: '9876543210',
        sex: 'Male',
        site_name: 'Main Site',
        isValid: true,
        selected: true
    },
    {
        id: 'sample-2',
        name: 'Suresh Patel',
        role: 'Helper',
        monthly_salary: 500,
        wage_type: 'Daily Wage',
        phone: '9876543211',
        sex: 'Male',
        site_name: 'Main Site',
        isValid: true,
        selected: true
    },
    {
        id: 'sample-3',
        name: 'Amit Sharma',
        role: 'Carpenter',
        monthly_salary: 800,
        wage_type: 'Daily Wage',
        phone: '9876543212',
        sex: 'Male',
        site_name: 'Main Site',
        isValid: true,
        selected: true
    }
];

export const getStatusColor = (status) => {
    const s = status || '';
    if (!s || s === '-') return 'bg-slate-50 text-slate-400 dark:bg-[#161b22] dark:text-[#8b949e] border border-slate-200 dark:border-[#30363d]';
    if (s === 'Present' || s.includes('Present')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-700/60 font-semibold';
    if (s === 'Absent') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-1 ring-rose-300 dark:ring-rose-700/60 font-semibold';
    if (s.toLowerCase().includes('late') && s.toLowerCase().includes('overtime')) return 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700/60 font-semibold';
    if (s.toLowerCase().includes('late')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700/60 font-semibold';
    if (s.toLowerCase().includes('overtime')) return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700/60 font-semibold';
    if (s === 'Sun' || s === 'Sat' || s === 'SU' || s === 'SA' || s === 'Sunday' || s === 'Saturday') return 'bg-slate-100 dark:bg-[#21262d] text-slate-500 dark:text-[#c9d1d9] font-medium border border-transparent dark:border-[#30363d]/60';
    if (s.toLowerCase() === 'on leave' || s.toLowerCase() === 'paid leave') return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 ring-1 ring-sky-300 dark:ring-sky-700/60 font-semibold';
    if (s.toLowerCase() === 'half day') return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700/60 font-semibold';
    return 'bg-slate-100 text-slate-500 dark:bg-[#21262d] dark:text-[#c9d1d9]';
};

export const getStatusLabel = (status) => {
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

export const formatAdvanceDate = (dateVal) => {
    if (!dateVal) return '';
    const dStr = typeof dateVal === 'string' ? dateVal.split('T')[0] : new Date(dateVal).toISOString().split('T')[0];
    const [y, m, d] = dStr.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const day = dateObj.getDate();
    const suffix = ["th", "st", "nd", "rd"][(day % 10 > 3 || Math.floor((day % 100) / 10) === 1) ? 0 : day % 10];
    const monthName = dateObj.toLocaleString('en-US', { month: 'short' });
    return `${day}${suffix} ${monthName} ${y}`;
};

export const getDaysInMonthArray = (monthStr) => {
    if (!monthStr) return [];
    const [year, month] = monthStr.split('-').map(Number);
    const numDays = new Date(year, month, 0).getDate();
    return Array.from({ length: numDays }, (_, i) => {
        const d = i + 1;
        const dayStr = d < 10 ? `0${d}` : `${d}`;
        const dateObj = new Date(year, month - 1, d);
        const dayOfWeek = dateObj.toLocaleString('en-US', { weekday: 'narrow' });
        return {
            day: d,
            dateStr: `${monthStr}-${dayStr}`,
            dayOfWeek
        };
    });
};

export const getMonthNameAndYear = (monthStr) => {
    if (!monthStr) return '';
    const [y, m] = monthStr.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};
