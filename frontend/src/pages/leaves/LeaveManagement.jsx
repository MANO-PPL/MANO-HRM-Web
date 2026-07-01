import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import LeaveApplication from '../holidays/LeaveApplication';
import LeavePolicies from './LeavePolicies';
import { ClipboardCheck, Settings } from 'lucide-react';

const LeaveManagement = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Determine initial tab based on URL query param
    const [activeTab, setActiveTab] = useState(() => {
        const queryParams = new URLSearchParams(location.search);
        const tabParam = queryParams.get('tab');
        if (tabParam === 'policies' || tabParam === 'balances') return 'policies';
        return 'requests';
    });

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const tabParam = queryParams.get('tab');
        if (tabParam === 'policies' || tabParam === 'balances') {
            setActiveTab('policies');
        } else {
            setActiveTab('requests');
        }
    }, [location.search]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        navigate(`/leave-management?tab=${tab}`);
    };

    return (
        <DashboardLayout title="Leave Management" noPadding={true}>
            <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden p-3 bg-slate-50 dark:bg-dark-bg">
                {/* Unified Tab Navigation Bar */}
                <div className="flex w-fit items-center gap-3 p-1.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0 shadow-sm mb-3">
                    <button
                        onClick={() => handleTabChange('requests')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                            activeTab === 'requests'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <ClipboardCheck size={14} className={`${activeTab === 'requests' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-450'}`} />
                        <span className="leading-none">Leave Request Manager</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('policies')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                            activeTab === 'policies'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <Settings size={14} className={`${activeTab === 'policies' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-450'}`} />
                        <span className="leading-none">Policies & Balances</span>
                    </button>
                </div>

                {/* Content Panel with hidden scroll and premium sizing */}
                <div className="flex-1 min-h-0 relative overflow-hidden">
                    {activeTab === 'requests' && (
                        <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <LeaveApplication />
                        </div>
                    )}
                    {activeTab === 'policies' && (
                        <div className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <LeavePolicies />
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default LeaveManagement;
