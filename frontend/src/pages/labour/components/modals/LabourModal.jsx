import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import MinimalSelect from '../../../../components/MinimalSelect';

const LabourModal = ({
    showLabourModal,
    setShowLabourModal,
    editingLabour,
    labourForm,
    setLabourForm,
    handleSaveLabour,
    sites
}) => {
    return createPortal(
        <AnimatePresence>
            {showLabourModal && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowLabourModal(false)}
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
                                    {editingLabour ? 'Edit Labour Profile' : 'Add New Labour Worker'}
                                </h4>
                                <p className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted mt-0.5 tracking-wider uppercase">Worker Configuration Profile</p>
                            </div>
                            <button onClick={() => setShowLabourModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSaveLabour} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Labour Full Name</label>
                                <input
                                    type="text"
                                    value={labourForm.name}
                                    onChange={(e) => setLabourForm({ ...labourForm, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    required
                                    placeholder="e.g., Ramesh Kumar"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Contact Phone</label>
                                <input
                                    type="tel"
                                    value={labourForm.phone}
                                    onChange={(e) => setLabourForm({ ...labourForm, phone: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    placeholder="10-digit mobile number"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Sex</label>
                                <MinimalSelect
                                    value={labourForm.sex}
                                    onChange={(val) => setLabourForm({ ...labourForm, sex: val })}
                                    options={[
                                        { value: 'Male', label: 'Male' },
                                        { value: 'Female', label: 'Female' },
                                        { value: 'Other', label: 'Other' }
                                    ]}
                                    triggerClassName="w-full justify-between"
                                    variant="input"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Role</label>
                                <input
                                    type="text"
                                    value={labourForm.role}
                                    onChange={(e) => setLabourForm({ ...labourForm, role: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    required
                                    placeholder="e.g., Mason, Carpenter, Helper"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Assign Construction Site</label>
                                <MinimalSelect
                                    value={labourForm.site_id}
                                    onChange={(val) => setLabourForm({ ...labourForm, site_id: val })}
                                    options={[
                                        { value: '', label: 'Unassigned / Independent' },
                                        ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                    ]}
                                    triggerClassName="w-full justify-between"
                                    variant="input"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Daily Wage (INR)</label>
                                <input
                                    type="number"
                                    value={labourForm.monthly_salary}
                                    onChange={(e) => setLabourForm({ ...labourForm, monthly_salary: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    required
                                    min="0"
                                    placeholder="e.g., 600"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Overtime Pay (per hour)</label>
                                <input
                                    type="number"
                                    value={labourForm.overtime_pay_per_hour}
                                    onChange={(e) => setLabourForm({ ...labourForm, overtime_pay_per_hour: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    required
                                    min="0"
                                    placeholder="e.g., 100"
                                />
                            </div>
                            {editingLabour && (
                                <div>
                                    <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Status</label>
                                    <MinimalSelect
                                        value={labourForm.status}
                                        onChange={(val) => setLabourForm({ ...labourForm, status: val })}
                                        options={[
                                            { value: 'Active', label: 'Active' },
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
                                    onClick={() => setShowLabourModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
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

export default LabourModal;
