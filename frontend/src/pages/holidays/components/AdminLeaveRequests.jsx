import React from 'react';
import { Search, Calendar, CheckCircle, XCircle, Paperclip, ChevronDown, FileText, ExternalLink } from 'lucide-react';
import MinimalSelect from '../../../components/MinimalSelect';

const AdminLeaveRequests = ({
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    adminFilteredLeaves = [],
    selectedLeave,
    setSelectedLeave,
    avatarTimestamp,
    calculateDays,
    isAdmin,
    selectedEmployeeBalances = [],
    attachmentsExpanded,
    setAttachmentsExpanded,
    setViewingAttachment,
    adminAction,
    setAdminAction,
    adminRemarksRef,
    handleAdminAction
}) => {
    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
            {/* LEFT PANEL: LIST */}
            <div className="w-full lg:w-1/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                {/* Search & Filter */}
                <div className="p-4 border-b border-slate-200 dark:border-github-dark-border space-y-3 bg-slate-50/50 dark:bg-github-dark-subtle/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by employee name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                        />
                    </div>
                    <div className="flex gap-2">
                        <MinimalSelect
                            options={[
                                { value: 'all', label: 'All' },
                                { value: 'pending', label: 'Pending' },
                                { value: 'approved', label: 'Approved' },
                                { value: 'rejected', label: 'Rejected' }
                            ]}
                            value={statusFilter}
                            onChange={(val) => setStatusFilter(val)}
                            size="sm"
                            triggerClassName="bg-slate-50 dark:bg-[#161b22] border-slate-200 dark:border-github-dark-border text-xs"
                            menuWidth={110}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700 no-scrollbar">
                    {adminFilteredLeaves.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 text-sm">No requests found.</div>
                    ) : (
                        adminFilteredLeaves.map((request) => (
                            <div
                                key={request.lr_id}
                                onClick={() => setSelectedLeave(request)}
                                className={`p-4 cursor-pointer transition-colors ${selectedLeave?.lr_id === request.lr_id ? 'bg-indigo-50 dark:bg-indigo-900/10 border-l-4 border-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-4 border-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-medium text-xs text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                            {request.profile_image_url && request.profile_image_url.startsWith('http') ? (
                                                <img src={`${request.profile_image_url}?t=${avatarTimestamp}`} alt={request.user_name} className="w-full h-full object-cover" />
                                            ) : (
                                                (request.user_name || 'U').charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-semibold ${selectedLeave?.lr_id === request.lr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>{request.user_name}</p>
                                            <p className="text-xs text-slate-500 dark:text-github-dark-muted font-normal">{request.email}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-slate-600 bg-slate-50 dark:text-github-dark-muted dark:bg-github-dark-subtle">
                                        {request.leave_type}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-github-dark-muted mt-3">
                                    <div className="flex items-center gap-1 text-[11px] font-normal text-slate-500">
                                        <Calendar size={12} />
                                        {new Date(request.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                    <div className={`flex items-center gap-1 font-medium capitalize ${request.status === 'approved' ? 'text-emerald-600' :
                                        request.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                                        }`}>
                                        {request.status}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: DETAILS */}
            <div className="w-full lg:w-2/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                {selectedLeave ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-start bg-slate-50/50 dark:bg-github-dark-subtle/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-medium text-sm text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                    {selectedLeave.profile_image_url && selectedLeave.profile_image_url.startsWith('http') ? (
                                        <img src={`${selectedLeave.profile_image_url}?t=${avatarTimestamp}`} alt={selectedLeave.user_name} className="w-full h-full object-cover" />
                                    ) : (
                                        (selectedLeave.user_name || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-github-dark-text mb-0.5">Leave Request #{selectedLeave.lr_id}</h2>
                                    <p className="text-sm text-slate-500 dark:text-github-dark-muted font-normal">
                                        By <span className="font-medium text-slate-700 dark:text-slate-300">{selectedLeave.user_name}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium capitalize ${selectedLeave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                    selectedLeave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    <span className={`w-2 h-2 rounded-full ${selectedLeave.status === 'approved' ? 'bg-emerald-500' :
                                        selectedLeave.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
                                        }`}></span>
                                    {selectedLeave.status}
                                </div>
                                {selectedLeave.status === 'approved' && selectedLeave.pay_type && (
                                    <div className="mt-1">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                            selectedLeave.pay_type === 'Paid'
                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                                        }`}>
                                            {selectedLeave.pay_type}
                                        </span>
                                    </div>
                                )}
                                <div className="text-xs text-slate-400 mt-2">Applied: {new Date(selectedLeave.applied_at || Date.now()).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                            <div className="flex flex-col gap-6 mb-8">
                                {/* Consolidated Leave Details Card */}
                                <div data-tour-id="leave-admin-details" className="bg-slate-50 dark:bg-[#0d1117] p-6 rounded-xl border border-slate-200/80 dark:border-[#30363d] w-full space-y-5 shadow-sm">
                                    <div>
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Leave Type</span>
                                        <span className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">{selectedLeave.leave_type}</span>
                                    </div>
                                    
                                    <div className="flex gap-10">
                                        <div>
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">From</span>
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{new Date(selectedLeave.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">To</span>
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{new Date(selectedLeave.end_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Duration</span>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm">{calculateDays(selectedLeave.start_date, selectedLeave.end_date)} Days</span>
                                    </div>

                                    <div>
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Reason</span>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 italic mt-0.5">"{selectedLeave.reason}"</p>
                                    </div>

                                    {/* Selected employee balances display for Admins */}
                                    {isAdmin && selectedEmployeeBalances.length > 0 && (
                                        <div className="border-t border-slate-200/60 dark:border-[#30363d] pt-4">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-2">Employee Leave Balances</span>
                                            <div className="grid grid-cols-2 gap-3">
                                                {selectedEmployeeBalances.map(bal => (
                                                    <div key={bal.lb_id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border p-2.5 rounded-lg flex flex-col">
                                                        <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">{bal.leave_type}</span>
                                                        <div className="flex justify-between items-baseline mt-1">
                                                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{Number(bal.available)} days left</span>
                                                            <span className="text-[10px] text-slate-400 font-normal">{Number(bal.used)} used</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Attachments Section - Condensed with Inline Expansion */}
                                    {selectedLeave.attachments && selectedLeave.attachments.length > 0 && (
                                        <div className="border-t border-slate-200/60 dark:border-[#30363d] pt-4">
                                            <div
                                                className="flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 p-2 -mx-2 rounded-lg transition-colors gap-10"
                                                onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Paperclip size={18} className="text-slate-400" />
                                                    <span className="text-sm font-medium text-slate-700 dark:text-github-dark-text">
                                                        {selectedLeave.attachments.length} Attachments
                                                    </span>
                                                </div>
                                                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                    {attachmentsExpanded ? 'Hide' : 'View All'}
                                                    <ChevronDown size={14} className={`transform transition-transform ${attachmentsExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                            </div>

                                            {/* Expanded Content */}
                                            {attachmentsExpanded && (
                                                <div className="mt-3 space-y-2">
                                                    {selectedLeave.attachments.map((file, index) => (
                                                        <div
                                                            key={index}
                                                            onClick={() => setViewingAttachment(file)}
                                                            className="flex items-center gap-3 p-3 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-[#30363d] rounded-lg hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-sm transition-all group cursor-pointer"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                                <FileText size={16} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-slate-700 dark:text-github-dark-text truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                                    {file.file_key.split('/').pop()}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 uppercase font-bold">
                                                                    {file.file_type ? file.file_type.split('/')[1]?.toUpperCase() : 'FILE'}
                                                                </p>
                                                            </div>
                                                            <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
                                                                <ExternalLink size={14} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action / Remarks Section */}
                                    <div data-tour-id="leave-admin-actions" className="border-t border-slate-200/60 dark:border-[#30363d] pt-4">
                                        {selectedLeave.status === 'pending' ? (
                                            <>
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-2">Admin Action</span>
                                                
                                                <div className="mb-4">
                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Pay Type</span>
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="payType"
                                                                value="Paid"
                                                                checked={adminAction.payType === 'Paid'}
                                                                onChange={(e) => setAdminAction({ ...adminAction, payType: e.target.value })}
                                                                className="text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                            />
                                                            Paid Leave
                                                        </label>
                                                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="payType"
                                                                value="Unpaid"
                                                                checked={adminAction.payType === 'Unpaid'}
                                                                onChange={(e) => setAdminAction({ ...adminAction, payType: e.target.value })}
                                                                className="text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                            />
                                                            Unpaid Leave
                                                        </label>
                                                    </div>
                                                </div>

                                                <textarea
                                                    ref={adminRemarksRef}
                                                    value={adminAction.remarks}
                                                    onChange={(e) => setAdminAction({ ...adminAction, remarks: e.target.value })}
                                                    rows="1"
                                                    placeholder="Add remarks (required for rejection)..."
                                                    className="w-full p-3 text-sm bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border text-slate-800 dark:text-github-dark-text rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none overflow-hidden min-h-[42px] mb-3"
                                                ></textarea>

                                                <div className="flex gap-3 max-w-xs">
                                                    <button
                                                        onClick={() => handleAdminAction('approved')}
                                                        className="flex-1 py-2 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 cursor-pointer active:scale-95"
                                                    >
                                                        <CheckCircle size={14} /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleAdminAction('rejected')}
                                                        className="flex-1 py-2 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 bg-red-600 text-white shadow-sm hover:bg-red-700 cursor-pointer active:scale-95"
                                                    >
                                                        <XCircle size={14} /> Reject
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="mb-4">
                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                                        Pay Status
                                                    </span>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                        selectedLeave.pay_type === 'Paid'
                                                            ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                            : 'text-red-700 bg-red-50 dark:bg-red-950/20 dark:text-red-400'
                                                    }`}>
                                                        {selectedLeave.pay_type || 'Unspecified'}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                                    Admin Remarks
                                                </span>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 font-normal mt-0.5">
                                                    {selectedLeave.admin_comment || "No remarks provided."}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <FileText size={48} className="mb-4 opacity-50" />
                        <p>Select a request to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminLeaveRequests;
