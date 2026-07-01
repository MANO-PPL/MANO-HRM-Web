import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import MobileLeaveApplication from '../holidays/LeaveApplication-mv';
import LeavePolicies from './LeavePolicies';
import { ClipboardCheck, Settings } from 'lucide-react';

const MobileLeaveManagement = () => {
    const location = useLocation();

    // Determine initial tab based on URL query param or state
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

    return (
        <MobileDashboardLayout title="Leave Management">
            <div className="px-2 pt-2 space-y-3">
                {/* Mobile Tabs Strip */}
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-github-dark-subtle rounded-xl border border-slate-200/60 dark:border-github-dark-border">
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'requests'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                : 'text-slate-500 dark:text-github-dark-muted'
                        }`}
                    >
                        <ClipboardCheck size={14} />
                        <span>Requests</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('policies')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'policies'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                : 'text-slate-500 dark:text-github-dark-muted'
                        }`}
                    >
                        <Settings size={14} />
                        <span>Policies</span>
                    </button>
                </div>

                {/* Content Panel */}
                <div className="relative">
                    {activeTab === 'requests' && <MobileLeaveApplication />}
                    {activeTab === 'policies' && <LeavePolicies />}
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

export default MobileLeaveManagement;
