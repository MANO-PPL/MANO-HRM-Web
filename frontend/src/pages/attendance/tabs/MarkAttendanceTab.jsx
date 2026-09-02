import React from 'react';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    LogOut,
    MapPin,
    ChevronRight,
    AlertCircle,
    Calendar as CalendarIcon,
    Plus,
    Clock,
    ArrowUpRight,
    Eye,
    Camera
} from 'lucide-react';
import CustomCalendar from '../../../components/CustomCalendar';
import SessionCheckpointsTimeline from '../components/SessionCheckpointsTimeline';

const MarkAttendanceTab = ({
    globalActiveSession,
    isSubmitting,
    isMarkingCheckpoint,
    cameraMode,
    showCamera,
    handlePunchClick,
    handleOpenCheckpointModal,
    dailySessions,
    isWorkingDayToday,
    missedPunchWarning,
    setCorrDate,
    loadCorrectionDataForDate,
    setActiveTab,
    setSubTab,
    setIsCorrectionDrawerOpen,
    calendarRef,
    showCalendar,
    setShowCalendar,
    selectedDate,
    setSelectedDate,
    formatDateDisplay,
    calendarEvents,
    scrollerDates,
    loading,
    formatTime,
    getStatusStyle,
    calculateDuration,
    setViewerImage
}) => {
    const hasActiveSession = globalActiveSession;
    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Action Buttons & Punch Cards */}
            <div className="flex flex-col gap-6">
                <div data-tour-id="att-session-actions" className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Time In Card */}
                    <button
                        onClick={() => handlePunchClick('IN')}
                        disabled={hasActiveSession || isSubmitting}
                        data-tour-id="att-checkin-btn"
                        className={`group relative p-5 rounded-xl flex items-center justify-between transition-all duration-500 overflow-hidden border-2 cursor-pointer ${hasActiveSession
                            ? 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-white/5 opacity-40 grayscale-[0.5]'
                            : 'bg-white dark:bg-github-dark-subtle border-slate-100 dark:border-white/10 shadow-lg hover:shadow-xl hover:border-emerald-500/30 active:scale-[0.98]'
                            }`}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 ${hasActiveSession
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:rotate-[15deg] group-hover:scale-110 shadow-lg shadow-emerald-500/10'
                                }`}>
                                <ArrowRight size={24} strokeWidth={2.5} />
                            </div>
                            <div className="text-left">
                                <h3 className={`text-xl font-black tracking-tight ${hasActiveSession ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                                    {isSubmitting && cameraMode === 'IN' && !showCamera ? 'Processing...' : 'Time In'}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-wider opacity-60">
                                    {hasActiveSession ? 'Session Active' : 'Start shift for today'}
                                </p>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center transition-all duration-300 group-hover:bg-emerald-500/10 group-hover:text-emerald-500">
                            <ChevronRight size={20} className={hasActiveSession ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'} />
                        </div>
                    </button>

                    {/* Mark Checkpoint Card */}
                    <button
                        onClick={handleOpenCheckpointModal}
                        disabled={!hasActiveSession || isSubmitting || isMarkingCheckpoint}
                        data-tour-id="att-checkpoint-btn"
                        className={`group relative p-5 rounded-xl flex items-center justify-between transition-all duration-500 overflow-hidden border-2 cursor-pointer ${!hasActiveSession
                            ? 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-white/5 opacity-40 grayscale-[0.5]'
                            : 'bg-white dark:bg-github-dark-subtle border-slate-100 dark:border-white/10 shadow-lg hover:shadow-xl hover:border-amber-500/30 active:scale-[0.98]'
                            }`}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 relative ${!hasActiveSession
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 shadow-lg shadow-amber-500/10'
                                }`}>
                                <MapPin size={24} strokeWidth={2.5} className={hasActiveSession ? 'animate-bounce' : ''} />
                                {hasActiveSession && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                                    </span>
                                )}
                            </div>
                            <div className="text-left">
                                <h3 className={`text-xl font-black tracking-tight ${!hasActiveSession ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                                    {isMarkingCheckpoint ? 'Marking...' : 'Mark Checkpoint'}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider opacity-60">
                                        {!hasActiveSession ? 'Requires Active Session' : 'Record Mid-Shift Location'}
                                    </p>
                                    {hasActiveSession && Array.isArray(dailySessions) && dailySessions.some(s => Array.isArray(s.checkpoints) && s.checkpoints.length > 0) && (
                                        <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/20">
                                            {dailySessions.reduce((acc, s) => acc + (Array.isArray(s.checkpoints) ? s.checkpoints.length : 0), 0)} logged
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center transition-all duration-300 group-hover:bg-amber-500/10 group-hover:text-amber-500">
                            <ChevronRight size={20} className={!hasActiveSession ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'} />
                        </div>
                    </button>

                    {/* Time Out Card */}
                    <button
                        onClick={() => handlePunchClick('OUT')}
                        disabled={!hasActiveSession || isSubmitting}
                        className={`group relative p-5 rounded-xl flex items-center justify-between transition-all duration-500 overflow-hidden border-2 cursor-pointer ${!hasActiveSession
                            ? 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-white/5 opacity-40 grayscale-[0.5]'
                            : 'bg-white dark:bg-github-dark-subtle border-slate-100 dark:border-white/10 shadow-lg hover:shadow-xl hover:border-rose-500/30 active:scale-[0.98]'
                            }`}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 ${!hasActiveSession
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:rotate-[-15deg] group-hover:scale-110 shadow-lg shadow-rose-500/10'
                                }`}>
                                <LogOut size={24} strokeWidth={2.5} />
                            </div>
                            <div className="text-left">
                                <h3 className={`text-xl font-black tracking-tight ${!hasActiveSession ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                                    {isSubmitting && cameraMode === 'OUT' && !showCamera ? 'Processing...' : 'Time Out'}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-wider opacity-60">
                                    {!hasActiveSession ? 'No Active Session' : 'End your day'}
                                </p>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center transition-all duration-300 group-hover:bg-rose-500/10 group-hover:text-rose-500">
                            <ChevronRight size={20} className={!hasActiveSession ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'} />
                        </div>
                    </button>
                </div>
            </div>

            {/* Non-Working Day Banner */}
            {!isWorkingDayToday && !globalActiveSession && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-lg shrink-0">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-500">Non-Working Day</p>
                        <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-0.5">
                            Today is not a scheduled working day. Any hours worked today will not be counted towards your regular attendance.
                        </p>
                    </div>
                </div>
            )}

            {/* Missed Punch Banner */}
            {missedPunchWarning && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row gap-4 justify-between items-center animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-lg relative">
                            <AlertCircle size={20} />
                            {missedPunchWarning.dates.length > 1 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {missedPunchWarning.dates.length}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-500">Missed Time Out</p>
                            <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-0.5">
                                You forgot to time out on {missedPunchWarning.dates.join(', ')}. Please submit a correction request or it will be marked absent.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const targetDate = (missedPunchWarning && missedPunchWarning.dates && missedPunchWarning.dates.length > 0)
                                ? missedPunchWarning.dates[0]
                                : selectedDate;
                            setCorrDate(targetDate);
                            loadCorrectionDataForDate(targetDate);
                            setActiveTab('my_attendance');
                            setSubTab('correction');
                            setIsCorrectionDrawerOpen(true);
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                    >
                        Fix Now
                    </button>
                </div>
            )}

            {/* Date Picker Button & Modal */}
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-center items-center gap-4 relative" ref={calendarRef}>
                    <div
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-dark-card py-2.5 px-6 rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border min-w-[200px] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors select-none"
                    >
                        <CalendarIcon size={18} />
                        <span>{formatDateDisplay(selectedDate)}</span>
                    </div>

                    {showCalendar && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 z-[100] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <CustomCalendar
                                selectedDate={selectedDate}
                                onChange={(date) => {
                                    setSelectedDate(date);
                                    setShowCalendar(false);
                                }}
                                onClose={() => setShowCalendar(false)}
                                events={calendarEvents}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Horizontal Date Scroller */}
            <div className="flex gap-4 overflow-x-auto py-6 px-2 no-scrollbar scroll-smooth">
                {scrollerDates.map((date) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const isSelected = dateStr === selectedDate;
                    const isDateToday = dateStr === new Date().toISOString().split('T')[0];
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

                    return (
                        <button
                            key={dateStr}
                            id={isSelected ? "selected-date-btn" : undefined}
                            onClick={() => setSelectedDate(dateStr)}
                            className={`flex flex-col items-center justify-center min-w-[70px] h-24 rounded-xl transition-all duration-500 relative group cursor-pointer ${isSelected
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 transform scale-105 z-10'
                                : 'bg-white dark:bg-github-dark-subtle text-slate-400 dark:text-github-dark-muted border border-slate-100 dark:border-white/5 hover:border-indigo-600/30'
                                }`}
                        >
                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {dayName}
                            </span>
                            <span className="text-xl font-black">{date.getDate()}</span>
                            {isDateToday && !isSelected && <div className="absolute bottom-3 w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></div>}
                            {isSelected && <motion.div layoutId="activeDate" className="absolute -inset-0.5 rounded-xl border-2 border-indigo-600/50" />}
                        </button>
                    );
                })}
            </div>

            {/* Logs Section Header */}
            <div className="pt-8">
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-4">
                        <div className="w-1.5 h-8 bg-indigo-600 rounded-full" />
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                            {isToday ? "Today's Logs" : `Logs for ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </h3>
                    </div>
                    <button
                        onClick={() => {
                            setCorrDate(selectedDate);
                            loadCorrectionDataForDate(selectedDate);
                            setIsCorrectionDrawerOpen(true);
                        }}
                        data-tour-id="att-correction-btn"
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-[10px] tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 rounded-xl hover:shadow-lg transition-all active:scale-95 border border-indigo-100/50 dark:border-indigo-500/20 cursor-pointer"
                    >
                        <Plus size={14} strokeWidth={3} /> Request Correction
                    </button>
                </div>

                {/* Daily Records List */}
                <div className="space-y-4">
                    {loading ? (
                        <p className="text-center text-slate-500 py-10">Loading...</p>
                    ) : dailySessions.length === 0 ? (
                        <p className="text-center text-slate-400 py-10">No attendance records for this date.</p>
                    ) : (
                        dailySessions.map((session, idx) => (
                            <div key={session.attendance_id || session.id} className="bg-white dark:bg-github-dark-subtle p-5 rounded-xl border border-slate-100 dark:border-white/5 shadow-md space-y-6 transition-all hover:shadow-xl">
                                {/* Session Header */}
                                <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-white/5">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                        <div className="p-1.5 bg-slate-50 dark:bg-white/5 rounded-lg">
                                            <Clock size={14} />
                                        </div>
                                        Session #{dailySessions.length - idx}
                                    </span>
                                    <div className="flex flex-col items-end gap-2">
                                        {(() => {
                                            const isSessionOpen = !session.time_out;
                                            const selectedDateStr = selectedDate ? (selectedDate instanceof Date ? selectedDate.toLocaleDateString('en-CA') : String(selectedDate).split('T')[0]) : '';
                                            const todayDateStr = new Date().toLocaleDateString('en-CA');
                                            const isPastDate = Boolean(selectedDateStr && selectedDateStr < todayDateStr);
                                            const isSessionMissed = session.status === 'MISSED_PUNCH' || (isPastDate && isSessionOpen);
                                            const sessionStatus = isSessionMissed ? 'MISSED_PUNCH' : (isSessionOpen ? 'ACTIVE' : 'CLOSED');
                                            const style = getStatusStyle(sessionStatus);
                                            return (
                                                <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm flex items-center gap-2 ${style.bg} ${style.text}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                    {style.label}
                                                </span>
                                            );
                                        })()}
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-50/50 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-slate-100/50 dark:border-white/5">
                                            <Clock size={12} className="text-indigo-500 dark:text-indigo-400 animate-pulse" />
                                            <span>Duration: <span className="font-black text-slate-800 dark:text-white">{session.total_hours || calculateDuration(session.time_in, session.time_out) || 'N/A'}</span></span>
                                        </span>
                                    </div>
                                </div>

                                {/* IN/OUT Sections Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Time In Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                                                <ArrowUpRight size={24} strokeWidth={3} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="block text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest mb-1 opacity-70">Time In</span>
                                                <span className="text-2xl font-black text-slate-800 dark:text-white truncate block tracking-tight">
                                                    {formatTime(session.time_in, session, false)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* In Address */}
                                        <div className="flex items-start gap-3 bg-slate-50/50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100/50 dark:border-white/5">
                                            <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                                {session.time_in_address || 'Address not captured'}
                                            </p>
                                        </div>

                                        {/* In Image */}
                                        <div className="space-y-3 max-w-[280px]">
                                            <div className="flex items-center justify-between px-1">
                                                <p className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest opacity-60">Verification Image</p>
                                                {session.time_in_image && <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">Captured</span>}
                                            </div>
                                            <div
                                                onClick={() => session.time_in_image && setViewerImage(session.time_in_image)}
                                                className="aspect-video rounded-xl overflow-hidden border-2 border-slate-100 dark:border-white/5 group relative shadow-inner cursor-pointer"
                                            >
                                                {session.time_in_image ? (
                                                    <>
                                                        <img src={session.time_in_image} alt="In" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                                            <Eye size={32} className="text-white transform scale-75 group-hover:scale-100 transition-transform duration-300" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300">
                                                            <Camera size={24} />
                                                        </div>
                                                        <span className="text-[9px] font-black text-slate-300 tracking-[0.2em]">No Image</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Time Out Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm">
                                                <LogOut size={24} strokeWidth={3} className="rotate-180" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="block text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest mb-1 opacity-70">Time Out</span>
                                                <span className={`text-2xl font-black truncate block tracking-tight ${session.time_out ? 'text-slate-800 dark:text-white' : 'text-emerald-500 animate-pulse'}`}>
                                                    {session.time_out ? formatTime(session.time_out, session, true) : 'Active Session'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Out Address */}
                                        <div className="flex items-start gap-3 bg-slate-50/50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100/50 dark:border-white/5">
                                            <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                                {session.time_out ? (session.time_out_address || 'Address not captured') : 'Ongoing session...'}
                                            </p>
                                        </div>

                                        {/* Out Image */}
                                        <div className="space-y-3 max-w-[280px]">
                                            <div className="flex items-center justify-between px-1">
                                                <p className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest opacity-60">Verification Image</p>
                                                {session.time_out_image && <span className="text-[9px] font-black text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md">Captured</span>}
                                            </div>
                                            <div
                                                onClick={() => session.time_out_image && setViewerImage(session.time_out_image)}
                                                className="aspect-video rounded-xl overflow-hidden border-2 border-slate-100 dark:border-white/5 group relative shadow-inner cursor-pointer"
                                            >
                                                {session.time_out_image ? (
                                                    <>
                                                        <img src={session.time_out_image} alt="Out" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                                            <Eye size={32} className="text-white transform scale-75 group-hover:scale-100 transition-transform duration-300" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300">
                                                            <Camera size={24} />
                                                        </div>
                                                        <span className="text-[9px] font-black text-slate-300 tracking-[0.2em]">No Image</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Checkpoints Timeline component */}
                                <SessionCheckpointsTimeline
                                    session={session}
                                    formatTime={formatTime}
                                    onOpenCheckpointModal={handleOpenCheckpointModal}
                                    isCurrentDate={isToday}
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default MarkAttendanceTab;
