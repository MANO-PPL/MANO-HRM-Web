import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, X, AlertCircle } from 'lucide-react';
import { isTimeInShiftRange } from '../utils/dateUtils';

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
 * Supports dynamic disabling of timeframe windows (e.g. shift working hours).
 */
export default function TimePicker({
    value = '',
    onChange,
    placeholder = 'HH:MM',
    compact = false,
    icon,
    align = 'left',
    dropUp = false,
    className = '',
    clearable = true,
    disabledRange = null, // { start: '09:00', end: '18:00' }
    isTimeDisabled = null, // (timeStr) => boolean
    disabledRangeMessage = '',
    onClear = null
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const [inputError, setInputError] = useState('');
    const containerRef = useRef(null);

    // Keep internal input text synchronized with external value
    useEffect(() => {
        setInputValue(value || '');
        setInputError('');
    }, [value]);

    // Check whether a specific "HH:MM" string is disabled
    const checkIsDisabled = (timeStr) => {
        if (!timeStr) return false;
        if (typeof isTimeDisabled === 'function') {
            return isTimeDisabled(timeStr);
        }
        if (disabledRange && disabledRange.start && disabledRange.end) {
            return isTimeInShiftRange(timeStr, disabledRange.start, disabledRange.end);
        }
        return false;
    };

    // Helper: convert 12-hour + period into 24-hour hour integer
    const getH24 = (h12, prd) => {
        if (prd === 'AM') return h12 === 12 ? 0 : h12;
        return h12 === 12 ? 12 : h12 + 12;
    };

    // Parse value into 12-hour components: { hour12: 1-12, minute: 0-59, period: 'AM' | 'PM' }
    const parsedTime = useMemo(() => {
        if (!value || typeof value !== 'string' || !value.includes(':')) {
            // Pick a sensible starting dial position outside disabledRange if available
            let defH24 = 20;
            let defMin = 0;
            if (disabledRange && disabledRange.end) {
                const [eh, em] = disabledRange.end.split(':').map(Number);
                if (!isNaN(eh)) {
                    // Start dial 1 hour after shift end
                    defH24 = (eh + 1) % 24;
                    defMin = !isNaN(em) ? (Math.ceil(em / 5) * 5) % 60 : 0;
                }
            }
            const testStr = `${String(defH24).padStart(2, '0')}:${String(defMin).padStart(2, '0')}`;
            if (checkIsDisabled(testStr)) {
                // Find first non-disabled hour
                for (let h = 0; h < 24; h++) {
                    const candidate = `${String(h).padStart(2, '0')}:00`;
                    if (!checkIsDisabled(candidate)) {
                        defH24 = h;
                        defMin = 0;
                        break;
                    }
                }
            }
            const period = defH24 >= 12 ? 'PM' : 'AM';
            const hour12 = defH24 % 12 === 0 ? 12 : defH24 % 12;
            return { hour12, minute: defMin, period, rawHour: defH24, rawMinute: defMin };
        }
        const [hStr, mStr] = value.split(':');
        const rawH = parseInt(hStr, 10);
        const rawM = parseInt(mStr, 10);
        const validH = isNaN(rawH) ? 9 : Math.max(0, Math.min(23, rawH));
        const validM = isNaN(rawM) ? 0 : Math.max(0, Math.min(59, rawM));
        const period = validH >= 12 ? 'PM' : 'AM';
        const hour12 = validH % 12 === 0 ? 12 : validH % 12;
        return { hour12, minute: validM, period, rawHour: validH, rawMinute: validM };
    }, [value, disabledRange]);

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

    // Check if an entire hour (all 12 minute blocks 00-55) is disabled for the given period
    const isHourFullyDisabled = (h12, prd) => {
        const h24 = getH24(h12, prd);
        const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
        return minutes.every(m => checkIsDisabled(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`));
    };

    // Check if a minute is disabled under the current rawHour
    const isMinuteDisabled = (m) => {
        return checkIsDisabled(`${String(parsedTime.rawHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    };

    // Emit 24-hour "HH:MM"
    const emitTime = (h12, min, prd) => {
        let h24 = getH24(h12, prd);
        const hStr = String(h24).padStart(2, '0');
        const mStr = String(min).padStart(2, '0');
        const next = `${hStr}:${mStr}`;

        if (checkIsDisabled(next)) {
            setInputError(disabledRangeMessage || `Time falls within non-selectable shift window (${disabledRange?.start || ''} - ${disabledRange?.end || ''})`);
            return false;
        }

        setInputError('');
        setInputValue(next);
        if (onChange) onChange(next);
        return true;
    };

    // User types into the input directly
    const handleInputChange = (e) => {
        const text = e.target.value;
        setInputValue(text);
        if (!text.trim()) {
            setInputError('');
            if (onChange) onChange('');
            return;
        }
        const parsed = parseTypedTime(text);
        if (parsed) {
            if (checkIsDisabled(parsed)) {
                setInputError(disabledRangeMessage || `Cannot select ${parsed}: inside shift working hours (${disabledRange?.start || ''} - ${disabledRange?.end || ''})`);
            } else {
                setInputError('');
                if (onChange) onChange(parsed);
            }
        }
    };

    // Format cleanly on blur
    const handleInputBlur = () => {
        if (!inputValue.trim()) {
            setInputError('');
            if (onChange) onChange('');
            return;
        }
        const parsed = parseTypedTime(inputValue);
        if (parsed) {
            if (checkIsDisabled(parsed)) {
                setInputError(`Cannot select ${parsed}: inside shift hours`);
                setInputValue(value || '');
                setTimeout(() => setInputError(''), 2500);
            } else {
                setInputError('');
                setInputValue(parsed);
                if (onChange) onChange(parsed);
            }
        } else if (value) {
            setInputValue(value);
            setInputError('');
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
        const h24 = getH24(newH12, parsedTime.period);
        const targetTime = `${String(h24).padStart(2, '0')}:${String(parsedTime.minute).padStart(2, '0')}`;
        if (checkIsDisabled(targetTime)) {
            // Find first enabled minute in this hour
            const validM = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].find(m =>
                !checkIsDisabled(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
            );
            if (validM !== undefined) {
                emitTime(newH12, validM, parsedTime.period);
            }
        } else {
            emitTime(newH12, parsedTime.minute, parsedTime.period);
        }
    };

    const handleMinuteSelect = (newMin) => {
        if (isMinuteDisabled(newMin)) return;
        emitTime(parsedTime.hour12, newMin, parsedTime.period);
    };

    const handlePeriodToggle = (newPeriod) => {
        if (newPeriod === parsedTime.period) return;
        const targetH24 = getH24(parsedTime.hour12, newPeriod);
        const targetTime = `${String(targetH24).padStart(2, '0')}:${String(parsedTime.minute).padStart(2, '0')}`;
        if (checkIsDisabled(targetTime)) {
            const validM = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].find(m =>
                !checkIsDisabled(`${String(targetH24).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
            );
            if (validM !== undefined) {
                emitTime(parsedTime.hour12, validM, newPeriod);
                return;
            }
            const validH12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find(h => !isHourFullyDisabled(h, newPeriod));
            if (validH12 !== undefined) {
                const h24Valid = getH24(validH12, newPeriod);
                const validMInH = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].find(m =>
                    !checkIsDisabled(`${String(h24Valid).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
                ) || 0;
                emitTime(validH12, validMInH, newPeriod);
                return;
            }
        } else {
            emitTime(parsedTime.hour12, parsedTime.minute, newPeriod);
        }
    };

    // Quick minute nudging (+/- 5m, +/- 15m) skipping disabled slots
    const handleNudge = (deltaMinutes, e) => {
        if (e) e.stopPropagation();
        let currentMins = parsedTime.rawHour * 60 + parsedTime.rawMinute;
        let nextMins = (currentMins + deltaMinutes) % 1440;
        if (nextMins < 0) nextMins += 1440;

        let attempts = 0;
        while (attempts < 288) {
            const nh = Math.floor(nextMins / 60);
            const nm = nextMins % 60;
            const testStr = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
            if (!checkIsDisabled(testStr)) {
                const h12 = nh % 12 === 0 ? 12 : nh % 12;
                const prd = nh >= 12 ? 'PM' : 'AM';
                emitTime(h12, nm, prd);
                return;
            }
            nextMins = (nextMins + (deltaMinutes > 0 ? 5 : -5)) % 1440;
            if (nextMins < 0) nextMins += 1440;
            attempts++;
        }
    };

    // Clear handler
    const handleClear = (e) => {
        if (e) e.stopPropagation();
        setInputValue('');
        setInputError('');
        if (onChange) onChange('');
        if (onClear) onClear();
        setIsOpen(false);
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
        if (checkIsDisabled(presetTime)) return;
        setInputValue(presetTime);
        setInputError('');
        if (onChange) onChange(presetTime);
        setIsOpen(false);
    };

    const handleApplyCurrentTime = () => {
        const now = new Date();
        const next = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (checkIsDisabled(next)) {
            setInputError(`Current time (${next}) falls inside disabled shift hours`);
            return;
        }
        setInputValue(next);
        setInputError('');
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
                        icon ? 'pl-10' : 'pl-3'
                    } ${
                        clearable && (inputValue || value) ? 'pr-16' : 'pr-9'
                    } bg-white dark:bg-dark-card border rounded-xl font-mono font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs ${
                        inputError
                            ? 'border-rose-500 ring-2 ring-rose-500/20 text-rose-600 dark:text-rose-400'
                            : isOpen
                                ? 'ring-2 ring-indigo-500/20 border-indigo-500 dark:border-indigo-500'
                                : 'border-slate-200 dark:border-github-dark-border focus:ring-1 focus:ring-indigo-500'
                    }`}
                />

                <div className="absolute right-2 flex items-center gap-1">
                    {/* Clear button if value is set */}
                    {clearable && (inputValue || value) && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Clear time (reset to default / auto)"
                        >
                            <X size={compact ? 12 : 14} />
                        </button>
                    )}

                    {/* Clock button to open the visual picker dropdown */}
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Open visual time selector"
                    >
                        <Clock size={compact ? 13 : 15} />
                    </button>
                </div>
            </div>

            {/* Inline validation error feedback */}
            {inputError && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-rose-500 dark:text-rose-400 font-medium">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{inputError}</span>
                </div>
            )}

            {/* ─── CUSTOM THEMED TIME PICKER POPOVER ─── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: dropUp ? -6 : 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: dropUp ? -6 : 6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute ${dropUp ? 'bottom-full mb-2' : 'top-full mt-1.5'} ${
                            align === 'right' ? 'right-0' : 'left-0'
                        } w-72 sm:w-80 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl shadow-2xl z-[250] overflow-hidden p-3.5 space-y-3`}
                    >
                        {/* Protection Banner: Shows non-selectable shift window if disabledRange is provided */}
                        {disabledRange && disabledRange.start && disabledRange.end && (
                            <div className="p-2 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-xl flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                                <AlertCircle size={14} className="shrink-0 text-amber-500 mt-0.5" />
                                <div className="leading-tight">
                                    <span className="font-semibold">Shift Hours Protected:</span> {disabledRange.start}–{disabledRange.end} is non-selectable to prevent premature missed punch flagging.
                                </div>
                            </div>
                        )}

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
                                    onClick={(e) => handleNudge(-15, e)}
                                    className="py-1 rounded-lg bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/70 dark:border-github-dark-border/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-normal transition-colors cursor-pointer"
                                >
                                    -15m
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleNudge(-5, e)}
                                    className="py-1 rounded-lg bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/70 dark:border-github-dark-border/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-normal transition-colors cursor-pointer"
                                >
                                    -5m
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleNudge(5, e)}
                                    className="py-1 rounded-lg bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/70 dark:border-github-dark-border/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-normal transition-colors cursor-pointer"
                                >
                                    +5m
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleNudge(15, e)}
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
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            Hour
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-normal">
                                            {parsedTime.period}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-6 gap-1">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => {
                                            const isSelected = parsedTime.hour12 === h;
                                            const disabled = isHourFullyDisabled(h, parsedTime.period);
                                            return (
                                                <button
                                                    key={h}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => handleHourSelect(h)}
                                                    title={disabled ? `Hour ${h} ${parsedTime.period} falls within shift hours` : `Select hour ${h}`}
                                                    className={`h-8 rounded-lg text-xs font-mono transition-all ${
                                                        disabled
                                                            ? 'opacity-25 cursor-not-allowed bg-slate-100/40 dark:bg-github-dark-bg/20 text-slate-400 dark:text-slate-600 line-through'
                                                            : isSelected
                                                                ? 'bg-indigo-600 text-white font-medium shadow-xs cursor-pointer'
                                                                : 'bg-slate-50/70 dark:bg-github-dark-bg/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-normal'
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
                                            const disabled = isMinuteDisabled(m);
                                            return (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => handleMinuteSelect(m)}
                                                    title={disabled ? `Minute ${String(m).padStart(2, '0')} falls within shift hours` : `Select minute ${String(m).padStart(2, '0')}`}
                                                    className={`h-8 rounded-lg text-xs font-mono transition-all ${
                                                        disabled
                                                            ? 'opacity-25 cursor-not-allowed text-slate-400 dark:text-slate-600 line-through bg-slate-100/40 dark:bg-github-dark-bg/20'
                                                            : isSelected
                                                                ? 'bg-emerald-600 text-white font-medium shadow-xs cursor-pointer'
                                                                : 'bg-slate-50/70 dark:bg-github-dark-bg/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-normal'
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
                                {PRESETS.map((p) => {
                                    const disabled = checkIsDisabled(p.time);
                                    return (
                                        <button
                                            key={p.time}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => handleApplyPreset(p.time)}
                                            className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between text-xs transition-colors ${
                                                disabled
                                                    ? 'opacity-35 cursor-not-allowed bg-slate-50/30 dark:bg-github-dark-bg/10 border-slate-200/40 text-slate-400 line-through'
                                                    : value === p.time
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 cursor-pointer'
                                                        : 'bg-slate-50/70 dark:bg-github-dark-bg/40 border-slate-200/60 dark:border-github-dark-border/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer'
                                            }`}
                                        >
                                            <span className="font-normal flex items-center gap-1.5">
                                                <span>{p.label}</span>
                                                {disabled && (
                                                    <span className="text-[10px] text-rose-500 font-medium no-underline inline-block">(In shift)</span>
                                                )}
                                            </span>
                                            <span className="font-mono text-slate-500 dark:text-slate-400">{p.desc}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Footer: Reset/Clear to Auto & Done Button */}
                        <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border/50 flex items-center justify-between gap-2">
                            {clearable && (
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-github-dark-border hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 text-xs font-medium transition-colors cursor-pointer"
                                >
                                    Clear (Auto)
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="h-8 px-4 ml-auto rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
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
