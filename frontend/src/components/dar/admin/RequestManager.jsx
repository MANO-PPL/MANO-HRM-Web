import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, FileText, Filter, CheckCircle2, XCircle, Clock, Check, X, ShieldAlert } from 'lucide-react';
import RequestReviewModal from '../../dar/RequestReviewModal';
import api from '../../../services/api';
import { toast } from 'react-toastify';
import MinimalSelect from '../../MinimalSelect';
import { formatPlatformDate } from '../../../utils/dateUtils';

const RequestManager = ({
    departments = [],
    selectedDepartment: propDept,
    searchQuery: propSearch,
    onRequestHandled,
    onRequestCountsUpdated
}) => {
    const location = useLocation();
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [localSearch, setLocalSearch] = useState("");
    const [localDept, setLocalDept] = useState("All Departments");
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'pending' | 'approved' | 'rejected'

    // Synchronize props if provided
    const requestSearch = propSearch !== undefined ? propSearch : localSearch;
    const selectedDepartment = propDept !== undefined ? propDept : localDept;

    // Fetch Requests
    const fetchRequests = async () => {
        setLoadingRequests(true);
        try {
            const params = new URLSearchParams(window.location.search);
            const targetReqId = params.get('requestId') || params.get('req_id') || params.get('id');

            const res = await api.get('/dar/requests/list', {
                params: targetReqId ? { requestId: targetReqId } : {}
            });

            const rawList = res.data?.data || [];
            const mapped = rawList.map(r => ({
                id: r.request_id,
                user: r.user_name,
                dept: r.user_dept || 'Unknown',
                role: r.user_role || 'employee',
                date: r.request_date,
                changes: (r.proposed_data?.length || 0),
                employeeName: r.user_name,
                originalTasks: (r.original_data || []).map(t => ({
                    ...t,
                    id: t.id || Math.random(),
                    startTime: t.start_time || t.startTime,
                    endTime: t.end_time || t.endTime
                })),
                proposedTasks: (r.proposed_data || []).map(t => ({
                    ...t,
                    id: t.id || Math.random(),
                    startTime: t.start_time || t.startTime,
                    endTime: t.end_time || t.endTime
                })),
                status: r.status,
                reason: r.reason
            }));

            setRequests([...mapped]);

            if (onRequestCountsUpdated) {
                const pending = mapped.filter(r => (r.status || '').toLowerCase() === 'pending').length;
                onRequestCountsUpdated({ total: mapped.length, pending });
            }

            if (targetReqId) {
                const targetReq = mapped.find(req => String(req.id) === String(targetReqId));
                if (targetReq) {
                    setSelectedRequest(targetReq);
                    setLocalDept("All Departments");
                    setLocalSearch("");
                }
            } else if (!selectedRequest && mapped.length > 0) {
                // Auto-select the first pending request if available
                const firstPending = mapped.find(r => (r.status || '').toLowerCase() === 'pending');
                setSelectedRequest(firstPending || mapped[0]);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load requests");
        } finally {
            setLoadingRequests(false);
        }
    };

    const handleApproveRequest = async (reqId) => {
        try {
            await api.post(`/dar/requests/approve/${reqId}`);
            toast.success("Request Approved & Applied");
            setSelectedRequest(null);
            await fetchRequests();
            if (onRequestHandled) onRequestHandled();
        } catch (err) {
            toast.error("Approval Failed: " + (err.response?.data?.message || err.message));
        }
    };

    const handleRejectRequest = async (reqId) => {
        try {
            await api.post(`/dar/requests/reject/${reqId}`, { comment: "Rejected by Admin" });
            toast.info("Request Rejected");
            setSelectedRequest(null);
            await fetchRequests();
            if (onRequestHandled) onRequestHandled();
        } catch (err) {
            toast.error("Rejection Failed");
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const targetReqId = params.get('requestId') || params.get('req_id') || params.get('id');
        if (targetReqId && requests.length > 0) {
            const targetReq = requests.find(req => String(req.id) === String(targetReqId));
            if (targetReq) {
                setSelectedRequest(targetReq);
                setLocalDept("All Departments");
                setLocalSearch("");
            }
        }
    }, [location.search, requests]);

    const counts = {
        all: requests.length,
        pending: requests.filter(r => (r.status || '').toLowerCase() === 'pending').length,
        approved: requests.filter(r => (r.status || '').toLowerCase() === 'approved').length,
        rejected: requests.filter(r => (r.status || '').toLowerCase() === 'rejected').length
    };

    const filteredRequests = requests.filter(req => {
        // Status filter
        if (statusFilter !== 'all' && (req.status || '').toLowerCase() !== statusFilter) {
            return false;
        }

        // Search filter
        if (requestSearch && requestSearch.trim()) {
            const q = requestSearch.toLowerCase().trim();
            const userMatch = (req.user || '').toLowerCase().includes(q);
            const deptMatch = (req.dept || '').toLowerCase().includes(q);
            if (!userMatch && !deptMatch) return false;
        }

        // Dept filter
        const deptNorm = (selectedDepartment || '').toLowerCase();
        if (deptNorm && deptNorm !== 'all' && deptNorm !== 'all departments') {
            if ((req.dept || '').toLowerCase() !== deptNorm) return false;
        }

        return true;
    });

    return (
        <div className="flex h-full gap-5 pb-2">
            {/* Left: Request Feed List */}
            <div data-tour-id="dar-review-feed" className="w-[360px] shrink-0 bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                {/* Search & Filters */}
                <div className="p-3.5 border-b border-slate-100 dark:border-github-dark-border space-y-2.5 bg-white dark:bg-dark-card z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">Revision Requests</h3>
                            {counts.pending > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                                    {counts.pending} Pending
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{filteredRequests.length} of {requests.length}</span>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex items-center p-1 bg-slate-100 dark:bg-github-dark-subtle/80 rounded-xl text-xs font-semibold gap-1">
                        {[
                            { key: 'all', label: 'All', count: counts.all },
                            { key: 'pending', label: 'Pending', count: counts.pending, alert: counts.pending > 0 },
                            { key: 'approved', label: 'Approved', count: counts.approved },
                            { key: 'rejected', label: 'Rejected', count: counts.rejected }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setStatusFilter(tab.key)}
                                className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                    statusFilter === tab.key
                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={`text-[9px] px-1 rounded-full ${
                                        tab.alert
                                            ? 'bg-amber-500 text-white'
                                            : statusFilter === tab.key
                                            ? 'bg-indigo-100 dark:bg-slate-600 text-indigo-700 dark:text-slate-200'
                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Local Search fallback if not controlled */}
                    {propSearch === undefined && (
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                placeholder="Search by employee name..."
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    )}
                </div>

                {/* Request Cards Feed */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
                    {loadingRequests ? (
                        <div className="text-center py-12 text-slate-400 text-xs">Loading requests...</div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <FileText size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">No requests found</div>
                            <div className="text-xs text-slate-400 mt-1">There are no requests matching the current filters.</div>
                        </div>
                    ) : (
                        filteredRequests.map(req => {
                            const isSelected = selectedRequest?.id === req.id;
                            const isPending = (req.status || '').toLowerCase() === 'pending';
                            const isApproved = (req.status || '').toLowerCase() === 'approved';
                            const isRejected = (req.status || '').toLowerCase() === 'rejected';

                            return (
                                <div
                                    key={req.id}
                                    onClick={() => setSelectedRequest(req)}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                                        isSelected
                                            ? 'bg-indigo-50/70 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500/50 shadow-xs'
                                            : 'bg-slate-50/80 dark:bg-github-dark-subtle/50 border-slate-200/80 dark:border-github-dark-border hover:border-indigo-300 dark:hover:border-indigo-800'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                                                {(req.user || 'E')[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`font-bold text-xs truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                    {req.user}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate">{req.dept}</div>
                                            </div>
                                        </div>

                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                                            isPending
                                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                                                : isApproved
                                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                                        }`}>
                                            {req.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200/50 dark:border-github-dark-border/50">
                                        <span>Target: <strong className="text-slate-700 dark:text-slate-300">{req.date ? formatPlatformDate(req.date) : 'N/A'}</strong></span>
                                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">
                                            {req.changes} changes
                                        </span>
                                    </div>

                                    {req.reason && (
                                        <div className="mt-1.5 text-[11px] text-slate-500 italic truncate" title={req.reason}>
                                            "{req.reason}"
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right: Detailed Inspection & Review Pane */}
            <div data-tour-id="dar-admin-requests-actions" className="flex-1 bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col relative">
                {selectedRequest ? (
                    <RequestReviewModal
                        isOpen={true}
                        onClose={() => setSelectedRequest(null)}
                        request={selectedRequest}
                        onApprove={() => handleApproveRequest(selectedRequest.id)}
                        onReject={() => handleRejectRequest(selectedRequest.id)}
                        inline={true}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 p-8 text-center">
                        <FileText size={48} className="mb-3 opacity-40" />
                        <h4 className="text-base font-bold text-slate-600 dark:text-slate-400">Select a Request to Review</h4>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                            Click on any employee revision request from the list on the left to inspect proposed activity changes, diff timeline, and approve or reject.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequestManager;
