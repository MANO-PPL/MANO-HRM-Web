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
    Camera,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import VisualCorrectionTimeline from '../../../components/attendance/VisualCorrectionTimeline';
import { attendanceService } from '../../../services/attendanceService';
import { toast } from 'react-toastify';
import { parseCorrectionDetails, isCheckpointRecord } from '../../../utils/attendanceStatus';

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
    // Local Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Admin Override & Action States
    const [overrideMode, setOverrideMode] = useState(false);
    const [overrideSessions, setOverrideSessions] = useState([]);
    const [reviewComment, setReviewComment] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [timelineScale, setTimelineScale] = useState(1);

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
                .map((s, idx) => {
                    const isChk = isCheckpointRecord(s) || s.punch_type === 'normal';
                    return {
                        id: s.id || `sess-${idx}-${Date.now()}`,
                        time_in: s.time_in ? String(s.time_in).slice(0, 5) : (s.requested_time_in ? String(s.requested_time_in).slice(0, 5) : ''),
                        time_out: isChk ? '' : (s.time_out ? String(s.time_out).slice(0, 5) : (s.requested_time_out ? String(s.requested_time_out).slice(0, 5) : '')),
                        punch_type: isChk ? 'normal' : (s.punch_type || 'regular'),
                        is_checkpoint: isChk,
                        checkpoints: Array.isArray(s.checkpoints) ? s.checkpoints : [],
                        attachment: s.attachment || null,
                        inImage: s.inImage || null,
                        outImage: s.outImage || null
                    };
                })
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

    // Filtered Requests List - sorted according to submitted date (most recent on top) for all statuses
    const filteredRequests = useMemo(() => {
        return correctionRequests
            .filter(req => {
                const matchesSearch = (req.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    String(req.acr_id || '').includes(searchTerm);
                const matchesStatus = statusFilter === 'all' || (req.status || '').toLowerCase() === statusFilter.toLowerCase();
                return matchesSearch && matchesStatus;
            })
            .sort((a, b) => {
                const dateA = new Date(a.submitted_at || a.created_at || a.request_date || 0).getTime();
                const dateB = new Date(b.submitted_at || b.created_at || b.request_date || 0).getTime();
                if (dateB !== dateA) return dateB - dateA;
                return (Number(b.acr_id || b.id) || 0) - (Number(a.acr_id || a.id) || 0);
            });
    }, [correctionRequests, searchTerm, statusFilter]);

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
        if (overrideMode) {
            return overrideSessions;
        }
        const proposed = normalizeSessions(selectedRequestData.proposed_data, selectedRequestData);
        if (proposed.length > 0) {
            return proposed;
        }
        // Fallback: If user submitted without checking advanced options (proposed_data is empty),
        // show the starting punch(es) which were originally recorded!
        return normalizeSessions(selectedRequestData.original_data, selectedRequestData);
    }, [selectedRequestData, overrideMode, overrideSessions, normalizeSessions]);

    // Total duration of current proposed sessions
    const proposedDurationHours = useMemo(() => {
        return activeProposedSessions
            .filter(s => !isCheckpointRecord(s) && s.punch_type !== 'normal')
            .reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0);
    }, [activeProposedSessions, calculateSessionDurationHours]);

    // Attachment for the currently selected request
    const selectedAttachment = useMemo(() => {
        return getAttachmentInfo(selectedRequestData);
    }, [selectedRequestData, getAttachmentInfo]);

    // Reset override changes to employee's original request
    const handleResetToOriginal = () => {
        if (!selectedRequestData) return;
        const proposed = normalizeSessions(selectedRequestData.proposed_data, selectedRequestData);
        const baseline = proposed.length > 0
            ? proposed
            : normalizeSessions(selectedRequestData.original_data, selectedRequestData);
        setOverrideSessions(baseline);
        setOverrideMode(false);
        toast.info("Reset to baseline punches");
    };

    // Handle Admin Approval (with or without manual overrides)
    const handleApprove = async () => {
        if (!selectedRequestData) return;
        const reqId = selectedRequestData.acr_id;
        try {
            setActionLoading(true);
            const proposed = normalizeSessions(selectedRequestData.proposed_data, selectedRequestData);
            const originalProposed = proposed.length > 0
                ? proposed
                : normalizeSessions(selectedRequestData.original_data, selectedRequestData);
            const currentSessions = overrideSessions.filter(s => s.time_in || s.time_out);

            const isModified = overrideMode && (
                JSON.stringify(originalProposed.map(s => ({ in: s.time_in, out: s.time_out }))) !==
                JSON.stringify(currentSessions.map(s => ({ in: s.time_in, out: s.time_out })))
            );

            const comment = reviewComment.trim()
                ? reviewComment.trim()
                : (isModified ? 'Approved with manual override' : 'Approved by administrator');

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
        <div data-tour-id="attendance-requests-queue" className="flex flex-row gap-4 h-full min-h-0 flex-1 min-w-0">

            {/* LEFT PANEL: REQUESTS LIST (Matching AdminLeaveRequests Queue Layout) */}
            <div data-tour-id="correction-admin-list" className="w-[320px] shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden h-full min-h-0">
                {/* Header Title & Counter */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-github-dark-subtle/10 shrink-0">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-wide">
                        Requests Queue
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-2xs">
                        {filteredRequests.length} {filteredRequests.length === 1 ? 'request' : 'requests'}
                    </span>
                </div>

                {/* Search & Status Filters */}
                <div className="p-3 border-b border-slate-100 dark:border-github-dark-border/60 space-y-2 bg-slate-50/30 dark:bg-github-dark-subtle/10 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                        <input
                            type="text"
                            placeholder="Search by employee name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs placeholder:text-slate-400 font-normal"
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
                    <div className="flex gap-1">
                        {[
                            { id: 'all', label: 'All', count: counts.all },
                            { id: 'pending', label: 'Pending', count: counts.pending },
                            { id: 'approved', label: 'Approved', count: counts.approved },
                            { id: 'rejected', label: 'Rejected', count: counts.rejected }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setStatusFilter(tab.id)}
                                className={`flex-1 py-1 px-1 text-xs font-medium rounded-md transition-colors text-center cursor-pointer ${statusFilter === tab.id
                                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs border border-indigo-200/50 dark:border-indigo-800/50'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                                    }`}
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className={`ml-0.5 text-xs ${statusFilter === tab.id ? 'opacity-90' : 'opacity-60'}`}>
                                        ({tab.count})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Queue List (divide-y like Leave Requests) */}
                <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700/60 no-scrollbar">
                    {requestsLoading ? (
                        <div className="p-10 text-center text-slate-400 text-xs font-normal">Loading requests...</div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 text-sm">No requests found.</div>
                    ) : (
                        filteredRequests.map((request) => {
                            const isSelected = selectedRequestId === request.acr_id;
                            const statusLower = (request.status || 'pending').toLowerCase();
                            const { category } = parseCorrectionDetails(request);

                            return (
                                <div
                                    key={request.acr_id}
                                    onClick={() => handleSelectRequest(request)}
                                    title={request.submitted_at ? `Submitted: ${new Date(request.submitted_at).toLocaleString()}` : undefined}
                                    className={`p-4 cursor-pointer transition-colors ${isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-900/10 border-l-4 border-indigo-600'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border-l-4 border-transparent'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-medium text-xs text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                {request.profile_image_url && request.profile_image_url.startsWith('http') ? (
                                                    <img src={`${request.profile_image_url}?t=${avatarTimestamp}`} alt={request.user_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    (request.user_name || 'U').charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                    {request.user_name}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-github-dark-muted font-normal truncate">
                                                    {request.designation || `ID: ${request.user_id}`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-github-dark-muted mt-3">
                                        <div className="flex items-center gap-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                                            <Calendar size={12} />
                                            <span>{formatCorrectionDate(request.request_date)}</span>
                                        </div>
                                        <div className={`flex items-center gap-1.5 font-medium capitalize text-xs ${statusLower === 'approved' ? 'text-emerald-600 dark:text-emerald-400' :
                                                statusLower === 'rejected' ? 'text-red-600 dark:text-rose-400' :
                                                    'text-amber-600 dark:text-amber-400'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusLower === 'approved' ? 'bg-emerald-500' :
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

            {/* RIGHT PANEL: DETAILS (Matching AdminLeaveRequests Consolidated Layout) */}
            <div className="flex-1 min-w-0 min-h-0 h-full bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                {detailLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-github-dark-muted">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-wider">Loading request details...</p>
                    </div>
                ) : selectedRequestData ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-5 px-6 border-b border-slate-200 dark:border-github-dark-border flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-dark-card shrink-0">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-medium text-sm text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                    {selectedRequestData.profile_image_url && selectedRequestData.profile_image_url.startsWith('http') ? (
                                        <img src={`${selectedRequestData.profile_image_url}?t=${avatarTimestamp}`} alt={selectedRequestData.user_name} className="w-full h-full object-cover" />
                                    ) : (
                                        (selectedRequestData.user_name || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2.5">
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-github-dark-text mb-0.5 truncate">
                                            Correction Request #{selectedRequestData.acr_id}
                                        </h2>
                                        <span className="font-medium text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 shrink-0">
                                            {parseCorrectionDetails(selectedRequestData).category}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted font-normal truncate">
                                        By <span className="font-medium text-slate-700 dark:text-slate-300">{selectedRequestData.user_name}</span> ({selectedRequestData.designation || 'Employee'})
                                    </p>
                                </div>
                            </div>

                            {/* Top Right Corner: Approve & Reject (or Status) */}
                            <div className="flex items-center gap-2 shrink-0">
                                {isPending ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowRejectModal(true)}
                                            disabled={actionLoading}
                                            className="py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            <XCircle size={14} />
                                            <span>Reject</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleApprove}
                                            disabled={actionLoading}
                                            className="py-1.5 px-3.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                            <span>{overrideMode ? 'Approve Override' : 'Approve'}</span>
                                        </button>
                                    </div>
                                ) : (
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${selectedRequestData.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                                            'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                        }`}>
                                        {selectedRequestData.status}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Clean Details View - Single container without overlapping nested card boxes */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {/* Metadata Row: Target Date, Submitted On, Proposed Total, Document Upload */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                <div>
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Target Date</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                        {formatCorrectionDate(selectedRequestData.request_date)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Submitted On</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                        {selectedRequestData.submitted_at ? formatCorrectionDate(selectedRequestData.submitted_at) : (selectedRequestData.created_at ? formatCorrectionDate(selectedRequestData.created_at) : 'N/A')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Proposed Total</span>
                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm">
                                        {formatDurationString(proposedDurationHours)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Document</span>
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
                                                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                                            >
                                                <Eye size={14} />
                                                <span>View {selectedAttachment.isImage ? "Proof" : (selectedAttachment.fileName || 'Document')}</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                                            No document attached
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Reason for Request (clean and frameless without nested card styling) */}
                            <div>
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Reason
                                </span>
                                <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed break-words">
                                    "{parseCorrectionDetails(selectedRequestData).cleanReason || 'No specific reason provided.'}"
                                </p>
                            </div>

                            {/* Punches & Timeline Section */}
                            <div className="border-t border-slate-200/60 dark:border-github-dark-border/60 pt-5">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                                        Punches & Timeline Visualizer
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {/* Timeline Scale Zoom Controls */}
                                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs">
                                            {timelineScale !== 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setTimelineScale(1)}
                                                    className="text-xs px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                                >
                                                    Reset
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setTimelineScale(prev => Math.max(1, Math.round((prev - 0.25) * 100) / 100))}
                                                disabled={timelineScale <= 1}
                                                className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                                                title="Zoom out timeline"
                                            >
                                                <ZoomOut size={13} />
                                            </button>
                                            <span className="px-1.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 min-w-[36px] text-center">
                                                {Math.round(timelineScale * 100)}%
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setTimelineScale(prev => Math.min(2.5, Math.round((prev + 0.25) * 100) / 100))}
                                                disabled={timelineScale >= 2.5}
                                                className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                                                title="Zoom in timeline (adds scroll bar)"
                                            >
                                                <ZoomIn size={13} />
                                            </button>
                                        </div>

                                        {/* Manual Override Controls */}
                                        {isPending && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (overrideMode) {
                                                            handleResetToOriginal();
                                                        } else {
                                                            setOverrideSessions(activeProposedSessions);
                                                            setOverrideMode(true);
                                                        }
                                                    }}
                                                    className={`px-3 py-1 rounded-md border text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${overrideMode
                                                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 shadow-xs'
                                                            : 'bg-white dark:bg-[#161b22] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-github-dark-border hover:bg-slate-50 dark:hover:bg-slate-800'
                                                        }`}
                                                    title={overrideMode ? "Exit override and reset punches to baseline" : "Unlock proposed punches for manual editing"}
                                                >
                                                    {overrideMode ? <X size={12} /> : <Clock size={12} />}
                                                    <span>{overrideMode ? 'Exit Override' : 'Manual Override'}</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <VisualCorrectionTimeline
                                    requestData={{
                                        ...selectedRequestData,
                                        original_data: normalizeSessions(selectedRequestData.original_data, selectedRequestData),
                                        proposed_data: activeProposedSessions,
                                        correction_type: selectedRequestData.correction_type || 'punch',
                                        status: selectedRequestData.status || 'pending'
                                    }}
                                    editable={isPending && overrideMode}
                                    frameless={true}
                                    hideHeader={true}
                                    scale={timelineScale}
                                    onSessionsChange={(updated) => {
                                        setOverrideSessions(updated.map((s, idx) => {
                                            const isChk = isCheckpointRecord(s) || s.punch_type === 'normal';
                                            return {
                                                id: s.id || `session-${idx}`,
                                                time_in: s.time_in ? String(s.time_in).slice(0, 5) : '',
                                                time_out: isChk ? '' : (s.time_out ? String(s.time_out).slice(0, 5) : ''),
                                                punch_type: isChk ? 'normal' : (s.punch_type || 'regular'),
                                                is_checkpoint: isChk,
                                                checkpoints: Array.isArray(s.checkpoints) ? s.checkpoints : [],
                                                inPunchId: s.inPunchId,
                                                outPunchId: s.outPunchId
                                            };
                                        }));
                                    }}
                                />
                            </div>

                            {/* Admin Review Remarks Input (when reviewing pending request) */}
                            {isPending && (
                                <div className="border-t border-slate-200/60 dark:border-github-dark-border/60 pt-5">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                                        Admin Review Remarks (Optional before approving)
                                    </span>
                                    <input
                                        type="text"
                                        value={reviewComment}
                                        onChange={(e) => setReviewComment(e.target.value)}
                                        placeholder="Add justification or remarks for approval..."
                                        className="w-full px-3 py-2 text-sm bg-slate-50/70 dark:bg-github-dark-bg/30 border border-slate-200/80 dark:border-github-dark-border/60 rounded-lg text-slate-800 dark:text-github-dark-text focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Reviewed Remarks Section (if already reviewed) */}
                            {!isPending && (
                                <div className="border-t border-slate-200/60 dark:border-github-dark-border/60 pt-5">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                        Admin Remarks
                                    </span>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-normal mt-0.5">
                                        "{selectedRequestData.review_comments || "No remarks provided."}"
                                    </p>
                                </div>
                            )}

                            {/* Section: Audit Trail & History */}
                            {(() => {
                                const trail = typeof selectedRequestData.audit_trail === 'string'
                                    ? (() => { try { return JSON.parse(selectedRequestData.audit_trail); } catch { return []; } })()
                                    : (Array.isArray(selectedRequestData.audit_trail) ? selectedRequestData.audit_trail : []);
                                if (trail && trail.length > 0) {
                                    return (
                                        <div className="border-t border-slate-200/60 dark:border-[#30363d] pt-4">
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block mb-3 flex items-center gap-1.5">
                                                <Activity size={14} className="text-indigo-500" /> Audit Trail & History
                                            </span>
                                            <div className="relative pl-3.5 border-l-2 border-slate-200 dark:border-github-dark-border space-y-3">
                                                {trail.map((event, idx) => (
                                                    <div key={idx} className="relative">
                                                        <div className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white dark:border-dark-card ring-1 ring-indigo-200 dark:ring-indigo-800"></div>
                                                        <p className="text-xs font-semibold text-slate-800 dark:text-github-dark-text capitalize">
                                                            {String(event.action).toLowerCase()}
                                                        </p>
                                                        <p className="text-xs text-slate-400 dark:text-github-dark-muted font-normal mt-0.5">
                                                            {event.at ? new Date(event.at).toLocaleString() : 'N/A'} • by {event.by === selectedRequestData.user_id ? selectedRequestData.user_name : (event.by_name || 'Admin')}
                                                        </p>
                                                        {event.comments && (
                                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic pl-2 border-l border-slate-200 dark:border-github-dark-border font-normal">
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
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <FileClock size={48} className="mb-4 opacity-50" />
                        <p className="text-sm font-medium">Select a request to view details</p>
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
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
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
                            <div className="flex flex-wrap gap-1.5">
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
                                        className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 hover:bg-rose-50 dark:bg-github-dark-bg text-slate-600 hover:text-rose-600 dark:text-slate-300 border border-slate-200 dark:border-github-dark-border transition-colors cursor-pointer"
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
                                className="w-full p-3 text-sm bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500 font-normal resize-none"
                            />
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRejectModal(false)}
                                    className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmReject}
                                    disabled={actionLoading || !rejectReason.trim()}
                                    className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
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
