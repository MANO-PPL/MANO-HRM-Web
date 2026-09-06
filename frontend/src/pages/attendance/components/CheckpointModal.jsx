import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import {
    MapPin,
    Navigation,
    RefreshCw,
    AlertCircle,
    ExternalLink,
    X,
    Camera,
    RotateCcw,
    CheckCircle2,
    Lock,
    ArrowRight,
    ShieldCheck,
    Check
} from 'lucide-react';
import { requestCameraAccess } from '../../../utils/permissionUtils';

const CheckpointModal = ({
    // Support both prop naming conventions for seamless compatibility
    isOpen,
    showCheckpointModal,
    onClose,
    setShowCheckpointModal,
    isMarkingCheckpoint,
    checkpointLocation,
    checkpointNote,
    setCheckpointNote,
    onConfirm,
    handleConfirmCheckpoint,
    onRetryLocation,
    handleOpenCheckpointModal,
    checkpointImgSrc,
    setCheckpointImgSrc,
    webcamRef,
    isSelfieRequired = false
}) => {
    const isVisible = isOpen ?? showCheckpointModal;
    const requireSelfie = Boolean(isSelfieRequired);

    const handleClose = () => {
        if (onClose) onClose();
        else if (setShowCheckpointModal) setShowCheckpointModal(false);
    };
    const handleRetry = onRetryLocation || handleOpenCheckpointModal;
    const handleConfirmSubmit = onConfirm || handleConfirmCheckpoint;

    const internalWebcamRef = useRef(null);
    const activeWebcamRef = webcamRef || internalWebcamRef;

    const [localImgSrc, setLocalImgSrc] = useState(null);
    const currentImgSrc = checkpointImgSrc !== undefined ? checkpointImgSrc : localImgSrc;
    const setCurrentImg = setCheckpointImgSrc || setLocalImgSrc;

    const [cameraError, setCameraError] = useState(null);
    const [isRequestingCam, setIsRequestingCam] = useState(false);
    const [facingMode, setFacingMode] = useState('user');

    if (!isVisible) return null;

    const capturePhoto = () => {
        if (activeWebcamRef.current) {
            try {
                const shot = activeWebcamRef.current.getScreenshot();
                if (shot) {
                    setCurrentImg(shot);
                }
            } catch (err) {
                console.warn("Capture checkpoint photo failed:", err);
            }
        }
    };

    const retakePhoto = () => {
        setCurrentImg(null);
    };

    const handleRequestCamera = async () => {
        setIsRequestingCam(true);
        setCameraError(null);
        const res = await requestCameraAccess();
        setIsRequestingCam(false);
        if (!res.success) {
            setCameraError(res.message);
        } else {
            setCameraError(null);
        }
    };

    const onConfirmClick = () => {
        if (!requireSelfie) {
            // When selfie is disabled, do NOT take selfie
            if (handleConfirmSubmit) {
                handleConfirmSubmit(null);
            }
            return;
        }

        // When selfie is enabled, require selfie capture
        let photoToSubmit = currentImgSrc;
        if (!photoToSubmit && activeWebcamRef?.current && !cameraError) {
            try {
                const shot = activeWebcamRef.current.getScreenshot();
                if (shot) {
                    photoToSubmit = shot;
                    setCurrentImg(shot);
                }
            } catch (err) {
                console.warn("Auto-capture checkpoint selfie failed:", err);
            }
        }

        if (!photoToSubmit) {
            return;
        }

        if (handleConfirmSubmit) {
            handleConfirmSubmit(photoToSubmit);
        }
    };

    const isGpsReady = Boolean(checkpointLocation?.lat && checkpointLocation?.lng && !checkpointLocation?.loading && !checkpointLocation?.error);

    return createPortal(
        <div className="fixed inset-0 z-[9000] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center transition-all duration-200">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity"
                    onClick={() => !isMarkingCheckpoint && handleClose()}
                />

                {/* Main Content Modal Container */}
                <div className="relative w-full max-w-lg sm:max-w-xl md:max-w-2xl space-y-4 sm:space-y-6 animate-in fade-in zoom-in-95 duration-200 text-left mx-auto my-auto py-2">
                    {/* Header */}
                    <div className="relative flex justify-center items-center px-4">
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner">
                                    <MapPin size={20} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight text-center">
                                    Mark Checkpoint
                                </h3>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                                {requireSelfie ? (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <Lock size={10} /> Selfie Mandatory
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <ShieldCheck size={11} /> GPS Only · No Selfie Required
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => !isMarkingCheckpoint && handleClose()}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md cursor-pointer"
                            aria-label="Close Checkpoint Modal"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    {/* CASE 1: SELFIE REQUIRED - Camera Viewport */}
                    {requireSelfie ? (
                        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center aspect-[4/3] sm:aspect-video w-full max-h-[320px] sm:max-h-[400px]">
                            {currentImgSrc ? (
                                <div className="relative w-full h-full">
                                    <img
                                        src={currentImgSrc}
                                        alt="Checkpoint Selfie"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-4 right-4 z-10">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/30 shadow-lg">
                                            <CheckCircle2 size={13} /> Photo Captured
                                        </span>
                                    </div>
                                </div>
                            ) : cameraError ? (
                                <div className="p-6 text-center space-y-4 max-w-md mx-auto">
                                    <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
                                        <Camera size={32} />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black text-white tracking-tight">Camera Permission Required</h4>
                                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                            {cameraError}
                                        </p>
                                    </div>

                                    {/* Unblock steps */}
                                    <div className="text-xs bg-white/5 border border-white/10 rounded-xl p-3 text-left text-slate-300 space-y-1.5">
                                        <div className="font-bold text-amber-400 flex items-center gap-1.5">
                                            <Lock size={13} /> Browser Permission Instructions:
                                        </div>
                                        <p>1. Click the lock/camera icon (🔒/🎥) beside the URL in the address bar.</p>
                                        <p>2. Change Camera permission to <strong>&quot;Allow&quot;</strong>.</p>
                                        <p>3. Click <strong>&quot;Ask Browser for Permission&quot;</strong> below.</p>
                                    </div>

                                    <div className="flex items-center justify-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={handleRequestCamera}
                                            disabled={isRequestingCam}
                                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isRequestingCam ? (
                                                <>
                                                    <RefreshCw size={14} className="animate-spin" /> Asking Browser...
                                                </>
                                            ) : (
                                                <>
                                                    <Camera size={14} /> Ask Browser for Permission
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCameraError(null)}
                                            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Webcam
                                        audio={false}
                                        ref={activeWebcamRef}
                                        screenshotFormat="image/jpeg"
                                        className="w-full h-full object-cover"
                                        playsInline={true}
                                        mirrored={facingMode === 'user'}
                                        videoConstraints={{ facingMode }}
                                        onUserMediaError={(err) => {
                                            console.warn("Checkpoint webcam error:", err);
                                            const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
                                            setCameraError(isDenied
                                                ? "Camera permission was blocked in your browser settings."
                                                : (err?.message || "Camera access denied or unavailable."));
                                        }}
                                    />
                                    {/* Mobile Camera Switch Button (Front / Back) */}
                                    <div className="absolute top-4 right-4 z-10">
                                        <button
                                            type="button"
                                            onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                                            className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 hover:bg-black/80 transition-all active:scale-95 cursor-pointer shadow-lg flex items-center gap-1.5 text-xs font-bold"
                                            title="Switch Camera (Front/Rear)"
                                            aria-label="Switch Camera"
                                        >
                                            <RotateCcw size={14} />
                                            <span className="hidden sm:inline text-[10px]">Flip</span>
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* On-Camera Top-Left Geolocation Status Pill Overlay */}
                            <div className="absolute top-4 left-4 z-10">
                                {checkpointLocation?.loading ? (
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-amber-300 text-xs font-semibold border border-amber-500/30 shadow-lg">
                                        <RefreshCw size={12} className="animate-spin" /> Acquiring GPS...
                                    </span>
                                ) : checkpointLocation?.error ? (
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-950/80 backdrop-blur-md text-rose-300 text-xs font-semibold border border-rose-500/30 shadow-lg">
                                        <AlertCircle size={12} /> GPS Error
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-emerald-400 text-xs font-semibold border border-emerald-500/30 shadow-lg">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Location Locked
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* CASE 2: SELFIE DISABLED - Clean GPS Location Hero Card (No Camera Viewport) */
                        <div className="p-6 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl text-white space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                                        <Navigation size={24} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-white tracking-tight">Location Verification</h4>
                                        <p className="text-xs text-slate-400">Captured via high-precision device GPS</p>
                                    </div>
                                </div>
                                {checkpointLocation?.accuracy && (
                                    <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-semibold text-slate-300 border border-white/10">
                                        ±{Math.round(checkpointLocation.accuracy)}m accuracy
                                    </span>
                                )}
                            </div>

                            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                                {checkpointLocation?.loading ? (
                                    <div className="flex items-center gap-2.5 text-amber-300 text-xs py-2">
                                        <RefreshCw size={14} className="animate-spin text-amber-400" />
                                        <span>Acquiring GPS coordinates and resolving address...</span>
                                    </div>
                                ) : checkpointLocation?.error ? (
                                    <div className="space-y-2 text-rose-300">
                                        <p className="flex items-center gap-2 text-xs font-medium">
                                            <AlertCircle size={16} className="shrink-0" />
                                            {checkpointLocation.error}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleRetry}
                                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-500/30 cursor-pointer"
                                        >
                                            <RefreshCw size={12} /> Retry GPS
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="font-semibold text-slate-100 text-sm leading-relaxed">
                                            {checkpointLocation?.address || "Address detected"}
                                        </p>
                                        <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-2 border-t border-white/10">
                                            <span>
                                                {checkpointLocation?.lat?.toFixed(5)}, {checkpointLocation?.lng?.toFixed(5)}
                                            </span>
                                            {checkpointLocation?.lat && checkpointLocation?.lng && (
                                                <a
                                                    href={`https://www.google.com/maps?q=${checkpointLocation.lat},${checkpointLocation.lng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-amber-400 hover:underline flex items-center gap-1 font-sans font-bold"
                                                >
                                                    <ExternalLink size={12} /> Open in Maps
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Geolocation Details (when camera is shown) & Optional Note Field */}
                    <div className="space-y-3 px-2 w-full max-w-lg sm:max-w-xl mx-auto">
                        {requireSelfie && (
                            <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl backdrop-blur-md text-white text-xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <Navigation size={12} className="text-indigo-400" /> Current Location
                                    </span>
                                    {checkpointLocation?.accuracy && (
                                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-semibold text-slate-300">
                                            ±{Math.round(checkpointLocation.accuracy)}m accuracy
                                        </span>
                                    )}
                                </div>
                                {checkpointLocation?.loading ? (
                                    <div className="flex items-center gap-2 text-slate-300 py-1 text-xs">
                                        <RefreshCw size={12} className="animate-spin text-amber-400" />
                                        <span>Acquiring high-precision GPS coordinates...</span>
                                    </div>
                                ) : checkpointLocation?.error ? (
                                    <div className="space-y-2 text-rose-300">
                                        <p className="flex items-center gap-1.5 text-xs font-medium">
                                            <AlertCircle size={14} className="shrink-0" />
                                            {checkpointLocation.error}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleRetry}
                                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-500/30 cursor-pointer"
                                        >
                                            <RefreshCw size={12} /> Retry GPS Location
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <p className="font-semibold text-slate-100 line-clamp-2 leading-relaxed">
                                            {checkpointLocation?.address || "Address detected"}
                                        </p>
                                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-white/5">
                                            <span>
                                                {checkpointLocation?.lat?.toFixed(5)}, {checkpointLocation?.lng?.toFixed(5)}
                                            </span>
                                            {checkpointLocation?.lat && checkpointLocation?.lng && (
                                                <a
                                                    href={`https://www.google.com/maps?q=${checkpointLocation.lat},${checkpointLocation.lng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-amber-400 hover:underline flex items-center gap-1 font-sans font-bold"
                                                >
                                                    <ExternalLink size={11} /> Maps
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Optional Note Field */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                Checkpoint Note <span className="text-slate-500 font-normal lowercase">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={checkpointNote || ''}
                                onChange={(e) => setCheckpointNote && setCheckpointNote(e.target.value)}
                                placeholder="e.g. Site B inspection, floor rounds, client meeting..."
                                maxLength={120}
                                disabled={isMarkingCheckpoint}
                                className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-white placeholder-slate-400 text-xs sm:text-sm backdrop-blur-md shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Bottom Action Controls */}
                    <div className="pt-2">
                        {requireSelfie ? (
                            /* SELFIE REQUIRED ACTIONS */
                            !currentImgSrc ? (
                                cameraError ? (
                                    <div className="flex w-full gap-4 px-2 max-w-lg sm:max-w-xl mx-auto">
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            className="flex-1 px-6 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-sm sm:text-base transition-all cursor-pointer backdrop-blur-md"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="button"
                                            disabled={true}
                                            className="flex-1 px-6 py-3.5 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs sm:text-sm cursor-not-allowed text-center flex items-center justify-center gap-2"
                                        >
                                            <Lock size={15} /> Selfie Required
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={capturePhoto}
                                            title="Take Checkpoint Selfie"
                                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white text-amber-600 hover:scale-110 active:scale-95 flex items-center justify-center shadow-xl shadow-amber-900/20 transition-all duration-300 ring-8 ring-white/20 cursor-pointer"
                                        >
                                            <Camera size={36} />
                                        </button>
                                        <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">
                                            Tap to capture required selfie
                                        </span>
                                    </div>
                                )
                            ) : (
                                <div className="flex w-full gap-4 px-2 max-w-lg sm:max-w-xl mx-auto">
                                    <button
                                        type="button"
                                        onClick={retakePhoto}
                                        disabled={isMarkingCheckpoint}
                                        className="flex-1 px-6 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-base transition-all flex items-center justify-center gap-2.5 backdrop-blur-md hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50"
                                    >
                                        <RotateCcw size={18} /> Retake
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onConfirmClick}
                                        disabled={isMarkingCheckpoint || !isGpsReady}
                                        className="flex-1 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                    >
                                        {isMarkingCheckpoint ? (
                                            <>
                                                <RefreshCw size={18} className="animate-spin" /> Recording...
                                            </>
                                        ) : (
                                            <>
                                                Confirm Checkpoint <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )
                        ) : (
                            /* SELFIE DISABLED - Clean Confirm Button (Zero Camera Capture) */
                            <div className="flex w-full gap-4 px-2 max-w-lg sm:max-w-xl mx-auto">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isMarkingCheckpoint}
                                    className="flex-1 px-6 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-sm sm:text-base transition-all cursor-pointer backdrop-blur-md active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirmClick}
                                    disabled={isMarkingCheckpoint || !isGpsReady}
                                    className="flex-1 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                >
                                    {isMarkingCheckpoint ? (
                                        <>
                                            <RefreshCw size={18} className="animate-spin" /> Recording Checkpoint...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={18} strokeWidth={3} /> Confirm Checkpoint
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CheckpointModal;

