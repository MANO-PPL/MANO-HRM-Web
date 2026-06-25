import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { User, Mail, Phone, Briefcase, Shield, Camera, Loader2, X, RefreshCw, Edit, Download, Trash2, Sparkles, Eye, EyeOff, Map } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';
import api from '../../services/api';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import { AnimatePresence } from 'framer-motion';
import { compressImage } from '../../utils/imageCompressor';
import { getErrorMessage } from '../../utils/errorMessage';

const Profile = () => {
    const navigate = useNavigate();
    const { skipTour } = useTour();


    const { user: authUser, fetchUser, setUser } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [imageTimestamp, setImageTimestamp] = useState(Date.now());
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => {},
        confirmText: 'Confirm'
    });
    const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
    const [chatbotVisible, setChatbotVisible] = useState(() => {
        const saved = localStorage.getItem('mano_chatbot_visible');
        return saved === null ? true : saved === 'true';
    });
    // Initialize directly from authUser (already fetched from /auth/me which now includes tour_dismissed)
    // so the toggle reflects the DB value on first render — no flash, no stale state.
    const [tourDismissed, setTourDismissed] = useState(() => !!(authUser?.tour_dismissed));

    const toggleChatbot = () => {
        setChatbotVisible(prev => {
            const next = !prev;
            localStorage.setItem('mano_chatbot_visible', String(next));
            return next;
        });
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

    const toggleTourDismissed = async () => {
        const newStatus = !tourDismissed;
        setTourDismissed(newStatus); // Optimistic local state update
        // Immediately update AuthContext so TourContext's tourEnabled reacts right away
        setUser(prev => prev ? { ...prev, tour_dismissed: newStatus } : prev);
        // If disabling tours, also stop any currently active tour
        if (newStatus) {
            skipTour();
        } else {
            // Enabling tours: reset all pages_tour_seen so auto-tours fire fresh on every page
            setUser(prev => prev ? { ...prev, pages_tour_seen: {} } : prev);
        }
        try {
            if (newStatus) {
                // Disabling: just save tour_dismissed = true
                await api.patch('/profile/preferences', { tour_dismissed: true });
            } else {
                // Enabling: save tour_dismissed = false AND reset pages_tour_seen
                await api.patch('/profile/preferences', {
                    tour_dismissed: false,
                    pages_tour_seen: {},
                });
            }
            toast.success(newStatus ? 'App walkthrough disabled.' : 'App walkthrough enabled. Tours will start on your next page visit.');
            // Re-fetch to sync with backend
            await fetchUser();
        } catch (error) {
            console.error('Failed to update tour preferences', error);
            toast.error('Failed to update preferences.');
            // Revert both local state and context on failure
            setTourDismissed(!newStatus);
            setUser(prev => prev ? { ...prev, tour_dismissed: !newStatus } : prev);
        }
    };

    // Add cache-busting timestamp to avatar URL to force reload on update
    const getAvatarUrl = () => {
        const baseUrl = profileData?.profile_image_url || authUser?.profile_image_url;
        if (!baseUrl) return null;
        // Add timestamp to prevent browser caching (only updates when image changes)
        return `${baseUrl}?t=${imageTimestamp}`;
    };

    const user = {
        name: profileData?.user_name || authUser?.user_name || 'User',
        role: profileData?.user_type || authUser?.user_type || 'Staff',
        email: profileData?.email || authUser?.email || '',
        phone: profileData?.phone_no || authUser?.phone_no || 'Not provided',
        department: profileData?.dept_name || 'Not assigned',
        employeeCode: profileData?.user_code || authUser?.user_code || '...',
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
            // Compress and resize image client-side to prevent HTTP 413 Payload Too Large
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

                // Update timestamp to force image reload (cache-busting)
                setImageTimestamp(Date.now());

                await fetchUser(); // Refresh global user state
                // Also update local profile data
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

    const handleDeleteAvatar = () => {
        setConfirmModal({
            isOpen: true,
            title: "Remove Photo?",
            message: "Are you sure you want to remove your profile picture? This will reset your avatar to the default.",
            type: 'danger',
            confirmText: "Remove",
            onConfirm: async () => {
                try {
                    setIsDeletingAvatar(true);
                    const res = await api.delete('/profile');
                    if (res.data.ok) {
                        toast.success('Profile picture removed!');
                        setProfileData(prev => ({ ...prev, profile_image_url: null }));
                        await fetchUser();
                        setShowPreview(false);
                        setImageTimestamp(Date.now());
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }
                } catch (error) {
                    console.error('Delete Error:', error);
                    toast.error(getErrorMessage(error, 'Failed to remove profile picture'));
                } finally {
                    setIsDeletingAvatar(false);
                }
            }
        });
    };

    if (loading) {
        return (
            <DashboardLayout title="My Profile">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-indigo-600" size={48} />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="My Profile">
            <div className="w-full space-y-6">

                {/* Profile Header Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col md:flex-row items-center md:items-center gap-8 transition-colors">
                    <div className="relative group">
                        <div
                            onClick={handleAvatarClick}
                            className="w-32 h-32 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-4xl font-bold border-4 border-white dark:border-github-dark-border shadow-lg shrink-0 overflow-hidden cursor-pointer"
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
                            className="absolute bottom-0 right-0 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center border-4 border-white dark:border-github-dark-border shadow-lg transition-all active:scale-95"
                            title="Change Profile Picture"
                        >
                            {uploading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Camera size={18} />
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

                    <div className="flex-1 text-center md:text-left space-y-2">
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text capitalize">{user.name}</h2>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-900/10 px-3 py-1 rounded-full w-fit mx-auto md:mx-0 capitalize">
                            <Shield size={16} />
                            <span>{user.role}</span>
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-github-dark-border space-y-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text border-b border-slate-100 dark:border-github-dark-border pb-4">
                            Contact Information
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-github-dark-subtle rounded-xl text-slate-500 dark:text-github-dark-muted shrink-0">
                                    <Mail size={22} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-500 dark:text-github-dark-muted mb-0.5">Email Address</p>
                                    <p className="text-slate-800 dark:text-github-dark-text font-medium truncate">{user.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-github-dark-subtle rounded-xl text-slate-500 dark:text-github-dark-muted shrink-0">
                                    <Phone size={22} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-500 dark:text-github-dark-muted mb-0.5">Phone Number</p>
                                    <p className="text-slate-800 dark:text-github-dark-text font-medium truncate">{user.phone}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Employment Info */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-github-dark-border space-y-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text border-b border-slate-100 dark:border-github-dark-border pb-4">
                            Employment Details
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-github-dark-subtle rounded-xl text-slate-500 dark:text-github-dark-muted shrink-0">
                                    <Briefcase size={22} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-500 dark:text-github-dark-muted mb-0.5">Department</p>
                                    <p className="text-slate-800 dark:text-github-dark-text font-medium truncate">{user.department}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-github-dark-subtle rounded-xl text-slate-500 dark:text-github-dark-muted shrink-0">
                                    <User size={22} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-500 dark:text-github-dark-muted mb-0.5">Employee Code</p>
                                    <p className="text-slate-800 dark:text-github-dark-text font-medium truncate">{user.employeeCode}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preferences Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-github-dark-border space-y-4 transition-colors">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text border-b border-slate-100 dark:border-github-dark-border pb-4">
                        Preferences
                    </h3>
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                                <Sparkles size={22} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">AI Chatbot (Mano Copilot)</p>
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5">
                                    {chatbotVisible ? 'Visible on all pages' : 'Hidden from all pages'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={toggleChatbot}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${
                                chatbotVisible
                                    ? 'bg-indigo-600'
                                    : 'bg-slate-200 dark:bg-github-dark-border'
                            }`}
                            aria-label="Toggle AI Chatbot"
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                                    chatbotVisible ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-6 pt-4 border-t border-slate-100 dark:border-github-dark-border">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                                <Map size={22} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">Interactive Page Guides</p>
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5 max-w-sm leading-relaxed">
                                    {!tourDismissed ? 'Enabled' : 'Disabled'}. When enabled, helpful walkthrough guides automatically introduce key features the first time you visit a page.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                            <button
                                onClick={toggleTourDismissed}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                                    !tourDismissed
                                        ? 'bg-indigo-600'
                                        : 'bg-slate-200 dark:bg-github-dark-border'
                                }`}
                                aria-label="Toggle App Walkthrough"
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                                        !tourDismissed ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* --- IMAGE PREVIEW MODAL --- */}
            {showPreview && createPortal(
                <div
                    className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/95 backdrop-blur-xl transition-all duration-200"
                    onClick={() => setShowPreview(false)}
                >
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div
                            className="relative w-full max-w-4xl space-y-6 animate-in fade-in zoom-in-95 duration-200 mx-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                        <div className="flex justify-between items-center px-4">
                            <h3 className="text-2xl font-bold text-white tracking-tight">
                                Profile Picture
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleEditClick}
                                    className="p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md flex items-center gap-2 px-4"
                                >
                                    <Edit size={20} />
                                    <span className="text-sm font-bold">Edit</span>
                                </button>
                                <button
                                    onClick={handleDeleteAvatar}
                                    className="p-2.5 rounded-full bg-red-500/10 text-red-500 hover:text-white hover:bg-red-500 transition-all backdrop-blur-md flex items-center gap-2 px-4"
                                >
                                    <Trash2 size={20} />
                                    <span className="text-sm font-bold">Remove</span>
                                </button>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md"
                                >
                                    <X size={28} />
                                </button>
                            </div>
                        </div>

                        <div className="relative bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center min-h-[50vh]">
                            <img
                                src={user.avatar}
                                alt="Profile Preview"
                                className="w-full h-full object-contain max-h-[80vh]"
                            />
                        </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <AnimatePresence>
                {confirmModal.isOpen && (
                    <ConfirmationModal
                        {...confirmModal}
                        isSubmitting={isDeletingAvatar}
                        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    />
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
};

export default Profile;
