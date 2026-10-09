import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  Smartphone,
  Laptop,
  Tablet,
  Terminal,
  LogOut,
  ShieldCheck,
  RefreshCw,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';

export default function ActiveDevicesManager() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    actionType: null, // 'single' | 'others'
    payload: null,
    requireTyping: false,
    typingWord: 'REVOKE'
  });
  const [confirmInputText, setConfirmInputText] = useState('');

  const openConfirmModal = ({ title, message, actionType, payload, requireTyping = false, typingWord = 'REVOKE' }) => {
    setConfirmInputText('');
    setConfirmModal({
      isOpen: true,
      title,
      message,
      actionType,
      payload,
      requireTyping,
      typingWord
    });
  };

  const closeConfirmModal = () => {
    setConfirmInputText('');
    setConfirmModal({
      isOpen: false,
      title: '',
      message: '',
      actionType: null,
      payload: null,
      requireTyping: false,
      typingWord: 'REVOKE'
    });
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else if (!refreshing) setLoading(true);

      const res = await api.get('/auth/sessions', {
        params: { _t: Date.now() },
        skipCache: true,
        headers: {
          'x-skip-cache': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.data?.status === 'success') {
        setSessions(res.data.data || []);
      }
      if (isManual) {
        toast.success('Active devices refreshed', { autoClose: 1500 });
      }
    } catch (err) {
      console.error('Failed to load active sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchSessions(true);
  };

  const executeRevoke = async (sessionId) => {
    try {
      setRevokingId(sessionId);
      const res = await api.post(`/auth/sessions/${sessionId}/revoke`);
      toast.success(res.data?.message || 'Device disconnected successfully');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect device');
    } finally {
      setRevokingId(null);
    }
  };

  const executeRevokeOthers = async () => {
    try {
      const res = await api.post('/auth/sessions/revoke-others');
      toast.success(res.data?.message || 'Disconnected from all other devices');
      // Keep only current session
      setSessions((prev) => prev.filter((s) => s.is_current));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect other devices');
    }
  };

  const handleConfirm = () => {
    const { actionType, payload } = confirmModal;
    closeConfirmModal();
    if (actionType === 'single') {
      executeRevoke(payload);
    } else if (actionType === 'others') {
      executeRevokeOthers();
    }
  };

  const getDeviceIcon = (type) => {
    if (type === 'mobile') return <Smartphone size={20} className="text-amber-500" />;
    if (type === 'tablet') return <Tablet size={20} className="text-purple-500" />;
    if (type === 'api_client') return <Terminal size={20} className="text-emerald-500" />;
    return <Laptop size={20} className="text-blue-500" />;
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Active recently';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 2) return 'Active right now';
      if (diffMins < 60) return `${diffMins} minutes ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch (_) {
      return 'Active recently';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (_) {
      return dateStr;
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.is_current).length;

  return (
    <div className="bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-github-dark-border p-6 shadow-xs space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-github-dark-border/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck size={20} />
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Active Devices & Sessions
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage physical devices currently signed in to your account. Revoke access from old or unrecognized devices.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-github-dark-subtle transition-colors disabled:opacity-50"
            title="Refresh devices"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
          </button>

          {otherSessionsCount > 0 && (
            <button
              type="button"
              onClick={() =>
                openConfirmModal({
                  title: 'Sign Out All Other Devices',
                  message: `This will immediately terminate sessions on all other ${otherSessionsCount} device(s). You will stay logged in on this device.`,
                  actionType: 'others',
                  payload: null,
                  requireTyping: true,
                  typingWord: 'REVOKE'
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
            >
              <LogOut size={14} />
              <span>Log out {otherSessionsCount} other device{otherSessionsCount > 1 ? 's' : ''}</span>
            </button>
          )}
        </div>
      </div>

      {/* Device List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw size={24} className="animate-spin text-indigo-500 mb-2" />
          <p className="text-xs">Loading active devices...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <Laptop size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No active sessions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-2xl border transition-all ${
                session.is_current
                  ? 'border-emerald-200 dark:border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : 'border-slate-200/80 dark:border-github-dark-border bg-slate-50/40 dark:bg-github-dark-subtle/30 hover:border-slate-300 dark:hover:border-slate-700'
              } flex flex-col justify-between space-y-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/60 dark:border-github-dark-border shadow-xs shrink-0">
                    {getDeviceIcon(session.device_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {session.device_name || `${session.browser || 'Browser'} on ${session.os || 'Device'}`}
                      </h4>
                      {session.is_current && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          This Device
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {session.browser} • {session.os}
                    </p>
                  </div>
                </div>
              </div>

              {/* Network and Activity Details */}
              <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border/60 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <Globe size={12} className="text-slate-400" />
                    <span>IP Address</span>
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                    {session.ip_address || 'Dynamic IP'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-slate-400" />
                    <span>Last Active</span>
                  </span>
                  <span className={session.is_current ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
                    {session.is_current ? 'Active now' : formatTimeAgo(session.last_active_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>First logged in</span>
                  <span>{formatDate(session.created_at)}</span>
                </div>
              </div>

              {/* Action Button */}
              {!session.is_current && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={revokingId === session.id}
                    onClick={() =>
                      openConfirmModal({
                        title: 'Disconnect Device',
                        message: `Are you sure you want to log out of ${session.device_name || 'this device'}?`,
                        actionType: 'single',
                        payload: session.id,
                        requireTyping: false
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors disabled:opacity-50"
                  >
                    <LogOut size={13} />
                    <span>Log Out Device</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-3xl border border-slate-200 dark:border-github-dark-border p-6 space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {confirmModal.message}
              </p>
            </div>

            {/* Typing Confirmation for Major Steps */}
            {confirmModal.requireTyping && (
              <div className="space-y-2 pt-1 text-left">
                <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
                  To confirm, please type <span className="font-mono font-black text-rose-600 dark:text-rose-400 select-all">{confirmModal.typingWord || 'REVOKE'}</span> below:
                </div>
                <input
                  type="text"
                  autoFocus
                  value={confirmInputText}
                  onChange={(e) => setConfirmInputText(e.target.value)}
                  placeholder={`Type ${confirmModal.typingWord || 'REVOKE'}`}
                  className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2 px-3 text-xs font-mono font-bold uppercase outline-none focus:border-rose-500 text-slate-900 dark:text-white placeholder-slate-400"
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      confirmInputText.trim().toUpperCase() === (confirmModal.typingWord || 'REVOKE').toUpperCase()
                    ) {
                      handleConfirm();
                    }
                  }}
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeConfirmModal}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-github-dark-subtle hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  confirmModal.requireTyping &&
                  confirmInputText.trim().toUpperCase() !== (confirmModal.typingWord || 'REVOKE').toUpperCase()
                }
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Log Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
