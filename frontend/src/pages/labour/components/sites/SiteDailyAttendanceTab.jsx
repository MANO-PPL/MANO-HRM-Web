import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock, AlertTriangle, Search, X, Building, Plus,
    Save, Loader2, CheckCircle, XCircle, RotateCcw, CheckSquare, Check
} from 'lucide-react';
import LoadingScreen from '../../../../components/LoadingScreen';

/* ─── Overtime Input (type + keyboard shortcuts) ───────────────────────────── */
const OvertimeInput = ({ value = 0, onChange, max = 12, compact = false }) => {
    const [draft, setDraft]     = useState(String(value));
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);

    // Sync external value changes only when input is not actively focused
    useEffect(() => {
        if (!focused) setDraft(String(value));
    }, [value, focused]);

    const clamp = (n) => Math.min(max, Math.max(0, n));

    const step = (delta) => {
        const next = clamp(value + delta);
        setDraft(String(next));
        onChange(next);
    };

    const commit = () => {
        const n = parseInt(draft, 10);
        const safe = isNaN(n) ? 0 : clamp(n);
        setDraft(String(safe));
        if (safe !== value) onChange(safe);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowUp'   || e.key === '+' || e.key === '=') { e.preventDefault(); step(1);  }
        else if (e.key === 'ArrowDown' || e.key === '-')              { e.preventDefault(); step(-1); }
        else if (e.key === 'Enter')                                    { e.preventDefault(); commit(); inputRef.current?.blur(); }
    };

    // Shared stepper button style
    const btnCls = [
        'flex items-center justify-center rounded-md font-bold select-none transition-all cursor-pointer border',
        'bg-slate-100 dark:bg-[#21262d] border-slate-200 dark:border-[#30363d]',
        'text-slate-500 dark:text-slate-400',
        'hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600',
        'dark:hover:bg-indigo-950/30 dark:hover:border-indigo-700 dark:hover:text-indigo-400',
        'disabled:opacity-25 disabled:cursor-not-allowed',
        'disabled:hover:bg-slate-100 disabled:hover:border-slate-200 disabled:hover:text-slate-500',
        'dark:disabled:hover:bg-[#21262d] dark:disabled:hover:border-[#30363d] dark:disabled:hover:text-slate-400',
    ].join(' ');

    const inputBaseCls = [
        'text-center font-mono font-semibold bg-slate-50 dark:bg-[#161b22]',
        'border border-slate-200 dark:border-[#30363d]',
        'text-slate-800 dark:text-[#f0f6fc] rounded-lg',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
        'focus:border-indigo-400 dark:focus:border-indigo-600 transition-all',
    ].join(' ');

    const hint = (
        <AnimatePresence>
            {focused && (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.1 }}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-none
                        bg-slate-900 dark:bg-[#0d1117] text-white text-[9px] font-medium
                        px-2 py-1 rounded-lg whitespace-nowrap shadow-xl
                        border border-slate-700 dark:border-[#30363d]"
                >
                    ↑↓ · +/− · Enter
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (compact) {
        return (
            <div className="inline-flex items-center gap-0.5">
                <button type="button" tabIndex={-1} disabled={value <= 0}
                    onClick={() => step(-1)} className={`${btnCls} w-5 h-5 text-[13px] leading-none`}>−</button>

                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
                        onFocus={() => { setFocused(true); setTimeout(() => inputRef.current?.select(), 0); }}
                        onBlur={() => { setFocused(false); commit(); }}
                        onKeyDown={handleKeyDown}
                        className={`${inputBaseCls} w-8 px-0.5 py-0.5 text-[11px]`}
                    />
                    {hint}
                </div>

                <button type="button" tabIndex={-1} disabled={value >= max}
                    onClick={() => step(1)} className={`${btnCls} w-5 h-5 text-[13px] leading-none`}>+</button>

                <span className="text-[10px] text-slate-400 dark:text-[#8b949e] font-medium ml-0.5">h</span>
            </div>
        );
    }

    return (
        <div className="inline-flex items-center gap-0.5">
            <button type="button" tabIndex={-1} disabled={value <= 0}
                onClick={() => step(-1)} className={`${btnCls} w-4 h-4 text-[12px] leading-none`}>−</button>

            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
                    onFocus={() => { setFocused(true); setTimeout(() => inputRef.current?.select(), 0); }}
                    onBlur={() => { setFocused(false); commit(); }}
                    onKeyDown={handleKeyDown}
                    className={`${inputBaseCls} w-9 px-0.5 py-1 text-[11px]`}
                />
                {hint}
            </div>

            <button type="button" tabIndex={-1} disabled={value >= max}
                onClick={() => step(1)} className={`${btnCls} w-4 h-4 text-[12px] leading-none`}>+</button>
        </div>
    );
};



const SiteDailyAttendanceTab = ({
    selectedSite,
    attendanceLoading = false,
    rosterStats = { total: 0, present: 0, halfDay: 0, absent: 0, paidLeave: 0, unmarked: 0 },
    rosterStatusFilter = 'all',
    setRosterStatusFilter = () => {},
    rosterSearch = '',
    setRosterSearch = () => {},
    setSelectedLabourIds = () => {},
    setBulkSourceSiteId = () => {},
    setBulkDestinationSiteId = () => {},
    setBulkRoleFilter = () => {},
    setShowBulkTransferModal = () => {},
    setShowBorrowModal = () => {},
    handleSaveAttendance = () => {},
    attendanceRoster = [],
    savingRoster = false,
    hasUnsavedRosterChanges = false,
    selectedRosterIds = [],
    setSelectedRosterIds = () => {},
    handleMarkAllVisible = () => {},
    handleMarkUnmarkedVisible = () => {},
    handleResetAllVisible = () => {},
    handleBatchSetStatus = () => {},
    handleBatchSetOvertime = () => {},
    attendanceRoleFilter = '',
    attendanceDate = '',
    filteredRoster = [],
    handleSelectAllVisibleToggle = () => {},
    handleToggleSelectRoster = () => {},
    handleStatusChange = () => {},
    handleOvertimeChange = () => {}
}) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-150">
            {selectedSite?.status === 'Completed' && selectedSite.end_date && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3.5 rounded-xl text-amber-700 dark:text-amber-400 font-semibold text-xs flex items-center gap-2 shadow-sm">
                    <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                        This site was marked completed on <strong>{new Date(selectedSite.end_date).toLocaleDateString()}</strong>. Attendance is restricted to dates strictly before completion.
                    </span>
                </div>
            )}

            {attendanceLoading ? (
                <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl shadow-sm overflow-hidden">
                    <LoadingScreen message="Loading daily roll call roster..." fullScreen={false} />
                </div>
            ) : (
                <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl shadow-sm overflow-hidden">
                    {/* Card Header: Title + Live Status Counter Pills + Search + Action Buttons */}
                    <div className="p-4 border-b border-slate-200 dark:border-[#30363d] flex flex-col lg:flex-row justify-between lg:items-center gap-3 bg-slate-50/70 dark:bg-[#161b22]">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-semibold text-xs text-slate-800 dark:text-[#f0f6fc]">Daily Roll Call Checklist</span>
                            <div className="h-4 w-px bg-slate-200 dark:border-[#30363d] hidden sm:block" />
                            {/* Interactive Live Status Filter Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap select-none">
                                <button
                                    type="button"
                                    onClick={() => setRosterStatusFilter('all')}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer border ${
                                        rosterStatusFilter === 'all'
                                            ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200 shadow-2xs'
                                            : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-[#c9d1d9] border-slate-200 dark:border-[#30363d] hover:bg-slate-100 dark:hover:bg-[#21262d]'
                                    }`}
                                    title="Show all workers"
                                >
                                    All: {rosterStats.total}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRosterStatusFilter(rosterStatusFilter === 'Present' ? 'all' : 'Present')}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer border flex items-center gap-1 ${
                                        rosterStatusFilter === 'Present'
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                                    }`}
                                    title="Filter by Present workers"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Present: {rosterStats.present}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRosterStatusFilter(rosterStatusFilter === 'Half Day' ? 'all' : 'Half Day')}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer border flex items-center gap-1 ${
                                        rosterStatusFilter === 'Half Day'
                                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                            : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                                    }`}
                                    title="Filter by Half Day workers"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Half Day: {rosterStats.halfDay}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRosterStatusFilter(rosterStatusFilter === 'Absent' ? 'all' : 'Absent')}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer border flex items-center gap-1 ${
                                        rosterStatusFilter === 'Absent'
                                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                                    }`}
                                    title="Filter by Absent workers"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    Absent: {rosterStats.absent}
                                </button>
                                {rosterStats.paidLeave > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setRosterStatusFilter(rosterStatusFilter === 'Paid Leave' ? 'all' : 'Paid Leave')}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer border flex items-center gap-1 ${
                                            rosterStatusFilter === 'Paid Leave'
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                                        }`}
                                        title="Filter by Paid Leave workers"
                                    >
                                        Paid Leave: {rosterStats.paidLeave}
                                    </button>
                                )}
                                {rosterStats.unmarked > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setRosterStatusFilter(rosterStatusFilter === 'Unmarked' ? 'all' : 'Unmarked')}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer border flex items-center gap-1 ${
                                            rosterStatusFilter === 'Unmarked'
                                                ? 'bg-slate-700 text-white border-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200 shadow-2xs'
                                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/50 hover:bg-amber-500/20'
                                        }`}
                                        title="Filter by workers not yet marked"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        Unmarked: {rosterStats.unmarked}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Right Controls: In-Roster Search, Import, Add Worker, Save */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Worker search filter */}
                            <div className="relative w-36 sm:w-44">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                                <input
                                    type="text"
                                    placeholder="Search worker..."
                                    value={rosterSearch}
                                    onChange={(e) => setRosterSearch(e.target.value)}
                                    className="pl-7 pr-6 py-1 w-full bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-lg text-xs text-slate-700 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-2xs h-[30px]"
                                />
                                {rosterSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setRosterSearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <X size={11} />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    setSelectedLabourIds([]);
                                    setBulkSourceSiteId('All');
                                    setBulkDestinationSiteId(selectedSite ? String(selectedSite.site_id) : '');
                                    setBulkRoleFilter('All');
                                    setShowBulkTransferModal(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#161b22] dark:hover:bg-[#21262d] text-slate-700 dark:text-[#c9d1d9] rounded-lg text-xs font-medium shadow-2xs transition-all cursor-pointer border border-[#d0d7de] dark:border-[#30363d] h-[30px]"
                            >
                                <Building size={13} />
                                <span>Bulk Import</span>
                            </button>

                            <button
                                onClick={() => setShowBorrowModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#161b22] dark:hover:bg-[#21262d] text-slate-700 dark:text-[#c9d1d9] rounded-lg text-xs font-medium shadow-2xs transition-all cursor-pointer border border-[#d0d7de] dark:border-[#30363d] h-[30px]"
                            >
                                <Plus size={13} />
                                <span>Add Worker</span>
                            </button>

                            <button
                                onClick={handleSaveAttendance}
                                disabled={attendanceRoster.length === 0 || savingRoster}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-2xs transition-all cursor-pointer min-w-[115px] justify-center h-[30px] ${
                                    hasUnsavedRosterChanges
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-400/40'
                                        : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white'
                                }`}
                                title="Save attendance roster (Shortcut: Ctrl+S)"
                            >
                                {savingRoster ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={13} />
                                        <span>Save Roster</span>
                                        {hasUnsavedRosterChanges && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-300" title="Unsaved changes pending" />
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Fast Roll Call Bar / Multi-Select Batch Action Bar */}
                    <div className="px-4 py-2 bg-slate-50/80 dark:bg-[#161b22]/70 border-b border-slate-200 dark:border-[#30363d] flex items-center justify-between gap-3 flex-wrap select-none">
                        {selectedRosterIds.length === 0 ? (
                            /* Quick Fill on the RIGHT */
                            <div className="ml-auto flex items-center gap-2 flex-wrap text-xs">
                                <span className="text-[11px] font-medium text-slate-500 dark:text-[#8b949e] uppercase tracking-wider mr-1">
                                    Quick Fill:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleMarkAllVisible('Present')}
                                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 dark:bg-[#161b22] dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium rounded-lg border border-emerald-300 dark:border-emerald-800/60 transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                    title="Mark all currently visible workers as Present (Full Day)"
                                >
                                    <CheckCircle size={12} className="text-emerald-600 dark:text-emerald-400" />
                                    <span>Mark All Present</span>
                                </button>
                                {rosterStats.unmarked > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleMarkUnmarkedVisible('Present')}
                                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 dark:bg-[#161b22] dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg border border-indigo-300 dark:border-indigo-800/60 transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                        title="Mark only unmarked workers as Present"
                                    >
                                        <Check size={12} className="text-indigo-600 dark:text-indigo-400" />
                                        <span>Mark Unmarked as Present ({rosterStats.unmarked})</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleMarkAllVisible('Absent')}
                                    className="px-2.5 py-1 bg-white hover:bg-rose-50 dark:bg-[#161b22] dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-medium rounded-lg border border-rose-300 dark:border-rose-800/60 transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                    title="Mark all currently visible workers as Absent"
                                >
                                    <XCircle size={12} className="text-rose-600 dark:text-rose-400" />
                                    <span>Mark All Absent</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetAllVisible}
                                    className="px-2 py-1 text-slate-500 hover:text-slate-800 dark:text-[#8b949e] dark:hover:text-[#f0f6fc] font-medium rounded-lg hover:bg-slate-200/60 dark:hover:bg-[#21262d] transition-all flex items-center gap-1 cursor-pointer text-[11px]"
                                    title="Clear attendance marks for visible workers"
                                >
                                    <RotateCcw size={11} />
                                    <span>Reset</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 flex-wrap text-xs w-full sm:w-auto ml-auto">
                                <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300 text-xs mr-1">
                                    <CheckSquare size={13} className="text-indigo-600" />
                                    <span>{selectedRosterIds.length} Selected</span>
                                </div>

                                <div className="h-4 w-px bg-slate-300 dark:bg-[#30363d] shrink-0" />

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleBatchSetStatus('Present')}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                    >
                                        <CheckCircle size={12} />
                                        <span>Set Present</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleBatchSetStatus('Half Day')}
                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-all cursor-pointer shadow-2xs text-[11px]"
                                    >
                                        <span>Set Half Day</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleBatchSetStatus('Absent')}
                                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                    >
                                        <XCircle size={12} />
                                        <span>Set Absent</span>
                                    </button>
                                </div>

                                <div className="h-4 w-px bg-slate-300 dark:bg-[#30363d] shrink-0" />

                                <div className="flex items-center gap-1.5 text-[11px]">
                                    <span className="font-medium text-slate-500 dark:text-slate-400">OT:</span>
                                    <OvertimeInput
                                        value={0}
                                        onChange={(hrs) => handleBatchSetOvertime(hrs)}
                                        max={4}
                                        compact
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedRosterIds([])}
                                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer ml-2"
                                >
                                    Deselect
                                </button>
                            </div>
                        )}
                    </div>

                    <motion.div
                        key={`attendance-${attendanceRoleFilter}-${attendanceDate}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="overflow-x-auto"
                    >
                        <table className="w-full text-left border-collapse text-xs table-fixed">
                            <thead>
                                <tr className="bg-slate-50/70 dark:bg-[#161b22] text-slate-500 dark:text-[#8b949e] font-medium border-b border-slate-200 dark:border-[#30363d] select-none">
                                    <th className="p-3 w-10 text-center">
                                        {/* Custom themed checkbox — select all */}
                                        <div
                                            onClick={() => handleSelectAllVisibleToggle(filteredRoster)}
                                            className={`w-4 h-4 mx-auto rounded border-2 flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                                                filteredRoster.length > 0 && filteredRoster.every(r => selectedRosterIds.includes(r.labour_id))
                                                    ? 'bg-indigo-600 border-indigo-600'
                                                    : filteredRoster.some(r => selectedRosterIds.includes(r.labour_id))
                                                        ? 'bg-indigo-600 border-indigo-600'
                                                        : 'bg-white dark:bg-[#0d1117] border-slate-300 dark:border-[#484f58] hover:border-indigo-500'
                                            }`}
                                        >
                                            {filteredRoster.length > 0 && filteredRoster.every(r => selectedRosterIds.includes(r.labour_id)) ? (
                                                <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white fill-none stroke-white stroke-2">
                                                    <polyline points="1,4 4,7 9,1" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            ) : filteredRoster.some(r => selectedRosterIds.includes(r.labour_id)) ? (
                                                <span className="block w-2 h-0.5 bg-white rounded-full" />
                                            ) : null}
                                        </div>
                                    </th>
                                    <th className="p-3 w-[170px]">Worker Name</th>
                                    <th className="p-3 w-[90px]">Role</th>
                                    <th className="p-3 w-[100px]">Wage Model</th>
                                    <th className="p-3 text-center">Status Assignment</th>
                                    <th className="p-3 text-center w-[180px]">OT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRoster.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-10 text-center text-slate-400 italic">
                                            <div>No labours matching the current filter or search.</div>
                                            {(rosterSearch || rosterStatusFilter !== 'all') && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setRosterSearch(''); setRosterStatusFilter('all'); }}
                                                    className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                                >
                                                    Clear Filters
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRoster.map(item => {
                                        const isRowSelected = selectedRosterIds.includes(item.labour_id);
                                        return (
                                            <tr
                                                key={item.labour_id}
                                                className={`border-b border-slate-100 dark:border-[#21262d] transition-colors relative ${
                                                    isRowSelected
                                                        ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                                                        : item.status === 'Present'
                                                            ? 'hover:bg-emerald-50/20 dark:hover:bg-emerald-950/15'
                                                            : item.status === 'Half Day'
                                                                ? 'hover:bg-amber-50/20 dark:hover:bg-amber-950/15'
                                                                : item.status === 'Absent'
                                                                    ? 'hover:bg-rose-50/20 dark:hover:bg-rose-950/15'
                                                                    : 'hover:bg-slate-50/40 dark:hover:bg-[#161b22]/60'
                                                }`}
                                            >
                                                <td className="p-3 w-10 text-center">
                                                    {/* Custom themed checkbox — per row */}
                                                    <div
                                                        onClick={() => handleToggleSelectRoster(item.labour_id)}
                                                        className={`w-4 h-4 mx-auto rounded border-2 flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                                                            isRowSelected
                                                                ? 'bg-indigo-600 border-indigo-600'
                                                                : 'bg-white dark:bg-[#0d1117] border-slate-300 dark:border-[#484f58] hover:border-indigo-500'
                                                        }`}
                                                    >
                                                        {isRowSelected && (
                                                            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none stroke-white stroke-2">
                                                                <polyline points="1,4 4,7 9,1" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 font-semibold text-slate-800 dark:text-[#f0f6fc]">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span>{item.name}</span>
                                                            {item.is_borrowed && (
                                                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium text-[8px] uppercase tracking-wider">Added</span>
                                                            )}
                                                            {!item.status && (
                                                                <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#161b22] text-slate-400 dark:text-[#8b949e] text-[8px] font-medium uppercase border border-slate-200/50 dark:border-[#30363d]">Unmarked</span>
                                                            )}
                                                        </div>
                                                        {item.already_marked_at && (
                                                            <span className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                                                <AlertTriangle size={11} className="shrink-0" />
                                                                <span>Marked {item.already_marked_at.status} at {item.already_marked_at.site_name}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-slate-600 dark:text-[#8b949e] font-normal">{item.role}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.wage_type === 'Fixed Salary'
                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300 dark:border dark:border-blue-800/40'
                                                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border dark:border-emerald-800/40'
                                                        }`}>
                                                        {item.wage_type}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex justify-center items-center gap-2">
                                                        {[
                                                            { id: 'Present', label: 'Present (Full Day)', activeColor: 'bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white', inactiveColor: 'bg-slate-50 dark:bg-[#161b22] text-slate-600 dark:text-[#c9d1d9] border border-slate-200 dark:border-[#30363d] hover:bg-slate-100 dark:hover:bg-[#21262d] dark:hover:text-white' },
                                                            { id: 'Half Day', label: 'Half Day', activeColor: 'bg-amber-500 text-white dark:bg-amber-600 dark:text-white', inactiveColor: 'bg-slate-50 dark:bg-[#161b22] text-slate-600 dark:text-[#c9d1d9] border border-slate-200 dark:border-[#30363d] hover:bg-slate-100 dark:hover:bg-[#21262d] dark:hover:text-white' },
                                                            { id: 'Absent', label: 'Absent', activeColor: 'bg-rose-600 text-white dark:bg-rose-600 dark:text-white', inactiveColor: 'bg-slate-50 dark:bg-[#161b22] text-slate-600 dark:text-[#c9d1d9] border border-slate-200 dark:border-[#30363d] hover:bg-slate-100 dark:hover:bg-[#21262d] dark:hover:text-white' },
                                                            ...(item.wage_type === 'Fixed Salary' ? [{ id: 'Paid Leave', label: 'Paid Leave', activeColor: 'bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white', inactiveColor: 'bg-slate-50 dark:bg-[#161b22] text-slate-600 dark:text-[#c9d1d9] border border-slate-200 dark:border-[#30363d] hover:bg-slate-100 dark:hover:bg-[#21262d] dark:hover:text-white' }] : [])
                                                        ].map(statusOpt => {
                                                            const isSelected = item.status === statusOpt.id;
                                                            const isButtonDisabled = (statusOpt.id === 'Present' || statusOpt.id === 'Half Day' || statusOpt.id === 'Paid Leave') &&
                                                                item.already_marked_at && !item.is_scheduled_multi_site;
                                                            return (
                                                                <button
                                                                    key={statusOpt.id}
                                                                    onClick={() => handleStatusChange(item.labour_id, statusOpt.id)}
                                                                    disabled={isButtonDisabled}
                                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-150 ${
                                                                        isButtonDisabled
                                                                            ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-[#161b22]/40 dark:text-slate-600 border border-slate-200/50 dark:border-[#30363d]/50'
                                                                            : isSelected
                                                                                ? statusOpt.activeColor + ' shadow-sm cursor-pointer ring-2 ring-offset-1 ring-offset-white dark:ring-offset-[#0d1117] ring-indigo-500/30'
                                                                                : statusOpt.inactiveColor + ' cursor-pointer'
                                                                    }`}
                                                                    title={`Mark as ${statusOpt.label}`}
                                                                >
                                                                    {statusOpt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    {item.status === 'Present' ? (
                                                        <OvertimeInput
                                                            value={item.overtime_hours || 0}
                                                            onChange={(hrs) => handleOvertimeChange(item.labour_id, hrs)}
                                                            max={12}
                                                        />
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-[#30363d] font-normal font-mono">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default SiteDailyAttendanceTab;
