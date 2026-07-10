import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Tooltip as MapTooltip } from "react-leaflet";
import MarkerClusterGroup from 'react-leaflet-cluster';
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for Leaflet default icon issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

import DashboardLayout from '../../components/DashboardLayout';
import {
    Search,
    Filter,
    Clock,
    FileClock,
    UserCheck,
    UserX,
    AlertTriangle,
    MoreVertical,
    Download,
    FileText,
    CheckCircle,
    XCircle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    Activity,
    LogOut,
    LayoutGrid,
    PieChart as PieChartIcon,
    BarChart as BarChartIcon,
    RefreshCcw,
    RefreshCw,
    MapPin,
    Table,
    ChevronDown,
    Layers,
    Check,
    Users,
    X,
    LogIn,
    Camera,
    Sparkles
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import DatePicker from '../../components/DatePicker';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { useTour } from '../../context/TourContext';
import axios from 'axios';



// --- MAP HELPER COMPONENTS ---
const MapRecenter = ({ data, searchTerm, departmentFilter }) => {
    const map = useMap();

    // Dynamically calculate and enforce minZoom to fit the panel width
    useEffect(() => {
        const updateMinZoom = () => {
            const container = map.getContainer();
            if (container) {
                const containerWidth = container.clientWidth;
                if (containerWidth) {
                    // Min zoom is calculated so that the map width (256 * 2^zoom) is >= container width
                    const calculatedMinZoom = Math.max(3, Math.ceil(Math.log2(containerWidth / 256)));
                    map.setMinZoom(calculatedMinZoom);
                    
                    if (map.getZoom() < calculatedMinZoom) {
                        map.setZoom(calculatedMinZoom);
                    }
                }
            }
        };

        updateMinZoom();

        const resizeObserver = new ResizeObserver(() => {
            updateMinZoom();
        });
        
        const container = map.getContainer();
        if (container) {
            resizeObserver.observe(container);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [map]);

    useEffect(() => {
        if (!data || data.length === 0) return;

        // Find bounds for all markers
        const points = [];
        data.forEach(user => {
            user.sessions.forEach(s => {
                if (s.inLat && s.inLng) points.push([Number(s.inLat), Number(s.inLng)]);
                if (s.outLat && s.outLng) points.push([Number(s.outLat), Number(s.outLng)]);
            });
        });

        if (points.length > 0) {
            map.fitBounds(points, { padding: [50, 50], maxZoom: 15 });
        }
    }, [searchTerm, departmentFilter, data, map]);

    return null;
};


const MapSidebarContent = ({ selectedCluster, onClose }) => {
    const [selectedUser, setSelectedUser] = useState(() => 
        selectedCluster.data.length === 1 ? selectedCluster.data[0] : null
    );
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setSelectedUser(selectedCluster.data.length === 1 ? selectedCluster.data[0] : null);
        setSearchQuery('');
    }, [selectedCluster]);

    const filteredClusterData = selectedCluster.data.filter(item => {
        const name = item.user.name || '';
        const role = item.user.role || '';
        const dept = item.user.department || '';
        const q = searchQuery.toLowerCase();
        return name.toLowerCase().includes(q) || role.toLowerCase().includes(q) || dept.toLowerCase().includes(q);
    });

    return createPortal(
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[9998]"
            />

            {/* Sidebar Drawer */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-[450px] bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-github-dark-border flex flex-col z-[9999] shadow-2xl dar-context"
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        {selectedUser && selectedCluster.data.length > 1 && (
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 mr-1"
                            >
                                <ChevronLeft size={18} />
                            </button>
                        )}
                        <div>
                            <h3 className="text-xs font-black text-slate-800 dark:text-github-dark-text uppercase tracking-widest">
                                {selectedUser ? 'Session Details' : 'Location Group'}
                            </h3>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                {selectedUser ? 'Employee Activity' : `${selectedCluster.data.length} checked-in at this location`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-text transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search Bar - only shown in list view */}
                {!selectedUser && (
                    <div className="p-3 border-b border-slate-100 dark:border-github-dark-border shrink-0 bg-white dark:bg-[#0d1117]">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-github-dark-muted" size={16} />
                            <input
                                type="text"
                                placeholder="Search staff, role, or dept..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 text-slate-800 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-github-dark-muted dark:hover:text-github-dark-text"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white dark:bg-[#0d1117]">
                    <AnimatePresence initial={false} mode="wait">
                        {!selectedUser ? (
                            <motion.div
                                key="list"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2.5"
                            >
                                {filteredClusterData.length > 0 ? (
                                    filteredClusterData.map((m, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedUser(m)}
                                            className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-github-dark-subtle/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 rounded-2xl cursor-pointer transition-all border border-slate-100 dark:border-github-dark-border hover:border-indigo-200 dark:hover:border-indigo-500/20 group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm overflow-hidden shrink-0 border border-indigo-100/50 dark:border-indigo-500/10">
                                                {m.user.avatar.startsWith('http') ? (
                                                    <img src={m.user.avatar} className="w-full h-full object-cover" />
                                                ) : (
                                                    m.user.avatar
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-slate-800 dark:text-github-dark-text truncate leading-tight">
                                                    {m.user.name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-github-dark-muted truncate mt-0.5">
                                                    {m.user.role} • {m.user.department}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                                        m.session.isActive && m.type === 'in'
                                                            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 animate-pulse'
                                                            : m.type === 'in' 
                                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                            : m.type === 'out' 
                                                            ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' 
                                                            : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                    }`}>
                                                        {m.session.isActive && m.type === 'in' ? 'Active' : m.type === 'combined' ? 'Full Session' : m.type === 'in' ? 'Check In' : 'Check Out'}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 dark:text-github-dark-muted font-mono flex items-center gap-1">
                                                        <Clock size={8} /> {m.type === 'out' ? m.session.out : m.session.in}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                <ChevronRight size={14} />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-slate-400 dark:text-github-dark-muted">
                                        <Search size={24} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs font-medium">No results match your search</p>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="detail"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 20, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/20 rounded-2xl border border-slate-100 dark:border-github-dark-border">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0 shadow-md">
                                        {selectedUser.user.avatar.startsWith('http') ? (
                                            <img src={selectedUser.user.avatar} className="w-full h-full object-cover" />
                                        ) : (
                                            selectedUser.user.avatar
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-800 dark:text-github-dark-text text-sm leading-tight">
                                            {selectedUser.user.name}
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            {selectedUser.user.role} • {selectedUser.user.department}
                                        </p>
                                    </div>
                                </div>

                                {selectedUser.user.allStatuses && selectedUser.user.allStatuses.includes('Late') && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl shadow-sm mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <h5 className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-widest mb-1 flex items-center gap-1.5">
                                            <AlertTriangle size={10} /> Late Reason
                                        </h5>
                                        <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed italic">
                                            {selectedUser.user.lateReason ? `"${selectedUser.user.lateReason}"` : "No reason provided."}
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {selectedUser.type === 'combined' ? (
                                        <>
                                            <div className="space-y-2 bg-slate-50 dark:bg-github-dark-subtle/30 p-3 rounded-2xl border border-slate-100 dark:border-github-dark-border">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Time In</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-md">
                                                        {selectedUser.session.in}
                                                    </span>
                                                </div>
                                                {selectedUser.session.inImage ? (
                                                    <div className="flex justify-center w-full mt-2" onClick={() => setPreviewImage(selectedUser.session.inImage)}>
                                                        <img src={selectedUser.session.inImage} alt="In Selfie" className="max-h-56 max-w-full w-auto block rounded-2xl shadow-md object-contain cursor-pointer transition-transform hover:scale-105" />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-4 bg-slate-100/50 dark:bg-github-dark-subtle/10 rounded-xl border border-dashed border-slate-200 dark:border-github-dark-border mt-2">
                                                        <Camera size={16} className="text-slate-400 mb-1" />
                                                        <span className="text-[9px] text-slate-400">No Check-in Selfie</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2 bg-slate-50 dark:bg-github-dark-subtle/30 p-3 rounded-2xl border border-slate-100 dark:border-github-dark-border">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Time Out</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2.5 py-0.5 rounded-md">
                                                        {selectedUser.session.out}
                                                    </span>
                                                </div>
                                                {selectedUser.session.outImage ? (
                                                    <div className="flex justify-center w-full mt-2" onClick={() => setPreviewImage(selectedUser.session.outImage)}>
                                                        <img src={selectedUser.session.outImage} alt="Out Selfie" className="max-h-56 max-w-full w-auto block rounded-2xl shadow-md object-contain cursor-pointer transition-transform hover:scale-105" />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-4 bg-slate-100/50 dark:bg-github-dark-subtle/10 rounded-xl border border-dashed border-slate-200 dark:border-github-dark-border mt-2">
                                                        <Camera size={16} className="text-slate-400 mb-1" />
                                                        <span className="text-[9px] text-slate-400">No Check-out Selfie</span>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between bg-slate-50 dark:bg-github-dark-subtle/30 p-3 rounded-2xl border border-slate-100 dark:border-github-dark-border">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${selectedUser.session.isActive && selectedUser.type === 'in' ? 'bg-indigo-500 animate-pulse' : selectedUser.type === 'in' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                        {selectedUser.session.isActive && selectedUser.type === 'in' ? 'Active Session' : selectedUser.type === 'in' ? 'Check In' : 'Check Out'}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-bold ${
                                                    selectedUser.session.isActive && selectedUser.type === 'in'
                                                        ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 animate-pulse'
                                                        : selectedUser.type === 'in' 
                                                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' 
                                                        : 'text-rose-600 bg-rose-50 dark:bg-rose-900/30'
                                                } px-2.5 py-0.5 rounded-md uppercase`}>
                                                    {selectedUser.type === 'in' ? selectedUser.session.in : selectedUser.session.out}
                                                </span>
                                            </div>
                                            { (selectedUser.type === 'in' ? selectedUser.session.inImage : selectedUser.session.outImage) ? (
                                                <div className="flex justify-center w-full mt-2" onClick={() => setPreviewImage(selectedUser.type === 'in' ? selectedUser.session.inImage : selectedUser.session.outImage)}>
                                                    <img src={selectedUser.type === 'in' ? selectedUser.session.inImage : selectedUser.session.outImage} alt="Selfie" className="max-h-56 max-w-full w-auto block rounded-2xl shadow-md object-contain cursor-pointer transition-transform hover:scale-105" />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-6 bg-slate-100/50 dark:bg-github-dark-subtle/10 rounded-2xl border border-dashed border-slate-200 dark:border-github-dark-border mt-2">
                                                    <Camera size={20} className="text-slate-400 mb-1" />
                                                    <span className="text-[10px] text-slate-400">No Selfie image captured</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <div className="flex flex-col gap-1.5 p-3 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-2xl border border-slate-100 dark:border-github-dark-border">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            <MapPin size={12} className="text-indigo-500" /> Location Details
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-normal mt-0.5">
                                            {selectedUser.type === 'out' ? selectedUser.session.outLocation : selectedUser.session.inLocation}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </>,
        document.body
    );
};

// Timezone-aware date/time parser and normalizer
const parseTimeInTimezone = (r, isOut, orgTimezone) => {
    let fallbackStr = isOut ? r.time_out : r.time_in;
    if (!fallbackStr) return null;
    
    if (fallbackStr instanceof Date) {
        return fallbackStr;
    }
    
    try {
        const parts = String(fallbackStr).split(/[- :T.]/);
        if (parts.length >= 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const hour = parts[3] ? parseInt(parts[3], 10) : 0;
            const minute = parts[4] ? parseInt(parts[4], 10) : 0;
            const second = parts[5] ? parseInt(parts[5], 10) : 0;
            const parsed = new Date(year, month, day, hour, minute, second);
            if (!isNaN(parsed.getTime())) return parsed;
        }
    } catch (err) {
        console.error("Error parsing timestamp:", err);
    }
    return null;
};

const getCurrentTimeInTimezone = (orgTimezone) => {
    const d = new Date();
    try {
        const localStr = d.toLocaleString('en-US', { timeZone: orgTimezone || 'UTC' });
        return new Date(localStr);
    } catch (e) {
        return d;
    }
};

const formatTotalTime = (totalMin, fallbackHours) => {
    let minutes = 0;
    if (totalMin > 0) {
        minutes = totalMin;
    } else if (fallbackHours > 0) {
        minutes = fallbackHours * 60;
    }
    
    if (minutes <= 0) return '-';
    
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hrs > 0 && mins > 0) {
        return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'} ${mins} ${mins === 1 ? 'min' : 'mins'}`;
    } else if (hrs > 0) {
        return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
    } else {
        return `${mins} ${mins === 1 ? 'min' : 'mins'}`;
    }
};

const processAttendanceData = (staff, resolvedTz) => {
    const mergedData = staff.map(u => {
        const daySessions = u.sessions || [];
        let totalMin = 0;
        const sessions = daySessions.map(r => {
            const inTime = parseTimeInTimezone(r, false, resolvedTz);
            const formatTime = (d) => {
                if (!d) return '-';
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            };

            const inStr = formatTime(inTime);
            let outStr = '-';
            let isActive = !r.time_out && r.status !== 'MISSED_PUNCH' && r.status !== 'ABSENT';

            const outTime = parseTimeInTimezone(r, true, resolvedTz);
            if (outTime) {
                outStr = formatTime(outTime);
                if (inTime) totalMin += Math.max(0, (outTime - inTime) / 60000);
            } else if (isActive && inTime) {
                const nowTZ = getCurrentTimeInTimezone(resolvedTz);
                totalMin += Math.max(0, (nowTZ - inTime) / 60000);
            }

            // Locations
            const inLoc = r.time_in_address || (r.time_in_lat ? `${r.time_in_lat}, ${r.time_in_lng}` : 'Unknown');
            const outLoc = r.time_out_address || (r.time_out_lat ? `${r.time_out_lat}, ${r.time_out_lng}` : null);

            return {
                rawIn: inTime,
                rawOut: outTime,
                in: inStr,
                out: outStr,
                date: inTime ? inTime.toLocaleDateString() : '-',
                isActive,
                inLocation: inLoc,
                outLocation: outLoc,
                lateMinutes: r.late_minutes || 0,
                isLate: (r.late_minutes || 0) > 0,
                lateReason: r.late_reason || r.lateReason || '',
                inImage: r.time_in_image,
                outImage: r.time_out_image,
                inLat: r.time_in_lat,
                inLng: r.time_in_lng,
                outLat: r.time_out_lat,
                outLng: r.time_out_lng
            };
        });

        // Standardize Status String to match frontend layout colors
        const statusMap = {
            'WEEK_OFF': 'Week Off',
            'HOLIDAY': 'Holiday',
            'LEAVE': 'Leave',
            'ABSENT': 'Absent',
            'PRESENT': 'Present',
            'LATE': 'Late',
            'OVERTIME': 'Overtime',
            'MISSED_PUNCH': 'Missed Punch',
            'Active': 'Active',
            'Late Active': 'Late Active'
        };
        const status = statusMap[u.status] || u.status || 'Absent';

        const totalHrs = formatTotalTime(totalMin, u.total_hours > 0 ? Number(u.total_hours) : 0);
        const expectedHrs = u.expected_hours !== undefined && u.expected_hours !== null && u.expected_hours > 0 ? `${Number(u.expected_hours).toFixed(1)} hrs` : '-';
        const lastLocation = u.sessions && u.sessions.length > 0
            ? u.sessions[0].time_in_address || (u.sessions[0].time_in_lat ? `${u.sessions[0].time_in_lat}, ${u.sessions[0].time_in_lng}` : '-')
            : '-';

        // Recreate allStatuses to retain compatibility with stats counts
        let allStatuses = [];
        if (status === 'Late Active') { allStatuses.push('Active', 'Late'); }
        else if (status === 'Active') { allStatuses.push('Active'); }
        else if (status === 'Present') { allStatuses.push('Present'); }
        else if (status === 'Late') { allStatuses.push('Present', 'Late'); }
        else if (status === 'Overtime') { allStatuses.push('Present', 'Overtime'); }
        else if (status === 'Missed Punch') { allStatuses.push('Missed Punch'); }
        else if (status === 'Week Off') { allStatuses.push('Week Off'); }
        else if (status === 'Holiday') { allStatuses.push('Holiday'); }
        else if (status === 'Leave') { allStatuses.push('Leave'); }
        else { allStatuses.push('Absent'); }

        return {
            id: u.user_id,
            name: u.user_name || 'Unknown',
            role: u.desg_name || 'Employee',
            avatar: (u.profile_image_url && u.profile_image_url.trim() !== '') ? u.profile_image_url : (u.user_name ? u.user_name.trim().charAt(0).toUpperCase() : 'U') || 'U',
            department: u.dept_name || 'General',
            shift_id: u.shift_id,
            sessions,
            status,
            allStatuses,
            totalHours: totalHrs,
            expectedHours: expectedHrs,
            location: lastLocation,
            lateReason: u.late_reason || u.lateReason || sessions.find(s => s.lateReason)?.lateReason || ''
        };
    });

    // Sort: Active/Present/Late/Overtime first, then Absent, then Week Off/Holiday/Leave
    const statusWeights = {
        'Active': 10,
        'Late Active': 9,
        'Late': 8,
        'Overtime': 7,
        'Present': 6,
        'Missed Punch': 5,
        'Absent': 4,
        'Leave': 3,
        'Holiday': 2,
        'Week Off': 1
    };
    mergedData.sort((a, b) => (statusWeights[b.status] || 0) - (statusWeights[a.status] || 0));

    return mergedData;
};

const PAGE_KEY = 'admin_attendance_monitoring';

const AttendanceMonitoring = () => {
    const navigate = useNavigate();
    const { avatarTimestamp } = useAuth();
    const { startTour, hasSeenPage, wasSkippedThisSession, tourEnabled } = useTour();

    // Get initial values from localStorage to support persistent views/filters
    const initialView = localStorage.getItem('live_attendance_active_view') || 'cards';
    const initialDate = localStorage.getItem('live_attendance_selected_date') || new Date().toISOString().split("T")[0];
    const initialSearch = localStorage.getItem('live_attendance_search_term') || '';
    const initialDept = localStorage.getItem('live_attendance_department_filter') || 'All';
    const initialStatus = localStorage.getItem('live_attendance_status_filter') || 'All';
    const initialShift = localStorage.getItem('live_attendance_shift_filter') || 'All';

    // Synchronous memory cache check
    const cachedResponse = attendanceCacheData.dailySummaryAdmin[initialDate];

    const [orgTimezone, setOrgTimezone] = useState(() => cachedResponse?.timezone || 'UTC');

    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('tab') || 'live';
    });

    const tourSteps = React.useMemo(() => [
        {
            targetId: 'attendance-tabs',
            title: 'Attendance Modules',
            description: 'Switch between the Live Attendance dashboard and the Correction Requests queue.',
            action: () => {
                setActiveTab('live');
            }
        },
        {
            targetId: 'attendance-live-stats',
            title: 'Live Metrics & Filters',
            description: 'Track real-time employee counts for different attendance states. Click any metric card to filter the employee list below to only those matching that state.',
            action: () => {
                setActiveTab('live');
            }
        },
        {
            targetId: 'attendance-controls',
            title: 'Data Controls & Views',
            description: 'Search for specific employees, filter by department, select dates, or switch between Overview cards, Analytics charts, and high-density Timeline views.',
            action: () => {
                setActiveTab('live');
            }
        },
        {
            targetId: 'attendance-employee-card',
            title: 'Employee Card & Status Badges',
            description: 'Each card displays an employee\'s active session details. The color-coded status badges indicate their shift status: "Present" (on-time check-in), "Late" (checked in past the grace period), "Absent" (no check-in yet), "On Leave" (approved time off), and a pulsing "Active" badge showing they are currently logged in.',
            action: () => {
                setActiveTab('live');
            }
        },
        {
            targetId: 'attendance-requests-queue',
            title: 'Correction Requests Queue',
            description: 'This is the Correction Requests queue. As an administrator, you can review, approve, or reject attendance adjustment requests submitted by employees. You can view the request details, employee comments, and adjust or confirm their sessions directly from this interface.',
            action: () => {
                setActiveTab('requests');
            }
        }
    ], [setActiveTab]);
    const [activeView, setActiveView] = useState(initialView); // 'cards' | 'graph' | 'table' | 'map'
    const [activeTheme, setActiveTheme] = useState('voyager');
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            setActiveTab(tab);
        }
    }, [window.location.search]);

    const MAP_THEMES = {
        dark: { name: 'Night Mode', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
        light: { name: 'Light Mode', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
        voyager: { name: 'Day Mode', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
        satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
        streets: { name: 'Streets', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }
    };
    const [selectedRequest, setSelectedRequest] = useState(1); // For Detail View
    const [selectedLiveUser, setSelectedLiveUser] = useState(null); // For Live Attendance Detail Modal
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [clusterGroupElement, setClusterGroupElement] = useState(null);

    useEffect(() => {
        if (!clusterGroupElement) return;

        const handleClusterClick = (e) => {
            const markers = e.layer.getAllChildMarkers();
            if (markers.length > 1) {
                const data = markers.map(m => m.options.customSessionData).filter(Boolean);
                setSelectedCluster({
                    position: [e.latlng.lat, e.latlng.lng],
                    data: data
                });
            }
        };

        clusterGroupElement.on('clusterclick', handleClusterClick);
        return () => {
            clusterGroupElement.off('clusterclick', handleClusterClick);
        };
    }, [clusterGroupElement]);

    const [loading, setLoading] = useState(() => !cachedResponse);
    const [attendanceData, setAttendanceData] = useState(() => {
        if (cachedResponse?.data) {
            return processAttendanceData(cachedResponse.data, cachedResponse.timezone || 'UTC');
        }
        return [];
    });
    const [stats, setStats] = useState(() => {
        if (cachedResponse?.data) {
            const merged = processAttendanceData(cachedResponse.data, cachedResponse.timezone || 'UTC');
            return {
                present: merged.filter(d => d.status !== 'Absent' && d.status !== 'Week Off' && d.status !== 'Holiday' && d.status !== 'Leave').length,
                late: merged.filter(d => d.allStatuses ? d.allStatuses.includes('Late') : d.status.includes('Late')).length,
                absent: merged.filter(d => d.status === 'Absent').length,
                active: merged.filter(d => d.allStatuses ? d.allStatuses.includes('Active') : d.status.includes('Active')).length,
                total: merged.length
            };
        }
        return {
            present: 0,
            late: 0,
            absent: 0,
            active: 0,
            total: 0
        };
    });

    // Correction Requests State
    const [correctionRequests, setCorrectionRequests] = useState([]);
    const [requestCount, setRequestCount] = useState(0);
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [selectedRequestData, setSelectedRequestData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [reviewComment, setReviewComment] = useState('');
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [correctionSearchTerm, setCorrectionSearchTerm] = useState('');
    // Correction Filters
    const [correctionFilter, setCorrectionFilter] = useState({
        type: 'day',
        date: new Date().toISOString().split('T')[0],
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });

    // Admin Override State
    const [lockedMarkerId, setLockedMarkerId] = useState(null);
    const [overrideMode, setOverrideMode] = useState(false);
    const [overrideMethod, setOverrideMethod] = useState('fix');
    const [overrideIn, setOverrideIn] = useState('');
    const [overrideOut, setOverrideOut] = useState('');
    const [overrideSessions, setOverrideSessions] = useState([{ time_in: '', time_out: '' }]);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [departmentFilter, setDepartmentFilter] = useState(initialDept);
    const [statusFilter, setStatusFilter] = useState(initialStatus);
    const [desgFilter, setDesgFilter] = useState('All');
    const [shiftFilter, setShiftFilter] = useState(initialShift);
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
    const [isDesgDropdownOpen, setIsDesgDropdownOpen] = useState(false);
    const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
    const [shifts, setShifts] = useState([]);
    const [selectedDate, setSelectedDate] = React.useState(initialDate);
    const [lastSynced, setLastSynced] = React.useState(new Date());

    // AI Summary State
    const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(false);
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
    const [aiSummaryData, setAiSummaryData] = useState(null);
    const [aiSummaryError, setAiSummaryError] = useState(null);

    const presentStaffChartData = React.useMemo(() => {
        return attendanceData
            .filter(emp => {
                const statusLower = emp.status ? emp.status.toLowerCase() : '';
                return statusLower.includes('present') || statusLower.includes('late') || statusLower.includes('active') || statusLower.includes('overtime');
            })
            .map(emp => {
                let totalMin = 0;
                if (emp.sessions && emp.sessions.length > 0) {
                    emp.sessions.forEach(r => {
                        const inTime = r.rawIn;
                        const outTime = r.rawOut;
                        const isActive = r.isActive;
                        if (outTime && inTime) {
                            totalMin += Math.max(0, (outTime - inTime) / 60000);
                        } else if (isActive && inTime) {
                            const now = getCurrentTimeInTimezone(orgTimezone);
                            totalMin += Math.max(0, (now - inTime) / 60000);
                        }
                    });
                }
                const logged = Number((totalMin / 60).toFixed(2));
                
                const expectedHoursDecimal = parseFloat(emp.expectedHours);
                const expected = isNaN(expectedHoursDecimal) ? 8.0 : expectedHoursDecimal;
                
                const truncatedName = emp.name.length > 15 ? `${emp.name.slice(0, 12)}...` : emp.name;
                
                return {
                    name: truncatedName,
                    fullName: emp.name,
                    logged: logged,
                    expected: expected
                };
            });
    }, [attendanceData, orgTimezone]);

    const localAnalytics = React.useMemo(() => {
        let presentCount = 0;
        let lateCount = 0;
        attendanceData.forEach(emp => {
            const statusLower = emp.status ? emp.status.toLowerCase() : '';
            const isPresent = statusLower.includes('present') || statusLower.includes('late') || statusLower.includes('active') || statusLower.includes('overtime');
            const isLate = statusLower.includes('late');
            if (isPresent) presentCount++;
            if (isLate) lateCount++;
        });
        const total = attendanceData.length || 1;
        return {
            presentRate: Math.round((presentCount / total) * 100),
            lateRate: Math.round((lateCount / total) * 100)
        };
    }, [attendanceData]);

    const generateAiSummary = async () => {
        if (!attendanceData || attendanceData.length === 0) {
            toast.error("No attendance data available for the selected date to analyze.");
            return;
        }

        setIsAiSummaryOpen(true);
        setAiSummaryLoading(true);
        setAiSummaryError(null);
        try {
            const token = localStorage.getItem('accessToken');
            
            // Construct payload matching Python schema
            let presentCount = 0;
            let lateCount = 0;
            const deptStats = {};
            
            attendanceData.forEach(emp => {
                const statusLower = emp.status ? emp.status.toLowerCase() : '';
                const isPresent = statusLower.includes('present') || statusLower.includes('late') || statusLower.includes('active') || statusLower.includes('overtime');
                const isLate = statusLower.includes('late');
                
                if (isPresent) presentCount++;
                if (isLate) lateCount++;
                
                const dept = emp.department || 'Unassigned';
                if (!deptStats[dept]) deptStats[dept] = { present: 0, absent: 0, late: 0 };
                
                if (isPresent) deptStats[dept].present++;
                if (isLate) deptStats[dept].late++;
                if (statusLower.includes('absent')) deptStats[dept].absent++;
            });
            
            const total = attendanceData.length || 1;
            const analytics = {
                present_rate: Math.round((presentCount / total) * 100),
                late_rate: Math.round((lateCount / total) * 100),
                avg_work_hours: 8.0,
                department_breakdown: Object.keys(deptStats).map(dept => ({
                    department: dept,
                    present: deptStats[dept].present,
                    absent: deptStats[dept].absent,
                    late: deptStats[dept].late
                })),
                timeline_peaks: ["09:00", "17:00"]
            };

            const employees = attendanceData.map(emp => {
                const firstSession = emp.sessions && emp.sessions.length > 0 ? emp.sessions[0] : null;
                const lastSession = emp.sessions && emp.sessions.length > 0 ? emp.sessions[emp.sessions.length - 1] : null;
                
                let status = 'absent';
                const statusLower = emp.status ? emp.status.toLowerCase() : '';
                if (statusLower.includes('active') || statusLower.includes('present') || statusLower.includes('overtime')) {
                    status = 'present';
                }
                if (statusLower.includes('late')) {
                    status = 'late';
                }
                if (statusLower.includes('leave')) {
                    status = 'on_leave';
                }
                if (statusLower.includes('absent')) {
                    status = 'absent';
                }
                if (statusLower.includes('week off') || statusLower.includes('holiday')) {
                    status = 'on_leave';
                }

                return {
                    name: emp.name || 'Unknown',
                    department: emp.department || 'Unassigned',
                    status: status,
                    check_in: firstSession && firstSession.in !== '-' ? firstSession.in : null,
                    check_out: lastSession && lastSession.out !== '-' ? lastSession.out : null
                };
            });

            const payload = {
                date: selectedDate,
                total_employees: attendanceData.length,
                employees: employees,
                analytics: analytics
            };

            const res = await axios.post('/api/attendance/ai-summary', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAiSummaryData(res.data);
        } catch (err) {
            console.error("AI Summary Error:", err);
            let errorMessage = "Failed to generate AI summary. Please try again.";
            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (typeof err.response?.data?.error === 'string') {
                errorMessage = err.response.data.error;
            } else if (err.response?.data?.error?.message) {
                errorMessage = err.response.data.error.message;
            }
            setAiSummaryError(errorMessage);
        } finally {
            setAiSummaryLoading(false);
        }
    };
    
    // Automatically clear AI Summary data when date changes
    useEffect(() => {
        setAiSummaryData(null);
    }, [selectedDate]);

    const handlePrevDay = () => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() - 1);
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const dayStr = String(current.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${dayStr}`);
    };

    const handleNextDay = () => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() + 1);
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const dayStr = String(current.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${dayStr}`);
    };

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const deptRes = await adminService.getDepartments();
                if (deptRes && deptRes.departments) {
                    const sortedDepts = [...deptRes.departments].sort((a, b) => a.dept_name.localeCompare(b.dept_name));
                    setDepartments(sortedDepts);
                }
            } catch (err) {
                console.error("Failed to load departments", err);
            }
        };
        const fetchDesgs = async () => {
            try {
                const desgRes = await adminService.getDesignations();
                if (desgRes && desgRes.designations) {
                    const sortedDesgs = [...desgRes.designations].sort((a, b) => a.desg_name.localeCompare(b.desg_name));
                    setDesignations(sortedDesgs);
                }
            } catch (err) {
                console.error("Failed to load designations", err);
            }
        };
        const fetchShifts = async () => {
            try {
                const shiftRes = await adminService.getShifts();
                if (shiftRes && shiftRes.shifts) {
                    const sortedShifts = [...shiftRes.shifts].sort((a, b) => a.shift_name.localeCompare(b.shift_name));
                    setShifts(sortedShifts);
                }
            } catch (err) {
                console.error("Failed to load shifts", err);
            }
        };
        fetchDepts();
        fetchDesgs();
        fetchShifts();
    }, []);

    const DEPARTMENTS = [
        { value: 'All', label: 'All Departments' },
        ...departments.map(d => ({ value: d.dept_name, label: d.dept_name }))
    ];

    const DESIGNATIONS = [
        { value: 'All', label: 'All Designations' },
        ...designations.map(d => ({ value: d.desg_name, label: d.desg_name }))
    ];

    const SHIFTS = [
        { value: 'All', label: 'All Shifts' },
        { value: 'open_shift', label: 'Open Shift' },
        ...shifts.map(s => ({ value: s.shift_id, label: s.shift_name }))
    ];

    // Sync filter states to localStorage
    useEffect(() => {
        localStorage.setItem('live_attendance_active_view', activeView);
    }, [activeView]);

    useEffect(() => {
        localStorage.setItem('live_attendance_selected_date', selectedDate);
    }, [selectedDate]);

    useEffect(() => {
        localStorage.setItem('live_attendance_search_term', searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        localStorage.setItem('live_attendance_department_filter', departmentFilter);
    }, [departmentFilter]);

    useEffect(() => {
        localStorage.setItem('live_attendance_shift_filter', shiftFilter);
    }, [shiftFilter]);

    useEffect(() => {
        localStorage.setItem('live_attendance_status_filter', statusFilter);
    }, [statusFilter]);

    // Data Fetching
    const fetchData = async (silent = false, forceRefresh = false) => {
        if (!silent) setLoading(true);
        const startTime = Date.now();
        try {
            // 1. Fetch Dynamic Daily Summary for Admin
            const res = await attendanceService.getDailySummaryAdmin(selectedDate, forceRefresh);
            const staff = res.data || [];
            const resolvedTz = res.timezone || 'UTC';
            setOrgTimezone(resolvedTz);

            // 2. Map Data using helper
            const mergedData = processAttendanceData(staff, resolvedTz);

            setAttendanceData(mergedData);

            // 3. Calculate Stats precisely from merged data for consistency
            setStats({
                present: mergedData.filter(d => d.status !== 'Absent' && d.status !== 'Week Off' && d.status !== 'Holiday' && d.status !== 'Leave').length,
                late: mergedData.filter(d => d.allStatuses ? d.allStatuses.includes('Late') : d.status.includes('Late')).length,
                absent: mergedData.filter(d => d.status === 'Absent').length,
                active: mergedData.filter(d => d.allStatuses ? d.allStatuses.includes('Active') : d.status.includes('Active')).length,
                total: mergedData.length
            });

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            if (!silent) {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, 300 - elapsed);
                setTimeout(() => setLoading(false), remaining);
            } else {
                setLoading(false);
            }
            setLastSynced(new Date());
        }
    };

    // Theme Sync Effect
    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setActiveTheme(isDark ? 'dark' : 'voyager');

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const darkActive = document.documentElement.classList.contains('dark');
                    setActiveTheme(darkActive ? 'dark' : 'voyager');
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        // Always fetch requests to keep the badge count updated
        fetchCorrectionRequests();

        if (activeTab === 'live') {
            fetchData(false, false);
            // Auto refresh every 15 seconds (Live Monitoring)
            const interval = setInterval(() => fetchData(true, true), 15000);
            return () => clearInterval(interval);
        }
    }, [activeTab, selectedDate]);

    useEffect(() => {
        if (activeTab === 'requests') {
            fetchCorrectionRequests();
        }
    }, [activeTab]);



    const fetchCorrectionRequests = async () => {
        setRequestsLoading(true);
        try {
            const params = { limit: 10000 };
            // Removed date filters as per user request

            const res = await attendanceService.getCorrectionRequests(params);

            // Sort: Pending first, then by date (newest first)
            const sortedData = (res.data || []).sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return new Date(b.request_date) - new Date(a.request_date);
            });

            setCorrectionRequests(sortedData);
            setRequestCount(sortedData.filter(r => r.status === 'pending').length);

            // Auto-select first request if none selected or if previously selected one is gone
            if (res.data && res.data.length > 0) {
                if (!selectedRequestData || !res.data.find(r => r.acr_id === selectedRequestData.acr_id)) {
                    setSelectedRequestId(res.data[0].acr_id);
                    fetchRequestDetail(res.data[0].acr_id);
                }
            } else {
                setSelectedRequestData(null);
                setSelectedRequestId(null);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setRequestsLoading(false);
        }
    };

    const fetchRequestDetail = async (acr_id) => {
        setDetailLoading(true);
        try {
            const data = await attendanceService.getCorrectionDetails(acr_id);
            setSelectedRequestData(data);
            setReviewComment(data.review_comments || '');

            // Reset Override State — default sessions from proposed_data snapshot
            setOverrideMode(false);
            setOverrideMethod('add_session');

            const proposedSnap = Array.isArray(data.proposed_data) ? data.proposed_data : [];
            setOverrideSessions(proposedSnap.length > 0 ? proposedSnap : [{ time_in: '', time_out: '' }]);
            setOverrideIn('');
            setOverrideOut('');
        } catch (error) {
            toast.error("Failed to fetch request details");
        } finally {
            setDetailLoading(false);
        }
    };

    const handleUpdateStatus = async (acr_id, status) => {
        try {
            const overrides = {};
            if (status === 'approved' && overrideMode) {
                const valid = overrideSessions.filter(s => s.time_in && s.time_out);
                if (valid.length === 0) {
                    toast.error("At least one valid session required for manual correction");
                    return;
                }
                overrides.sessions = valid;
            }

            await attendanceService.updateCorrectionStatus(acr_id, status, reviewComment, overrides);
            toast.success(`Request ${status} successfully`);
            fetchCorrectionRequests();
            fetchData(true, true); // Refetch live dashboard data silently
            if (selectedRequestData && selectedRequestData.acr_id === acr_id) {
                fetchRequestDetail(acr_id);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleAcknowledgeRequest = async (acrId, status, rejectReason = '') => {
        try {
            await attendanceService.updateCorrectionStatus(acrId, status, rejectReason);
            toast.success(`Request ${status} successfully`);
            fetchCorrectionRequests();
            fetchData(true, true); // Refetch live dashboard data silently
            if (selectedRequestData && selectedRequestData.acr_id === acrId) {
                fetchRequestDetail(acrId);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    // Stats Cards Data
    const statCards = [
        { id: 'total', label: 'Total Employees', value: stats.total, icon: <Users size={20} />, bg: 'bg-indigo-50 dark:bg-indigo-500/10', color: 'text-indigo-600 dark:text-indigo-400' },
        { id: 'present', label: 'Total Present', value: stats.present, icon: <UserCheck size={20} />, bg: 'bg-emerald-50 dark:bg-emerald-500/10', color: 'text-emerald-600 dark:text-emerald-400' },
        { id: 'late', label: 'Late Arrivals', value: stats.late, icon: <Clock size={20} />, bg: 'bg-amber-50 dark:bg-amber-500/10', color: 'text-amber-600 dark:text-amber-400' },
        { id: 'absent', label: 'Absent', value: stats.absent, icon: <UserX size={20} />, bg: 'bg-rose-50 dark:bg-rose-500/10', color: 'text-rose-600 dark:text-rose-400' },
        { id: 'active', label: 'Currently Active', value: stats.active, icon: <Activity size={20} />, bg: 'bg-blue-50 dark:bg-blue-500/10', color: 'text-blue-600 dark:text-blue-400' },
    ];

    // Filter Logic for Live Tab
    const filteredData = attendanceData.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = departmentFilter === 'All' || item.department === departmentFilter;
        const matchesDesg = desgFilter === 'All' || item.role === desgFilter;
        const matchesShift = shiftFilter === 'All' || (shiftFilter === 'open_shift' ? !item.shift_id : String(item.shift_id) === String(shiftFilter));
        
        let matchesStatus = true;
        if (statusFilter === 'present') {
            matchesStatus = item.status !== 'Absent' && item.status !== 'Week Off' && item.status !== 'Holiday' && item.status !== 'Leave';
        } else if (statusFilter === 'late') {
            matchesStatus = item.allStatuses ? item.allStatuses.includes('Late') : item.status.includes('Late');
        } else if (statusFilter === 'absent') {
            matchesStatus = item.status === 'Absent';
        } else if (statusFilter === 'active') {
            matchesStatus = item.allStatuses ? item.allStatuses.includes('Active') : item.status.includes('Active');
        }
        
        return matchesSearch && matchesDept && matchesDesg && matchesShift && matchesStatus;
    });

    const getStatusStyle = (status) => {
        if (String(status).includes('Late')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        switch (status) {
            case 'Present': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse';
            case 'Absent': return 'bg-slate-100 text-slate-500 dark:bg-github-dark-subtle dark:text-github-dark-muted';
            case 'Half Day': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
            case 'Overtime': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
            case 'Missed Punch': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            case 'Week Off': return 'bg-slate-100 text-slate-500 dark:bg-github-dark-subtle dark:text-github-dark-muted border border-dashed border-slate-200 dark:border-github-dark-border';
            case 'Holiday': return 'bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30';
            case 'Leave': return 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30';
            default: return 'bg-slate-100 text-slate-700 dark:bg-github-dark-subtle dark:text-slate-300';
        }
    };

    const getRequestTypeStyle = (type) => {
        const typeStr = String(type).toLowerCase().replace(/_/g, ' ');

        // Match the screenshot colors with backgrounds
        // Check overtime FIRST before checking 'time' to avoid false matches
        if (typeStr.includes('overtime')) {
            return 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-purple-600 bg-purple-50 dark:bg-purple-900/20';
        }
        if (typeStr.includes('missed') || typeStr.includes('manual')) {
            return 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-amber-600 bg-amber-50 dark:bg-amber-900/20';
        }
        if (typeStr.includes('correction') || typeStr.includes('time') || typeStr.includes('adjustment')) {
            return 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-blue-600 bg-blue-50 dark:bg-blue-900/20';
        }
        return 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-slate-600 bg-slate-50 dark:text-github-dark-muted dark:bg-github-dark-subtle';
    };

    const formatCorrectionDate = (dateStr) => {
        if (!dateStr) return 'Unknown Date';
        try {
            const cleanStr = (dateStr.length === 10 && !dateStr.includes('T')) ? dateStr + 'T00:00:00' : dateStr;
            const d = new Date(cleanStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    };

    // Correction Date Navigation
    const handleCorrectionPrevDay = () => {
        const date = new Date(correctionFilter.date);
        date.setDate(date.getDate() - 1);
        setCorrectionFilter(prev => ({ ...prev, type: 'day', date: date.toISOString().split('T')[0] }));
    };

    const handleCorrectionNextDay = () => {
        const date = new Date(correctionFilter.date);
        date.setDate(date.getDate() + 1);
        setCorrectionFilter(prev => ({ ...prev, type: 'day', date: date.toISOString().split('T')[0] }));
    };

    const filteredRequests = correctionRequests.filter(req =>
        req.user_name?.toLowerCase().includes(correctionSearchTerm.toLowerCase())
    );

    const getStatusData = () => {
        // Create disjoint sets that sum to total headcount for a valid Pie Chart
        const active = attendanceData.filter(d => d.status === 'Active' || d.status === 'Late Active').length;
        const missedPunch = attendanceData.filter(d => d.status === 'Missed Punch').length;
        const overtime = attendanceData.filter(d => d.status === 'Overtime').length;
        const late = attendanceData.filter(d => d.status === 'Late').length;
        const present = attendanceData.filter(d => d.status === 'Present').length;
        const absent = attendanceData.filter(d => d.status === 'Absent').length;
        const weekOff = attendanceData.filter(d => d.status === 'Week Off').length;
        const holiday = attendanceData.filter(d => d.status === 'Holiday').length;
        const leave = attendanceData.filter(d => d.status === 'Leave').length;

        return [
            { name: 'Present', value: present, color: '#10b981' },
            { name: 'Late', value: late, color: '#f59e0b' },
            { name: 'Overtime', value: overtime, color: '#8b5cf6' },
            { name: 'Missed Punch', value: missedPunch, color: '#f43f5e' },
            { name: 'Absent', value: absent, color: '#ef4444' },
            { name: 'Active', value: active, color: '#3b82f6' },
            { name: 'Week Off', value: weekOff, color: '#6b7280' },
            { name: 'Holiday', value: holiday, color: '#0ea5e9' },
            { name: 'Leave', value: leave, color: '#a855f7' },
        ].filter(item => item.value > 0);
    };

    const getDepartmentData = () => {
        const deptStats = {};
        attendanceData.forEach(item => {
            const dept = item.department || 'Unknown';
            if (!deptStats[dept]) deptStats[dept] = { name: dept, Present: 0, Absent: 0, Late: 0 };

            if (item.status === 'Absent') deptStats[dept].Absent++;
            else if (item.allStatuses ? item.allStatuses.includes('Late') : item.status.includes('Late')) deptStats[dept].Late++;
            else deptStats[dept].Present++;
        });
        return Object.values(deptStats);
    };

    const getTimelineData = () => {
        const hourlyData = {};
        // Initialize hours from 12 AM (0) to 11 PM (23)
        for (let i = 0; i <= 23; i++) {
            hourlyData[i] = { checkins: 0, repeats: 0, active: 0 };
        }

        attendanceData.forEach(item => {
            item.sessions.forEach((session, index) => {
                const inTime = session.rawIn;
                const inHour = inTime.getHours();

                if (hourlyData.hasOwnProperty(inHour)) {
                    if (index === 0) {
                        hourlyData[inHour].checkins++; // First login of the day
                    } else {
                        hourlyData[inHour].repeats++; // Subsequent login
                    }
                }

                const outTime = session.rawOut;
                for (let h = 0; h <= 23; h++) {
                    const hourStart = h;
                    if (inHour <= hourStart) {
                        if (!outTime || outTime.getHours() > hourStart) {
                            hourlyData[h].active++;
                        }
                    }
                }
            });
        });

        return Object.keys(hourlyData).map(hour => {
            const h = parseInt(hour);
            const label = h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
            return {
                time: label,
                checkins: hourlyData[hour].checkins,
                repeats: hourlyData[hour].repeats,
                active: hourlyData[hour].active
            };
        });
    };

    const getLoginFrequencyData = () => {
        const frequency = {
            '1 Session': 0,
            '2 Sessions': 0,
            '3 Sessions': 0,
            '4+ Sessions': 0
        };

        attendanceData.forEach(item => {
            if (item.status !== 'Absent') {
                const count = item.sessions.length;
                if (count === 1) frequency['1 Session']++;
                else if (count === 2) frequency['2 Sessions']++;
                else if (count === 3) frequency['3 Sessions']++;
                else if (count >= 4) frequency['4+ Sessions']++;
            }
        });

        return Object.entries(frequency).map(([name, value]) => ({ name, value }));
    };



    return (
        <>
            <style>
                {`
                .leaflet-container {
                    background-color: ${
                        activeTheme === 'dark' ? '#0f0f11' : 
                        activeTheme === 'voyager' ? '#cadbe3' : 
                        activeTheme === 'streets' ? '#aad3df' : 
                        activeTheme === 'satellite' ? '#040810' : 
                        '#e4edf2'
                    } !important;
                }
                .leaflet-tile-pane {
                    will-change: auto !important;
                }
                .leaflet-tile {
                    image-rendering: -webkit-optimize-contrast;
                    -webkit-backface-visibility: hidden;
                    backface-visibility: hidden;
                    transform: scale(1.002);
                }
                .user-marker-in, .user-marker-out, .user-marker-combined {
                    z-index: 500 !important;
                }
                .marker-inner {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    transform-origin: bottom center;
                }
                .user-marker-in:hover .marker-inner, .user-marker-out:hover .marker-inner, .user-marker-combined:hover .marker-inner, .marker-inner.locked {
                    transform: scale(1.2) translateY(-10px) !important;
                }
                .user-marker-in:hover, .user-marker-out:hover, .user-marker-combined:hover {
                    z-index: 1000 !important;
                }
                .premium-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    pointer-events: none !important;
                }
                .premium-tooltip::before {
                    display: none !important;
                }
                
                .cluster-marker-inner {
                    width: 44px;
                    height: 44px;
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 800;
                    font-size: 14px;
                    box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.4);
                    border: 2px solid white;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    transform-origin: bottom center;
                }
                .cluster-marker:hover .cluster-marker-inner {
                    transform: scale(1.1) translateY(-5px) !important;
                    box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.5);
                }

                /* Premium Popup Styles */
                .premium-popup .leaflet-popup-content-wrapper {
                    background: white !important;
                    color: #1e293b !important;
                    border-radius: 12px !important;
                    padding: 0 !important;
                    border: 1px solid #e2e8f0 !important;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
                    overflow: hidden !important;
                }
                .premium-popup .leaflet-popup-content {
                    margin: 0 !important;
                    width: auto !important;
                }
                .premium-popup .leaflet-popup-tip {
                    background: white !important;
                    border: 1px solid #e2e8f0 !important;
                }
                .dark .premium-popup .leaflet-popup-content-wrapper {
                    background: #0d1117 !important;
                    color: #c9d1d9 !important;
                    border: 1px solid #30363d !important;
                }
                .dark .premium-popup .leaflet-popup-tip {
                    background: #0d1117 !important;
                }
                .dark .premium-popup .leaflet-popup-close-button {
                    color: #8b949e !important;
                }
                .dark .premium-popup .leaflet-popup-close-button:hover {
                    color: #f0f6fc !important;
                    background: #30363d !important;
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none !important;
                }
                .no-scrollbar {
                    -ms-overflow-style: none !important;
                    scrollbar-width: none !important;
                }
                `}
            </style>
            <DashboardLayout title="Live Attendance" noPadding={true} tourPageKey={PAGE_KEY} tourSteps={tourSteps}>
                <div className={`${(activeTab === 'requests' || (activeTab === 'live' && activeView === 'map')) ? 'h-[calc(100vh-64px)] overflow-hidden' : ''} p-3 flex flex-col space-y-3`}>
                    {/* Tabs */}
                    <div data-tour-id="attendance-tabs" className="flex w-fit items-center gap-3 p-1.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0">
                        <button
                            onClick={() => setActiveTab('live')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'live' ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-202'}`}
                        >
                            <LayoutGrid size={14} className={`${activeTab === 'live' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-450'} -mt-[1px]`} />
                            <span className="leading-none">Live Dashboard</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'requests' ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-202'}`}
                        >
                            <FileText size={14} className={`${activeTab === 'requests' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-455'} -mt-[1px]`} />
                            <span className="leading-none">Correction Requests</span>
                            {requestCount > 0 && activeTab !== 'requests' && (
                                <span className="absolute -top-1.5 -right-2 w-5 h-5 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full animate-pulse border border-white dark:border-github-dark-subtle shadow-sm leading-none">
                                    {requestCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className={`${(activeTab === 'requests' || (activeTab === 'live' && activeView === 'map')) ? 'flex-1 min-h-0' : ''} flex flex-col space-y-4`} style={{ zoom: 0.8 }}>

                    {activeTab === 'live' ? (
                        <>
                            {/* Stats Cards */}
                            <div data-tour-id="attendance-live-stats" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {statCards.map((stat, index) => {
                                    const isSelected = statusFilter === stat.id;
                                    return (
                                        <div
                                            key={index}
                                            onClick={() => setStatusFilter(isSelected ? 'All' : stat.id)}
                                            className={`p-4 rounded-lg shadow-sm flex items-center justify-between transition-all duration-300 cursor-pointer select-none bg-white dark:bg-dark-card border-2 ${
                                                isSelected
                                                    ? 'border-indigo-500 dark:border-indigo-500 scale-[1.01] shadow-md'
                                                    : 'border-slate-200 dark:border-github-dark-border hover:border-slate-350 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-sm font-medium text-slate-500 dark:text-github-dark-muted">{stat.label}</p>
                                                    {isSelected && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                                    )}
                                                </div>
                                                <p className="text-2xl font-bold text-slate-800 dark:text-github-dark-text mt-1">{stat.value}</p>
                                            </div>
                                            <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                                                {stat.icon}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Main Content */}
                            <div className={`${(activeTab === 'requests' || (activeTab === 'live' && activeView === 'map')) ? 'flex-1 min-h-0' : ''} transition-colors duration-300 flex flex-col space-y-4`}>

                                {/* Premium Control Center */}
                                <div data-tour-id="attendance-controls" className="p-6 bg-white dark:bg-dark-card rounded-lg shadow-sm border border-slate-200 dark:border-github-dark-border space-y-6 shrink-0">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-2xl font-black text-slate-900 dark:text-github-dark-text tracking-tighter uppercase">
                                                    {activeView === 'cards' ? 'Employee Overview' : activeView === 'graph' ? 'Live Analytics' : 'Activity Timeline'}
                                                </h2>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-md">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                                                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Real-time</span>
                                                </div>
                                                {statusFilter !== 'All' && (
                                                    <button
                                                        onClick={() => setStatusFilter('All')}
                                                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 rounded-md text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors"
                                                    >
                                                        <span>Filter: {statusFilter === 'total' ? 'Total Employees' : statusFilter === 'present' ? 'Present' : statusFilter === 'late' ? 'Late Arrivals' : statusFilter === 'absent' ? 'Absent' : statusFilter === 'active' ? 'Currently Active' : statusFilter}</span>
                                                        <span className="text-xs font-normal">×</span>
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 dark:text-github-dark-muted font-medium mt-1">
                                                {activeView === 'cards' && 'Monitoring all on-duty staff status and session availability.'}
                                                {activeView === 'graph' && 'Deep dive into attendance metrics, trends, and department KPIs.'}
                                                {activeView === 'table' && 'High-density Gantt visualization of daily employee movements.'}
                                            </p>
                                        </div>

                                        </div>
                                    </div>

                                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-4 border-t border-slate-50 dark:border-github-dark-border/30">
                                        <div className="flex items-center gap-3 flex-1 flex-wrap">
                                            <div className="relative flex-1 max-w-md group">
                                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="Search by name, role or department..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pl-11 pr-4 py-2.5 text-xs w-full rounded-lg border border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 text-slate-900 dark:text-github-dark-text focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-dark-card outline-none transition-all shadow-inner"
                                                />
                                            </div>
                                            <button
                                                onClick={generateAiSummary}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs rounded-lg shadow-md hover:shadow-lg transition-all"
                                            >
                                                <Sparkles size={14} className="animate-pulse" />
                                                AI Summary
                                            </button>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                                                    className="pl-10 pr-8 py-2.5 text-xs rounded-lg border border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 text-slate-700 dark:text-github-dark-text outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner min-w-[155px] font-bold text-left flex items-center justify-between gap-2"
                                                >
                                                    <span className="truncate">
                                                        {DEPARTMENTS.find(d => d.value === departmentFilter)?.label || 'All Departments'}
                                                    </span>
                                                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isDeptDropdownOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                                <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                                                <AnimatePresence>
                                                    {isDeptDropdownOpen && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-[80]"
                                                                onClick={() => setIsDeptDropdownOpen(false)}
                                                            />
                                                            <motion.div
                                                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="absolute top-full left-0 mt-1.5 w-full min-w-[180px] bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden z-[90]"
                                                            >
                                                                <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
                                                                    {DEPARTMENTS.map((dept) => {
                                                                        const isSelected = departmentFilter === dept.value;
                                                                        return (
                                                                            <button
                                                                                key={dept.value}
                                                                                onClick={() => {
                                                                                    setDepartmentFilter(dept.value);
                                                                                    setIsDeptDropdownOpen(false);
                                                                                }}
                                                                                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors text-left ${isSelected
                                                                                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                                    }`}
                                                                            >
                                                                                <span>{dept.label}</span>
                                                                                {isSelected && <Check size={12} className="text-indigo-500" />}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        </>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsDesgDropdownOpen(!isDesgDropdownOpen)}
                                                    className="pl-10 pr-8 py-2.5 text-xs rounded-lg border border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 text-slate-700 dark:text-github-dark-text outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner min-w-[155px] font-bold text-left flex items-center justify-between gap-2"
                                                >
                                                    <span className="truncate">
                                                        {DESIGNATIONS.find(d => d.value === desgFilter)?.label || 'All Designations'}
                                                    </span>
                                                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isDesgDropdownOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                                <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                                                <AnimatePresence>
                                                    {isDesgDropdownOpen && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-[80]"
                                                                onClick={() => setIsDesgDropdownOpen(false)}
                                                            />
                                                            <motion.div
                                                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="absolute top-full left-0 mt-1.5 w-full min-w-[180px] bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden z-[90]"
                                                            >
                                                                <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
                                                                    {DESIGNATIONS.map((desg) => {
                                                                        const isSelected = desgFilter === desg.value;
                                                                        return (
                                                                            <button
                                                                                key={desg.value}
                                                                                onClick={() => {
                                                                                    setDesgFilter(desg.value);
                                                                                    setIsDesgDropdownOpen(false);
                                                                                }}
                                                                                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors text-left ${isSelected
                                                                                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                                    }`}
                                                                            >
                                                                                <span>{desg.label}</span>
                                                                                {isSelected && <Check size={12} className="text-indigo-500" />}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        </>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsShiftDropdownOpen(!isShiftDropdownOpen)}
                                                    className="pl-10 pr-8 py-2.5 text-xs rounded-lg border border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 text-slate-700 dark:text-github-dark-text outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner min-w-[155px] font-bold text-left flex items-center justify-between gap-2"
                                                >
                                                    <span className="truncate">
                                                        {SHIFTS.find(s => s.value === shiftFilter)?.label || 'All Shifts'}
                                                    </span>
                                                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isShiftDropdownOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                                <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                                                <AnimatePresence>
                                                    {isShiftDropdownOpen && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-[80]"
                                                                onClick={() => setIsShiftDropdownOpen(false)}
                                                            />
                                                            <motion.div
                                                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="absolute top-full left-0 mt-1.5 w-full min-w-[180px] bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden z-[90]"
                                                            >
                                                                <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
                                                                    {SHIFTS.map((s) => {
                                                                        const isSelected = shiftFilter === s.value;
                                                                        return (
                                                                            <button
                                                                                key={s.value}
                                                                                onClick={() => {
                                                                                    setShiftFilter(s.value);
                                                                                    setIsShiftDropdownOpen(false);
                                                                                }}
                                                                                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors text-left ${isSelected
                                                                                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                                    }`}
                                                                            >
                                                                                <span>{s.label}</span>
                                                                                {isSelected && <Check size={12} className="text-indigo-500" />}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        </>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Date Navigation Filter Control */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={handlePrevDay}
                                                    type="button"
                                                    className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                                                    title="Previous Day"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>

                                                <div className="w-[230px]">
                                                    <DatePicker
                                                        value={selectedDate}
                                                        onChange={(date) => setSelectedDate(date)}
                                                        compact={true}
                                                    />
                                                </div>

                                                <button
                                                    onClick={handleNextDay}
                                                    type="button"
                                                    className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                                                    title="Next Day"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Uniform View Switcher */}
                                        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-xl w-fit border border-slate-200 dark:border-github-dark-border/50">
                                            {[
                                                { id: 'cards', label: 'Overview', icon: LayoutGrid },
                                                { id: 'graph', label: 'Analytics', icon: BarChartIcon },
                                                { id: 'table', label: 'Timeline', icon: Table },
                                                { id: 'map', label: 'Map View', icon: MapPin }
                                            ].map((view) => {
                                                const isSelected = activeView === view.id;
                                                return (
                                                    <button
                                                        key={view.id}
                                                        onClick={() => setActiveView(view.id)}
                                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                                            isSelected
                                                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                                                : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-202'
                                                        }`}
                                                    >
                                                        <view.icon size={15} className={`${isSelected ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
                                                        <span className="leading-none">{view.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>


                                <div className={`${(activeTab === 'requests' || (activeTab === 'live' && activeView === 'map')) ? 'flex-1 min-h-0 overflow-y-auto' : ''} custom-scrollbar ${activeView === 'map' ? 'flex flex-col' : ''}`}>
                                    {activeView === 'table' ? (
                                        <div data-tour-id="attendance-live-monitor" className="bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500 min-h-[450px]">
                                            <div className="overflow-x-auto custom-scrollbar">
                                                <div className="min-w-[2000px]">
                                                    {/* Timeline Header */}
                                                    <div className="flex bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">
                                                        <div className="w-[300px] shrink-0 px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 border-r border-slate-200 dark:border-github-dark-border sticky left-0 bg-slate-50 dark:bg-github-dark-subtle z-30">
                                                            Employee Details
                                                        </div>
                                                        <div className="flex-1 flex">
                                                            {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                                                                <div key={hour} className="flex-1 py-4 text-center text-[10px] font-bold text-slate-400 border-r border-slate-200 dark:border-github-dark-border/30 last:border-r-0">
                                                                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Timeline Rows */}
                                                    <div className="divide-y divide-slate-100 dark:divide-github-dark-border/50">
                                                        {loading && attendanceData.length === 0 ? (
                                                            <div className="p-10 text-center text-slate-400">Loading timeline...</div>
                                                        ) : filteredData.length === 0 ? (
                                                            <div className="p-10 text-center text-slate-400">No employees found.</div>
                                                        ) : (
                                                            filteredData.map((item, rowIdx) => {
                                                                const startHour = 0;
                                                                const totalHours = 24;
                                                                const timeToPct = (date) => {
                                                                    if (!date) return null;
                                                                    const h = date.getHours();
                                                                    const m = date.getMinutes();
                                                                    const totalMinutes = (h - startHour) * 60 + m;
                                                                    return Math.max(0, Math.min(100, (totalMinutes / (totalHours * 60)) * 100));
                                                                };

                                                                return (
                                                                    <div key={item.id} className="relative z-10 flex hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 transition-colors group cursor-pointer hover:z-20" onClick={() => setSelectedLiveUser(item)}>
                                                                        {/* Employee Info (Sticky) */}
                                                                        <div className="w-[300px] shrink-0 px-6 py-4 flex items-center gap-3 border-r border-slate-200 dark:border-github-dark-border sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-github-dark-subtle z-20">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm overflow-hidden ${item.status === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-github-dark-subtle dark:text-github-dark-muted' : 'bg-gradient-to-br from-indigo-500/10 to-purple-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20'}`}>
                                                                                    {item.avatar.startsWith('http') ? (
                                                                                        <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        item.avatar
                                                                                    )}
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <p className="font-bold text-sm text-slate-800 dark:text-github-dark-text truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.name}</p>
                                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${item.status === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-github-dark-subtle' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30'}`}>
                                                                                            {item.status.split(' ')[0]}
                                                                                        </span>

                                                                                        <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-mono font-bold">
                                                                                            {item.totalHours && (item.totalHours.toLowerCase().includes('hr') || item.totalHours.toLowerCase().includes('min') || item.totalHours === '-') ? item.totalHours : `${item.totalHours} Hrs`}
                                                                                            {item.expectedHours && item.expectedHours !== '-' && ` / ${item.expectedHours}`}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Timeline Grid */}
                                                                        <div className="flex-1 relative flex h-20 items-center">
                                                                            {/* Hour Grid Lines */}
                                                                            <div className="absolute inset-0 flex">
                                                                                {Array.from({ length: 24 }).map((_, i) => (
                                                                                    <div key={i} className="flex-1 border-r border-slate-100 dark:border-github-dark-border/30 last:border-r-0"></div>
                                                                                ))}
                                                                            </div>

                                                                            {/* Session Blocks */}
                                                                            <div className="absolute inset-x-0 h-10 z-10 px-2">
                                                                                {item.sessions.map((session, sIdx) => {
                                                                                    const startPos = timeToPct(session.rawIn);
                                                                                    const endPos = session.isActive ? timeToPct(getCurrentTimeInTimezone(orgTimezone)) : timeToPct(session.rawOut);
                                                                                    const width = endPos - startPos;

                                                                                    if (startPos === null) return null;

                                                                                    return (
                                                                                        <div
                                                                                            key={sIdx}
                                                                                            className={`absolute top-0 h-full rounded-md border-2 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all cursor-pointer group/session ${session.isActive ? 'bg-gradient-to-r from-indigo-500 to-blue-500 border-indigo-400/50 animate-pulse' : 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400/50'}`}
                                                                                            style={{ left: `${startPos}%`, width: `${Math.max(width, 1)}%` }}
                                                                                        >
                                                                                            {/* Floating Labels on active */}
                                                                                            {session.isActive && (
                                                                                                <div className="absolute -top-6 left-0 right-0 text-center">
                                                                                                    <span className="text-[8px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-md uppercase tracking-widest shadow-lg">Active Now</span>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* Tooltip on Hover */}
                                                                                            <div className={`absolute ${rowIdx < 2 ? 'top-full mt-3' : 'bottom-full mb-3'} left-1/2 -translate-x-1/2 px-4 py-3.5 bg-slate-955 dark:bg-[#0d1117] text-white text-[10px] rounded-xl opacity-0 group-hover/session:opacity-100 transition-all duration-300 transform ${rowIdx < 2 ? '-translate-y-2' : 'translate-y-2'} group-hover/session:translate-y-0 whitespace-normal z-50 pointer-events-none shadow-2xl border border-slate-700 dark:border-github-dark-border w-[320px]`}>
                                                                                                {/* Timing Info */}
                                                                                                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Session Timing</span>
                                                                                                    <span className="font-mono font-bold text-indigo-400">{session.in} — {session.out}</span>
                                                                                                </div>
                                                                                                
                                                                                                <div className="grid grid-cols-2 gap-4">
                                                                                                    {/* In details */}
                                                                                                    <div className="space-y-2 flex flex-col items-center">
                                                                                                        <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider block self-start">Punch In</span>
                                                                                                        {session.inImage ? (
                                                                                                            <div className="flex justify-center w-full my-1 cursor-pointer" onClick={() => setPreviewImage(session.inImage)}>
                                                                                                                <img src={session.inImage} alt="In Selfie" className="max-h-32 max-w-full w-auto block rounded-xl shadow-sm object-contain hover:scale-105 transition-transform" />
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <div className="w-24 h-20 rounded-lg border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-[8px] gap-1 bg-black/10 my-1">
                                                                                                                <Camera size={12} />
                                                                                                                <span>No Selfie In</span>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        <div className="flex items-start gap-1 w-full text-[9px] leading-tight text-slate-300">
                                                                                                            <MapPin size={8} className="text-emerald-500 shrink-0 mt-0.5" />
                                                                                                            <span className="break-words">{session.inLocation}</span>
                                                                                                        </div>
                                                                                                    </div>

                                                                                                    {/* Out details */}
                                                                                                    <div className="space-y-2 flex flex-col items-center">
                                                                                                        <span className="text-[8px] font-bold text-rose-400 uppercase tracking-wider block self-start">Punch Out</span>
                                                                                                        {session.outImage ? (
                                                                                                            <div className="flex justify-center w-full my-1 cursor-pointer" onClick={() => setPreviewImage(session.outImage)}>
                                                                                                                <img src={session.outImage} alt="Out Selfie" className="max-h-32 max-w-full w-auto block rounded-xl shadow-sm object-contain hover:scale-105 transition-transform" />
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <div className="w-24 h-20 rounded-lg border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-[8px] gap-1 bg-black/10 my-1">
                                                                                                                <Camera size={12} />
                                                                                                                <span>{session.isActive ? 'Ongoing...' : 'No Selfie Out'}</span>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        {session.outLocation ? (
                                                                                                            <div className="flex items-start gap-1 w-full text-[9px] leading-tight text-slate-300">
                                                                                                                <MapPin size={8} className="text-rose-500 shrink-0 mt-0.5" />
                                                                                                                <span className="break-words">{session.outLocation}</span>
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <span className="text-[8px] text-slate-500 italic block self-start">{session.isActive ? 'Session Active' : 'N/A'}</span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>

                                                                                                {/* Arrow */}
                                                                                                <div className={`absolute ${rowIdx < 2 ? '-top-1.5 border-l border-t' : '-bottom-1.5 border-r border-b'} left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-955 dark:bg-[#0d1117] rotate-45 border-slate-700 dark:border-github-dark-border`}></div>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>

                                                                            {/* Background Indicator for late arrival */}
                                                                            {item.allStatuses && item.allStatuses.includes('Late') && item.sessions[0] && (
                                                                                <div
                                                                                    className="absolute left-0 h-1 bg-amber-400/20 rounded-full"
                                                                                    style={{ width: `${timeToPct(item.sessions[0].rawIn)}%` }}
                                                                                    title="Late Arrival Period"
                                                                                ></div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : activeView === 'cards' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {loading ? (
                                                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                                                    {Array.from({ length: 8 }).map((_, i) => (
                                                        <div key={i} className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border/60 p-5 space-y-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700/60"></div>
                                                                <div className="space-y-2 flex-1">
                                                                    <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded w-3/4"></div>
                                                                    <div className="h-3 bg-slate-150 dark:bg-slate-800/80 rounded w-1/2"></div>
                                                                </div>
                                                            </div>
                                                            <div className="h-6 bg-slate-100 dark:bg-slate-800/80 rounded w-1/3"></div>
                                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                                <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                                                                <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : filteredData.length > 0 ? (
                                                filteredData.map((item, index) => {
                                                    const showDivider = item.status === 'Absent' && index > 0 && filteredData[index - 1].status !== 'Absent';

                                                    return (
                                                        <React.Fragment key={item.id}>
                                                            {showDivider && (
                                                                <div className="col-span-full py-6 flex items-center gap-4">
                                                                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Not Checked In</span>
                                                                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                                                                </div>
                                                            )}
                                                            <div
                                                                onClick={() => setSelectedLiveUser(item)}
                                                                data-tour-id={index === 0 ? "attendance-employee-card" : undefined}
                                                                className={`bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border/60 hover:shadow-md transition-all duration-300 overflow-hidden group flex flex-col cursor-pointer ${item.status === 'Absent' ? 'opacity-70 grayscale-[0.3]' : ''}`}
                                                            >
                                                                {/* Card Header */}
                                                                <div className="p-5 flex items-start justify-between">
                                                                    <div className="flex gap-4">
                                                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm overflow-hidden ${item.status === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-github-dark-subtle dark:text-github-dark-muted' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
                                                                            {item.avatar.startsWith('http') ? (
                                                                                <img src={`${item.avatar}?t=${avatarTimestamp}`} alt={item.name} className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                item.avatar
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="font-bold text-slate-800 dark:text-github-dark-text line-clamp-1" title={item.name}>{item.name}</h3>
                                                                            <p className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">{item.role}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button className="text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                                                        <MoreVertical size={18} />
                                                                    </button>
                                                                </div>

                                                                {/* Status Badge Line */}
                                                                <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
                                                                    {item.allStatuses && item.allStatuses.map(statusBadge => (
                                                                        <span key={statusBadge} className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusStyle(statusBadge).replace('bg-', 'bg-opacity-10 border-').replace('text-', 'text-')}`}>
                                                                            <div className={`w-1.5 h-1.5 rounded-full mr-2 ${statusBadge === 'Active' ? 'animate-pulse bg-current' : 'bg-current'}`}></div>
                                                                            {statusBadge}
                                                                        </span>
                                                                    ))}
                                                                 </div>

                                                                {/* Divider */}
                                                                <div className="h-px bg-slate-100 dark:bg-github-dark-subtle mx-5"></div>

                                                                {/* Card Body - Latest Session Only */}
                                                                <div className="p-5 flex-1 overflow-hidden">
                                                                    {item.status === 'Absent' ? (
                                                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-4 italic">
                                                                            <Clock size={20} className="mb-2 opacity-30" />
                                                                            <span className="text-xs">No activity yet</span>
                                                                        </div>
                                                                    ) : item.sessions.length > 0 ? (
                                                                        <div className="relative pl-4 border-l-2 border-indigo-500">
                                                                            {/* Session Indicator Dot */}
                                                                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-md border-2 border-white dark:border-dark-card shadow-sm ${item.sessions[0].isActive ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></div>

                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">
                                                                                    Latest Session
                                                                                </span>
                                                                                {item.sessions[0].isActive && (
                                                                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold uppercase animate-pulse">
                                                                                        Active
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            <div className="grid grid-cols-2 gap-4">
                                                                                <div className="space-y-1">
                                                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                                                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                                                        In {item.sessions[0].in}
                                                                                    </div>
                                                                                    <div className="flex items-start gap-1 text-[9px] text-slate-500 dark:text-github-dark-muted bg-slate-50 dark:bg-github-dark-subtle/50 p-1.5 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                                                                        <MapPin size={10} className="shrink-0 mt-0.5 text-indigo-400" />
                                                                                        <span className="break-words whitespace-normal" title={item.sessions[0].inLocation}>{item.sessions[0].inLocation}</span>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="space-y-1">
                                                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                                                                                        <div className={`w-1.5 h-1.5 rounded-full ${item.sessions[0].isActive ? 'bg-slate-300 dark:bg-slate-600' : 'bg-red-500'}`}></div>
                                                                                        Out {item.sessions[0].out}
                                                                                    </div>
                                                                                    {item.sessions[0].outLocation ? (
                                                                                        <div className="flex items-start gap-1 text-[9px] text-slate-500 dark:text-github-dark-muted bg-slate-50 dark:bg-github-dark-subtle/50 p-1.5 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                                                                            <MapPin size={10} className="shrink-0 mt-0.5 text-rose-400" />
                                                                                            <span className="break-words whitespace-normal" title={item.sessions[0].outLocation}>{item.sessions[0].outLocation}</span>
                                                                                        </div>
                                                                                    ) : item.sessions[0].isActive ? (
                                                                                        <div className="h-full flex items-center p-1.5">
                                                                                            <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">Ongoing...</span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="h-full flex items-center p-1.5">
                                                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">System Checkout</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {/* More Sessions Indicator */}
                                                                            {item.sessions.length > 1 && (
                                                                                <div className="mt-3 text-center">
                                                                                    <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full cursor-pointer hover:bg-indigo-100 transition-colors">
                                                                                        +{item.sessions.length - 1} more sessions
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : null}
                                                                </div>

                                                                {/* Card Footer (Duration) */}
                                                                {item.status !== 'Absent' && (
                                                                    <div className="bg-slate-50 dark:bg-github-dark-subtle/50 px-5 py-3 border-t border-slate-100 dark:border-github-dark-border flex items-center justify-between">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Daily Time</span>
                                                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                                                {item.totalHours}
                                                                                {item.expectedHours && item.expectedHours !== '-' && (
                                                                                    <span className="text-xs text-slate-400 dark:text-github-dark-muted font-normal">
                                                                                        (Expected: {item.expectedHours})
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                        {item.sessions.length > 1 && (
                                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm">
                                                                                <Activity size={12} className="text-indigo-500" />
                                                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{item.sessions.length} Sessions</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    );
                                                })
                                            ) : (
                                                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                                                    <div className="bg-slate-100 dark:bg-github-dark-subtle p-4 rounded-full mb-4">
                                                        <Search size={32} />
                                                    </div>
                                                    <p className="text-lg font-medium text-slate-600 dark:text-slate-300">No employees found</p>
                                                                     <p className="text-sm">Try adjusting your filters or search terms</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : activeView === 'map' ? (
                                        /* Map View Layout */
                                        <div className="flex-1 min-h-0 flex gap-0 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500 relative min-h-[450px]" style={{ zoom: 1.25 }}>
                                            <div className="flex-1 h-full relative">
                                                <MapContainer
                                                    center={[20, 78]}
                                                    zoom={5}
                                                    minZoom={3}
                                                    maxBounds={[[-90, -180], [90, 180]]}
                                                    maxBoundsViscosity={1.0}
                                                    className="h-full w-full z-0"
                                                    attributionControl={false}
                                                >
                                                    <TileLayer url={MAP_THEMES[activeTheme].url} noWrap={true} />

                                                    {/* Map Theme Switcher Overlay */}
                                                    <div className="absolute top-4 right-4 z-[1001]">
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                                                                className="flex items-center gap-2 bg-white dark:bg-github-dark-subtle text-slate-800 dark:text-github-dark-text px-4 py-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-github-dark-border hover:border-indigo-500/50 transition-all group"
                                                            >
                                                                <Layers size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                                                                <span className="text-sm font-semibold">{MAP_THEMES[activeTheme].name}</span>
                                                                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
                                                            </button>

                                                            {isThemeMenuOpen && (
                                                                <>
                                                                    <div className="fixed inset-0 z-10" onClick={() => setIsThemeMenuOpen(false)} />
                                                                    <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-20">
                                                                        <div className="py-1">
                                                                            {Object.entries(MAP_THEMES).map(([id, theme]) => (
                                                                                <button
                                                                                    key={id}
                                                                                    onClick={() => {
                                                                                        setActiveTheme(id);
                                                                                        setIsThemeMenuOpen(false);
                                                                                    }}
                                                                                    className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${activeTheme === id
                                                                                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold'
                                                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                                        }`}
                                                                                >
                                                                                    <span>{theme.name}</span>
                                                                                    {activeTheme === id && <Check size={14} className="text-indigo-500" />}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <MapRecenter data={filteredData} searchTerm={searchTerm} departmentFilter={departmentFilter} />

                                                    {(() => {
                                                        const areCoordsSame = (lat1, lng1, lat2, lng2) => {
                                                            if (!lat1 || !lng1 || !lat2 || !lng2) return false;
                                                            return Math.abs(Number(lat1) - Number(lat2)) < 0.0001 &&
                                                                Math.abs(Number(lng1) - Number(lng2)) < 0.0001;
                                                        };

                                                        const createClusterCustomIcon = function (cluster) {
                                                            const count = cluster.getChildCount();
                                                            return L.divIcon({
                                                                className: 'cluster-marker',
                                                                html: `<div class="cluster-marker-inner">
                                                                    <span>${count}</span>
                                                                    <div class="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-dark-card flex items-center justify-center shadow-sm">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                                    </div>
                                                                   </div>`,
                                                                iconSize: [44, 44],
                                                                iconAnchor: [22, 22]
                                                            });
                                                        };

                                                        return (
                                                            <>
                                                                <MarkerClusterGroup
                                                                    ref={setClusterGroupElement}
                                                                    chunkedLoading
                                                                    iconCreateFunction={createClusterCustomIcon}
                                                                    maxClusterRadius={40}
                                                                    spiderfyOnMaxZoom={false}
                                                                    showCoverageOnHover={false}
                                                                    zoomToBoundsOnClick={false}
                                                                >
                                                                    {filteredData.flatMap(user => {
                                                                        return user.sessions.flatMap((session, sIdx) => {
                                                                            const isCombined = areCoordsSame(session.inLat, session.inLng, session.outLat, session.outLng);

                                                                            const markersToRender = [];

                                                                            if (isCombined) {
                                                                                markersToRender.push({ lat: session.inLat, lng: session.inLng, type: 'combined' });
                                                                            } else {
                                                                                if (session.inLat && session.inLng) markersToRender.push({ lat: session.inLat, lng: session.inLng, type: 'in' });
                                                                                if (session.outLat && session.outLng) markersToRender.push({ lat: session.outLat, lng: session.outLng, type: 'out' });
                                                                            }

                                                                            return markersToRender.map(m => {
                                                                                const markerKey = `${user.id}-${sIdx}-${m.type}`;
                                                                                const { type, lat, lng } = m;
                                                                                const isSelected = selectedCluster && selectedCluster.data.some(item => item.user.id === user.id && item.type === type);

                                                                                return (
                                                                                    <Marker
                                                                                        key={markerKey}
                                                                                        position={[Number(lat), Number(lng)]}
                                                                                        customSessionData={{ user, session, type }}
                                                                                        eventHandlers={{
                                                                                            click: () => {
                                                                                                setSelectedCluster({
                                                                                                    position: [Number(lat), Number(lng)],
                                                                                                    data: [{ user, session, type }]
                                                                                                });
                                                                                            }
                                                                                        }}
                                                                                        icon={L.divIcon({
                                                                                            className: `user-marker-${type}`,
                                                                                            html: `<div class="marker-inner relative ${isSelected ? 'locked' : ''}">
                                                                                            <div class="w-10 h-10 rounded-full border-2 ${type === 'in' ? 'border-emerald-500' : type === 'out' ? 'border-rose-500' : 'border-transparent'} bg-white dark:bg-github-dark-subtle shadow-lg overflow-hidden flex items-center justify-center" ${type === 'combined' ? 'style="border-image: linear-gradient(to bottom right, #10b981 50%, #f43f5e 50%) 1;"' : ''}>
                                                                                                ${type === 'combined' ? `
                                                                                                    <div class="absolute inset-0 border-2 border-emerald-500 rounded-full" style="clip-path: polygon(0 0, 100% 0, 0 100%);"></div>
                                                                                                    <div class="absolute inset-0 border-2 border-rose-500 rounded-full" style="clip-path: polygon(100% 0, 100% 100%, 0 100%);"></div>
                                                                                                ` : ''}
                                                                                                ${user.avatar.startsWith('http')
                                                                                                    ? `<img src="${user.avatar}" class="w-full h-full object-cover" />`
                                                                                                    : `<span class="text-xs font-black text-slate-600 dark:text-slate-300">${user.avatar}</span>`
                                                                                                }
                                                                                            </div>
                                                                                            <div class="absolute -bottom-1 -right-1 w-4 h-4 ${type === 'in' ? 'bg-emerald-500' : type === 'out' ? 'bg-rose-500' : 'bg-indigo-600'} rounded-full border-2 border-white dark:border-dark-card flex items-center justify-center shadow-sm">
                                                                                                ${type === 'in' ? '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>' :
                                                                                                    type === 'out' ? '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' :
                                                                                                        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'}
                                                                                            </div>
                                                                                           </div>`,
                                                                                            iconSize: [40, 40],
                                                                                            iconAnchor: [20, 20]
                                                                                        })}
                                                                                    >
                                                                                    </Marker>
                                                                                );
                                                                            });
                                                                        });
                                                                    })}
                                                                </MarkerClusterGroup>
                                                            </>
                                                        );
                                                    })()}
                                                </MapContainer>
                                            </div>
                                            <AnimatePresence>
                                                {selectedCluster && (
                                                    <MapSidebarContent
                                                        selectedCluster={selectedCluster}
                                                        onClose={() => setSelectedCluster(null)}
                                                    />
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ) : activeView === 'graph' ? (
                                        /* Graph View Layout */
                                        <div className="space-y-6 animate-in fade-in duration-500">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {/* Status Distribution */}
                                                <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text">Attendance Status</h3>
                                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-md">
                                                            <PieChartIcon size={20} />
                                                        </div>
                                                    </div>
                                                    <div className="h-[300px] w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={getStatusData()}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={70}
                                                                    outerRadius={100}
                                                                    paddingAngle={8}
                                                                    dataKey="value"
                                                                    stroke="none"
                                                                >
                                                                    {getStatusData().map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip
                                                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                                                />
                                                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                {/* Department Breakdown */}
                                                <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text">Department Metrics</h3>
                                                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                                                            <BarChartIcon size={20} />
                                                        </div>
                                                    </div>
                                                    <div className="h-[300px] w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={getDepartmentData()}>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                                                                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                                                <Tooltip
                                                                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px', color: '#fff' }}
                                                                />
                                                                <Legend iconType="circle" />
                                                                <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                                                <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                                                                <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {/* Check-in Activity */}
                                                <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text">Staff Activity Timeline</h3>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase">Login</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase">Active</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="h-[300px] w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <AreaChart data={getTimelineData()}>
                                                                <defs>
                                                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                                    </linearGradient>
                                                                    <linearGradient id="colorCheckins" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                                    </linearGradient>
                                                                </defs>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                                                                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                                                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                                                <Tooltip
                                                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px', color: '#fff' }}
                                                                />
                                                                <Area name="Active Staff" type="monotone" dataKey="active" stroke="#10b981" fillOpacity={1} fill="url(#colorActive)" strokeWidth={3} />
                                                                <Area name="Staff Check-ins" type="monotone" dataKey="checkins" stroke="#6366f1" fillOpacity={1} fill="url(#colorCheckins)" strokeWidth={3} />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                {/* Login Frequency */}
                                                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text">Session Frequency</h3>
                                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                                                            <Activity size={20} />
                                                        </div>
                                                    </div>
                                                    <div className="h-[300px] w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={getLoginFrequencyData()} layout="vertical" margin={{ left: 20 }}>
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.3} />
                                                                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                                                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={80} />
                                                                <Tooltip
                                                                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px', color: '#fff' }}
                                                                />
                                                                <Bar dataKey="value" name="Employees" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24}>
                                                                    {getLoginFrequencyData().map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={`url(#gradBar-${index})`} />
                                                                    ))}
                                                                </Bar>
                                                                <defs>
                                                                    {getLoginFrequencyData().map((_, i) => (
                                                                        <linearGradient key={i} id={`gradBar-${i}`} x1="0" y1="0" x2="1" y2="0">
                                                                            <stop offset="0%" stopColor="#6366f1" />
                                                                            <stop offset="100%" stopColor="#a855f7" />
                                                                        </linearGradient>
                                                                    ))}
                                                                </defs>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Shift Hours Progress */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                                        <Clock size={20} className="text-indigo-500" /> Shift Hours Progress
                                                    </h3>
                                                    <span className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted">
                                                        Actual logged hours vs. Expected shift duration today
                                                    </span>
                                                </div>
                                                {presentStaffChartData.length === 0 ? (
                                                    <p className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-12">
                                                        No checked-in employees to track shift hours.
                                                    </p>
                                                ) : (
                                                    <div className="h-[400px] w-full overflow-y-auto pr-2 custom-scrollbar">
                                                        <div style={{ height: Math.max(350, presentStaffChartData.length * 45) }}>
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <BarChart
                                                                    data={presentStaffChartData}
                                                                    layout="vertical"
                                                                    margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                                                                    barGap={4}
                                                                >
                                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.3} />
                                                                    <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 'dataMax + 1']} />
                                                                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={100} />
                                                                    <Tooltip content={<CustomHoursTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                                                    <Legend verticalAlign="top" height={36} iconType="circle" />
                                                                    <Bar dataKey="logged" name="Logged Hours" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                                                                    <Bar dataKey="expected" name="Expected Hours" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={12} opacity={0.5} />
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                        </>
                    ) : (
                    // Approvals Tab Content
                    <div data-tour-id="attendance-requests-queue" className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">

                        <div className="w-full lg:w-1/3 bg-white dark:bg-dark-card rounded-lg shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col h-full shrink-0">
                            {/* Header and Search */}
                            <div className="p-4 border-b border-slate-200 dark:border-github-dark-border space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Requests</h3>
                                    <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                                        {requestCount} Pending
                                    </div>
                                    </div>

                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Search by employee name..."
                                            value={correctionSearchTerm}
                                            onChange={(e) => setCorrectionSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-md focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                        />
                                    </div>

                                {/* Date Navigation */}
                                { /* Date Navigation Removed */}
                            </div>
                            <div className="overflow-y-auto no-scrollbar flex-1 p-3 space-y-3">
                                {requestsLoading ? (
                                    <div className="p-10 text-center text-slate-400">Loading...</div>
                                ) : filteredRequests.length === 0 ? (
                                    <div className="p-10 text-center text-slate-400">No requests found.</div>
                                ) : (
                                    filteredRequests.map((request) => (
                                        <div
                                            key={request.acr_id}
                                            onClick={() => {
                                                setSelectedRequestId(request.acr_id);
                                                fetchRequestDetail(request.acr_id);
                                            }}
                                            className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                                                selectedRequestId === request.acr_id
                                                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-400/40 dark:border-indigo-500/40 shadow-indigo-500/5'
                                                    : 'bg-slate-50/40 dark:bg-github-dark-subtle/20 border-slate-200/60 dark:border-github-dark-border/80 hover:bg-slate-50/80 dark:hover:bg-github-dark-subtle/40 hover:border-slate-300 dark:hover:border-github-dark-border'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                        {request.profile_image_url && request.profile_image_url.startsWith('http') ? (
                                                            <img src={`${request.profile_image_url}?t=${avatarTimestamp}`} alt={request.user_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            (request.user_name || 'U').charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className={`text-xs font-bold leading-none ${selectedRequestId === request.acr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>{request.user_name}</p>
                                                        <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium mt-1 inline-block">ID: {request.user_id}</span>
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                    request.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                    : request.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                }`}>{request.status}</span>
                                            </div>

                                            <p className={`text-sm font-semibold mb-1 ${selectedRequestId === request.acr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                {formatCorrectionDate(request.request_date)}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-github-dark-muted italic line-clamp-1">"{request.reason || 'No reason provided.'}"</p>
                                            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2.5 font-mono border-t border-slate-100/50 dark:border-github-dark-border/30 pt-2">
                                                <span>Sub. {request.submitted_at ? new Date(request.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                                                <span className={getRequestTypeStyle(request.correction_type)}>{(request.correction_type || '').replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Detail Panel */}
                        <div className="w-full lg:w-2/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col h-full">
                            {detailLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 dark:text-github-dark-muted">
                                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                                    <p className="text-xs font-bold uppercase tracking-wider">Fetching details...</p>
                                </div>
                            ) : selectedRequestData ? (
                                <>
                                    <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                {selectedRequestData.profile_image_url && selectedRequestData.profile_image_url.startsWith('http') ? (
                                                    <img src={`${selectedRequestData.profile_image_url}?t=${avatarTimestamp}`} alt={selectedRequestData.user_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    (selectedRequestData.user_name || 'U').charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-900 dark:text-github-dark-text mb-0.5">Request #{selectedRequestData.acr_id}</h2>
                                                <p className="text-xs text-slate-500 dark:text-github-dark-muted">
                                                    By <span className="font-bold text-slate-700 dark:text-slate-350">{selectedRequestData.user_name}</span> ({selectedRequestData.designation || 'Employee'}) • {formatCorrectionDate(selectedRequestData.request_date)}
                                                </p>
                                            </div>
                                        </div>
                                        {selectedRequestData.status === 'pending' ? (
                                            <div className="flex gap-2.5">
                                                <button
                                                    onClick={() => handleUpdateStatus(selectedRequestData.acr_id, 'rejected')}
                                                    className="px-4 py-2 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1.5"
                                                >
                                                    <XCircle size={15} /> Reject
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(selectedRequestData.acr_id, 'approved')}
                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1.5"
                                                >
                                                    <CheckCircle size={15} /> Approve
                                                </button>
                                            </div>
                                        ) : (
                                            <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-lg border ${
                                                selectedRequestData.status === 'approved' 
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30' 
                                                    : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/30'
                                            }`}>
                                                {selectedRequestData.status}
                                            </span>
                                        )}
                                    </div>

                                    {/* ADMIN OVERRIDE SECTION */}
                                    {selectedRequestData.status === 'pending' && (
                                        <div className="px-6 py-4 bg-slate-50 dark:bg-github-dark-subtle/50 border-b border-slate-200 dark:border-github-dark-border">
                                            <div className="flex items-center gap-3 mb-4">
                                                <input
                                                    type="checkbox"
                                                    id="overrideToggle"
                                                    checked={overrideMode}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        setOverrideMode(isChecked);
                                                        if (isChecked && selectedRequestData) {
                                                            const getTime = (val) => {
                                                                if (!val) return '';
                                                                const timePart = val.includes(' ') ? val.split(' ')[1] : (val.includes('T') ? val.split('T')[1] : val);
                                                                return timePart.substring(0, 5);
                                                            };
                                                            setOverrideIn(getTime(selectedRequestData.requested_time_in));
                                                            setOverrideOut(getTime(selectedRequestData.requested_time_out));
                                                            setOverrideMethod(selectedRequestData.correction_method || 'fix');
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-indigo-600 rounded border-slate-350 dark:border-github-dark-border focus:ring-indigo-500"
                                                />
                                                <label htmlFor="overrideToggle" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-github-dark-text select-none cursor-pointer">
                                                    Override Request Details
                                                </label>
                                            </div>

                                            {overrideMode && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                    {/* Method Selector */}
                                                    <div className="flex bg-slate-100 dark:bg-github-dark-subtle/50 p-1 rounded-xl w-fit mb-4 border border-slate-200 dark:border-github-dark-border">
                                                        {['add_session', 'reset'].map(m => (
                                                            <button
                                                                key={m}
                                                                type="button"
                                                                onClick={() => setOverrideMethod(m)}
                                                                className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${overrideMethod === m || (m === 'add_session' && overrideMethod === 'fix')
                                                                    ? 'bg-white dark:bg-[#1e202e] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-github-dark-border'
                                                                    : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-slate-200 border border-transparent'
                                                                    }`}
                                                            >
                                                                {m === 'add_session' ? 'Manual Correction' : 'Reset Day'}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Dynamic Inputs */}
                                                    {overrideMethod === 'add_session' || overrideMethod === 'fix' ? (
                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                {overrideSessions.map((s, idx) => (
                                                                    <div key={idx} className="flex items-center gap-4 bg-white dark:bg-[#13151f] p-3 rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm relative group w-full">
                                                                        <div className="flex-1 flex items-center justify-between">
                                                                            <div className="flex items-center gap-3 w-full">
                                                                                <div className="relative flex-1">
                                                                                    <label className="absolute -top-2.5 left-2 bg-white dark:bg-[#13151f] px-1 text-[10px] uppercase font-bold text-slate-500">Time In</label>
                                                                                    <input type="time" value={s.time_in} onChange={(e) => {
                                                                                        const ns = [...overrideSessions]; ns[idx].time_in = e.target.value; setOverrideSessions(ns);
                                                                                    }}
                                                                                        className="w-full pl-3 pr-2 py-2 text-sm rounded-lg border border-slate-200 dark:border-github-dark-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-transparent text-slate-800 dark:text-github-dark-text transition-all font-mono"
                                                                                    />
                                                                                </div>
                                                                                <span className="text-slate-400 font-bold px-1">→</span>
                                                                                <div className="relative flex-1">
                                                                                    <label className="absolute -top-2.5 left-2 bg-white dark:bg-[#13151f] px-1 text-[10px] uppercase font-bold text-slate-500">Time Out</label>
                                                                                    <input type="time" value={s.time_out} onChange={(e) => {
                                                                                        const ns = [...overrideSessions]; ns[idx].time_out = e.target.value; setOverrideSessions(ns);
                                                                                    }}
                                                                                        className="w-full pl-3 pr-2 py-2 text-sm rounded-lg border border-slate-200 dark:border-github-dark-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-transparent text-slate-800 dark:text-github-dark-text transition-all font-mono"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        {overrideSessions.length > 1 && (
                                                                            <button type="button" onClick={() => setOverrideSessions(overrideSessions.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors" title="Remove session">
                                                                                <XCircle size={18} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <button type="button" onClick={() => setOverrideSessions([...overrideSessions, { time_in: '', time_out: '' }])} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 px-1 pt-1 transition-colors">
                                                                <span className="text-lg leading-none">+</span> Add Session
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-4 w-full md:w-3/4 lg:w-1/2">
                                                            <div className="relative flex-1">
                                                                <label className="absolute -top-2.5 left-2 bg-slate-50 dark:bg-github-dark-subtle/50 px-1 text-[10px] uppercase font-bold text-slate-500">New Time In</label>
                                                                <input type="time" value={overrideIn} onChange={(e) => setOverrideIn(e.target.value)} className="w-full pl-3 pr-2 py-2 text-sm rounded-lg border border-slate-200 dark:border-github-dark-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white dark:bg-[#13151f] text-slate-800 dark:text-github-dark-text transition-all font-mono" />
                                                            </div>
                                                            <div className="relative flex-1">
                                                                <label className="absolute -top-2.5 left-2 bg-slate-50 dark:bg-github-dark-subtle/50 px-1 text-[10px] uppercase font-bold text-slate-500">New Time Out</label>
                                                                <input type="time" value={overrideOut} onChange={(e) => setOverrideOut(e.target.value)} className="w-full pl-3 pr-2 py-2 text-sm rounded-lg border border-slate-200 dark:border-github-dark-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white dark:bg-[#13151f] text-slate-800 dark:text-github-dark-text transition-all font-mono" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex-1">

                                        {/* ── Visual Sync Timeline ── */}
                                        {(() => {
                                            const originalSnap = Array.isArray(selectedRequestData.original_data) ? selectedRequestData.original_data : [];
                                            const proposedSnap = Array.isArray(selectedRequestData.proposed_data) ? selectedRequestData.proposed_data : [];
                                            const fmtTime = (t) => t ? String(t).substring(0, 5) : '';
                                            const originalTasks = originalSnap.map((s, i) => ({ id: `orig-${i}`, startTime: fmtTime(s.time_in), endTime: fmtTime(s.time_out) })).filter(t => t.startTime && t.endTime);
                                            const proposedTasks = proposedSnap.map((s, i) => ({ id: `prop-${i}`, startTime: fmtTime(s.time_in), endTime: fmtTime(s.time_out) })).filter(t => t.startTime && t.endTime);
                                            const allTasks = [...originalTasks, ...proposedTasks];
                                            if (allTasks.length === 0) return null;
                                            const getMinutes = (t) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
                                            let minMin = Math.min(...allTasks.map(t => getMinutes(t.startTime)));
                                            let maxMin = Math.max(...allTasks.map(t => getMinutes(t.endTime)));
                                            let startHour = Math.max(0, Math.floor((minMin - 60) / 60));
                                            let endHour = Math.min(24, Math.ceil((maxMin + 60) / 60));
                                            const span = Math.max(1, endHour - startHour);
                                            const timeToPos = (time) => { if (!time) return 0; const [h, m] = time.split(':').map(Number); const mins = (h || 0) * 60 + (m || 0); return Math.max(0, Math.min(100, ((mins - startHour * 60) / (span * 60)) * 100)); };
                                            const getDurationPct = (s, e) => Math.max(1.8, timeToPos(e) - timeToPos(s));
                                            const changesList = [];
                                            const origCopy = originalTasks.map(t => ({ ...t }));
                                            proposedTasks.forEach(prop => {
                                                const match = origCopy.find(o => o.startTime === prop.startTime && o.endTime === prop.endTime);
                                                if (match) { match.matched = true; } else {
                                                    const over = origCopy.find(o => !o.matched && (Math.abs(getMinutes(o.startTime) - getMinutes(prop.startTime)) < 120 || Math.abs(getMinutes(o.endTime) - getMinutes(prop.endTime)) < 120));
                                                    if (over) { over.matched = true; changesList.push({ type: 'MODIFY', task: prop, original: over }); }
                                                    else { changesList.push({ type: 'ADD', task: prop }); }
                                                }
                                            });
                                            origCopy.filter(o => !o.matched).forEach(o => changesList.push({ type: 'DELETE', task: o }));
                                            const hourStep = span > 8 ? 2 : 1;
                                            return (
                                                <div className="bg-slate-50 dark:bg-[#13151f] border-b border-slate-200 dark:border-github-dark-border px-6 pt-4 pb-5">
                                                    {/* Title row */}
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual Sync Timeline</span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800">
                                                            {(selectedRequestData.correction_type || 'correction').toUpperCase()}
                                                        </span>
                                                        {/* Legend */}
                                                        <div className="ml-auto flex items-center gap-3 text-[9px] font-bold uppercase text-slate-400">
                                                            <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-slate-400/30 border border-slate-400/40"></span>Original</span>
                                                            <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-emerald-500/20 border border-emerald-500/40"></span>Proposed</span>
                                                        </div>
                                                    </div>

                                                    {/* Scale */}
                                                    <div className="relative mb-1 h-5">
                                                        {Array.from({ length: span + 1 }, (_, i) => startHour + i)
                                                            .filter((_, i) => i % hourStep === 0)
                                                            .map((h) => (
                                                                <span key={h} className="absolute text-[9px] text-slate-400 font-mono -translate-x-1/2" style={{ left: `${((h - startHour) / span) * 100}%` }}>
                                                                    {h}:00
                                                                </span>
                                                            ))}
                                                    </div>

                                                    {/* Tick lines + rows */}
                                                    <div className="relative">
                                                        {/* Vertical grid lines */}
                                                        <div className="absolute inset-0 pointer-events-none flex">
                                                            {Array.from({ length: span + 1 }, (_, i) => i).map(i => (
                                                                <div key={i} className="absolute top-0 bottom-0 border-l border-dashed border-slate-300/40 dark:border-github-dark-border/40" style={{ left: `${(i / span) * 100}%` }} />
                                                            ))}
                                                        </div>

                                                        {/* Original row */}
                                                        <div className="mb-1">
                                                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Original</div>
                                                            <div className="relative h-8 bg-slate-200/40 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-github-dark-border/50 overflow-hidden [isolation:isolate] flex items-center">
                                                                {originalTasks.map(task => {
                                                                    const leftPos = timeToPos(task.startTime);
                                                                    const rawWidth = getDurationPct(task.startTime, task.endTime);
                                                                    const maxW = Math.max(0, 100 - leftPos);
                                                                    const widthPos = Math.min(rawWidth, maxW);
                                                                    return (
                                                                        <div key={task.id}
                                                                            className="absolute top-1 bottom-1 rounded-md bg-slate-400/25 border border-slate-400/40 flex items-center justify-center overflow-hidden max-h-[24px] pointer-events-auto"
                                                                            style={{ left: `${leftPos}%`, width: `${widthPos}%`, maxWidth: `${maxW}%`, minWidth: leftPos > 90 ? '10px' : '24px', boxSizing: 'border-box' }}>
                                                                            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 px-1 truncate whitespace-nowrap leading-none">{fmtTime(task.startTime)}–{fmtTime(task.endTime)}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {originalTasks.length === 0 && (
                                                                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Original Records</div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Proposed row */}
                                                        <div>
                                                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Proposed</div>
                                                            <div className="relative h-8 bg-slate-200/40 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-github-dark-border/50 overflow-hidden [isolation:isolate] flex items-center">
                                                                {proposedTasks.map(task => {
                                                                    const isNew = changesList.some(c => c.type === 'ADD' && c.task.id === task.id);
                                                                    const isChanged = changesList.some(c => c.type === 'MODIFY' && c.task.id === task.id);
                                                                    const cls = isNew
                                                                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                                                                        : isChanged
                                                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-400'
                                                                        : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-600 dark:text-indigo-400';
                                                                    const leftPos = timeToPos(task.startTime);
                                                                    const rawWidth = getDurationPct(task.startTime, task.endTime);
                                                                    const maxW = Math.max(0, 100 - leftPos);
                                                                    const widthPos = Math.min(rawWidth, maxW);
                                                                    return (
                                                                        <div key={task.id}
                                                                            className={`absolute top-1 bottom-1 rounded-md border flex items-center justify-center overflow-hidden max-h-[24px] pointer-events-auto ${cls}`}
                                                                            style={{ left: `${leftPos}%`, width: `${widthPos}%`, maxWidth: `${maxW}%`, minWidth: leftPos > 90 ? '10px' : '24px', boxSizing: 'border-box' }}>
                                                                            {isNew && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />}
                                                                            <span className="text-[9px] font-mono font-bold px-1 truncate whitespace-nowrap leading-none">{fmtTime(task.startTime)}–{fmtTime(task.endTime)}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* ── Info Cards & Layout ── */}
                                        <div className="p-5 space-y-4">
                                            {/* Meta row */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl p-3 border border-slate-100 dark:border-github-dark-border/50">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Type</p>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text capitalize">{selectedRequestData.correction_type || '—'}</p>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl p-3 border border-slate-100 dark:border-github-dark-border/50">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Method</p>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text capitalize">
                                                        {selectedRequestData.correction_method === 'add_session' ? 'Manual' : selectedRequestData.correction_method || 'Fix'}
                                                    </p>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl p-3 border border-slate-100 dark:border-github-dark-border/50">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Submitted</p>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text">
                                                        {selectedRequestData.submitted_at ? new Date(selectedRequestData.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Proposed Sessions table */}
                                            {Array.isArray(selectedRequestData.proposed_data) && selectedRequestData.proposed_data.length > 0 && (
                                                <div className="bg-slate-50 dark:bg-[#1a1c26] rounded-xl border border-slate-200 dark:border-github-dark-border overflow-hidden">
                                                    <div className="px-4 py-3 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between">
                                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-github-dark-text">Proposed Sessions</h3>
                                                        <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                                            {selectedRequestData.proposed_data.length} session{selectedRequestData.proposed_data.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                    <div className="divide-y divide-slate-100 dark:divide-github-dark-border">
                                                        {selectedRequestData.proposed_data.map((s, i) => (
                                                            <div key={i} className="flex items-center px-4 py-3 gap-4">
                                                                <span className="text-[10px] font-black text-slate-400 w-5 shrink-0">#{i + 1}</span>
                                                                <div className="flex items-center gap-2 flex-1">
                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">In</span>
                                                                    <span className="text-sm font-black text-slate-800 dark:text-github-dark-text font-mono">{String(s.time_in || '').substring(0, 5)}</span>
                                                                </div>
                                                                <ChevronRight size={14} className="text-slate-400 dark:text-github-dark-muted shrink-0" />
                                                                <div className="flex items-center gap-2 flex-1 justify-end">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Out</span>
                                                                    <span className="text-sm font-black text-slate-800 dark:text-github-dark-text font-mono">{String(s.time_out || '').substring(0, 5)}</span>
                                                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Audit Trail */}
                                            {(() => {
                                                const trail = typeof selectedRequestData.audit_trail === 'string'
                                                    ? (() => { try { return JSON.parse(selectedRequestData.audit_trail); } catch { return []; } })()
                                                    : (Array.isArray(selectedRequestData.audit_trail) ? selectedRequestData.audit_trail : []);
                                                if (trail && trail.length > 0) {
                                                    return (
                                                        <div className="bg-slate-50 dark:bg-[#1a1c26] rounded-xl border border-slate-200 dark:border-github-dark-border p-4">
                                                            <h4 className="text-xs uppercase tracking-wider text-slate-500 dark:text-github-dark-muted font-semibold mb-4 flex items-center gap-2">
                                                                <Activity size={14} /> Audit Trail
                                                            </h4>
                                                            <div className="relative pl-4 border-l-2 border-slate-200 dark:border-github-dark-border space-y-6">
                                                                {trail.map((event, idx) => (
                                                                    <div key={idx} className="relative">
                                                                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-dark-card ring-1 ring-slate-100 dark:ring-slate-800"></div>
                                                                        <p className="text-sm font-medium text-slate-800 dark:text-github-dark-text">
                                                                            {String(event.action).charAt(0).toUpperCase() + String(event.action).slice(1)}
                                                                        </p>
                                                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted">
                                                                            {new Date(event.at).toLocaleString()} • by {event.by === selectedRequestData.user_id ? selectedRequestData.user_name : 'Admin'}
                                                                        </p>
                                                                        {event.comments && (
                                                                            <p className="text-xs text-slate-600 dark:text-github-dark-muted mt-1 italic">"{event.comments}"</p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            {/* Request Reason */}
                                            <div className="bg-slate-50 dark:bg-[#1e202e] rounded-xl border border-slate-200 dark:border-github-dark-border p-4">
                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                                    <FileClock size={12} /> Request Reason
                                                </h3>
                                                <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">
                                                    "{selectedRequestData.reason || 'No reason provided.'}"
                                                </p>
                                            </div>

                                            {/* Decision Comments / Auditor card */}
                                            {selectedRequestData.status !== 'pending' ? (
                                                <div className={`rounded-xl border p-4 ${
                                                    selectedRequestData.status === 'approved'
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30'
                                                        : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30'
                                                }`}>
                                                    <h3 className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${
                                                        selectedRequestData.status === 'approved'
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                        <CheckCircle size={12} /> Auditor Comments
                                                    </h3>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                                        {selectedRequestData.review_comments || 'No auditor comments provided.'}
                                                    </p>
                                                    <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                        Reviewed {selectedRequestData.reviewed_at ? formatCorrectionDate(selectedRequestData.reviewed_at) : '—'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="bg-slate-50 dark:bg-[#1e202e] rounded-xl border border-slate-200 dark:border-github-dark-border p-4">
                                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                                        <MessageSquare size={12} /> Auditor Comments
                                                    </h3>
                                                    <textarea
                                                        value={reviewComment}
                                                        onChange={(e) => setReviewComment(e.target.value)}
                                                        placeholder="Add auditor review comments, reasoning or remarks here before approving/rejecting..."
                                                        className="w-full mt-1 p-3 text-sm bg-white dark:bg-[#13151f] border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-github-dark-text resize-none h-24"
                                                    ></textarea>
                                                </div>
                                            )}

                                        </div>

                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <FileText size={48} className="mb-4 opacity-50" />
                                        <p>Select a request to view details</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- Live Attendance Detail Sidebar --- */}
                    <AnimatePresence>
                        {selectedLiveUser && (
                            <UserAttendanceDetailsModal
                                user={selectedLiveUser}
                                onClose={() => setSelectedLiveUser(null)}
                            />
                        )}
                    </AnimatePresence>

                </div>
            </div>
                {/* AI Summary Panel */}
                <AnimatePresence>
                    {isAiSummaryOpen && (
                        <motion.div key="ai-panel-wrapper" className="fixed inset-0 z-[10000] flex justify-end">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsAiSummaryOpen(false)}
                                className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
                            />

                            {/* Sidebar Drawer */}
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="relative w-full sm:w-[80vw] md:w-[60vw] lg:w-[50vw] bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-github-dark-border flex flex-col shadow-2xl"
                            >
                                {/* Header */}
                                <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between bg-white dark:bg-[#0d1117] sticky top-0 z-10 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-md">
                                            <Sparkles size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800 dark:text-github-dark-text tracking-tight flex items-center gap-2">
                                                AI Attendance Insights
                                                {aiSummaryLoading && <span className="flex h-2 w-2 relative ml-1">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                                </span>}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">
                                                Generated for {selectedDate}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsAiSummaryOpen(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50 dark:bg-[#0d1117]">
                                    {aiSummaryError && !aiSummaryLoading ? (
                                        <div className="flex flex-col items-center justify-center h-64 text-center">
                                            <AlertTriangle size={48} className="text-rose-500 mb-4 opacity-80" />
                                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Analysis Failed</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{aiSummaryError}</p>
                                            <button 
                                                onClick={generateAiSummary}
                                                className="mt-6 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    ) : aiSummaryLoading && !aiSummaryData ? (
                                        <div className="space-y-6">
                                            {/* Skeletons */}
                                            <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                                <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                            </div>
                                            <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                        </div>
                                    ) : aiSummaryData ? (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {/* Overall Summary */}
                                            <div className="p-5 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm">
                                                <h4 className="text-xs font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <FileText size={14} className="text-indigo-500" /> Executive Summary
                                                </h4>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                                    {aiSummaryData.overall_summary}
                                                </p>
                                            </div>

                                            {/* Key Insights Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                                    <h4 className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-1">Present Rate</h4>
                                                    <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                                                        {localAnalytics.presentRate}%
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-500/20">
                                                    <h4 className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-1">Late Rate</h4>
                                                    <div className="text-3xl font-black text-amber-700 dark:text-amber-300">
                                                        {localAnalytics.lateRate}%
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Highlights */}
                                            {aiSummaryData.analytics_insights.highlights && aiSummaryData.analytics_insights.highlights.length > 0 && (
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest flex items-center gap-2">
                                                        <Activity size={14} className="text-indigo-500" /> Key Observations
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {aiSummaryData.analytics_insights.highlights.map((highlight, idx) => (
                                                            <div key={idx} className="flex gap-3 p-3 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm">
                                                                <div className="mt-0.5">
                                                                    <CheckCircle size={16} className="text-emerald-500" />
                                                                </div>
                                                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{highlight}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notable Employees */}
                                            {(aiSummaryData.absent_employees.length > 0 || aiSummaryData.present_employees.length > 0) && (
                                                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-github-dark-border">
                                                    <h4 className="text-xs font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest flex items-center gap-2">
                                                        <Users size={14} className="text-indigo-500" /> Attendance Breakdown
                                                    </h4>
                                                    
                                                    {aiSummaryData.present_employees.length > 0 && (
                                                        <div className="mb-4">
                                                            <h5 className="text-xs font-bold text-emerald-500 mb-2">Present ({aiSummaryData.present_employees.length})</h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {aiSummaryData.present_employees.map((emp, i) => (
                                                                    <div key={i} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-md flex items-center gap-2">
                                                                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{emp.name}</span>
                                                                        <span className="text-[10px] text-emerald-500 dark:text-emerald-500/70 uppercase">{emp.department}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {aiSummaryData.absent_employees.length > 0 && (
                                                        <div className="mb-4">
                                                            <h5 className="text-xs font-bold text-rose-500 mb-2">Absences ({aiSummaryData.absent_employees.length})</h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {aiSummaryData.absent_employees.map((emp, i) => (
                                                                    <div key={i} className="px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-md flex items-center gap-2">
                                                                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400">{emp.name}</span>
                                                                        <span className="text-[10px] text-rose-500 dark:text-rose-500/70 uppercase">{emp.department}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {aiSummaryData.present_employees.filter(e => e.note).length > 0 && (
                                                        <div>
                                                            <h5 className="text-xs font-bold text-indigo-500 mb-2">Notes</h5>
                                                            <div className="space-y-2">
                                                                {aiSummaryData.present_employees.filter(e => e.note).map((emp, i) => (
                                                                    <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{emp.name}</span>
                                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{emp.department}</span>
                                                                        </div>
                                                                        <div className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded">
                                                                            {emp.note}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DashboardLayout>
        </>
    );
};

// --- Sub-components ---

const UserAttendanceDetailsModal = ({ user, onClose }) => {
    const [previewImage, setPreviewImage] = useState(null);

    // If we're closing and no user, we rely on AnimatePresence in the parent
    if (!user) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[9998]"
            />

            {/* Sidebar Drawer */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-[450px] bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl z-[9999] flex flex-col dar-context"
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-github-dark-subtle/20 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-sm overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                            {user.avatar && user.avatar.startsWith('http') ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                user.avatar
                            )}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text leading-tight">{user.name}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-github-dark-muted mt-0.5 font-medium">{user.role} • {user.department}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-github-dark-muted"
                    >
                        <XCircle size={18} />
                    </button>
                </div>

                {/* Body - Session Timeline */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-1 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Today's Timeline</h4>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shadow-sm ${user.status.includes('Active') ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'}`}>
                                {user.status}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-github-dark-muted bg-slate-100 dark:bg-github-dark-subtle/50 px-2 py-0.5 rounded border border-slate-200 dark:border-github-dark-border">
                                {user.totalHours && (user.totalHours.toLowerCase().includes('hr') || user.totalHours.toLowerCase().includes('min') || user.totalHours === '-') ? user.totalHours : `${user.totalHours} Hrs`}
                                {user.expectedHours && user.expectedHours !== '-' && ` / ${user.expectedHours}`}
                            </span>
                        </div>
                    </div>

                    {user.allStatuses && user.allStatuses.includes('Late') && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                            <h5 className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-widest mb-1 flex items-center gap-1.5">
                                <AlertTriangle size={10} /> Late Reason
                            </h5>
                            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed italic">
                                {user.lateReason ? `"${user.lateReason}"` : "No reason provided."}
                            </p>
                        </div>
                    )}

                    <div className="relative pl-3 space-y-5 border-l-2 border-slate-100 dark:border-github-dark-border ml-2">
                        {user.sessions.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 italic text-xs">No activity recorded for today.</div>
                        ) : (
                            user.sessions.map((session, idx) => (
                                <div key={idx} className="relative pl-6">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-2 border-white dark:border-dark-card shadow-md flex items-center justify-center z-10 ${session.isActive ? 'bg-indigo-500 animate-pulse ring-4 ring-indigo-500/10' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        {session.isActive && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                    </div>

                                    {/* Session Card */}
                                    <div className={`bg-white dark:bg-dark-card border ${session.isActive ? 'border-indigo-200 dark:border-indigo-500/40 shadow-indigo-100/50' : 'border-slate-200 dark:border-github-dark-border'} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 group`}>
                                        <div className="flex items-center mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Start</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={12} className="text-emerald-500" />
                                                        <span className="text-sm font-mono font-bold text-slate-800 dark:text-github-dark-text">{session.in}</span>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-px bg-slate-100 dark:bg-github-dark-subtle mt-4"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">End</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <LogOut size={12} className={session.isActive ? 'text-indigo-400' : 'text-rose-500'} />
                                                        <span className={`text-sm font-mono font-bold ${session.isActive ? 'text-indigo-500 animate-pulse' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                            {session.out}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50 dark:border-github-dark-border/30">
                                            {/* Punch In Details */}
                                            <div className="space-y-2">
                                                <span className="text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest block">Punch In</span>
                                                <div className="flex items-start gap-1.5">
                                                    <MapPin size={10} className="shrink-0 mt-0.5 text-emerald-500 opacity-70" />
                                                    <span className="text-[10px] text-slate-500 dark:text-github-dark-muted leading-tight break-words whitespace-normal" title={session.inLocation}>
                                                        {session.inLocation}
                                                    </span>
                                                </div>
                                                {session.inImage && (
                                                    <div className="flex justify-center w-full mt-2">
                                                        <div className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border group/img cursor-pointer shadow-sm bg-transparent" onClick={() => setPreviewImage(session.inImage)}>
                                                            <img src={session.inImage} alt="In Selfie" className="max-h-48 max-w-full w-auto block object-contain transition-transform duration-500 group-hover/img:scale-110" />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Search size={16} className="text-white" />
                                                            </div>
                                                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-tighter">Selfie In</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Punch Out Details */}
                                            <div className="space-y-2">
                                                <span className="text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest block">Punch Out</span>
                                                {session.outLocation ? (
                                                    <div className="flex items-start gap-1.5">
                                                        <MapPin size={10} className="shrink-0 mt-0.5 text-rose-500 opacity-70" />
                                                        <span className="text-[10px] text-slate-500 dark:text-github-dark-muted leading-tight break-words whitespace-normal" title={session.outLocation}>
                                                            {session.outLocation}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="h-4 flex items-center">
                                                        <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">{session.isActive ? 'Ongoing...' : 'N/A'}</span>
                                                    </div>
                                                )}
                                                {session.outImage ? (
                                                    <div className="flex justify-center w-full mt-2">
                                                        <div className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border group/img cursor-pointer shadow-sm bg-transparent" onClick={() => setPreviewImage(session.outImage)}>
                                                            <img src={session.outImage} alt="Out Selfie" className="max-h-48 max-w-full w-auto block object-contain transition-transform duration-500 group-hover/img:scale-110" />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Search size={16} className="text-white" />
                                                            </div>
                                                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-tighter">Selfie Out</div>
                                                        </div>
                                                    </div>
                                                ) : !session.isActive && (
                                                    <div className="w-full h-28 rounded-xl bg-slate-50 dark:bg-github-dark-subtle/20 border border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center gap-1">
                                                        <XCircle size={14} className="text-slate-300" />
                                                        <span className="text-[9px] text-slate-400 font-medium">No Selfie Out</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-bold shadow-lg shadow-slate-200 dark:shadow-none hover:opacity-90 transition-all uppercase tracking-widest"
                    >
                        Close Details
                    </button>
                </div>
            </motion.div>

            {/* Image Preview Lightbox */}
            {previewImage && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setPreviewImage(null)}
                    >
                        <button
                            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                            onClick={() => setPreviewImage(null)}
                        >
                            <XCircle size={32} />
                        </button>
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={previewImage}
                            alt="Selfie Preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </>,
        document.body
    );
};

const CustomHoursTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const loggedHrs = data.logged;
        const expectedHrs = data.expected;
        
        const totalMin = Math.round(loggedHrs * 60);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        const loggedFormatted = `${h}h ${m}m`;
        
        const pct = expectedHrs > 0 ? Math.round((loggedHrs / expectedHrs) * 100) : 0;
        
        return (
            <div className="bg-slate-800/95 dark:bg-[#161b22]/95 border border-slate-700 dark:border-github-dark-border p-3 rounded-xl text-white shadow-xl text-xs backdrop-blur-sm">
                <p className="font-bold mb-1.5 text-slate-200">{data.fullName}</p>
                <div className="space-y-1 font-medium">
                    <p className="flex justify-between gap-4">
                        <span className="text-slate-400 font-bold">Logged:</span> 
                        <span className="font-bold text-indigo-400">{loggedFormatted}</span>
                    </p>
                    <p className="flex justify-between gap-4">
                        <span className="text-slate-400 font-bold">Expected:</span> 
                        <span className="font-bold text-slate-300">{expectedHrs} hrs</span>
                    </p>
                    <p className="flex justify-between gap-4 border-t border-slate-700/50 pt-1 mt-1 font-bold">
                        <span className="text-slate-400 font-bold">Progress:</span> 
                        <span className={pct >= 100 ? "text-emerald-400" : "text-amber-400"}>{pct}%</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

export default AttendanceMonitoring;
