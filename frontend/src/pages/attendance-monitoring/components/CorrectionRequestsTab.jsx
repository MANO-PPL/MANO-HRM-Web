import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileClock,
    Search,
    CheckCircle,
    XCircle,
    Calendar,
    Paperclip,
    Eye,
    ArrowRight,
    Clock,
    Activity,
    RefreshCw,
    X,
    RotateCcw,
    ImageIcon,
    Maximize2,
    Download,
    FileText,
    Camera
} from 'lucide-react';
import VisualCorrectionTimeline from '../../../components/attendance/VisualCorrectionTimeline';
import CorrectionDocumentCard from '../../../components/attendance/CorrectionDocumentCard';
import { attendanceService } from '../../../services/attendanceService';
import { toast } from 'react-toastify';

const CorrectionRequestsTab = ({
    correctionRequests = [],
    setCorrectionRequests,
    selectedRequestId,
    setSelectedRequestId,
    selectedRequestData,
    setSelectedRequestData,
    requestsLoading,
    detailLoading,
    fetchCorrectionRequests,
    fetchRequestDetail,
    formatCorrectionDate,
    setPreviewImage,
    avatarTimestamp = ''
}) => {
    // Local Search State
    const [searchTerm, setSearchTerm] = useState('');

    // Admin Override & Action States
    const [overrideMode, setOverrideMode] = useState(false);
    const [overrideSessions, setOverrideSessions] = useState([]);
    const [overrideReason, setOverrideReason] = useState('');
    const [reviewComment, setReviewComment] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Reject Modal State
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // Helper: Normalize sessions from JSON/array/legacy formats
    const normalizeSessions = useCallback((data, req) => {
        let parsed = data;
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { parsed = []; }
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed
                .map((s, idx) => ({
                    id: s.id || `sess-${idx}-${Date.now()}`,
                    time_in: s.time_in ? String(s.time_in).slice(0, 5) : (s.requested_time_in ? String(s.requested_time_in).slice(0, 5) : ''),
                    time_out: s.time_out ? String(s.time_out).slice(0, 5) : (s.requested_time_out ? String(s.requested_time_out).slice(0, 5) : ''),
                    punch_type: s.punch_type || 'regular',
                    attachment: s.attachment || null,
                    inImage: s.inImage || null,
                    outImage: s.outImage || null
                }))
                .filter(s => s.time_in || s.time_out);
            if (cleaned.length > 0) return cleaned;
        }
        if (req?.requested_time_in || req?.requested_time_out) {
            const getTime = (val) => {
                if (!val) return '';
                const t = val.includes(' ') ? val.split(' ')[1] : (val.includes('T') ? val.split('T')[1] : val);
                return t.substring(0, 5);
            };
            const inT = getTime(req.requested_time_in);
            const outT = getTime(req.requested_time_out);
            if (inT || outT) {
                return [{
                    id: 'sess-0',
                    time_in: inT,
                    time_out: outT,
                    punch_type: 'regular'
                }];
            }
        }
        return [];
    }, []);

    // Helper: Extract attachment metadata & URL from any field/structure
    const getAttachmentInfo = useCallback((req) => {
        if (!req) return null;

        let url = null;
        let fileName = 'Proof Attachment';
        let fileSize = null;
        let fileType = null;

        if (req.attachment_url) {
            url = req.attachment_url;
            if (req.attachment) {
                fileName = req.attachment.file_name || fileName;
                fileSize = req.attachment.file_size || null;
                fileType = req.attachment.file_type || null;
            }
        } else if (req.attachment && (req.attachment.url || req.attachment.file_url)) {
            url = req.attachment.url || req.attachment.file_url;
            fileName = req.attachment.file_name || fileName;
            fileSize = req.attachment.file_size || null;
            fileType = req.attachment.file_type || null;
        } else {
            // Check inside proposed_data
            const proposed = Array.isArray(req.proposed_data) ? req.proposed_data : [req.proposed_data];
            for (const s of proposed) {
                if (s && s.attachment) {
                    url = s.attachment.url || s.attachment.file_url || (s.attachment.file_key ? s.attachment_url : null);
                    fileName = s.attachment.file_name || fileName;
                    fileSize = s.attachment.file_size || null;
                    fileType = s.attachment.file_type || null;
                    if (url) break;
                }
            }
        }

        // Direct proof fields
        if (!url && (req.proof_url || req.proof_image)) {
            url = req.proof_url || req.proof_image;
        }

        if (!url) return null;

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
    }, []);

    // Helper: Calculate duration in hours
    const calculateSessionDurationHours = useCallback((timeIn, timeOut) => {
        if (!timeIn || !timeOut) return 0;
        const [h1, m1] = String(timeIn).slice(0, 5).split(':').map(Number);
        const [h2, m2] = String(timeOut).slice(0, 5).split(':').map(Number);
        if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
        let startMins = h1 * 60 + m1;
        let endMins = h2 * 60 + m2;
        if (endMins <= startMins) {
            endMins += 24 * 60; // Overnight
        }
        return (endMins - startMins) / 60;
    }, []);

    // Helper: Format hours into "Xh Ym"
    const formatDurationString = (hoursDec) => {
        if (!hoursDec || isNaN(hoursDec) || hoursDec <= 0) return '0m';
        const totalMinutes = Math.round(hoursDec * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };

    // Filtered Requests List
    const filteredRequests = useMemo(() => {
        return correctionRequests.filter(req => {
            const matchesSearch = (req.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(req.acr_id || '').includes(searchTerm);
            return matchesSearch;
        });
    }, [correctionRequests, searchTerm]);

    // Counts for status tabs
    const counts = useMemo(() => {
        return {
            all: correctionRequests.length,
            pending: correctionRequests.filter(r => (r.status || '').toLowerCase() === 'pending').length,
            approved: correctionRequests.filter(r => (r.status || '').toLowerCase() === 'approved').length,
            rejected: correctionRequests.filter(r => (r.status || '').toLowerCase() === 'rejected').length
        };
    }, [correctionRequests]);

    // When selecting a request, reset override states
    const handleSelectRequest = (req) => {
        setSelectedRequestId(req.acr_id);
        fetchRequestDetail(req.acr_id);
        setOverrideMode(false);
        setReviewComment('');
        setRejectReason('');
    };

    // Keep overrideSessions in sync whenever selectedRequestData updates
    const activeProposedSessions = useMemo(() => {
        if (!selectedRequestData) return [];
        if (overrideMode && overrideSessions.length > 0) {
            return overrideSessions;
        }
        return normalizeSessions(selectedRequestData.proposed_data, selectedRequestData);
    }, [selectedRequestData, overrideMode, overrideSessions, normalizeSessions]);

    // Total duration of current proposed sessions
    const proposedDurationHours = useMemo(() => {
        return activeProposedSessions.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0);
    }, [activeProposedSessions, calculateSessionDurationHours]);

    // Attachment for the currently selected request
    const selectedAttachment = useMemo(() => {
        return getAttachmentInfo(selectedRequestData);
    }, [selectedRequestData, getAttachmentInfo]);

    // Reset override changes to employee's original request
    const handleResetToOriginal = () => {
        if (!selectedRequestData) return;
        const orig = normalizeSessions(selectedRequestData.proposed_data, selectedRequestData);
        setOverrideSessions(orig);
        setOverrideReason(selectedRequestData.reason || '');
        setOverrideMode(false);
        toast.info("Reset to employee's original submitted punches");
    };

    // Handle Admin Approval (with or without manual overrides)
    const handleApprove = async () => {
        if (!selectedRequestData) return;
        const reqId = selectedRequestData.acr_id;
        try {
            setActionLoading(true);
            const originalProposed = normalizeSessions(selectedRequestData.proposed_data, selectedRequestData);
            const currentSessions = overrideSessions.filter(s => s.time_in || s.time_out);

            const isModified = overrideMode && (
                JSON.stringify(originalProposed.map(s => ({ in: s.time_in, out: s.time_out }))) !==
                JSON.stringify(currentSessions.map(s => ({ in: s.time_in, out: s.time_out }))) ||
                (overrideReason && overrideReason.trim() !== (selectedRequestData.reason || '').trim())
            );

            // If override mode edited the punches, update the request data
            if (isModified && currentSessions.length > 0) {
                const formData = new FormData();
                formData.append('correction_type', 'punch');
                formData.append('request_date', selectedRequestData.request_date);
                formData.append('reason', overrideReason.trim() || selectedRequestData.reason || 'Attendance adjustment');
                formData.append('original_data', JSON.stringify(selectedRequestData.original_data || []));
                formData.append('proposed_data', JSON.stringify(currentSessions));
                formData.append('existing_request_id', reqId);
                await attendanceService.submitCorrectionRequest(formData);
            }

            const comment = reviewComment.trim() || (isModified ? 'Approved with manual override' : 'Approved by administrator');
            await attendanceService.updateCorrectionStatus(reqId, 'approved', comment, isModified ? { sessions: currentSessions } : {});

            toast.success(isModified ? "Request updated with manual override and approved!" : "Request approved successfully!");
            setOverrideMode(false);

            // Refresh data
            fetchCorrectionRequests(true);
            fetchRequestDetail(reqId, true);
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to approve request");
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Admin Rejection (with mandatory reason from modal)
    const handleConfirmReject = async () => {
        if (!selectedRequestData) return;
        if (!rejectReason.trim()) {
            toast.error("Please enter an explanation for the employee regarding why this was rejected");
            return;
        }
        const reqId = selectedRequestData.acr_id;
        try {
            setActionLoading(true);
            await attendanceService.updateCorrectionStatus(reqId, 'rejected', rejectReason.trim());
            toast.success("Request rejected");
            setShowRejectModal(false);
            setRejectReason('');

            // Refresh data
            fetchCorrectionRequests(true);
            fetchRequestDetail(reqId, true);
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to reject request");
        } finally {
            setActionLoading(false);
        }
    };

    const isPending = (selectedRequestData?.status || '').toLowerCase() === 'pending';

    return (
        <div data-tour-id="attendance-requests-queue" className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 h-[calc(100vh-160px)] min-h-[680px]">

            {/* LEFT SIDEBAR: REQUESTS LIST */}
            <div className="w-full lg:w-96 xl:w-[420px] bg-white dark:bg-dark-card rounded-xl shadow-xs border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col h-full shrink-0">
                {/* Header and Search */}
                <div className="p-3 border-b border-slate-100 dark:border-github-dark-border space-y-2.5 bg-slate-50/50 dark:bg-github-dark-subtle/30">
                    <div className="flex justify-between items-center px-0.5">
                        <div className="flex items-center gap-1.5">
                            <FileClock size={14} className="text-slate-500 dark:text-slate-400" />
                            <h3 className="text-xs font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider">
                                Correction Requests
                            </h3>
                        </div>
                        <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            {counts.pending} Pending
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                        <input
                            type="text"
                            placeholder="Search by employee name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-github-dark-subtle/70 border border-slate-200 dark:border-github-dark-border rounded-lg focus:ring-1 focus:ring-slate-400 outline-none transition-all shadow-2xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Cards List */}
                <div className="overflow-y-auto no-scrollbar flex-1 p-3 space-y-2.5">
                    {requestsLoading ? (
                        <div className="p-10 text-center text-slate-400 text-xs">Loading requests...</div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                            <CheckCircle className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                            <span className="text-xs font-medium">No correction requests found.</span>
                        </div>
                    ) : (
                        filteredRequests.map((request) => {
                            const isSelected = selectedRequestId === request.acr_id;
                            const proposed = normalizeSessions(request.proposed_data, request);
                            const duration = proposed.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0);
                            const statusLower = (request.status || 'pending').toLowerCase();
                            const attInfo = getAttachmentInfo(request);

                            return (
                                <div
                                    key={request.acr_id}
                                    onClick={() => handleSelectRequest(request)}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer shadow-2xs ${isSelected
                                            ? 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-500/60 dark:border-indigo-500/60 shadow-xs ring-1 ring-indigo-500/20'
                                            : 'bg-white dark:bg-github-dark-subtle/30 border-slate-200 dark:border-github-dark-border hover:bg-slate-50 dark:hover:bg-github-dark-subtle/60 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                                                {request.profile_image_url && request.profile_image_url.startsWith('http') ? (
                                                    <img src={`${request.profile_image_url}?t=${avatarTimestamp}`} alt={request.user_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    (request.user_name || 'U').charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-indigo-900 dark:text-white' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                    {request.user_name}
                                                </p>
                                                <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium inline-block">
                                                    ID: {request.user_id}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${statusLower === 'approved'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                                                : statusLower === 'rejected'
                                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
                                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                                            }`}>
                                            {statusLower}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={11} className="text-slate-400 shrink-0" />
                                            <span>{formatCorrectionDate(request.request_date)}</span>
                                        </div>
                                        {duration > 0 && (
                                            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.2 rounded">
                                                {formatDurationString(duration)}
                                            </span>
                                        )}
                                    </div>

                                    {request.reason && (
                                        <p className="text-[10px] text-slate-500 dark:text-github-dark-muted italic line-clamp-1 pl-1.5 border-l-2 border-slate-300 dark:border-github-dark-border my-1">
                                            "{request.reason}"
                                        </p>
                                    )}

                                    {/* Proof / Image Indicator Badge if sender uploaded one */}
                                    {attInfo && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/40 my-1">
                                            {attInfo.isImage ? <ImageIcon size={11} className="shrink-0" /> : <FileText size={11} className="shrink-0" />}
                                            <span className="truncate">{attInfo.fileName}</span>
                                            {attInfo.fileSize && (
                                                <span className="text-[9px] font-mono text-indigo-400">({(attInfo.fileSize / 1024).toFixed(0)}KB)</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1.5 font-mono border-t border-slate-100 dark:border-github-dark-border/40 pt-1.5">
                                        <span>Sub. {request.submitted_at ? new Date(request.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : 'N/A'}</span>
                                        <span className="font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                            {(request.correction_type || 'punch').replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* RIGHT DETAIL PANEL */}
            <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-xs border border-slate-200 dark:border-github-dark-border flex flex-col h-full overflow-hidden">
                {detailLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-github-dark-muted">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-wider">Loading request details...</p>
                    </div>
                ) : selectedRequestData ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-3.5 border-b border-slate-100 dark:border-github-dark-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50 dark:bg-github-dark-subtle/30 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                                    {selectedRequestData.profile_image_url && selectedRequestData.profile_image_url.startsWith('http') ? (
                                        <img src={`${selectedRequestData.profile_image_url}?t=${avatarTimestamp}`} alt={selectedRequestData.user_name} className="w-full h-full object-cover" />
                                    ) : (
                                        (selectedRequestData.user_name || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-bold text-slate-900 dark:text-github-dark-text tracking-tight">
                                            Request #{selectedRequestData.acr_id}
                                        </h2>
                                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${selectedRequestData.status === 'approved'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                                                : selectedRequestData.status === 'rejected'
                                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
                                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                                            }`}>
                                            {selectedRequestData.status}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-github-dark-muted font-medium mt-0.5">
                                        By <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRequestData.user_name}</span> ({selectedRequestData.designation || 'Employee'}) • <span className="text-slate-700 dark:text-slate-300 font-semibold">{formatCorrectionDate(selectedRequestData.request_date)}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Top Action Buttons when Pending */}
                            {isPending && (
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (overrideMode) {
                                                handleResetToOriginal();
                                            }
                                            setOverrideMode(!overrideMode);
                                        }}
                                        className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${overrideMode
                                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 shadow-xs'
                                                : 'bg-white dark:bg-github-dark-bg text-slate-700 dark:text-slate-300 border-slate-200 dark:border-github-dark-border hover:bg-slate-50'
                                            }`}
                                    >
                                        <span>{overrideMode ? 'Override Active' : 'Manual Override'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowRejectModal(true)}
                                        disabled={actionLoading}
                                        className="px-3.5 py-1.5 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                        <XCircle size={14} /> Reject
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleApprove}
                                        disabled={actionLoading}
                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                        {actionLoading ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={14} />}
                                        <span>{overrideMode ? 'Approve with Overrides' : 'Approve'}</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Scrollable Content Body */}
                        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 bg-slate-50/30 dark:bg-transparent">

                            {/* Manual Override Active Banner */}
                            {isPending && overrideMode && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3.5 rounded-xl border bg-amber-50/80 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300 flex items-center justify-center shrink-0">
                                            <Clock size={15} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                                    Manual Override Active
                                                </span>
                                                <span className="text-[9px] font-semibold px-2 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                                                    Drag handles or edit below
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                                You can drag the punch handles on the timeline or modify sessions directly, then click Approve to apply.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleResetToOriginal}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer self-end sm:self-auto"
                                    >
                                        <RotateCcw size={12} />
                                        <span>Reset to Original</span>
                                    </button>
                                </motion.div>
                            )}

                            {/* Card 1: Timeline Visualizer */}
                            <VisualCorrectionTimeline
                                requestData={{
                                    ...selectedRequestData,
                                    original_data: normalizeSessions(selectedRequestData.original_data, selectedRequestData),
                                    proposed_data: activeProposedSessions,
                                    correction_type: selectedRequestData.correction_type || 'punch',
                                    status: selectedRequestData.status || 'pending'
                                }}
                                editable={isPending && overrideMode}
                                onSessionsChange={(updated) => {
                                    setOverrideSessions(updated.map((s, idx) => ({
                                        id: s.id || `session-${idx}-${s.time_in || s.time_out}`,
                                        time_in: s.time_in ? String(s.time_in).slice(0, 5) : '',
                                        time_out: s.time_out ? String(s.time_out).slice(0, 5) : '',
                                        punch_type: s.punch_type || 'regular'
                                    })));
                                }}
                            />

                            {/* Card 2: Sender Uploaded Proof / Image / Doc / Presentation / Spreadsheet */}
                            <CorrectionDocumentCard
                                attachment={selectedAttachment}
                                onPreviewImage={setPreviewImage}
                                title="Sender Uploaded Proof"
                            />

                            {/* Card 3: Employee Stated Reason */}
                            <div className="bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border p-3.5 shadow-2xs space-y-2.5">
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <FileClock size={13} className="text-indigo-500 dark:text-indigo-400" />
                                    Employee Stated Reason
                                </h3>

                                {isPending && overrideMode ? (
                                    <div className="space-y-2 pt-1">
                                        <div className="flex flex-wrap gap-1">
                                            {[
                                                "Forgot to punch out",
                                                "Forgot to punch in",
                                                "Webcam error",
                                                "Client visit"
                                            ].map((preset, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setOverrideReason(preset)}
                                                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 dark:bg-github-dark-bg text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-github-dark-border transition-colors cursor-pointer"
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            rows={2}
                                            value={overrideReason}
                                            onChange={(e) => setOverrideReason(e.target.value)}
                                            placeholder="Reason for adjustment / override..."
                                            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-github-dark-bg/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500 font-medium resize-none"
                                        />
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-700 dark:text-slate-200 italic leading-relaxed pl-2.5 border-l-2 border-indigo-500/60">
                                        "{selectedRequestData.reason || 'No specific reason provided.'}"
                                    </p>
                                )}
                            </div>

                            {/* Card 4: Original Captured Sessions vs Proposed Sessions */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Original Sessions */}
                                <div className="bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border overflow-hidden shadow-2xs flex flex-col">
                                    <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-slate-50/70 dark:bg-github-dark-subtle/30">
                                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Clock size={12} className="text-slate-500" /> Original Captured Sessions
                                        </h3>
                                        <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md">
                                            {Array.isArray(selectedRequestData.original_data) && selectedRequestData.original_data.length > 0
                                                ? `${selectedRequestData.original_data.length} session${selectedRequestData.original_data.length !== 1 ? 's' : ''}`
                                                : 'Absent'}
                                        </span>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col justify-center">
                                        {Array.isArray(selectedRequestData.original_data) && selectedRequestData.original_data.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {selectedRequestData.original_data.map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 dark:bg-github-dark-bg/40 border border-slate-200/80 dark:border-github-dark-border/60">
                                                        <span className="text-[9px] font-bold text-slate-400 w-5 shrink-0">#{i + 1}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-[#1D9E75] shrink-0"></span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">In</span>
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">{String(s.time_in || '--:--').substring(0, 5)}</span>
                                                            {s.inImage && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewImage(s.inImage)}
                                                                    title="View Punch-In Selfie"
                                                                    className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                                                >
                                                                    <Camera size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <ArrowRight size={12} className="text-slate-400 dark:text-slate-600 shrink-0" />
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Out</span>
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">{String(s.time_out || '--:--').substring(0, 5)}</span>
                                                            {s.outImage && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewImage(s.outImage)}
                                                                    title="View Punch-Out Selfie"
                                                                    className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                                                >
                                                                    <Camera size={11} />
                                                                </button>
                                                            )}
                                                            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-slate-400 dark:text-github-dark-muted italic text-center py-4">
                                                No original clock-in/out records existed for this date.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Proposed Sessions */}
                                <div className="bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border overflow-hidden shadow-2xs flex flex-col">
                                    <div className="px-3.5 py-2.5 border-b border-indigo-100/60 dark:border-indigo-900/30 flex items-center justify-between bg-indigo-50/30 dark:bg-indigo-950/20">
                                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                            <Clock size={12} className="text-indigo-500" /> Proposed Sessions
                                        </h3>
                                        <div className="flex items-center gap-1.5">
                                            {proposedDurationHours > 0 && (
                                                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/50">
                                                    {formatDurationString(proposedDurationHours)}
                                                </span>
                                            )}
                                            <span className="text-[10px] font-semibold bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/40">
                                                {activeProposedSessions.length} session(s)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col justify-center">
                                        {activeProposedSessions.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {activeProposedSessions.map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/20 dark:bg-indigo-950/15 border border-indigo-100/70 dark:border-indigo-900/40">
                                                        <span className="text-[9px] font-bold text-indigo-500 w-5 shrink-0">#{i + 1}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-[#1D9E75] shrink-0"></span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">In</span>
                                                            <span className="text-xs font-semibold text-slate-800 dark:text-github-dark-text font-mono">{String(s.time_in || '--:--').substring(0, 5)}</span>
                                                        </div>
                                                        <ArrowRight size={12} className="text-indigo-400 dark:text-indigo-500 shrink-0" />
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Out</span>
                                                            <span className="text-xs font-semibold text-slate-800 dark:text-github-dark-text font-mono">{String(s.time_out || '--:--').substring(0, 5)}</span>
                                                            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-slate-400 dark:text-github-dark-muted italic text-center py-4">
                                                No proposed sessions submitted.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card 5: Auditor Decision & Remarks */}
                            {!isPending ? (
                                <div className={`rounded-xl border p-3.5 shadow-2xs ${selectedRequestData.status === 'approved'
                                        ? 'bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-500/20'
                                        : 'bg-rose-50/30 dark:bg-rose-950/15 border-rose-500/20'
                                    }`}>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <CheckCircle size={13} className={selectedRequestData.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} />
                                        <h3 className={`text-[10px] font-bold uppercase tracking-wider ${selectedRequestData.status === 'approved' ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
                                            }`}>
                                            Auditor Decision & Remarks
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed pl-1">
                                        {selectedRequestData.review_comments || 'No specific reviewer comments noted.'}
                                    </p>
                                    <p className="mt-2 text-[10px] text-slate-400 font-medium pl-1">
                                        Reviewed on {selectedRequestData.reviewed_at ? formatCorrectionDate(selectedRequestData.reviewed_at) : 'N/A'}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border p-3.5 shadow-2xs space-y-1.5">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <FileClock size={12} className="text-indigo-500" /> Auditor Review Comments (Optional)
                                    </h3>
                                    <textarea
                                        value={reviewComment}
                                        onChange={(e) => setReviewComment(e.target.value)}
                                        placeholder="Add auditor review comments, remarks, or justification before approving..."
                                        className="w-full p-2.5 text-xs bg-slate-50 dark:bg-github-dark-bg/40 border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/30 text-slate-800 dark:text-github-dark-text resize-none h-16 font-medium"
                                    />
                                </div>
                            )}

                            {/* Card 6: Audit Trail & History */}
                            {(() => {
                                const trail = typeof selectedRequestData.audit_trail === 'string'
                                    ? (() => { try { return JSON.parse(selectedRequestData.audit_trail); } catch { return []; } })()
                                    : (Array.isArray(selectedRequestData.audit_trail) ? selectedRequestData.audit_trail : []);
                                if (trail && trail.length > 0) {
                                    return (
                                        <div className="bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border p-3.5 shadow-2xs">
                                            <h4 className="text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold mb-3 flex items-center gap-1.5">
                                                <Activity size={12} className="text-indigo-500" /> Audit Trail & History
                                            </h4>
                                            <div className="relative pl-3.5 border-l-2 border-slate-200 dark:border-github-dark-border space-y-3">
                                                {trail.map((event, idx) => (
                                                    <div key={idx} className="relative">
                                                        <div className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white dark:border-dark-card ring-1 ring-indigo-200 dark:ring-indigo-800"></div>
                                                        <p className="text-xs font-bold text-slate-800 dark:text-github-dark-text capitalize">
                                                            {String(event.action).toLowerCase()}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium">
                                                            {event.at ? new Date(event.at).toLocaleString() : 'N/A'} • by {event.by === selectedRequestData.user_id ? selectedRequestData.user_name : (event.by_name || 'Admin')}
                                                        </p>
                                                        {event.comments && (
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 italic pl-2 border-l border-slate-200 dark:border-github-dark-border">
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

                        </div>


                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-github-dark-muted">
                        <FileClock className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-wider">No Request Selected</p>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">Select a request from the left list to review</p>
                    </div>
                )}
            </div>

            {/* Admin Reject Reason Modal Dialog */}
            <AnimatePresence>
                {showRejectModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="w-full max-w-md bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <XCircle size={16} className="text-rose-500" />
                                    <span>Reject Request #{selectedRequestData?.acr_id}</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowRejectModal(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                Please provide an explanation for the employee regarding why this correction request is being rejected:
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {[
                                    "Mismatch with biometric gate logs",
                                    "Incomplete punch proof",
                                    "Overlapping shift schedule",
                                    "Unapproved absence"
                                ].map((preset, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setRejectReason(preset)}
                                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 hover:bg-rose-50 dark:bg-github-dark-bg text-slate-600 hover:text-rose-600 dark:text-slate-300 border border-slate-200 dark:border-github-dark-border transition-colors cursor-pointer"
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                rows={3}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g. Discrepancy with biometric logs, shift was already logged..."
                                className="w-full p-3 text-xs bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500 font-normal resize-none"
                            />
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRejectModal(false)}
                                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmReject}
                                    disabled={actionLoading || !rejectReason.trim()}
                                    className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                >
                                    {actionLoading ? <RefreshCw size={13} className="animate-spin" /> : <XCircle size={13} />}
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

export default CorrectionRequestsTab;
