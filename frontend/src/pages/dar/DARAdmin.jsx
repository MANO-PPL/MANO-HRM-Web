
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Activity, Settings, Database, FileText
} from 'lucide-react';
import api from '../../services/api';
import DashboardInsights from '../../components/dar/admin/DashboardInsights';
import RequestManager from '../../components/dar/admin/RequestManager';
import MasterDataView from '../../components/dar/admin/MasterDataView';
import AdminConfigurations from '../../components/dar/admin/AdminConfigurations';

const DARAdmin = ({ embedded = false, activeTab: propActiveTab, setActiveTab: propSetActiveTab }) => {
    const [localActiveTab, localSetActiveTab] = useState('insights'); // 'insights' | 'requests' | 'data'
    const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
    const setActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : localSetActiveTab;
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // --- SHARED DATA STATE ---
    const [departments, setDepartments] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [allUsers, setAllUsers] = useState([]); // Store full user list

    useEffect(() => {
        // Fetch total employees count & list
        const fetchUsers = async () => {
            try {
                const res = await api.get('/admin/users');
                if (res.data.success) {
                    setAllUsers(res.data.users.map(u => ({
                        userId: u.user_id,
                        name: u.user_name,
                        dept: u.dept_name,
                        shift: u.shift_name,
                        role: u.user_type,
                        designation: u.desg_name || 'N/A'
                    })));
                }
            } catch (e) {
                console.error("Failed to fetch users", e);
            }
        };

        // Fetch Departments & Shifts
        const fetchDeptsAndShifts = async () => {
            // 1. Departments
            try {
                const res = await api.get('/admin/departments');
                if (res.data.success) {
                    // Ensure uniqueness to prevent duplicate keys
                    const uniqueDepts = [...new Set(res.data.departments.map(d => d.dept_name))];
                    setDepartments(uniqueDepts);
                }
            } catch (e) {
                console.error("Failed to fetch departments", e);
            }

            // 2. Shifts
            try {
                const res = await api.get('/policies/shifts');
                if (res.data.success) {
                    setShifts(res.data.shifts);
                }
            } catch (e) {
                console.error("Failed to fetch shifts", e);
            }
        };

        fetchUsers();
        fetchDeptsAndShifts();
    }, []);

    return (
        <div className={`dar-context flex flex-col h-full bg-slate-50 dark:bg-dark-bg transition-colors ${embedded ? '' : 'p-5'}`}>

            {/* Header (Only if not embedded, or simplified) */}
            {!embedded && (
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">DAR Admin</h1>
                        <p className="text-slate-500 text-sm">Monitor daily activity reports and analytics</p>
                    </div>
                </div>
            )}

            {/* Navigation Tabs (Underline Style - matching My Attendance) */}
            <div data-tour-id="dar-admin-tabs" className="border-b border-slate-200 dark:border-github-dark-border flex gap-6 mb-4 shrink-0">
                <button
                    onClick={() => setActiveTab('insights')}
                    className={`pb-3 text-sm font-normal transition-all relative cursor-pointer ${activeTab === 'insights'
                        ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                        : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Activity size={16} />
                        <span>Insights</span>
                    </div>
                    {activeTab === 'insights' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`pb-3 text-sm font-normal transition-all relative cursor-pointer ${activeTab === 'requests'
                        ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                        : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <FileText size={16} />
                        <span>Requests</span>
                    </div>
                    {activeTab === 'requests' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('data')}
                    className={`pb-3 text-sm font-normal transition-all relative cursor-pointer ${activeTab === 'data'
                        ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                        : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Database size={16} />
                        <span>Master Data</span>
                    </div>
                    {activeTab === 'data' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">


                {/* --- MASTER DATA TAB (TIMELINE VIEW) --- */}
                {activeTab === 'data' && (
                    <div data-tour-id="dar-admin-master-data-tab-content" className="h-full">
                        <MasterDataView
                            departments={departments}
                            shifts={shifts}
                            allUsers={allUsers}
                        />
                    </div>
                )}

                {/* --- REQUESTS TAB --- */}
                {activeTab === 'requests' && (
                    <div data-tour-id="dar-admin-requests-tab-content" className="h-full">
                        <RequestManager departments={departments} />
                    </div>
                )}

                {/* --- INSIGHTS DASHBOARD --- */}
                {activeTab === 'insights' && ( // DashboardInsights expects departments and allUsers
                    <div data-tour-id="dar-admin-insights-tab-content" className="h-full">
                        <DashboardInsights
                            departments={departments}
                            allUsers={allUsers}
                            onOpenConfig={() => setIsConfigOpen(true)}
                        />
                    </div>
                )}

            </div>

            {/* --- CONFIGURATION SIDEBAR (RIGHT SLIDE) --- */}
            <AnimatePresence>
                {isConfigOpen && (
                    <Portal>
                        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsConfigOpen(false)}
                                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                            />

                            {/* Sidebar Container */}
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="relative w-full max-w-[500px] h-full bg-white dark:bg-github-dark-subtle shadow-2xl flex flex-col dar-context"
                            >
                                <AdminConfigurations onClose={() => setIsConfigOpen(false)} />
                            </motion.div>
                        </div>
                    </Portal>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- PORTAL HELPER ---
const Portal = ({ children }) => {
    return ReactDOM.createPortal(children, document.body);
};

export default DARAdmin;
