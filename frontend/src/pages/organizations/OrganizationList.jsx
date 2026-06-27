import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Building, Plus, Loader2, Save, X, Search, Calendar, Shield, Activity, Clock, Users, Trash2, AlertTriangle, RotateCcw, Pencil, Terminal, Database, Filter, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import api from '../../services/api';
import { toast } from 'react-toastify';
import LoadingScreen from '../../components/LoadingScreen';
import MinimalSelect from '../../components/MinimalSelect';
import PhoneInput from '../../components/PhoneInput';
import { validatePhone, validateEmail } from '../../utils/validation';

const OrganizationList = () => {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    // Logs & Analytics tab states
    const [activeDetailTab, setActiveDetailTab] = useState('details'); // 'details' | 'logs'
    const [analytics, setAnalytics] = useState(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logType, setLogType] = useState('activity'); // 'activity' | 'errors'
    const [logModule, setLogModule] = useState('');
    const [logPlatform, setLogPlatform] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [logPage, setLogPage] = useState(1);
    const [logPagination, setLogPagination] = useState({ total: 0, pages: 1 });
    const [expandedLogId, setExpandedLogId] = useState(null);
    const searchDebounceRef = useRef(null);

    // Admins State for the selected org
    const [orgAdmins, setOrgAdmins] = useState([]);
    const [loadingAdmins, setLoadingAdmins] = useState(false);
    const [editingAdminId, setEditingAdminId] = useState(null);
    const [adminFormData, setAdminFormData] = useState({});

    // Form State
    const [formData, setFormData] = useState({
        org_name: '', org_code: '', status: 'active', subscription_plan: 'Trial', subscription_expiry: '', grace_period_days: 0, max_users: 50,
        contact_name: '', contact_email: '', contact_phone: '',
        admin_name: '', admin_email: '', admin_phone: '', admin_password: '',
        gst_number: '', pan_number: ''
    });
    const [formLoading, setFormLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirmOrg, setDeleteConfirmOrg] = useState(null); // org object to confirm deletion
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [listTab, setListTab] = useState('active'); // 'active' | 'deleted'
    const [isOrgCodeManuallyEdited, setIsOrgCodeManuallyEdited] = useState(false);

    // Auto-generate organization code based on organization name (only when creating new)
    useEffect(() => {
        if (!selectedOrg && isEditing && !isOrgCodeManuallyEdited && formData.org_name) {
            const name = formData.org_name;
            const words = name.trim().split(/[\s\-_]+/).map(w => w.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean);
            let code = "";
            if (words.length >= 3) {
                code = words.map(w => w[0]).join("");
            } else if (words.length === 2) {
                const firstWord = words[0];
                const secondWord = words[1];
                if (firstWord.length >= 2) {
                    code = firstWord.substring(0, 2) + secondWord.charAt(0);
                } else {
                    code = firstWord.charAt(0) + secondWord.substring(0, 2);
                }
            } else if (words.length === 1) {
                code = words[0];
            }

            let cleanCode = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            if (cleanCode.length > 10) {
                cleanCode = cleanCode.substring(0, 10);
            }
            if (cleanCode.length < 3 && cleanCode.length > 0) {
                const originalClean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                if (originalClean.length >= 3) {
                    cleanCode = originalClean.substring(0, 5);
                } else {
                    cleanCode = (cleanCode + "ORG").substring(0, 5);
                }
            }
            if (cleanCode) {
                setFormData(prev => ({ ...prev, org_code: cleanCode }));
            }
        }
    }, [formData.org_name, isOrgCodeManuallyEdited, selectedOrg, isEditing]);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/organizations');
            const data = res.data.data;
            // Debug: log all statuses to verify what the backend returns
            console.log('[Orgs] statuses:', data.map(o => `${o.org_code}=${o.status}`));
            setOrganizations(data);
        } catch (error) {
            toast.error('Failed to fetch organizations');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOrg = async (org) => {
        if (selectedOrg?.org_id === org.org_id) {
            setSelectedOrg(null);
            setIsEditing(false);
            return;
        }
        setSelectedOrg(org);
        setFormData({
            ...org,
            gst_number: org.gst_number || '',
            pan_number: org.pan_number || '',
            subscription_expiry: org.subscription_expiry ? new Date(org.subscription_expiry).toISOString().split('T')[0] : ''
        });
        setIsEditing(false); // Mode: View existing
        setActiveDetailTab('details'); // Reset tab to overview on org switch
        fetchOrgAdmins(org.org_id);
    };

    const fetchOrgAdmins = async (orgId) => {
        setLoadingAdmins(true);
        try {
            const res = await api.get(`/organizations/${orgId}/admins`);
            setOrgAdmins(res.data.data);
            setEditingAdminId(null);
        } catch (error) {
            toast.error('Failed to fetch org admins');
        } finally {
            setLoadingAdmins(false);
        }
    };

    const fetchOrgAnalytics = async (orgId) => {
        setLoadingAnalytics(true);
        try {
            const res = await api.get(`/organizations/${orgId}/analytics`);
            if (res.data.success) {
                setAnalytics(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch analytics:", err);
            toast.error("Failed to load organization analytics");
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const fetchOrgLogs = async (orgId, page = 1) => {
        setLoadingLogs(true);
        try {
            const queryParams = new URLSearchParams({
                type: logType,
                page: page,
                limit: 200
            });
            if (logModule) queryParams.append('module', logModule);
            if (logPlatform) queryParams.append('platform', logPlatform);
            if (logSearch) queryParams.append('search', logSearch);

            const res = await api.get(`/organizations/${orgId}/logs?${queryParams.toString()}`);
            if (res.data.success) {
                setLogs(res.data.data);
                setLogPagination(res.data.pagination);
                setLogPage(page);
            }
        } catch (err) {
            console.error("Failed to fetch logs:", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    // Watchers to trigger analytics and log fetch automatically
    useEffect(() => {
        if (selectedOrg && activeDetailTab === 'logs') {
            fetchOrgAnalytics(selectedOrg.org_id);
        }
    }, [selectedOrg, activeDetailTab]);

    useEffect(() => {
        if (selectedOrg && activeDetailTab === 'logs') {
            fetchOrgLogs(selectedOrg.org_id, 1);
        }
    }, [selectedOrg, activeDetailTab, logType, logModule, logPlatform, logSearch]);

    const handleEditAdmin = (admin) => {
        setEditingAdminId(admin.user_id);
        setAdminFormData({
            user_name: admin.user_name || '',
            email: admin.email || '',
            phone_no: admin.phone_no || '',
            is_active: admin.is_active ? true : false,
            password: '' // empty unless changing
        });
    };

    const handleSaveAdmin = async (adminId) => {
        if (!validateEmail(adminFormData.email)) {
            toast.error("Please enter a valid email address.");
            return;
        }
        if (adminFormData.phone_no && !validatePhone(adminFormData.phone_no)) {
            toast.error("Please enter a valid phone number according to the country code.");
            return;
        }
        try {
            await api.put(`/organizations/${selectedOrg.org_id}/admins/${adminId}`, adminFormData);
            toast.success("Admin updated successfully");
            fetchOrgAdmins(selectedOrg.org_id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update admin');
        }
    };

    const handleAddNew = () => {
        setSelectedOrg(null);
        setFormData({
            org_name: '', org_code: '', status: 'active', subscription_plan: 'Trial', subscription_expiry: '', grace_period_days: 0, max_users: 50,
            contact_name: '', contact_email: '', contact_phone: '',
            admin_name: '', admin_email: '', admin_phone: '', admin_password: '',
            gst_number: '', pan_number: ''
        });
        setIsOrgCodeManuallyEdited(false);
        setIsEditing(true); // Mode: Create new
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        // Validate organization code
        const cleanCode = formData.org_code.trim().toUpperCase();
        if (cleanCode.length < 3 || cleanCode.length > 10 || !/^[A-Z0-9]+$/.test(cleanCode)) {
            toast.error("Organization code must be 3-10 alphanumeric characters with no spaces.");
            return;
        }
        
        // Validate contact details
        if (!validateEmail(formData.contact_email)) {
            toast.error("Please enter a valid contact email address.");
            return;
        }
        if (!validatePhone(formData.contact_phone)) {
            toast.error("Please enter a valid contact phone number according to the country code.");
            return;
        }
        
        // Admin details validation (only for new organization creation)
        if (!selectedOrg) {
            if (!validateEmail(formData.admin_email)) {
                toast.error("Please enter a valid admin email address.");
                return;
            }
            if (formData.admin_phone && !validatePhone(formData.admin_phone)) {
                toast.error("Please enter a valid admin phone number according to the country code.");
                return;
            }
        }

        // GST & PAN validation
        const gst = (formData.gst_number || '').trim().toUpperCase();
        const pan = (formData.pan_number || '').trim().toUpperCase();

        if ((gst && !pan) || (!gst && pan)) {
            toast.error("Please enter both GST and PAN, or leave both fields blank.");
            return;
        }

        if (gst && pan) {
            const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

            if (!gstRegex.test(gst)) {
                toast.error("Please enter a valid GST number.");
                return;
            }
            if (!panRegex.test(pan)) {
                toast.error("Please enter a valid PAN number.");
                return;
            }
        }

        const payload = {
            ...formData,
            org_code: cleanCode,
            gst_number: gst || null,
            pan_number: pan || null
        };

        setFormLoading(true);
        try {
            if (!selectedOrg) {
                // Create
                const res = await api.post('/organizations', payload);
                toast.success('Organization created successfully');
                await fetchOrganizations();
                // Select the newly created one (assuming backend returns org_id, but fetch gets the list anyway)
                setIsEditing(false);
            } else {
                // Update
                await api.put(`/organizations/${selectedOrg.org_id}`, payload);
                toast.success('Organization updated successfully');

                // Update local state to avoid full refetch if you want, but fetch is safer
                const updatedOrg = { ...selectedOrg, ...payload };
                setOrganizations(organizations.map(o => o.org_id === updatedOrg.org_id ? updatedOrg : o));
                setSelectedOrg(updatedOrg);
                setIsEditing(false);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeactivate = async () => {
        if (window.confirm("Are you sure you want to suspend this organization? This disables access for all of its users.")) {
            try {
                await api.put(`/organizations/${selectedOrg.org_id}`, { status: 'suspended' });
                toast.success('Organization deactivated successfully');
                await fetchOrganizations();
                const updatedOrg = { ...selectedOrg, status: 'suspended' };
                setSelectedOrg(updatedOrg);
                setFormData(updatedOrg);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Deactivation failed');
            }
        }
    };

    const handleReactivate = async () => {
        try {
            await api.put(`/organizations/${selectedOrg.org_id}`, { status: 'active' });
            toast.success('Organization reactivated successfully');
            await fetchOrganizations();
            const updatedOrg = { ...selectedOrg, status: 'active' };
            setSelectedOrg(updatedOrg);
            setFormData(updatedOrg);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Reactivation failed');
        }
    };

    const handleDeleteOrg = async () => {
        if (!deleteConfirmOrg) return;
        setDeleteLoading(true);
        try {
            const res = await api.delete(`/organizations/${deleteConfirmOrg.org_id}`);
            toast.success(res.data.message || 'Organization scheduled for deletion.');
            setDeleteConfirmOrg(null);
            if (selectedOrg?.org_id === deleteConfirmOrg.org_id) {
                setSelectedOrg(null);
                setIsEditing(false);
            }
            await fetchOrganizations();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to schedule deletion.');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleCancelDeletion = async () => {
        try {
            const res = await api.post(`/organizations/${selectedOrg.org_id}/cancel-deletion`);
            toast.success(res.data.message || 'Deletion cancelled.');
            await fetchOrganizations();
            const updatedOrg = { ...selectedOrg, status: 'active', deletion_scheduled_at: null, deletion_requested_at: null };
            setSelectedOrg(updatedOrg);
            setFormData(updatedOrg);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel deletion.');
        }
    };

    // Use deletion_scheduled_at as the source of truth for pending-deletion orgs.
    // The status ENUM column silently stores '' for unknown values (like 'pending_deletion'),
    // so we rely on the timestamp field which is always correctly set by the backend.
    const isPendingDeletion = (o) => o.deletion_scheduled_at !== null && o.deletion_scheduled_at !== undefined;
    const matchesSearch    = (o) =>
        o.org_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.org_code.toLowerCase().includes(searchQuery.toLowerCase());

    const activeOrgs  = organizations.filter(o => !isPendingDeletion(o) && matchesSearch(o));
    const pendingOrgs = organizations.filter(o =>  isPendingDeletion(o) && matchesSearch(o));
    const displayedOrgs = listTab === 'active' ? activeOrgs : pendingOrgs;

    const renderHubDashboard = () => {
        // Dynamic aggregations
        const totalOrgs = organizations.length;
        const activeOrgsCount = organizations.filter(o => o.status === 'active' && !isPendingDeletion(o)).length;
        const suspendedOrgsCount = organizations.filter(o => o.status === 'suspended' && !isPendingDeletion(o)).length;
        const pendingDeletionOrgsCount = organizations.filter(o => isPendingDeletion(o)).length;
        
        // Plans grouping
        const plans = {};
        organizations.forEach(o => {
            const plan = o.subscription_plan || 'Trial';
            plans[plan] = (plans[plan] || 0) + 1;
        });
        const planDistribution = Object.keys(plans).map(key => ({
            name: key,
            count: plans[key]
        }));

        // Status grouping
        const statusDistribution = [
            { name: 'Active', value: activeOrgsCount, color: '#10b981' },
            { name: 'Suspended', value: suspendedOrgsCount, color: '#f59e0b' },
            { name: 'Pending Deletion', value: pendingDeletionOrgsCount, color: '#ef4444' }
        ].filter(item => item.value > 0);

        return (
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 bg-slate-50/30 dark:bg-github-dark-subtle/5 flex flex-col">
                {/* Welcome & Overview Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600/80 dark:to-indigo-700/80 p-6 rounded-2xl text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                     <div>
                         <h2 className="text-xl font-bold tracking-tight">Organization Hub Dashboard</h2>
                         <p className="text-xs text-indigo-100 mt-1 max-w-xl">
                             Overview of tenant configurations, active accounts, health states, and billing tiers. Select an organization from the panel to manage settings.
                         </p>
                     </div>
                     <div className="shrink-0 flex items-center justify-center p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                         <Building size={24} />
                     </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                     {/* Total Organizations */}
                     <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                         <div>
                             <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Total Orgs</span>
                             <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">{totalOrgs}</h4>
                         </div>
                         <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
                             <Building size={20} />
                         </div>
                     </div>

                     {/* Active Orgs */}
                     <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                         <div>
                             <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Active Tenants</span>
                             <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">{activeOrgsCount}</h4>
                         </div>
                         <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                             <Shield size={20} />
                         </div>
                     </div>

                     {/* Suspended Orgs */}
                     <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                         <div>
                             <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Suspended</span>
                             <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tracking-tight">{suspendedOrgsCount}</h4>
                         </div>
                         <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30">
                             <AlertCircle size={20} />
                         </div>
                     </div>

                     {/* Pending Deletion */}
                     <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                         <div>
                             <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Pending Deletion</span>
                             <h4 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 tracking-tight">{pendingDeletionOrgsCount}</h4>
                         </div>
                         <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30">
                             <Trash2 size={20} />
                         </div>
                     </div>
                </div>

                {/* Charts Section */}
                {totalOrgs > 0 ? (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
                         {/* Subscription Plans Distribution */}
                         <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 flex flex-col h-[280px]">
                             <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted mb-4">Subscription Plan Distribution</h4>
                             <div className="flex-1 min-h-0">
                                 <ResponsiveContainer width="100%" height="100%">
                                     <BarChart data={planDistribution}>
                                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                         <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                         <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                         <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Organizations" />
                                     </BarChart>
                                 </ResponsiveContainer>
                             </div>
                         </div>

                         {/* Status Breakdown (Donut) */}
                         <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 flex flex-col h-[280px]">
                             <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-github-dark-muted mb-4">Tenant Status Share</h4>
                             <div className="flex-1 min-h-0 flex items-center justify-center relative">
                                 <ResponsiveContainer width="100%" height="100%">
                                     <RechartsPieChart>
                                         <Pie
                                             data={statusDistribution}
                                             dataKey="value"
                                             nameKey="name"
                                             cx="50%"
                                             cy="50%"
                                             innerRadius={45}
                                             outerRadius={70}
                                             paddingAngle={3}
                                         >
                                             {statusDistribution.map((entry, idx) => (
                                                 <Cell key={`cell-${idx}`} fill={entry.color} />
                                             ))}
                                         </Pie>
                                         <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 11 }} />
                                     </RechartsPieChart>
                                 </ResponsiveContainer>
                                 <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active</span>
                                     <span className="text-xl font-extrabold text-slate-800 dark:text-white">
                                         {totalOrgs > 0 ? Math.round((activeOrgsCount / totalOrgs) * 100) : 0}%
                                     </span>
                                 </div>
                             </div>
                         </div>
                     </div>
                ) : (
                     <div className="py-20 text-center text-slate-400 dark:text-github-dark-muted flex flex-col items-center justify-center gap-2 shrink-0">
                         <Building size={32} className="opacity-55 text-indigo-500" />
                         <span className="text-sm font-semibold">No organizations registered yet.</span>
                     </div>
                )}

                {/* Quick Tips / Guide */}
                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-start gap-4 shrink-0">
                     <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                         <AlertCircle size={16} />
                     </div>
                     <div>
                         <h5 className="text-xs font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Quick Instructions</h5>
                         <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1 leading-relaxed">
                             Select any organization in the left sidebar to access its profile, configure subscription boundaries, edit supervisor details, recover deleted accounts, or view live audit trails. Click the <strong className="text-indigo-600 dark:text-indigo-400 font-black">"Add New"</strong> button in the top left to create a new tenant.
                         </p>
                     </div>
                </div>
            </div>
        );
    };

    return (
        <DashboardLayout title="Organization Management" noPadding={true}>
            <div className="h-[calc(100vh-64px)] p-3 space-y-3 overflow-hidden flex flex-col min-h-0">

                {/* Page Level Tabs — only visible if an organization is selected and not in "create new" or "edit" mode */}
                {selectedOrg && !isEditing && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border px-6 py-4 rounded-2xl shadow-sm shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-xl text-indigo-600 dark:text-indigo-400">
                                <Building size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-sm flex items-center gap-2">
                                    {selectedOrg.org_name}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                        selectedOrg.status === 'active' 
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                        {selectedOrg.status}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-github-dark-muted font-mono">Code: {selectedOrg.org_code}</p>
                            </div>
                        </div>
                        <div className="flex p-1 bg-slate-100 dark:bg-github-dark-subtle rounded-xl border border-slate-200/50 dark:border-github-dark-border">
                            <button
                                type="button"
                                onClick={() => setActiveDetailTab('details')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                    activeDetailTab === 'details'
                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                <Building size={14} />
                                <span>Organization Profile & Admins</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveDetailTab('logs')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                    activeDetailTab === 'logs'
                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                <Terminal size={14} />
                                <span>Org Activity & API Logs</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Content Pane */}
                {(!isEditing && selectedOrg && activeDetailTab === 'logs') ? (
                    /* Full-Page Activity & Logs Console */
                    <div className="flex-1 bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 no-scrollbar bg-slate-50/50 dark:bg-github-dark-subtle/5 space-y-6 flex flex-col">
                            {/* KPI Cards */}
                            {loadingAnalytics ? (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="bg-white dark:bg-dark-card h-24 rounded-2xl border border-slate-200 dark:border-github-dark-border" />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Total API Calls</span>
                                            <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">{analytics?.total_api_calls || 0}</h4>
                                        </div>
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
                                            <Database size={20} />
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Success Rate</span>
                                            <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">{analytics?.success_rate ?? 100}%</h4>
                                        </div>
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                                            <Activity size={20} />
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Avg Latency</span>
                                            <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tracking-tight">{analytics?.avg_latency_ms || 0} ms</h4>
                                        </div>
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30">
                                            <Clock size={20} />
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Active Accounts</span>
                                            <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 tracking-tight">{analytics?.active_users || 0}</h4>
                                        </div>
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
                                            <Users size={20} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Analytics Charts */}
                            {!loadingAnalytics && analytics && analytics.module_distribution?.length > 0 && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 lg:col-span-2 flex flex-col h-[320px]">
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text mb-4 uppercase tracking-wider text-xxs font-black">API Requests by Module</h4>
                                        <div className="flex-1 min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={analytics.module_distribution}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                                                    <XAxis dataKey="module" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Requests" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 flex flex-col h-[320px]">
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text mb-4 uppercase tracking-wider text-xxs font-black">Platform Traffic Share</h4>
                                        <div className="flex-1 min-h-0 flex items-center justify-center relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsPieChart>
                                                    <Pie
                                                        data={analytics.platform_distribution || []}
                                                        dataKey="count"
                                                        nameKey="platform"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={80}
                                                        paddingAngle={3}
                                                    >
                                                        {(analytics.platform_distribution || []).map((entry, idx) => (
                                                            <Cell key={`cell-${idx}`} fill={['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899'][idx % 7]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 11 }} />
                                                </RechartsPieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Logs Console Container */}
                            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl overflow-hidden flex flex-col shadow-sm">
                                {/* Filter Bar */}
                                <div className="p-5 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/40 dark:bg-github-dark-subtle/10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <span className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                                            <Terminal size={18} />
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-github-dark-text text-sm uppercase tracking-wider flex items-center gap-2">
                                                API Activity Console
                                                {logPagination.total > 0 && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-github-dark-muted border border-slate-200 dark:border-github-dark-border normal-case tracking-normal">
                                                        {logPagination.total.toLocaleString()} Logs
                                                    </span>
                                                )}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-github-dark-muted">Live transaction history and errors for developer debugging</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                                        {/* Log Type selector */}
                                        <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-github-dark-border">
                                            <button
                                                type="button"
                                                onClick={() => { setLogType('activity'); setLogModule(''); setLogPlatform(''); setLogPage(1); }}
                                                className={`px-3 py-1 rounded-md text-[10px] uppercase font-black tracking-wider transition-all duration-200 ${
                                                    logType === 'activity'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                        : 'text-slate-500 dark:text-github-dark-muted'
                                                }`}
                                            >
                                                Activity
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setLogType('errors'); setLogModule(''); setLogPlatform(''); setLogPage(1); }}
                                                className={`px-3 py-1 rounded-md text-[10px] uppercase font-black tracking-wider transition-all duration-200 ${
                                                    logType === 'errors'
                                                        ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm'
                                                        : 'text-slate-500 dark:text-github-dark-muted'
                                                }`}
                                            >
                                                Errors
                                            </button>
                                        </div>

                                        {/* Module Filter dropdown — only for activity */}
                                        {logType === 'activity' && (
                                            <MinimalSelect
                                                options={[
                                                    { label: 'All Modules', value: '' },
                                                    { label: 'Attendance', value: 'Attendance' },
                                                    { label: 'Live Attendance', value: 'Live Attendance' },
                                                    { label: 'DAR', value: 'DAR (Daily Activity)' },
                                                    { label: 'Leaves', value: 'Leaves' },
                                                    { label: 'Holidays', value: 'Holidays' },
                                                    { label: 'Employees', value: 'Employees' },
                                                    { label: 'Authentication', value: 'Authentication' },
                                                    { label: 'Profile', value: 'Profile' },
                                                    { label: 'Chatbot', value: 'Chatbot' },
                                                    { label: 'Work Locations', value: 'Work Locations' }
                                                ]}
                                                value={logModule}
                                                onChange={(val) => { setLogModule(val); setLogPage(1); }}
                                                placeholder="All Modules"
                                                size="sm"
                                                triggerClassName="bg-white dark:bg-slate-800 border-slate-200 dark:border-github-dark-border text-xs py-1.5 px-3 font-bold"
                                            />
                                        )}

                                        {/* Platform Filter dropdown */}
                                        <MinimalSelect
                                            options={[
                                                { label: 'All Platforms', value: '' },
                                                { label: 'Web Browser', value: 'WEB' },
                                                { label: 'Mobile App', value: 'MOBILE_APP' },
                                                { label: 'API Client', value: 'API_CLIENT' }
                                            ]}
                                            value={logPlatform}
                                            onChange={(val) => { setLogPlatform(val); setLogPage(1); }}
                                            placeholder="All Platforms"
                                            size="sm"
                                            triggerClassName="bg-white dark:bg-slate-800 border-slate-200 dark:border-github-dark-border text-xs py-1.5 px-3 font-bold"
                                        />

                                        {/* Search Bar */}
                                        <div className="relative flex-grow sm:flex-grow-0">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                            <input
                                                type="text"
                                                placeholder="Search logs..."
                                                value={logSearch}
                                                onChange={(e) => {
                                                    setLogSearch(e.target.value);
                                                    setLogPage(1);
                                                }}
                                                className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-300 font-medium"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => fetchOrgLogs(selectedOrg.org_id, 1)}
                                            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-github-dark-border rounded-lg hover:text-indigo-600 text-slate-500 active:scale-95 transition-all shadow-sm"
                                            title="Reload logs"
                                        >
                                            <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                </div>

                                {/* Log List/Console */}
                                <div className="flex-1 overflow-x-auto min-h-[300px] no-scrollbar">
                                    {loadingLogs ? (
                                        <div className="py-24 flex justify-center items-center"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
                                    ) : logs.length === 0 ? (
                                        <div className="py-20 text-center text-slate-400 dark:text-github-dark-muted flex flex-col items-center justify-center gap-2">
                                            <Database size={32} className="opacity-55 text-indigo-500" />
                                            <span className="text-sm font-semibold">No transactions discovered.</span>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left text-xs whitespace-nowrap">
                                            <thead className="bg-slate-50 dark:bg-github-dark-subtle/80 border-b border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-muted font-bold text-xxs uppercase tracking-wider sticky top-0 z-10">
                                                {logType === 'activity' ? (
                                                    <tr>
                                                        <th className="px-6 py-3 font-semibold">Time</th>
                                                        <th className="px-6 py-3 font-semibold">Module</th>
                                                        <th className="px-6 py-3 font-semibold">Platform</th>
                                                        <th className="px-6 py-3 font-semibold">Action Description</th>
                                                        <th className="px-6 py-3 font-semibold">Initiator</th>
                                                        <th className="px-6 py-3 font-semibold">IP Address</th>
                                                    </tr>
                                                ) : (
                                                    <tr>
                                                        <th className="px-6 py-3 font-semibold">Time</th>
                                                        <th className="px-6 py-3 font-semibold">Platform</th>
                                                        <th className="px-6 py-3 font-semibold">Method / Path</th>
                                                        <th className="px-6 py-3 font-semibold">Error Message</th>
                                                        <th className="px-6 py-3 font-semibold">User Context</th>
                                                    </tr>
                                                )}
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                                {logs.map(log => {
                                                    const logId = log.activity_id || log.error_id;
                                                    const isExpanded = expandedLogId === logId;
                                                    return (
                                                        <React.Fragment key={logId}>
                                                            <tr
                                                                onClick={() => setExpandedLogId(isExpanded ? null : logId)}
                                                                className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer select-none ${
                                                                    logType === 'errors' ? 'hover:bg-red-500/5 dark:hover:bg-red-500/5' : ''
                                                                }`}
                                                            >
                                                                <td className="px-6 py-4 font-mono text-slate-400">
                                                                    {new Date(log.occurred_at).toLocaleString()}
                                                                </td>
                                                                {logType === 'activity' ? (
                                                                    <>
                                                                        <td className="px-6 py-4">
                                                                            <span className="px-2 py-0.5 rounded font-black text-[10px] uppercase border bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800/30">
                                                                                {log.module}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase border ${
                                                                                log.platform === 'WEB'
                                                                                    ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
                                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/30'
                                                                            }`}>
                                                                                {log.platform === 'MOBILE_APP' ? 'MOBILE_APP' : log.platform}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 max-w-[320px] whitespace-normal text-slate-700 dark:text-slate-300 font-semibold break-all leading-normal">
                                                                            {log.description}
                                                                        </td>
                                                                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                                                            {log.user_name || 'System Auto'}
                                                                        </td>
                                                                        <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                                                                            {log.request_ip || 'N/A'}
                                                                        </td>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <td className="px-6 py-4">
                                                                            <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase border ${
                                                                                log.platform === 'WEB'
                                                                                    ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
                                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/30'
                                                                            }`}>
                                                                                {log.platform === 'MOBILE_APP' ? 'MOBILE_APP' : log.platform}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 font-mono">
                                                                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-bold mr-2 text-[10px]">
                                                                                {log.request_method}
                                                                            </span>
                                                                            <span className="text-slate-600 dark:text-github-dark-muted">{log.request_path || 'Background Job'}</span>
                                                                        </td>
                                                                        <td className="px-6 py-4 max-w-[350px] whitespace-normal text-red-600 dark:text-red-400 font-bold break-all leading-normal">
                                                                            {log.error_message}
                                                                        </td>
                                                                        <td className="px-6 py-4 text-slate-600 dark:text-github-dark-muted font-bold">
                                                                            {log.user_name ? `${log.user_name}` : 'Anonymous'}
                                                                        </td>
                                                                    </>
                                                                )}
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr>
                                                                    <td colSpan="6" className="bg-slate-50 dark:bg-slate-900/60 p-5 border-t border-b border-slate-100 dark:border-slate-800">
                                                                        <div className="space-y-3">
                                                                            <div className="flex items-center justify-between">
                                                                                <h5 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                                                                                    <Terminal size={12} /> Log Details Inspector
                                                                                </h5>
                                                                                {logType === 'errors' && log.stack_trace && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            navigator.clipboard.writeText(log.stack_trace);
                                                                                            toast.success("Stack trace copied");
                                                                                        }}
                                                                                        className="px-3 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-bold transition-all text-[10px] uppercase tracking-wider active:scale-95 shadow-sm"
                                                                                    >
                                                                                        Copy Trace
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                            <pre className="p-4 bg-slate-900 text-slate-300 rounded-xl overflow-x-auto text-[11px] font-mono break-all whitespace-pre-wrap max-h-72 border border-slate-800 no-scrollbar shadow-inner">
                                                                                {logType === 'activity' 
                                                                                    ? JSON.stringify(log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : log, null, 2)
                                                                                    : log.stack_trace || JSON.stringify(log, null, 2)
                                                                                }
                                                                            </pre>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Main Content: Split View */
                    <div className="flex flex-1 gap-3 overflow-hidden">

                    {/* Left Pane: Scrollable List */}
                    <div className="w-1/3 flex flex-col bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden shrink-0">
                        {/* Search and Action */}
                        <div className="p-4 border-b border-slate-100 dark:border-github-dark-border space-y-4">
                            <button
                                onClick={handleAddNew}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex justify-center items-center gap-2 font-medium shadow-sm"
                            >
                                <Plus size={18} /> New Organization
                            </button>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search organizations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/30 dark:bg-github-dark-subtle/10">
                            <div className="flex space-x-1 bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-xl w-full">
                                <button
                                    type="button"
                                    onClick={() => { setListTab('active'); setSelectedOrg(null); setIsEditing(false); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                        listTab === 'active'
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <span>Active</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        listTab === 'active'
                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>{activeOrgs.length}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setListTab('deleted'); setSelectedOrg(null); setIsEditing(false); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                        listTab === 'deleted'
                                            ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                                            : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <span>Deleted</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        listTab === 'deleted'
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>{pendingOrgs.length}</span>
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar relative min-h-[250px]">
                            {loading ? (
                                <LoadingScreen message="Fetching organizations..." isSuperAdmin={true} fullScreen={false} />
                            ) : displayedOrgs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-slate-400 dark:text-github-dark-muted gap-2">
                                    {listTab === 'deleted'
                                        ? <><AlertTriangle size={28} className="text-amber-300" /><span className="text-sm">No deleted organizations.</span></>
                                        : <><Building size={28} className="text-slate-300" /><span className="text-sm">No organizations found.</span></>
                                    }
                                </div>
                            ) : listTab === 'active' ? (
                                displayedOrgs.map((org) => (
                                    <div
                                        key={org.org_id}
                                        onClick={() => handleSelectOrg(org)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${selectedOrg?.org_id === org.org_id
                                                ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-500/30'
                                                : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className={`font-semibold text-sm ${selectedOrg?.org_id === org.org_id ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                {org.org_name}
                                            </h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${org.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {org.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-github-dark-muted">
                                            <span>Code: <span className="font-mono">{org.org_code}</span></span>
                                            <span className="flex items-center gap-1"><Shield size={12} /> {org.subscription_plan}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                displayedOrgs.map((org) => (
                                    <div
                                        key={org.org_id}
                                        onClick={() => handleSelectOrg(org)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${selectedOrg?.org_id === org.org_id
                                                ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-500/30'
                                                : 'border-transparent hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className={`font-semibold text-sm line-through opacity-60 ${selectedOrg?.org_id === org.org_id ? 'text-amber-900 dark:text-amber-300' : 'text-slate-700 dark:text-github-dark-text'
                                                }`}>
                                                {org.org_name}
                                            </h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                Deleting
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-github-dark-muted">
                                            <span className="font-mono">{org.org_code}</span>
                                            {org.deletion_scheduled_at && (
                                                <span className="text-amber-500 dark:text-amber-400 flex items-center gap-1">
                                                    <Trash2 size={10} /> {new Date(org.deletion_scheduled_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Pane: Details / Edit Form */}
                    <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col">
                        {(!selectedOrg && !isEditing) ? (
                            renderHubDashboard()
                        ) : (
                            <form onSubmit={handleSave} className="flex flex-col h-full">
                                {/* Details Header */}
                                <div className="px-8 py-6 border-b border-slate-100 dark:border-github-dark-border flex justify-between items-start bg-slate-50/50 dark:bg-github-dark-subtle/20">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                <Building size={24} />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-slate-900 dark:text-github-dark-text">
                                                    {isEditing ? (selectedOrg ? 'Edit Organization' : 'Create New Organization') : selectedOrg.org_name}
                                                </h2>
                                                {!isEditing && <p className="text-sm font-mono text-slate-500">Code: {selectedOrg.org_code}</p>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {!isEditing ? (
                                            <button
                                                type="button"
                                                onClick={() => setIsEditing(true)}
                                                className="px-4 py-2 border border-slate-200 dark:border-github-dark-border hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-github-dark-subtle text-slate-700 dark:text-github-dark-text rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 text-sm shadow-sm hover:shadow-[0_2px_8px_rgba(99,102,241,0.15)] active:scale-[0.98]"
                                            >
                                                <Pencil size={15} />
                                                Edit Details
                                            </button>
                                        ) : (
                                            <>
                                                {selectedOrg && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsEditing(false);
                                                            handleSelectOrg(selectedOrg); // reset form
                                                        }}
                                                        className="px-4 py-2 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-semibold transition-colors text-sm active:scale-[0.98]"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                                <button
                                                    type="submit"
                                                    disabled={formLoading}
                                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 disabled:opacity-70 text-sm shadow-md shadow-indigo-500/20 active:scale-[0.98]"
                                                >
                                                    {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                    Save Changes
                                                </button>
                                            </>
                                        )}
                                        {/* Status action buttons — view mode only */}
                                        {!isEditing && selectedOrg && selectedOrg.status === 'pending_deletion' && (
                                            <button
                                                type="button"
                                                onClick={handleCancelDeletion}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 text-sm ml-2 shadow-sm active:scale-[0.98]"
                                            >
                                                <RotateCcw size={14} /> Recover Organization
                                            </button>
                                        )}
                                        {!isEditing && selectedOrg && selectedOrg.status !== 'suspended' && selectedOrg.status !== 'pending_deletion' && (
                                            <button
                                                type="button"
                                                onClick={handleDeactivate}
                                                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-400 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 text-sm ml-2 active:scale-[0.98]"
                                            >
                                                Deactivate
                                            </button>
                                        )}
                                        {!isEditing && selectedOrg && selectedOrg.status === 'suspended' && (
                                            <button
                                                type="button"
                                                onClick={handleReactivate}
                                                className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 text-sm ml-2 active:scale-[0.98]"
                                            >
                                                Reactivate
                                            </button>
                                        )}
                                        {!isEditing && selectedOrg && selectedOrg.status !== 'pending_deletion' && (
                                            <button
                                                type="button"
                                                onClick={() => setDeleteConfirmOrg(selectedOrg)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 text-sm ml-2 shadow-sm active:scale-[0.98]"
                                            >
                                                <Trash2 size={14} /> Delete Org
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Details / Form Body */}
                                <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                                    <div className="w-full space-y-6">

                                        {/* Pending Deletion Warning Banner */}
                                        {selectedOrg?.status === 'pending_deletion' && (
                                            <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
                                                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Organization Scheduled for Deletion</p>
                                                    <p className="text-amber-700 dark:text-amber-400 text-sm mt-0.5">
                                                        This organization and all its data will be <strong>permanently deleted</strong> on{' '}
                                                        <strong>
                                                            {selectedOrg.deletion_scheduled_at
                                                                ? new Date(selectedOrg.deletion_scheduled_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                                                                : 'the scheduled date'}
                                                        </strong>.
                                                        Use <em>Cancel Deletion</em> above to reverse this action before that date.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Card 1: General & Contact Information */}
                                            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-6 rounded-2xl space-y-6">
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-github-dark-border flex items-center gap-2">
                                                    <Building size={16} className="text-indigo-500" /> General & Contact Details
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Organization Name</label>
                                                        {isEditing ? (
                                                            <input required value={formData.org_name} onChange={(e) => setFormData({ ...formData, org_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm" placeholder="e.g. Acme Corp" />
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg text-slate-800 dark:text-github-dark-text font-semibold text-sm shadow-sm">{selectedOrg.org_name}</div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Organization Code</label>
                                                        {isEditing ? (
                                                            <input required value={formData.org_code} onChange={(e) => { setIsOrgCodeManuallyEdited(true); setFormData({ ...formData, org_code: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() }); }} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900 font-mono text-sm" placeholder="e.g. ACM01" />
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg text-slate-800 dark:text-github-dark-text font-mono text-sm shadow-sm">{selectedOrg.org_code}</div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5 sm:col-span-2">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Contact Person Name</label>
                                                        {isEditing ? (
                                                            <input value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm" placeholder="e.g. John Doe" />
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg text-slate-800 dark:text-github-dark-text text-sm shadow-sm">{selectedOrg.contact_name || 'N/A'}</div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Contact Email Address</label>
                                                        {isEditing ? (
                                                            <input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm" placeholder="contact@example.com" />
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg text-slate-800 dark:text-github-dark-text text-sm shadow-sm truncate" title={selectedOrg.contact_email}>{selectedOrg.contact_email || 'N/A'}</div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Contact Phone Number</label>
                                                        {isEditing ? (
                                                            <PhoneInput
                                                                value={formData.contact_phone}
                                                                onChange={(val) => setFormData({ ...formData, contact_phone: val })}
                                                                variant="admin-desktop"
                                                            />
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg text-slate-800 dark:text-github-dark-text font-mono text-sm shadow-sm">{selectedOrg.contact_phone || 'N/A'}</div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">GST Number</label>
                                                        {isEditing ? (
                                                            <input 
                                                                value={formData.gst_number || ''} 
                                                                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })} 
                                                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm font-mono uppercase" 
                                                                placeholder="e.g. 22AAAAA0000A1Z5" 
                                                            />
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg text-slate-800 dark:text-github-dark-text font-mono text-sm shadow-sm">{selectedOrg.gst_number || 'N/A'}</div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">PAN Number</label>
                                                        {isEditing ? (
                                                            <input 
                                                                value={formData.pan_number || ''} 
                                                                onChange={(e) => setFormData({ ...formData, pan_number: e.target.value })} 
                                                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm font-mono uppercase" 
                                                                placeholder="e.g. ABCDE1234F" 
                                                            />
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg text-slate-800 dark:text-github-dark-text font-mono text-sm shadow-sm">{selectedOrg.pan_number || 'N/A'}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Card 2: Subscription & Account Settings */}
                                            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-6 rounded-2xl space-y-6">
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-github-dark-border flex items-center gap-2">
                                                    <Shield size={16} className="text-indigo-500" /> Subscription & Settings
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider flex items-center gap-1"><Activity size={12} className="text-slate-400" /> Account Status</label>
                                                        {isEditing ? (
                                                            <div className="relative">
                                                                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm appearance-none bg-transparent">
                                                                    <option value="active">Active</option>
                                                                    <option value="inactive">Inactive</option>
                                                                    <option value="suspended">Suspended</option>
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg flex items-center shadow-sm">
                                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${selectedOrg.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${selectedOrg.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                                    {selectedOrg.status}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider flex items-center gap-1"><Shield size={12} className="text-slate-400" /> Subscription Plan</label>
                                                        {isEditing ? (
                                                            <div className="relative">
                                                                <select value={formData.subscription_plan} onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm appearance-none bg-transparent">
                                                                    <option value="Trial">Trial</option>
                                                                    <option value="Basic">Basic</option>
                                                                    <option value="Premium">Premium</option>
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg font-semibold text-indigo-600 dark:text-indigo-400 text-sm shadow-sm">
                                                                {selectedOrg.subscription_plan}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider flex items-center gap-1"><Calendar size={12} className="text-slate-400" /> Expiry Date</label>
                                                        {isEditing ? (
                                                            <input type="date" value={formData.subscription_expiry} onChange={(e) => setFormData({ ...formData, subscription_expiry: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm" />
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg text-slate-800 dark:text-github-dark-text text-sm shadow-sm">
                                                                {selectedOrg.subscription_expiry ? new Date(selectedOrg.subscription_expiry).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Lifetime / Processing'}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider flex items-center gap-1"><Clock size={12} className="text-slate-400" /> Grace Period</label>
                                                        {isEditing ? (
                                                            <input type="number" min="0" value={formData.grace_period_days} onChange={(e) => setFormData({ ...formData, grace_period_days: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm" />
                                                        ) : (
                                                            <div className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 rounded-lg text-slate-800 dark:text-github-dark-text font-mono text-sm shadow-sm">
                                                                {selectedOrg.grace_period_days} Days
                                                            </div>
                                                        )}
                                                    </div>

                                                    {isEditing && (
                                                        <div className="space-y-1.5 sm:col-span-2">
                                                            <label className="text-xs font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider flex items-center gap-1"><Users size={12} className="text-slate-400" /> Max Users Allowed</label>
                                                            <input type="number" min="0" value={formData.max_users} onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Card 3: Usage & Capacity Metrics (View Mode Only) */}
                                            {!isEditing && (
                                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-6 rounded-2xl space-y-4 lg:col-span-2">
                                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-github-dark-border flex items-center gap-2">
                                                        <Activity size={16} className="text-indigo-500" /> Usage & Capacity
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 p-4 rounded-xl text-center shadow-sm">
                                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-github-dark-muted">Max Capacity</span>
                                                            <div className="text-xl font-black text-slate-900 dark:text-github-dark-text mt-1">{selectedOrg.max_users} <span className="text-xs font-normal">Users</span></div>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 p-4 rounded-xl text-center shadow-sm">
                                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-github-dark-muted">Total Accounts</span>
                                                            <div className="text-xl font-black text-slate-900 dark:text-github-dark-text mt-1">{selectedOrg.total_users || 0}</div>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-github-dark-border/50 p-4 rounded-xl text-center shadow-sm">
                                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-github-dark-muted">Active Logins</span>
                                                            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center justify-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                                {selectedOrg.active_users || 0}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Card 4: Initial Admin Setup (Create Mode Only) */}
                                            {isEditing && !selectedOrg && (
                                                <div className="bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 p-6 rounded-2xl space-y-4 lg:col-span-2 shadow-sm shadow-indigo-500/5">
                                                    <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider pb-2 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center gap-2">
                                                        <Shield size={16} /> Initial Admin Setup
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5 sm:col-span-2">
                                                            <label className="text-xs font-bold text-indigo-900/80 dark:text-indigo-400 uppercase tracking-wider">Admin Name</label>
                                                            <input value={formData.admin_name} onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm" placeholder="e.g. Admin Supervisor" />
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-indigo-900/80 dark:text-indigo-400 uppercase tracking-wider">Admin Email Address <span className="text-red-500">*</span></label>
                                                            <input type="email" required value={formData.admin_email} onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm" placeholder="admin@example.com" />
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-indigo-900/80 dark:text-indigo-400 uppercase tracking-wider">Admin Phone Number</label>
                                                            <PhoneInput
                                                                value={formData.admin_phone}
                                                                onChange={(val) => setFormData({ ...formData, admin_phone: val })}
                                                                variant="admin-desktop"
                                                                placeholder="Admin Phone"
                                                            />
                                                        </div>

                                                        <div className="space-y-1.5 sm:col-span-2">
                                                            <label className="text-xs font-bold text-indigo-900/80 dark:text-indigo-400 uppercase tracking-wider">Initial Admin Password <span className="text-red-500">*</span></label>
                                                            <input type="text" required value={formData.admin_password} onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono text-sm" placeholder="Set a secure password for the first admin login" />
                                                            <p className="text-[11px] text-indigo-600/70 dark:text-indigo-400/50 mt-1">This user will be created as the organization's primary administrator.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Admins Table Section (View Mode Only) */}
                                        {!isEditing && selectedOrg && (
                                            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-6 rounded-2xl space-y-4">
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center">
                                                    <span className="flex items-center gap-2"><Shield size={16} className="text-indigo-500" /> Organization Admins</span>
                                                    <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 text-xs px-2.5 py-0.5 rounded-full font-bold">{orgAdmins.length}</span>
                                                </h3>
                                                <div className="bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border overflow-hidden shadow-sm">
                                                    {loadingAdmins ? (
                                                        <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
                                                    ) : orgAdmins.length === 0 ? (
                                                        <div className="p-8 text-center text-slate-500 text-sm">No admin users found.</div>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                                <thead className="bg-slate-50 dark:bg-github-dark-subtle/80 border-b border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-muted font-bold text-xs uppercase tracking-wider">
                                                                    <tr>
                                                                        <th className="px-6 py-3.5 font-semibold">Name</th>
                                                                        <th className="px-6 py-3.5 font-semibold">Email</th>
                                                                        <th className="px-6 py-3.5 font-semibold">Phone</th>
                                                                        <th className="px-6 py-3.5 font-semibold">Status / Password</th>
                                                                        <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-github-dark-text">
                                                                    {orgAdmins.map(admin => (
                                                                        <tr key={admin.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                                            {editingAdminId === admin.user_id ? (
                                                                                <>
                                                                                    <td className="px-6 py-3">
                                                                                        <input className="w-full px-3 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={adminFormData.user_name} onChange={e => setAdminFormData({ ...adminFormData, user_name: e.target.value })} placeholder="Name" />
                                                                                    </td>
                                                                                    <td className="px-6 py-3">
                                                                                        <input type="email" className="w-full px-3 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={adminFormData.email} onChange={e => setAdminFormData({ ...adminFormData, email: e.target.value })} placeholder="Email" />
                                                                                    </td>
                                                                                    <td className="px-6 py-3">
                                                                                        <input type="tel" className="w-full px-3 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={adminFormData.phone_no} onChange={e => setAdminFormData({ ...adminFormData, phone_no: e.target.value })} placeholder="Phone" />
                                                                                    </td>
                                                                                    <td className="px-6 py-3 flex gap-2">
                                                                                        <select className="px-3 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={adminFormData.is_active ? '1' : '0'} onChange={e => setAdminFormData({ ...adminFormData, is_active: e.target.value === '1' })}>
                                                                                            <option value="1">Active</option>
                                                                                            <option value="0">Disabled</option>
                                                                                        </select>
                                                                                        <input type="text" className="w-28 px-3 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono" value={adminFormData.password} onChange={e => setAdminFormData({ ...adminFormData, password: e.target.value })} placeholder="New Pwd?" />
                                                                                    </td>
                                                                                    <td className="px-6 py-3 text-right">
                                                                                        <div className="flex items-center justify-end gap-3 font-semibold text-xs">
                                                                                            <button type="button" onClick={() => handleSaveAdmin(admin.user_id)} className="text-emerald-600 hover:text-emerald-700 transition-colors">Save</button>
                                                                                            <button type="button" onClick={() => setEditingAdminId(null)} className="text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                                                                                        </div>
                                                                                    </td>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <td className="px-6 py-3.5 font-medium">
                                                                                        <span className="text-slate-900 dark:text-github-dark-text">{admin.user_name}</span>
                                                                                        <span className="text-[10px] text-slate-400 font-mono ml-2 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{admin.user_code}</span>
                                                                                    </td>
                                                                                    <td className="px-6 py-3.5 text-slate-600 dark:text-github-dark-muted">{admin.email}</td>
                                                                                    <td className="px-6 py-3.5 font-mono text-xs text-slate-600 dark:text-github-dark-muted">{admin.phone_no || '-'}</td>
                                                                                    <td className="px-6 py-3.5">
                                                                                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${admin.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                                                            {admin.is_active ? 'Active' : 'Disabled'}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-6 py-3.5 text-right">
                                                                                        <button type="button" onClick={() => handleEditAdmin(admin)} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold text-xs transition-colors">
                                                                                            Edit
                                                                                        </button>
                                                                                    </td>
                                                                                </>
                                                                            )}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-slate-200 dark:border-github-dark-border w-full max-w-md mx-4 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-github-dark-border flex items-center gap-3">
                            <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <Trash2 size={20} className="text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-github-dark-text">Schedule Organization Deletion</h3>
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5">This action marks the organization for permanent removal</p>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-sm text-slate-700 dark:text-github-dark-text">
                                You are about to schedule <strong className="text-slate-900 dark:text-white">{deleteConfirmOrg.org_name}</strong> (<span className="font-mono">{deleteConfirmOrg.org_code}</span>) for deletion.
                            </p>
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-3 space-y-1.5">
                                <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide flex items-center gap-1.5"><AlertTriangle size={12} /> What will be deleted after ~75 days:</p>
                                <ul className="text-xs text-red-700 dark:text-red-400 list-disc list-inside space-y-0.5">
                                    <li>All user accounts in this organization</li>
                                    <li>All attendance records</li>
                                    <li>All session tokens and auth data</li>
                                    <li>The organization record itself</li>
                                </ul>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-github-dark-muted">
                                You can cancel this deletion at any time before the scheduled date using the <strong>Cancel Deletion</strong> button.
                            </p>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-github-dark-subtle/30 border-t border-slate-100 dark:border-github-dark-border flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmOrg(null)}
                                disabled={deleteLoading}
                                className="px-4 py-2 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteOrg}
                                disabled={deleteLoading}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
                            >
                                {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Yes, Schedule Deletion
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default OrganizationList;
