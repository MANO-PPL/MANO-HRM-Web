import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, X, Plus, Trash2, Check, Shield, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import payrollService from '../../../services/payrollService';

const DEFAULT_COMPONENTS = [
    { name: 'Basic Salary', category: 'earning', calc_type: 'fixed', value: 30000, sort_order: 1 },
    { name: 'House Rent Allowance (HRA)', category: 'earning', calc_type: 'percent_of_component', value: 40, base_component_name: 'Basic Salary', sort_order: 2 },
    { name: 'Special Allowance', category: 'earning', calc_type: 'fixed', value: 10000, sort_order: 3 },
    { name: 'Provident Fund (PF)', category: 'deduction', calc_type: 'percent_of_component', value: 12, base_component_name: 'Basic Salary', sort_order: 4 },
    { name: 'Professional Tax (PT)', category: 'deduction', calc_type: 'fixed', value: 200, sort_order: 5 }
];

const CreatePackageModal = ({ isOpen, onClose, onPackageCreated, isConfigured, onOpenSettings }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    
    // LOP Rules
    const [lopEnabled, setLopEnabled] = useState(true);
    const [lopBasis, setLopBasis] = useState('gross'); // 'gross' | 'basic'
    const [lopDayBasis, setLopDayBasis] = useState('calendar_days'); // 'calendar_days' | 'fixed_26' | 'fixed_30'

    // OT Rules
    const [otEnabled, setOtEnabled] = useState(true);
    const [otHourlyRate, setOtHourlyRate] = useState(150);
    const [otMultiplier, setOtMultiplier] = useState(1.5);

    // Initial Components
    const [components, setComponents] = useState(DEFAULT_COMPONENTS);

    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    // Gate: Check if settings are configured
    if (!isConfigured) {
        return (
            <AnimatePresence>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-md bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center shadow-2xl space-y-4"
                    >
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Payroll Settings Required
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Before creating salary packages, your organization needs to configure its base currency, payroll frequency, and rounding rules.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    onClose();
                                    if (onOpenSettings) onOpenSettings();
                                }}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                            >
                                Configure Settings Now
                            </button>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        );
    }

    const handleAddComponent = () => {
        setComponents([
            ...components,
            {
                name: '',
                category: 'earning',
                calc_type: 'fixed',
                value: '',
                base_component_name: '',
                sort_order: components.length + 1
            }
        ]);
    };

    const handleRemoveComponent = (index) => {
        setComponents(components.filter((_, i) => i !== index));
    };

    const handleComponentChange = (index, field, value) => {
        const updated = [...components];
        if (typeof field === 'object') {
            updated[index] = { ...updated[index], ...field };
        } else {
            updated[index] = { ...updated[index], [field]: value };
        }
        setComponents(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Package name is required.');
            return;
        }

        // Validate that percentage components have a valid base component
        for (const comp of components) {
            if (comp.name.trim() && comp.calc_type === 'percent_of_component') {
                if (!comp.base_component_name) {
                    toast.error(`Please select a base component for "${comp.name}"`);
                    return;
                }
                const baseExists = components.some(
                    c => c !== comp && c.name.trim().toLowerCase() === comp.base_component_name.trim().toLowerCase()
                );
                if (!baseExists) {
                    toast.error(`Base component "${comp.base_component_name}" for "${comp.name}" is missing or renamed.`);
                    return;
                }
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || undefined,
                packages_rules: {
                    lop: {
                        enabled: lopEnabled,
                        basis: lopBasis,
                        day_divisor: lopDayBasis,
                        day_basis: lopDayBasis
                    },
                    ot: {
                        enabled: otEnabled,
                        rate_basis: 'hourly',
                        hourly_rate: Number(otHourlyRate) || 0,
                        multiplier: Number(otMultiplier) || 1.5
                    }
                },
                components: components.filter(c => c.name.trim()).map((c, idx) => ({
                    ...c,
                    value: Number(c.value) || 0,
                    sort_order: idx + 1
                }))
            };

            const res = await payrollService.createPackage(payload);
            toast.success(res.message || 'Salary package created successfully!');
            if (onPackageCreated) onPackageCreated(res.data);
            onClose();
        } catch (err) {
            console.error('Failed to create package:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to create package.');
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
                    className="w-full max-w-3xl bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                    Create Salary Package
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Define contractual compensation, LOP deductions & overtime rules
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Scrollable Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
                        {/* 1. Basic Info */}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Package Title *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Executive Engineering Band A"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Description / Role Note
                                </label>
                                <input
                                    type="text"
                                    placeholder="Optional note about applicability or department"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                />
                            </div>
                        </div>

                        {/* 2. Package Rules: LOP & OT */}
                        <div className="p-4 bg-slate-50/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Shield size={14} className="text-purple-500" />
                                    Loss of Pay (LOP) Deduction Policy
                                </span>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={lopEnabled}
                                        onChange={(e) => setLopEnabled(e.target.checked)}
                                        className="text-purple-600 rounded-sm"
                                    />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enabled</span>
                                </label>
                            </div>

                            {lopEnabled && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Deduction Basis
                                        </label>
                                        <select
                                            value={lopBasis}
                                            onChange={(e) => setLopBasis(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                                        >
                                            <option value="gross">Gross Contractual Salary</option>
                                            <option value="basic">Basic Salary Only</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Day Divisor Method
                                        </label>
                                        <select
                                            value={lopDayBasis}
                                            onChange={(e) => setLopDayBasis(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                                        >
                                            <option value="calendar_days">Calendar Days in Month (28-31)</option>
                                            <option value="fixed_26">Fixed 26 Working Days</option>
                                            <option value="fixed_30">Fixed 30 Days Standard</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Overtime Policy */}
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pt-2 pb-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Clock size={14} className="text-blue-500" />
                                    Overtime Compensation Rate
                                </span>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={otEnabled}
                                        onChange={(e) => setOtEnabled(e.target.checked)}
                                        className="text-blue-600 rounded-sm"
                                    />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enabled</span>
                                </label>
                            </div>

                            {otEnabled && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Base Hourly Rate (₹)
                                        </label>
                                        <input
                                            type="number"
                                            value={otHourlyRate}
                                            onChange={(e) => setOtHourlyRate(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Overtime Multiplier
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={otMultiplier}
                                            onChange={(e) => setOtMultiplier(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. Package Components */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Salary Components Breakdown ({components.length})
                                    </span>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                        Define earnings, deductions, fixed amounts or percentage rules
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddComponent}
                                    className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-xs font-bold text-purple-600 dark:text-purple-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Plus size={14} /> Add Line
                                </button>
                            </div>

                            {/* Table Column Headers */}
                            <div className="hidden sm:grid grid-cols-12 gap-2.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-white/5">
                                <div className="col-span-4">Component Name</div>
                                <div className="col-span-2">Category</div>
                                <div className="col-span-3">Calculation Rule</div>
                                <div className="col-span-2">Amount / %</div>
                                <div className="col-span-1 text-right">Action</div>
                            </div>

                            {/* Component Rows */}
                            <div className="space-y-2">
                                {components.map((c, i) => (
                                    <div
                                        key={i}
                                        className="grid grid-cols-12 gap-2.5 items-center p-2.5 bg-slate-50/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl hover:border-purple-300/80 dark:hover:border-purple-500/30 transition-all"
                                    >
                                        {/* 1. Component Name (4 cols) */}
                                        <div className="col-span-4">
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Basic Salary"
                                                value={c.name}
                                                onChange={(e) => handleComponentChange(i, 'name', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                            />
                                        </div>

                                        {/* 2. Category (2 cols) */}
                                        <div className="col-span-2">
                                            <select
                                                value={c.category}
                                                onChange={(e) => handleComponentChange(i, 'category', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                            >
                                                <option value="earning">Earning (+)</option>
                                                <option value="deduction">Deduction (-)</option>
                                                <option value="employer_contribution">Employer Cost</option>
                                            </select>
                                        </div>

                                        {/* 3. Unified Calculation Rule (3 cols) */}
                                        <div className="col-span-3">
                                            <select
                                                value={c.calc_type === 'percent_of_component' ? (c.base_component_name || '') : 'fixed'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'fixed') {
                                                        handleComponentChange(i, {
                                                            calc_type: 'fixed',
                                                            base_component_name: ''
                                                        });
                                                    } else {
                                                        handleComponentChange(i, {
                                                            calc_type: 'percent_of_component',
                                                            base_component_name: val
                                                        });
                                                    }
                                                }}
                                                className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-colors ${
                                                    c.calc_type === 'percent_of_component'
                                                        ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 font-semibold'
                                                        : 'bg-white dark:bg-dark-card border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <option value="fixed">Fixed Amount (₹)</option>
                                                {components.filter((other, idx) => idx !== i && other.name?.trim()).length > 0 && (
                                                    <optgroup label="Percentage of Component:">
                                                        {components
                                                            .filter((other, idx) => idx !== i && other.name?.trim())
                                                            .map((other, idx) => (
                                                                <option key={idx} value={other.name.trim()}>
                                                                    % of {other.name.trim()}
                                                                </option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>

                                        {/* 4. Value with Currency / % badge (2 cols) */}
                                        <div className="col-span-2 relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500 pointer-events-none">
                                                {c.calc_type === 'percent_of_component' ? '%' : '₹'}
                                            </span>
                                            <input
                                                type="number"
                                                required
                                                step="any"
                                                placeholder="0"
                                                value={c.value}
                                                onChange={(e) => handleComponentChange(i, 'value', e.target.value)}
                                                className="w-full pl-6 pr-2 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                            />
                                        </div>

                                        {/* 5. Delete Action (1 col) */}
                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveComponent(i)}
                                                title="Remove line"
                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10 shrink-0">
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
                                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Creating Package...
                                    </>
                                ) : (
                                    <>
                                        <Check size={14} />
                                        Create Package
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

export default CreatePackageModal;
