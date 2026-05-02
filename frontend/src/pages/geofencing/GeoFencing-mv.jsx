import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { MapPin, Plus, Users, Search, X, Check, CheckCircle2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { fetchLocations, fetchWorkLocationUsers, updateLocationAssignments, createLocation } from '../../services/userService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const GeoFencing = () => {
    const [locations, setLocations] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [loadingLocations, setLoadingLocations] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [staffSearchTerm, setStaffSearchTerm] = useState('');
    const [tempSelectedStaff, setTempSelectedStaff] = useState([]);

    // Create Location State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newGeo, setNewGeo] = useState({
        location_name: "",
        address: "",
        latitude: "",
        longitude: "",
        radius: 100,
    });
    const [isCreating, setIsCreating] = useState(false);

    // Reverse geocoding helper
    const reverseGeocode = async (lat, lng) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await res.json();
            return data.display_name || "";
        } catch (err) {
            console.error("Reverse geocoding failed", err);
            return "";
        }
    };

    const useMyLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation not supported by this browser");
            return;
        }

        toast.info("Fetching your location...");
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                setNewGeo((prev) => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                }));

                const address = await reverseGeocode(lat, lng);
                setNewGeo((prev) => ({
                    ...prev,
                    address,
                }));
                toast.success("Location fetched!");
            },
            (err) => toast.error(err.message),
            { enableHighAccuracy: true }
        );
    };

    const handleCreateGeofence = async (e) => {
        e.preventDefault();
        if (!newGeo.location_name || !newGeo.latitude || !newGeo.longitude || !newGeo.address) {
            toast.error("Name, Latitude, Longitude and Address are required");
            return;
        }

        setIsCreating(true);
        try {
            await createLocation({
                location_name: newGeo.location_name,
                address: newGeo.address,
                latitude: Number(newGeo.latitude),
                longitude: Number(newGeo.longitude),
                radius: Number(newGeo.radius),
            });

            toast.success("Location created successfully");
            setIsCreateModalOpen(false);
            setNewGeo({
                location_name: "",
                address: "",
                latitude: "",
                longitude: "",
                radius: 100,
            });
            loadData();
        } catch (err) {
            toast.error("Failed to create location");
            console.error(err);
        } finally {
            setIsCreating(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoadingLocations(true);
        setLoadingStaff(true);
        try {
            const [locRes, usersRes] = await Promise.all([
                fetchLocations(),
                fetchWorkLocationUsers()
            ]);

            if (locRes.ok) setLocations(locRes.locations);

            if (usersRes.success) {
               const processedUsers = usersRes.users.map(u => ({
                    id: u.user_id,
                    name: u.user_name,
                    role: u.desg_name || u.user_type,
                    image: u.profile_image_url,
                    work_locations: (u.work_locations || []).map(wl => {
                        if (wl.loc_id != null) return { location_id: Number(wl.loc_id) };
                        if (typeof wl === "number") return { location_id: wl };
                        const id = wl.location_id ?? wl.work_location_id;
                        return id != null ? { location_id: Number(id) } : null;
                    }).filter(Boolean),
                }));
                setStaff(processedUsers);
            }
        } catch (error) {
            console.error("Failed to load geo fencing data", error);
            toast.error("Could not load data");
        } finally {
            setLoadingLocations(false);
            setLoadingStaff(false);
        }
    };

    const openAssignModal = (location) => {
        setSelectedLocation(location);
        const originallyAssigned = staff
            .filter(s => s.work_locations?.some(wl => wl.location_id === location.location_id))
            .map(s => s.id);
        setTempSelectedStaff(originallyAssigned);
        setStaffSearchTerm('');
        setIsModalOpen(true);
    };

    const toggleStaffSelection = (staffId) => {
        setTempSelectedStaff(prev =>
            prev.includes(staffId)
                ? prev.filter(id => id !== staffId)
                : [...prev, staffId]
        );
    };

    const handleSaveAssignments = async () => {
        const originallyAssigned = staff
            .filter(s => s.work_locations?.some(wl => wl.location_id === selectedLocation.location_id))
            .map(s => s.id);

        const payload = [{
            work_location_id: selectedLocation.location_id,
            add: tempSelectedStaff.filter(id => !originallyAssigned.includes(id)),
            remove: originallyAssigned.filter(id => !tempSelectedStaff.includes(id))
        }];

        try {
            await updateLocationAssignments(payload);
            toast.success(`Staff assignments updated for ${selectedLocation.location_name}`);
            setIsModalOpen(false);
            loadData(); // reload users to get updated work_locations
        } catch (error) {
            toast.error("Failed to update staff assignments");
        }
    };

    const filteredStaff = staff.filter(s =>
        s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
        s.role.toLowerCase().includes(staffSearchTerm.toLowerCase())
    );

    return (
        <MobileDashboardLayout title="Geo-Fencing">
            <div className="space-y-3 pb-20">
                {loadingLocations ? (
                    <div className="text-center py-10 text-slate-400 text-xs">Loading locations...</div>
                ) : locations.map((loc) => {
                    const assignedStaffIds = staff
                        .filter(s => s.work_locations?.some(wl => wl.location_id === loc.location_id))
                        .map(s => s.id);
                    return (
                        <div key={loc.location_id} className="bg-white dark:bg-dark-card rounded-2xl p-3.5 shadow-sm border border-slate-100 dark:border-github-dark-border group active:scale-[0.99] transition-all">
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${loc.is_active === 1 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-semibold text-slate-800 dark:text-github-dark-text text-[15px] truncate pr-2">
                                            {loc.location_name}
                                        </h3>
                                        <button 
                                            onClick={() => openAssignModal(loc)}
                                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
                                        >
                                            <Users size={12} />
                                            Assign
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-github-dark-muted line-clamp-1 mb-3 flex items-center gap-1">
                                        <MapPin size={10} className="shrink-0" />
                                        {loc.address}
                                    </p>

                                    <div className="flex justify-between items-center">
                                        <div className="flex -space-x-1.5 overflow-hidden" onClick={() => openAssignModal(loc)}>
                                            {assignedStaffIds.length > 0 ? (
                                                <>
                                                    {assignedStaffIds.slice(0, 4).map((staffId, i) => {
                                                        const s = staff.find(st => st.id === staffId);
                                                        return (
                                                            <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-github-dark-subtle bg-slate-100 flex items-center justify-center text-[8px] font-semibold text-slate-600 overflow-hidden">
                                                                {s ? (s.image ? <img src={s.image} alt="" className="w-full h-full object-cover" /> : s.name.charAt(0)) : '?'}
                                                            </div>
                                                        );
                                                    })}
                                                    {assignedStaffIds.length > 4 && (
                                                        <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-github-dark-subtle bg-slate-50 dark:bg-github-dark-border flex items-center justify-center text-[8px] font-semibold text-slate-500">
                                                            +{assignedStaffIds.length - 4}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">No staff assigned</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 font-medium">{loc.radius}m radius</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Floating Action Button */}
            <button 
                onClick={() => setIsCreateModalOpen(true)}
                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)', right: 16 }}
                className="fixed w-14 h-14 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.4)] flex items-center justify-center hover:bg-indigo-700 hover:scale-105 active:scale-90 transition-all z-[40]"
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>

            {/* Assign Staff Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}>
                    <div className="flex min-h-full items-end justify-center">
                        <div 
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-github-dark-subtle w-full rounded-t-[2.5rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 relative"
                        >
                            {/* Drag Handle */}
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />
                            
                            {/* Header */}
                            <div className="p-6 pb-2 flex justify-between items-center">
                                <div>
                                    <h3 className="font-semibold text-xl text-slate-900 dark:text-github-dark-text tracking-tight">Assign Staff</h3>
                                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                                        <MapPin size={12} className="text-indigo-500" />
                                        {selectedLocation?.location_name}
                                    </p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-slate-400 active:scale-90 transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                        {/* Search */}
                        <div className="px-6 py-4">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by name or role..."
                                    value={staffSearchTerm}
                                    onChange={(e) => setStaffSearchTerm(e.target.value)}
                                    className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl text-sm font-normal focus:ring-0 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
                            {loadingStaff ? (
                                <div className="text-center py-10 text-slate-400 text-xs">Loading staff...</div>
                            ) : filteredStaff.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-xs">No staff found.</div>
                            ) : (
                                filteredStaff.map(s => {
                                    const isSelected = tempSelectedStaff.includes(s.id);
                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() => toggleStaffSelection(s.id)}
                                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isSelected
                                                ? 'bg-indigo-50/50 dark:bg-indigo-900/10'
                                                : 'bg-transparent'
                                                }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600 shrink-0">
                                                {s.image ? <img src={s.image} alt="" className="w-full h-full object-cover" /> : s.name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">{s.name}</h4>
                                                <p className="text-[10px] text-slate-500">{s.role}</p>
                                            </div>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSelected
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600'
                                                }`}>
                                                {isSelected ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] border-t border-slate-50 dark:border-slate-800/50">
                            <button
                                onClick={handleSaveAssignments}
                                className="w-full py-4 bg-indigo-600 dark:bg-indigo-500 text-white font-semibold rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={20} />
                                Confirm Changes ({tempSelectedStaff.length})
                            </button>
                        </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Create Location Bottom Sheet */}
            {isCreateModalOpen && createPortal(
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsCreateModalOpen(false)}>
                    <div className="flex min-h-full items-end justify-center">
                        <div 
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-github-dark-subtle w-full rounded-t-[2.5rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 relative"
                        >
                            {/* Drag Handle */}
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />
                            
                            <div className="p-6 pb-2 flex justify-between items-center">
                                <div>
                                    <h3 className="font-semibold text-xl text-slate-800 dark:text-github-dark-text tracking-tight">New Location</h3>
                                    <p className="text-xs font-normal text-slate-500 dark:text-github-dark-muted mt-1">Add a new geo-fencing zone</p>
                                </div>
                                <button onClick={() => setIsCreateModalOpen(false)} className="w-10 h-10 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-slate-400 active:scale-90 transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                        <form onSubmit={handleCreateGeofence} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5">Location Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newGeo.location_name}
                                    onChange={(e) => setNewGeo({ ...newGeo, location_name: e.target.value })}
                                    placeholder="e.g. Main Office"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle text-slate-800 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5 flex justify-between items-center">
                                    <span>Coordinates *</span>
                                </label>
                                <button 
                                    type="button" 
                                    onClick={useMyLocation}
                                    className="w-full mb-3 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold border-2 border-indigo-100 dark:border-indigo-900/30 active:scale-[0.98] transition-all"
                                >
                                    <MapPin size={16} /> Use My Current Location
                                </button>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        required
                                        value={newGeo.latitude}
                                        onChange={(e) => setNewGeo({ ...newGeo, latitude: e.target.value })}
                                        placeholder="Lat (e.g. 19.12)"
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle text-slate-800 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                                    />
                                    <input
                                        type="text"
                                        required
                                        value={newGeo.longitude}
                                        onChange={(e) => setNewGeo({ ...newGeo, longitude: e.target.value })}
                                        placeholder="Lng (e.g. 72.84)"
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle text-slate-800 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5">Address *</label>
                                <textarea
                                    required
                                    value={newGeo.address}
                                    onChange={(e) => setNewGeo({ ...newGeo, address: e.target.value })}
                                    placeholder="Full street address..."
                                    rows="2"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle text-slate-800 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none max-h-[80px]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5 flex justify-between">
                                    <span>Radius Slider</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{newGeo.radius}m</span>
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="1000"
                                    step="10"
                                    value={newGeo.radius}
                                    onChange={(e) => setNewGeo({ ...newGeo, radius: e.target.value })}
                                    className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600
                                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 
                                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 
                                        [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                                        [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full 
                                        [&::-moz-range-thumb]:bg-indigo-600 [&::-moz-range-thumb]:border-none"
                                />
                            </div>

                            <div className="p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="w-full py-4 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 text-white font-semibold rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
                                >
                                    {isCreating ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Plus size={20} strokeWidth={2.5} />
                                            Save Location
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </MobileDashboardLayout>
    );
};

export default GeoFencing;
