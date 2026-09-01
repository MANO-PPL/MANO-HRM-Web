import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import MinimalSelect from '../../../../components/MinimalSelect';

const SiteClosurePromptModal = ({
    showSiteClosurePrompt,
    setShowSiteClosurePrompt,
    closureSiteName,
    siteStatusToSave,
    closureLabours,
    closureDestinationSiteId,
    setClosureDestinationSiteId,
    closureSiteId,
    sites,
    handleConfirmSiteClosure
}) => {
    return createPortal(
        <AnimatePresence>
            {showSiteClosurePrompt && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSiteClosurePrompt(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                    >
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-github-dark-border bg-amber-500/10 text-amber-800 dark:text-amber-400">
                            <div className="flex items-center gap-1.5">
                                <AlertTriangle size={18} />
                                <h4 className="font-bold text-sm uppercase tracking-wider">Site Closure Reassignment</h4>
                            </div>
                            <button onClick={() => setShowSiteClosurePrompt(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleConfirmSiteClosure} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                            <div className="text-slate-600 dark:text-slate-500 dark:text-github-dark-muted space-y-2">
                                <p>
                                    You are marking the site <strong>{closureSiteName}</strong> as <strong>{siteStatusToSave}</strong>.
                                </p>
                                <p>
                                    There are currently <strong>{closureLabours.length} active workers</strong> assigned to this site. Please choose a new construction site to transfer them to:
                                </p>
                            </div>

                            <div>
                                <label className="block text-slate-505 dark:text-slate-300 font-semibold mb-1">Select Destination Site</label>
                                <MinimalSelect
                                    value={closureDestinationSiteId}
                                    onChange={(val) => setClosureDestinationSiteId(val)}
                                    options={[
                                        { value: '', label: 'Leave Unassigned / Independent' },
                                        ...sites
                                            .filter(s => s.site_id !== Number(closureSiteId) && s.status === 'Active')
                                            .map(s => ({ value: String(s.site_id), label: s.site_name }))
                                    ]}
                                    triggerClassName="w-full justify-between"
                                    variant="input"
                                />
                            </div>

                            <div className="border border-slate-200 dark:border-github-dark-border rounded-lg max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-[#161b22]/40 custom-scrollbar">
                                <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Affected Workers:</span>
                                <ul className="list-disc pl-4 space-y-1 font-semibold">
                                    {closureLabours.map(l => (
                                        <li key={l.labour_id} className="text-slate-700 dark:text-slate-300">{l.name} <span className="text-[10px] text-slate-400 font-normal">({l.role})</span></li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                <button
                                    type="button"
                                    onClick={() => setShowSiteClosurePrompt(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-all"
                                >
                                    Transfer & Complete
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default SiteClosurePromptModal;
