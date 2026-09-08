import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    X,
    AlertTriangle,
    FileText,
    Activity,
    CheckCircle,
    Users
} from 'lucide-react';

const AiSummaryModal = ({
    isOpen,
    onClose,
    aiSummaryLoading,
    aiSummaryError,
    aiSummaryData,
    localAnalytics = { presentRate: 0, lateRate: 0 },
    selectedDate,
    generateAiSummary
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div key="ai-panel-wrapper" className="fixed inset-0 z-[10000] flex justify-end">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
                    />

                    {/* Sidebar Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full sm:w-[80vw] md:w-[60vw] lg:w-[50vw] bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-github-dark-border flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between bg-white dark:bg-[#0d1117] sticky top-0 z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-md">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-800 dark:text-github-dark-text tracking-tight flex items-center gap-2">
                                        AI Attendance Insights
                                        {aiSummaryLoading && (
                                            <span className="flex h-2 w-2 relative ml-1">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted font-normal">
                                        Generated for {selectedDate}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50 dark:bg-[#0d1117]">
                            {aiSummaryError && !aiSummaryLoading ? (
                                <div className="flex flex-col items-center justify-center h-64 text-center">
                                    <AlertTriangle size={48} className="text-rose-500 mb-4 opacity-80" />
                                    <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Analysis Failed</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{aiSummaryError}</p>
                                    <button
                                        onClick={generateAiSummary}
                                        className="mt-6 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : aiSummaryLoading && !aiSummaryData ? (
                                <div className="space-y-6">
                                    {/* Skeletons */}
                                    <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                    </div>
                                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                </div>
                            ) : aiSummaryData ? (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Overall Summary */}
                                    <div className="p-5 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm">
                                        <h4 className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-3 flex items-center gap-2">
                                            <FileText size={14} className="text-indigo-500" /> Executive Summary
                                        </h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                                            {aiSummaryData.overall_summary}
                                        </p>
                                    </div>

                                    {/* Key Insights Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                            <h4 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Present Rate</h4>
                                            <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                                                {localAnalytics.presentRate}%
                                            </div>
                                        </div>
                                        <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-500/20">
                                            <h4 className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Late Rate</h4>
                                            <div className="text-2xl font-semibold text-amber-700 dark:text-amber-300">
                                                {localAnalytics.lateRate}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Highlights */}
                                    {aiSummaryData.analytics_insights && aiSummaryData.analytics_insights.highlights && aiSummaryData.analytics_insights.highlights.length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-3 flex items-center gap-2">
                                                <Activity size={14} className="text-indigo-500" /> Key Observations
                                            </h4>
                                            <div className="space-y-2">
                                                {aiSummaryData.analytics_insights.highlights.map((highlight, idx) => (
                                                    <div key={idx} className="flex gap-3 p-3 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm">
                                                        <div className="mt-0.5">
                                                            <CheckCircle size={16} className="text-emerald-500" />
                                                        </div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug font-normal">{highlight}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Notable Employees */}
                                    {aiSummaryData && (aiSummaryData.absent_employees?.length > 0 || aiSummaryData.present_employees?.length > 0) && (
                                        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-github-dark-border">
                                            <h4 className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-3 flex items-center gap-2">
                                                <Users size={14} className="text-indigo-500" /> Attendance Breakdown
                                            </h4>

                                            {aiSummaryData.present_employees && aiSummaryData.present_employees.length > 0 && (
                                                <div className="mb-4">
                                                    <h5 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">Present ({aiSummaryData.present_employees.length})</h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        {aiSummaryData.present_employees.map((emp, i) => (
                                                            <div key={i} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-md flex items-center gap-2">
                                                                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{emp.name}</span>
                                                                <span className="text-[10px] text-emerald-600/80 font-normal">{emp.department}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {aiSummaryData.absent_employees && aiSummaryData.absent_employees.length > 0 && (
                                                <div className="mb-4">
                                                    <h5 className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-2">Absences ({aiSummaryData.absent_employees.length})</h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        {aiSummaryData.absent_employees.map((emp, i) => (
                                                            <div key={i} className="px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-md flex items-center gap-2">
                                                                <span className="text-xs font-medium text-rose-700 dark:text-rose-400">{emp.name}</span>
                                                                <span className="text-[10px] text-rose-600/80 font-normal">{emp.department}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {aiSummaryData.present_employees && aiSummaryData.present_employees.filter(e => e.note).length > 0 && (
                                                <div>
                                                    <h5 className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-2">Notes</h5>
                                                    <div className="space-y-2">
                                                        {aiSummaryData.present_employees.filter(e => e.note).map((emp, i) => (
                                                            <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{emp.name}</span>
                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{emp.department}</span>
                                                                </div>
                                                                <div className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded">
                                                                    {emp.note}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AiSummaryModal;
