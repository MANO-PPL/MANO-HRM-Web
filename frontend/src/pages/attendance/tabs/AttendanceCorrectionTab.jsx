import React, { useMemo } from 'react';
import {
    FileClock,
    RefreshCw,
    Eye,
    FileText,
    CheckCircle,
    ImageIcon,
    Maximize2,
    Download,
    Paperclip,
    Plus,
    Clock,
    MapPin,
    Calendar,
    Activity
} from 'lucide-react';
import VisualCorrectionTimeline from '../../../components/attendance/VisualCorrectionTimeline';
import CorrectionDocumentCard from '../../../components/attendance/CorrectionDocumentCard';
import { parseCorrectionDetails, isCheckpointRecord } from '../../../utils/attendanceStatus';

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
    setPreviewImage,
    setIsCorrectionDrawerOpen,
    setCorrDate,
    loadCorrectionDataForDate
}) => {

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
            <div className="flex flex-row gap-6 items-start min-w-[1000px]">
                {/* LEFT - Request List Sidebar */}
                <div
                    data-tour-id="att-correction-list"
                    className="w-[380px] bg-white dark:bg-dark-card rounded-2xl shadow-xs border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col shrink-0"
                    style={{ height: 'calc(100vh - 115px)', minHeight: '740px' }}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center bg-slate-50/50 dark:bg-github-dark-bg/30 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <FileClock size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-github-dark-text truncate">Correction Requests</h3>
                        </div>
                        {setIsCorrectionDrawerOpen && (
                            <button
                                type="button"
                                onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    if (setCorrDate) setCorrDate(today);
                                    if (loadCorrectionDataForDate) loadCorrectionDataForDate(today);
                                    setIsCorrectionDrawerOpen(true);
                                }}
                                className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-xs bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/30 px-3.5 py-2 rounded-xl transition-all active:scale-95 border border-indigo-100/80 dark:border-indigo-500/20 cursor-pointer shadow-2xs shrink-0"
                            >
                                <Plus size={14} strokeWidth={2.5} /> Request Correction
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1.5 p-2.5 border-b border-slate-100 dark:border-github-dark-border/60 bg-slate-50/30 dark:bg-github-dark-bg/20">
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
                                className={`flex-1 py-1.5 px-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors text-center cursor-pointer ${correctionFilter === tab.id
                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shadow-2xs border border-indigo-200/50 dark:border-indigo-800/50'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                                    }`}
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className={`ml-1 text-xs sm:text-sm ${correctionFilter === tab.id ? 'opacity-90' : 'opacity-60'}`}>
                                        ({tab.count})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Queue List (divide-y matching admin page) */}
                    <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700/60 no-scrollbar">
                        {loading ? (
                            <div className="p-10 text-center text-slate-400 text-sm font-medium">Loading requests...</div>
                        ) : filteredCorrectionHistory.length === 0 ? (
                            <div className="p-10 text-center space-y-3">
                                <FileClock size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                                <p className="text-sm text-slate-400 dark:text-github-dark-muted font-medium">
                                    {correctionFilter === 'all' ? 'No correction requests yet.' : `No ${correctionFilter} requests found.`}
                                </p>
                                {setIsCorrectionDrawerOpen && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const today = new Date().toISOString().split('T')[0];
                                            if (setCorrDate) setCorrDate(today);
                                            if (loadCorrectionDataForDate) loadCorrectionDataForDate(today);
                                            setIsCorrectionDrawerOpen(true);
                                        }}
                                        className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs sm:text-sm bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/30 px-4 py-2 rounded-xl transition-all active:scale-95 border border-indigo-100/80 dark:border-indigo-500/20 cursor-pointer shadow-2xs"
                                    >
                                        <Plus size={16} strokeWidth={2.5} /> Request Correction
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredCorrectionHistory.map((req) => {
                                const isSelected = selectedRequest?.acr_id === req.acr_id;
                                const statusLower = (req.status || 'pending').toLowerCase();
                                return (
                                    <div
                                        key={req.acr_id}
                                        onClick={() => handleRequestClick(req)}
                                        title={req.submitted_at ? `Submitted: ${new Date(req.submitted_at).toLocaleString()}` : undefined}
                                        className={`p-4 cursor-pointer transition-colors ${isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-900/10 border-l-4 border-indigo-600'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border-l-4 border-transparent'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2.5">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-200 overflow-hidden shrink-0">
                                                    {req.profile_image_url && req.profile_image_url.startsWith('http') ? (
                                                        <img src={req.profile_image_url} alt={req.user_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        (req.user_name || 'U').charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-sm sm:text-base font-bold truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`}>
                                                        {req.user_name}
                                                    </p>
                                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                                                        {req.designation || `ID: ${req.user_id || req.acr_id}`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-3">
                                            <div className="flex items-center gap-1.5 font-medium">
                                                <Calendar size={13} className="text-slate-400" />
                                                <span>{formatCorrectionDate(req.request_date)}</span>
                                            </div>
                                            <div className={`flex items-center gap-1.5 font-bold capitalize text-xs sm:text-sm ${statusLower === 'approved' ? 'text-emerald-600 dark:text-emerald-400' :
                                                statusLower === 'rejected' ? 'text-red-600 dark:text-rose-400' :
                                                    'text-amber-600 dark:text-amber-400'
                                                }`}>
                                                <span className={`w-2 h-2 rounded-full ${statusLower === 'approved' ? 'bg-emerald-500' :
                                                    statusLower === 'rejected' ? 'bg-red-500' :
                                                        'bg-amber-500 animate-pulse'
                                                    }`}></span>
                                                <span>{statusLower}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT - Request Detail View */}
                <div
                    className="flex-1 min-w-0 bg-white dark:bg-dark-card rounded-2xl shadow-xs border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden"
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
                            <div className="p-5 px-6 border-b border-slate-200 dark:border-github-dark-border flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-dark-card shrink-0">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-base text-slate-700 dark:text-slate-200 overflow-hidden shrink-0">
                                        {selectedRequest.profile_image_url && selectedRequest.profile_image_url.startsWith('http') ? (
                                            <img src={selectedRequest.profile_image_url} alt={selectedRequest.user_name} className="w-full h-full object-cover" />
                                        ) : (
                                            (selectedRequest.user_name || 'U').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2.5">
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-github-dark-text truncate">
                                                Correction Request #{selectedRequest.acr_id || selectedRequest.id}
                                            </h2>
                                            <span className="font-bold text-xs px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 shrink-0">
                                                {parseCorrectionDetails(selectedRequest).category}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium truncate mt-1">
                                            By <span className="font-bold text-slate-800 dark:text-white">{selectedRequest.user_name}</span> ({selectedRequest.designation || 'Employee'}) • {formatCorrectionDate(selectedRequest.request_date)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs sm:text-sm font-bold px-3.5 py-1 rounded-full capitalize ${selectedRequest.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                                        selectedRequest.status === 'rejected' ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800' :
                                            'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                        }`}>
                                        {selectedRequest.status || 'pending'}
                                    </span>
                                </div>
                            </div>
                            {/* Clean Details View - Single container without overlapping nested card boxes */}
                            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {(() => {
                                    let proposedList = normalizeCorrectionSessions(selectedRequest.proposed_data, selectedRequest);
                                    const originalList = normalizeCorrectionSessions(selectedRequest.original_data, selectedRequest);
                                    if (proposedList.length === 0 && originalList.length > 0) {
                                        proposedList = originalList;
                                    }

                                    const { category: detailCategory, cleanReason: detailCleanReason } = parseCorrectionDetails(selectedRequest);
                                    const totalProposedHours = proposedList.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0);

                                    const workSessions = proposedList.filter(s => !isCheckpointRecord(s) && s.punch_type !== 'normal');
                                    const standaloneCheckpoints = proposedList.filter(s => isCheckpointRecord(s) || s.punch_type === 'normal');
                                    const nestedCheckpoints = workSessions.flatMap(s => (Array.isArray(s.checkpoints) ? s.checkpoints : []));
                                    const seenCheckpoints = new Set();
                                    const checkpoints = [...standaloneCheckpoints, ...nestedCheckpoints].filter(chk => {
                                        const chkTime = chk.time_in || chk.punch_time || chk.time || '';
                                        const key = `${chk.id || ''}_${chkTime}`;
                                        if (seenCheckpoints.has(key)) return false;
                                        seenCheckpoints.add(key);
                                        return true;
                                    });

                                    const statusLower = (selectedRequest.status || 'pending').toLowerCase();

                                    return (
                                        <>
                                            {/* 1. Metadata Row: Target Date, Submitted On, Proposed Total, Document Upload */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">Target Date</span>
                                                    <span className="font-bold text-slate-900 dark:text-white text-base">
                                                        {formatCorrectionDate(selectedRequest.request_date)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">Submitted On</span>
                                                    <span className="font-bold text-slate-900 dark:text-white text-base">
                                                        {selectedRequest.submitted_at ? formatDateDisplay(selectedRequest.submitted_at) : (selectedRequest.created_at ? formatDateDisplay(selectedRequest.created_at) : 'N/A')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">Proposed Total</span>
                                                    <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400 text-base">
                                                        {totalProposedHours > 0 ? `${totalProposedHours.toFixed(2)} hrs` : 'N/A'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">Document</span>
                                                    {selectedAttachment?.url ? (
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (selectedAttachment.isImage) {
                                                                        setPreviewImage(selectedAttachment.url);
                                                                    } else {
                                                                        window.open(selectedAttachment.url, '_blank');
                                                                    }
                                                                }}
                                                                className="inline-flex items-center gap-1.5 text-base font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                                                            >
                                                                <Eye size={16} />
                                                                <span>View {selectedAttachment.isImage ? "Proof" : (selectedAttachment.fileName || 'Document')}</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm sm:text-base text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                                            No document attached
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Reason for Request (clean and frameless without nested card styling) */}
                                            <div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                                                    Reason
                                                </span>
                                                <p className="text-base text-slate-800 dark:text-slate-200 font-medium leading-relaxed break-words">
                                                    "{detailCleanReason || 'No specific reason provided.'}"
                                                </p>
                                            </div>

                                            {/* 3. Punches & Timeline Section */}
                                            <div className="border-t border-slate-200/60 dark:border-github-dark-border/60 pt-5 space-y-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <span className="text-base font-bold text-slate-900 dark:text-white block">
                                                        Punches & Timeline Visualizer
                                                    </span>
                                                </div>

                                                <VisualCorrectionTimeline
                                                    requestData={{
                                                        ...selectedRequest,
                                                        original_data: originalList,
                                                        proposed_data: proposedList,
                                                        correction_type: selectedRequest.correction_type || 'punch',
                                                        status: selectedRequest.status || 'pending'
                                                    }}
                                                    editable={false}
                                                    frameless={true}
                                                    hideHeader={true}
                                                />



                                                {proposedList.length === 0 && (
                                                    <div className="bg-slate-50/70 dark:bg-github-dark-bg/30 border border-slate-200 dark:border-github-dark-border rounded-xl p-4 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
                                                        <Clock size={16} className="text-slate-400 shrink-0" />
                                                        <span>No custom punch timeline submitted. Request submitted with remarks and supporting documentation for review.</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 4. Uploaded Document / Proof Card */}
                                            {selectedAttachment && (
                                                <CorrectionDocumentCard
                                                    attachment={selectedAttachment}
                                                    onPreviewImage={setPreviewImage}
                                                    title="Uploaded Document / Proof"
                                                />
                                            )}

                                            {/* 5. Reviewed Remarks / Decision Section */}
                                            {statusLower !== 'pending' && (
                                                <div className="border-t border-slate-200/60 dark:border-github-dark-border/60 pt-5">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                            Admin Remarks
                                                        </span>
                                                    </div>
                                                    <p className="text-base text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                                        "{selectedRequest.review_comments || "No remarks provided."}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* 6. Section: Audit Trail & History */}
                                            {(() => {
                                                const trail = typeof selectedRequest.audit_trail === 'string'
                                                    ? (() => { try { return JSON.parse(selectedRequest.audit_trail); } catch { return []; } })()
                                                    : (Array.isArray(selectedRequest.audit_trail) ? selectedRequest.audit_trail : []);
                                                if (trail && trail.length > 0) {
                                                    return (
                                                        <div className="border-t border-slate-200/60 dark:border-[#30363d] pt-5">
                                                            <span className="text-base font-bold text-slate-900 dark:text-white block mb-3.5 flex items-center gap-2">
                                                                <Activity size={16} className="text-indigo-500" /> Audit Trail & History
                                                            </span>
                                                            <div className="relative pl-3.5 border-l-2 border-slate-200 dark:border-github-dark-border space-y-3.5">
                                                                {trail.map((event, idx) => (
                                                                    <div key={idx} className="relative">
                                                                        <div className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white dark:border-dark-card ring-2 ring-indigo-200 dark:ring-indigo-800"></div>
                                                                        <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                                                                            {String(event.action).toLowerCase()}
                                                                        </p>
                                                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-github-dark-muted font-medium mt-0.5">
                                                                            {event.at ? new Date(event.at).toLocaleString() : 'N/A'} • by {event.by === selectedRequest.user_id ? selectedRequest.user_name : (event.by_name || 'Admin')}
                                                                        </p>
                                                                        {event.comments && (
                                                                            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 italic pl-2.5 border-l-2 border-slate-200 dark:border-github-dark-border font-medium">
                                                                                "{event.comments}"
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 p-12 space-y-3">
                            <FileText size={40} className="mb-1 opacity-40" />
                            <p className="text-xs font-normal">Select a request from the list to view details</p>
                            {setIsCorrectionDrawerOpen && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = new Date().toISOString().split('T')[0];
                                        if (setCorrDate) setCorrDate(today);
                                        if (loadCorrectionDataForDate) loadCorrectionDataForDate(today);
                                        setIsCorrectionDrawerOpen(true);
                                    }}
                                    className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-xs bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/30 px-4 py-2 rounded-xl transition-all active:scale-95 border border-indigo-100/80 dark:border-indigo-500/20 cursor-pointer shadow-2xs mt-1"
                                >
                                    <Plus size={15} strokeWidth={2} /> Request Correction
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceCorrectionTab;
