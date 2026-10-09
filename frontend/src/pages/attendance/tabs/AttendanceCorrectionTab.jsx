import React, { useMemo, useState, useEffect, useRef } from 'react';
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
    Activity,
    Edit3,
    Check,
    X,
    RotateCcw,
    Trash2,
    Loader2,
    AlertCircle,
    ChevronDown
} from 'lucide-react';
import VisualCorrectionTimeline from '../../../components/attendance/VisualCorrectionTimeline';
import CorrectionDocumentCard from '../../../components/attendance/CorrectionDocumentCard';
import AuditTrailTimeline from '../../../components/AuditTrailTimeline';
import { parseCorrectionDetails, isCheckpointRecord } from '../../../utils/attendanceStatus';
import { attendanceService } from '../../../services/attendanceService';
import { toast } from 'react-toastify';

const AttendanceCorrectionTab = ({
    filteredCorrectionHistory,
    correctionHistory,
    correctionFilter,
    setCorrectionFilter,
    loading,
    selectedRequest,
    setSelectedRequest,
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
    loadCorrectionDataForDate,
    fetchCorrectionHistory,
    fetchDailyRecords,
    fetchMonthlyRecords,
    myShift
}) => {

    // Inline Editing States
    const [isEditing, setIsEditing] = useState(false);
    const [editCategory, setEditCategory] = useState('Missed Punch');
    const [editOtherCategory, setEditOtherCategory] = useState('');
    const [editReason, setEditReason] = useState('');
    const [editSessions, setEditSessions] = useState([]);
    const [editAttachment, setEditAttachment] = useState(null);
    const [editAttachmentPreview, setEditAttachmentPreview] = useState(null);
    const [existingAttachmentUrl, setExistingAttachmentUrl] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [timelineHasIncomplete, setTimelineHasIncomplete] = useState(false);
    const fileInputRef = useRef(null);

    // Reset editing state whenever user switches requests
    useEffect(() => {
        setIsEditing(false);
        setEditAttachment(null);
        setEditAttachmentPreview(null);
        setExistingAttachmentUrl(null);
        setTimelineHasIncomplete(false);
    }, [selectedRequest?.acr_id, selectedRequest?.id]);

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

    const handleStartEdit = () => {
        if (!selectedRequest) return;
        const { category, cleanReason } = parseCorrectionDetails(selectedRequest);
        if (category === 'Missed Punch' || category === 'Missed Day') {
            setEditCategory(category);
            setEditOtherCategory('');
        } else {
            setEditCategory('Other');
            setEditOtherCategory(category || '');
        }

        setEditReason(cleanReason || selectedRequest.reason || '');

        const currentUrl = selectedAttachment?.url || selectedRequest.attachment_url || null;
        setExistingAttachmentUrl(currentUrl);
        setEditAttachment(null);
        setEditAttachmentPreview(null);

        let proposedList = normalizeCorrectionSessions ? normalizeCorrectionSessions(selectedRequest.proposed_data, selectedRequest) : (selectedRequest.proposed_data || []);
        const originalList = normalizeCorrectionSessions ? normalizeCorrectionSessions(selectedRequest.original_data, selectedRequest) : (selectedRequest.original_data || []);
        if (proposedList.length === 0 && originalList.length > 0) {
            proposedList = originalList;
        }
        setEditSessions(proposedList);
        setTimelineHasIncomplete(false);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditAttachment(null);
        setEditAttachmentPreview(null);
        setExistingAttachmentUrl(null);
        setTimelineHasIncomplete(false);
    };

    const handleResetToOriginal = () => {
        if (!selectedRequest) return;
        const originalList = normalizeCorrectionSessions ? normalizeCorrectionSessions(selectedRequest.original_data, selectedRequest) : (selectedRequest.original_data || []);
        setEditSessions(originalList);
        toast.info("Reset proposed punches to originally recorded logs");
    };

    const handleSaveEdit = async () => {
        if (!selectedRequest) return;
        if (!editReason.trim()) {
            toast.error("Please provide a reason for the correction request.");
            return;
        }
        if (timelineHasIncomplete) {
            toast.error("Cannot submit request with incomplete sessions. Please complete or remove unmatched punch times.");
            return;
        }

        const validSessions = editSessions.filter(s => s.time_in || s.time_out);
        if (validSessions.length === 0) {
            toast.error("Please specify at least one punch session.");
            return;
        }

        try {
            setIsSaving(true);
            const reqId = selectedRequest.acr_id || selectedRequest.id;

            const proposed_data = validSessions.map(s => {
                const isChk = isCheckpointRecord(s) || s.punch_type === 'normal';
                const isOvernight = Boolean(!isChk && s.time_in && s.time_out && s.time_in >= s.time_out);
                return {
                    ...(s.time_in ? { time_in: s.time_in } : {}),
                    ...(s.time_out && !isChk ? { time_out: s.time_out } : {}),
                    punch_type: isChk ? 'normal' : (s.punch_type || 'regular'),
                    is_overnight: isOvernight,
                    ...(s.address ? { address: s.address } : {})
                };
            });

            const originalList = normalizeCorrectionSessions ? normalizeCorrectionSessions(selectedRequest.original_data, selectedRequest) : (selectedRequest.original_data || []);

            const formData = new FormData();
            formData.append('correction_type', 'punch');
            const reqDate = selectedRequest.request_date ? String(selectedRequest.request_date).split('T')[0] : '';
            formData.append('request_date', reqDate);

            const categoryTag = editCategory === 'Other' && editOtherCategory ? editOtherCategory.trim() : editCategory;
            const formattedReason = categoryTag ? `[${categoryTag}] ${editReason.trim()}` : editReason.trim();
            formData.append('reason', formattedReason);
            formData.append('original_data', JSON.stringify(originalList));
            formData.append('proposed_data', JSON.stringify(proposed_data));
            formData.append('existing_request_id', reqId);

            if (editAttachment) {
                formData.append('attachment', editAttachment);
            } else if (existingAttachmentUrl) {
                formData.append('attachment_url', existingAttachmentUrl);
            }

            await attendanceService.submitCorrectionRequest(formData);
            toast.success("Correction request updated successfully!");

            setIsEditing(false);

            if (fetchCorrectionHistory) {
                await fetchCorrectionHistory();
            }
            if (fetchDailyRecords) {
                fetchDailyRecords(true);
            }
            if (fetchMonthlyRecords) {
                fetchMonthlyRecords(true);
            }

            try {
                const updatedRes = await attendanceService.getCorrectionDetails(reqId);
                const freshData = { ...selectedRequest, ...(updatedRes.data || updatedRes) };
                const normProposed = normalizeCorrectionSessions ? normalizeCorrectionSessions(freshData.proposed_data, freshData) : (freshData.proposed_data || []);
                const normOriginal = normalizeCorrectionSessions ? normalizeCorrectionSessions(freshData.original_data, freshData) : (freshData.original_data || []);
                if (setSelectedRequest) {
                    setSelectedRequest({
                        ...freshData,
                        proposed_data: normProposed,
                        original_data: normOriginal
                    });
                }
            } catch (detailErr) {
                console.error("Error refreshing request details:", detailErr);
                if (setSelectedRequest) {
                    setSelectedRequest(prev => ({
                        ...prev,
                        reason: formattedReason,
                        proposed_data: proposed_data,
                        attachment_url: editAttachmentPreview || existingAttachmentUrl || prev?.attachment_url
                    }));
                }
            }
        } catch (error) {
            console.error(error);
            if (error.status === 409 || error.code === 'CORRECTION_ALREADY_CONFIRMED' || (error.message && error.message.includes('reviewed/confirmed'))) {
                toast.warning("This request has already been reviewed/confirmed by an administrator.");
                setIsEditing(false);
                if (fetchCorrectionHistory) fetchCorrectionHistory();
            } else {
                toast.error(error.message || "Failed to update correction request");
            }
        } finally {
            setIsSaving(false);
        }
    };

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
                                        onClick={() => {
                                            if (isEditing) handleCancelEdit();
                                            handleRequestClick(req);
                                        }}
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
                                                        {req.designation || 'Employee'}
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
                                                {isEditing ? `Edit Correction Request #${selectedRequest.acr_id || selectedRequest.id}` : `Correction Request #${selectedRequest.acr_id || selectedRequest.id}`}
                                            </h2>
                                            {isEditing ? (
                                                <span className="font-bold text-xs px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 flex items-center gap-1.5 shrink-0">
                                                    <Edit3 size={11} strokeWidth={2.5} /> Editing Mode
                                                </span>
                                            ) : (
                                                <span className="font-bold text-xs px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 shrink-0">
                                                    {parseCorrectionDetails(selectedRequest).category}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium truncate mt-1">
                                            By <span className="font-bold text-slate-800 dark:text-white">{selectedRequest.user_name}</span> ({selectedRequest.designation || 'Employee'}) • {formatCorrectionDate(selectedRequest.request_date)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                    {isEditing ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                disabled={isSaving}
                                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-github-dark-border rounded-full border border-slate-200 dark:border-github-dark-border transition-all cursor-pointer shadow-2xs active:scale-95"
                                            >
                                                <X size={13} />
                                                <span>Cancel</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveEdit}
                                                disabled={isSaving || timelineHasIncomplete}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full shadow-2xs transition-all cursor-pointer active:scale-95"
                                            >
                                                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
                                                <span>Save Changes</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className={`text-xs sm:text-sm font-bold px-3.5 py-1 rounded-full capitalize ${selectedRequest.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                                                selectedRequest.status === 'rejected' ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800' :
                                                    'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                                }`}>
                                                {selectedRequest.status || 'pending'}
                                            </span>
                                            {(selectedRequest.status || 'pending').toLowerCase() === 'pending' && (
                                                <button
                                                    type="button"
                                                    onClick={handleStartEdit}
                                                    className="flex items-center gap-1.5 px-3.5 py-1 text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-full border border-indigo-200 dark:border-indigo-800/60 transition-all cursor-pointer shadow-2xs active:scale-95"
                                                    title="Edit this request directly on this page"
                                                >
                                                    <Edit3 size={13} strokeWidth={2.2} />
                                                    <span>Edit Request</span>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Clean Details View - Single container without overlapping nested card boxes */}
                            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
                                {(() => {
                                    let proposedList = normalizeCorrectionSessions ? normalizeCorrectionSessions(selectedRequest.proposed_data, selectedRequest) : (selectedRequest.proposed_data || []);
                                    const originalList = normalizeCorrectionSessions ? normalizeCorrectionSessions(selectedRequest.original_data, selectedRequest) : (selectedRequest.original_data || []);
                                    if (proposedList.length === 0 && originalList.length > 0) {
                                        proposedList = originalList;
                                    }

                                    const { category: detailCategory, cleanReason: detailCleanReason } = parseCorrectionDetails(selectedRequest);
                                    const totalProposedHours = proposedList.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0);
                                    const editProposedHours = editSessions.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0);
                                    const displayProposedHours = isEditing ? editProposedHours : totalProposedHours;

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
                                            {/* In-Place Category & Reset Controls (Visible in Edit Mode) */}
                                            {isEditing && (
                                                <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-github-dark-bg/40 border border-slate-200/80 dark:border-github-dark-border flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-200">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <div>
                                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                                                                Correction Category
                                                            </span>
                                                            <select
                                                                value={editCategory}
                                                                onChange={(e) => setEditCategory(e.target.value)}
                                                                className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 dark:border-github-dark-border bg-white dark:bg-dark-card text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs cursor-pointer min-w-[170px]"
                                                            >
                                                                <option value="Missed Punch">Missed Punch</option>
                                                                <option value="Missed Day">Missed Day</option>
                                                                <option value="Other">Other Reason</option>
                                                            </select>
                                                        </div>
                                                        {editCategory === 'Other' && (
                                                            <div className="min-w-[200px] flex-1">
                                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                                                                    Specific Category
                                                                </span>
                                                                <input
                                                                    type="text"
                                                                    placeholder="e.g., Device offline, Biometric glitch..."
                                                                    value={editOtherCategory}
                                                                    onChange={(e) => setEditOtherCategory(e.target.value)}
                                                                    className="w-full px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 dark:border-github-dark-border bg-white dark:bg-dark-card text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {originalList.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={handleResetToOriginal}
                                                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer mt-auto"
                                                            title="Reset punches back to originally logged times"
                                                        >
                                                            <RotateCcw size={12} />
                                                            <span>Reset Punches to Logged</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}

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
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                                                        {isEditing ? 'Adjusted Total' : 'Proposed Total'}
                                                    </span>
                                                    <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400 text-base">
                                                        {displayProposedHours > 0 ? `${displayProposedHours.toFixed(2)} hrs` : '0.00 hrs'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">Document</span>
                                                    {isEditing ? (
                                                        <div>
                                                            {editAttachment ? (
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[110px]" title={editAttachment.name}>
                                                                        {editAttachment.name}
                                                                    </span>
                                                                    {editAttachmentPreview && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setPreviewImage(editAttachmentPreview)}
                                                                            className="text-indigo-600 hover:text-indigo-700 cursor-pointer p-0.5"
                                                                            title="Preview selected proof"
                                                                        >
                                                                            <Eye size={14} />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditAttachment(null);
                                                                            setEditAttachmentPreview(null);
                                                                        }}
                                                                        className="text-rose-500 hover:text-rose-600 cursor-pointer p-0.5"
                                                                        title="Remove attached file"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            ) : existingAttachmentUrl ? (
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (selectedAttachment?.isImage) {
                                                                                setPreviewImage(existingAttachmentUrl);
                                                                            } else {
                                                                                window.open(existingAttachmentUrl, '_blank');
                                                                            }
                                                                        }}
                                                                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                                                    >
                                                                        <Paperclip size={13} />
                                                                        <span>Proof</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => fileInputRef.current?.click()}
                                                                        className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 cursor-pointer underline ml-0.5"
                                                                    >
                                                                        Replace
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExistingAttachmentUrl(null)}
                                                                        className="p-0.5 text-rose-500 hover:text-rose-600 cursor-pointer ml-0.5"
                                                                        title="Remove existing proof"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 mt-1 cursor-pointer"
                                                                >
                                                                    <Plus size={13} strokeWidth={2.5} />
                                                                    <span>Attach Proof</span>
                                                                </button>
                                                            )}
                                                            <input
                                                                ref={fileInputRef}
                                                                type="file"
                                                                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        setEditAttachment(file);
                                                                        if (file.type.startsWith('image/')) {
                                                                            setEditAttachmentPreview(URL.createObjectURL(file));
                                                                        } else {
                                                                            setEditAttachmentPreview(null);
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    ) : selectedAttachment?.url ? (
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

                                            {/* 2. Reason for Request (Editable or Clean Display) */}
                                            {isEditing ? (
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                            Reason <span className="text-rose-500">*</span>
                                                        </span>
                                                        <span className="text-xs text-slate-400 font-medium">Please provide explanation</span>
                                                    </div>
                                                    <textarea
                                                        rows={3}
                                                        value={editReason}
                                                        onChange={(e) => setEditReason(e.target.value)}
                                                        placeholder="State the reason for this attendance correction..."
                                                        className="w-full p-3 text-sm font-medium rounded-xl border border-slate-300 dark:border-github-dark-border bg-white dark:bg-dark-card text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all resize-none"
                                                    />
                                                </div>
                                            ) : (
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                                                        Reason
                                                    </span>
                                                    <p className="text-base text-slate-800 dark:text-slate-200 font-medium leading-relaxed break-words">
                                                        "{detailCleanReason || 'No specific reason provided.'}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* 3. Punches & Timeline Section */}
                                            <div className="border-t border-slate-200/60 dark:border-github-dark-border/60 pt-5 space-y-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base font-bold text-slate-900 dark:text-white block">
                                                            Punches & Timeline Visualizer
                                                        </span>
                                                        {isEditing && (
                                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                                                                Interactive Editor
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isEditing && (
                                                        <span className="text-xs text-slate-400">
                                                            Click on timeline to add punches, or use direct time inputs below
                                                        </span>
                                                    )}
                                                </div>

                                                {isEditing ? (
                                                    <VisualCorrectionTimeline
                                                        requestData={{
                                                            ...selectedRequest,
                                                            original_data: originalList,
                                                            proposed_data: editSessions.filter(s => s.time_in || s.time_out),
                                                            correction_type: editCategory === 'Other' && editOtherCategory ? editOtherCategory : editCategory,
                                                            status: 'draft'
                                                        }}
                                                        editable={true}
                                                        shift={myShift}
                                                        frameless={true}
                                                        hideHeader={true}
                                                        onIncompleteChange={setTimelineHasIncomplete}
                                                        onSessionsChange={(updated) => {
                                                            setEditSessions(updated.map((s, idx) => {
                                                                const isChk = isCheckpointRecord(s) || s.punch_type === 'normal';
                                                                return {
                                                                    id: `session-${idx}-${s.time_in || s.time_out}`,
                                                                    time_in: s.time_in || '',
                                                                    time_out: isChk ? '' : (s.time_out || ''),
                                                                    punch_type: isChk ? 'normal' : (s.punch_type || 'regular'),
                                                                    address: s.address || ''
                                                                };
                                                            }));
                                                        }}
                                                    />
                                                ) : (
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
                                                )}

                                                {((isEditing ? editSessions : proposedList).length === 0) && (
                                                    <div className="bg-slate-50/70 dark:bg-github-dark-bg/30 border border-slate-200 dark:border-github-dark-border rounded-xl p-4 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
                                                        <Clock size={16} className="text-slate-400 shrink-0" />
                                                        <span>No custom punch timeline submitted. Request submitted with remarks and supporting documentation for review.</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 4. Uploaded Document / Proof Card (When in View Mode) */}
                                            {!isEditing && selectedAttachment && (
                                                <CorrectionDocumentCard
                                                    attachment={selectedAttachment}
                                                    onPreviewImage={setPreviewImage}
                                                    title="Uploaded Document / Proof"
                                                />
                                            )}

                                            {/* 5. Reviewed Remarks / Decision Section */}
                                            {!isEditing && statusLower !== 'pending' && (
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
                                            {!isEditing && <AuditTrailTimeline record={selectedRequest} />}

                                            {/* 7. Sticky Bottom Action Bar in Edit Mode */}
                                            {isEditing && (
                                                <div className="sticky bottom-0 z-20 -mx-6 -mb-6 mt-6 p-4 px-6 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-t border-slate-200 dark:border-github-dark-border flex flex-wrap items-center justify-between gap-4 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                                            <Clock size={14} className="text-indigo-600 dark:text-indigo-400" />
                                                            <span>Adjusted Active Total:</span>
                                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                                                                {displayProposedHours.toFixed(2)} hrs
                                                            </span>
                                                        </div>
                                                        {timelineHasIncomplete && (
                                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/50">
                                                                <AlertCircle size={12} /> Incomplete session detected
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2.5">
                                                        <button
                                                            type="button"
                                                            onClick={handleCancelEdit}
                                                            disabled={isSaving}
                                                            className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-github-dark-bg hover:bg-slate-200 dark:hover:bg-github-dark-border rounded-xl transition-all cursor-pointer active:scale-95"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveEdit}
                                                            disabled={isSaving || timelineHasIncomplete}
                                                            className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                                                        >
                                                            {isSaving ? (
                                                                <>
                                                                    <Loader2 size={15} className="animate-spin" />
                                                                    <span>Saving Changes...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Check size={15} strokeWidth={2.5} />
                                                                    <span>Save & Update Request</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
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
