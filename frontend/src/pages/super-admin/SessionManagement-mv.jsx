import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import api, { removeCacheByUrl } from '../../services/api';
import { toast } from 'react-toastify';
import {
  Smartphone,
  Laptop,
  Tablet,
  Terminal,
  Search,
  RefreshCw,
  Trash2,
  UserX,
  ShieldCheck,
  Clock,
  XCircle,
  Copy,
  Eye,
  Check,
  Building,
  Key,
  Globe,
  Flame,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X
} from 'lucide-react';

export default function SessionManagementMobile() {
  const [activeTab, setActiveTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    revoked: 0,
    expired: 0,
    mobile: 0,
    desktop: 0,
    unique_active_users: 0
  });

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [deviceType, setDeviceType] = useState('all');

  const [inspectSession, setInspectSession] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    actionType: null,
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

  const [copiedKey, setCopiedKey] = useState(null);

  // FCM tokens state
  const [fcmTokens, setFcmTokens] = useState([]);
  const [fcmLoading, setFcmLoading] = useState(false);
  const [fcmSearch, setFcmSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions(page);
    } else {
      fetchFcmTokens(1);
    }
  }, [activeTab, page, status, deviceType]);

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied!', { autoClose: 1200 });
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const fetchSessions = async (pageNum = 1, isManual = false, overrideSearch = null) => {
    try {
      if (isManual) {
        setRefreshing(true);
      } else if (pageNum === 1 && !refreshing) {
        setLoading(true);
      }

      removeCacheByUrl('sessions');
      removeCacheByUrl('super-admin');

      const activeSearch = overrideSearch !== null ? overrideSearch : search;

      const params = {
        page: pageNum,
        limit: 15,
        search: activeSearch.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        device_type: deviceType !== 'all' ? deviceType : undefined,
        _t: Date.now()
      };

      const res = await api.get('/super-admin/sessions', {
        params,
        skipCache: true,
        headers: {
          'x-skip-cache': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (res.data?.status === 'success') {
        setSessions(res.data.data || []);
        if (res.data.pagination) {
          setPage(res.data.pagination.page);
          setTotal(res.data.pagination.total);
          setTotalPages(res.data.pagination.totalPages);
        }
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
      if (isManual) {
        toast.success('Live sessions refreshed', { autoClose: 1500 });
      }
    } catch (err) {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFcmTokens = async (isManual = false) => {
    try {
      if (isManual) {
        setRefreshing(true);
      } else {
        setFcmLoading(true);
      }

      removeCacheByUrl('device-tokens');

      const params = {
        page: 1,
        limit: 30,
        search: fcmSearch.trim() || undefined,
        _t: Date.now()
      };

      const res = await api.get('/super-admin/device-tokens', {
        params,
        skipCache: true,
        headers: {
          'x-skip-cache': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (res.data?.status === 'success') {
        setFcmTokens(res.data.data || []);
      }
      if (isManual) {
        toast.success('Tokens refreshed', { autoClose: 1500 });
      }
    } catch (err) {
      toast.error('Failed to load FCM tokens');
    } finally {
      setFcmLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setPage(1);
    fetchSessions(1, false, search);
  };

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    fetchSessions(1, false, '');
  };

  const handleRefresh = async () => {
    if (activeTab === 'sessions') {
      await fetchSessions(page, true);
    } else {
      await fetchFcmTokens(true);
    }
  };

  const executeRevoke = async (id) => {
    try {
      const res = await api.post(`/super-admin/sessions/${id}/revoke`);
      toast.success(res.data?.message || 'Session revoked');
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, revoked: true, status: 'revoked', is_active_session: false } : s))
      );
      if (inspectSession?.id === id) setInspectSession(null);
      fetchSessions(page);
    } catch (err) {
      toast.error('Failed to revoke session');
    }
  };

  const executeRevokeAllUser = async (userId) => {
    try {
      const res = await api.post(`/super-admin/sessions/user/${userId}/revoke-all`);
      toast.success(res.data?.message || 'All user sessions revoked');
      setInspectSession(null);
      fetchSessions(page);
    } catch (err) {
      toast.error('Failed to revoke user sessions');
    }
  };

  const executeDeleteFcmToken = async (id) => {
    try {
      await api.delete(`/super-admin/device-tokens/${id}`);
      toast.success('Device token removed');
      setFcmTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toast.error('Failed to delete FCM token');
    }
  };

  const handleConfirmAction = () => {
    const { actionType, payload } = confirmModal;
    closeConfirmModal();
    if (actionType === 'revoke_single') executeRevoke(payload);
    else if (actionType === 'revoke_user') executeRevokeAllUser(payload);
    else if (actionType === 'delete_fcm') executeDeleteFcmToken(payload);
  };

  const getDeviceIcon = (device) => {
    if (device?.is_mobile) return <Smartphone size={16} className="text-amber-500" />;
    if (device?.is_tablet) return <Tablet size={16} className="text-purple-500" />;
    if (device?.is_api) return <Terminal size={16} className="text-emerald-500" />;
    return <Laptop size={16} className="text-blue-500" />;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return dateStr;
    }
  };

  return (
    <MobileDashboardLayout title="Sessions & Tokens">
      <div className="space-y-4 pb-20">
        
        {/* Horizontal Scroll Stats Bar */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          <div className="bg-white dark:bg-dark-card p-3 rounded-2xl border border-slate-200 dark:border-github-dark-border shrink-0 min-w-[120px] shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Active</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.active}
            </div>
          </div>
          <div className="bg-white dark:bg-dark-card p-3 rounded-2xl border border-slate-200 dark:border-github-dark-border shrink-0 min-w-[120px] shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Mobile App</span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {stats.mobile}
            </div>
          </div>
          <div className="bg-white dark:bg-dark-card p-3 rounded-2xl border border-slate-200 dark:border-github-dark-border shrink-0 min-w-[120px] shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Desktop Web</span>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
              {stats.desktop}
            </div>
          </div>
          <div className="bg-white dark:bg-dark-card p-3 rounded-2xl border border-slate-200 dark:border-github-dark-border shrink-0 min-w-[120px] shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Online Users</span>
            <div className="text-xl font-black text-violet-600 dark:text-violet-400 mt-0.5">
              {stats.unique_active_users}
            </div>
          </div>
        </div>

        {/* Tab switch & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex p-1 bg-slate-100 dark:bg-github-dark-subtle rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                activeTab === 'sessions'
                  ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Sessions ({total})
            </button>
            <button
              onClick={() => setActiveTab('fcm')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                activeTab === 'fcm'
                  ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              FCM Device Tokens
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            title="Refresh live data"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-github-dark-border bg-white dark:bg-dark-card text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs active:scale-95 disabled:opacity-50 transition-all shrink-0"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search User, IP, Token..."
              className="w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl py-2.5 pl-9 pr-24 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 shadow-xs"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  title="Clear search"
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="submit"
                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                Search
              </button>
            </div>
          </div>
        </form>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {['all', 'active', 'revoked', 'expired'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatus(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full font-bold uppercase text-[10px] tracking-wider whitespace-nowrap transition-colors ${
                status === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-dark-card text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-github-dark-border'
              }`}
            >
              {st}
            </button>
          ))}
          {['all', 'mobile', 'desktop'].map((dt) => (
            <button
              key={dt}
              onClick={() => {
                setDeviceType(dt);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full font-bold uppercase text-[10px] tracking-wider whitespace-nowrap transition-colors ${
                deviceType === dt
                  ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-dark-card text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-github-dark-border'
              }`}
            >
              {dt === 'all' ? 'All Devices' : dt}
            </button>
          ))}
        </div>

        {/* Sessions List */}
        {activeTab === 'sessions' && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-20 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-xs">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border p-6">
                <Key size={32} className="mx-auto mb-2 opacity-40" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No sessions match filters</p>
                <p className="text-xs text-slate-500 mt-1">Try resetting filters or search terms.</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-xs space-y-3"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {(session.user?.user_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                          {session.user?.user_name}
                        </h4>
                        <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                          {session.organization?.org_name} • {session.user?.user_code}
                        </span>
                      </div>
                    </div>
                    {session.status === 'active' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200/60 uppercase">
                        Active
                      </span>
                    ) : session.status === 'revoked' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 uppercase">
                        Revoked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 dark:bg-github-dark-border dark:text-slate-300 uppercase">
                        Expired
                      </span>
                    )}
                  </div>

                  {/* Device Info */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-subtle text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        {getDeviceIcon(session.device)}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {session.device?.browser}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {session.device?.os}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-github-dark-border/40">
                      <span className="text-slate-400 font-mono">{session.ip_address}</span>
                      <span className="text-slate-400">{formatDate(session.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setInspectSession(session)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400"
                    >
                      <Eye size={14} />
                      <span>Inspect Details</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openConfirmModal({
                            title: `Revoke All Sessions for ${session.user?.user_name}`,
                            message: `Invalidate all active sessions and refresh tokens for user ${session.user?.user_name} across all devices?`,
                            actionType: 'revoke_user',
                            payload: session.user_id,
                            requireTyping: true,
                            typingWord: 'REVOKE'
                          })
                        }
                        title="Logout user everywhere"
                        className="p-1.5 rounded-lg text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
                      >
                        <UserX size={15} />
                      </button>

                      <button
                        type="button"
                        disabled={session.status === 'revoked'}
                        onClick={() =>
                          openConfirmModal({
                            title: 'Revoke Session',
                            message: `Disconnect this session for ${session.user?.user_name}?`,
                            actionType: 'revoke_single',
                            payload: session.id,
                            requireTyping: false
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 disabled:opacity-40"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Mobile Pagination */}
            {sessions.length > 0 && (
              <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-500">
                <span>Page {page} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-github-dark-border disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-github-dark-border disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FCM Push Tokens Tab */}
        {activeTab === 'fcm' && (
          <div className="space-y-3">
            {fcmLoading ? (
              <div className="py-20 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-xs">Loading FCM tokens...</p>
              </div>
            ) : fcmTokens.length === 0 ? (
              <div className="py-16 text-center text-slate-400 bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border p-6">
                <Smartphone size={32} className="mx-auto mb-2 opacity-40" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No FCM tokens found</p>
              </div>
            ) : (
              fcmTokens.map((fcm) => (
                <div
                  key={fcm.id}
                  className="bg-white dark:bg-dark-card p-3.5 rounded-2xl border border-slate-200 dark:border-github-dark-border space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{fcm.user_name}</span>
                      <span className="text-[11px] text-slate-400">{fcm.org_name}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">
                      {fcm.device_type}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] bg-slate-50 dark:bg-github-dark-subtle p-2 rounded-lg text-slate-500 break-all">
                    {fcm.token_preview}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">Updated {formatDate(fcm.updated_at)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        openConfirmModal({
                          title: 'Delete FCM Token',
                          message: `Delete push notification token for ${fcm.user_name}?`,
                          actionType: 'delete_fcm',
                          payload: fcm.id,
                          requireTyping: false
                        })
                      }
                      className="text-rose-600 font-bold text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal: Inspect Details */}
        {inspectSession && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-github-dark-border pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Session Telemetry</h3>
                <button onClick={() => setInspectSession(null)} className="p-1 text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-github-dark-subtle">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">User</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm block">
                    {inspectSession.user?.user_name}
                  </span>
                  <span className="text-slate-500">{inspectSession.user?.email}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-subtle">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Client</span>
                    <span className="font-bold">{inspectSession.device?.browser}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-subtle">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">OS</span>
                    <span className="font-bold">{inspectSession.device?.os} {inspectSession.device?.os_version}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-subtle">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">IP Address</span>
                    <span className="font-mono font-bold">{inspectSession.ip_address}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-subtle">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Remember Me</span>
                    <span className="font-bold">{inspectSession.remember_me ? '30 Days' : 'Session'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">User Agent Header</span>
                  <p className="font-mono text-[10px] bg-slate-900 text-slate-300 p-2.5 rounded-xl break-all">
                    {inspectSession.device?.raw}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const uid = inspectSession.user_id;
                    const uName = inspectSession.user?.user_name;
                    setInspectSession(null);
                    openConfirmModal({
                      title: 'Force Logout Everywhere',
                      message: `Invalidate all active sessions and refresh tokens for ${uName}?`,
                      actionType: 'revoke_user',
                      payload: uid,
                      requireTyping: true,
                      typingWord: 'REVOKE'
                    });
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400"
                >
                  Logout User All Devices
                </button>
                <button
                  type="button"
                  disabled={inspectSession.status === 'revoked'}
                  onClick={() => {
                    const sid = inspectSession.id;
                    setInspectSession(null);
                    openConfirmModal({
                      title: 'Revoke This Session',
                      message: 'Revoke this session token immediately?',
                      actionType: 'revoke_single',
                      payload: sid,
                      requireTyping: false
                    });
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-rose-600 text-white disabled:opacity-40"
                >
                  Revoke Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirm Action */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-3xl p-5 space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle size={20} />
              </div>
              <div className="text-center space-y-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{confirmModal.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{confirmModal.message}</p>
              </div>

              {/* Typing Confirmation for Major Steps */}
              {confirmModal.requireTyping && (
                <div className="space-y-2 pt-1 text-left">
                  <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
                    To proceed, please type <span className="font-mono font-black text-rose-600 dark:text-rose-400 select-all">{confirmModal.typingWord || 'REVOKE'}</span> below:
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
                        handleConfirmAction();
                      }
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeConfirmModal}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    confirmModal.requireTyping &&
                    confirmInputText.trim().toUpperCase() !== (confirmModal.typingWord || 'REVOKE').toUpperCase()
                  }
                  onClick={handleConfirmAction}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MobileDashboardLayout>
  );
}
