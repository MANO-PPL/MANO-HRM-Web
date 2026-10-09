import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, RefreshCw, Edit3 } from 'lucide-react';
import { toast } from 'react-toastify';
import payrollService from '../../../services/payrollService';

const EditComponentModal = ({ isOpen, onClose, packageId, component, existingComponents = [], onComponentUpdated }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('earning');
    const [calcType, setCalcType] = useState('fixed');
    const [value, setValue] = useState('');
    const [baseComponentId, setBaseComponentId] = useState('');
    const [isTaxable, setIsTaxable] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (component) {
            setName(component.name || '');
            setCategory(component.category || 'earning');
            setCalcType(component.calc_type || 'fixed');
            setValue(component.value !== undefined ? String(component.value) : '');
            setBaseComponentId(component.base_component_id ? String(component.base_component_id) : '');
            setIsTaxable(component.is_taxable !== 0 && component.is_taxable !== false);
        }
    }, [component, isOpen]);

    if (!isOpen || !component) return null;

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
                is_taxable: isTaxable ? 1 : 0
            };

            const res = await payrollService.updatePackageComponent(packageId, component.id, payload);
            toast.success(res.message || 'Component updated successfully!');
            if (onComponentUpdated) onComponentUpdated(res.data);
            onClose();
        } catch (err) {
            console.error('Failed to update component:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to update component.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const eligibleBaseComponents = existingComponents.filter(c => c.id !== component.id);

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
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                                <Edit3 size={16} />
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                Edit Salary Component
                            </h3>
                        </div>
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
                                placeholder="e.g. Basic Salary, HRA"
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
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                                >
                                    <option value="earning">Earning (+)</option>
                                    <option value="deduction">Deduction (-)</option>
                                    <option value="employer_contribution">Employer Cost</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Calculation Type
                                </label>
                                <select
                                    value={calcType}
                                    onChange={(e) => setCalcType(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                                >
                                    <option value="fixed">Fixed Amount</option>
                                    <option value="percent_of_component">% of Base Component</option>
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
                                    className="w-full px-3 py-2 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/30 rounded-xl text-xs text-purple-700 dark:text-purple-300 font-medium"
                                >
                                    <option value="">-- Choose Base Component --</option>
                                    {eligibleBaseComponents.map(c => (
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
                                placeholder={calcType === 'fixed' ? 'e.g. 15000' : 'e.g. 40'}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
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
                                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check size={13} />
                                        Save Changes
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

export default EditComponentModal;
