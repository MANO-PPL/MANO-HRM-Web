import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Building, Plus, Loader2, Save, X, Search, Shield, Activity, Users, Trash2, AlertTriangle, RotateCcw, Pencil, Terminal, Database, ChevronDown, ChevronUp, RefreshCw, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import api from '../../services/api';
import { toast } from 'react-toastify';
import MinimalSelect from '../../components/MinimalSelect';
import PhoneInput from '../../components/PhoneInput';
import { validatePhone, validateEmail } from '../../utils/validation';
import { motion, AnimatePresence } from 'framer-motion';

const OrganizationList = () => {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isInsightsOpen, setIsInsightsOpen] = useState(false);

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

    const [visibleColumns, setVisibleColumns] = useState({
        orgInfo: true,
        activeUsers: true,
        inactiveUsers: true,
        maxUsers: true,
        contact: true,
        dates: true,
        status: true,
        actions: false
    });
    const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

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
    const [isCheckingCode, setIsCheckingCode] = useState(false);
    const [codeAvailability, setCodeAvailability] = useState(null); // null | 'available' | 'unavailable' | 'invalid'
    const [validationErrors, setValidationErrors] = useState({});

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

            let cleanCode = code.replace(/[^a-zA-Z]/g, "").toUpperCase();
            if (cleanCode.length > 10) {
                cleanCode = cleanCode.substring(0, 10);
            }
            if (cleanCode.length < 3 && cleanCode.length > 0) {
                const originalClean = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
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

    // Verify organization code availability in real-time
    useEffect(() => {
        if (!isEditing || !formData.org_code) {
            setCodeAvailability(null);
            return;
        }

        const code = formData.org_code.trim().toUpperCase();
        if (code.length < 3 || code.length > 10 || !/^[A-Z]+$/.test(code)) {
            setCodeAvailability('invalid');
            return;
        }

        const delayDebounce = setTimeout(async () => {
            setIsCheckingCode(true);
            try {
                const url = selectedOrg
                    ? `/organizations/check-code?code=${code}&excludeId=${selectedOrg.org_id}`
                    : `/organizations/check-code?code=${code}`;
                const res = await api.get(url);
                if (res.data.available) {
                    setCodeAvailability('available');
                } else {
                    setCodeAvailability('unavailable');
                }
            } catch (err) {
                console.error("Error checking code availability:", err);
                setCodeAvailability(null);
            } finally {
                setIsCheckingCode(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [formData.org_code, isEditing, selectedOrg]);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/organizations');
            const data = res.data.data;
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
            setValidationErrors({});
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
        setValidationErrors({});
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
                limit: 500
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
            org_name: '', org_code: '', status: 'active', subscription_plan: 'Trial', subscription_expiry: '', grace_period_days: 7, max_users: 50,
            contact_name: '', contact_email: '', contact_phone: '',
            admin_name: '', admin_email: '', admin_phone: '', admin_password: '',
            gst_number: '', pan_number: ''
        });
        setIsOrgCodeManuallyEdited(false);
        setValidationErrors({});
        setIsEditing(true); // Mode: Create new
    };

    const handleSave = async (e) => {
        e.preventDefault();

        const errors = {};

        // Validate organization name
        if (!formData.org_name || !formData.org_name.trim()) {
            errors.org_name = "Organization name is required.";
        }

        // Validate organization code
        const cleanCode = formData.org_code.trim().toUpperCase();
        if (cleanCode.length < 3 || cleanCode.length > 10 || !/^[A-Z]+$/.test(cleanCode)) {
            errors.org_code = "Organization code must be 3-10 alphabetical characters (letters only) with no spaces.";
        }

        // Validate contact details
        if (!validateEmail(formData.contact_email)) {
            errors.contact_email = "Please enter a valid contact email address.";
        }
        if (!validatePhone(formData.contact_phone)) {
            errors.contact_phone = "Please enter a valid contact phone number according to the country code.";
        }

        // Admin details validation (only for new organization creation)
        if (!selectedOrg) {
            if (!validateEmail(formData.admin_email)) {
                errors.admin_email = "Please enter a valid admin email address.";
            }
            if (formData.admin_phone && !validatePhone(formData.admin_phone)) {
                errors.admin_phone = "Please enter a valid admin phone number according to the country code.";
            }
            if (!formData.admin_password) {
                errors.admin_password = "Initial admin password is required.";
            }
        }

        // GST & PAN validation
        const gst = (formData.gst_number || '').trim().toUpperCase();
        const pan = (formData.pan_number || '').trim().toUpperCase();

        if ((gst && !pan) || (!gst && pan)) {
            errors.gst_number = "Please enter both GST and PAN, or leave both fields blank.";
            errors.pan_number = "Please enter both GST and PAN, or leave both fields blank.";
        } else if (gst && pan) {
            const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

            if (!gstRegex.test(gst)) {
                errors.gst_number = "Please enter a valid GST number.";
            }
            if (!panRegex.test(pan)) {
                errors.pan_number = "Please enter a valid PAN number.";
            }
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            const firstErrorMessage = Object.values(errors)[0];
            toast.error(firstErrorMessage);
            return;
        }

        setValidationErrors({});

        const payload = {
            ...formData,
            org_code: cleanCode,
            gst_number: gst || null,
            pan_number: pan || null
        };

        setFormLoading(true);
        try {
            if (!selectedOrg) {
                await api.post('/organizations', payload);
                toast.success('Organization created successfully');
                await fetchOrganizations();
                setIsEditing(false);
            } else {
                await api.put(`/organizations/${selectedOrg.org_id}`, payload);
                toast.success('Organization updated successfully');
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

    const handleApprove = async () => {
        if (!selectedOrg) return;
        try {
            await api.put(`/organizations/${selectedOrg.org_id}`, { status: 'active' });
            toast.success('Organization approved successfully');
            await fetchOrganizations();
            const updatedOrg = { ...selectedOrg, status: 'active' };
            setSelectedOrg(updatedOrg);
            setFormData(updatedOrg);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Approval failed');
        }
    };

    const handleReject = async () => {
        if (!selectedOrg) return;
        if (window.confirm("Are you sure you want to reject and delete this organization?")) {
            try {
                const res = await api.delete(`/organizations/${selectedOrg.org_id}`);
                toast.success(res.data.message || 'Organization rejected successfully');
                setSelectedOrg(null);
                setIsEditing(false);
                await fetchOrganizations();
            } catch (error) {
                toast.error(error.response?.data?.message || 'Rejection failed');
            }
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

    const isPendingDeletion = (o) => o.deletion_scheduled_at !== null && o.deletion_scheduled_at !== undefined;
    const matchesSearch = (o) =>
        o.org_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.org_code.toLowerCase().includes(searchQuery.toLowerCase());

    const activeOrgs = organizations.filter(o => o.status !== 'pending_approval' && !isPendingDeletion(o) && matchesSearch(o));
    const approvalOrgs = organizations.filter(o => o.status === 'pending_approval' && !isPendingDeletion(o) && matchesSearch(o));
    const pendingOrgs = organizations.filter(o => isPendingDeletion(o) && matchesSearch(o));
    const displayedOrgs = listTab === 'active' ? activeOrgs : listTab === 'approval' ? approvalOrgs : pendingOrgs;


    const renderBreadcrumbs = () => {
        let items = [
            { label: 'Organizations', onClick: () => { setSelectedOrg(null); setIsEditing(false); } }
        ];

        if (selectedOrg) {
            if (isEditing) {
                items.push({ label: selectedOrg.org_name, onClick: () => setIsEditing(false) });
                items.push({ label: 'Edit Details', active: true });
            } else {
                items.push({ label: selectedOrg.org_name, active: true });
            }
        } else if (isEditing) {
            items.push({ label: 'Add Organization', active: true });
        }

        return (
            <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-github-dark-muted select-none shrink-0 py-1 px-1">
                {items.map((item, idx) => (
                    <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-slate-550 dark:text-slate-400 font-bold mx-0.5">&gt;</span>}
                        {item.active ? (
                            <span className="text-indigo-650 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded">{item.label}</span>
                        ) : (
                            <button
                                type="button"
                                onClick={item.onClick}
                                className="hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors font-bold text-slate-500 dark:text-github-dark-muted"
                            >
                                {item.label}
                            </button>
                        )}
                    </React.Fragment>
                ))}
            </nav>
        );
    };

    const renderKpiCards = () => {
        const totalOrgs = organizations.length;
        const activeOrgsCount = organizations.filter(o => o.status === 'active' && !isPendingDeletion(o)).length;
        const pendingApprovalOrgsCount = organizations.filter(o => o.status === 'pending_approval' && !isPendingDeletion(o)).length;
        const suspendedOrgsCount = organizations.filter(o => o.status === 'suspended' && !isPendingDeletion(o)).length;
        const pendingDeletionOrgsCount = organizations.filter(o => isPendingDeletion(o)).length;

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
                <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted tracking-wider block">Total Orgs</span>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">{totalOrgs}</h4>
                    </div>
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
                        <Building size={16} />
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted tracking-wider block">Active Tenants</span>
                        <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">{activeOrgsCount}</h4>
                    </div>
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                        <Shield size={16} />
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted tracking-wider block">Pending Approval</span>
                        <h4 className="text-xl font-black text-violet-600 dark:text-violet-400 mt-1 tracking-tight">{pendingApprovalOrgsCount}</h4>
                    </div>
                    <div className="p-2.5 bg-violet-50 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/30">
                        <Users size={16} />
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted tracking-wider block">Suspended</span>
                        <h4 className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 tracking-tight">{suspendedOrgsCount}</h4>
                    </div>
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-650 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30">
                        <AlertCircle size={16} />
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted tracking-wider block">Pending Deletion</span>
                        <h4 className="text-xl font-black text-red-650 mt-1 tracking-tight">{pendingDeletionOrgsCount}</h4>
                    </div>
                    <div className="p-2.5 bg-red-50 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30">
                        <Trash2 size={16} />
                    </div>
                </div>
            </div>
        );
    };

    const renderInsightsPanel = () => {
        const totalOrgs = organizations.length;
        const activeOrgsCount = organizations.filter(o => o.status === 'active' && !isPendingDeletion(o)).length;
        const pendingApprovalOrgsCount = organizations.filter(o => o.status === 'pending_approval' && !isPendingDeletion(o)).length;
        const suspendedOrgsCount = organizations.filter(o => o.status === 'suspended' && !isPendingDeletion(o)).length;
        const pendingDeletionOrgsCount = organizations.filter(o => isPendingDeletion(o)).length;

        const plans = {};
        organizations.forEach(o => {
            const plan = o.subscription_plan || 'Trial';
            plans[plan] = (plans[plan] || 0) + 1;
        });
        const planDistribution = Object.keys(plans).map(key => ({
            name: key,
            count: plans[key]
        }));

        const statusDistribution = [
            { name: 'Active', value: activeOrgsCount, color: '#10b981' },
            { name: 'Pending Approval', value: pendingApprovalOrgsCount, color: '#8b5cf6' },
            { name: 'Suspended', value: suspendedOrgsCount, color: '#f59e0b' },
            { name: 'Pending Deletion', value: pendingDeletionOrgsCount, color: '#ef4444' }
        ].filter(item => item.value > 0);

        const topTenantsData = [...organizations]
            .sort((a, b) => (b.max_users || 0) - (a.max_users || 0))
            .slice(0, 5)
            .map(o => ({
                name: o.org_name.length > 10 ? o.org_name.substring(0, 8) + '..' : o.org_name,
                limit: o.max_users || 0
            }));

        return (
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: isInsightsOpen ? 'auto' : 0, opacity: isInsightsOpen ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden space-y-4 shrink-0"
            >
                {totalOrgs > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-4 flex flex-col h-[220px]">
                            <h4 className="text-xs font-bold text-slate-700 dark:text-github-dark-text mb-2">Subscription Plan Distribution</h4>
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

                        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-4 flex flex-col h-[220px]">
                            <h4 className="text-xs font-bold text-slate-700 dark:text-github-dark-text mb-2">Tenant Status Share</h4>
                            <div className="flex-1 min-h-0 flex items-center justify-center relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPieChart>
                                        <Pie
                                            data={statusDistribution}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={35}
                                            outerRadius={55}
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
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Active</span>
                                    <span className="text-base font-extrabold text-slate-800 dark:text-white">
                                        {totalOrgs > 0 ? Math.round((activeOrgsCount / totalOrgs) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-4 flex flex-col h-[220px]">
                            <h4 className="text-xs font-bold text-slate-700 dark:text-github-dark-text mb-2">Top Tenants by User Limit</h4>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topTenantsData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" className="dark:opacity-10" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={60} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 11 }} />
                                        <Bar dataKey="limit" fill="#10b981" radius={[0, 4, 4, 0]} name="User Limit" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                ) : null}
            </motion.div>
        );
    };

    const renderDrawerForm = () => {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-dark-card">
                {/* Form Header */}
                <div className="py-4 flex justify-between items-center bg-slate-50/50 dark:bg-github-dark-subtle/20 shrink-0">
                    <div className="flex items-center gap-2">
                        <Building size={20} className="text-indigo-500" />
                        <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-sm uppercase tracking-wider">
                            {selectedOrg ? 'Edit Organization' : 'Create Organization'}
                        </h3>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditing(false);
                                if (selectedOrg) {
                                    handleSelectOrg(selectedOrg); // reset form
                                }
                            }}
                            className="px-3 py-1.5 border border-slate-200 dark:border-github-dark-border text-slate-655 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold active:scale-95 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-70 shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                        >
                            {formLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save
                        </button>
                    </div>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto py-6 px-0 no-scrollbar space-y-6">
                    {/* General Details Card */}
                    <div className="bg-slate-50/30 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border/50 p-4 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-github-dark-border/50 flex items-center gap-1.5">
                            General Details
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Org Name</label>
                                <input
                                    required
                                    value={formData.org_name}
                                    onChange={(e) => {
                                        setFormData({ ...formData, org_name: e.target.value });
                                        if (validationErrors.org_name) {
                                            setValidationErrors(prev => ({ ...prev, org_name: null }));
                                        }
                                    }}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-1 text-xs ${validationErrors.org_name
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                        : 'border-slate-300 dark:border-github-dark-border focus:border-indigo-500 focus:ring-indigo-500'
                                        }`}
                                    placeholder="Acme Corp"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Org Code</label>
                                <div className="relative">
                                    <input
                                        required
                                        value={formData.org_code}
                                        onChange={(e) => {
                                            setIsOrgCodeManuallyEdited(true);
                                            setFormData({ ...formData, org_code: e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase() });
                                            if (validationErrors.org_code) {
                                                setValidationErrors(prev => ({ ...prev, org_code: null }));
                                            }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-1 font-mono text-xs ${validationErrors.org_code ? 'border-red-500 focus:border-red-500 focus:ring-red-500' :
                                            codeAvailability === 'available' ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500' :
                                                codeAvailability === 'unavailable' ? 'border-red-500 focus:border-red-500 focus:ring-red-500' :
                                                    codeAvailability === 'invalid' ? 'border-amber-505 focus:border-amber-500 focus:ring-amber-500' :
                                                        'border-slate-300 dark:border-github-dark-border focus:border-indigo-500 focus:ring-indigo-500'
                                            }`}
                                        placeholder="ACM"
                                    />
                                    {isCheckingCode && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <Loader2 size={14} className="animate-spin text-slate-400" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Details Card */}
                    <div className="bg-slate-50/30 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border/50 p-4 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-github-dark-border/50">
                            Contact Details
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1 sm:col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Contact Person Name</label>
                                <input
                                    value={formData.contact_name}
                                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-github-dark-border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Contact Email</label>
                                <input
                                    type="email"
                                    value={formData.contact_email}
                                    onChange={(e) => {
                                        setFormData({ ...formData, contact_email: e.target.value });
                                        if (validationErrors.contact_email) {
                                            setValidationErrors(prev => ({ ...prev, contact_email: null }));
                                        }
                                    }}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-1 text-xs ${validationErrors.contact_email
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                        : 'border-slate-300 dark:border-github-dark-border focus:border-indigo-500 focus:ring-indigo-500'
                                        }`}
                                    placeholder="contact@acme.com"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Contact Phone</label>
                                <PhoneInput
                                    value={formData.contact_phone}
                                    onChange={(val) => {
                                        setFormData({ ...formData, contact_phone: val });
                                        if (validationErrors.contact_phone) {
                                            setValidationErrors(prev => ({ ...prev, contact_phone: null }));
                                        }
                                    }}
                                    variant="admin-desktop"
                                    error={!!validationErrors.contact_phone}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tax & Registration Card */}
                    <div className="bg-slate-50/30 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border/50 p-4 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-github-dark-border/50">
                            Tax & Registration (Optional)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">GST Number</label>
                                <input
                                    value={formData.gst_number || ''}
                                    onChange={(e) => {
                                        setFormData({ ...formData, gst_number: e.target.value });
                                        if (validationErrors.gst_number) {
                                            setValidationErrors(prev => ({ ...prev, gst_number: null, pan_number: null }));
                                        }
                                    }}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-1 text-xs uppercase font-mono ${validationErrors.gst_number
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                        : 'border-slate-300 dark:border-github-dark-border focus:border-indigo-500 focus:ring-indigo-500'
                                        }`}
                                    placeholder="22AAAAA0000A1Z5"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">PAN Number</label>
                                <input
                                    value={formData.pan_number || ''}
                                    onChange={(e) => {
                                        setFormData({ ...formData, pan_number: e.target.value });
                                        if (validationErrors.pan_number) {
                                            setValidationErrors(prev => ({ ...prev, pan_number: null }));
                                        }
                                    }}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-1 text-xs uppercase font-mono ${validationErrors.pan_number
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                        : 'border-slate-300 dark:border-github-dark-border focus:border-indigo-500 focus:ring-indigo-500'
                                        }`}
                                    placeholder="ABCDE1234F"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Subscription & Settings Card */}
                    <div className="bg-slate-50/30 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border/50 p-4 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-github-dark-border/50">
                            Subscription & Settings
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-github-dark-border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs appearance-none"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Subscription Plan</label>
                                <select
                                    value={formData.subscription_plan}
                                    onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-github-dark-border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs appearance-none"
                                >
                                    <option value="Trial">Trial</option>
                                    <option value="Basic">Basic</option>
                                    <option value="Premium">Premium</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Expiry Date</label>
                                <input
                                    type="date"
                                    value={formData.subscription_expiry}
                                    onChange={(e) => setFormData({ ...formData, subscription_expiry: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-github-dark-border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Grace Period (Days)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.grace_period_days}
                                    onChange={(e) => setFormData({ ...formData, grace_period_days: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-github-dark-border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                />
                            </div>

                            <div className="space-y-1 sm:col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">Max Users Allowed</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.max_users}
                                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-github-dark-border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Initial Admin Setup (Create Mode Only) */}
                    {!selectedOrg && (
                        <div className="bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 p-4 rounded-xl space-y-4">
                            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider pb-1.5 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center gap-1.5">
                                Initial Admin Credentials
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[10px] font-bold text-indigo-900/80 dark:text-indigo-400 uppercase tracking-wider">Admin Name</label>
                                    <input
                                        value={formData.admin_name}
                                        onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-305 dark:border-github-dark-border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                                        placeholder="Admin Supervisor"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-indigo-900/80 dark:text-indigo-400 uppercase tracking-wider">Admin Email <span className="text-red-500">*</span></label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.admin_email}
                                        onChange={(e) => {
                                            setFormData({ ...formData, admin_email: e.target.value });
                                            if (validationErrors.admin_email) {
                                                setValidationErrors(prev => ({ ...prev, admin_email: null }));
                                            }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-1 text-xs ${validationErrors.admin_email
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                            : 'border-slate-300 dark:border-github-dark-border focus:border-indigo-500 focus:ring-indigo-500'
                                            }`}
                                        placeholder="admin@example.com"
                                    />
                                    {validationErrors.admin_email && <p className="text-[10px] text-red-550 font-semibold mt-0.5">{validationErrors.admin_email}</p>}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-indigo-900/80 dark:text-indigo-400 uppercase tracking-wider">Admin Phone</label>
                                    <PhoneInput
                                        value={formData.admin_phone}
                                        onChange={(val) => {
                                            setFormData({ ...formData, admin_phone: val });
                                            if (validationErrors.admin_phone) {
                                                setValidationErrors(prev => ({ ...prev, admin_phone: null }));
                                            }
                                        }}
                                        variant="admin-desktop"
                                        placeholder="Admin Phone"
                                        error={!!validationErrors.admin_phone}
                                    />
                                    {validationErrors.admin_phone && <p className="text-[10px] text-red-550 font-semibold mt-0.5">{validationErrors.admin_phone}</p>}
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[10px] font-bold text-indigo-900/80 dark:text-indigo-400 uppercase tracking-wider">Admin Password <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.admin_password}
                                        onChange={(e) => {
                                            setFormData({ ...formData, admin_password: e.target.value });
                                            if (validationErrors.admin_password) {
                                                setValidationErrors(prev => ({ ...prev, admin_password: null }));
                                            }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-1 font-mono text-xs ${validationErrors.admin_password
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                            : 'border-slate-300 dark:border-github-dark-border focus:border-indigo-500 focus:ring-indigo-500'
                                            }`}
                                        placeholder="••••••••"
                                    />
                                    {validationErrors.admin_password && <p className="text-[10px] text-red-550 font-semibold mt-0.5">{validationErrors.admin_password}</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderOrgLogsConsole = () => {
        if (!selectedOrg) return null;
        return (
            <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col shadow-sm">
                {/* Log Filters Header */}
                <div className="p-4 border-b border-slate-150 dark:border-github-dark-border bg-slate-50/40 dark:bg-github-dark-subtle/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-github-dark-text text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Terminal size={14} /> API Activity Console
                                {logPagination.total > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-github-dark-muted border border-slate-200 dark:border-github-dark-border normal-case tracking-normal">
                                        {logPagination.total.toLocaleString()} Logs
                                    </span>
                                )}
                            </h4>
                        </div>
                        <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-github-dark-border">
                            <button
                                type="button"
                                onClick={() => { setLogType('activity'); setLogModule(''); setLogPlatform(''); setLogPage(1); }}
                                className={`px-2 py-1 rounded-md text-[8px] uppercase font-black tracking-wider transition-all duration-200 ${logType === 'activity'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-650 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-550 dark:text-github-dark-muted'
                                    }`}
                            >
                                Activity
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLogType('errors'); setLogModule(''); setLogPlatform(''); setLogPage(1); }}
                                className={`px-2 py-1 rounded-md text-[8px] uppercase font-black tracking-wider transition-all duration-200 ${logType === 'errors'
                                    ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm'
                                    : 'text-slate-550 dark:text-github-dark-muted'
                                    }`}
                            >
                                Errors
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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
                                triggerClassName="bg-white dark:bg-slate-800 border-slate-200 dark:border-github-dark-border text-[10px] py-1 px-2 font-bold"
                            />
                        )}

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
                            triggerClassName="bg-white dark:bg-slate-800 border-slate-200 dark:border-github-dark-border text-[10px] py-1 px-2 font-bold"
                        />

                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={logSearch}
                                onChange={(e) => {
                                    setLogSearch(e.target.value);
                                    setLogPage(1);
                                }}
                                className="w-full pl-7 pr-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-github-dark-border rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-300 font-medium"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => fetchOrgLogs(selectedOrg.org_id, 1)}
                            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-github-dark-border rounded-lg hover:text-indigo-600 text-slate-500 active:scale-95 transition-all shadow-sm"
                            title="Reload logs"
                        >
                            <RefreshCw size={10} className={loadingLogs ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Log List */}
                <div className="overflow-x-auto max-h-[550px] overflow-y-auto no-scrollbar border border-slate-100 dark:border-github-dark-border rounded-xl">
                    {loadingLogs ? (
                        <div className="py-12 flex justify-center items-center"><Loader2 className="animate-spin text-slate-400" size={18} /></div>
                    ) : logs.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 dark:text-github-dark-muted flex flex-col items-center justify-center gap-1">
                            <Database size={24} className="opacity-55 text-indigo-500" />
                            <span className="text-xs font-semibold">No logs discovered.</span>
                        </div>
                    ) : (
                        <table className="w-full text-left text-[11px] whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-github-dark-subtle/80 border-b border-slate-200 dark:border-github-dark-border text-slate-650 dark:text-github-dark-muted font-bold uppercase tracking-wider sticky top-0 z-10">
                                {logType === 'activity' ? (
                                    <tr>
                                        <th className="px-4 py-2 font-semibold">Time</th>
                                        <th className="px-4 py-2 font-semibold">Module</th>
                                        <th className="px-4 py-2 font-semibold">Action Description</th>
                                        <th className="px-4 py-2 font-semibold">User</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-4 py-2 font-semibold">Time</th>
                                        <th className="px-4 py-2 font-semibold">Method/Path</th>
                                        <th className="px-4 py-2 font-semibold">Error Message</th>
                                        <th className="px-4 py-2 font-semibold">User</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-105 dark:divide-slate-800/60 font-medium">
                                {logs.map(log => {
                                    const logId = log.activity_id || log.error_id;
                                    const isExpanded = expandedLogId === logId;
                                    return (
                                        <React.Fragment key={logId}>
                                            <tr
                                                onClick={() => setExpandedLogId(isExpanded ? null : logId)}
                                                className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer select-none ${logType === 'errors' ? 'hover:bg-red-500/5 dark:hover:bg-red-500/5' : ''
                                                    }`}
                                            >
                                                <td className="px-4 py-2 font-mono text-slate-400">
                                                    {new Date(log.occurred_at).toLocaleTimeString()}
                                                </td>
                                                {logType === 'activity' ? (
                                                    <>
                                                        <td className="px-4 py-2">
                                                            <span className="px-1.5 py-0.5 rounded font-black text-[8px] uppercase border bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800/30">
                                                                {log.module}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 max-w-[200px] truncate text-slate-700 dark:text-slate-300 font-semibold" title={log.description}>
                                                            {log.description}
                                                        </td>
                                                        <td className="px-4 py-2 font-bold text-slate-900 dark:text-white">
                                                            {log.user_name || 'System Auto'}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-4 py-2 font-mono">
                                                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-750 dark:bg-slate-700 dark:text-slate-300 font-bold mr-1 text-[8px]">
                                                                {log.request_method}
                                                            </span>
                                                            <span className="text-slate-605 dark:text-github-dark-muted">{log.request_path || 'Background Job'}</span>
                                                        </td>
                                                        <td className="px-4 py-2 max-w-[200px] truncate text-red-650 dark:text-red-400 font-bold" title={log.error_message}>
                                                            {log.error_message}
                                                        </td>
                                                        <td className="px-4 py-2 text-slate-600 dark:text-github-dark-muted font-bold">
                                                            {log.user_name || 'Anonymous'}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={4} className="bg-slate-50 dark:bg-slate-900/60 p-3 border-t border-b border-slate-100 dark:border-slate-800">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <h5 className="text-[9px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
                                                                    <Terminal size={10} /> Log Inspector
                                                                </h5>
                                                                {logType === 'errors' && log.stack_trace && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigator.clipboard.writeText(log.stack_trace);
                                                                            toast.success("Stack trace copied");
                                                                        }}
                                                                        className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-bold transition-all text-[8px] uppercase tracking-wider active:scale-95"
                                                                    >
                                                                        Copy Trace
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <pre className="p-3 bg-slate-900 text-slate-300 rounded-lg overflow-x-auto text-[10px] font-mono break-all whitespace-pre-wrap max-h-48 border border-slate-800 no-scrollbar shadow-inner">
                                                                {logType === 'activity'
                                                                    ? JSON.stringify(log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : log, null, 2)
                                                                    : log.stack_trace || JSON.stringify(log, null, 2)
                                                                }
                                                            </pre>
                                                            <div className="flex gap-4 text-[9px] text-slate-550 font-mono">
                                                                <span>IP: {log.request_ip || 'N/A'}</span>
                                                                <span>Platform: {log.platform}</span>
                                                            </div>
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
        );
    };

    const renderDrawerDetails = () => {
        if (!selectedOrg) return null;

        return (
            <div className="flex flex-col h-full bg-white dark:bg-dark-card animate-fade-in">
                {/* Details Sub-Header Actions */}
                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-github-dark-subtle/20 shrink-0">
                    <div className="flex items-center gap-2">
                        <Building className="text-indigo-650 dark:text-indigo-400" size={18} />
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-xs flex items-center gap-1.5">
                                {selectedOrg.org_name}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${selectedOrg.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : selectedOrg.status === 'pending_approval'
                                        ? 'bg-violet-100 text-violet-750 dark:bg-violet-900/30 dark:text-violet-405'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                    {selectedOrg.status}
                                </span>
                            </h3>
                            <p className="text-[10px] text-slate-500 dark:text-github-dark-muted font-mono">Code: {selectedOrg.org_code}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="px-2.5 py-1.5 border border-slate-200 dark:border-github-dark-border hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-github-dark-subtle text-slate-700 dark:text-github-dark-text rounded-lg font-semibold transition-all text-[10px] flex items-center gap-1 shadow-sm active:scale-95"
                        >
                            <Pencil size={12} />
                            Edit details
                        </button>

                        {selectedOrg.status === 'pending_deletion' && (
                            <button
                                type="button"
                                onClick={handleCancelDeletion}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all text-[10px] flex items-center gap-1 shadow-sm active:scale-95"
                            >
                                <RotateCcw size={12} /> Recover
                            </button>
                        )}

                        {selectedOrg.status === 'pending_approval' && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleApprove}
                                    className="px-2.5 py-1.5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all text-[10px] active:scale-95 shadow-sm"
                                >
                                    Approve
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all text-[10px] active:scale-95 shadow-sm"
                                >
                                    Reject
                                </button>
                            </>
                        )}

                        {selectedOrg.status !== 'suspended' && selectedOrg.status !== 'pending_deletion' && selectedOrg.status !== 'pending_approval' && (
                            <button
                                type="button"
                                onClick={handleDeactivate}
                                className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-400 rounded-lg font-semibold transition-all text-[10px] active:scale-95"
                            >
                                Deactivate
                            </button>
                        )}

                        {selectedOrg.status === 'suspended' && (
                            <button
                                type="button"
                                onClick={handleReactivate}
                                className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-205 text-emerald-700 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 rounded-lg font-semibold transition-all text-[10px] active:scale-95"
                            >
                                Reactivate
                            </button>
                        )}

                        {selectedOrg.status !== 'pending_deletion' && selectedOrg.status !== 'pending_approval' && (
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmOrg(selectedOrg)}
                                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all text-[10px] flex items-center gap-1 shadow-sm active:scale-95"
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                        )}
                    </div>
                </div>

                {/* Inner Drawer Tabs navigation */}
                <div className="py-2 bg-slate-50/20 dark:bg-github-dark-subtle/5 shrink-0 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveDetailTab('details')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeDetailTab === 'details'
                            ? 'bg-white dark:bg-slate-700 text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-205 dark:border-github-dark-border/40'
                            : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-750 dark:hover:text-slate-200'
                            }`}
                    >
                        <Building size={13} />
                        <span>Profile & Admins</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveDetailTab('logs')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeDetailTab === 'logs'
                            ? 'bg-white dark:bg-slate-700 text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-205 dark:border-github-dark-border/40'
                            : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-750 dark:hover:text-slate-200'
                            }`}
                    >
                        <Terminal size={13} />
                        <span>Org Activity Logs</span>
                    </button>
                </div>

                {/* Drawer Body Scrollable */}
                <div className="flex-1 overflow-y-auto py-6 px-0 no-scrollbar">
                    {activeDetailTab === 'details' ? (
                        <div className="space-y-6">
                            {selectedOrg?.status === 'pending_deletion' && (
                                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-205 dark:border-amber-700/40 rounded-xl">
                                    <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-amber-800 dark:text-amber-300 text-xs">Organization Scheduled for Deletion</p>
                                        <p className="text-amber-750 dark:text-amber-450 text-[11px] mt-0.5">
                                            This organization will be permanently deleted on{' '}
                                            <strong>
                                                {selectedOrg.deletion_scheduled_at
                                                    ? new Date(selectedOrg.deletion_scheduled_at).toLocaleDateString()
                                                    : 'the scheduled date'}
                                            </strong>. Recover it above if this was a mistake.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Details Grid Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-4 rounded-xl space-y-3">
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-github-dark-text pb-1 border-b border-slate-200 dark:border-github-dark-border">
                                        General & Contact Info
                                    </h4>
                                    <div className="space-y-2 text-xs">
                                        <div>
                                            <span className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400">Contact Person</span>
                                            <span className="font-semibold text-slate-800 dark:text-github-dark-text">{selectedOrg.contact_name || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400">Contact Email</span>
                                            <span className="font-semibold text-slate-800 dark:text-github-dark-text truncate block" title={selectedOrg.contact_email}>{selectedOrg.contact_email || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400">Contact Phone</span>
                                            <span className="font-mono font-semibold text-slate-800 dark:text-github-dark-text">{selectedOrg.contact_phone || 'N/A'}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400">GST Number</span>
                                                <span className="font-mono text-slate-800 dark:text-github-dark-text">{selectedOrg.gst_number || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400">PAN Number</span>
                                                <span className="font-mono text-slate-800 dark:text-github-dark-text">{selectedOrg.pan_number || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Subscription Card */}
                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-4 rounded-xl space-y-3">
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-github-dark-text pb-1 border-b border-slate-200 dark:border-github-dark-border">
                                        Subscription Settings
                                    </h4>
                                    <div className="space-y-2 text-xs">
                                        <div>
                                            <span className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400">Plan Billing Tier</span>
                                            <span className="font-semibold text-slate-800 dark:text-github-dark-text">{selectedOrg.subscription_plan}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400">Subscription Expiry</span>
                                            <span className="font-semibold text-slate-800 dark:text-github-dark-text">
                                                {selectedOrg.subscription_expiry ? new Date(selectedOrg.subscription_expiry).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Lifetime / Processing'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400">Grace Period</span>
                                                <span className="font-semibold text-slate-800 dark:text-github-dark-text">{selectedOrg.grace_period_days} Days</span>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400">Users Limit</span>
                                                <span className="font-semibold text-slate-800 dark:text-github-dark-text">{selectedOrg.max_users} Max</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Capacity Stats Card */}
                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-4 rounded-xl space-y-2 sm:col-span-2">
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-github-dark-text pb-1 border-b border-slate-200 dark:border-github-dark-border">
                                        Capacity & Live Usage Metrics
                                    </h4>
                                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                                        <div className="bg-white dark:bg-slate-800/50 border border-slate-105 dark:border-github-dark-border/40 p-2.5 rounded-lg">
                                            <span className="text-[8px] tracking-wider font-bold text-slate-450 dark:text-github-dark-muted">Max Limit</span>
                                            <div className="text-sm font-black text-slate-800 dark:text-github-dark-text mt-0.5">{selectedOrg.max_users} Users</div>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800/50 border border-slate-105 dark:border-github-dark-border/40 p-2.5 rounded-lg">
                                            <span className="text-[8px] tracking-wider font-bold text-slate-455 dark:text-github-dark-muted">Accounts</span>
                                            <div className="text-sm font-black text-slate-800 dark:text-github-dark-text mt-0.5">{selectedOrg.total_users || 0}</div>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800/50 border border-slate-105 dark:border-github-dark-border/40 p-2.5 rounded-lg">
                                            <span className="text-[8px] tracking-wider font-bold text-slate-455 dark:text-github-dark-muted">Inactive Users</span>
                                            <div className="text-sm font-black text-slate-800 dark:text-github-dark-text mt-0.5">
                                                {selectedOrg.inactive_users || 0}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-4 rounded-xl space-y-3">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-github-dark-text pb-1 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center">
                                    <span className="flex items-center gap-1.5"><Shield size={14} className="text-indigo-500" /> Org Admins</span>
                                    <span className="bg-indigo-50 text-indigo-750 dark:bg-indigo-900/40 dark:text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{orgAdmins.length}</span>
                                </h4>
                                <div className="bg-white dark:bg-github-dark-subtle/50 rounded-lg border border-slate-250 dark:border-github-dark-border overflow-hidden shadow-sm">
                                    {loadingAdmins ? (
                                        <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-slate-400" size={16} /></div>
                                    ) : orgAdmins.length === 0 ? (
                                        <div className="p-6 text-center text-slate-500 text-xs font-semibold">No admins found.</div>
                                    ) : (
                                        <div className="overflow-x-auto no-scrollbar">
                                            <table className="w-full text-left text-xs whitespace-nowrap">
                                                <thead className="bg-slate-50 dark:bg-github-dark-subtle/80 border-b border-slate-200 dark:border-github-dark-border text-slate-655 dark:text-github-dark-muted font-bold text-[10px] uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-2.5 font-semibold">Name</th>
                                                        <th className="px-4 py-2.5 font-semibold">Email</th>
                                                        <th className="px-4 py-2.5 font-semibold">Phone</th>
                                                        <th className="px-4 py-2.5 font-semibold">Status</th>
                                                        <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-github-dark-text font-medium">
                                                    {orgAdmins.map(admin => (
                                                        <tr key={admin.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                            {editingAdminId === admin.user_id ? (
                                                                <>
                                                                    <td className="px-3 py-2">
                                                                        <input className="w-full px-2 py-1 border border-slate-350 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs focus:outline-none" value={adminFormData.user_name} onChange={e => setAdminFormData({ ...adminFormData, user_name: e.target.value })} placeholder="Name" />
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <input type="email" className="w-full px-2 py-1 border border-slate-350 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs focus:outline-none" value={adminFormData.email} onChange={e => setAdminFormData({ ...adminFormData, email: e.target.value })} placeholder="Email" />
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <input type="tel" className="w-full px-2 py-1 border border-slate-350 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs focus:outline-none" value={adminFormData.phone_no} onChange={e => setAdminFormData({ ...adminFormData, phone_no: e.target.value })} placeholder="Phone" />
                                                                    </td>
                                                                    <td className="px-3 py-2 flex gap-1">
                                                                        <select className="px-2 py-1 border border-slate-350 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-[11px] appearance-none" value={adminFormData.is_active ? '1' : '0'} onChange={e => setAdminFormData({ ...adminFormData, is_active: e.target.value === '1' })}>
                                                                            <option value="1">Active</option>
                                                                            <option value="0">Disabled</option>
                                                                        </select>
                                                                        <input type="text" className="w-20 px-2 py-1 border border-slate-350 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs focus:outline-none font-mono" value={adminFormData.password} onChange={e => setAdminFormData({ ...adminFormData, password: e.target.value })} placeholder="New Pwd?" />
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right">
                                                                        <div className="flex items-center justify-end gap-2 text-[11px] font-bold">
                                                                            <button type="button" onClick={() => handleSaveAdmin(admin.user_id)} className="text-emerald-650 hover:text-emerald-700 transition-colors">Save</button>
                                                                            <button type="button" onClick={() => setEditingAdminId(null)} className="text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                                                                        </div>
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="px-4 py-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-slate-900 dark:text-github-dark-text font-bold">{admin.user_name}</span>
                                                                            <span className="text-[8px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{admin.user_code}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-slate-550 dark:text-github-dark-muted font-normal">{admin.email}</td>
                                                                    <td className="px-4 py-2 font-mono text-[10px] text-slate-550 dark:text-github-dark-muted">{admin.phone_no || '-'}</td>
                                                                    <td className="px-4 py-2">
                                                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider ${admin.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-450' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                                            {admin.is_active ? 'Active' : 'Disabled'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right">
                                                                        <button type="button" onClick={() => handleEditAdmin(admin)} className="text-indigo-600 hover:text-indigo-855 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold text-[11px] transition-colors">
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
                        </div>
                    ) : (
                        /* Logs Tab details */
                        <div className="space-y-6">
                            {/* Analytics KPI Grids */}
                            {loadingAnalytics ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="bg-slate-100 dark:bg-slate-800 h-16 rounded-xl border border-slate-200 dark:border-github-dark-border" />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 p-3 rounded-xl border border-slate-205 dark:border-github-dark-border/50 flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">API Calls</span>
                                            <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight mt-0.5">{analytics?.total_api_calls || 0}</h4>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 p-3 rounded-xl border border-slate-205 dark:border-github-dark-border/50 flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Success</span>
                                            <h4 className="text-base font-black text-emerald-600 dark:text-emerald-450 tracking-tight mt-0.5">{analytics?.success_rate ?? 100}%</h4>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 p-3 rounded-xl border border-slate-205 dark:border-github-dark-border/50 flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Latency</span>
                                            <h4 className="text-base font-black text-amber-600 dark:text-amber-455 tracking-tight mt-0.5">{analytics?.avg_latency_ms || 0} ms</h4>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/20 p-3 rounded-xl border border-slate-205 dark:border-github-dark-border/50 flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">Active Users</span>
                                            <h4 className="text-base font-black text-indigo-650 dark:text-indigo-400 tracking-tight mt-0.5">{analytics?.active_users || 0}</h4>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Charts inside Drawer */}
                            {!loadingAnalytics && analytics && analytics.module_distribution?.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-dark-card border border-slate-205 dark:border-github-dark-border rounded-xl p-3 flex flex-col h-[180px]">
                                        <h4 className="text-[8px] font-black uppercase tracking-wider text-slate-500 mb-2">Requests by Module</h4>
                                        <div className="flex-1 min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={analytics.module_distribution}>
                                                    <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                                                    <XAxis dataKey="module" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 8 }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 8 }} />
                                                    <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-dark-card border border-slate-205 dark:border-github-dark-border rounded-xl p-3 flex flex-col h-[180px]">
                                        <h4 className="text-[8px] font-black uppercase tracking-wider text-slate-500 mb-2">Platform Traffic</h4>
                                        <div className="flex-1 min-h-0 flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsPieChart>
                                                    <Pie
                                                        data={analytics.platform_distribution || []}
                                                        dataKey="count"
                                                        nameKey="platform"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={25}
                                                        outerRadius={45}
                                                        paddingAngle={3}
                                                    >
                                                        {(analytics.platform_distribution || []).map((entry, idx) => (
                                                            <Cell key={`cell-${idx}`} fill={['#6366f1', '#10b981', '#f59e0b', '#f43f5e'][idx % 4]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ fontSize: 9, padding: '4px' }} />
                                                </RechartsPieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Logs Console Call */}
                            {renderOrgLogsConsole()}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const showSubPage = selectedOrg || isEditing;

    return (
        <DashboardLayout title="Organization Management" noPadding={true}>
            <div className="p-3 space-y-3 bg-slate-50/50 dark:bg-github-dark-subtle/5 min-h-[calc(100vh-64px)] flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 py-1.5 border-b border-slate-100 dark:border-github-dark-border/40 pb-2">
                    {renderBreadcrumbs()}
                    {!showSubPage && (
                        <button
                            type="button"
                            onClick={() => setIsInsightsOpen(!isInsightsOpen)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-655 dark:text-github-dark-muted bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm active:scale-95 shrink-0"
                        >
                            <Activity size={14} className="text-indigo-550" />
                            <span>{isInsightsOpen ? 'Hide Insights & Charts' : 'Show Insights & Charts'}</span>
                            {isInsightsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                </div>

                {!showSubPage ? (
                    <>

                        {renderKpiCards()}
                        {renderInsightsPanel()}

                        {/* Controls row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 shrink-0">
                            <div className="flex p-0.5 bg-[#f6f8fa] dark:bg-github-dark-subtle rounded-lg border border-slate-200 dark:border-github-dark-border">
                                <button
                                    type="button"
                                    onClick={() => { setListTab('active'); setSelectedOrg(null); setIsEditing(false); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${listTab === 'active'
                                        ? 'bg-white dark:bg-[#21262d] text-indigo-650 dark:text-github-dark-accent shadow-sm border border-slate-200/50 dark:border-github-dark-border'
                                        : 'text-slate-500 hover:text-slate-750 dark:text-github-dark-muted dark:hover:text-github-dark-text hover:bg-slate-200/20 dark:hover:bg-[#21262d]/50'
                                        }`}
                                >
                                    <Shield size={13} className="text-emerald-500" />
                                    <span>Active Orgs</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setListTab('approval'); setSelectedOrg(null); setIsEditing(false); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${listTab === 'approval'
                                        ? 'bg-white dark:bg-[#21262d] text-indigo-650 dark:text-github-dark-accent shadow-sm border border-slate-200/50 dark:border-github-dark-border'
                                        : 'text-slate-500 hover:text-slate-755 dark:text-github-dark-muted dark:hover:text-github-dark-text hover:bg-slate-200/20 dark:hover:bg-[#21262d]/50'
                                        }`}
                                >
                                    <Users size={13} className="text-violet-500" />
                                    <span>Approval Queue ({approvalOrgs.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setListTab('deleted'); setSelectedOrg(null); setIsEditing(false); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${listTab === 'deleted'
                                        ? 'bg-white dark:bg-[#21262d] text-indigo-650 dark:text-github-dark-accent shadow-sm border border-slate-200/50 dark:border-github-dark-border'
                                        : 'text-slate-550 hover:text-slate-755 dark:text-github-dark-muted dark:hover:text-github-dark-text hover:bg-slate-200/20 dark:hover:bg-[#21262d]/50'
                                        }`}
                                >
                                    <Trash2 size={13} className="text-red-500" />
                                    <span>Deleted Orgs</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                    <input
                                        type="text"
                                        placeholder="Search organizations..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-205 dark:border-github-dark-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-github-dark-text font-medium w-64"
                                    />
                                </div>

                                {/* Column Visibility Dropdown */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-github-dark-text bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 active:scale-95 shadow-sm"
                                        title="Choose visible columns"
                                    >
                                        <SlidersHorizontal size={13} />
                                        <span>Columns</span>
                                    </button>
                                    {isColumnDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsColumnDropdownOpen(false)} />
                                            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-20 py-2 animate-in fade-in zoom-in-95 duration-100 text-slate-800 dark:text-slate-200">
                                                <div className="px-4 py-1 text-[9px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-1.5 mb-1.5">
                                                    Toggle Columns
                                                </div>
                                                {Object.keys(visibleColumns).map((colKey) => {
                                                    const labels = {
                                                        orgInfo: 'Organization',
                                                        activeUsers: 'Active Users',
                                                        inactiveUsers: 'Inactive Users',
                                                        maxUsers: 'Max Users',
                                                        contact: 'Contact Person',
                                                        dates: 'Dates',
                                                        status: 'Status',
                                                        actions: 'Actions'
                                                    };
                                                    return (
                                                        <label
                                                            key={colKey}
                                                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer select-none"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={visibleColumns[colKey]}
                                                                onChange={() => setVisibleColumns(prev => ({
                                                                    ...prev,
                                                                    [colKey]: !prev[colKey]
                                                                }))}
                                                                className="rounded text-indigo-650 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 bg-transparent cursor-pointer"
                                                            />
                                                            <span>{labels[colKey]}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddNew}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                                >
                                    <Plus size={14} /> Add Organization
                                </button>
                            </div>
                        </div>

                        {/* Table area */}
                        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                            {loading ? (
                                <div className="flex-grow py-20 flex justify-center items-center"><Loader2 className="animate-spin text-slate-400" /></div>
                            ) : displayedOrgs.length === 0 ? (
                                <div className="flex-grow flex flex-col items-center justify-center py-20 text-slate-455 dark:text-github-dark-muted gap-2">
                                    <Building size={32} className="opacity-55 text-indigo-500" />
                                    <span className="text-xs font-semibold">No organizations found.</span>
                                </div>
                            ) : (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                                        <thead className="border-b border-slate-200 dark:border-github-dark-border text-slate-500 dark:text-github-dark-muted font-bold uppercase tracking-wider">
                                            <tr>
                                                {visibleColumns.orgInfo && <th className="px-6 py-2.5 sticky top-0 z-10 bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">Organization</th>}
                                                {visibleColumns.activeUsers && <th className="px-6 py-2.5 sticky top-0 z-10 bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">Active Users</th>}
                                                {visibleColumns.inactiveUsers && <th className="px-6 py-2.5 sticky top-0 z-10 bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">Inactive Users</th>}
                                                {visibleColumns.maxUsers && <th className="px-6 py-2.5 sticky top-0 z-10 bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">Max Users</th>}
                                                {visibleColumns.contact && <th className="px-6 py-2.5 sticky top-0 z-10 bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">Contact Person</th>}
                                                {visibleColumns.dates && <th className="px-6 py-2.5 sticky top-0 z-10 bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">Start & End Date</th>}
                                                {visibleColumns.status && <th className="px-6 py-2.5 sticky top-0 z-10 bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">Status</th>}
                                                {visibleColumns.actions && <th className="px-6 py-2.5 text-right sticky top-0 z-10 bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                            {displayedOrgs.map(org => {
                                                const isSelected = selectedOrg?.org_id === org.org_id;
                                                return (
                                                    <tr
                                                        key={org.org_id}
                                                        onClick={() => handleSelectOrg(org)}
                                                        className={`cursor-pointer transition-all duration-200 select-none border-l-2 ${isSelected
                                                            ? 'bg-indigo-50/40 dark:bg-indigo-900/10 border-l-indigo-500'
                                                            : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-l-transparent'
                                                            }`}
                                                    >
                                                        {visibleColumns.orgInfo && (
                                                            <td className="px-6 py-3.5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg text-indigo-650 dark:text-indigo-400">
                                                                        <Building size={14} />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-bold text-slate-900 dark:text-github-dark-text block">{org.org_name}</span>
                                                                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">CODE: {org.org_code}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.activeUsers && (
                                                            <td className="px-6 py-3.5">
                                                                <span className="font-bold text-slate-800 dark:text-github-dark-text">{org.active_users || 0}</span>
                                                            </td>
                                                        )}
                                                        {visibleColumns.inactiveUsers && (
                                                            <td className="px-6 py-3.5">
                                                                <span className="font-bold text-slate-800 dark:text-github-dark-text">{org.inactive_users || 0}</span>
                                                            </td>
                                                        )}
                                                        {visibleColumns.maxUsers && (
                                                            <td className="px-6 py-3.5">
                                                                <div>
                                                                    <span className="font-bold text-slate-800 dark:text-github-dark-text block">{org.max_users}</span>
                                                                    <span className="text-[10px] text-slate-555 dark:text-github-dark-muted block mt-0.5">
                                                                        {org.subscription_plan} Plan
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.contact && (
                                                            <td className="px-6 py-3.5">
                                                                <div>
                                                                    <span className="font-bold text-slate-800 dark:text-github-dark-text block">{org.contact_name}</span>
                                                                    <span className="text-[10px] text-slate-555 dark:text-github-dark-muted block font-mono mt-0.5">
                                                                        {org.contact_email} • {org.contact_phone}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.dates && (
                                                            <td className="px-6 py-3.5 text-slate-700 dark:text-github-dark-text text-[11px] font-semibold">
                                                                <div>
                                                                    <span>Start: {org.created_at ? new Date(org.created_at).toLocaleDateString() : '-'}</span>
                                                                    <span className="block mt-0.5 text-slate-500 dark:text-github-dark-muted font-normal">End: {org.subscription_expiry ? new Date(org.subscription_expiry).toLocaleDateString() : 'No expiry'}</span>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.status && (
                                                            <td className="px-6 py-3.5">
                                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${org.status === 'active'
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-455'
                                                                    : org.status === 'pending_approval'
                                                                        ? 'bg-violet-100 text-violet-750 dark:bg-violet-900/30 dark:text-violet-400'
                                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                    }`}>
                                                                    {org.status}
                                                                </span>
                                                            </td>
                                                        )}
                                                        {visibleColumns.actions && (
                                                            <td className="px-6 py-3.5 text-right">
                                                                <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                                    {listTab === 'active' && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { handleSelectOrg(org); setIsEditing(true); }}
                                                                                className="p-1 hover:text-indigo-650 hover:bg-indigo-50 dark:hover:bg-indigo-955/40 rounded transition-colors text-slate-400"
                                                                                title="Edit details"
                                                                            >
                                                                                <Pencil size={13} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setSelectedOrg(org); setDeleteConfirmOrg(org); }}
                                                                                className="p-1 hover:text-red-655 hover:bg-red-50 dark:hover:bg-red-955/40 rounded transition-colors text-slate-400"
                                                                                title="Delete"
                                                                            >
                                                                                <Trash2 size={13} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {listTab === 'approval' && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setSelectedOrg(org); handleApprove(); }}
                                                                                className="px-2.5 py-1 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md font-bold hover:bg-emerald-100 transition-colors"
                                                                            >
                                                                                Approve
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setSelectedOrg(org); handleReject(); }}
                                                                                className="px-2.5 py-1 text-[10px] bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-450 rounded-md font-bold hover:bg-red-100 transition-colors"
                                                                            >
                                                                                Reject
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {listTab === 'deleted' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setSelectedOrg(org); handleCancelDeletion(); }}
                                                                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-450 border border-emerald-105 dark:border-emerald-800/20 rounded-md font-bold hover:bg-emerald-100/50 active:scale-95 transition-all"
                                                                        >
                                                                            <RotateCcw size={10} /> Recover
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col">
                        <form onSubmit={handleSave} className="flex flex-col h-full">
                            {isEditing ? renderDrawerForm() : renderDrawerDetails()}
                        </form>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-slate-200 dark:border-github-dark-border w-full max-w-md mx-4 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-github-dark-border flex items-center gap-3">
                            <div className="p-2.5 bg-red-105 dark:bg-red-900/30 rounded-lg">
                                <Trash2 size={20} className="text-red-650 dark:text-red-400" />
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
                                className="px-4 py-2 border border-slate-200 dark:border-github-dark-border text-slate-655 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
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
