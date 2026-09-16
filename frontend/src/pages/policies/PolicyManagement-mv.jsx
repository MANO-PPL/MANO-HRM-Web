import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import ShiftManagementMobile from '../shift-management/ShiftManagement-mv';
import GeoFencingMobile from '../geofencing/GeoFencing-mv';
import SalaryPackages from '../payroll/SalaryPackages';
import LeavePolicies from '../leaves/LeavePolicies';
import { Clock, MapPin, Layers, CalendarCheck } from 'lucide-react';

const PolicyManagementMobile = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab) {
            if (tab === 'leave_policies' || tab === 'leaves' || tab === 'leave' || tab === 'policies') return 'leave_policies';
            return tab;
        }
        if (location.pathname.includes('geofencing')) return 'geofencing';
        if (location.pathname.includes('shift-management')) return 'shifts';
        return 'shifts';
    });

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab) {
            if (tab === 'leave_policies' || tab === 'leaves' || tab === 'leave' || tab === 'policies') {
                setActiveTab('leave_policies');
            } else {
                setActiveTab(tab);
            }
        } else if (location.pathname.includes('geofencing')) {
            setActiveTab('geofencing');
        } else if (location.pathname.includes('shift-management')) {
            setActiveTab('shifts');
        }
    }, [location.pathname, location.search]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        navigate(`/policies?tab=${tab}`);
    };

    return (
        <MobileDashboardLayout title="Policy Management">
            <div className="px-2 pt-2 space-y-3">
                {/* Mobile Tabs Strip */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-github-dark-subtle rounded-xl border border-slate-200/60 dark:border-github-dark-border overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => handleTabChange('shifts')}
                        className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'shifts'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                : 'text-slate-500 dark:text-github-dark-muted'
                        }`}
                    >
                        <Clock size={13} />
                        <span>Shifts</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('geofencing')}
                        className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'geofencing'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                : 'text-slate-500 dark:text-github-dark-muted'
                        }`}
                    >
                        <MapPin size={13} />
                        <span>Geo</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('salary_packages')}
                        className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'salary_packages'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                : 'text-slate-500 dark:text-github-dark-muted'
                        }`}
                    >
                        <Layers size={13} />
                        <span>Salary</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('leave_policies')}
                        className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'leave_policies'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                : 'text-slate-500 dark:text-github-dark-muted'
                        }`}
                    >
                        <CalendarCheck size={13} />
                        <span>Leaves</span>
                    </button>
                </div>

                {/* Content Panel */}
                <div className="relative">
                    {activeTab === 'shifts' && <ShiftManagementMobile embedded={true} />}
                    {activeTab === 'geofencing' && <GeoFencingMobile embedded={true} />}
                    {activeTab === 'salary_packages' && <SalaryPackages embedded={true} />}
                    {activeTab === 'leave_policies' && (
                        <div className="space-y-4 pb-24 animate-in fade-in duration-300">
                            <LeavePolicies />
                        </div>
                    )}
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

export default PolicyManagementMobile;
