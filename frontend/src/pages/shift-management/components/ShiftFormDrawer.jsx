import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Check } from 'lucide-react';

export const ToggleSwitch = ({ checked, onChange, disabled = false, color = 'emerald' }) => {
    const activeColorClasses = {
        emerald: 'peer-checked:bg-emerald-500 peer-focus-visible:ring-emerald-500/30',
        indigo: 'peer-checked:bg-indigo-600 peer-focus-visible:ring-indigo-500/30',
        blue: 'peer-checked:bg-blue-600 peer-focus-visible:ring-blue-500/30',
    }[color] || 'peer-checked:bg-emerald-500 peer-focus-visible:ring-emerald-500/30';

    return (
        <label className={`relative inline-flex items-center shrink-0 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
            />
            <div className={`w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 rounded-full transition-colors duration-200 ease-in-out after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-xs after:transition-transform after:duration-200 after:ease-in-out peer-checked:after:translate-x-4 ${activeColorClasses}`}></div>
        </label>
    );
};

export const ToggleRow = ({
    label,
    subLabel,
    checked,
    onChange,
    color = 'emerald',
    activeText = 'Active',
    inactiveText = 'Inactive',
    disabled = false
}) => (
    <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-github-dark-text leading-tight">{label}</p>
            {subLabel && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5 leading-snug">{subLabel}</p>}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
            <span className={`text-[11px] font-medium transition-colors select-none ${
                checked
                    ? (color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400')
                    : 'text-slate-400 dark:text-slate-500'
            }`}>
                {checked ? activeText : inactiveText}
            </span>
            <ToggleSwitch
                checked={checked}
                onChange={onChange}
                color={color}
                disabled={disabled}
            />
        </div>
    </div>
);

export const ThemedTimeStepper = ({
    hours,
    minutes,
    onHoursChange,
    onMinutesChange,
    maxHours = 23,
    hourLabel = 'h',
    minuteLabel = 'm'
}) => {
    return (
        <div className="inline-flex items-center h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all select-none">
            {/* Hours */}
            <div className="flex items-center">
                <input
                    type="number"
                    min={0}
                    max={maxHours}
                    value={hours}
                    onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        onHoursChange(isNaN(val) ? 0 : Math.max(0, Math.min(maxHours, val)));
                    }}
                    onKeyDown={e => {
                        if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const step = e.shiftKey ? 5 : 1;
                            onHoursChange(Math.min(maxHours, (Number(hours) || 0) + step));
                        } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            const step = e.shiftKey ? 5 : 1;
                            onHoursChange(Math.max(0, (Number(hours) || 0) - step));
                        }
                    }}
                    title="Hours (Press Arrow Up/Down to adjust, Shift for ±5h)"
                    className="w-7 text-xs font-semibold text-center bg-transparent text-slate-800 dark:text-slate-100 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[11px] font-medium text-slate-400 select-none ml-0.5">{hourLabel}</span>
            </div>

            {/* Separator */}
            <span className="text-slate-300 dark:text-slate-600 mx-1.5 font-bold text-xs select-none">:</span>

            {/* Minutes */}
            <div className="flex items-center">
                <input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        onMinutesChange(isNaN(val) ? 0 : Math.max(0, Math.min(59, val)));
                    }}
                    onKeyDown={e => {
                        if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const step = e.shiftKey ? 15 : 1;
                            onMinutesChange(Math.min(59, (Number(minutes) || 0) + step));
                        } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            const step = e.shiftKey ? 15 : 1;
                            onMinutesChange(Math.max(0, (Number(minutes) || 0) - step));
                        }
                    }}
                    title="Minutes (Press Arrow Up/Down to adjust, Shift for ±15m)"
                    className="w-7 text-xs font-semibold text-center bg-transparent text-slate-800 dark:text-slate-100 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[11px] font-medium text-slate-400 select-none ml-0.5">{minuteLabel}</span>
            </div>

            {/* Themed Micro Stepper Buttons */}
            <div className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-1.5 ml-1.5 -mr-0.5">
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                        if (minutes < 55) {
                            onMinutesChange(minutes + 5);
                        } else {
                            onMinutesChange(0);
                            onHoursChange(Math.min(maxHours, hours + 1));
                        }
                    }}
                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors leading-none p-0.5"
                    aria-label="Increase"
                >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                        if (minutes >= 5) {
                            onMinutesChange(minutes - 5);
                        } else if (hours > 0) {
                            onMinutesChange(55);
                            onHoursChange(hours - 1);
                        }
                    }}
                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors leading-none p-0.5"
                    aria-label="Decrease"
                >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

const Checkbox = ({ label, checked, onChange, disabled = false }) => (
    <label className={`flex items-center gap-2.5 py-1.5 group ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-github-dark-border group-hover:border-indigo-400'}`}
            onClick={disabled ? undefined : onChange}>
            {checked && <Check size={10} className="text-white" strokeWidth={3} />}
        </div>
        <span className="text-xs text-slate-700 dark:text-slate-300 font-normal">{label}</span>
    </label>
);

const ShiftFormDrawer = ({
    editingShift,
    shiftForm,
    setShiftForm,
    onSaveShift,
    onClose,
    isOtEnabled,
    setIsOtEnabled,
    showAdvancedSettings,
    setShowAdvancedSettings,
    toggleRule,
    setRuleTiming,
    otThresholdHr,
    otThresholdMin,
    handleOtThresholdChange,
    otBufferHr,
    otBufferMin,
    handleOtBufferChange,
    otMaxHoursHr,
    otMaxHoursMin,
    handleOtMaxHoursChange
}) => {
    // Local state for Alternate Schedule Rules
    const [altTab, setAltTab] = useState('weekOff'); // 'weekOff' | 'halfDay'
    const [selectedAltDay, setSelectedAltDay] = useState('Sat');

    // Human-friendly shift duration
    const calculateDuration = (start, end) => {
        if (!start || !end) return '0h 00m';
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let d = (eh * 60 + em) - (sh * 60 + sm);
        if (d < 0) d += 24 * 60;
        const h = Math.floor(d / 60);
        const m = d % 60;
        return `${h}h ${m > 0 ? `${m}m` : '00m'}`;
    };

    // 1-Click Schedule Presets
    const applySchedulePreset = (preset) => {
        if (preset === '5day') {
            setShiftForm(prev => ({
                ...prev,
                workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                weekOffRules: [],
                halfDayRules: []
            }));
        } else if (preset === '6day') {
            setShiftForm(prev => ({
                ...prev,
                workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                weekOffRules: [],
                halfDayRules: []
            }));
        } else if (preset === '2nd4thSat') {
            setShiftForm(prev => ({
                ...prev,
                workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                weekOffRules: [{ day: 'Sat', weeks: [2, 4] }],
                halfDayRules: []
            }));
        } else if (preset === 'all7') {
            setShiftForm(prev => ({
                ...prev,
                workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                weekOffRules: [],
                halfDayRules: []
            }));
        }
    };

    // Friendly Schedule Explanation
    const getScheduleDescription = () => {
        const working = shiftForm.workingDays || [];
        const altOffs = shiftForm.weekOffRules || [];
        const halfDays = shiftForm.halfDayRules || [];

        if (working.length === 5 && !working.includes('Sat') && !working.includes('Sun') && altOffs.length === 0 && halfDays.length === 0) {
            return '5-Day Week: Works Mon to Fri. Sat & Sun are weekly offs.';
        }
        if (working.length === 6 && !working.includes('Sun') && altOffs.length === 0 && halfDays.length === 0) {
            return '6-Day Week: Works Mon to Sat. Sunday is weekly off.';
        }
        if (working.length === 7 && altOffs.length === 0 && halfDays.length === 0) {
            return '7-Day Operations: Works every day (Mon to Sun).';
        }
        if (working.length === 5 && !working.includes('Sat') && !working.includes('Sun') && altOffs.some(r => r.day === 'Sat' && r.weeks?.length === 2 && r.weeks.includes(2) && r.weeks.includes(4))) {
            return 'Corporate Schedule: Mon–Fri work, 2nd & 4th Saturday off, Sundays off.';
        }

        const parts = [];
        if (working.length > 0) parts.push(`Works ${working.join(', ')}`);
        if (altOffs.length > 0) {
            parts.push(`Off on ${altOffs.map(r => `${r.day} (${r.weeks.map(w => w + (w===1?'st':w===2?'nd':w===3?'rd':'th')).join('/')} wk)`).join(', ')}`);
        }
        if (halfDays.length > 0) {
            parts.push(`Half-day on ${halfDays.map(r => r.day).join(', ')}`);
        }
        return parts.join(' • ') || 'No working days selected.';
    };

    // Quick helpers for active day rules
    const currentDayWeekOffRule = shiftForm.weekOffRules.find(r => r.day === selectedAltDay) || { weeks: [] };
    const currentDayHalfDayRule = shiftForm.halfDayRules.find(r => r.day === selectedAltDay) || { weeks: [] };

    const setWeeksForSelectedDay = (weeks) => {
        setShiftForm(prev => {
            const rules = prev.weekOffRules.filter(r => r.day !== selectedAltDay);
            if (weeks.length > 0) {
                rules.push({ day: selectedAltDay, weeks });
            }
            // If day had alternate offs, ensure it is removed from 100% working days
            const newWorkingDays = weeks.length > 0
                ? prev.workingDays.filter(d => d !== selectedAltDay)
                : prev.workingDays;
            return { ...prev, weekOffRules: rules, workingDays: newWorkingDays };
        });
    };

    const setHalfDaysForSelectedDay = (weeks) => {
        setShiftForm(prev => {
            const rules = prev.halfDayRules.filter(r => r.day !== selectedAltDay);
            if (weeks.length > 0) {
                rules.push({
                    day: selectedAltDay,
                    weeks,
                    timing: currentDayHalfDayRule.timing || { start_time: prev.start, end_time: '13:00' }
                });
            }
            return { ...prev, halfDayRules: rules };
        });
    };

    const clearAllAlternateRules = (day) => {
        setShiftForm(prev => ({
            ...prev,
            weekOffRules: prev.weekOffRules.filter(r => r.day !== day),
            halfDayRules: prev.halfDayRules.filter(r => r.day !== day)
        }));
    };

    return (
        <>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-github-dark-border bg-white dark:bg-dark-card">
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">
                        {editingShift ? 'Edit Shift' : 'Create New Shift'}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                        Configure working hours and weekly schedule in simple steps.
                    </p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <X size={18} />
                </button>
            </div>

            <form onSubmit={onSaveShift} className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
                {/* 1. Shift Name */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Shift Name
                    </label>
                    <input
                        type="text"
                        required
                        value={shiftForm.name}
                        onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                        placeholder="e.g. General Shift, Morning Shift, Night Shift"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text transition-all"
                    />
                </div>

                {/* 2. Shift Active Status */}
                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-2xs">
                    <ToggleRow
                        label="Shift Status"
                        subLabel="When active, employees can be assigned to and clock in for this shift"
                        checked={shiftForm.is_active}
                        onChange={e => setShiftForm(p => ({ ...p, is_active: e.target.checked }))}
                        color="emerald"
                        activeText="Active"
                        inactiveText="Inactive"
                    />
                </div>

                {/* 3. Shift Work Hours */}
                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-800 dark:text-github-dark-text">
                            Work Timings
                        </label>
                        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/30">
                            {calculateDuration(shiftForm.start, shiftForm.end)} per shift
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                                Clock-In Time
                            </span>
                            <input
                                type="time"
                                required
                                value={shiftForm.start}
                                onChange={e => setShiftForm({ ...shiftForm, start: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-normal text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                                Clock-Out Time
                            </span>
                            <input
                                type="time"
                                required
                                value={shiftForm.end}
                                onChange={e => setShiftForm({ ...shiftForm, end: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-normal text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Working Days & 1-Click Presets */}
                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text">
                            Working Days
                        </h4>
                        <span className="text-[10px] text-slate-400 font-normal">
                            Tap any day to toggle
                        </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Presets:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => applySchedulePreset('5day')}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs"
                            >
                                5-Day (Mon–Fri)
                            </button>
                            <button
                                type="button"
                                onClick={() => applySchedulePreset('6day')}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs"
                            >
                                6-Day (Mon–Sat)
                            </button>
                            <button
                                type="button"
                                onClick={() => applySchedulePreset('2nd4thSat')}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs"
                            >
                                2nd & 4th Sat Off
                            </button>
                            <button
                                type="button"
                                onClick={() => applySchedulePreset('all7')}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs"
                            >
                                All 7 Days
                            </button>
                        </div>
                    </div>

                    {/* Day Selector Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                            const isSelected = shiftForm.workingDays.includes(day);
                            const hasAlternateOff = shiftForm.weekOffRules.find(r => r.day === day)?.weeks.length > 0;
                            const hasHalfDay = shiftForm.halfDayRules.find(r => r.day === day)?.weeks.length > 0;

                            let buttonStyle = "bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700";
                            let statusBadge = "Off";

                            if (isSelected) {
                                if (hasHalfDay) {
                                    buttonStyle = "bg-blue-500 text-white border-blue-600 shadow-xs";
                                    statusBadge = "Half";
                                } else {
                                    buttonStyle = "bg-indigo-600 text-white border-indigo-700 shadow-xs";
                                    statusBadge = "Work";
                                }
                            } else if (hasAlternateOff) {
                                buttonStyle = "bg-amber-500 text-white border-amber-600 shadow-xs";
                                statusBadge = "Alt Off";
                            }

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => {
                                        setShiftForm(prev => {
                                            const newDays = isSelected
                                                ? prev.workingDays.filter(d => d !== day)
                                                : [...prev.workingDays, day];
                                            const newWo = isSelected ? prev.weekOffRules : prev.weekOffRules.filter(r => r.day !== day);
                                            const newHd = isSelected ? prev.halfDayRules.filter(r => r.day !== day) : prev.halfDayRules;
                                            return { ...prev, workingDays: newDays, weekOffRules: newWo, halfDayRules: newHd };
                                        });
                                    }}
                                    className={`flex-1 min-w-[42px] py-2 px-1 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${buttonStyle}`}
                                >
                                    <span className="text-xs font-semibold">{day}</span>
                                    <span className="text-[9px] font-normal opacity-90 leading-tight mt-0.5">{statusBadge}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Plain English Summary Sentence */}
                    <div className="p-2.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200 text-xs font-normal leading-relaxed">
                        {getScheduleDescription()}
                    </div>
                </div>

                {/* 5. Advanced Settings Toggle Button */}
                <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border transition-colors cursor-pointer"
                >
                    <span>{showAdvancedSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings (Grace, Overtime, Alternate Rules)'}</span>
                    {showAdvancedSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* 6. Advanced Settings Section */}
                {showAdvancedSettings && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* A. Grace & Correction Deadlines */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Grace Period */}
                            <div className="p-3.5 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Late Grace Period
                                    </label>
                                    <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                        {shiftForm.grace || 0} mins
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {[0, 5, 10, 15, 30].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setShiftForm({ ...shiftForm, grace: m })}
                                            className={`flex-1 py-1 text-[11px] font-medium rounded-md border cursor-pointer transition-colors ${
                                                Number(shiftForm.grace) === m
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            {m === 0 ? 'None' : `${m}m`}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 font-normal">
                                    Employees checking in within this time won't be marked Late.
                                </p>
                            </div>

                            {/* Correction Deadline */}
                            <div className="p-3.5 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Correction Deadline
                                    </label>
                                    <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                        {shiftForm.correctionDeadline || 2} days
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {[1, 2, 3, 7, 14].map(d => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => setShiftForm({ ...shiftForm, correctionDeadline: d })}
                                            className={`flex-1 py-1 text-[11px] font-medium rounded-md border cursor-pointer transition-colors ${
                                                Number(shiftForm.correctionDeadline) === d
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            {d}d
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 font-normal">
                                    Days allowed for staff to request missed punch corrections.
                                </p>
                            </div>
                        </div>

                        {/* B. Overtime Tracking */}
                        <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3.5 shadow-2xs">
                            <ToggleRow
                                label="Overtime Tracking"
                                subLabel="Automatically calculate and credit extra hours worked"
                                checked={isOtEnabled}
                                onChange={e => setIsOtEnabled(e.target.checked)}
                                color="indigo"
                                activeText="Enabled"
                                inactiveText="Disabled"
                            />

                            {isOtEnabled && (
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700/50 space-y-3.5">
                                    {/* 1. When OT starts */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Overtime Starts After:
                                            </span>
                                            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                                {otThresholdHr}h {otThresholdMin > 0 ? `${otThresholdMin}m` : '00m'} of work
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    { label: 'Shift End', hr: Math.floor((parseFloat(shiftForm.otThreshold) || 8)), min: 0 },
                                                    { label: '8 hours', hr: 8, min: 0 },
                                                    { label: '8h 30m', hr: 8, min: 30 },
                                                    { label: '9 hours', hr: 9, min: 0 },
                                                    { label: '9h 30m', hr: 9, min: 30 }
                                                ].map((preset, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => handleOtThresholdChange(preset.hr, preset.min)}
                                                        className={`h-8 inline-flex items-center px-2.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                                                            otThresholdHr === preset.hr && otThresholdMin === preset.min
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                        }`}
                                                    >
                                                        {preset.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                                <span className="text-[11px] text-slate-400 font-normal">Custom:</span>
                                                <ThemedTimeStepper
                                                    hours={otThresholdHr}
                                                    minutes={otThresholdMin}
                                                    onHoursChange={newHr => handleOtThresholdChange(newHr, otThresholdMin)}
                                                    onMinutesChange={newMin => handleOtThresholdChange(otThresholdHr, newMin)}
                                                    maxHours={23}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Buffer Window */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Grace Buffer Window:
                                            </span>
                                            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                                {otBufferHr > 0 ? `${otBufferHr}h ` : ''}{otBufferMin}m grace
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    { label: 'None (0m)', hr: 0, min: 0 },
                                                    { label: '15 mins', hr: 0, min: 15 },
                                                    { label: '30 mins', hr: 0, min: 30 },
                                                    { label: '45 mins', hr: 0, min: 45 },
                                                    { label: '1 hour', hr: 1, min: 0 }
                                                ].map((preset, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => handleOtBufferChange(preset.hr, preset.min)}
                                                        className={`h-8 inline-flex items-center px-2.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                                                            otBufferHr === preset.hr && otBufferMin === preset.min
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                        }`}
                                                    >
                                                        {preset.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                                <span className="text-[11px] text-slate-400 font-normal">Custom:</span>
                                                <ThemedTimeStepper
                                                    hours={otBufferHr}
                                                    minutes={otBufferMin}
                                                    onHoursChange={newHr => handleOtBufferChange(newHr, otBufferMin)}
                                                    onMinutesChange={newMin => handleOtBufferChange(otBufferHr, newMin)}
                                                    maxHours={23}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-normal">
                                            Extra time below this buffer will not trigger overtime.
                                        </p>
                                    </div>

                                    {/* 3. Daily Max Overtime Cap */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Daily Overtime Cap:
                                            </span>
                                            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                                {otMaxHoursHr > 0 ? `${otMaxHoursHr}h max` : 'No Cap'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    { label: '2 hours', hr: 2, min: 0 },
                                                    { label: '3 hours', hr: 3, min: 0 },
                                                    { label: '4 hours', hr: 4, min: 0 },
                                                    { label: '5 hours', hr: 5, min: 0 },
                                                    { label: 'No Limit', hr: 0, min: 0 }
                                                ].map((preset, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => handleOtMaxHoursChange(preset.hr, preset.min)}
                                                        className={`h-8 inline-flex items-center px-2.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                                                            otMaxHoursHr === preset.hr && (preset.hr === 0 || otMaxHoursMin === preset.min)
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                        }`}
                                                    >
                                                        {preset.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                                <span className="text-[11px] text-slate-400 font-normal">Custom:</span>
                                                <ThemedTimeStepper
                                                    hours={otMaxHoursHr}
                                                    minutes={otMaxHoursMin}
                                                    onHoursChange={newHr => handleOtMaxHoursChange(newHr, otMaxHoursMin)}
                                                    onMinutesChange={newMin => handleOtMaxHoursChange(otMaxHoursHr, newMin)}
                                                    maxHours={24}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* C. Clean Alternate Schedule Rules (Replaces the 70-button grid!) */}
                        <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text">
                                        Special Weekend & Alternate Rules
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                                        Need 2nd & 4th Saturday off, or Saturday half-days? Configure here.
                                    </p>
                                </div>
                            </div>

                            {/* Section Switcher Tabs: Alternate Offs vs Half Days */}
                            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setAltTab('weekOff')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                                        altTab === 'weekOff'
                                            ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 shadow-2xs'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                    }`}
                                >
                                    Alternate Off Days
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAltTab('halfDay')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                                        altTab === 'halfDay'
                                            ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 shadow-2xs'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                    }`}
                                >
                                    Half Days
                                </button>
                            </div>

                            {/* Select Day for Rule */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                    <span>Select Day:</span>
                                    <span className="text-[10px] text-slate-400">Usually configured on Saturday</span>
                                </div>
                                <div className="flex gap-1">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => setSelectedAltDay(day)}
                                            className={`flex-1 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                                selectedAltDay === day
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* TAB 1: Alternate Offs */}
                            {altTab === 'weekOff' && (
                                <div className="p-3.5 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                            {selectedAltDay} Off Frequency:
                                        </span>
                                        {currentDayWeekOffRule.weeks.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setWeeksForSelectedDay([])}
                                                className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                                            >
                                                Clear {selectedAltDay}
                                            </button>
                                        )}
                                    </div>

                                    {/* 1-Click Common Presets for Day */}
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setWeeksForSelectedDay([2, 4])}
                                            className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                                currentDayWeekOffRule.weeks.length === 2 && currentDayWeekOffRule.weeks.includes(2) && currentDayWeekOffRule.weeks.includes(4)
                                                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                                            }`}
                                        >
                                            2nd & 4th {selectedAltDay} Off
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setWeeksForSelectedDay([1, 3])}
                                            className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                                currentDayWeekOffRule.weeks.length === 2 && currentDayWeekOffRule.weeks.includes(1) && currentDayWeekOffRule.weeks.includes(3)
                                                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                                            }`}
                                        >
                                            1st & 3rd {selectedAltDay} Off
                                        </button>
                                    </div>

                                    {/* Manual Week Pills */}
                                    <div className="space-y-1 pt-1">
                                        <p className="text-[10px] text-slate-400 font-normal">Or tap individual weeks to customize:</p>
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 4, 5].map(week => {
                                                const isOff = currentDayWeekOffRule.weeks.includes(week);
                                                return (
                                                    <button
                                                        key={week}
                                                        type="button"
                                                        onClick={() => toggleRule(selectedAltDay, 'weekOffRules', week)}
                                                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                                            isOff
                                                                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {week}{week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: Half Days */}
                            {altTab === 'halfDay' && (
                                <div className="p-3.5 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                            {selectedAltDay} Half-Day Frequency:
                                        </span>
                                        {currentDayHalfDayRule.weeks.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setHalfDaysForSelectedDay([])}
                                                className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                                            >
                                                Clear {selectedAltDay}
                                            </button>
                                        )}
                                    </div>

                                    {/* Quick Presets */}
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setHalfDaysForSelectedDay([1, 2, 3, 4, 5])}
                                            className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                                currentDayHalfDayRule.weeks.length === 5
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                            }`}
                                        >
                                            Every {selectedAltDay} Half-Day
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHalfDaysForSelectedDay([2, 4])}
                                            className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                                currentDayHalfDayRule.weeks.length === 2 && currentDayHalfDayRule.weeks.includes(2) && currentDayHalfDayRule.weeks.includes(4)
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                            }`}
                                        >
                                            2nd & 4th {selectedAltDay}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHalfDaysForSelectedDay([1, 3])}
                                            className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                                currentDayHalfDayRule.weeks.length === 2 && currentDayHalfDayRule.weeks.includes(1) && currentDayHalfDayRule.weeks.includes(3)
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                            }`}
                                        >
                                            1st & 3rd {selectedAltDay}
                                        </button>
                                    </div>

                                    {/* Manual Week Pills */}
                                    <div className="space-y-1 pt-1">
                                        <p className="text-[10px] text-slate-400 font-normal">Weeks applicable:</p>
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 4, 5].map(week => {
                                                const isHalf = currentDayHalfDayRule.weeks.includes(week);
                                                return (
                                                    <button
                                                        key={week}
                                                        type="button"
                                                        onClick={() => toggleRule(selectedAltDay, 'halfDayRules', week)}
                                                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                                            isHalf
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {week}{week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Half-Day Hours */}
                                    {currentDayHalfDayRule.weeks.length > 0 && (
                                        <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-1.5">
                                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                                Half-Day Working Hours:
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={currentDayHalfDayRule.timing?.start_time || shiftForm.start}
                                                    onChange={e => setRuleTiming(selectedAltDay, 'halfDayRules', 'start_time', e.target.value)}
                                                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-normal"
                                                />
                                                <span className="text-xs text-slate-400">to</span>
                                                <input
                                                    type="time"
                                                    value={currentDayHalfDayRule.timing?.end_time || '13:00'}
                                                    onChange={e => setRuleTiming(selectedAltDay, 'halfDayRules', 'end_time', e.target.value)}
                                                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-normal"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Active Rules Tags */}
                            {(shiftForm.weekOffRules.length > 0 || shiftForm.halfDayRules.length > 0) && (
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 space-y-1.5">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Configured Special Rules:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {shiftForm.weekOffRules.map(r => (
                                            <span
                                                key={r.day}
                                                className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 px-2 py-0.5 rounded-md"
                                            >
                                                <span>{r.day}: {r.weeks.map(w => w + (w===1?'st':w===2?'nd':w===3?'rd':'th')).join(', ')} week off</span>
                                                <button
                                                    type="button"
                                                    onClick={() => clearAllAlternateRules(r.day)}
                                                    className="text-amber-500 hover:text-amber-800 cursor-pointer font-bold ml-0.5"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                        {shiftForm.halfDayRules.map(r => (
                                            <span
                                                key={r.day}
                                                className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 px-2 py-0.5 rounded-md"
                                            >
                                                <span>
                                                    {r.day}: {r.weeks.length === 5 ? 'Every week half-day' : `${r.weeks.map(w => w + (w===1?'st':w===2?'nd':w===3?'rd':'th')).join(', ')} week half-day`}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => clearAllAlternateRules(r.day)}
                                                    className="text-blue-500 hover:text-blue-800 cursor-pointer font-bold ml-0.5"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* D. Verification Requirements */}
                        <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3 shadow-2xs">
                            <h4 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text">
                                Verification Requirements
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-3 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border space-y-2">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Clock-In</p>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-slate-700 dark:text-slate-300 font-normal">Require Selfie</span>
                                        <ToggleSwitch
                                            checked={shiftForm.reqEntrySelfie}
                                            onChange={() => setShiftForm(p => ({ ...p, reqEntrySelfie: !p.reqEntrySelfie }))}
                                            color="indigo"
                                        />
                                    </div>
                                </div>
                                <div className="p-3 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border space-y-2">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Clock-Out</p>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-slate-700 dark:text-slate-300 font-normal">Require Selfie</span>
                                        <ToggleSwitch
                                            checked={shiftForm.reqExitSelfie}
                                            onChange={() => setShiftForm(p => ({ ...p, reqExitSelfie: !p.reqExitSelfie }))}
                                            color="indigo"
                                        />
                                    </div>
                                </div>
                                <div className="p-3 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border space-y-2.5">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Location Checkpoint</p>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-slate-700 dark:text-slate-300 font-normal">Checkpoints</span>
                                        <ToggleSwitch
                                            checked={shiftForm.checkpointEnabled}
                                            onChange={() => setShiftForm(p => ({ ...p, checkpointEnabled: !p.checkpointEnabled }))}
                                            color="indigo"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <span className={`text-xs font-normal ${shiftForm.checkpointEnabled ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>Require Selfie</span>
                                        <ToggleSwitch
                                            checked={shiftForm.reqCheckpointSelfie}
                                            disabled={!shiftForm.checkpointEnabled}
                                            onChange={() => setShiftForm(p => ({ ...p, reqCheckpointSelfie: !p.reqCheckpointSelfie }))}
                                            color="indigo"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Save / Cancel Action Buttons */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text rounded-xl text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 shadow-sm transition-colors flex items-center justify-center cursor-pointer"
                    >
                        Save Shift
                    </button>
                </div>
            </form>
        </>
    );
};

export default ShiftFormDrawer;
