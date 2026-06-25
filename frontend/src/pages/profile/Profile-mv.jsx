import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { Mail, Phone, Briefcase, Shield, Camera, Loader2, Edit, Trash2, LogOut, Sparkles, Map } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { compressImage } from '../../utils/imageCompressor';
import { getErrorMessage } from '../../utils/errorMessage';

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
        phone: profileData?.phone_no || authUser?.phone_no || '5',
        department: profileData?.dept_name || 'Engineering',
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
            <MobileDashboardLayout title="My Profile">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-indigo-600" size={48} />
                </div>
            </MobileDashboardLayout>
        );
    }

    return (
        <MobileDashboardLayout title="My Profile">
            <div className="w-full space-y-4 pb-6 px-4">

                {/* Profile Header Card */}
                <div className="bg-white dark:bg-[#1f2937] rounded-3xl p-6 shadow-sm flex flex-col items-center gap-3 text-center border border-slate-100 dark:border-transparent">
                    <div className="relative group mt-2">
                        <div
                            onClick={handleAvatarClick}
                            className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold border-[3px] border-white dark:border-github-dark-border shadow-lg shrink-0 overflow-hidden cursor-pointer"
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
                            className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full flex items-center justify-center border-[3px] border-white dark:border-[#1f2937] shadow-lg active:scale-95 transition-transform"
                            title="Change Profile Picture"
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

                    <div className="space-y-2 mt-2">
                        <h2 className="text-[17px] font-bold text-slate-800 dark:text-github-dark-text capitalize tracking-tight">{user.name}</h2>
                        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/20">
                            <Shield size={12} />
                            <span>{user.role}</span>
                        </div>
                    </div>
                </div>

                {/* Contact Info Card */}
                <div className="bg-white dark:bg-[#1f2937] border border-slate-100 dark:border-transparent rounded-3xl p-6 shadow-sm space-y-6">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-github-dark-text">Contact Information</h3>

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-github-dark-muted shrink-0 border border-slate-100 dark:border-transparent">
                            <Mail size={18} />
                        </div>
                        <div className="min-w-0 pt-0.5">
                            <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mb-0.5">Email Address</p>
                            <p className="text-[13px] font-semibold text-slate-800 dark:text-github-dark-text truncate">{user.email}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-github-dark-muted shrink-0 border border-slate-100 dark:border-transparent">
                            <Phone size={18} />
                        </div>
                        <div className="min-w-0 pt-0.5">
                            <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mb-0.5">Phone Number</p>
                            <p className="text-[13px] font-semibold text-slate-800 dark:text-github-dark-text">{user.phone}</p>
                        </div>
                    </div>
                </div>

                {/* Employment Details Card */}
                <div className="bg-white dark:bg-[#1f2937] border border-slate-100 dark:border-transparent rounded-3xl p-6 shadow-sm space-y-6">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-github-dark-text">Employment Details</h3>

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-github-dark-muted shrink-0 border border-slate-100 dark:border-transparent">
                            {/* Using a building/company icon to match UI roughly */}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                                <path d="M9 22v-4h6v4"></path>
                                <path d="M8 6h.01"></path>
                                <path d="M16 6h.01"></path>
                                <path d="M12 6h.01"></path>
                                <path d="M12 10h.01"></path>
                                <path d="M12 14h.01"></path>
                                <path d="M16 10h.01"></path>
                                <path d="M16 14h.01"></path>
                                <path d="M8 10h.01"></path>
                                <path d="M8 14h.01"></path>
                            </svg>
                        </div>
                        <div className="min-w-0 pt-0.5">
                            <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mb-0.5">Department</p>
                            <p className="text-[13px] font-semibold text-slate-800 dark:text-github-dark-text truncate">{user.department}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-github-dark-muted shrink-0 border border-slate-100 dark:border-transparent">
                            <Briefcase size={18} />
                        </div>
                        <div className="min-w-0 pt-0.5">
                            <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mb-0.5">Designation</p>
                            <p className="text-[13px] font-semibold text-slate-800 dark:text-github-dark-text">Manager</p>
                        </div>
                    </div>
                </div>

                {/* Preferences Card */}
                <div className="bg-white dark:bg-[#1f2937] border border-slate-100 dark:border-transparent rounded-3xl p-6 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-github-dark-text border-b border-slate-100 dark:border-slate-800 pb-3">Preferences</h3>
                    
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-github-dark-text text-xs">AI Chatbot (Mano Copilot)</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{chatbotVisible ? 'Visible' : 'Hidden'}</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleChatbot}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${chatbotVisible ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${chatbotVisible ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <Map size={16} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-github-dark-text text-xs">Interactive Page Guides</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{!tourDismissed ? 'Enabled' : 'Disabled'}</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleTourDismissed}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${!tourDismissed ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${!tourDismissed ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={logout}
                    className="w-full py-4 mt-2 bg-red-500/90 hover:bg-red-500 text-white font-bold text-[13px] rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-red-500/20 shadow-sm"
                >
                    <LogOut size={16} />
                    Log Out
                </button>
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
