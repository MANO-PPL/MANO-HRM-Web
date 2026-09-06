import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import { X, AlertCircle, RefreshCw, Camera, ArrowRight, Lock, ShieldAlert } from 'lucide-react';
import { requestCameraAccess } from '../../../utils/permissionUtils';

const AttendanceCameraModal = ({
    showCamera,
    cameraMode,
    closeCamera,
    myShift,
    imgSrc,
    webcamRef,
    requireLateReason,
    lateReasonMessage,
    lateReasonText,
    setLateReasonText,
    capture,
    retake,
    confirmAttendance,
    isSubmitting
}) => {
    const [cameraError, setCameraError] = useState(null);
    const [isRequestingCam, setIsRequestingCam] = useState(false);

    if (!showCamera) return null;

    const isSelfieRequired = cameraMode === 'IN'
        ? (myShift?.rules?.entry_requirements?.selfie ?? true)
        : (myShift?.rules?.exit_requirements?.selfie ?? false);

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

    return createPortal(
        <div className="fixed inset-0 z-[9000] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center transition-all duration-200">
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity" onClick={closeCamera} />
                <div className="relative w-full max-w-4xl space-y-8 animate-in fade-in zoom-in-95 duration-200 text-left mx-auto">
                    <div className="relative flex justify-center items-center px-4">
                        <h3 className="text-2xl font-bold text-white tracking-tight text-center">
                            {cameraMode === 'IN' ? 'Check In' : 'Check Out'}
                        </h3>
                        <button
                            onClick={closeCamera}
                            className="absolute right-4 p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md cursor-pointer"
                        >
                            <X size={28} />
                        </button>
                    </div>

                    {isSelfieRequired && (
                        <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center aspect-video">
                            {imgSrc ? (
                                <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
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
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    className="w-full h-full object-cover"
                                    videoConstraints={{ facingMode: "user" }}
                                    onUserMediaError={(err) => {
                                        console.warn("Attendance webcam error:", err);
                                        const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
                                        setCameraError(isDenied
                                            ? "Camera permission was blocked in your browser settings."
                                            : (err?.message || "Camera access denied or unavailable."));
                                    }}
                                />
                            )}
                        </div>
                    )}

                    {requireLateReason && (!isSelfieRequired || imgSrc) && (
                        <div className="space-y-3 px-2 w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center gap-2 text-amber-300 bg-amber-900/40 border border-amber-500/30 p-3 rounded-xl mb-4 text-sm font-medium">
                                <AlertCircle size={18} className="shrink-0" />
                                <p>{lateReasonMessage}</p>
                            </div>
                            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                                Please provide a reason
                            </label>
                            <textarea
                                value={lateReasonText}
                                onChange={(e) => setLateReasonText(e.target.value)}
                                placeholder="I got held up in traffic..."
                                className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-slate-400 h-24 resize-none backdrop-blur-md"
                                required
                            />
                        </div>
                    )}

                    <div className="flex justify-center gap-6 pt-2">
                        {!isSelfieRequired ? (
                            <div className="flex w-full gap-4 px-4 max-w-lg mx-auto">
                                <button
                                    onClick={closeCamera}
                                    className="flex-1 px-8 py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-lg transition-all flex items-center justify-center gap-3 backdrop-blur-md hover:scale-[1.02] active:scale-95 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmAttendance}
                                    disabled={isSubmitting}
                                    className="flex-1 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
                                >
                                    {isSubmitting ? '...' : 'Confirm'} <ArrowRight size={22} />
                                </button>
                            </div>
                        ) : !imgSrc ? (
                            cameraError ? (
                                <button
                                    onClick={closeCamera}
                                    className="px-8 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-sm transition-all cursor-pointer backdrop-blur-md"
                                >
                                    Close Camera Modal
                                </button>
                            ) : (
                                <button
                                    onClick={capture}
                                    className="w-24 h-24 rounded-full bg-white text-indigo-600 hover:scale-110 active:scale-95 flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 ring-8 ring-white/20 cursor-pointer"
                                >
                                    <Camera size={40} />
                                </button>
                            )
                        ) : (
                            <div className="flex w-full gap-4 px-4 max-w-lg mx-auto">
                                <button
                                    onClick={retake}
                                    className="flex-1 px-8 py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-lg transition-all flex items-center justify-center gap-3 backdrop-blur-md hover:scale-[1.02] active:scale-95 cursor-pointer"
                                >
                                    <RefreshCw size={22} /> Retake
                                </button>
                                <button
                                    onClick={confirmAttendance}
                                    disabled={isSubmitting}
                                    className="flex-1 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
                                >
                                    {isSubmitting ? '...' : 'Confirm'} <ArrowRight size={22} />
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

export default AttendanceCameraModal;
