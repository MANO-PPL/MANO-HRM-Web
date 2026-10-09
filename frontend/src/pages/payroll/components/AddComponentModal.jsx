import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import payrollService from '../../../services/payrollService';

const AddComponentModal = ({ isOpen, onClose, onComponentAdded, packageId, existingComponents = [] }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('earning'); // 'earning' | 'deduction' | 'employer_contribution' | 'benefit'
    const [calcType, setCalcType] = useState('fixed'); // 'fixed' | 'percent_of_component'
    const [value, setValue] = useState('');
    const [baseComponentId, setBaseComponentId] = useState('');
    const [isTaxable, setIsTaxable] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Component name is required.');
            return;
        }
        if (value === '' || isNaN(Number(value))) {
            toast.error('Valid numeric value is required.');
            return;
        }

        if (calcType === 'percent_of_component' && !baseComponentId) {
            toast.error('Please select a base component for the percentage calculation.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                category,
                calc_type: calcType,
                value: Number(value),
                base_component_id: calcType === 'percent_of_component' ? Number(baseComponentId) : null,
                is_taxable: isTaxable ? 1 : 0,
                sort_order: existingComponents.length + 1
            };

            const res = await payrollService.addPackageComponent(packageId, payload);
            toast.success(res.message || 'Component added successfully!');
            if (onComponentAdded) onComponentAdded(res.data);
            onClose();
        } catch (err) {
            console.error('Failed to add component:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to add component.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="w-full max-w-md bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">
                            Add Salary Component
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Component Name *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Conveyance Allowance, PF, Medical"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Category
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs"
                                >
                                    <option value="earning">Earning (+)</option>
                                    <option value="deduction">Deduction (-)</option>
                                    <option value="employer_contribution">Employer Cost</option>
                                    <option value="benefit">Benefit</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Calculation Type
                                </label>
                                <select
                                    value={calcType}
                                    onChange={(e) => setCalcType(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs"
                                >
                                    <option value="fixed">Fixed Amount</option>
                                    <option value="percent_of_component">% of Component</option>
                                </select>
                            </div>
                        </div>

                        {calcType === 'percent_of_component' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Base Component *
                                </label>
                                <select
                                    value={baseComponentId}
                                    onChange={(e) => setBaseComponentId(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs"
                                >
                                    <option value="">-- Choose Base Component --</option>
                                    {existingComponents.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.calc_type === 'fixed' ? `₹${c.value}` : `${c.value}%`})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                {calcType === 'fixed' ? 'Fixed Amount (₹) *' : 'Percentage Value (%) *'}
                            </label>
                            <input
                                type="number"
                                required
                                step="any"
                                placeholder={calcType === 'fixed' ? 'e.g. 5000' : 'e.g. 12'}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                            />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={isTaxable}
                                onChange={(e) => setIsTaxable(e.target.checked)}
                                className="text-purple-600 rounded-sm"
                            />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                Subject to Income Tax (Taxable Component)
                            </span>
                        </label>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={14} />
                                        Add Component
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddComponentModal;
