import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building } from 'lucide-react';
import MinimalSelect from '../../../../components/MinimalSelect';

const BulkTransferModal = ({
    showBulkTransferModal,
    setShowBulkTransferModal,
    bulkSourceSiteId,
    setBulkSourceSiteId,
    bulkDestinationSiteId,
    setBulkDestinationSiteId,
    selectedLabourIds,
    setSelectedLabourIds,
    bulkRoleFilter,
    setBulkRoleFilter,
    sites,
    selectedSite,
    labours,
    handleExecuteBulkTransfer
}) => {
    return createPortal(
        <AnimatePresence>
            {showBulkTransferModal && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowBulkTransferModal(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="relative w-full max-w-xl h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#21262d] z-10"
                    >
                        {/* ── Header ── */}
                        <div className="flex-shrink-0">
                            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 dark:border-[#21262d]">
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc]">Move Workers</h4>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Reassign workers to a different site</p>
                                </div>
                                <button
                                    onClick={() => setShowBulkTransferModal(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleExecuteBulkTransfer} className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* ── Site Selector Cards ── */}
                            <div className="p-5 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    {/* From Site */}
                                    <div className="rounded-xl border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] p-3 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-4 h-4 rounded-full bg-slate-400/20 dark:bg-slate-600/40 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">From Site</span>
                                        </div>
                                        <MinimalSelect
                                            value={bulkSourceSiteId}
                                            onChange={(val) => {
                                                setBulkSourceSiteId(val);
                                                setSelectedLabourIds([]);
                                            }}
                                            options={[
                                                { value: 'All', label: 'All Sites' },
                                                { value: 'Unassigned', label: 'Unassigned' },
                                                ...sites
                                                    .filter(s => !selectedSite || s.site_id !== selectedSite.site_id)
                                                    .map(s => ({ value: String(s.site_id), label: s.site_name }))
                                            ]}
                                            triggerClassName="w-full justify-between text-[11px]"
                                            variant="input"
                                        />
                                    </div>
                                    {/* Move To */}
                                    <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/10 p-3 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-4 h-4 rounded-full bg-indigo-400/20 dark:bg-indigo-600/30 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Move To</span>
                                            </div>
                                            {selectedSite && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">Locked</span>
                                            )}
                                        </div>
                                        {selectedSite ? (
                                            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-indigo-100/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                                                <Building size={11} className="text-indigo-500 flex-shrink-0" />
                                                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 truncate">{selectedSite.site_name}</span>
                                            </div>
                                        ) : (
                                            <MinimalSelect
                                                value={bulkDestinationSiteId}
                                                onChange={(val) => setBulkDestinationSiteId(val)}
                                                options={[
                                                    { value: '', label: '-- Select a Site --' },
                                                    { value: 'Unassigned', label: 'No Site (Independent)' },
                                                    ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                                                ]}
                                                triggerClassName="w-full justify-between text-[11px]"
                                                variant="input"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Divider ── */}
                            <div className="mx-5 h-px bg-slate-100 dark:bg-[#21262d]" />

                            {/* ── Role filter + worker list ── */}
                            <div className="p-5 space-y-3">
                                {/* Role pills */}
                                {(() => {
                                    const sourcedLabours = labours.filter(lab => {
                                        if (bulkSourceSiteId === 'Unassigned') return !lab.site_id;
                                        if (bulkSourceSiteId !== 'All') return (lab.site_ids && lab.site_ids.includes(Number(bulkSourceSiteId))) || lab.site_id === Number(bulkSourceSiteId);
                                        return true;
                                    });
                                    const roles = [...new Map(sourcedLabours.map(l => [(l.role || '').trim().toLowerCase(), (l.role || '').trim()]).filter(([k]) => k)).values()];
                                    return (
                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setBulkRoleFilter('All')}
                                                className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${bulkRoleFilter === 'All'
                                                        ? 'bg-indigo-600 text-white border-transparent shadow-sm shadow-indigo-500/30'
                                                        : 'bg-white dark:bg-[#21262d] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#30363d] hover:border-indigo-300 dark:hover:border-indigo-700'
                                                    }`}
                                            >
                                                All &nbsp;<span className="opacity-70">{sourcedLabours.length}</span>
                                            </button>
                                            {roles.sort().map(role => {
                                                const count = sourcedLabours.filter(l => (l.role || '').trim().toLowerCase() === role.toLowerCase()).length;
                                                const isActive = bulkRoleFilter === role;
                                                return (
                                                    <button
                                                        key={role}
                                                        type="button"
                                                        onClick={() => setBulkRoleFilter(isActive ? 'All' : role)}
                                                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${isActive
                                                                ? 'bg-indigo-600 text-white border-transparent shadow-sm shadow-indigo-500/30'
                                                                : 'bg-white dark:bg-[#21262d] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#30363d] hover:border-indigo-300 dark:hover:border-indigo-700'
                                                            }`}
                                                    >
                                                        {role} &nbsp;<span className="opacity-70">{count}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}

                                {/* List header */}
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Choose workers to move</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const filtered = labours.filter(lab => {
                                                const siteMatch = bulkSourceSiteId === 'Unassigned' ? !lab.site_id
                                                    : bulkSourceSiteId !== 'All' ? ((lab.site_ids && lab.site_ids.includes(Number(bulkSourceSiteId))) || lab.site_id === Number(bulkSourceSiteId))
                                                        : true;
                                                const roleMatch = bulkRoleFilter === 'All' || (lab.role || '').trim().toLowerCase() === bulkRoleFilter.toLowerCase();
                                                return siteMatch && roleMatch;
                                            });
                                            const allSelected = filtered.every(l => selectedLabourIds.includes(l.labour_id));
                                            if (allSelected) {
                                                setSelectedLabourIds(prev => prev.filter(id => !filtered.map(l => l.labour_id).includes(id)));
                                            } else {
                                                setSelectedLabourIds(prev => [...new Set([...prev, ...filtered.map(l => l.labour_id)])]);
                                            }
                                        }}
                                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                                    >
                                        {bulkRoleFilter === 'All' ? 'Select / Remove All' : `Select All ${bulkRoleFilter}s`}
                                    </button>
                                </div>

                                {/* Worker list */}
                                {(() => {
                                    const filtered = labours.filter(lab => {
                                        const siteMatch = bulkSourceSiteId === 'Unassigned' ? !lab.site_id
                                            : bulkSourceSiteId !== 'All' ? ((lab.site_ids && lab.site_ids.includes(Number(bulkSourceSiteId))) || lab.site_id === Number(bulkSourceSiteId))
                                                : true;
                                        const roleMatch = bulkRoleFilter === 'All' || (lab.role || '').trim().toLowerCase() === bulkRoleFilter.toLowerCase();
                                        return siteMatch && roleMatch;
                                    });

                                    if (filtered.length === 0) {
                                        return (
                                            <div className="rounded-xl border border-dashed border-slate-200 dark:border-[#30363d] p-8 text-center">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#21262d] flex items-center justify-center mx-auto mb-2">
                                                    <Building size={18} className="text-slate-400" />
                                                </div>
                                                <p className="text-[11px] text-slate-400 dark:text-slate-500">No workers found for the selected site / job type.</p>
                                            </div>
                                        );
                                    }

                                    const grouped = filtered.reduce((acc, lab) => {
                                        const role = (lab.role || '').trim() || 'No Role';
                                        if (!acc[role]) acc[role] = [];
                                        acc[role].push(lab);
                                        return acc;
                                    }, {});

                                    const roleColorMap = {};
                                    const roleColors = [
                                        'indigo', 'violet', 'emerald', 'amber', 'rose', 'sky', 'teal', 'orange'
                                    ];
                                    Object.keys(grouped).sort().forEach((role, i) => {
                                        roleColorMap[role] = roleColors[i % roleColors.length];
                                    });

                                    const colorClasses = {
                                        indigo: { badge: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50', header: 'from-indigo-500/10 to-transparent dark:from-indigo-500/8', dot: 'bg-indigo-500', avatar: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300' },
                                        violet: { badge: 'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50', header: 'from-violet-500/10 to-transparent dark:from-violet-500/8', dot: 'bg-violet-500', avatar: 'bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300' },
                                        emerald: { badge: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', header: 'from-emerald-500/10 to-transparent dark:from-emerald-500/8', dot: 'bg-emerald-500', avatar: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300' },
                                        amber: { badge: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', header: 'from-amber-500/10 to-transparent dark:from-amber-500/8', dot: 'bg-amber-500', avatar: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300' },
                                        rose: { badge: 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50', header: 'from-rose-500/10 to-transparent dark:from-rose-500/8', dot: 'bg-rose-500', avatar: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300' },
                                        sky: { badge: 'bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/50', header: 'from-sky-500/10 to-transparent dark:from-sky-500/8', dot: 'bg-sky-500', avatar: 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300' },
                                        teal: { badge: 'bg-teal-100 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/50', header: 'from-teal-500/10 to-transparent dark:from-teal-500/8', dot: 'bg-teal-500', avatar: 'bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-300' },
                                        orange: { badge: 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50', header: 'from-orange-500/10 to-transparent dark:from-orange-500/8', dot: 'bg-orange-500', avatar: 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-300' },
                                    };

                                    return (
                                        <div className="space-y-2">
                                            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([role, workers]) => {
                                                const allRoleSelected = workers.every(w => selectedLabourIds.includes(w.labour_id));
                                                const someRoleSelected = workers.some(w => selectedLabourIds.includes(w.labour_id));
                                                const clr = colorClasses[roleColorMap[role]] || colorClasses.indigo;
                                                const selectedCount = workers.filter(w => selectedLabourIds.includes(w.labour_id)).length;
                                                return (
                                                    <div key={role} className="rounded-xl border border-slate-200 dark:border-[#21262d] overflow-hidden">
                                                        {/* Role group header */}
                                                        <div className={`flex items-center justify-between px-3 py-2 bg-gradient-to-r ${clr.header} bg-slate-50 dark:bg-[#161b22] border-b border-slate-100 dark:border-[#21262d]`}>
                                                            <label className="flex items-center gap-2.5 cursor-pointer">
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        if (allRoleSelected) {
                                                                            setSelectedLabourIds(prev => prev.filter(id => !workers.map(w => w.labour_id).includes(id)));
                                                                        } else {
                                                                            setSelectedLabourIds(prev => [...new Set([...prev, ...workers.map(w => w.labour_id)])]);
                                                                        }
                                                                    }}
                                                                    className={`theme-checkbox ${allRoleSelected ? 'checked' : someRoleSelected ? 'indeterminate' : ''}`}
                                                                >
                                                                    {allRoleSelected && (
                                                                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                                            <path d="M1.5 4L4 6.5L8.5 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                        </svg>
                                                                    )}
                                                                    {!allRoleSelected && someRoleSelected && (
                                                                        <div className="w-2 h-0.5 bg-white rounded-full" />
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${clr.dot}`} />
                                                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{role}</span>
                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${clr.badge}`}>{workers.length}</span>
                                                                </div>
                                                            </label>
                                                            {selectedCount > 0 && (
                                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                                                                    {selectedCount} chosen
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* Workers in this role */}
                                                        <div className="divide-y divide-slate-100 dark:divide-[#21262d]/80 bg-white dark:bg-[#0d1117]">
                                                            {workers.map(lab => {
                                                                const isChecked = selectedLabourIds.includes(lab.labour_id);
                                                                const initials = (lab.name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                                                return (
                                                                    <label
                                                                        key={lab.labour_id}
                                                                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all ${isChecked
                                                                                ? 'bg-indigo-50/70 dark:bg-indigo-950/15'
                                                                                : 'hover:bg-slate-50 dark:hover:bg-[#161b22]/60'
                                                                            }`}
                                                                    >
                                                                        {/* Theme Checkbox */}
                                                                        <div className={`theme-checkbox ${isChecked ? 'checked' : ''}`}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isChecked}
                                                                                onChange={(e) => {
                                                                                    if (e.target.checked) {
                                                                                        setSelectedLabourIds(prev => [...prev, lab.labour_id]);
                                                                                    } else {
                                                                                        setSelectedLabourIds(prev => prev.filter(id => id !== lab.labour_id));
                                                                                    }
                                                                                }}
                                                                                className="sr-only"
                                                                            />
                                                                            {isChecked && (
                                                                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                                                    <path d="M1.5 4L4 6.5L8.5 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                                </svg>
                                                                            )}
                                                                        </div>
                                                                        {/* Avatar */}
                                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${clr.avatar}`}>
                                                                            {initials}
                                                                        </div>
                                                                        {/* Info */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={`text-xs font-semibold truncate transition-colors ${isChecked ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-[#f0f6fc]'
                                                                                }`}>{lab.name}</p>
                                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{lab.site_name || 'No Site Assigned'}</p>
                                                                        </div>
                                                                        {isChecked && (
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                                                        )}
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        </form>

                        {/* ── Sticky Action Bar ── */}
                        <div className="flex-shrink-0 p-4 border-t border-slate-100 dark:border-[#21262d] bg-white/90 dark:bg-[#0d1117]/90 backdrop-blur-sm">
                            {selectedLabourIds.length > 0 && (
                                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                                        <span className="text-[9px] font-black text-white">{selectedLabourIds.length}</span>
                                    </div>
                                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                                        {selectedLabourIds.length} worker{selectedLabourIds.length !== 1 ? 's' : ''} selected to move
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkTransferModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#21262d] text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#30363d] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={selectedLabourIds.length === 0}
                                    onClick={handleExecuteBulkTransfer}
                                    className="flex-[2] px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <Building size={13} />
                                    Move {selectedLabourIds.length > 0 ? `${selectedLabourIds.length} ` : ''}Workers
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default BulkTransferModal;
