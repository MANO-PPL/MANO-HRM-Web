import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileClock,
    RefreshCw,
    Sparkles,
    X,
    CheckCircle,
    Save,
    Eye,
    FileText,
    XCircle
} from 'lucide-react';
import VisualCorrectionTimeline from '../../../components/attendance/VisualCorrectionTimeline';

const AttendanceCorrectionTab = ({
    filteredCorrectionHistory,
    correctionHistory,
    correctionFilter,
    setCorrectionFilter,
    loading,
    selectedRequest,
    handleRequestClick,
    calculateSessionDurationHours,
    formatCorrectionDate,
    formatDateDisplay,
    isFetchingDetails,
    isAdminUser,
    isOverrideMode,
    setIsOverrideMode,
    setShowAdminRejectModal,
    showAdminRejectModal,
    adminRejectReason,
    setAdminRejectReason,
    handleAdminReject,
    isAdminActionLoading,
    handleAdminApprove,
    handleEmployeeUpdateRequest,
    isSavingCorrection,
    handleResetToEmployeeRequest,
    editCorrectionSessions,
    setEditCorrectionSessions,
    normalizeCorrectionSessions,
    setPreviewImage,
    editCorrectionReason,
    setEditCorrectionReason
}) => {
    return (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Split Panel */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* LEFT - Request List */}
                <div
                    data-tour-id="att-correction-list"
                    className="w-full lg:w-1/3 bg-white dark:bg-dark-card rounded-2xl shadow-xs border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col lg:sticky lg:top-6"
                    style={{ height: 'calc(100vh - 140px)', minHeight: '640px' }}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center bg-slate-50/50 dark:bg-github-dark-bg/30">
                        <div className="flex items-center gap-2">
                            <FileClock size={16} className="text-indigo-600 dark:text-indigo-400" />
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">Correction Requests</h3>
                        </div>
                        <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                            {filteredCorrectionHistory.length} Total
                        </span>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-github-dark-border/60 bg-slate-50/30 dark:bg-github-dark-bg/20 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'all', label: 'All', count: correctionHistory.length },
                            { id: 'pending', label: 'Pending', count: correctionHistory.filter(r => (r.status || '').toLowerCase() === 'pending').length },
                            { id: 'approved', label: 'Approved', count: correctionHistory.filter(r => (r.status || '').toLowerCase() === 'approved').length },
                            { id: 'rejected', label: 'Rejected', count: correctionHistory.filter(r => (r.status || '').toLowerCase() === 'rejected').length }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setCorrectionFilter(tab.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-normal transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${correctionFilter === tab.id
                                    ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 font-medium shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${correctionFilter === tab.id
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300'
                                    : 'bg-slate-100 dark:bg-github-dark-bg text-slate-500'
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Request Cards List */}
                    <div className="overflow-y-auto flex-1 p-3 space-y-2.5 no-scrollbar">
                        {loading ? (
                            <div className="p-10 text-center text-slate-400 text-xs font-normal">Loading requests...</div>
                        ) : filteredCorrectionHistory.length === 0 ? (
                            <div className="p-10 text-center">
                                <FileClock size={30} className="mx-auto mb-2.5 text-slate-300 dark:text-slate-600" />
                                <p className="text-xs text-slate-400 dark:text-github-dark-muted font-normal">
                                    {correctionFilter === 'all' ? 'No correction requests yet.' : `No ${correctionFilter} requests found.`}
                                </p>
                            </div>
                        ) : (
                            filteredCorrectionHistory.map((req) => {
                                const isSelected = selectedRequest?.acr_id === req.acr_id;
                                const proposedList = Array.isArray(req.proposed_data) ? req.proposed_data : [];
                                const totalHours = proposedList.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0);
                                const statusLower = (req.status || 'pending').toLowerCase();
                                return (
                                    <div
                                        key={req.acr_id}
                                        onClick={() => handleRequestClick(req)}
                                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${isSelected
                                            ? 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-400/60 dark:border-indigo-500/60 shadow-xs ring-1 ring-indigo-500/20'
                                            : 'bg-white dark:bg-dark-card border-slate-200/80 dark:border-github-dark-border/70 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-github-dark-subtle/30'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-medium text-xs shrink-0 overflow-hidden">
                                                    {req.profile_image_url && req.profile_image_url.startsWith('http') ? (
                                                        <img src={req.profile_image_url} alt={req.user_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        (req.user_name || 'U').charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{req.user_name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">#{req.acr_id || req.id}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-medium capitalize px-2 py-0.5 rounded-full border ${statusLower === 'approved'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                                                : statusLower === 'rejected'
                                                    ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
                                                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                                                }`}>
                                                {statusLower}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <span className="font-normal text-slate-700 dark:text-slate-200">{formatCorrectionDate(req.request_date)}</span>
                                            {totalHours > 0 && (
                                                <span className="font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                                    {totalHours.toFixed(1)} hrs
                                                </span>
                                            )}
                                        </div>

                                        {req.reason && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal italic line-clamp-1 mb-2">
                                                "{req.reason}"
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-github-dark-border/40">
                                            <span>Sub: {req.submitted_at ? formatDateDisplay(req.submitted_at) : 'N/A'}</span>
                                            <span className="font-normal text-indigo-600 dark:text-indigo-400">
                                                {req.correction_type === 'summary' ? 'Summary' : 'Punch Sync'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT - Request Detail / In-Place Editor */}
                <div
                    className="w-full lg:w-2/3 bg-white dark:bg-dark-card rounded-2xl shadow-xs border border-slate-200 dark:border-github-dark-border flex flex-col lg:sticky lg:top-6 overflow-hidden"
                    style={{ height: 'calc(100vh - 140px)', minHeight: '640px' }}
                >
                    {isFetchingDetails ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                            <p className="text-xs font-normal">Loading request details...</p>
                        </div>
                    ) : selectedRequest ? (
                        <>
                            {/* Detail Header Bar */}
                            <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/40 dark:bg-github-dark-bg/20">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-medium text-sm shrink-0 overflow-hidden shadow-2xs">
                                        {selectedRequest.profile_image_url && selectedRequest.profile_image_url.startsWith('http') ? (
                                            <img src={selectedRequest.profile_image_url} alt={selectedRequest.user_name} className="w-full h-full object-cover" />
                                        ) : (
                                            (selectedRequest.user_name || 'U').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-base font-semibold text-slate-900 dark:text-github-dark-text truncate">
                                                Request #{selectedRequest.acr_id || selectedRequest.id}
                                            </h2>
                                            <span className={`text-[10px] font-medium capitalize px-2 py-0.5 rounded-full border ${(selectedRequest.status || '').toLowerCase() === 'approved'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30'
                                                : (selectedRequest.status || '').toLowerCase() === 'rejected'
                                                    ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/30'
                                                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/30'
                                                }`}>
                                                {selectedRequest.status || 'pending'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5">
                                            By <span className="font-medium text-slate-700 dark:text-slate-300">{selectedRequest.user_name}</span> • {formatCorrectionDate(selectedRequest.request_date)}
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons in Header */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {(selectedRequest.status || '').toLowerCase() === 'pending' && (
                                        isAdminUser ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsOverrideMode(!isOverrideMode)}
                                                    className={`h-9 px-3 rounded-xl border text-xs font-normal transition-colors cursor-pointer flex items-center gap-1.5 ${isOverrideMode
                                                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-github-dark-bg text-slate-700 dark:text-slate-300 border-slate-200 dark:border-github-dark-border'
                                                        }`}
                                                    title={isOverrideMode ? "Disable manual override" : "Enable manual override to modify requested times"}
                                                >
                                                    <Sparkles size={13} className={isOverrideMode ? "text-amber-500" : "text-slate-400"} />
                                                    <span>{isOverrideMode ? 'Override Active' : 'Manual Override'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAdminRejectModal(true)}
                                                    disabled={isAdminActionLoading}
                                                    className="h-9 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 text-xs font-normal transition-colors cursor-pointer flex items-center gap-1.5"
                                                >
                                                    <X size={14} />
                                                    <span>Reject</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleAdminApprove}
                                                    disabled={isAdminActionLoading}
                                                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-normal transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                                >
                                                    {isAdminActionLoading ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={14} />}
                                                    <span>{isOverrideMode ? 'Approve with Overrides' : 'Approve'}</span>
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleEmployeeUpdateRequest}
                                                disabled={isSavingCorrection}
                                                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-normal transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                            >
                                                {isSavingCorrection ? <RefreshCw size={13} className="animate-spin" /> : <Save size={14} />}
                                                <span>Update Request</span>
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Scrollable Body Content */}
                            <div className="flex-1 overflow-y-auto no-scrollbar p-5 sm:p-6 space-y-5">

                                {/* Manual Override Control Bar */}
                                {(selectedRequest.status || '').toLowerCase() === 'pending' && isAdminUser && (
                                    <div className={`p-4 rounded-2xl border transition-all ${isOverrideMode
                                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-800/60 shadow-xs ring-1 ring-amber-400/20'
                                        : 'bg-slate-50/60 dark:bg-github-dark-bg/40 border-slate-200 dark:border-github-dark-border'
                                        }`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOverrideMode
                                                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300'
                                                    : 'bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                    }`}>
                                                    <Sparkles size={16} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                            Manual Override
                                                        </span>
                                                        {isOverrideMode ? (
                                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                                                                Override Enabled
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                                Employee Request
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                                                        {isOverrideMode
                                                            ? "Manual override active: drag punch handles, click rail to add points, or edit times below, then click Approve to apply."
                                                            : "Enable manual override to adjust the employee's submitted punch times before approving."}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                {isOverrideMode && (
                                                    <button
                                                        type="button"
                                                        onClick={handleResetToEmployeeRequest}
                                                        className="text-xs font-normal text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 px-2.5 py-1.5 rounded-xl hover:bg-white/80 dark:hover:bg-github-dark-subtle transition-colors cursor-pointer"
                                                    >
                                                        Reset to Original
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setIsOverrideMode(!isOverrideMode)}
                                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isOverrideMode ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                                                        }`}
                                                >
                                                    <span
                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${isOverrideMode ? 'translate-x-5' : 'translate-x-0'
                                                            }`}
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Interactive Visual Timeline */}
                                {(() => {
                                    const isPending = (selectedRequest.status || '').toLowerCase() === 'pending';
                                    const canEdit = isPending && (isAdminUser ? isOverrideMode : true);
                                    const validSessions = editCorrectionSessions.filter(s => s.time_in || s.time_out);
                                    const fallbackSessions = normalizeCorrectionSessions(selectedRequest.proposed_data, selectedRequest);
                                    const activeProposed = validSessions.length > 0 ? validSessions : fallbackSessions;

                                    return (
                                        <div className="space-y-3">
                                            <VisualCorrectionTimeline
                                                requestData={{
                                                    ...selectedRequest,
                                                    original_data: normalizeCorrectionSessions(selectedRequest.original_data, selectedRequest),
                                                    proposed_data: activeProposed,
                                                    correction_type: selectedRequest.correction_type || 'punch',
                                                    status: selectedRequest.status || 'pending'
                                                }}
                                                editable={canEdit}
                                                onSessionsChange={(updated) => {
                                                    setEditCorrectionSessions(updated.map((s, idx) => ({
                                                        id: s.id || `session-${idx}-${s.time_in || s.time_out}`,
                                                        time_in: s.time_in ? String(s.time_in).slice(0, 5) : '',
                                                        time_out: s.time_out ? String(s.time_out).slice(0, 5) : '',
                                                        punch_type: s.punch_type || 'regular'
                                                    })));
                                                }}
                                            />

                                            {!canEdit && activeProposed.length > 0 && (
                                                <div className="bg-slate-50/70 dark:bg-github-dark-bg/30 border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                            Requested Work Sessions ({activeProposed.length})
                                                        </span>
                                                        <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                                            Total: {activeProposed.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0).toFixed(2)} hrs
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                                        {activeProposed.map((session, idx) => {
                                                            const duration = calculateSessionDurationHours(session.time_in, session.time_out);
                                                            return (
                                                                <div
                                                                    key={session.id || idx}
                                                                    className="flex items-center justify-between p-2.5 bg-white dark:bg-dark-card border border-slate-200/80 dark:border-github-dark-border rounded-xl text-xs"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-slate-500 font-medium">Session #{idx + 1}:</span>
                                                                        <span className="font-mono text-slate-800 dark:text-slate-200">
                                                                            {session.time_in || '--:--'} to {session.time_out || '--:--'}
                                                                        </span>
                                                                    </div>
                                                                    {duration > 0 && (
                                                                        <span className="font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full text-[11px]">
                                                                            {duration.toFixed(2)} hrs
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Details & Reason Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-slate-50/70 dark:bg-github-dark-bg/40 border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 space-y-2">
                                        <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider block">
                                            Request Information
                                        </span>
                                        <div className="space-y-1.5 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Category:</span>
                                                <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                                                    {selectedRequest.correction_type === 'summary' ? 'Summary Adjustment' : 'Punch Attendance'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Submitted:</span>
                                                <span className="font-normal text-slate-700 dark:text-slate-300">
                                                    {selectedRequest.submitted_at ? formatDateDisplay(selectedRequest.submitted_at) : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Attendance Date:</span>
                                                <span className="font-normal text-slate-700 dark:text-slate-300">
                                                    {formatCorrectionDate(selectedRequest.request_date)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/70 dark:bg-github-dark-bg/40 border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider block">
                                                Reason & Proof
                                            </span>
                                            {selectedRequest.attachment_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewImage(selectedRequest.attachment_url)}
                                                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                                >
                                                    <Eye size={12} />
                                                    <span>View Proof</span>
                                                </button>
                                            )}
                                        </div>

                                        {(selectedRequest.status || '').toLowerCase() === 'pending' && (isAdminUser ? isOverrideMode : true) ? (
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {[
                                                        "Forgot to punch out",
                                                        "Forgot to punch in",
                                                        "Webcam error",
                                                        "Client visit"
                                                    ].map((r, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => setEditCorrectionReason(r)}
                                                            className="text-[11px] font-normal px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-github-dark-bg dark:hover:bg-indigo-950/40 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-github-dark-border transition-colors cursor-pointer"
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    value={editCorrectionReason}
                                                    onChange={(e) => setEditCorrectionReason(e.target.value)}
                                                    placeholder="Reason for adjustment..."
                                                    className="w-full p-2.5 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-normal"
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-normal italic leading-relaxed">
                                                "{selectedRequest.reason || 'No reason provided.'}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Reviewer Decision Card */}
                                {(selectedRequest.status || '').toLowerCase() !== 'pending' && (
                                    <div className={`rounded-2xl border p-4 ${(selectedRequest.status || '').toLowerCase() === 'approved'
                                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30'
                                        : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/30'
                                        }`}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <CheckCircle size={15} className={(selectedRequest.status || '').toLowerCase() === 'approved' ? 'text-emerald-600' : 'text-rose-600'} />
                                            <span className={`text-xs font-medium ${(selectedRequest.status || '').toLowerCase() === 'approved' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                                Reviewer Decision: {(selectedRequest.status || '').toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-normal leading-relaxed">
                                            {selectedRequest.review_comments || 'No comments provided.'}
                                        </p>
                                        {selectedRequest.reviewed_at && (
                                            <p className="text-[10px] text-slate-400 font-normal mt-2">
                                                Reviewed on {formatDateDisplay(selectedRequest.reviewed_at)}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Bottom Action Bar */}
                                {(selectedRequest.status || '').toLowerCase() === 'pending' && (
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-github-dark-border/60">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                            {isAdminUser
                                                ? (isOverrideMode
                                                    ? "Manual override active. Click Approve with Overrides to save adjusted times and approve."
                                                    : "Review the employee's request above, or toggle Manual Override to adjust times.")
                                                : "You can adjust punch times above and click Update Request."}
                                        </p>
                                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                            {isAdminUser ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAdminRejectModal(true)}
                                                        disabled={isAdminActionLoading}
                                                        className="h-9 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 text-xs font-normal transition-colors cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <X size={14} />
                                                        <span>Reject</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleAdminApprove}
                                                        disabled={isAdminActionLoading}
                                                        className="h-9 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-normal transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                                    >
                                                        {isAdminActionLoading ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={14} />}
                                                        <span>{isOverrideMode ? 'Approve with Overrides' : 'Approve'}</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleEmployeeUpdateRequest}
                                                    disabled={isSavingCorrection}
                                                    className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-normal transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                                >
                                                    {isSavingCorrection ? <RefreshCw size={13} className="animate-spin" /> : <Save size={14} />}
                                                    <span>Update Request</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 p-12">
                            <FileText size={40} className="mb-3 opacity-40" />
                            <p className="text-xs font-normal">Select a request from the list to view or edit details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Admin Reject Reason Modal */}
            <AnimatePresence>
                {showAdminRejectModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="w-full max-w-md bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <XCircle size={16} className="text-rose-500" />
                                    <span>Reject Request #{selectedRequest?.acr_id || selectedRequest?.id}</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowAdminRejectModal(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                Please provide an explanation for the employee regarding why this correction request is being rejected:
                            </p>
                            <textarea
                                rows={3}
                                value={adminRejectReason}
                                onChange={(e) => setAdminRejectReason(e.target.value)}
                                placeholder="e.g. Discrepancy with biometric gate logs, shift was already approved as absent..."
                                className="w-full p-3 text-xs bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500 font-normal"
                            />
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAdminRejectModal(false)}
                                    className="px-3.5 py-2 text-xs font-normal text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAdminReject}
                                    disabled={isAdminActionLoading || !adminRejectReason.trim()}
                                    className="px-4 py-2 text-xs font-normal bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                >
                                    {isAdminActionLoading ? <RefreshCw size={13} className="animate-spin" /> : <X size={13} />}
                                    <span>Confirm Rejection</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AttendanceCorrectionTab;
