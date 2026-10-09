import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { ShieldAlert, Search, Loader2, CheckCircle, Clock } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import LoadingScreen from '../../components/LoadingScreen';
import { formatPlatformDate } from '../../utils/dateUtils';

const SecurityAlertsMobile = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/super-admin/monitor/alerts');
      setAlerts(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch security alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.put(`/super-admin/monitor/alerts/${id}`, { status: 'resolved' });
      toast.success('Alert marked as resolved');
      setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resolve alert');
    }
  };

  const filteredAlerts = Array.isArray(alerts) ? alerts.filter(a => 
    (a.alert_type && a.alert_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (a.ip_address && a.ip_address.includes(searchQuery)) ||
    (a.user_name && a.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (a.org_name && a.org_name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) : [];

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high': 
        return <span className="px-2 py-0.5 text-[8px] font-black rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 uppercase tracking-widest border border-red-200/25">HIGH</span>;
      case 'medium': 
        return <span className="px-2 py-0.5 text-[8px] font-black rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 uppercase tracking-widest border border-amber-200/25">MED</span>;
      case 'low': 
        return <span className="px-2 py-0.5 text-[8px] font-black rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 uppercase tracking-widest border border-blue-200/25">LOW</span>;
      default: 
        return <span className="px-2 py-0.5 text-[8px] font-black rounded bg-slate-100 text-slate-705 dark:bg-github-dark-subtle dark:text-github-dark-muted uppercase tracking-widest">{severity}</span>;
    }
  };

  return (
    <MobileDashboardLayout title="Security Alerts">
      <div className="space-y-4 pb-20">
        
        {/* Sticky Search bar */}
        <div className="sticky top-16 -mx-4 px-4 py-3 bg-slate-50 dark:bg-black z-20 transition-all duration-300">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search IP, User, Org..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl shadow-sm text-sm text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
            />
          </div>
        </div>

        {/* Alerts List */}
        <div className="relative min-h-[60vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-400 animate-pulse">Scanning alerts...</p>
            </div>
          ) : filteredAlerts.length > 0 ? (
            <div className="space-y-3 pb-10">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white dark:bg-github-dark-subtle p-4 rounded-3xl border border-slate-100 dark:border-github-dark-border shadow-sm flex flex-col gap-3.5 relative overflow-hidden"
                >
                  <div className="absolute -right-4 -top-4 w-12 h-12 bg-red-500/5 blur-2xl rounded-full" />
                  
                  <div className="flex items-center justify-between gap-2 border-b border-slate-50 dark:border-white/5 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {getSeverityBadge(alert.severity)}
                      <span className="font-bold text-slate-805 dark:text-github-dark-text text-[13px] truncate">{alert.alert_type}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 dark:text-github-dark-muted font-mono">{formatPlatformDate(alert.created_at)}</span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 dark:text-github-dark-muted leading-relaxed font-poppins">{alert.description || 'No description provided'}</p>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                        <span className="text-slate-400 block uppercase tracking-wider mb-0.5 text-[8px] font-black">Target</span>
                        <span className="font-bold text-slate-800 dark:text-white truncate block">{alert.user_name || 'System / Auto'}</span>
                        {alert.org_name && <span className="text-slate-500 truncate block text-[9px] mt-0.5">{alert.org_name}</span>}
                      </div>

                      <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                        <span className="text-slate-400 block uppercase tracking-wider mb-0.5 text-[8px] font-black">IP Address</span>
                        <span className="font-bold font-mono text-slate-800 dark:text-white block truncate mt-0.5">{alert.ip_address || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-50 dark:border-white/5 mt-0.5">
                    <div className="text-[10px] text-slate-400">
                      Time: <span className="font-semibold text-slate-650 dark:text-slate-350">{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div>
                      {alert.status === 'resolved' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                          <CheckCircle size={12} /> Resolved
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                            <Clock size={12} /> Open
                          </span>
                          <button
                            onClick={() => handleResolve(alert.id)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-indigo-100 dark:border-white/5 transition-colors"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-github-dark-subtle rounded-[2rem] flex items-center justify-center mb-5 border border-slate-200/50 dark:border-white/5">
                <ShieldAlert size={28} className="text-slate-300 dark:text-github-dark-muted" />
              </div>
              <h3 className="text-base font-black text-slate-805 mb-1">No security alerts</h3>
              <p className="text-xs text-slate-500">System registers no active alerts matching query filters.</p>
            </div>
          )}
        </div>

      </div>
    </MobileDashboardLayout>
  );
};

export default SecurityAlertsMobile;
