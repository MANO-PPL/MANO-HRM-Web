import React from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import { X, AlertCircle, RefreshCw, Camera, ArrowRight } from 'lucide-react';

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
    if (!showCamera) return null;

    const isSelfieRequired = cameraMode === 'IN'
        ? (myShift?.rules?.entry_requirements?.selfie ?? true)
        : (myShift?.rules?.exit_requirements?.selfie ?? false);

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
                            ) : (
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    className="w-full h-full object-cover"
                                    videoConstraints={{ facingMode: "user" }}
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
                            <button
                                onClick={capture}
                                className="w-24 h-24 rounded-full bg-white text-indigo-600 hover:scale-110 active:scale-95 flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 ring-8 ring-white/20 cursor-pointer"
                            >
                                <Camera size={40} />
                            </button>
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
