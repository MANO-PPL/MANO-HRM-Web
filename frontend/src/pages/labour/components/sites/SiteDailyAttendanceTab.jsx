import React from 'react';
import { motion } from 'framer-motion';
import {
    Clock, AlertTriangle, Search, X, Building, Plus,
    Save, Loader2, CheckCircle, Check, XCircle, RotateCcw, CheckSquare
} from 'lucide-react';

const SiteDailyAttendanceTab = ({
    selectedSite,
    attendanceLoading,
    rosterStats,
    rosterStatusFilter,
    setRosterStatusFilter,
    rosterSearch,
    setRosterSearch,
    setSelectedLabourIds,
    setBulkSourceSiteId,
    setBulkDestinationSiteId,
    setBulkRoleFilter,
    setShowBulkTransferModal,
    setShowBorrowModal,
    handleSaveAttendance,
    attendanceRoster,
    savingRoster,
    hasUnsavedRosterChanges,
    selectedRosterIds,
    setSelectedRosterIds,
    handleMarkAllVisible,
    handleMarkUnmarkedVisible,
    handleResetAllVisible,
    handleBatchSetStatus,
    handleBatchSetOvertime,
    attendanceRoleFilter,
    attendanceDate,
    filteredRoster,
    handleSelectAllVisibleToggle,
    handleToggleSelectRoster,
    handleStatusChange,
    handleOvertimeChange
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
                <div className="flex justify-center py-20">
                    <Clock className="animate-spin text-indigo-500" size={28} />
                </div>
            ) : (
                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                    {/* Card Header: Title + Live Status Counter Pills + Search + Action Buttons */}
                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex flex-col lg:flex-row justify-between lg:items-center gap-3 bg-slate-50/50 dark:bg-github-dark-border/10">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-800 dark:text-github-dark-text">Daily Roll Call Checklist</span>
                            <div className="h-4 w-px bg-slate-200 dark:bg-github-dark-border hidden sm:block" />
                            {/* Interactive Live Status Filter Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap select-none">
                                <button
                                    type="button"
                                    onClick={() => setRosterStatusFilter('all')}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                                        rosterStatusFilter === 'all'
                                            ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200 shadow-2xs'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                    }`}
                                    title="Show all workers"
                                >
                                    All: {rosterStats.total}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRosterStatusFilter(rosterStatusFilter === 'Present' ? 'all' : 'Present')}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                                        rosterStatusFilter === 'Present'
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
                                    }`}
                                    title="Filter by Present workers"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Present: {rosterStats.present}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRosterStatusFilter(rosterStatusFilter === 'Half Day' ? 'all' : 'Half Day')}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                                        rosterStatusFilter === 'Half Day'
                                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                            : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100'
                                    }`}
                                    title="Filter by Half Day workers"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Half Day: {rosterStats.halfDay}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRosterStatusFilter(rosterStatusFilter === 'Absent' ? 'all' : 'Absent')}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                                        rosterStatusFilter === 'Absent'
                                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                            : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50 hover:bg-rose-100'
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
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                                            rosterStatusFilter === 'Paid Leave'
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100'
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
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                                            rosterStatusFilter === 'Unmarked'
                                                ? 'bg-slate-700 text-white border-slate-700 shadow-2xs'
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
                                    className="pl-7 pr-6 py-1 w-full bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 shadow-2xs h-[30px]"
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
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer border border-[#d0d7de] dark:border-[#30363d] h-[30px]"
                            >
                                <Building size={13} />
                                <span>Bulk Import</span>
                            </button>

                            <button
                                onClick={() => setShowBorrowModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer border border-[#d0d7de] dark:border-[#30363d] h-[30px]"
                            >
                                <Plus size={13} />
                                <span>Add Worker</span>
                            </button>

                            <button
                                onClick={handleSaveAttendance}
                                disabled={attendanceRoster.length === 0 || savingRoster}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer min-w-[115px] justify-center h-[30px] ${
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
                    <div className="px-4 py-2 bg-slate-50/80 dark:bg-github-dark-border/20 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between gap-3 flex-wrap select-none">
                        {selectedRosterIds.length === 0 ? (
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">
                                    Quick Fill:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleMarkAllVisible('Present')}
                                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 dark:bg-[#161b22] dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg border border-emerald-300 dark:border-emerald-800/60 transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                    title="Mark all currently visible workers as Present (Full Day)"
                                >
                                    <CheckCircle size={12} className="text-emerald-600 dark:text-emerald-400" />
                                    <span>Mark All Present</span>
                                </button>
                                {rosterStats.unmarked > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleMarkUnmarkedVisible('Present')}
                                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 dark:bg-[#161b22] dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg border border-indigo-300 dark:border-indigo-800/60 transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                        title="Mark only unmarked workers as Present"
                                    >
                                        <Check size={12} className="text-indigo-600 dark:text-indigo-400" />
                                        <span>Mark Unmarked as Present ({rosterStats.unmarked})</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleMarkAllVisible('Absent')}
                                    className="px-2.5 py-1 bg-white hover:bg-rose-50 dark:bg-[#161b22] dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold rounded-lg border border-rose-300 dark:border-rose-800/60 transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                    title="Mark all currently visible workers as Absent"
                                >
                                    <XCircle size={12} className="text-rose-600 dark:text-rose-400" />
                                    <span>Mark All Absent</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetAllVisible}
                                    className="px-2 py-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all flex items-center gap-1 cursor-pointer text-[11px]"
                                    title="Clear attendance marks for visible workers"
                                >
                                    <RotateCcw size={11} />
                                    <span>Reset</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 flex-wrap text-xs w-full sm:w-auto">
                                <div className="flex items-center gap-1.5 font-extrabold text-indigo-700 dark:text-indigo-300 text-xs mr-1">
                                    <CheckSquare size={13} className="text-indigo-600" />
                                    <span>{selectedRosterIds.length} Selected</span>
                                </div>

                                <div className="h-4 w-px bg-slate-300 dark:bg-[#30363d] shrink-0" />

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleBatchSetStatus('Present')}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                    >
                                        <CheckCircle size={12} />
                                        <span>Set Present</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleBatchSetStatus('Half Day')}
                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-all cursor-pointer shadow-2xs text-[11px]"
                                    >
                                        <span>Set Half Day</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleBatchSetStatus('Absent')}
                                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                    >
                                        <XCircle size={12} />
                                        <span>Set Absent</span>
                                    </button>
                                </div>

                                <div className="h-4 w-px bg-slate-300 dark:bg-[#30363d] shrink-0" />

                                <div className="flex items-center gap-1 text-[11px]">
                                    <span className="font-semibold text-slate-500 dark:text-slate-400">OT:</span>
                                    {[0, 1, 2, 3, 4].map(hrs => (
                                        <button
                                            key={hrs}
                                            type="button"
                                            onClick={() => handleBatchSetOvertime(hrs)}
                                            className="px-1.5 py-0.5 bg-white dark:bg-[#161b22] hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-slate-200 rounded font-semibold transition-all cursor-pointer shadow-2xs text-[10px]"
                                            title={`Assign ${hrs} hrs overtime to selected workers`}
                                        >
                                            {hrs}h
                                        </button>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedRosterIds([])}
                                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer ml-auto sm:ml-2"
                                >
                                    Deselect
                                </button>
                            </div>
                        )}

                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-auto hidden md:block">
                            Shortcut: <span className="font-mono font-bold bg-slate-200/70 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-300">Ctrl + S</span> to save
                        </div>
                    </div>

                    <motion.div
                        key={`attendance-${attendanceRoleFilter}-${attendanceDate}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="overflow-x-auto"
                    >
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-github-dark-border/20 text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border select-none">
                                    <th className="p-3 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={filteredRoster.length > 0 && filteredRoster.every(r => selectedRosterIds.includes(r.labour_id))}
                                            ref={el => {
                                                if (el) {
                                                    const someSelected = filteredRoster.some(r => selectedRosterIds.includes(r.labour_id));
                                                    const allSelected = filteredRoster.length > 0 && filteredRoster.every(r => selectedRosterIds.includes(r.labour_id));
                                                    el.indeterminate = someSelected && !allSelected;
                                                }
                                            }}
                                            onChange={() => handleSelectAllVisibleToggle(filteredRoster)}
                                            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-[#30363d] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            title="Select / Deselect all visible workers"
                                        />
                                    </th>
                                    <th className="p-3">Worker Name</th>
                                    <th className="p-3">Role</th>
                                    <th className="p-3">Wage Model</th>
                                    <th className="p-3 text-center">Status Assignment</th>
                                    <th className="p-3 text-center w-[120px]">Overtime</th>
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
                                                className={`border-b border-slate-100 dark:border-github-dark-border/50 transition-colors relative ${
                                                    isRowSelected
                                                        ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                                                        : item.status === 'Present'
                                                            ? 'hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10'
                                                            : item.status === 'Half Day'
                                                                ? 'hover:bg-amber-50/20 dark:hover:bg-amber-950/10'
                                                                : item.status === 'Absent'
                                                                    ? 'hover:bg-rose-50/20 dark:hover:bg-rose-950/10'
                                                                    : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/20'
                                                }`}
                                            >
                                                <td className="p-3 w-10 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isRowSelected}
                                                        onChange={() => handleToggleSelectRoster(item.labour_id)}
                                                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-[#30363d] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="p-3 font-semibold text-slate-800 dark:text-github-dark-text">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span>{item.name}</span>
                                                            {item.is_borrowed && (
                                                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-extrabold text-[8px] uppercase tracking-wider">Added</span>
                                                            )}
                                                            {!item.status && (
                                                                <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[8px] font-bold uppercase">Unmarked</span>
                                                            )}
                                                        </div>
                                                        {item.already_marked_at && (
                                                            <span className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                                                                <AlertTriangle size={11} className="shrink-0" />
                                                                <span>Marked {item.already_marked_at.status} at {item.already_marked_at.site_name}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-slate-650 dark:text-slate-400">{item.role}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.wage_type === 'Fixed Salary'
                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                        }`}>
                                                        {item.wage_type}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex justify-center items-center gap-2">
                                                        {[
                                                            { id: 'Present', label: 'Present (Full Day)', activeColor: 'bg-emerald-500 text-white dark:bg-emerald-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' },
                                                            { id: 'Half Day', label: 'Half Day', activeColor: 'bg-amber-500 text-white dark:bg-amber-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' },
                                                            { id: 'Absent', label: 'Absent', activeColor: 'bg-rose-500 text-white dark:bg-rose-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' },
                                                            ...(item.wage_type === 'Fixed Salary' ? [{ id: 'Paid Leave', label: 'Paid Leave', activeColor: 'bg-indigo-500 text-white dark:bg-indigo-600', inactiveColor: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-github-dark-border/60 hover:bg-slate-100' }] : [])
                                                        ].map(statusOpt => {
                                                            const isSelected = item.status === statusOpt.id;
                                                            const isButtonDisabled = (statusOpt.id === 'Present' || statusOpt.id === 'Half Day' || statusOpt.id === 'Paid Leave') &&
                                                                item.already_marked_at && !item.is_scheduled_multi_site;
                                                            return (
                                                                <button
                                                                    key={statusOpt.id}
                                                                    onClick={() => handleStatusChange(item.labour_id, statusOpt.id)}
                                                                    disabled={isButtonDisabled}
                                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-150 ${
                                                                        isButtonDisabled
                                                                            ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-850/40 dark:text-slate-600 border border-slate-200/50 dark:border-[#30363d]/50'
                                                                            : isSelected
                                                                                ? statusOpt.activeColor + ' shadow-sm cursor-pointer ring-2 ring-offset-1 ring-indigo-500/20'
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
                                                <td className="p-3 text-center">
                                                    {item.status === 'Present' ? (
                                                        <select
                                                            value={item.overtime_hours || 0}
                                                            onChange={(e) => handleOvertimeChange(item.labour_id, Number(e.target.value))}
                                                            className="bg-slate-50 hover:bg-slate-100 dark:bg-[#161b22] dark:hover:bg-[#21262d] border border-slate-200 dark:border-[#30363d] text-slate-800 dark:text-[#c9d1d9] rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-sm min-w-[85px] text-center"
                                                        >
                                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(hrs => (
                                                                <option key={hrs} value={hrs}>{hrs} hr{hrs !== 1 ? 's' : ''}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-[#21262d] font-bold font-mono">-</span>
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
