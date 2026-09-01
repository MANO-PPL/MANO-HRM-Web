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
    if (!s || s === '-') return 'bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-700 border border-slate-200 dark:border-slate-800';
    if (s === 'Present' || s.includes('Present')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50';
    if (s === 'Absent') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800/50';
    if (s.toLowerCase().includes('late') && s.toLowerCase().includes('overtime')) return 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800/50';
    if (s.toLowerCase().includes('late')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50';
    if (s.toLowerCase().includes('overtime')) return 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-800/50';
    if (s === 'Sun' || s === 'Sat' || s === 'SU' || s === 'SA' || s === 'Sunday' || s === 'Saturday') return 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500';
    if (s.toLowerCase() === 'on leave' || s.toLowerCase() === 'paid leave') return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800/50';
    if (s.toLowerCase() === 'half day') return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800/50';
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
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
