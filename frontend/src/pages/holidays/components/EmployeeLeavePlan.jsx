import React from 'react';
import { Loader2, BookOpen, Shield } from 'lucide-react';

const EmployeeLeavePlan = ({
    policies = [],
    loadingPolicies = false,
    selectedYear,
    myBalances = []
}) => {
    return (
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-github-dark-text">My Leave Plan & Balances</h4>
                </div>
                <span className="text-[10px] font-medium text-slate-400 dark:text-github-dark-muted">Calendar Year {selectedYear}</span>
            </div>

            {loadingPolicies ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="animate-spin text-indigo-500" size={24} />
                </div>
            ) : policies.filter(p => p.is_active).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 px-6">
                    <BookOpen size={36} className="mb-3 opacity-20" />
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">No leave plan assigned yet</p>
                    <p className="text-[11px] mt-1 max-w-xs text-slate-400 font-normal">Contact your HR team to get a leave plan assigned to you.</p>
                </div>
            ) : (
                <div className="p-5 space-y-6">
                    {policies.filter(p => p.is_active).map(policy => (
                        <div key={policy.lp_id} className="space-y-4">
                            {/* Policy name badge */}
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                    <Shield size={14} />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm text-slate-800 dark:text-github-dark-text">{policy.name}</p>
                                    {policy.description && <p className="text-[10px] text-slate-400 dark:text-github-dark-muted font-normal">{policy.description}</p>}
                                </div>
                            </div>

                            {/* Horizontal rule cards */}
                            {policy.rules && policy.rules.length > 0 ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {policy.rules.map((rule, idx) => {
                                        const palettes = [
                                            { hex: '#6366f1', badgeClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' },
                                            { hex: '#f43f5e', badgeClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' },
                                            { hex: '#14b8a6', badgeClass: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400' },
                                            { hex: '#f59e0b', badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' },
                                            { hex: '#a855f7', badgeClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400' },
                                            { hex: '#0ea5e9', badgeClass: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400' },
                                        ][idx % 6];

                                        const myBalance = myBalances.find(b => b.rule_id === rule.rule_id);
                                        const available = myBalance ? Number(myBalance.available) : null;
                                        const total = myBalance ? (Number(myBalance.allocated) + Number(myBalance.carried_forward)) : rule.max_balance;
                                        const used = myBalance ? Number(myBalance.used) : 0;
                                        const usedPct = total > 0 ? Math.round((used / total) * 100) : 0;
                                        const displayDays = available !== null ? available : total;

                                        // SVG ring values (r=28, circumference ≈ 176)
                                        const r = 28, circ = 2 * Math.PI * r;
                                        const offset = circ - (Math.min(usedPct, 100) / 100) * circ;

                                        return (
                                            <div
                                                key={rule.rule_id}
                                                className="group relative flex items-stretch gap-0 bg-gradient-to-br from-white to-slate-50/80 dark:from-[#1a2233] dark:to-[#141923] border border-slate-200 dark:border-github-dark-border rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl dark:hover:shadow-black/40 hover:border-slate-300 dark:hover:border-slate-600"
                                            >
                                                {/* Left colored accent panel with ring */}
                                                <div className="flex flex-col items-center justify-center gap-2 px-5 py-5 shrink-0" style={{ background: `linear-gradient(135deg, ${palettes.hex}18 0%, ${palettes.hex}08 100%)`, borderRight: `1px solid ${palettes.hex}25` }}>
                                                    <div className="relative w-[72px] h-[72px]">
                                                        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
                                                            <circle cx="36" cy="36" r={r} strokeWidth="5" fill="none" stroke={palettes.hex} strokeOpacity="0.15" />
                                                            <circle
                                                                cx="36" cy="36" r={r}
                                                                strokeWidth="5"
                                                                fill="none"
                                                                stroke={palettes.hex}
                                                                strokeLinecap="round"
                                                                strokeDasharray={circ}
                                                                strokeDashoffset={offset}
                                                                style={{ transition: 'stroke-dashoffset 1s ease' }}
                                                            />
                                                        </svg>
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                            <span className="text-lg font-bold leading-none" style={{ color: palettes.hex }}>{displayDays}</span>
                                                            <span className="text-[9px] font-medium text-slate-400 leading-none mt-0.5">days</span>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${palettes.badgeClass}`}>{rule.code}</span>
                                                </div>

                                                {/* Right content area */}
                                                <div className="flex-1 flex flex-col justify-between p-4 gap-3 min-w-0">
                                                    <div>
                                                        <h5 className="font-semibold text-sm text-slate-800 dark:text-github-dark-text leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                            {rule.name}
                                                        </h5>
                                                        <p className="text-[10px] text-slate-400 mt-0.5 font-normal">
                                                            {rule.accural_type && rule.accural_type !== 'No Accrual' ? `${rule.accural_type} accrual` : 'All days available upfront'}
                                                        </p>
                                                    </div>

                                                    {/* Balance bar */}
                                                    {myBalance ? (
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between text-[10px] font-medium">
                                                                <span className="text-slate-500 dark:text-slate-400">{used} used</span>
                                                                <span className="text-slate-500 dark:text-slate-400">{total} total</span>
                                                            </div>
                                                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full transition-all duration-700"
                                                                    style={{ width: `${Math.min(usedPct, 100)}%`, backgroundColor: palettes.hex }}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] font-semibold" style={{ color: palettes.hex }}>
                                                                {displayDays} days remaining
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-slate-400 font-normal">
                                                            Up to <span className="font-medium text-slate-600 dark:text-slate-300">{total} days/year</span>
                                                        </p>
                                                    )}

                                                    {/* Feature tags */}
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${rule.is_paid ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                                                            {rule.is_paid ? 'Paid Leave' : 'Unpaid Leave'}
                                                        </span>
                                                        {rule.requires_doc === 1 && (
                                                            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50">Doc Required</span>
                                                        )}
                                                        {rule.carry_forward === 1 && (
                                                            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full border bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/50">Carry Fwd</span>
                                                        )}
                                                        {rule.encashable === 1 && (
                                                            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full border bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50">Encashable</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="px-4 py-4 text-center text-slate-400 bg-slate-50/50 dark:bg-github-dark-subtle/5 border border-slate-200 dark:border-github-dark-border rounded-xl">
                                    <p className="text-xs font-normal">No leave types set up in this plan yet.</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EmployeeLeavePlan;
