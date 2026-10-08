import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Check, Globe, RefreshCw, DollarSign, Calculator } from 'lucide-react';
import { toast } from 'react-toastify';
import payrollService from '../../../services/payrollService';

const CURRENCIES = [
    { code: 'INR', label: 'INR (₹) - Indian Rupee' },
    { code: 'USD', label: 'USD ($) - US Dollar' },
    { code: 'EUR', label: 'EUR (€) - Euro' },
    { code: 'GBP', label: 'GBP (£) - British Pound' },
    { code: 'AED', label: 'AED (د.إ) - UAE Dirham' },
    { code: 'SGD', label: 'SGD (S$) - Singapore Dollar' }
];

const FREQUENCIES = [
    { id: 'monthly', label: 'Monthly', desc: 'Paid once per calendar month' },
    { id: 'bi-weekly', label: 'Bi-Weekly', desc: 'Paid every two weeks' },
    { id: 'weekly', label: 'Weekly', desc: 'Paid every week' }
];

const ROUNDING_METHODS = [
    { id: 'nearest', label: 'Round to Nearest', desc: 'e.g., 100.40 → 100, 100.60 → 101' },
    { id: 'up', label: 'Round Up (Ceil)', desc: 'e.g., 100.10 → 101' },
    { id: 'down', label: 'Round Down (Floor)', desc: 'e.g., 100.90 → 100' }
];

const PayrollSettingsModal = ({ isOpen, onClose, onSaved, initialSettings = null }) => {
    const [currency, setCurrency] = useState('INR');
    const [frequency, setFrequency] = useState('monthly');
    const [roundingMethod, setRoundingMethod] = useState('nearest');
    const [roundingPrecision, setRoundingPrecision] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialSettings) {
            setCurrency(initialSettings.currency || 'INR');
            setFrequency(initialSettings.payroll_frequency || 'monthly');
            const rawRounding = initialSettings.rounding_method || 'nearest';
            setRoundingMethod(rawRounding.replace('round_', ''));
            setRoundingPrecision(initialSettings.rounding_precision !== undefined ? Number(initialSettings.rounding_precision) : 0);
        }
    }, [initialSettings, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                currency,
                payroll_frequency: frequency,
                rounding_method: roundingMethod,
                rounding_precision: Number(roundingPrecision)
            };
            const res = await payrollService.updatePayrollSettings(payload);
            toast.success(res.message || 'Payroll settings saved successfully!');
            if (onSaved) onSaved(res.data);
            onClose();
        } catch (err) {
            console.error('Failed to save payroll settings:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                <Settings size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                    Payroll Settings
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Configure core currency, frequency, and rounding rules
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

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-120px)]">
                        {/* Currency */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <DollarSign size={14} className="text-indigo-500" />
                                Base Currency
                            </label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                {CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code} className="dark:bg-slate-800">
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-400 mt-1">
                                Default currency used across packages, calculations, and payslips.
                            </p>
                        </div>

                        {/* Frequency */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <Globe size={14} className="text-indigo-500" />
                                Payroll Frequency
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {FREQUENCIES.map(f => (
                                    <div
                                        key={f.id}
                                        onClick={() => setFrequency(f.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                            frequency === f.id
                                                ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 bg-slate-50/50 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold">{f.label}</span>
                                            {frequency === f.id && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">{f.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rounding Method */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <Calculator size={14} className="text-indigo-500" />
                                Net Salary Rounding Method
                            </label>
                            <div className="space-y-2">
                                {ROUNDING_METHODS.map(r => (
                                    <label
                                        key={r.id}
                                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                            roundingMethod === r.id
                                                ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                                                : 'border-slate-200 dark:border-white/10 hover:bg-slate-50/50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="roundingMethod"
                                            value={r.id}
                                            checked={roundingMethod === r.id}
                                            onChange={() => setRoundingMethod(r.id)}
                                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                                                {r.label}
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                {r.desc}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Rounding Precision */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Rounding Decimal Precision
                            </label>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="roundingPrecision"
                                        value="0"
                                        checked={roundingPrecision === 0}
                                        onChange={() => setRoundingPrecision(0)}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                        0 Decimals (Whole numbers, e.g. ₹50,450)
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="roundingPrecision"
                                        value="2"
                                        checked={roundingPrecision === 2}
                                        onChange={() => setRoundingPrecision(2)}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                        2 Decimals (e.g. ₹50,450.75)
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Saving Settings...
                                    </>
                                ) : (
                                    <>
                                        <Check size={14} />
                                        Save Settings
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

export default PayrollSettingsModal;
