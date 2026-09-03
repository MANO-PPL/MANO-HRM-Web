import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Calendar, Trash2, Edit3, Check, AlertCircle, History, ShieldCheck, Loader2 } from 'lucide-react';
import { labourService } from '../../../services/labourService';
import DatePicker from '../../../components/DatePicker';

export default function WageRevisionModal({ isOpen, onClose, labour, onRevisionUpdated }) {
    const [history, setHistory] = useState([]);
    const [worker, setWorker] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // New Revision Form State
    const [newEffectiveDate, setNewEffectiveDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [newDailyWage, setNewDailyWage] = useState('');
    const [newOvertimePay, setNewOvertimePay] = useState('');
    const [newNotes, setNewNotes] = useState('');

    // Inline Editing State
    const [editingRevisionId, setEditingRevisionId] = useState(null);
    const [editForm, setEditForm] = useState({
        effective_date: '',
        daily_wage: '',
        overtime_pay_per_hour: '',
        notes: ''
    });

    const fetchHistory = async () => {
        if (!labour?.labour_id) return;
        setLoading(true);
        setError(null);
        try {
            const data = await labourService.getLabourWageHistory(labour.labour_id);
            setHistory(data.history || []);
            setWorker(data.worker || labour);
        } catch (err) {
            setError(err.message || 'Failed to load wage history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && labour?.labour_id) {
            fetchHistory();
            setNewDailyWage('');
            setNewOvertimePay('');
            setNewNotes('');
            setEditingRevisionId(null);
            setError(null);
            setSuccessMsg(null);
        }
    }, [isOpen, labour?.labour_id]);

    const handleAddRevision = async (e) => {
        e.preventDefault();
        if (!newDailyWage || isNaN(Number(newDailyWage)) || Number(newDailyWage) < 0) {
            setError('Please enter a valid daily wage');
            return;
        }
        if (!newEffectiveDate) {
            setError('Please select an effective date');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await labourService.addLabourWageRevision(labour.labour_id, {
                effective_date: newEffectiveDate,
                daily_wage: Number(newDailyWage),
                overtime_pay_per_hour: Number(newOvertimePay || 0),
                notes: newNotes.trim() || null
            });
            setSuccessMsg('Wage revision recorded successfully!');
            setNewDailyWage('');
            setNewOvertimePay('');
            setNewNotes('');
            await fetchHistory();
            if (onRevisionUpdated) onRevisionUpdated();
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            setError(err.message || 'Failed to add wage revision');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStartEdit = (rev) => {
        setEditingRevisionId(rev.id);
        setEditForm({
            effective_date: rev.effective_date,
            daily_wage: String(rev.daily_wage),
            overtime_pay_per_hour: String(rev.overtime_pay_per_hour || 0),
            notes: rev.notes || ''
        });
    };

    const handleSaveEdit = async (revisionId) => {
        if (!editForm.daily_wage || isNaN(Number(editForm.daily_wage)) || Number(editForm.daily_wage) < 0) {
            setError('Please enter a valid daily wage');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await labourService.updateLabourWageRevision(revisionId, {
                effective_date: editForm.effective_date,
                daily_wage: Number(editForm.daily_wage),
                overtime_pay_per_hour: Number(editForm.overtime_pay_per_hour || 0),
                notes: editForm.notes.trim() || null
            });
            setEditingRevisionId(null);
            setSuccessMsg('Wage revision updated successfully!');
            await fetchHistory();
            if (onRevisionUpdated) onRevisionUpdated();
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            setError(err.message || 'Failed to update wage revision');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (revisionId) => {
        if (!window.confirm('Are you sure you want to delete this historical wage revision? This will permanently affect calculations for that time window.')) {
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await labourService.deleteLabourWageRevision(revisionId);
            setSuccessMsg('Wage revision removed');
            await fetchHistory();
            if (onRevisionUpdated) onRevisionUpdated();
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            setError(err.message || 'Failed to delete wage revision');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 overflow-hidden">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 260 }}
                    className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/50 dark:bg-[#161b22]/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                                <History size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-[#f0f6fc] flex items-center gap-2">
                                    Wage Revision History
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-[#8b949e]">
                                        {labour?.role || 'Worker'}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-[#8b949e] mt-0.5">
                                    Managing effective-dated wage rates for <strong className="text-slate-700 dark:text-slate-200">{labour?.name}</strong>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#21262d] transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Notification Alerts */}
                    {error && (
                        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                            <ShieldCheck size={16} className="shrink-0" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {/* New Revision Form */}
                        <div className="bg-slate-50 dark:bg-[#161b22]/70 border border-slate-200/80 dark:border-[#30363d] rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Plus size={15} className="text-indigo-600 dark:text-indigo-400" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-[#f0f6fc]">
                                    Record New Wage Revision
                                </h4>
                            </div>

                            <form onSubmit={handleAddRevision} className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                            Effective Date *
                                        </label>
                                        <DatePicker
                                            value={newEffectiveDate}
                                            onChange={(date) => setNewEffectiveDate(date)}
                                            placeholder="Effective Date"
                                            className="w-full text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                            New Daily Wage (₹) *
                                        </label>
                                        <input
                                            type="number"
                                            value={newDailyWage}
                                            onChange={(e) => setNewDailyWage(e.target.value)}
                                            placeholder="e.g. 800"
                                            min="0"
                                            step="any"
                                            required
                                            className="w-full px-3 py-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-900 dark:text-[#f0f6fc] rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                            New OT Pay (₹/hr)
                                        </label>
                                        <input
                                            type="number"
                                            value={newOvertimePay}
                                            onChange={(e) => setNewOvertimePay(e.target.value)}
                                            placeholder="e.g. 100"
                                            min="0"
                                            step="any"
                                            className="w-full px-3 py-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-900 dark:text-[#f0f6fc] rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={newNotes}
                                            onChange={(e) => setNewNotes(e.target.value)}
                                            placeholder="Optional reason / notes (e.g., Annual increment, Role promotion)"
                                            className="w-full px-3 py-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-900 dark:text-[#f0f6fc] rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={14} />
                                                <span>Save Revision</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* History Timeline */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Timeline of Revisions ({history.length})
                                </h4>
                                <span className="text-[10px] text-slate-400">
                                    Past dates calculate wages with their active rate
                                </span>
                            </div>

                            {loading ? (
                                <div className="text-center py-8 text-xs text-slate-400">
                                    Loading wage history...
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-8 bg-slate-50 dark:bg-[#161b22]/40 rounded-xl border border-dashed border-slate-200 dark:border-[#30363d] text-xs text-slate-400">
                                    No historical revisions found. The current base rate is active.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {history.map((rev, index) => {
                                        const isEditing = editingRevisionId === rev.id;
                                        const isCurrent = index === 0;

                                        if (isEditing) {
                                            return (
                                                <div
                                                    key={rev.id}
                                                    className="p-3.5 bg-indigo-500/5 border border-indigo-500/30 rounded-xl space-y-3"
                                                >
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Effective Date</label>
                                                            <DatePicker
                                                                value={editForm.effective_date}
                                                                onChange={(d) => setEditForm({ ...editForm, effective_date: d })}
                                                                className="w-full text-xs"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Daily Wage (₹)</label>
                                                            <input
                                                                type="number"
                                                                value={editForm.daily_wage}
                                                                onChange={(e) => setEditForm({ ...editForm, daily_wage: e.target.value })}
                                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg text-xs focus:outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">OT Pay (₹/hr)</label>
                                                            <input
                                                                type="number"
                                                                value={editForm.overtime_pay_per_hour}
                                                                onChange={(e) => setEditForm({ ...editForm, overtime_pay_per_hour: e.target.value })}
                                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg text-xs focus:outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={editForm.notes}
                                                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                                            placeholder="Notes / Reason"
                                                            className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg text-xs focus:outline-none"
                                                        />
                                                        <button
                                                            onClick={() => handleSaveEdit(rev.id)}
                                                            disabled={submitting}
                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                                                        >
                                                            {submitting ? (
                                                                <>
                                                                    <Loader2 size={13} className="animate-spin" />
                                                                    <span>Saving...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Check size={13} />
                                                                    <span>Save</span>
                                                                </>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingRevisionId(null)}
                                                            className="px-3 py-1.5 bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={rev.id}
                                                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                    isCurrent
                                                        ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-950/10'
                                                        : 'bg-white dark:bg-[#161b22] border-slate-200 dark:border-[#30363d]'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-0.5 p-2 rounded-lg ${isCurrent ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-[#21262d] text-slate-500'}`}>
                                                        <Calendar size={15} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-xs text-slate-900 dark:text-[#f0f6fc]">
                                                                Effective from {rev.effective_date}
                                                            </span>
                                                            {isCurrent && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-[#8b949e]">
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                                ₹{Number(rev.daily_wage).toLocaleString('en-IN')}/day
                                                            </span>
                                                            <span>•</span>
                                                            <span>
                                                                ₹{Number(rev.overtime_pay_per_hour || 0).toLocaleString('en-IN')}/hr OT
                                                            </span>
                                                            {rev.notes && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="italic text-slate-400 text-[11px]">{rev.notes}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 self-end sm:self-center">
                                                    <button
                                                        onClick={() => handleStartEdit(rev)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer"
                                                        title="Edit revision"
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                    {history.length > 1 && (
                                                        <button
                                                            onClick={() => handleDelete(rev.id)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
                                                            title="Delete revision"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end p-4 border-t border-slate-100 dark:border-[#30363d] bg-slate-50/50 dark:bg-[#161b22]/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-700 dark:text-[#f0f6fc] rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
