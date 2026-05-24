import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { 
    MessageSquare, Search, Loader2, Paperclip, ExternalLink, CheckCircle, 
    Clock, AlertTriangle, Eye, ArrowUpDown, ChevronRight, Copy, Mail, 
    RefreshCw, Filter, X, ChevronLeft, Check, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import MinimalSelect from '../../components/MinimalSelect';

const FeedbackDetailsModal = ({ item, onClose, onRefresh, onUpdateStatus }) => {
  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  const handleCopyDetails = () => {
    const formattedText = `Ticket ID: #${item.feedback_id}
Type: ${item.type?.toUpperCase()}
Status: ${item.status?.toUpperCase()}
Title: ${item.title}
Submitter: ${item.user_name || 'Anonymous'} (${item.email || 'No email'})
Organization: ${item.org_name || 'N/A'}
Date Submitted: ${new Date(item.created_at).toLocaleString()}
--------------------------------------------------
Description:
${item.description}
`;
    navigator.clipboard.writeText(formattedText);
    toast.info('Ticket details copied!');
  };

  const handleCopyEmail = () => {
    if (!item.email) return;
    navigator.clipboard.writeText(item.email);
    toast.info('Email address copied!');
  };

  const getTypeBadge = (type) => {
    switch (type?.toLowerCase()) {
      case 'bug': 
        return <span className="px-2 py-0.5 text-[8px] font-black rounded bg-red-105 text-red-700 dark:bg-red-950/40 dark:text-red-400 uppercase tracking-widest border border-red-200/25">BUG REPORT</span>;
      case 'feature': 
        return <span className="px-2 py-0.5 text-[8px] font-black rounded bg-indigo-105 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 uppercase tracking-widest border border-indigo-200/25">FEATURE REQ</span>;
      default: 
        return <span className="px-2 py-0.5 text-[8px] font-black rounded bg-slate-105 text-slate-700 dark:bg-github-dark-border dark:text-github-dark-muted uppercase tracking-widest">{type}</span>;
    }
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'resolved':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest"><CheckCircle size={12} /> Resolved</span>;
      case 'reviewed':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-widest"><Eye size={12} /> Reviewed</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest"><Clock size={12} /> Pending</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="relative bg-white dark:bg-black w-full rounded-t-[2.5rem] p-6 shadow-2xl border-t border-slate-100 dark:border-slate-800 max-h-[92vh] overflow-y-auto no-scrollbar space-y-6">
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-850 rounded-full mx-auto mb-2" />

        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-650 dark:hover:text-white rounded-full bg-slate-50 dark:bg-white/5"><X size={18} /></button>

        {/* Header */}
        <div className="border-b border-slate-100 dark:border-white/5 pb-4 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            {getTypeBadge(item.type)}
            <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-350">Ticket #{item.feedback_id}</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase leading-snug">{item.title}</h3>
          <p className="text-[10px] text-slate-400">Submitted on {formatDateTime(item.created_at)}</p>
        </div>

        {/* Status Actions */}
        <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Status</span>
            {getStatusIndicator(item.status)}
          </div>
          <div className="flex flex-wrap gap-2">
            {item.status !== 'pending' && (
              <button onClick={() => onUpdateStatus(item.feedback_id, 'pending')} className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-amber-100 dark:border-white/5 transition-colors">Pending</button>
            )}
            {item.status !== 'reviewed' && (
              <button onClick={() => onUpdateStatus(item.feedback_id, 'reviewed')} className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-indigo-100 dark:border-white/5 transition-colors">Reviewed</button>
            )}
            {item.status !== 'resolved' && (
              <button onClick={() => onUpdateStatus(item.feedback_id, 'resolved')} className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-emerald-100 dark:border-white/5 transition-colors">Resolved</button>
            )}
          </div>
        </div>

        {/* Submitter Profile */}
        <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3.5">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitter Details</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 dark:text-github-dark-muted block text-[9px] uppercase tracking-wider mb-0.5">Username</span>
              <span className="font-bold text-slate-800 dark:text-white truncate block">{item.user_name || 'Anonymous User'}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-github-dark-muted block text-[9px] uppercase tracking-wider mb-0.5">Organization</span>
              <span className="font-bold text-slate-800 dark:text-white truncate block">{item.org_name || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 dark:text-github-dark-muted block text-[9px] uppercase tracking-wider mb-0.5">Email Address</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-bold text-slate-800 dark:text-white break-all">{item.email || 'N/A'}</span>
                {item.email && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={handleCopyEmail} className="p-1 rounded bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500"><Copy size={11} /></button>
                    <a href={`mailto:${item.email}`} className="p-1 rounded bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500"><Mail size={11} /></a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Report Description */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Description</h4>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-4 rounded-2xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap select-text font-mono">
            {item.description}
          </div>
        </div>

        {/* Attachments Section */}
        {item.attachments && item.attachments.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Paperclip size={12} /> Attachments ({item.attachments.length})</h4>
            <div className="grid grid-cols-1 gap-2">
              {item.attachments.map(att => {
                const isImage = att.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                return (
                  <div key={att.attachment_id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isImage && att.url ? (
                        <img src={att.url} alt={att.file_name} className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-white/10 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center rounded-lg font-bold text-[10px] shrink-0 border border-indigo-100 dark:border-indigo-900/40">FILE</div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate" title={att.file_name}>{att.file_name}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">{att.file_type || 'Unknown'}</p>
                      </div>
                    </div>
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-indigo-600 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl"><ExternalLink size={12} /></a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resolutions Footer */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/5">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</h4>
          <div className="flex gap-2">
            {item.email && (
              <a href={`mailto:${item.email}?subject=Re: [MANO Support - Ticket %23${item.feedback_id}] ${encodeURIComponent(item.title)}&body=Hi ${encodeURIComponent(item.user_name || '')},%0A%0AWe have received your report regarding "${encodeURIComponent(item.title)}".%0A%0A[Write reply details here]%0A%0ABest regards,%0ASupport Team`} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md flex items-center justify-center gap-1.5">
                <Mail size={13} /> Draft Reply
              </a>
            )}
            <button onClick={handleCopyDetails} className="flex-1 py-3 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-github-dark-muted rounded-xl text-[10px] font-bold uppercase tracking-widest border border-slate-200 dark:border-white/5 flex items-center justify-center gap-1.5">
              <Copy size={13} /> Copy Details
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
};

const UserFeedbackMobile = () => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState('bug'); // 'bug' | 'feedback'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'reviewed' | 'resolved'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest'
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const res = await api.get('/super-admin/monitor/feedback');
      setFeedback(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch user feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.put(`/super-admin/monitor/feedback/${id}`, { status: newStatus });
      const item = feedback.find(f => f.feedback_id === id);
      const label = item?.type?.toLowerCase() === 'bug' ? 'Bug report' : 'Feedback';
      toast.success(`${label} marked as ${newStatus} successfully!`);
      
      const updatedList = feedback.map(f => f.feedback_id === id ? { ...f, status: newStatus, updated_at: new Date().toISOString() } : f);
      setFeedback(updatedList);
      
      // Update selected modal feedback item too
      if (selectedFeedback && selectedFeedback.feedback_id === id) {
        setSelectedFeedback({ ...selectedFeedback, status: newStatus });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  // Badge counts
  const totalBugCount = feedback.filter(f => f.type?.toLowerCase() === 'bug').length;
  const totalFeedbackCount = feedback.filter(f => f.type?.toLowerCase() !== 'bug').length;

  const categoryFeedback = feedback.filter(f => {
    const isBug = f.type?.toLowerCase() === 'bug';
    return activeCategoryTab === 'bug' ? isBug : !isBug;
  });

  const totalCount = categoryFeedback.length;
  const pendingCount = categoryFeedback.filter(f => f.status === 'pending').length;
  const reviewedCount = categoryFeedback.filter(f => f.status === 'reviewed').length;
  const resolvedCount = categoryFeedback.filter(f => f.status === 'resolved').length;

  const filteredFeedback = categoryFeedback.filter(f => {
    const matchesSearch = searchQuery === '' || 
        (f.title && f.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.user_name && f.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.org_name && f.org_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || f.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const sortedFeedback = [...filteredFeedback].sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const formatRelativeTime = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d';`
      return date.toLocaleDateString();
    } catch (e) {
      return '';
    }
  };

  const getTypeBadge = (type) => {
    if (type?.toLowerCase() === 'bug') {
      return <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 uppercase tracking-wider">BUG</span>;
    }
    return <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 uppercase tracking-wider">FEEDBACK</span>;
  };

  return (
    <MobileDashboardLayout title="User Feedback">
      <div className="space-y-4 pb-24">
        
        {/* Dynamic Metric cards */}
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { key: 'all', label: 'Total', count: totalCount, color: 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500' },
            { key: 'pending', label: 'Pending', count: pendingCount, color: 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-500 text-amber-600' },
            { key: 'reviewed', label: 'Reviewed', count: reviewedCount, color: 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-500 text-purple-650' },
            { key: 'resolved', label: 'Resolved', count: resolvedCount, color: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-600' }
          ].map(card => (
            <button
              key={card.key}
              onClick={() => setFilterStatus(card.key)}
              className={`p-3 rounded-2xl border text-center transition-all ${
                filterStatus === card.key 
                  ? `${card.color} shadow-sm ring-1 ring-indigo-500/20` 
                  : 'bg-white dark:bg-dark-card border-slate-200 dark:border-github-dark-border'
              }`}
            >
              <span className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted block uppercase tracking-wider">{card.label}</span>
              <span className="text-lg font-black text-slate-805 dark:text-white block mt-1 leading-none">{card.count}</span>
            </button>
          ))}
        </div>

        {/* Search, Sort and Category Tabs */}
        <div className="sticky top-16 -mx-4 px-4 py-3 bg-slate-50 dark:bg-black z-20 space-y-3 transition-all duration-300">
          
          {/* Category Tabs */}
          <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/5">
            <button
              onClick={() => { setActiveCategoryTab('bug'); setFilterStatus('all'); }}
              className={`flex-1 py-2 text-[10px] font-bold rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeCategoryTab === 'bug'
                  ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 transform scale-[1.02] shadow-sm'
                  : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50'
              }`}
            >
              Bug Reports
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeCategoryTab === 'bug' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 dark:bg-slate-750'}`}>{totalBugCount}</span>
            </button>
            <button
              onClick={() => { setActiveCategoryTab('feedback'); setFilterStatus('all'); }}
              className={`flex-1 py-2 text-[10px] font-bold rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeCategoryTab === 'feedback'
                  ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 transform scale-[1.02] shadow-sm'
                  : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50'
              }`}
            >
              Feedbacks
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeCategoryTab === 'feedback' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 dark:bg-slate-750'}`}>{totalFeedbackCount}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <input
                type="text"
                placeholder="Search feedback..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-10 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-slate-800 dark:text-white"
              />
            </div>
            
            {/* Sort select */}
            <MinimalSelect
              options={["Newest", "Oldest"]}
              value={sortBy === 'newest' ? 'Newest' : 'Oldest'}
              onChange={(val) => setSortBy(val === 'Newest' ? 'newest' : 'oldest')}
              size="sm"
              triggerClassName="h-10 px-3 !bg-white dark:!bg-github-dark-subtle !border-slate-200 dark:!border-github-dark-border rounded-xl text-xs font-semibold shadow-sm justify-between w-28 text-slate-800 dark:text-slate-300"
            />
          </div>
        </div>

        {/* List of Feedback Card Items */}
        <div className="relative min-h-[50vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-400 animate-pulse">Syncing logs...</p>
            </div>
          ) : sortedFeedback.length > 0 ? (
            <div className="grid gap-3 pb-10">
              {sortedFeedback.map((item) => (
                <div
                  key={item.feedback_id}
                  onClick={() => setSelectedFeedback(item)}
                  className="bg-white dark:bg-github-dark-subtle p-4 rounded-3xl border border-slate-100 dark:border-github-dark-border shadow-sm active:scale-[0.98] transition-all flex flex-col gap-2 relative overflow-hidden group"
                >
                  <div className="absolute -right-4 -top-4 w-12 h-12 bg-indigo-500/5 blur-2xl rounded-full" />
                  
                  <div className="flex justify-between items-start w-full gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getTypeBadge(item.type)}
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        item.status === 'resolved' ? 'bg-emerald-500' :
                        item.status === 'reviewed' ? 'bg-indigo-500' : 'bg-amber-500'
                      }`} />
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">{formatRelativeTime(item.created_at)}</span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-github-dark-text line-clamp-1 leading-snug">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-github-dark-muted line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-50 dark:border-white/5 pt-2 mt-0.5 w-full">
                    <span className="truncate max-w-[80%] font-medium">
                      {item.user_name || 'Anonymous'} {item.org_name ? `(${item.org_name})` : ''}
                    </span>
                    {item.attachments && item.attachments.length > 0 && (
                      <span className="flex items-center gap-0.5 text-indigo-500 font-bold shrink-0">
                        <Paperclip size={10} /> {item.attachments.length}
                      </span>
                    )}
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-github-dark-subtle rounded-[2rem] flex items-center justify-center mb-5 border border-slate-200/50 dark:border-white/5">
                <MessageSquare size={28} className="text-slate-300 dark:text-github-dark-muted" />
              </div>
              <h3 className="text-base font-black text-slate-805 mb-1">No reports discovered</h3>
              <p className="text-xs text-slate-500">There are no feedback tickets matching query filters.</p>
            </div>
          )}
        </div>

        {/* Detail drawer modal */}
        <AnimatePresence>
          {selectedFeedback && (
            <FeedbackDetailsModal
              item={selectedFeedback}
              onClose={() => setSelectedFeedback(null)}
              onRefresh={fetchFeedback}
              onUpdateStatus={handleUpdateStatus}
            />
          )}
        </AnimatePresence>

      </div>
    </MobileDashboardLayout>
  );
};

export default UserFeedbackMobile;
