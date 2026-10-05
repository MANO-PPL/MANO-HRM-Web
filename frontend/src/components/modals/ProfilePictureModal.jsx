import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Download,
    ExternalLink,
    User,
    Mail,
    Phone,
    Briefcase,
    Shield,
    Check
} from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * Universal Profile Picture Lightbox & Modal
 * Works seamlessly in both Web (Desktop) and Mobile views.
 */
const ProfilePictureModal = ({
    isOpen = false,
    onClose,
    imageUrl,
    url, // alternate prop name
    name = 'Employee',
    role,
    department,
    userCode,
    email,
    phone,
    status
}) => {
    const src = imageUrl || url;
    const [zoomLevel, setZoomLevel] = useState(1);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [copied, setCopied] = useState(false);

    // Reset zoom when image changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setZoomLevel(1);
            setImageLoaded(false);
            setImageError(false);
            setCopied(false);
        }
    }, [isOpen, src]);

    // Keyboard support: Escape to close, + / - to zoom
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose?.();
            } else if (e.key === '+' || e.key === '=') {
                setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
            } else if (e.key === '-') {
                setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
            } else if (e.key === '0') {
                setZoomLevel(1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        // Prevent body scroll while modal is open
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleZoomIn = (e) => {
        e.stopPropagation();
        setZoomLevel((prev) => Math.min(prev + 0.35, 2.5));
    };

    const handleZoomOut = (e) => {
        e.stopPropagation();
        setZoomLevel((prev) => Math.max(prev - 0.35, 0.75));
    };

    const handleResetZoom = (e) => {
        e.stopPropagation();
        setZoomLevel(1);
    };

    const handleDownload = async (e) => {
        e.stopPropagation();
        if (!src) return;
        try {
            const cleanName = (name || 'profile').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const res = await fetch(src);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${cleanName}_profile.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast.success('Profile picture downloaded');
        } catch {
            // Fallback: open in new tab
            window.open(src, '_blank');
        }
    };

    const handleCopyLink = (e) => {
        e.stopPropagation();
        if (!src) return;
        navigator.clipboard.writeText(src);
        setCopied(true);
        toast.info('Image URL copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={onClose}
                className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 dark:bg-black/92 backdrop-blur-xl select-none"
            >
                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 15 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-lg sm:max-w-xl md:max-w-2xl bg-white/10 dark:bg-[#161B22]/90 border border-white/20 dark:border-[#30363D] rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl flex flex-col overflow-hidden text-white"
                >
                    {/* Header Bar */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 dark:border-[#30363D] bg-white/5 shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center font-bold text-sm text-indigo-200 shrink-0">
                                {name ? name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm sm:text-base font-bold text-white truncate leading-tight">
                                        {name}
                                    </h3>
                                    {status && (
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                                            status === 'Active'
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : status === 'Inactive'
                                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                            {status}
                                        </span>
                                    )}
                                </div>
                                {(role || department || userCode) && (
                                    <p className="text-[11px] text-slate-300 dark:text-slate-400 truncate mt-0.5">
                                        {userCode ? `${userCode} • ` : ''}
                                        {role || ''}
                                        {department ? ` • ${department}` : ''}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {src && !imageError && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        title="Copy Image URL"
                                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                    >
                                        {copied ? <Check size={16} className="text-emerald-400" /> : <ExternalLink size={16} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownload}
                                        title="Download Photo"
                                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                    >
                                        <Download size={16} />
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                title="Close (Esc)"
                                className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all ml-1"
                                aria-label="Close dialog"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Image Viewport Container */}
                    <div className="relative w-full aspect-square max-h-[55vh] sm:max-h-[62vh] bg-black/40 flex items-center justify-center overflow-hidden p-4 group">
                        {/* Loading Spinner */}
                        {!imageLoaded && !imageError && src && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                                <div className="w-10 h-10 border-3 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                                <span className="text-xs text-white/60 font-medium">Loading photo...</span>
                            </div>
                        )}

                        {src && !imageError ? (
                            <motion.img
                                key={src}
                                src={src}
                                alt={name}
                                animate={{ scale: zoomLevel }}
                                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                                onLoad={() => setImageLoaded(true)}
                                onError={() => {
                                    setImageError(true);
                                    setImageLoaded(true);
                                }}
                                onDoubleClick={() => setZoomLevel((z) => (z > 1 ? 1 : 1.75))}
                                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-transform cursor-zoom-in"
                                title="Double-click to zoom toggle"
                            />
                        ) : (
                            /* Fallback when user has no photo or image link failed */
                            <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-extrabold text-5xl shadow-2xl border-4 border-white/20">
                                    {name ? name.charAt(0).toUpperCase() : <User size={48} />}
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-white">{name}</h4>
                                    <p className="text-xs text-slate-300 mt-1">
                                        {imageError ? 'Unable to load profile image preview' : 'No custom profile photo uploaded yet'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Floating Zoom Controls Bar (visible on hover or mobile) */}
                        {src && !imageError && imageLoaded && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 opacity-90 hover:opacity-100 transition-opacity z-20 shadow-xl">
                                <button
                                    type="button"
                                    onClick={handleZoomOut}
                                    disabled={zoomLevel <= 0.75}
                                    title="Zoom Out (-)"
                                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                >
                                    <ZoomOut size={15} />
                                </button>
                                <span className="text-[11px] font-mono px-1 font-semibold text-white/90 min-w-[42px] text-center">
                                    {Math.round(zoomLevel * 100)}%
                                </span>
                                <button
                                    type="button"
                                    onClick={handleZoomIn}
                                    disabled={zoomLevel >= 2.5}
                                    title="Zoom In (+)"
                                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                >
                                    <ZoomIn size={15} />
                                </button>
                                {zoomLevel !== 1 && (
                                    <button
                                        type="button"
                                        onClick={handleResetZoom}
                                        title="Reset Zoom (0)"
                                        className="p-1.5 text-indigo-300 hover:text-indigo-200 hover:bg-white/10 rounded-full transition-all ml-0.5"
                                    >
                                        <RotateCcw size={13} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Bottom Metadata Drawer / Info Footer */}
                    <div className="p-4 px-5 bg-white/5 dark:bg-[#0D1117]/80 border-t border-white/10 dark:border-[#30363D] shrink-0 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {email && (
                                <div className="flex items-center gap-2 text-slate-300 min-w-0">
                                    <Mail size={13} className="text-indigo-400 shrink-0" />
                                    <span className="truncate text-[11.5px]" title={email}>{email}</span>
                                </div>
                            )}
                            {phone && phone !== 'N/A' && (
                                <div className="flex items-center gap-2 text-slate-300 min-w-0">
                                    <Phone size={13} className="text-indigo-400 shrink-0" />
                                    <span className="truncate text-[11.5px] font-mono">{phone}</span>
                                </div>
                            )}
                            {department && (
                                <div className="flex items-center gap-2 text-slate-300 min-w-0">
                                    <Briefcase size={13} className="text-indigo-400 shrink-0" />
                                    <span className="truncate text-[11.5px]">{department}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default ProfilePictureModal;
