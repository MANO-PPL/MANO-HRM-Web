import React from 'react';
import { MapPin, Camera } from 'lucide-react';
import { getStatusColor } from './reportsUtils';

const AttendanceRecordTooltip = ({ hoveredRecord, hoveredPosition }) => {
    if (!hoveredRecord) return null;

    return (
        <div
            className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-950/95 dark:bg-[#161b22]/95 backdrop-blur-xs text-white text-[11px] rounded-xl p-3.5 shadow-2xl border border-slate-800 dark:border-[#30363d] w-64 space-y-2 text-left"
            style={{
                top: hoveredPosition.top - 8,
                left: hoveredPosition.left,
            }}
        >
            {/* Header: Employee Name & Date */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 dark:border-[#30363d] pb-2">
                <div>
                    <h4 className="font-bold text-xs text-slate-100 dark:text-[#f0f6fc] leading-tight">
                        {hoveredRecord.user_name}
                    </h4>
                    <p className="text-[9px] text-slate-400 dark:text-[#8b949e] mt-0.5 font-semibold">
                        {hoveredRecord.date}
                    </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${getStatusColor(hoveredRecord.status)}`}>
                    {hoveredRecord.status}
                </span>
            </div>

            {/* Details based on status */}
            {hoveredRecord.status === 'Absent' ? (
                <p className="text-[10px] text-rose-400 font-medium italic">No attendance recorded. Marked absent.</p>
            ) : hoveredRecord.status === 'On Leave' ? (
                <p className="text-[10px] text-sky-400 font-medium italic">Approved leave for this day.</p>
            ) : (
                <div className="space-y-2">
                    {/* Punch Times */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                            <span className="text-slate-400 dark:text-[#8b949e] block font-medium">Punch In</span>
                            <span className="font-bold text-slate-200 dark:text-[#c9d1d9]">{hoveredRecord.time_in || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 dark:text-[#8b949e] block font-medium">Punch Out</span>
                            <span className="font-bold text-slate-200 dark:text-[#c9d1d9]">{hoveredRecord.time_out || (hoveredRecord.is_active ? 'In Progress' : 'N/A')}</span>
                        </div>
                    </div>

                    {/* Work Hrs vs Req Hrs + Late */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-slate-800/60 dark:border-[#30363d]/60">
                        <div>
                            <span className="text-slate-400 dark:text-[#8b949e] block font-medium">Work / Req Hrs</span>
                            <span className="font-bold text-slate-200 dark:text-[#c9d1d9]">
                                {hoveredRecord.worked_hours != null ? hoveredRecord.worked_hours.toFixed(2) : '0.00'}
                                <span className="text-slate-500 mx-0.5">/</span>
                                {hoveredRecord.required_hours != null ? hoveredRecord.required_hours.toFixed(2) : '0.00'}h
                            </span>
                            {hoveredRecord.worked_hours != null && hoveredRecord.required_hours > 0 && (
                                <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${hoveredRecord.worked_hours >= hoveredRecord.required_hours ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                        style={{ width: `${Math.min((hoveredRecord.worked_hours / hoveredRecord.required_hours) * 100, 100)}%` }}
                                    />
                                </div>
                            )}
                        </div>
                        <div>
                            <span className="text-slate-400 dark:text-[#8b949e] block font-medium">Late Mins</span>
                            <span className={`font-bold ${hoveredRecord.late_minutes > 0 ? 'text-amber-400' : 'text-slate-200 dark:text-[#c9d1d9]'}`}>
                                {hoveredRecord.late_minutes != null ? `${hoveredRecord.late_minutes} min` : '0 min'}
                            </span>
                            {hoveredRecord.late_minutes > 0 && hoveredRecord.late_reason && hoveredRecord.late_reason !== '-' && (
                                <span className="block text-[8px] text-slate-400 dark:text-github-dark-muted italic truncate max-w-[120px] mt-0.5" title={hoveredRecord.late_reason}>
                                    "{hoveredRecord.late_reason}"
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Locations */}
                    {((hoveredRecord.time_in_address && hoveredRecord.time_in_address !== '-') ||
                        (hoveredRecord.time_out_address && hoveredRecord.time_out_address !== '-')) && (
                            <div className="space-y-1 pt-1.5 border-t border-slate-800/60 dark:border-[#30363d]/60">
                                {hoveredRecord.time_in_address && hoveredRecord.time_in_address !== '-' && (
                                    <div className="flex items-start gap-1 text-[9px] text-slate-300 dark:text-[#c9d1d9]">
                                        <MapPin size={10} className="text-emerald-400 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2 leading-tight">In: {hoveredRecord.time_in_address}</span>
                                    </div>
                                )}
                                {hoveredRecord.time_out_address && hoveredRecord.time_out_address !== '-' && (
                                    <div className="flex items-start gap-1 text-[9px] text-slate-300 dark:text-[#c9d1d9]">
                                        <MapPin size={10} className="text-rose-400 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2 leading-tight">Out: {hoveredRecord.time_out_address}</span>
                                    </div>
                                )}
                            </div>
                        )}

                    {/* Selfie Thumbnails */}
                    {(hoveredRecord.time_in_image || hoveredRecord.time_out_image) && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 dark:border-[#30363d]/60">
                            {[
                                { label: 'In', img: hoveredRecord.time_in_image },
                                { label: 'Out', img: hoveredRecord.time_out_image }
                            ].map((item, i) => (
                                <div key={i} className="relative h-14 rounded-lg border border-slate-700 dark:border-[#30363d] overflow-hidden bg-slate-900 shadow-sm flex flex-col justify-between">
                                    {item.img ? (
                                        <img src={item.img} alt={`Selfie ${item.label}`} className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full pb-2 gap-0.5 opacity-40">
                                            <Camera size={14} className="text-slate-400" />
                                            <span className="text-[5px] font-bold uppercase tracking-wider text-slate-400">No Photo</span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-[6px] text-center uppercase py-0.5 font-black tracking-wider text-white leading-none border-t border-slate-800/40">
                                        Punch {item.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AttendanceRecordTooltip;
