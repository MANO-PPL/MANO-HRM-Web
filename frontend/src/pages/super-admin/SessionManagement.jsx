import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api, { removeCacheByUrl } from '../../services/api';
import { toast } from 'react-toastify';
import {
  Smartphone,
  Laptop,
  Tablet,
  Terminal,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  UserX,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Eye,
  Check,
  Building,
  User,
  Activity,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Key,
  Globe,
  Monitor,
  Flame,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Lock,
  LogOut,
  SlidersHorizontal,
  X
} from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';

export default function SessionManagement() {
  // Tabs: 'sessions' | 'fcm'
  const [activeTab, setActiveTab] = useState('sessions');

  // Sessions state
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
  const [organizations, setOrganizations] = useState([]);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [deviceType, setDeviceType] = useState('all');
  const [browser, setBrowser] = useState('all');
  const [os, setOs] = useState('all');
  const [userType, setUserType] = useState('all');
  const [orgId, setOrgId] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Modals & Details
  const [inspectSession, setInspectSession] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    actionType: null, // 'revoke_single' | 'revoke_bulk' | 'revoke_user' | 'cleanup_expired' | 'delete_fcm'
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

  // Copied indicator helper
  const [copiedKey, setCopiedKey] = useState(null);

  // FCM Tokens Tab State
  const [fcmTokens, setFcmTokens] = useState([]);
  const [fcmLoading, setFcmLoading] = useState(false);
  const [fcmPage, setFcmPage] = useState(1);
  const [fcmTotal, setFcmTotal] = useState(0);
  const [fcmTotalPages, setFcmTotalPages] = useState(1);
  const [fcmSearch, setFcmSearch] = useState('');
  const [fcmDeviceType, setFcmDeviceType] = useState('all');

  // Initial load
  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions(page);
    } else {
      fetchFcmTokens(fcmPage);
    }
  }, [activeTab, page, limit, status, deviceType, browser, os, userType, orgId, sortBy, sortOrder]);

  // Copy to clipboard
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard!', { autoClose: 1500 });
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Fetch Sessions
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
        limit,
        search: activeSearch.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        device_type: deviceType !== 'all' ? deviceType : undefined,
        browser: browser !== 'all' ? browser : undefined,
        os: os !== 'all' ? os : undefined,
        user_type: userType !== 'all' ? userType : undefined,
        org_id: orgId !== 'all' ? orgId : undefined,
        sortBy,
        sortOrder,
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
        if (res.data.organizations) {
          setOrganizations(res.data.organizations);
        }
      }
      if (isManual) {
        toast.success('Session data refreshed successfully', { autoClose: 1800 });
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch FCM Device Tokens
  const fetchFcmTokens = async (pageNum = 1, isManual = false, overrideSearch = null) => {
    try {
      if (isManual) {
        setRefreshing(true);
      } else {
        setFcmLoading(true);
      }

      removeCacheByUrl('device-tokens');

      const activeSearch = overrideSearch !== null ? overrideSearch : fcmSearch;

      const params = {
        page: pageNum,
        limit: 20,
        search: activeSearch.trim() || undefined,
        device_type: fcmDeviceType !== 'all' ? fcmDeviceType : undefined,
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
        if (res.data.pagination) {
          setFcmPage(res.data.pagination.page);
          setFcmTotal(res.data.pagination.total);
          setFcmTotalPages(res.data.pagination.totalPages);
        }
      }
      if (isManual) {
        toast.success('Device push tokens refreshed', { autoClose: 1800 });
      }
    } catch (err) {
      console.error('Failed to load device tokens:', err);
      toast.error('Failed to load FCM device tokens');
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

  const handleResetFilters = () => {
    setSearch('');
    setStatus('all');
    setDeviceType('all');
    setBrowser('all');
    setOs('all');
    setUserType('all');
    setOrgId('all');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
    fetchSessions(1, false, '');
  };

  // Manual Refresh
  const handleRefresh = async () => {
    if (activeTab === 'sessions') {
      await fetchSessions(page, true);
    } else {
      await fetchFcmTokens(fcmPage, true);
    }
  };

  // Select all checkbox
  const isAllSelected = useMemo(() => {
    if (sessions.length === 0) return false;
    return sessions.every((s) => selectedIds.has(s.id));
  }, [sessions, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      sessions.forEach((s) => next.add(s.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Action Executors
  const executeRevokeSingle = async (id) => {
    try {
      const res = await api.post(`/super-admin/sessions/${id}/revoke`);
      toast.success(res.data?.message || 'Session revoked successfully');
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, revoked: true, status: 'revoked', is_active_session: false } : s
        )
      );
      if (inspectSession?.id === id) {
        setInspectSession((prev) =>
          prev ? { ...prev, revoked: true, status: 'revoked', is_active_session: false } : null
        );
      }
      fetchSessions(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke session');
    }
  };

  const executeBulkRevoke = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await api.post('/super-admin/sessions/bulk-revoke', { ids });
      toast.success(res.data?.message || `${ids.length} sessions revoked`);
      setSelectedIds(new Set());
      fetchSessions(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to bulk revoke sessions');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const executeRevokeAllUser = async (userId) => {
    try {
      const res = await api.post(`/super-admin/sessions/user/${userId}/revoke-all`);
      toast.success(res.data?.message || 'All user sessions revoked');
      fetchSessions(page);
      if (inspectSession?.user?.user_id === userId) {
        setInspectSession(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke user sessions');
    }
  };

  const executeCleanupExpired = async () => {
    try {
      const res = await api.post('/super-admin/sessions/cleanup-expired');
      toast.success(res.data?.message || 'Expired sessions cleaned up');
      fetchSessions(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cleanup expired sessions');
    }
  };

  const executeDeleteFcmToken = async (id) => {
    try {
      await api.delete(`/super-admin/device-tokens/${id}`);
      toast.success('FCM Device Token removed');
      setFcmTokens((prev) => prev.filter((t) => t.id !== id));
      setFcmTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove device token');
    }
  };

  const handleConfirmAction = () => {
    const { actionType, payload } = confirmModal;
    closeConfirmModal();
    if (actionType === 'revoke_single') {
      executeRevokeSingle(payload);
    } else if (actionType === 'revoke_bulk') {
      executeBulkRevoke();
    } else if (actionType === 'revoke_user') {
      executeRevokeAllUser(payload);
    } else if (actionType === 'cleanup_expired') {
      executeCleanupExpired();
    } else if (actionType === 'delete_fcm') {
      executeDeleteFcmToken(payload);
    }
  };

  // Device Icon helper
  const getDeviceIcon = (device) => {
    if (device?.is_mobile) return <Smartphone size={16} className="text-amber-500" />;
    if (device?.is_tablet) return <Tablet size={16} className="text-purple-500" />;
    if (device?.is_api) return <Terminal size={16} className="text-emerald-500" />;
    return <Laptop size={16} className="text-blue-500" />;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return dateStr;
    }
  };

  // Time remaining
  const getTimeRemaining = (dateStr) => {
    if (!dateStr) return '';
    try {
      const now = new Date();
      const target = new Date(dateStr);
      const diffMs = target - now;
      if (diffMs <= 0) return 'Expired';
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 1) return `${diffDays} days left`;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours > 0) return `${diffHours} hours left`;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} mins left`;
    } catch (_) {
      return '';
    }
  };

  return (
    <DashboardLayout title="Session & Token Management">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        
        {/* Top Header Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 dark:from-dark-card dark:via-dark-card dark:to-indigo-950/20 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-github-dark-border shadow-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/30 mb-3">
                <ShieldCheck size={14} className="animate-pulse" />
                <span>Security Operations & Access Control</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                Session & Device Management
              </h1>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
                Live monitoring of authenticated user sessions, refresh tokens, active devices, and push notification tokens. Instantly revoke compromised access across web and mobile.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-github-dark-subtle text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-github-dark-border hover:bg-slate-50 dark:hover:bg-github-dark-border/80 shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              <button
                onClick={() =>
                  openConfirmModal({
                    title: 'Cleanup Expired Sessions',
                    message:
                      'This will mark all past-due sessions as revoked and free up system resources. Active sessions will not be affected.',
                    actionType: 'cleanup_expired',
                    payload: null,
                    requireTyping: true,
                    typingWord: 'REVOKE'
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-indigo-500/25 transition-all active:scale-95"
              >
                <Flame size={16} />
                <span>Cleanup Expired</span>
              </button>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: Active Sessions */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-xs hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-all group">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Active</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.active.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Live authenticated</span>
          </div>

          {/* Card 2: Total Sessions */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total</span>
              <Key size={16} className="text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {stats.total.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Issued tokens</span>
          </div>

          {/* Card 3: Mobile Sessions */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-xs hover:border-amber-300 dark:hover:border-amber-500/50 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Mobile App</span>
              <Smartphone size={16} className="text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.mobile.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Flutter & Android/iOS</span>
          </div>

          {/* Card 4: Desktop Web */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-xs hover:border-blue-300 dark:hover:border-blue-500/50 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Desktop</span>
              <Laptop size={16} className="text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">
              {stats.desktop.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Web browsers</span>
          </div>

          {/* Card 5: Unique Users */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-xs hover:border-violet-300 dark:hover:border-violet-500/50 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Online Users</span>
              <User size={16} className="text-violet-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-violet-600 dark:text-violet-400">
              {stats.unique_active_users.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Unique accounts</span>
          </div>

          {/* Card 6: Revoked / Expired */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-xs hover:border-rose-300 dark:hover:border-rose-500/50 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Revoked/Exp</span>
              <ShieldAlert size={16} className="text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
              {(stats.revoked + stats.expired).toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              {stats.revoked} rev · {stats.expired} exp
            </span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-github-dark-border pb-3">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'sessions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-github-dark-subtle'
            }`}
          >
            <Key size={16} />
            <span>Active Sessions & Tokens</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                activeTab === 'sessions'
                  ? 'bg-indigo-700/60 text-indigo-100'
                  : 'bg-slate-200 dark:bg-github-dark-border text-slate-700 dark:text-slate-300'
              }`}
            >
              {total.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('fcm')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'fcm'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-github-dark-subtle'
            }`}
          >
            <Smartphone size={16} />
            <span>Device Push Tokens (FCM)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                activeTab === 'fcm'
                  ? 'bg-indigo-700/60 text-indigo-100'
                  : 'bg-slate-200 dark:bg-github-dark-border text-slate-700 dark:text-slate-300'
              }`}
            >
              {fcmTotal.toLocaleString()}
            </span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: SESSIONS & REFRESH TOKENS                         */}
        {/* ======================================================== */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            
            {/* Filter and Search Toolbar */}
            <div className="bg-white dark:bg-dark-card p-5 rounded-3xl border border-slate-200 dark:border-github-dark-border shadow-xs space-y-4">
              
              {/* Row 1: Search & Quick Status Tabs */}
              <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                
                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="relative flex-1 flex items-center">
                  <div className="relative w-full">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by User Name, Code, Email, Org, IP, Device, or Token prefix..."
                      className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2.5 pl-10 pr-24 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {search && (
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          title="Clear search"
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
                        >
                          <X size={15} />
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95"
                      >
                        Search
                      </button>
                    </div>
                  </div>
                </form>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-github-dark-subtle rounded-xl shrink-0 overflow-x-auto">
                  {[
                    { id: 'all', label: 'All Sessions' },
                    { id: 'active', label: 'Active' },
                    { id: 'revoked', label: 'Revoked' },
                    { id: 'expired', label: 'Expired' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatus(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        status === tab.id
                          ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Dropdown Filters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100 dark:border-github-dark-border/60">
                
                {/* Device Type */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Device</label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2 px-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">All Devices</option>
                    <option value="desktop">Desktop PC / Mac</option>
                    <option value="mobile">Mobile (App & Web)</option>
                    <option value="tablet">Tablet / iPad</option>
                    <option value="api_client">API Clients (Postman/cURL)</option>
                  </select>
                </div>

                {/* Operating System */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">OS</label>
                  <select
                    value={os}
                    onChange={(e) => setOs(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2 px-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">All OS</option>
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                    <option value="android">Android</option>
                    <option value="ios">iOS / iPhone</option>
                    <option value="linux">Linux</option>
                  </select>
                </div>

                {/* Browser */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Browser / App</label>
                  <select
                    value={browser}
                    onChange={(e) => setBrowser(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2 px-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">All Clients</option>
                    <option value="mobile_app">Mobile App (Flutter)</option>
                    <option value="chrome">Google Chrome</option>
                    <option value="edge">Microsoft Edge</option>
                    <option value="safari">Apple Safari</option>
                    <option value="firefox">Mozilla Firefox</option>
                    <option value="opera">Opera</option>
                  </select>
                </div>

                {/* User Type */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</label>
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2 px-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="hr">HR</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>

                {/* Organization */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Organization</label>
                  <select
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2 px-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 cursor-pointer truncate"
                  >
                    <option value="all">All Organizations</option>
                    {organizations.map((org) => (
                      <option key={org.org_id} value={org.org_id}>
                        {org.org_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reset Action */}
                <div className="space-y-1 flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border transition-colors flex items-center justify-center gap-1.5"
                  >
                    <SlidersHorizontal size={14} />
                    <span>Reset Filters</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Action Banner */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3.5 px-5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {selectedIds.size}
                  </div>
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                    {selectedIds.size} session{selectedIds.size > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-dark-card transition-colors"
                  >
                    Deselect
                  </button>
                  <button
                    type="button"
                    disabled={bulkActionLoading}
                    onClick={() =>
                      openConfirmModal({
                        title: 'Revoke Selected Sessions',
                        message: `Are you sure you want to revoke ${selectedIds.size} selected session(s)? Affected users will be logged out immediately.`,
                        actionType: 'revoke_bulk',
                        payload: null,
                        requireTyping: true,
                        typingWord: 'REVOKE'
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Revoke Selected</span>
                  </button>
                </div>
              </div>
            )}

            {/* Main Table Card */}
            <div className="bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-github-dark-border shadow-xs overflow-hidden">
              {loading && !refreshing ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                  <RefreshCw size={32} className="animate-spin text-indigo-500 mb-3" />
                  <p className="text-sm font-medium">Loading session telemetry...</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-20 text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-github-dark-subtle text-slate-400 flex items-center justify-center mx-auto mb-4">
                    <Key size={28} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No sessions found</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Try adjusting your filters, searching for a different username or IP, or clearing your search query.
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="mt-4 px-4 py-2 text-xs font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors"
                  >
                    Reset all filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-github-dark-border bg-slate-50/75 dark:bg-github-dark-subtle text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={toggleSelectAll}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3.5 px-4">User & Organization</th>
                        <th className="py-3.5 px-4">Device & Client</th>
                        <th className="py-3.5 px-4">IP Address</th>
                        <th className="py-3.5 px-4">Token Preview</th>
                        <th className="py-3.5 px-4">Status & Validity</th>
                        <th className="py-3.5 px-4">Created</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-github-dark-border text-sm">
                      {sessions.map((session) => {
                        const isSelected = selectedIds.has(session.id);
                        return (
                          <tr
                            key={session.id}
                            className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-github-dark-subtle/40 ${
                              isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3.5 px-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(session.id)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>

                            {/* User & Org */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                {session.user?.profile_image_url ? (
                                  <img
                                    src={session.user.profile_image_url}
                                    alt={session.user.user_name}
                                    className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-github-dark-border shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                    {(session.user?.user_name || 'U').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white truncate">
                                      {session.user?.user_name || 'Unknown'}
                                    </span>
                                    <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-100 dark:bg-github-dark-border text-slate-600 dark:text-slate-300">
                                      {session.user?.user_type}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                                    <span>{session.organization?.org_name || 'No Org'}</span>
                                    <span>•</span>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      {session.user?.user_code}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Device & Client */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-slate-100 dark:bg-github-dark-subtle shrink-0">
                                  {getDeviceIcon(session.device)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                    <span>{session.device?.browser || 'Browser'}</span>
                                    {session.device?.browser_version && (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        v{session.device.browser_version}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                    <span className="font-medium">{session.device?.os}</span>
                                    {session.device?.os_version && (
                                      <span>{session.device.os_version}</span>
                                    )}
                                    <span>•</span>
                                    <span className="capitalize">{session.device?.device_type}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* IP Address */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-github-dark-subtle px-2 py-1 rounded-md border border-slate-200/60 dark:border-github-dark-border/60">
                                  {session.ip_address}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(session.ip_address, `ip_${session.id}`)}
                                  title="Copy IP"
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  {copiedKey === `ip_${session.id}` ? (
                                    <Check size={14} className="text-emerald-500" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Token Preview */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-github-dark-border/40 px-2 py-1 rounded">
                                  {session.token_preview}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(session.token, `token_${session.id}`)}
                                  title="Copy full token"
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  {copiedKey === `token_${session.id}` ? (
                                    <Check size={14} className="text-emerald-500" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                                {session.remember_me && (
                                  <span
                                    title="Persistent Session (Remember Me)"
                                    className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 uppercase"
                                  >
                                    30D
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status & Validity */}
                            <td className="py-3.5 px-4">
                              {session.status === 'active' ? (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Active
                                  </span>
                                  <span className="block text-[11px] text-slate-400 mt-0.5">
                                    {getTimeRemaining(session.expires_at)}
                                  </span>
                                </div>
                              ) : session.status === 'revoked' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                                  <XCircle size={12} />
                                  Revoked
                                </span>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-github-dark-border dark:text-slate-300">
                                    <Clock size={12} />
                                    Expired
                                  </span>
                                  <span className="block text-[11px] text-slate-400 mt-0.5">
                                    Expired
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Created Timestamp */}
                            <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {formatDate(session.created_at)}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Inspect button */}
                                <button
                                  type="button"
                                  onClick={() => setInspectSession(session)}
                                  title="Inspect Device & Session Telemetry"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-github-dark-subtle transition-colors"
                                >
                                  <Eye size={16} />
                                </button>

                                {/* Revoke single */}
                                <button
                                  type="button"
                                  disabled={session.status === 'revoked'}
                                  onClick={() =>
                                    openConfirmModal({
                                      title: 'Revoke User Session',
                                      message: `Are you sure you want to terminate this active session for ${session.user?.user_name}? They will be forced to log in again on this device.`,
                                      actionType: 'revoke_single',
                                      payload: session.id,
                                      requireTyping: false
                                    })
                                  }
                                  title={session.status === 'revoked' ? 'Session already revoked' : 'Revoke Session'}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    session.status === 'revoked'
                                      ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                      : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                  }`}
                                >
                                  <LogOut size={16} />
                                </button>

                                {/* Revoke all for user */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    openConfirmModal({
                                      title: `Revoke All Sessions for ${session.user?.user_name}`,
                                      message: `This will invalidate ALL active sessions and refresh tokens for user ${session.user?.user_name} across all devices and browsers immediately.`,
                                      actionType: 'revoke_user',
                                      payload: session.user_id,
                                      requireTyping: true,
                                      typingWord: 'REVOKE'
                                    })
                                  }
                                  title="Force Logout User on All Devices"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                                >
                                  <UserX size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              {sessions.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 px-6 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/30 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>
                      Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total.toLocaleString()} sessions
                    </span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg py-1 px-2 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                    >
                      <option value={10}>10 / page</option>
                      <option value={20}>20 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-github-dark-border bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-github-dark-subtle disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-github-dark-border bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-github-dark-subtle disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PUSH DEVICE TOKENS (FCM)                          */}
        {/* ======================================================== */}
        {activeTab === 'fcm' && (
          <div className="space-y-4">
            
            {/* FCM Filter Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-xs">
              <div className="relative flex-1 flex items-center">
                <div className="relative w-full">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={fcmSearch}
                    onChange={(e) => setFcmSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setFcmPage(1);
                        fetchFcmTokens(1, false, fcmSearch);
                      }
                    }}
                    placeholder="Search user, email, organization, or FCM token..."
                    className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2 pl-9 pr-24 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {fcmSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setFcmSearch('');
                          setFcmPage(1);
                          fetchFcmTokens(1, false, '');
                        }}
                        title="Clear search"
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFcmPage(1);
                        fetchFcmTokens(1, false, fcmSearch);
                      }}
                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={fcmDeviceType}
                  onChange={(e) => {
                    setFcmDeviceType(e.target.value);
                    setFcmPage(1);
                  }}
                  className="bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white outline-none"
                >
                  <option value="all">All Device Platforms</option>
                  <option value="android">Android Devices</option>
                  <option value="ios">Apple iOS Devices</option>
                  <option value="web">Web Browser Push</option>
                </select>

                <button
                  type="button"
                  onClick={() => fetchFcmTokens(1)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={fcmLoading ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* FCM Tokens Table */}
            <div className="bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-github-dark-border shadow-xs overflow-hidden">
              {fcmLoading ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                  <RefreshCw size={32} className="animate-spin text-indigo-500 mb-3" />
                  <p className="text-sm font-medium">Loading FCM device push tokens...</p>
                </div>
              ) : fcmTokens.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Smartphone size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">No registered device push tokens</p>
                  <p className="text-xs text-slate-500 mt-1">Mobile users who enable notifications will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-github-dark-border bg-slate-50/75 dark:bg-github-dark-subtle text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Organization</th>
                        <th className="py-3 px-4">Platform</th>
                        <th className="py-3 px-4">FCM Push Token</th>
                        <th className="py-3 px-4">Registered Date</th>
                        <th className="py-3 px-4">Last Updated</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-github-dark-border text-sm">
                      {fcmTokens.map((fcm) => (
                        <tr key={fcm.id} className="hover:bg-slate-50/80 dark:hover:bg-github-dark-subtle/40 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">{fcm.user_name || 'User'}</span>
                              <span className="text-xs text-slate-500">{fcm.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {fcm.org_name || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-slate-100 dark:bg-github-dark-border text-slate-700 dark:text-slate-300">
                              <Smartphone size={12} className="text-indigo-500" />
                              {fcm.device_type}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-github-dark-subtle px-2 py-0.5 rounded">
                                {fcm.token_preview}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(fcm.token, `fcm_${fcm.id}`)}
                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                {copiedKey === `fcm_${fcm.id}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                            {formatDate(fcm.created_at)}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                            {formatDate(fcm.updated_at)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                openConfirmModal({
                                  title: 'Deregister FCM Device Token',
                                  message: `Are you sure you want to delete this push token for ${fcm.user_name}? Push notifications will stop reaching this device until they relaunch the app.`,
                                  actionType: 'delete_fcm',
                                  payload: fcm.id,
                                  requireTyping: false
                                })
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* INSPECT SESSION & DEVICE TELEMETRY DRAWER / MODAL        */}
        {/* ======================================================== */}
        {inspectSession && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-dark-card w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-github-dark-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    {getDeviceIcon(inspectSession.device)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Session & Device Telemetry
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Token ID #{inspectSession.id} • Issued {formatDate(inspectSession.created_at)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectSession(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-github-dark-border transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto">
                
                {/* User Card */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-github-dark-subtle border border-slate-200/60 dark:border-github-dark-border/60">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                      {(inspectSession.user?.user_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">
                        {inspectSession.user?.user_name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {inspectSession.user?.email} • {inspectSession.user?.phone_no}
                      </p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                        {inspectSession.organization?.org_name} (Code: {inspectSession.user?.user_code})
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                      {inspectSession.user?.user_type}
                    </span>
                  </div>
                </div>

                {/* Device & Client Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Laptop size={14} />
                    <span>Client & Device Classification</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-github-dark-subtle border border-slate-200/60 dark:border-github-dark-border/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Device Class</span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                        {inspectSession.device?.device_type}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-github-dark-subtle border border-slate-200/60 dark:border-github-dark-border/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Operating System</span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {inspectSession.device?.os} {inspectSession.device?.os_version}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-github-dark-subtle border border-slate-200/60 dark:border-github-dark-border/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Browser / Engine</span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {inspectSession.device?.browser}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-github-dark-subtle border border-slate-200/60 dark:border-github-dark-border/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">IP Address</span>
                      <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {inspectSession.ip_address}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Raw User Agent */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe size={14} />
                      <span>Raw User-Agent String</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleCopy(inspectSession.device?.raw, 'raw_ua')}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                    >
                      {copiedKey === 'raw_ua' ? <Check size={12} /> : <Copy size={12} />}
                      <span>Copy Header</span>
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs break-all leading-relaxed select-all">
                    {inspectSession.device?.raw || 'No User-Agent provided'}
                  </div>
                </div>

                {/* Token Telemetry */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Key size={14} />
                      <span>Security & Token Details</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleCopy(inspectSession.token, 'full_token')}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                    >
                      {copiedKey === 'full_token' ? <Check size={12} /> : <Copy size={12} />}
                      <span>Copy Full Token</span>
                    </button>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-github-dark-subtle border border-slate-200/60 dark:border-github-dark-border/60 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Session Status</span>
                      <span className="font-bold capitalize">{inspectSession.status}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Persistent Cookie (Remember Me)</span>
                      <span className="font-bold">{inspectSession.remember_me ? 'Yes (30-day sliding)' : 'No (Session only)'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Issued Timestamp</span>
                      <span className="font-mono">{formatDate(inspectSession.created_at)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Expires At</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {formatDate(inspectSession.expires_at)} ({getTimeRemaining(inspectSession.expires_at)})
                      </span>
                    </div>
                    {inspectSession.replaced_by_token && (
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-github-dark-border">
                        <span className="text-amber-600 font-semibold">Rotated / Replaced By</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {inspectSession.replaced_by_token.substring(0, 16)}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 px-6 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/30">
                <button
                  type="button"
                  onClick={() => setInspectSession(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-github-dark-border transition-colors"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const uid = inspectSession.user_id;
                      const uName = inspectSession.user?.user_name;
                      setInspectSession(null);
                      openConfirmModal({
                        title: `Revoke All Sessions for ${uName}`,
                        message: `Force disconnect all devices and invalidate all tokens for user ${uName}?`,
                        actionType: 'revoke_user',
                        payload: uid,
                        requireTyping: true,
                        typingWord: 'REVOKE'
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    Logout User Everywhere
                  </button>

                  <button
                    type="button"
                    disabled={inspectSession.status === 'revoked'}
                    onClick={() => {
                      const sid = inspectSession.id;
                      setInspectSession(null);
                      openConfirmModal({
                        title: 'Revoke This Session',
                        message: 'Are you sure you want to revoke this session token?',
                        actionType: 'revoke_single',
                        payload: sid,
                        requireTyping: false
                      });
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    Revoke This Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CONFIRMATION DIALOG MODAL                                */}
        {/* ======================================================== */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-3xl border border-slate-200 dark:border-github-dark-border shadow-2xl p-6 space-y-4">
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
                <div className="space-y-2.5 pt-1">
                  <div className="p-3 rounded-2xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-left space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400 block">
                      Safety Verification Required
                    </span>
                    <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                      To prevent accidental revocation, please type <span className="font-mono font-black px-1.5 py-0.5 rounded bg-white dark:bg-dark-card border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 select-all tracking-wider">{confirmModal.typingWord || 'REVOKE'}</span> below:
                    </p>
                  </div>
                  <div className="space-y-1 text-left">
                    <input
                      type="text"
                      autoFocus
                      value={confirmInputText}
                      onChange={(e) => setConfirmInputText(e.target.value)}
                      placeholder={`Type ${confirmModal.typingWord || 'REVOKE'} to enable button`}
                      className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl py-2.5 px-3.5 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 uppercase transition-all"
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
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeConfirmModal}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-github-dark-subtle hover:bg-slate-200 dark:hover:bg-github-dark-border transition-colors"
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
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-600 shadow-sm hover:shadow-rose-500/25 transition-all"
                >
                  Confirm & Revoke
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
