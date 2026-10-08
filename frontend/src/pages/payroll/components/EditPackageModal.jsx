import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, X, Check, Shield, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import payrollService from '../../../services/payrollService';

const EditPackageModal = ({ isOpen, onClose, packageData, onPackageUpdated }) => {
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

    // Status
    const [isActive, setIsActive] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (packageData) {
            setName(packageData.name || '');
            setDescription(packageData.description || '');
            setIsActive(packageData.is_active !== 0 && packageData.is_active !== false);

            const rules = packageData.packages_rules || {};
            const lop = rules.lop || {};
            setLopEnabled(lop.enabled !== false);
            setLopBasis(lop.basis || 'gross');
            setLopDayBasis(lop.day_divisor || lop.day_basis || 'calendar_days');

            const ot = rules.ot || {};
            setOtEnabled(ot.enabled !== false);
            setOtHourlyRate(ot.hourly_rate ?? 150);
            setOtMultiplier(ot.multiplier ?? 1.5);
        }
    }, [packageData, isOpen]);

    if (!isOpen || !packageData) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Package name is required.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || null,
                is_active: isActive ? 1 : 0,
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
                }
            };

            const res = await payrollService.updatePackage(packageData.id, payload);
            toast.success(res.message || 'Salary package updated successfully!');
            if (onPackageUpdated) onPackageUpdated(res.data);
            onClose();
        } catch (err) {
            console.error('Failed to update package:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to update package.');
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
                    className="w-full max-w-2xl bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                    Edit Salary Package
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Update package title, description, Loss of Pay & Overtime rules
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
                        <div className="space-y-4">
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
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl">
                                <div>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Package Status</span>
                                    <span className="text-[11px] text-slate-400 block">Inactive packages cannot be assigned to new staff</span>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="text-purple-600 rounded-sm"
                                    />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {isActive ? 'Active' : 'Archived'}
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* 2. Package Rules: LOP & OT */}
                        <div className="p-4 bg-slate-50/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl space-y-4">
                            {/* LOP Policy */}
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
                                        Saving Changes...
                                    </>
                                ) : (
                                    <>
                                        <Check size={14} />
                                        Update Package
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

export default EditPackageModal;
