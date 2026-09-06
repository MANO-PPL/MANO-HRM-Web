import React, { useState, useEffect, useCallback } from 'react';
import { Camera, MapPin, ShieldAlert, CheckCircle2, RefreshCw, X, Lock, ChevronRight, HelpCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { checkAttendancePermissions, requestAllAttendancePermissions, requestCameraAccess, requestLocationAccess } from '../../../utils/permissionUtils';

const AttendancePermissionsBanner = ({ onPermissionsUpdated }) => {
    const [status, setStatus] = useState({
        camera: 'prompt',
        location: 'prompt',
        allGranted: false,
        anyDenied: false
    });
    const [isDismissed, setIsDismissed] = useState(false);
    const [isRequesting, setIsRequesting] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    const checkStatus = useCallback(async () => {
        const res = await checkAttendancePermissions();
        setStatus(res);
        if (onPermissionsUpdated) {
            onPermissionsUpdated(res);
        }
    }, [onPermissionsUpdated]);

    useEffect(() => {
        checkStatus();

        // Listen to permission status change if API supported
        let cameraStatusObj;
        let locationStatusObj;

        if (navigator?.permissions?.query) {
            navigator.permissions.query({ name: 'camera' })
                .then(perm => {
                    cameraStatusObj = perm;
                    perm.onchange = () => checkStatus();
                })
                .catch(() => {});

            navigator.permissions.query({ name: 'geolocation' })
                .then(perm => {
                    locationStatusObj = perm;
                    perm.onchange = () => checkStatus();
                })
                .catch(() => {});
        }

        return () => {
            if (cameraStatusObj) cameraStatusObj.onchange = null;
            if (locationStatusObj) locationStatusObj.onchange = null;
        };
    }, [checkStatus]);

    // If both permissions are granted or user dismissed this session, hide banner
    if (status.allGranted || isDismissed) {
        return null;
    }

    const handleRequestAll = async () => {
        setIsRequesting(true);
        try {
            const results = await requestAllAttendancePermissions();

            await checkStatus();

            if (results.camera.success && results.location.success) {
                toast.success("Camera and Location access granted successfully!");
            } else if (!results.camera.success && !results.location.success) {
                toast.error("Browser permissions are blocked. Please allow them from your browser address bar.");
                setShowHelpModal(true);
            } else if (!results.camera.success) {
                toast.warn("Camera permission is required for selfie attendance.");
                setShowHelpModal(true);
            } else if (!results.location.success) {
                toast.warn("Location permission is required to verify work area.");
                setShowHelpModal(true);
            }
        } catch (err) {
            console.error("Permission request error:", err);
        } finally {
            setIsRequesting(false);
        }
    };

    const isDenied = status.camera === 'denied' || status.location === 'denied';

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 dark:from-amber-500/[0.07] dark:via-orange-500/[0.07] dark:to-amber-500/[0.07] border border-amber-500/30 p-4 sm:p-5 shadow-lg backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left info */}
                <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldAlert size={20} strokeWidth={2.2} />
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                                Browser Permissions Needed
                            </h4>
                            <div className="flex items-center gap-1.5">
                                {/* Camera badge */}
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    status.camera === 'granted'
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                        : status.camera === 'denied'
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                }`}>
                                    <Camera size={10} />
                                    <span>Camera: {status.camera === 'granted' ? 'Allowed' : status.camera === 'denied' ? 'Blocked' : 'Required'}</span>
                                </span>

                                {/* Location badge */}
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    status.location === 'granted'
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                        : status.location === 'denied'
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                }`}>
                                    <MapPin size={10} />
                                    <span>Location: {status.location === 'granted' ? 'Allowed' : status.location === 'denied' ? 'Blocked' : 'Required'}</span>
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            Webcam selfies and GPS location verification are required to clock in, clock out, and record mid-shift checkpoints.
                        </p>
                    </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                        type="button"
                        onClick={() => setShowHelpModal(!showHelpModal)}
                        className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all flex items-center gap-1.5 cursor-pointer"
                        title="How to allow permissions in browser"
                    >
                        <HelpCircle size={14} />
                        <span className="hidden sm:inline">How to Allow</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRequestAll}
                        disabled={isRequesting}
                        className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {isRequesting ? (
                            <>
                                <RefreshCw size={13} className="animate-spin" /> Asking Browser...
                            </>
                        ) : (
                            <>
                                <Camera size={13} />
                                <span>{isDenied ? 'Retry / Allow Permissions' : 'Allow Camera & Location'}</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsDismissed(true)}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                        title="Dismiss for this session"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Expandable Help Instructions for Blocked Permissions */}
            {showHelpModal && (
                <div className="mt-4 pt-3.5 border-t border-amber-500/20 text-xs text-slate-700 dark:text-slate-200 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                        <Lock size={14} />
                        <span>How to enable Camera & Location in your browser address bar:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-black/40 border border-amber-500/20 space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">1</span>
                                Click Address Bar Icon
                            </div>
                            <p className="text-slate-500 dark:text-slate-400">
                                Click the <strong>lock icon (🔒)</strong> or <strong>tune / site settings icon</strong> next to the web address (<code className="font-mono bg-slate-100 dark:bg-white/10 px-1 rounded text-[10px]">localhost:5173</code>).
                            </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-black/40 border border-amber-500/20 space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">2</span>
                                Set to &quot;Allow&quot;
                            </div>
                            <p className="text-slate-500 dark:text-slate-400">
                                Toggle both <strong>Camera</strong> and <strong>Location</strong> permissions to <strong className="text-emerald-600 dark:text-emerald-400">&quot;Allow&quot;</strong>.
                            </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-black/40 border border-amber-500/20 space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">3</span>
                                Re-test Access
                            </div>
                            <p className="text-slate-500 dark:text-slate-400">
                                Click the button above to re-trigger permissions, or reload the page to apply changes.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendancePermissionsBanner;
