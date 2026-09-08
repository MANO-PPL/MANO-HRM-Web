import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import MarkerClusterGroup from 'react-leaflet-cluster';
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
    Search,
    Clock,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Layers,
    Check,
    X,
    XCircle,
    Camera,
    MapPin
} from 'lucide-react';

// Fix for Leaflet default icon issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MAP_THEMES = {
    dark: { name: 'Night Mode', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' },
    light: { name: 'Light Mode', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png' },
    voyager: { name: 'Day Mode', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png' },
    satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
    streets: { name: 'Streets', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }
};

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
            if (user.sessions) {
                user.sessions.forEach(s => {
                    if (s.inLat && s.inLng) points.push([Number(s.inLat), Number(s.inLng)]);
                    if (s.outLat && s.outLng) points.push([Number(s.outLat), Number(s.outLng)]);
                });
            }
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
    const [previewImage, setPreviewImage] = useState(null);

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
                            <h3 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text">
                                {selectedUser ? 'Session Details' : 'Location Group'}
                            </h3>
                            <p className="text-[10px] text-slate-500 font-normal mt-0.5">
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
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm overflow-hidden shrink-0 border border-indigo-100/50 dark:border-indigo-500/10">
                                                {m.user.avatar && typeof m.user.avatar === 'string' && m.user.avatar.startsWith('http') ? (
                                                    <img src={m.user.avatar} alt={m.user.name || 'User'} className="w-full h-full object-cover" />
                                                ) : (
                                                    m.user.avatar || (m.user.name ? m.user.name.charAt(0) : '?')
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-slate-800 dark:text-github-dark-text truncate leading-tight">
                                                    {m.user.name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-github-dark-muted font-normal truncate mt-0.5">
                                                    {m.user.role} • {m.user.department}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`text-[9px] font-medium px-2 py-0.5 rounded-md ${m.session.isActive && m.type === 'in'
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
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm overflow-hidden shrink-0 shadow-md">
                                        {selectedUser.user.avatar && typeof selectedUser.user.avatar === 'string' && selectedUser.user.avatar.startsWith('http') ? (
                                            <img src={selectedUser.user.avatar} alt={selectedUser.user.name || 'User'} className="w-full h-full object-cover" />
                                        ) : (
                                            selectedUser.user.avatar || (selectedUser.user.name ? selectedUser.user.name.charAt(0) : '?')
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-800 dark:text-github-dark-text text-sm leading-tight">
                                            {selectedUser.user.name}
                                        </p>
                                        <p className="text-xs text-slate-500 font-normal mt-0.5">
                                            {selectedUser.user.role} • {selectedUser.user.department}
                                        </p>
                                    </div>
                                </div>

                                {selectedUser.user.allStatuses && selectedUser.user.allStatuses.includes('Late') && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl shadow-sm mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <h5 className="text-[11px] font-semibold text-amber-600 dark:text-amber-500 mb-1 flex items-center gap-1.5">
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
                                                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Time In</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-md">
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
                                                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Time Out</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2.5 py-0.5 rounded-md">
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
                                                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                                        {selectedUser.session.isActive && selectedUser.type === 'in' ? 'Active Session' : selectedUser.type === 'in' ? 'Check In' : 'Check Out'}
                                                    </span>
                                                </div>
                                                <span className={`text-xs font-semibold ${selectedUser.session.isActive && selectedUser.type === 'in'
                                                        ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 animate-pulse'
                                                        : selectedUser.type === 'in'
                                                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                                                            : 'text-rose-600 bg-rose-50 dark:bg-rose-900/30'
                                                    } px-2.5 py-0.5 rounded-md`}>
                                                    {selectedUser.type === 'in' ? selectedUser.session.in : selectedUser.session.out}
                                                </span>
                                            </div>
                                            {(selectedUser.type === 'in' ? selectedUser.session.inImage : selectedUser.session.outImage) ? (
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
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                                            <MapPin size={12} className="text-indigo-500" /> Location Details
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-normal leading-relaxed break-words whitespace-normal mt-0.5">
                                            {selectedUser.type === 'out' ? selectedUser.session.outLocation : selectedUser.session.inLocation}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
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

const LiveMapTab = ({
    filteredData = [],
    searchTerm = '',
    departmentFilter = 'All'
}) => {
    const [activeTheme, setActiveTheme] = useState(() => 
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'voyager'
    );
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [clusterGroupElement, setClusterGroupElement] = useState(null);

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
        <div className="flex-1 min-h-0 flex gap-0 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500 relative min-h-[450px]">
            <style>
                {`
                .leaflet-container {
                    background-color: ${activeTheme === 'dark' ? '#0f0f11' :
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
                `}
            </style>
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
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium'
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
                            if (!user.sessions) return [];
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
                                                ${user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('http')
                                                        ? `<img src="${user.avatar}" class="w-full h-full object-cover" />`
                                                        : `<span class="text-xs font-semibold text-slate-600 dark:text-slate-300">${user.avatar || (user.name ? user.name.charAt(0) : '?')}</span>`
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
                                        />
                                    );
                                });
                            });
                        })}
                    </MarkerClusterGroup>
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
    );
};

export default LiveMapTab;
