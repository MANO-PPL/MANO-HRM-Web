import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import ShiftManagement from '../shift-management/ShiftManagement';
import GeoFencing from '../geofencing/GeoFencing';
import SalaryPackages from '../payroll/SalaryPackages';
import { Clock, MapPin, Layers } from 'lucide-react';

const PolicyManagement = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Determine initial tab based on route or state
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab) return tab;
        if (location.pathname.includes('geofencing')) return 'geofencing';
        return 'shifts';
    });

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab) {
            setActiveTab(tab);
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
        <DashboardLayout title="Policy Management" noPadding={true}>
            <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden px-2.5 pt-2 pb-2 bg-slate-50 dark:bg-dark-bg space-y-2">
                {/* Tabs Strip */}
                <div className="flex w-fit items-center gap-1.5 p-1 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0">
                    <button
                        onClick={() => handleTabChange('shifts')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                            activeTab === 'shifts'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] font-medium shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                        }`}
                    >
                        <Clock size={14} className={`${activeTab === 'shifts' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-450'} -mt-[1px]`} />
                        <span className="leading-none">Shift Management</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('geofencing')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                            activeTab === 'geofencing'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] font-medium shadow-sm'
                                : 'text-slate-605 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                        }`}
                    >
                        <MapPin size={14} className={`${activeTab === 'geofencing' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-450'} -mt-[1px]`} />
                        <span className="leading-none">Geo Fencing</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('salary_packages')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                            activeTab === 'salary_packages'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] font-medium shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                        }`}
                    >
                        <Layers size={14} className={`${activeTab === 'salary_packages' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-455'} -mt-[1px]`} />
                        <span className="leading-none">Salary Packages</span>
                    </button>
                </div>

                {/* Content Panel */}
                <div className="flex-1 min-h-0 relative overflow-hidden">
                    {activeTab === 'shifts' && <ShiftManagement embedded={true} />}
                    {activeTab === 'geofencing' && <GeoFencing embedded={true} />}
                    {activeTab === 'salary_packages' && <SalaryPackages embedded={true} />}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default PolicyManagement;
