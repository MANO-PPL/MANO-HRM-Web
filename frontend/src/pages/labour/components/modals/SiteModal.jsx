import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import MinimalSelect from '../../../../components/MinimalSelect';

const SiteModal = ({
    showSiteModal,
    setShowSiteModal,
    editingSite,
    siteForm,
    setSiteForm,
    handleSaveSite
}) => {
    return createPortal(
        <AnimatePresence>
            {showSiteModal && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSiteModal(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                    >
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">
                                    {editingSite ? 'Edit Construction Site' : 'Create Construction Site'}
                                </h4>
                                <p className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted mt-0.5 tracking-wider uppercase">Site Configuration Profile</p>
                            </div>
                            <button onClick={() => setShowSiteModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSaveSite} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar">
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-2">Site Name</label>
                                <input
                                    type="text"
                                    value={siteForm.site_name}
                                    onChange={(e) => setSiteForm({ ...siteForm, site_name: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    required
                                    placeholder="e.g., Phoenix Mall Project"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-2">Location Details / Address</label>
                                <textarea
                                    value={siteForm.location_details}
                                    onChange={(e) => setSiteForm({ ...siteForm, location_details: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    rows={4}
                                    placeholder="Site physical address, gate number, coordinates, or notes."
                                />
                            </div>
                            {editingSite && (
                                <div>
                                    <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-2">Status</label>
                                    <MinimalSelect
                                        value={siteForm.status}
                                        onChange={(val) => setSiteForm({ ...siteForm, status: val })}
                                        options={[
                                            { value: 'Active', label: 'Active' },
                                            { value: 'Completed', label: 'Completed' },
                                            { value: 'Inactive', label: 'Inactive' }
                                        ]}
                                        triggerClassName="w-full justify-between"
                                        variant="input"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                <button
                                    type="button"
                                    onClick={() => setShowSiteModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-all"
                                >
                                    Save
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

export default SiteModal;
