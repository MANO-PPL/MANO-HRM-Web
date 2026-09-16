import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import {
    RefreshCw,
    AlertCircle,
    X,
    Camera,
    RotateCcw,
    CheckCircle2,
    Check
} from 'lucide-react';
import { requestCameraAccess } from '../../../utils/permissionUtils';

// Clean text-only presets for quick selection without icon clutter
const QUICK_NOTE_PRESETS = [
    'Site Visit',
    'Client Meeting',
    'Field Work',
    'Shift Patrol',
    'In Transit',
    'Floor Rounds'
];

const CheckpointModal = ({
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
            if (handleConfirmSubmit) {
                handleConfirmSubmit(null);
            }
            return;
        }

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

    const isGpsLoading = Boolean(checkpointLocation?.loading);
    const isGpsError = Boolean(checkpointLocation?.error);
    const isGpsReady = Boolean(checkpointLocation?.lat && checkpointLocation?.lng && !isGpsLoading && !isGpsError);

    const handlePresetNote = (preset) => {
        if (!setCheckpointNote) return;
        if (checkpointNote === preset) {
            setCheckpointNote('');
        } else {
            setCheckpointNote(preset);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9000] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center transition-all duration-200">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
                    onClick={() => !isMarkingCheckpoint && handleClose()}
                />

                {/* Dialog Container */}
                <div
                    className={`relative w-full ${
                        requireSelfie ? 'max-w-2xl' : 'max-w-md'
                    } bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-2xl shadow-2xl text-left mx-auto my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
                >
                    {/* Clean Header */}
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#30363d] flex items-center justify-between bg-slate-50/50 dark:bg-[#0d1117]/50">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                Mark Checkpoint
                            </h3>
                            {requireSelfie ? (
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full">
                                    Photo Required
                                </span>
                            ) : (
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    GPS Only
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => !isMarkingCheckpoint && handleClose()}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content Body */}
                    <div className="p-5 space-y-4">
                        {/* VIEW 1: SELFIE REQUIRED (2-Column on desktop) */}
                        {requireSelfie ? (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                {/* Camera Box */}
                                <div className="md:col-span-6 space-y-2">
                                    <div className="relative bg-black rounded-xl overflow-hidden shadow-sm aspect-[4/3] w-full flex items-center justify-center">
                                        {currentImgSrc ? (
                                            <div className="relative w-full h-full">
                                                <img
                                                    src={currentImgSrc}
                                                    alt="Selfie"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute top-2.5 right-2.5 z-10">
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full border border-emerald-500/30">
                                                        <CheckCircle2 size={11} /> Captured
                                                    </span>
                                                </div>
                                                <div className="absolute bottom-2.5 inset-x-0 z-10 flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={retakePhoto}
                                                        disabled={isMarkingCheckpoint}
                                                        className="px-3 py-1 rounded-full bg-black/70 hover:bg-black/90 text-white text-xs font-semibold backdrop-blur-sm border border-white/20 transition-all cursor-pointer disabled:opacity-50"
                                                    >
                                                        Retake Photo
                                                    </button>
                                                </div>
                                            </div>
                                        ) : cameraError ? (
                                            <div className="p-4 text-center space-y-2 max-w-xs">
                                                <p className="text-xs text-slate-200">{cameraError}</p>
                                                <div className="flex items-center justify-center gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={handleRequestCamera}
                                                        disabled={isRequestingCam}
                                                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                                                    >
                                                        Enable Camera
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCameraError(null)}
                                                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs cursor-pointer"
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
                                                        const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
                                                        setCameraError(isDenied ? "Camera access was blocked." : "Camera unavailable.");
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                                                    className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all cursor-pointer"
                                                    title="Switch Camera"
                                                >
                                                    <RotateCcw size={13} />
                                                </button>
                                                <div className="absolute bottom-3 inset-x-0 z-10 flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={capturePhoto}
                                                        className="px-4 py-1.5 rounded-full bg-white hover:bg-slate-100 text-amber-600 shadow-md font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95"
                                                    >
                                                        <Camera size={14} /> Snap Photo
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Form Details (Right) */}
                                <div className="md:col-span-6 space-y-3">
                                    {/* Flat Location Card */}
                                    <div className="p-3 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl space-y-1.5">
                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                            Location
                                        </span>

                                        {isGpsLoading ? (
                                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs py-1">
                                                <RefreshCw size={12} className="animate-spin shrink-0" />
                                                <span>Acquiring coordinates...</span>
                                            </div>
                                        ) : isGpsError ? (
                                            <div className="text-rose-500 text-xs flex items-center gap-1.5">
                                                <AlertCircle size={13} className="shrink-0" />
                                                <span>{checkpointLocation.error}</span>
                                            </div>
                                        ) : (
                                            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                                                {checkpointLocation?.address || "Address captured"}
                                            </p>
                                        )}
                                    </div>

                                    {/* Quick Purpose Chips */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                            Quick Purpose
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {QUICK_NOTE_PRESETS.map((label) => {
                                                const isSelected = checkpointNote === label;
                                                return (
                                                    <button
                                                        key={label}
                                                        type="button"
                                                        onClick={() => handlePresetNote(label)}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-amber-500 text-white font-semibold'
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                        }`}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Note Input */}
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                            Note <span className="text-slate-400 font-normal lowercase">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={checkpointNote || ''}
                                            onChange={(e) => setCheckpointNote && setCheckpointNote(e.target.value)}
                                            placeholder="Add remarks or activity..."
                                            maxLength={120}
                                            disabled={isMarkingCheckpoint}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-white placeholder-slate-400 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* VIEW 2: GPS ONLY (Flat, clean, professional layout) */
                            <div className="space-y-3.5">
                                {/* Single Flat Location Card */}
                                <div className="p-3 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl space-y-1.5">
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                        Device GPS Location
                                    </span>

                                    {isGpsLoading ? (
                                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs py-1.5">
                                            <RefreshCw size={13} className="animate-spin shrink-0" />
                                            <span>Locating device coordinates...</span>
                                        </div>
                                    ) : isGpsError ? (
                                        <div className="text-rose-500 text-xs py-1 flex items-center gap-1.5 font-medium">
                                            <AlertCircle size={14} className="shrink-0" />
                                            <span>{checkpointLocation.error}</span>
                                        </div>
                                    ) : (
                                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">
                                            {checkpointLocation?.address || "Address detected"}
                                        </p>
                                    )}
                                </div>

                                {/* Clean Quick Purpose Chips */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                        Quick Purpose
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUICK_NOTE_PRESETS.map((label) => {
                                            const isSelected = checkpointNote === label;
                                            return (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => handlePresetNote(label)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-amber-500 text-white font-semibold shadow-xs'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Note Field */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                        Note <span className="text-slate-400 font-normal lowercase">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={checkpointNote || ''}
                                        onChange={(e) => setCheckpointNote && setCheckpointNote(e.target.value)}
                                        placeholder="Add notes or remarks..."
                                        maxLength={120}
                                        disabled={isMarkingCheckpoint}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-white placeholder-slate-400 text-xs sm:text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-[#30363d] bg-slate-50/50 dark:bg-[#0d1117]/50 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isMarkingCheckpoint}
                            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={onConfirmClick}
                            disabled={isMarkingCheckpoint || isGpsLoading || !isGpsReady}
                            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/15 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {isMarkingCheckpoint ? (
                                <>
                                    <RefreshCw size={13} className="animate-spin" /> Recording...
                                </>
                            ) : isGpsLoading ? (
                                <>
                                    <RefreshCw size={13} className="animate-spin" /> Locating...
                                </>
                            ) : requireSelfie && !currentImgSrc ? (
                                <>
                                    <Camera size={13} /> Snap & Confirm
                                </>
                            ) : (
                                <>
                                    <Check size={14} strokeWidth={2.5} /> Confirm Checkpoint
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CheckpointModal;
