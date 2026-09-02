import React, { useMemo } from 'react';
import {
    FileClock,
    RefreshCw,
    Eye,
    FileText,
    ExternalLink,
    Info,
    CheckCircle,
    ImageIcon,
    Maximize2,
    Download,
    Paperclip
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VisualCorrectionTimeline from '../../../components/attendance/VisualCorrectionTimeline';
import CorrectionDocumentCard from '../../../components/attendance/CorrectionDocumentCard';

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
    isAdminOrHr = false,
    normalizeCorrectionSessions,
    setPreviewImage
}) => {
    const navigate = useNavigate();
    const canManageLive = Boolean(isAdminOrHr || isAdminUser);

    // Extract attachment metadata & URL from request
    const selectedAttachment = useMemo(() => {
        if (!selectedRequest) return null;

        let url = null;
        let fileName = 'Proof Attachment';
        let fileSize = null;
        let fileType = null;

        if (selectedRequest.attachment_url) {
            url = selectedRequest.attachment_url;
            if (selectedRequest.attachment) {
                fileName = selectedRequest.attachment.file_name || selectedRequest.attachment.fileName || fileName;
                fileSize = selectedRequest.attachment.file_size || selectedRequest.attachment.fileSize || null;
                fileType = selectedRequest.attachment.file_type || selectedRequest.attachment.fileType || null;
            }
        } else if (selectedRequest.attachment && (selectedRequest.attachment.url || selectedRequest.attachment.file_url)) {
            url = selectedRequest.attachment.url || selectedRequest.attachment.file_url;
            fileName = selectedRequest.attachment.file_name || selectedRequest.attachment.fileName || fileName;
            fileSize = selectedRequest.attachment.file_size || selectedRequest.attachment.fileSize || null;
            fileType = selectedRequest.attachment.file_type || selectedRequest.attachment.fileType || null;
        } else {
            const proposed = Array.isArray(selectedRequest.proposed_data) ? selectedRequest.proposed_data : [selectedRequest.proposed_data];
            for (const s of proposed) {
                if (s && s.attachment) {
                    url = s.attachment.url || s.attachment.file_url || (s.attachment.file_key ? selectedRequest.attachment_url : null);
                    fileName = s.attachment.file_name || s.attachment.fileName || fileName;
                    fileSize = s.attachment.file_size || s.attachment.fileSize || null;
                    fileType = s.attachment.file_type || s.attachment.fileType || null;
                    if (url) break;
                }
            }
        }

        if (!url && selectedRequest.correction_data?.attachment) {
            const cAtt = selectedRequest.correction_data.attachment;
            url = cAtt.url || cAtt.file_url;
            fileName = cAtt.file_name || fileName;
            fileSize = cAtt.file_size || null;
            fileType = cAtt.file_type || null;
        }

        if (!url && (selectedRequest.proof_url || selectedRequest.proof_image)) {
            url = selectedRequest.proof_url || selectedRequest.proof_image;
        }

        if (!url) {
            if (selectedRequest.attachment?.file_name) {
                return {
                    url: null,
                    fileName: selectedRequest.attachment.file_name,
                    fileSize: selectedRequest.attachment.file_size || null,
                    fileType: selectedRequest.attachment.file_type || null,
                    isDocument: true,
                    isImage: false
                };
            }
            return null;
        }

        const isDoc = !!String(url).match(/\.(pdf|doc|docx|csv|xlsx|xls)/i) || (fileType && fileType.includes('pdf'));
        const isImg = !isDoc;

        return {
            url,
            fileName,
            fileSize,
            fileType,
            isDocument: isDoc,
            isImage: isImg
        };
    }, [selectedRequest]);

    return (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Split Panel */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* LEFT - Request List Sidebar */}
                <div
                    data-tour-id="att-correction-list"
                    className="w-full lg:w-96 xl:w-[420px] bg-white dark:bg-dark-card rounded-2xl shadow-xs border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col lg:sticky lg:top-6 shrink-0"
                    style={{ height: 'calc(100vh - 115px)', minHeight: '740px' }}
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
                                                {req.correction_type === 'summary' ? 'Summary Adjustment' : 'Punch Sync'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT - Request Detail View */}
                <div
                    className="w-full lg:flex-1 min-w-0 bg-white dark:bg-dark-card rounded-2xl shadow-xs border border-slate-200 dark:border-github-dark-border flex flex-col lg:sticky lg:top-6 overflow-hidden"
                    style={{ height: 'calc(100vh - 115px)', minHeight: '740px' }}
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

                                {/* Action Header (Links for Admin/HR) */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {canManageLive && (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/attendance-monitoring?tab=requests')}
                                            className="h-9 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                            title="Open Live Attendance to review, approve, or reject employee requests"
                                        >
                                            <ExternalLink size={13} />
                                            <span className="hidden sm:inline">Live Attendance Portal</span>
                                            <span className="sm:hidden">Live Attendance</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Scrollable Body Content */}
                            <div className="flex-1 overflow-y-auto no-scrollbar p-5 sm:p-6 space-y-5">

                                {/* Admin / HR Informational Notice */}
                                {canManageLive && (
                                    <div className="p-3.5 px-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                        <div className="flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
                                            <Info size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                                            <span>
                                                Correction request approvals and rejections are handled exclusively in <strong className="font-semibold">Live Attendance</strong>.
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/attendance-monitoring?tab=requests')}
                                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer self-end sm:self-center"
                                        >
                                            <span>Manage in Live Attendance</span>
                                            <ExternalLink size={12} />
                                        </button>
                                    </div>
                                )}

                                {/* Visual Timeline (Read-Only) */}
                                {(() => {
                                    const proposedList = normalizeCorrectionSessions(selectedRequest.proposed_data, selectedRequest);
                                    const originalList = normalizeCorrectionSessions(selectedRequest.original_data, selectedRequest);

                                    return (
                                        <div className="space-y-3">
                                            <VisualCorrectionTimeline
                                                requestData={{
                                                    ...selectedRequest,
                                                    original_data: originalList,
                                                    proposed_data: proposedList,
                                                    correction_type: selectedRequest.correction_type || 'punch',
                                                    status: selectedRequest.status || 'pending'
                                                }}
                                                editable={false}
                                            />

                                            {proposedList.length > 0 && (
                                                <div className="bg-slate-50/70 dark:bg-github-dark-bg/30 border border-slate-200 dark:border-github-dark-border rounded-xl p-4 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                            Requested Work Sessions ({proposedList.length})
                                                        </span>
                                                        <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                                            Total: {proposedList.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0).toFixed(2)} hrs
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                                        {proposedList.map((session, idx) => {
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

                                {/* Uploaded Document / Supporting Proof Card (Images, Word, PowerPoint, PDF, Excel, etc.) */}
                                <CorrectionDocumentCard
                                    attachment={selectedAttachment}
                                    onPreviewImage={setPreviewImage}
                                    title="Uploaded Document / Proof"
                                />

                                {/* Details & Reason Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border p-4 shadow-2xs space-y-2">
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

                                    <div className="bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border p-4 shadow-2xs space-y-2">
                                        <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider block">
                                            Employee Stated Reason
                                        </span>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-normal italic leading-relaxed pl-2 border-l-2 border-indigo-500/60">
                                            "{selectedRequest.reason || 'No reason provided.'}"
                                        </p>
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
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 p-12">
                            <FileText size={40} className="mb-3 opacity-40" />
                            <p className="text-xs font-normal">Select a request from the list to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceCorrectionTab;
