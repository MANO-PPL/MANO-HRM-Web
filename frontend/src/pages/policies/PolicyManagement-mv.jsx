import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import ShiftManagementMobile from '../shift-management/ShiftManagement-mv';
import GeoFencingMobile from '../geofencing/GeoFencing-mv';
import SalaryPackagesMobile from '../payroll/SalaryPackages-mv';
import LeavePoliciesMobile from '../leaves/LeavePolicies-mv';
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
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        navigate(`/policies?tab=${tab}`);
    };

    return (
        <MobileDashboardLayout title="Policy Management" contentClassName="px-0 pt-0 pb-4 w-full">
            <div className="w-full">
                {/* Mobile Tabs Strip - Sticky Full Width from Left to Right */}
                <div className="sticky z-20 bg-slate-50/95 dark:bg-[#0D1117]/95 backdrop-blur-md px-3 pt-2 pb-2 border-b border-slate-200/80 dark:border-github-dark-border w-full" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
                    <div className="flex w-full items-center gap-1 p-1 bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shadow-2xs">
                        <button
                            onClick={() => handleTabChange('shifts')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                activeTab === 'shifts'
                                    ? 'bg-[#f6f8fa] dark:bg-[#21262D] text-[#6366F1] dark:text-indigo-400 font-medium shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                            }`}
                        >
                            <Clock size={13} className={activeTab === 'shifts' ? 'text-[#6366F1] dark:text-indigo-400' : 'text-slate-400'} />
                            <span className="leading-none text-[11.5px]">Shifts</span>
                        </button>
                        <button
                            onClick={() => handleTabChange('geofencing')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                activeTab === 'geofencing'
                                    ? 'bg-[#f6f8fa] dark:bg-[#21262D] text-[#6366F1] dark:text-indigo-400 font-medium shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                            }`}
                        >
                            <MapPin size={13} className={activeTab === 'geofencing' ? 'text-[#6366F1] dark:text-indigo-400' : 'text-slate-400'} />
                            <span className="leading-none text-[11.5px]">Geofence</span>
                        </button>
                        <button
                            onClick={() => handleTabChange('salary_packages')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                activeTab === 'salary_packages'
                                    ? 'bg-[#f6f8fa] dark:bg-[#21262D] text-[#6366F1] dark:text-indigo-400 font-medium shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                            }`}
                        >
                            <Layers size={13} className={activeTab === 'salary_packages' ? 'text-[#6366F1] dark:text-indigo-400' : 'text-slate-400'} />
                            <span className="leading-none text-[11.5px]">Salary</span>
                        </button>
                        <button
                            onClick={() => handleTabChange('leave_policies')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                activeTab === 'leave_policies'
                                    ? 'bg-[#f6f8fa] dark:bg-[#21262D] text-[#6366F1] dark:text-indigo-400 font-medium shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                            }`}
                        >
                            <CalendarCheck size={13} className={activeTab === 'leave_policies' ? 'text-[#6366F1] dark:text-indigo-400' : 'text-slate-400'} />
                            <span className="leading-none text-[11.5px]">Leaves</span>
                        </button>
                    </div>
                </div>

                {/* Content Panel */}
                <div className="w-full">
                    {activeTab === 'shifts' && <ShiftManagementMobile embedded={true} />}
                    {activeTab === 'geofencing' && <GeoFencingMobile embedded={true} />}
                    {activeTab === 'salary_packages' && <SalaryPackagesMobile embedded={true} />}
                    {activeTab === 'leave_policies' && <LeavePoliciesMobile embedded={true} />}
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

export default PolicyManagementMobile;
