import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { Camera, Loader2, Edit, Trash2, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { compressImage } from '../../utils/imageCompressor';
import { getErrorMessage } from '../../utils/errorMessage';
import ActiveDevicesManager from '../../components/ActiveDevicesManager';

const Profile = () => {
    const { user: authUser, fetchUser, setUser, logout } = useAuth();
    const { skipTour } = useTour();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [imageTimestamp, setImageTimestamp] = useState(Date.now());
    const [chatbotVisible, setChatbotVisible] = useState(() => {
        const saved = localStorage.getItem('mano_chatbot_visible');
        return saved === null ? true : saved === 'true';
    });
    const [tourDismissed, setTourDismissed] = useState(() => !!(authUser?.tour_dismissed));

    const toggleChatbot = () => {
        setChatbotVisible(prev => {
            const next = !prev;
            localStorage.setItem('mano_chatbot_visible', String(next));
            return next;
        });
    };

    const toggleTourDismissed = async () => {
        const newStatus = !tourDismissed;
        setTourDismissed(newStatus);
        setUser(prev => prev ? { ...prev, tour_dismissed: newStatus } : prev);
        if (newStatus) {
            skipTour();
        } else {
            setUser(prev => prev ? { ...prev, pages_tour_seen: {} } : prev);
        }
        try {
            if (newStatus) {
                await api.patch('/profile/preferences', { tour_dismissed: true });
            } else {
                await api.patch('/profile/preferences', {
                    tour_dismissed: false,
                    pages_tour_seen: {},
                });
            }
            toast.success(newStatus ? 'App walkthrough disabled.' : 'App walkthrough enabled.');
            await fetchUser();
        } catch (error) {
            console.error('Failed to update tour preferences', error);
            toast.error('Failed to update preferences.');
            setTourDismissed(!newStatus);
            setUser(prev => prev ? { ...prev, tour_dismissed: !newStatus } : prev);
        }
    };

    // Fetch full profile data on mount
    useEffect(() => {
        const getProfile = async () => {
            try {
                const res = await api.get('/profile/me');
                if (res.data.ok) {
                    setProfileData(res.data.user);
                    setTourDismissed(res.data.user.tour_dismissed === 1 || res.data.user.tour_dismissed === '1' || res.data.user.tour_dismissed === true);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };
        getProfile();
    }, []);

    // Add cache-busting timestamp to avatar URL to force reload on update
    const getAvatarUrl = () => {
        const baseUrl = profileData?.profile_image_url || authUser?.profile_image_url;
        if (!baseUrl) return null;
        return `${baseUrl}?t=${imageTimestamp}`;
    };

    const user = {
        name: profileData?.user_name || authUser?.user_name || 'Mano Admin',
        role: profileData?.user_type || authUser?.user_type || 'admin',
        email: profileData?.email || authUser?.email || 'admin@demo.com',
        phone: profileData?.phone_no || authUser?.phone_no || '',
        department: profileData?.dept_name || authUser?.dept_name || 'Engineering',
        designation: profileData?.designation || authUser?.designation || 'Staff',
        employeeCode: profileData?.user_code || authUser?.user_code || '',
        avatar: getAvatarUrl()
    };

    const handleAvatarClick = () => {
        if (user.avatar && user.avatar.startsWith('http')) {
            setShowPreview(true);
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleEditClick = (e) => {
        e.stopPropagation();
        setShowPreview(false);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file (JPEG, PNG, WebP, GIF)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size exceeds the 5MB limit');
            return;
        }

        setUploading(true);
        try {
            // Compress image client-side before upload to prevent HTTP 413 Payload Too Large
            const compressedFile = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.85 });

            const formData = new FormData();
            formData.append('avatar', compressedFile);

            const res = await api.post('/profile', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.ok) {
                toast.success('Profile picture updated successfully!');
                setImageTimestamp(Date.now());
                await fetchUser(); // Refresh global user state
                setProfileData(prev => ({
                    ...prev,
                    profile_image_url: res.data.profile_image_url
                }));
            }
        } catch (error) {
            console.error('Upload Error:', error);
            toast.error(getErrorMessage(error, 'Failed to update profile picture'));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAvatar = async () => {
        if (!window.confirm('Are you sure you want to remove your profile picture?')) return;

        try {
            const res = await api.delete('/profile');
            if (res.data.ok) {
                toast.success('Profile picture removed!');
                setProfileData(prev => ({
                    ...prev,
                    profile_image_url: null
                }));
                await fetchUser();
                setShowPreview(false);
                setImageTimestamp(Date.now());
            }
        } catch (error) {
            console.error('Delete Error:', error);
            toast.error(getErrorMessage(error, 'Failed to remove profile picture'));
        }
    };

    if (loading) {
        return (
            <MobileDashboardLayout title="My Profile" contentClassName="p-0">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-indigo-600" size={48} />
                </div>
            </MobileDashboardLayout>
        );
    }

    return (
        <MobileDashboardLayout title="My Profile" contentClassName="p-0 pb-12 space-y-0 w-full overflow-x-hidden">
            <div className="w-full">

                {/* 1. Full-Width Edge-to-Edge Hero Header Banner */}
                <div className="relative w-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 dark:from-[#0a0d14] dark:via-[#0e1320] dark:to-[#0a0d14] text-white pt-6 pb-7 px-4 shadow-lg border-b border-indigo-500/20 overflow-hidden">
                    {/* Ambient Glows */}
                    <div className="absolute -top-16 -right-16 w-52 h-52 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center text-center">
                        {/* Avatar */}
                        <div className="relative group">
                            <div
                                onClick={handleAvatarClick}
                                className="w-24 h-24 rounded-full bg-white/10 dark:bg-white/5 flex items-center justify-center text-white text-3xl font-extrabold ring-4 ring-white/20 dark:ring-white/10 shadow-2xl shrink-0 overflow-hidden cursor-pointer backdrop-blur-md active:scale-95 transition-transform"
                            >
                                {user.avatar ? (
                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                    user.name.charAt(0).toUpperCase()
                                )}
                            </div>

                            {/* Camera Icon Badge */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center ring-2 ring-slate-900 shadow-lg active:scale-90 transition-transform"
                                title="Change Profile Picture"
                                aria-label="Change Profile Picture"
                            >
                                {uploading ? (
                                    <Loader2 className="animate-spin" size={14} />
                                ) : (
                                    <Camera size={14} />
                                )}
                            </button>

                            {/* Hidden Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        {/* User Name & Details */}
                        <div className="mt-3.5 space-y-2">
                            <h2 className="text-xl font-extrabold text-white capitalize tracking-tight">{user.name}</h2>
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-indigo-200 text-[11px] font-bold uppercase tracking-wider border border-white/15 shadow-2xs">
                                    <span>{user.role}</span>
                                </div>
                                {user.employeeCode && (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 backdrop-blur-md text-slate-300 text-[11px] font-medium tracking-wider border border-white/10">
                                        <span className="text-slate-400 font-mono text-[10px]">ID:</span>
                                        <span className="font-mono font-semibold">{user.employeeCode}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Full-Width Body Content */}
                <div className="w-full px-3.5 sm:px-5 py-3 space-y-2.5">
                    {/* Contact Info Card */}
                    <div className="w-full bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-[#30363D] rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#21262D]">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-github-dark-text uppercase tracking-wider">
                                Contact Information
                            </h3>
                        </div>

                        <div className="space-y-2">
                            <div>
                                <p className="text-[10px] font-semibold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Email Address</p>
                                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-github-dark-text truncate mt-0.5">{user.email || '—'}</p>
                            </div>

                            <div className="pt-2 border-t border-slate-100/60 dark:border-[#21262D]/60">
                                <p className="text-[10px] font-semibold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Phone Number</p>
                                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-github-dark-text truncate mt-0.5">{user.phone || '—'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Employment Details Card */}
                    <div className="w-full bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-[#30363D] rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#21262D]">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-github-dark-text uppercase tracking-wider">
                                Employment Details
                            </h3>
                        </div>

                        <div className="space-y-2">
                            <div>
                                <p className="text-[10px] font-semibold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Department</p>
                                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-github-dark-text truncate mt-0.5">{user.department || '—'}</p>
                            </div>

                            <div className="pt-2 border-t border-slate-100/60 dark:border-[#21262D]/60">
                                <p className="text-[10px] font-semibold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Designation</p>
                                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-github-dark-text truncate mt-0.5">{user.designation || '—'}</p>
                            </div>

                            {user.employeeCode && (
                                <div className="pt-2 border-t border-slate-100/60 dark:border-[#21262D]/60">
                                    <p className="text-[10px] font-semibold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Employee Code</p>
                                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-github-dark-text font-mono truncate mt-0.5">{user.employeeCode}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preferences Card */}
                    <div className="w-full bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-[#30363D] rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#21262D]">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-github-dark-text uppercase tracking-wider">
                                Preferences
                            </h3>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-github-dark-text text-xs">AI Chatbot (Mano Copilot)</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{chatbotVisible ? 'Visible' : 'Hidden'}</p>
                            </div>
                            <button
                                onClick={toggleChatbot}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none shrink-0 cursor-pointer ${chatbotVisible ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${chatbotVisible ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between gap-4 pt-2.5 border-t border-slate-100 dark:border-[#21262D]">
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-github-dark-text text-xs">Interactive Page Guides</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{!tourDismissed ? 'Enabled' : 'Disabled'}</p>
                            </div>
                            <button
                                onClick={toggleTourDismissed}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none shrink-0 cursor-pointer ${!tourDismissed ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${!tourDismissed ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Active Devices & Sessions */}
                    <div className="w-full">
                        <ActiveDevicesManager />
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={logout}
                        className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] border border-rose-600/30 shadow-sm uppercase tracking-wider"
                    >
                        <LogOut size={16} />
                        Log Out
                    </button>
                </div>
            </div>

            {/* --- IMAGE PREVIEW MODAL --- */}
            {showPreview && createPortal(
                <div
                    className="fixed inset-0 z-[9999] overflow-y-auto bg-black/90 backdrop-blur-md transition-opacity duration-200"
                    onClick={() => setShowPreview(false)}
                >
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div
                            className="relative w-full max-w-sm space-y-6 animate-in fade-in zoom-in-95 duration-200 mx-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                        <div className="relative bg-transparent rounded-lg overflow-hidden flex items-center justify-center">
                            <img
                                src={user.avatar}
                                alt="Profile Preview"
                                className="w-full max-h-[70vh] object-contain rounded-2xl"
                            />
                        </div>

                        <div className="flex justify-center gap-4">
                            <button
                                onClick={handleEditClick}
                                className="flex-1 py-3 bg-white/10 backdrop-blur text-white font-bold rounded-xl flex items-center justify-center gap-2"
                            >
                                <Edit size={18} /> Edit
                            </button>
                            <button
                                onClick={handleDeleteAvatar}
                                className="flex-1 py-3 bg-red-500/80 backdrop-blur text-white font-bold rounded-xl flex items-center justify-center gap-2"
                            >
                                <Trash2 size={18} /> Remove
                            </button>
                        </div>
                        <button onClick={() => setShowPreview(false)} className="w-full py-3 text-white/50 font-bold">Close</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </MobileDashboardLayout>
    );
};

export default Profile;
