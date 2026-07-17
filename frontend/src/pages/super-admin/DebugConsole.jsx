import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { 
  Terminal, Search, Filter, ShieldAlert, AlertTriangle, 
  Info, Cpu, Server, Check, RefreshCw, X, Eye, Play, Calendar
} from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';

const DebugConsole = () => {
  // Filters & State
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Filter params
  const [type, setType] = useState('all'); // all, api_failures, errors, client_errors
  const [platform, setPlatform] = useState(''); // '', WEB, MOBILE_APP
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [orgId, setOrgId] = useState('');

  // Selected Log for detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs(1, true);
  }, [type, platform]); // Refetch on dropdown changes immediately

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1, true);
  };

  const fetchLogs = async (pageNum = 1, shouldReset = false) => {
    try {
      if (shouldReset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const params = {
        page: pageNum,
        limit: 30,
        type,
        platform: platform || undefined,
        search: search || undefined,
        userId: userId || undefined,
        orgId: orgId || undefined
      };

      const response = await api.get('/super-admin/monitor/debug-logs', { params });

      if (response.data?.status === 'success') {
        const newLogs = response.data.data;
        const pagination = response.data.pagination;

        if (shouldReset) {
          setLogs(newLogs);
        } else {
          setLogs(prev => [...prev, ...newLogs]);
        }

        setPage(pagination.page);
        setTotalPages(pagination.pages);
        setTotalLogs(pagination.total);
      }
    } catch (error) {
      console.error("Error fetching debug logs:", error);
      toast.error("Failed to load diagnostic logs");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (page < totalPages) {
      fetchLogs(page + 1, false);
    }
  };

  const resetFilters = () => {
    setType('all');
    setPlatform('');
    setSearch('');
    setUserId('');
    setOrgId('');
    fetchLogs(1, true);
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString();
    } catch (_) {
      return dateStr;
    }
  };

  const getStatusBadge = (log) => {
    const isErrorLog = log.level !== undefined; // sys_error_logs vs sys_api_logs
    if (isErrorLog) {
      if (log.level === 'CLIENT_ERROR') {
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">
            <Cpu size={12} /> Client Error
          </span>
        );
      }
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 w-fit">
          <ShieldAlert size={12} /> Server Error 500
        </span>
      );
    }

    const code = Number(log.status_code);
    if (code >= 500) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 w-fit">
          {code} Server Error
        </span>
      );
    } else if (code >= 400) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 w-fit">
          {code} Client Error
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 w-fit">
        {code} Success
      </span>
    );
  };

  return (
    <DashboardLayout title="Diagnostics & Debug Console">
      <div className="space-y-6">
        
        {/* Header Block & Total Counter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200/10 backdrop-blur-md">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Terminal className="text-indigo-400 animate-pulse" /> Diagnostics Console
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Search and filter client-side errors, API failures, and server crashes by Org, User, and Platform.
            </p>
          </div>
          <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/50">
            <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Total Logs</span>
            <span className="text-xl font-bold text-indigo-300">{totalLogs}</span>
          </div>
        </div>

        {/* Filter Box */}
        <form onSubmit={handleSearchSubmit} className="bg-slate-900/40 p-6 rounded-2xl border border-slate-200/10 backdrop-blur-md space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Search query */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Search logs</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Error, path, IP, OS..." 
                  className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            {/* Log Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Log Type</label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All API Failures (4xx / 5xx)</option>
                <option value="errors">Server Exceptions (500)</option>
                <option value="client_errors">Client-Side Crashes</option>
              </select>
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform</label>
              <select 
                value={platform} 
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">All Platforms</option>
                <option value="WEB">Web App (WEB)</option>
                <option value="MOBILE_APP">Mobile App (MOBILE_APP)</option>
              </select>
            </div>

            {/* User ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">User ID</label>
              <input 
                type="number" 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Filter by User ID" 
                className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Org ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Org ID</label>
              <input 
                type="number" 
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Filter by Org ID" 
                className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={resetFilters} 
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Reset Filters
            </button>
            <button 
              type="submit" 
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-sm font-semibold text-white rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/10"
            >
              <Filter size={16} /> Apply Filters
            </button>
          </div>
        </form>

        {/* Logs Table */}
        <div className="bg-slate-900/40 rounded-2xl border border-slate-200/10 backdrop-blur-md overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-20 flex justify-center items-center">
              <RefreshCw size={24} className="text-indigo-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center space-y-3">
              <Terminal size={40} className="text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-300">No logs found</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                No request audits or exceptions matched the selected filter configuration.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80">
                    <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Timestamp</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Severity / Code</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">User (ID)</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organization (ID)</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Request Path</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((log, idx) => {
                    const isError = log.level !== undefined;
                    const platformVal = isError 
                      ? (log.service_name === 'frontend-mobile' ? 'MOBILE_APP' : 'WEB')
                      : log.event_source;

                    return (
                      <tr key={log.error_id || log.api_log_id || idx} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3.5 px-6 text-sm text-slate-300 whitespace-nowrap">
                          {formatTimestamp(log.occurred_at)}
                        </td>
                        <td className="py-3.5 px-6">
                          {getStatusBadge(log)}
                        </td>
                        <td className="py-3.5 px-6 text-sm">
                          {log.user_name ? (
                            <div>
                              <div className="text-white font-medium">{log.user_name}</div>
                              <div className="text-slate-500 text-xs">ID: {log.user_id}</div>
                            </div>
                          ) : log.user_id ? (
                            <span className="text-slate-400 font-semibold">User ID: {log.user_id}</span>
                          ) : (
                            <span className="text-slate-600">Guest</span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-sm">
                          {log.org_name ? (
                            <div>
                              <div className="text-white font-medium">{log.org_name}</div>
                              <div className="text-slate-500 text-xs">ID: {log.org_id}</div>
                            </div>
                          ) : log.org_id ? (
                            <span className="text-slate-400 font-semibold">Org ID: {log.org_id}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            platformVal === 'MOBILE_APP' 
                              ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' 
                              : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                          }`}>
                            {platformVal === 'MOBILE_APP' ? 'MOBILE' : 'WEB'}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-sm text-slate-300 font-mono break-all max-w-xs">
                          {!isError && (
                            <span className="text-indigo-400 mr-1.5 font-bold">{log.method}</span>
                          )}
                          {log.request_path}
                        </td>
                        <td className="py-3.5 px-6 text-sm">
                          <button 
                            onClick={() => setSelectedLog(log)}
                            className="bg-slate-800 hover:bg-slate-700 text-indigo-400 p-2 rounded-lg transition-colors border border-slate-700"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Load More Button */}
          {page < totalPages && !loading && (
            <div className="p-4 border-t border-slate-800 text-center">
              <button 
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:opacity-50 text-sm font-semibold text-white rounded-xl transition-all border border-slate-700/80 inline-flex items-center gap-2"
              >
                {loadingMore ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Play size={16} className="rotate-90" />
                )}
                Load More Logs
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div className="flex items-center gap-3">
                <Terminal className="text-indigo-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Log Diagnostic details</h3>
                  <span className="text-xs text-slate-400 font-mono">{selectedLog.error_id ? `Error ID: ${selectedLog.error_id}` : `API Log ID: ${selectedLog.api_log_id || 'N/A'}`}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
              
              {/* Top diagnostic metadata grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Meta item 1 */}
                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/20">
                  <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider mb-1.5">Request Details</span>
                  <div className="space-y-1">
                    <div><span className="text-slate-500">Method:</span> <span className="font-mono text-indigo-300 font-bold">{selectedLog.method || 'CLIENT_CRASH'}</span></div>
                    <div><span className="text-slate-500">Path:</span> <span className="font-mono break-all text-white">{selectedLog.request_path}</span></div>
                    {selectedLog.duration_ms !== undefined && (
                      <div><span className="text-slate-500">Latency:</span> <span className="text-emerald-300 font-semibold">{selectedLog.duration_ms} ms</span></div>
                    )}
                    <div><span className="text-slate-500">Occurred:</span> <span>{formatTimestamp(selectedLog.occurred_at)}</span></div>
                  </div>
                </div>

                {/* Meta item 2 */}
                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/20">
                  <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider mb-1.5">Client Context</span>
                  <div className="space-y-1">
                    {selectedLog.level ? (
                      // Error logs extra_context parsing
                      (() => {
                        let parsedCtx = {};
                        try {
                          parsedCtx = typeof selectedLog.extra_context === 'string' 
                            ? JSON.parse(selectedLog.extra_context) 
                            : (selectedLog.extra_context || {});
                        } catch (_) {}
                        return (
                          <>
                            <div><span className="text-slate-500">OS:</span> <span className="text-white">{parsedCtx.client_os || 'Unknown OS'}</span></div>
                            <div><span className="text-slate-500">Platform:</span> <span className="text-white">{parsedCtx.platform || 'WEB'}</span></div>
                            <div><span className="text-slate-500">User Agent:</span> <span className="text-slate-400 text-xs block font-mono truncate" title={parsedCtx.userAgent}>{parsedCtx.userAgent || 'Unknown'}</span></div>
                          </>
                        );
                      })()
                    ) : (
                      // API logs fields
                      <>
                        <div><span className="text-slate-500">Device/OS:</span> <span className="text-white">{selectedLog.device_type} ({selectedLog.client_os})</span></div>
                        <div><span className="text-slate-500">Client Type:</span> <span className="text-white">{selectedLog.client_type}</span></div>
                        <div><span className="text-slate-500">Client IP:</span> <span className="text-white font-mono">{selectedLog.request_ip || 'N/A'}</span></div>
                      </>
                    )}
                  </div>
                </div>

              </div>

              {/* Error Message Section */}
              {selectedLog.error_message && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Error Message</h4>
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 p-4 rounded-xl font-mono text-xs break-words">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {/* Stack Trace Section for Server / Client Errors */}
              {selectedLog.stack_trace && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stack Trace</h4>
                  <pre className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-rose-400/90 overflow-x-auto max-h-60 whitespace-pre-wrap break-all border border-slate-800">
                    {selectedLog.stack_trace}
                  </pre>
                </div>
              )}

              {/* Payload Data for API Logs */}
              {!selectedLog.level && selectedLog.payload_details && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Request Payload Details</h4>
                  <pre className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-indigo-300 overflow-x-auto max-h-60 border border-slate-800">
                    {(() => {
                      try {
                        const parsed = typeof selectedLog.payload_details === 'string'
                          ? JSON.parse(selectedLog.payload_details)
                          : selectedLog.payload_details;
                        return JSON.stringify(parsed, null, 2);
                      } catch (e) {
                        return selectedLog.payload_details;
                      }
                    })()}
                  </pre>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 flex justify-end bg-slate-950/60">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white rounded-xl transition-all"
              >
                Close Diagnostic View
              </button>
            </div>

          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default DebugConsole;
