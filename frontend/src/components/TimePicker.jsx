import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, Check, Sparkles } from 'lucide-react';

/**
 * Parses user typed strings in various formats (e.g. "07:05", "7:05", "18:30", "6:30 pm", "0900", "9")
 * into normalized 24-hour "HH:MM" format.
 */
function parseTypedTime(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let s = raw.trim().toLowerCase();
    const isPM = s.includes('pm') || s.includes('p');
    const isAM = s.includes('am') || s.includes('a');
    s = s.replace(/[^\d:]/g, '');
    let h = NaN;
    let m = NaN;
    if (s.includes(':')) {
        const parts = s.split(':');
        h = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
    } else if (s.length === 3) {
        h = parseInt(s.slice(0, 1), 10);
        m = parseInt(s.slice(1), 10);
    } else if (s.length === 4) {
        h = parseInt(s.slice(0, 2), 10);
        m = parseInt(s.slice(2), 10);
    } else if (s.length === 1 || s.length === 2) {
        h = parseInt(s, 10);
        m = 0;
    }
    if (isNaN(h) || isNaN(m)) return null;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * ThemedTimePicker
 * An editable time input that lets the user WRITE/TYPE directly, while also offering a sleek,
 * theme-compliant popover for visual picking, +/- nudges, and shift presets.
 */
export default function TimePicker({
    value = '',
    onChange,
    placeholder = 'HH:MM',
    compact = false,
    icon,
    align = 'left',
    className = ''
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const containerRef = useRef(null);

    // Keep internal input text synchronized with external value
    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    // Parse value into 12-hour components: { hour12: 1-12, minute: 0-59, period: 'AM' | 'PM' }
    const parsedTime = useMemo(() => {
        if (!value || typeof value !== 'string' || !value.includes(':')) {
            return { hour12: 9, minute: 0, period: 'AM', rawHour: 9, rawMinute: 0 };
        }
        const [hStr, mStr] = value.split(':');
        const rawH = parseInt(hStr, 10);
        const rawM = parseInt(mStr, 10);
        const validH = isNaN(rawH) ? 9 : Math.max(0, Math.min(23, rawH));
        const validM = isNaN(rawM) ? 0 : Math.max(0, Math.min(59, rawM));
        const period = validH >= 12 ? 'PM' : 'AM';
        const hour12 = validH % 12 === 0 ? 12 : validH % 12;
        return { hour12, minute: validM, period, rawHour: validH, rawMinute: validM };
    }, [value]);

    const [activeTab, setActiveTab] = useState('picker'); // 'picker' | 'presets'

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Emit 24-hour "HH:MM"
    const emitTime = (h12, min, prd) => {
        let h24 = h12;
        if (prd === 'AM') {
            if (h24 === 12) h24 = 0;
        } else {
            if (h24 !== 12) h24 += 12;
        }
        const hStr = String(h24).padStart(2, '0');
        const mStr = String(min).padStart(2, '0');
        const next = `${hStr}:${mStr}`;
        setInputValue(next);
        if (onChange) onChange(next);
    };

    // User types into the input directly
    const handleInputChange = (e) => {
        const text = e.target.value;
        setInputValue(text);
        const parsed = parseTypedTime(text);
        if (parsed) {
            if (onChange) onChange(parsed);
        }
    };

    // Format cleanly on blur
    const handleInputBlur = () => {
        if (!inputValue.trim()) {
            if (onChange) onChange('');
            return;
        }
        const parsed = parseTypedTime(inputValue);
        if (parsed) {
            setInputValue(parsed);
            if (onChange) onChange(parsed);
        } else if (value) {
            setInputValue(value);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleInputBlur();
            setIsOpen(false);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
        }
    };

    const handleHourSelect = (newH12) => {
        emitTime(newH12, parsedTime.minute, parsedTime.period);
    };

    const handleMinuteSelect = (newMin) => {
        emitTime(parsedTime.hour12, newMin, parsedTime.period);
    };

    const handlePeriodToggle = (newPeriod) => {
        if (newPeriod === parsedTime.period) return;
        emitTime(parsedTime.hour12, parsedTime.minute, newPeriod);
    };

    // Quick minute nudging (+/- 5m, +/- 15m)
    const handleNudge = (deltaMinutes, e) => {
        if (e) e.stopPropagation();
        let totalMins = parsedTime.rawHour * 60 + parsedTime.rawMinute + deltaMinutes;
        if (totalMins < 0) totalMins += 1440;
        totalMins = totalMins % 1440;
        const newH = Math.floor(totalMins / 60);
        const newM = totalMins % 60;
        const next = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        setInputValue(next);
        if (onChange) onChange(next);
    };

    // Common shift presets
    const PRESETS = [
        { label: 'Shift Start', time: '09:00', desc: '09:00 AM' },
        { label: 'Shift End', time: '18:00', desc: '06:00 PM' },
        { label: 'Morning Half', time: '13:00', desc: '01:00 PM' },
        { label: 'Late Punch', time: '09:30', desc: '09:30 AM' },
        { label: 'Overtime End', time: '20:00', desc: '08:00 PM' },
        { label: 'Night Shift Start', time: '20:00', desc: '08:00 PM' },
        { label: 'Night Shift End', time: '08:00', desc: '08:00 AM' }
    ];

    const handleApplyPreset = (presetTime) => {
        setInputValue(presetTime);
        if (onChange) onChange(presetTime);
        setIsOpen(false);
    };

    const handleApplyCurrentTime = () => {
        const now = new Date();
        const next = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setInputValue(next);
        if (onChange) onChange(next);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* ─── DIRECT EDITABLE INPUT TRIGGER ─── */}
            <div className="relative flex items-center">
                {icon && (
                    <div className="absolute left-3.5 pointer-events-none flex items-center justify-center">
                        {icon}
                    </div>
                )}

                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={`${
                        compact
                            ? 'h-9 px-2.5 text-xs w-full'
                            : 'w-full h-11 text-sm'
                    } ${
                        icon ? 'pl-10 pr-9' : 'pl-3 pr-8'
                    } bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl font-mono font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs ${
                        isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500 dark:border-indigo-500' : ''
                    }`}
                />

                {/* Clock button to open the visual picker dropdown */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-2 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Open visual time selector"
                >
                    <Clock size={compact ? 13 : 15} />
                </button>
            </div>

            {/* ─── CUSTOM THEMED TIME PICKER POPOVER ─── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-72 sm:w-80 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl shadow-2xl z-[250] overflow-hidden p-3.5 space-y-3`}
                    >
                        {/* Header: Prominent Time Display & AM/PM Toggle */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-github-dark-border/60">
                            <div>
                                <span className="text-[10px] uppercase font-medium text-slate-400 tracking-wider block">
                                    Selected Time
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-xl font-mono font-semibold text-slate-800 dark:text-slate-100">
                                        {String(parsedTime.hour12).padStart(2, '0')}
                                    </span>
                                    <span className="text-xl font-mono text-slate-400 font-semibold animate-pulse">:</span>
                                    <span className="text-xl font-mono font-semibold text-slate-800 dark:text-slate-100">
                                        {String(parsedTime.minute).padStart(2, '0')}
                                    </span>
                                    <span className="ml-1 text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400">
                                        {parsedTime.period}
                                    </span>
                                </div>
                            </div>

                            {/* AM / PM Segmented Pills */}
                            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-github-dark-bg rounded-xl border border-slate-200/80 dark:border-github-dark-border">
                                <button
                                    type="button"
                                    onClick={() => handlePeriodToggle('AM')}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                        parsedTime.period === 'AM'
                                            ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    AM
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePeriodToggle('PM')}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                        parsedTime.period === 'PM'
                                            ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    PM
                                </button>
                            </div>
                        </div>

                        {/* Quick Nudges Bar (+/- 15m, +/- 5m) */}
                        <div className="space-y-1">
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                Quick Nudge
                            </span>
                            <div className="grid grid-cols-4 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => handleNudge(-15)}
                                    className="py-1 rounded-lg bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/70 dark:border-github-dark-border/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-normal transition-colors cursor-pointer"
                                >
                                    -15m
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleNudge(-5)}
                                    className="py-1 rounded-lg bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/70 dark:border-github-dark-border/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-normal transition-colors cursor-pointer"
                                >
                                    -5m
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleNudge(5)}
                                    className="py-1 rounded-lg bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/70 dark:border-github-dark-border/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-normal transition-colors cursor-pointer"
                                >
                                    +5m
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleNudge(15)}
                                    className="py-1 rounded-lg bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/70 dark:border-github-dark-border/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-normal transition-colors cursor-pointer"
                                >
                                    +15m
                                </button>
                            </div>
                        </div>

                        {/* View Tabs: Grid Picker vs Quick Presets */}
                        <div className="flex items-center gap-1 border-b border-slate-100 dark:border-github-dark-border/50 pb-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('picker')}
                                className={`text-xs font-normal pb-1 transition-colors cursor-pointer relative ${
                                    activeTab === 'picker'
                                        ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                Dial Selector
                                {activeTab === 'picker' && (
                                    <span className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                                )}
                            </button>
                            <span className="text-slate-300 dark:text-slate-600 text-xs px-1">•</span>
                            <button
                                type="button"
                                onClick={() => setActiveTab('presets')}
                                className={`text-xs font-normal pb-1 transition-colors cursor-pointer relative ${
                                    activeTab === 'presets'
                                        ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                Shift Presets
                                {activeTab === 'presets' && (
                                    <span className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                                )}
                            </button>
                        </div>

                        {/* TAB 1: HOUR & MINUTE GRIDS */}
                        {activeTab === 'picker' && (
                            <div className="space-y-3">
                                {/* Hours Grid (1 to 12) */}
                                <div>
                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                                        Hour
                                    </span>
                                    <div className="grid grid-cols-6 gap-1">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => {
                                            const isSelected = parsedTime.hour12 === h;
                                            return (
                                                <button
                                                    key={h}
                                                    type="button"
                                                    onClick={() => handleHourSelect(h)}
                                                    className={`h-8 rounded-lg text-xs font-mono font-normal transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white font-medium shadow-xs'
                                                            : 'bg-slate-50/70 dark:bg-github-dark-bg/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    }`}
                                                >
                                                    {h}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Minutes Grid (00 to 55 by 5 mins) */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            Minute
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400">
                                            Current: {String(parsedTime.minute).padStart(2, '0')}m
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-6 gap-1">
                                        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => {
                                            const isSelected = parsedTime.minute === m;
                                            return (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => handleMinuteSelect(m)}
                                                    className={`h-8 rounded-lg text-xs font-mono font-normal transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-emerald-600 text-white font-medium shadow-xs'
                                                            : 'bg-slate-50/70 dark:bg-github-dark-bg/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    }`}
                                                >
                                                    {String(m).padStart(2, '0')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: SHIFT PRESETS */}
                        {activeTab === 'presets' && (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                                <button
                                    type="button"
                                    onClick={handleApplyCurrentTime}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-github-dark-bg/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-github-dark-border/40 text-left flex items-center justify-between text-xs transition-colors cursor-pointer"
                                >
                                    <span className="font-medium text-indigo-600 dark:text-indigo-400">Current Time</span>
                                    <span className="font-mono text-slate-500">Now</span>
                                </button>
                                {PRESETS.map((p) => (
                                    <button
                                        key={p.time}
                                        type="button"
                                        onClick={() => handleApplyPreset(p.time)}
                                        className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                            value === p.time
                                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                                                : 'bg-slate-50/70 dark:bg-github-dark-bg/40 border-slate-200/60 dark:border-github-dark-border/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <span className="font-normal">{p.label}</span>
                                        <span className="font-mono text-slate-500 dark:text-slate-400">{p.desc}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Footer Done Button */}
                        <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border/50 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="h-8 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                            >
                                <Check size={13} />
                                <span>Done</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
