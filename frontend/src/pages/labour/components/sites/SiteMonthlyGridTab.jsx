import React from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import LoadingScreen from '../../../../components/LoadingScreen';
import { getDaysInMonthArray, getMonthNameAndYear, getStatusColor, getStatusLabel } from '../../utils/labourUtils';

const SiteMonthlyGridTab = ({
    gridLoading,
    gridMonthDetails,
    gridRoleFilter,
    gridMonth,
    gridData
}) => {
    const daysArray = getDaysInMonthArray(gridMonth);

    return (
        <div className="space-y-4 animate-in fade-in duration-150">
            {gridLoading ? (
                <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl p-6 shadow-xs">
                    <LoadingScreen message="Loading monthly matrix grid..." fullScreen={false} />
                </div>
            ) : (
                <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-[#30363d] bg-slate-50/50 dark:bg-[#161b22]/50 flex justify-between items-center">
                        <span className="font-semibold text-xs text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">Attendance Grid Matrix</span>
                        {gridMonthDetails && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium uppercase font-mono">
                                {getMonthNameAndYear(gridMonthDetails.month + "-01")}
                            </span>
                        )}
                    </div>

                    <motion.div
                        key={`grid-${gridRoleFilter}-${gridMonth}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="overflow-x-auto no-scrollbar"
                        style={{ isolation: 'isolate' }}
                    >
                        <table className="w-full text-left border-collapse text-xs whitespace-nowrap" style={{ minWidth: 'max-content' }}>
                            <thead className="sticky top-0 z-30">
                                <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-[#30363d]">
                                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#8b949e] sticky left-0 bg-slate-50 dark:bg-[#161b22] z-40 min-w-[230px] border-r border-slate-200 dark:border-[#30363d]" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.25)' }}>Worker Name / Designation</th>
                                    {daysArray.map(day => {
                                        const d = new Date(day.dateStr + 'T00:00:00Z');
                                        return (
                                            <th key={day.dateStr} className="py-2 px-1 text-center min-w-[52px]">
                                                <div className="text-[8px] uppercase text-slate-400 dark:text-[#8b949e] leading-none tracking-wider">{d.toLocaleString('en-US', { month: 'short' })}</div>
                                                <div className="text-sm font-semibold text-slate-700 dark:text-[#f0f6fc] leading-tight">{d.getUTCDate()}</div>
                                                <div className="text-[8px] uppercase text-slate-400 dark:text-[#8b949e] leading-none tracking-wider">{d.toLocaleString('en-US', { weekday: 'short' })}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#21262d]">
                                {gridData.filter(row => !gridRoleFilter || row.role.toLowerCase() === gridRoleFilter.toLowerCase()).length === 0 ? (
                                    <tr>
                                        <td colSpan={daysArray.length + 1} className="p-10 text-center text-slate-400 dark:text-[#8b949e] italic bg-white dark:bg-[#0d1117]">No attendance matrix records found matching the filter.</td>
                                    </tr>
                                ) : (
                                    gridData
                                        .filter(row => !gridRoleFilter || row.role.toLowerCase() === gridRoleFilter.toLowerCase())
                                        .map(row => {
                                            const initials = row.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                            return (
                                                <tr key={row.labour_id} className="hover:bg-slate-50 dark:hover:bg-[#161b22]/70 transition-colors group">
                                                    <td className="px-5 py-3.5 sticky left-0 bg-white dark:bg-[#0d1117] group-hover:bg-slate-50 dark:group-hover:bg-[#161b22] transition-colors z-10 border-r border-slate-200 dark:border-[#30363d]" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.20)' }}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-semibold text-xs shadow-inner shrink-0">
                                                                {initials || <User size={14} />}
                                                            </div>
                                                            <div>
                                                                <span className="block font-semibold text-slate-800 dark:text-[#f0f6fc] text-sm leading-tight">{row.name}</span>
                                                                <span className="block text-[10px] font-normal text-slate-400 dark:text-[#8b949e] mt-0.5">{row.role}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {daysArray.map(day => {
                                                        const attObj = row.attendance[day.dateStr];
                                                        let status = attObj && typeof attObj === 'object' ? attObj.status : (attObj || '-');

                                                        if (status === '-' || !status) {
                                                            const dateObj = new Date(day.dateStr);
                                                            const dayNum = dateObj.getDay();
                                                            if (dayNum === 6) status = 'Sat';
                                                            else if (dayNum === 0) status = 'Sun';
                                                        }

                                                        return (
                                                            <td key={day.dateStr} className="px-1 py-3 text-center align-middle">
                                                                <div className="flex justify-center items-center">
                                                                    <span
                                                                        className={`w-8 h-8 rounded-xl text-[9px] font-medium uppercase tracking-wider transition-all inline-flex items-center justify-center shadow-sm ${getStatusColor(status)}`}
                                                                        title={status !== '-' ? status : undefined}
                                                                    >
                                                                        {getStatusLabel(status)}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })
                                )}
                            </tbody>
                        </table>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default SiteMonthlyGridTab;
