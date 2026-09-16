import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Edit2, User, CheckCircle2, FileText, Sparkles, Award
} from 'lucide-react';
import ProfileTab from './tabs/ProfileTab';
import ChecklistTab from './tabs/ChecklistTab';
import DocumentsTab from './tabs/DocumentsTab';
import AiVerificationTab from './tabs/AiVerificationTab';
import { PerformanceHub, AiPerformanceAnalyzer } from '../performance/PerformanceViews';

const EmployeeProfileDrawer = ({
    selectedEmployee,
    onClose,
    drawerTab,
    setDrawerTab,
    editMode,
    setEditMode,
    avatarTimestamp,
    currentUser,
    handleFormSuccess,
    // Templates & Onboarding
    checklistTemplates = [],
    documentTemplates = [],
    onboardingData = {},
    handleChecklistTemplateChange,
    handleDocumentTemplateChange,
    handleRestoreChecklistExclusions,
    handleChecklistToggle,
    handleExcludeChecklistItem,
    // Documents
    bulkSelectMode,
    setBulkSelectMode,
    selectedDocIdsForZip = [],
    setSelectedDocIdsForZip,
    handleDownloadZip,
    handleRestoreDocExclusions,
    handleViewDocument,
    handleVerifyDocument,
    handleDeleteDocument,
    handleDirectDocumentUpload,
    handleExcludeDocItem,
    // AI Verification
    activeOcrDoc,
    setActiveOcrDoc,
    runAiVerification,
    isVerifying,
    handleRevokeOverride,
    overridingDiscrepancyId,
    setOverridingDiscrepancyId,
    overrideReasonText,
    setOverrideReasonText,
    handleOverrideDiscrepancy,
    // Performance Hub & Cycles
    cycles = [],
    selectedCycleId,
    setSelectedCycleId
}) => {
    return (
        <AnimatePresence>
            {selectedEmployee && (
                <>
                    {/* Backdrop overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
                    />

                    {/* Slider Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="fixed right-0 top-0 h-full w-full max-w-[950px] z-50 bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                    {selectedEmployee.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text leading-tight">
                                        {selectedEmployee.name}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 dark:text-github-dark-muted font-mono">
                                        {selectedEmployee.user_code} • {selectedEmployee.designation}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {drawerTab === 'profile' && !editMode && (
                                    <button
                                        onClick={() => setEditMode(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-github-dark-border bg-white dark:bg-github-dark-subtle hover:bg-slate-50 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400"
                                    >
                                        <Edit2 size={13} />
                                        <span>Edit Profile</span>
                                    </button>
                                )}

                                <button
                                    onClick={onClose}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Drawer Navigation Tabs */}
                        <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-none border-b border-slate-100 dark:border-github-dark-border text-xs bg-slate-50/50 dark:bg-github-dark-subtle/10 px-2">
                            {[
                                { id: 'profile', label: 'Profile Information', icon: <User size={14} /> },
                                { type: 'separator' },
                                { id: 'checklist', label: 'Onboarding Checklist', icon: <CheckCircle2 size={14} /> },
                                { id: 'documents', label: 'Document Files', icon: <FileText size={14} /> },
                                { id: 'ai_verify', label: 'AI Auditor', icon: <Sparkles size={14} /> },
                                { type: 'separator' },
                                { id: 'perf_hub', label: 'Performance Hub', icon: <Award size={14} /> },
                                { id: 'perf_analyzer', label: 'AI Performance', icon: <Sparkles size={14} /> }
                            ].map((tab, idx) => {
                                if (tab.type === 'separator') {
                                    return <div key={`sep-${idx}`} className="h-4 w-[1px] bg-slate-200 dark:bg-github-dark-border mx-1 shrink-0" />;
                                }
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setDrawerTab(tab.id); setEditMode(false); }}
                                        className={`flex items-center gap-1.5 px-4 py-3 border-b-2 font-semibold transition-all shrink-0 ${
                                            drawerTab === tab.id
                                                ? 'border-[#0969da] text-[#0969da] dark:border-github-dark-accent dark:text-[#f0f6fc]'
                                                : 'border-transparent text-slate-500 hover:text-slate-850 dark:text-github-dark-muted dark:hover:text-slate-200'
                                        }`}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Drawer Body Container */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar text-xs">
                            {/* 1. Profile Information Tab */}
                            {drawerTab === 'profile' && (
                                <ProfileTab
                                    selectedEmployee={selectedEmployee}
                                    editMode={editMode}
                                    setEditMode={setEditMode}
                                    avatarTimestamp={avatarTimestamp}
                                    handleFormSuccess={handleFormSuccess}
                                    checklistTemplates={checklistTemplates}
                                    documentTemplates={documentTemplates}
                                    handleChecklistTemplateChange={handleChecklistTemplateChange}
                                    handleDocumentTemplateChange={handleDocumentTemplateChange}
                                />
                            )}

                            {/* 2. Onboarding Checklist Tab */}
                            {drawerTab === 'checklist' && (
                                <ChecklistTab
                                    selectedEmployee={selectedEmployee}
                                    onboardingData={onboardingData}
                                    checklistTemplates={checklistTemplates}
                                    handleChecklistTemplateChange={handleChecklistTemplateChange}
                                    handleRestoreChecklistExclusions={handleRestoreChecklistExclusions}
                                    handleChecklistToggle={handleChecklistToggle}
                                    handleExcludeChecklistItem={handleExcludeChecklistItem}
                                />
                            )}

                            {/* 3. Document Files Tab */}
                            {drawerTab === 'documents' && (
                                <DocumentsTab
                                    selectedEmployee={selectedEmployee}
                                    onboardingData={onboardingData}
                                    documentTemplates={documentTemplates}
                                    currentUser={currentUser}
                                    bulkSelectMode={bulkSelectMode}
                                    setBulkSelectMode={setBulkSelectMode}
                                    selectedDocIdsForZip={selectedDocIdsForZip}
                                    setSelectedDocIdsForZip={setSelectedDocIdsForZip}
                                    handleDocumentTemplateChange={handleDocumentTemplateChange}
                                    handleDownloadZip={handleDownloadZip}
                                    handleRestoreDocExclusions={handleRestoreDocExclusions}
                                    handleViewDocument={handleViewDocument}
                                    handleVerifyDocument={handleVerifyDocument}
                                    handleDeleteDocument={handleDeleteDocument}
                                    handleDirectDocumentUpload={handleDirectDocumentUpload}
                                    handleExcludeDocItem={handleExcludeDocItem}
                                />
                            )}

                            {/* 4. AI Auditor Tab */}
                            {drawerTab === 'ai_verify' && (
                                <AiVerificationTab
                                    selectedEmployee={selectedEmployee}
                                    activeOcrDoc={activeOcrDoc}
                                    setActiveOcrDoc={setActiveOcrDoc}
                                    runAiVerification={runAiVerification}
                                    isVerifying={isVerifying}
                                    handleRevokeOverride={handleRevokeOverride}
                                    overridingDiscrepancyId={overridingDiscrepancyId}
                                    setOverridingDiscrepancyId={setOverridingDiscrepancyId}
                                    overrideReasonText={overrideReasonText}
                                    setOverrideReasonText={setOverrideReasonText}
                                    handleOverrideDiscrepancy={handleOverrideDiscrepancy}
                                />
                            )}

                            {/* 5. Performance Hub Tab */}
                            {drawerTab === 'perf_hub' && (() => {
                                const empType = selectedEmployee?.profile?.employment_type || 'Full-time';
                                const filteredCycles = cycles.filter(c => {
                                    if (!c.targetEmployeeType || c.targetEmployeeType === 'All') return true;
                                    return c.targetEmployeeType.toLowerCase() === empType.toLowerCase();
                                });
                                const activeCycleId = filteredCycles.some(c => c.id === selectedCycleId) ? selectedCycleId : (filteredCycles[0]?.id || '');

                                return (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-github-dark-subtle/25 p-3 rounded-lg border border-slate-200 dark:border-github-dark-border mb-4">
                                            <span className="font-bold text-slate-700 dark:text-github-dark-text">Select Performance Cycle</span>
                                            <select
                                                value={activeCycleId}
                                                onChange={(e) => setSelectedCycleId(e.target.value)}
                                                className="px-2.5 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded text-xs focus:outline-none cursor-pointer font-semibold"
                                            >
                                                {filteredCycles.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} ({c.type} - {c.status})</option>
                                                ))}
                                            </select>
                                        </div>
                                        {activeCycleId ? (
                                            <PerformanceHub employee={selectedEmployee} selectedCycleId={activeCycleId} />
                                        ) : (
                                            <div className="p-8 text-center text-slate-400 italic">
                                                No appraisal cycles configured targeting {empType} employees. Configure appraisal cycles in templates settings.
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* 6. AI Performance Analyzer Tab */}
                            {drawerTab === 'perf_analyzer' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-github-dark-subtle/25 p-3 rounded-lg border border-slate-200 dark:border-github-dark-border mb-4">
                                        <span className="font-bold text-slate-700 dark:text-github-dark-text">Select Performance Cycle</span>
                                        <select
                                            value={selectedCycleId}
                                            onChange={(e) => setSelectedCycleId(e.target.value)}
                                            className="px-2.5 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded text-xs focus:outline-none"
                                        >
                                            {cycles.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <AiPerformanceAnalyzer employee={selectedEmployee} selectedCycleId={selectedCycleId} />
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer Actions */}
                        <div className="p-4 border-t border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 flex gap-3 text-xs">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-3 font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
                            >
                                Dismiss Drawer
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default EmployeeProfileDrawer;
