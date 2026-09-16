import React from 'react';
import {
    Sparkles, RefreshCw, AlertCircle, Check, Clock, AlertTriangle,
    CheckCircle2, XCircle, ArrowRight, ShieldCheck, ShieldAlert
} from 'lucide-react';

const AiVerificationTab = ({
    selectedEmployee,
    activeOcrDoc,
    setActiveOcrDoc,
    runAiVerification,
    isVerifying,
    handleRevokeOverride,
    overridingDiscrepancyId,
    setOverridingDiscrepancyId,
    overrideReasonText,
    setOverrideReasonText,
    handleOverrideDiscrepancy
}) => {
    if (!selectedEmployee) return null;

    const results = selectedEmployee.profile?.ai_verification_results || {};
    const missingDocs = results.missing_documents || [];
    const expiredDocs = results.expired_documents || [];
    const extractedMetadata = results.extractedMetadata || {};
    const securityChecks = results.securityChecks || {};
    const discrepancies = results.discrepancies || [];

    const score = results.auditScore !== undefined ? results.auditScore : (100 - (missingDocs.length * 10) - (expiredDocs.length * 15) - (discrepancies.filter(d => !d.isOverridden).length * 15));

    let scoreColor = 'text-emerald-500 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900';
    let scoreBarColor = 'bg-emerald-500';
    let scoreLabel = 'High Compliance';
    if (score < 50) {
        scoreColor = 'text-rose-500 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900';
        scoreBarColor = 'bg-rose-500';
        scoreLabel = 'Critical Mismatches';
    } else if (score < 80) {
        scoreColor = 'text-amber-500 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900';
        scoreBarColor = 'bg-amber-500';
        scoreLabel = 'Needs Verification';
    }

    const ocrKeys = Object.keys(extractedMetadata);
    const currentDocKey = activeOcrDoc || ocrKeys[0] || '';

    return (
        <div className="space-y-6">
            {/* AI Header Card & Score */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 flex flex-col justify-between p-4 bg-slate-50 dark:bg-github-dark-subtle/20 rounded-xl border border-slate-200/60 dark:border-github-dark-border">
                    <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                            <Sparkles size={16} className="text-indigo-500" />
                            AI Document Auditor Engine
                        </h4>
                        <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">
                            Our deep-learning models scan uploaded files for text legibility, matching details (names, dates), expiration metrics, hologram presence, metadata edits, and Photoshop tampering artifacts.
                        </p>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <button
                            onClick={runAiVerification}
                            disabled={isVerifying}
                            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                            <RefreshCw size={13} className={isVerifying ? "animate-spin" : ""} />
                            {isVerifying ? "Auditing Files..." : "Run AI Auditor"}
                        </button>
                        <span className="text-[10px] text-slate-400">
                            Last checked: {results.lastChecked || 'Never'}
                        </span>
                    </div>
                </div>

                <div className={`p-4 border rounded-xl flex flex-col items-center justify-center text-center ${scoreColor}`}>
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-450 dark:text-slate-500">Compliance Score</span>
                    <div className="text-4xl font-extrabold my-2">{score}%</div>
                    <div className="w-full bg-slate-200/50 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                        <div className={`h-full ${scoreBarColor}`} style={{ width: `${score}%` }}></div>
                    </div>
                    <span className="text-xs font-bold">{scoreLabel}</span>
                </div>
            </div>

            {/* Results Listings: Missing and Expired */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Missing docs */}
                <div className="border border-slate-200 dark:border-github-dark-border p-4 rounded-xl bg-white dark:bg-[#161b22]/30">
                    <span className="font-bold text-[10px] uppercase text-slate-400 flex items-center gap-1.5 mb-3">
                        <AlertCircle size={14} className="text-slate-400" />
                        Missing Fields ({missingDocs.length})
                    </span>
                    {missingDocs.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {missingDocs.map((d, i) => (
                                <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-github-dark-subtle text-slate-600 dark:text-slate-400 rounded text-[10px] font-medium border border-slate-200 dark:border-github-dark-border/40">
                                    {d}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-medium">
                            <Check size={14} />
                            All required files present.
                        </div>
                    )}
                </div>

                {/* Expired docs */}
                <div className="border border-slate-200 dark:border-github-dark-border p-4 rounded-xl bg-white dark:bg-[#161b22]/30">
                    <span className="font-bold text-[10px] uppercase text-amber-500 flex items-center gap-1.5 mb-3">
                        <Clock size={14} />
                        Expired Alerts ({expiredDocs.length})
                    </span>
                    {expiredDocs.length > 0 ? (
                        <ul className="space-y-1.5 text-xs text-rose-500">
                            {expiredDocs.map((d, i) => (
                                <li key={i} className="flex items-center gap-1.5 font-medium">
                                    <AlertTriangle size={12} className="text-amber-500" />
                                    {d}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center gap-1.5 text-emerald-550 text-xs font-medium">
                            <Check size={14} />
                            No expired records flagged.
                        </div>
                    )}
                </div>
            </div>

            {/* OCR Metadata Explorer Section */}
            <div className="border border-slate-200 dark:border-github-dark-border rounded-xl bg-white dark:bg-[#161b22]/30 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div>
                        <h5 className="font-bold text-xs text-slate-750 dark:text-github-dark-text">OCR Extracted Metadata</h5>
                        <p className="text-[10px] text-slate-400 mt-0.5">Explore key-value data extracted by AI models from the uploaded files.</p>
                    </div>

                    {/* Tabs Selector */}
                    {ocrKeys.length > 0 && (
                        <div className="flex gap-1 bg-slate-100 dark:bg-github-dark-subtle p-0.5 rounded-lg border border-slate-200 dark:border-github-dark-border/40">
                            {ocrKeys.map(key => {
                                const isActive = currentDocKey === key;
                                const label = key === 'aadhaar' ? 'Aadhaar' : key === 'pan' ? 'PAN Card' : key === 'degree' || key === 'grad_degree' ? 'Degree Cert' : key === 'passport' ? 'Passport' : key === 'experience_letter' ? 'Exp Letter' : key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActiveOcrDoc(key)}
                                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                                            isActive
                                                ? 'bg-white dark:bg-[#161b22] text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-github-dark-border/50'
                                                : 'text-slate-450 hover:text-slate-700 dark:hover:text-github-dark-text'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {ocrKeys.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-github-dark-border">

                        {/* Left Panel: OCR Values */}
                        <div className="p-4 space-y-3">
                            <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400">Extracted Fields</span>
                            <div className="space-y-2">
                                {extractedMetadata[currentDocKey]?.map((item, index) => {
                                    let confidenceBg = 'bg-emerald-500';
                                    let confidenceText = 'text-emerald-500';
                                    if (item.confidence < 95) {
                                        confidenceBg = 'bg-amber-500';
                                        confidenceText = 'text-amber-500';
                                    } else if (item.confidence < 85) {
                                        confidenceBg = 'bg-rose-500';
                                        confidenceText = 'text-rose-500';
                                    }
                                    return (
                                        <div key={index} className="p-2.5 bg-slate-50 dark:bg-github-dark-subtle/10 rounded-lg border border-slate-200/20 dark:border-github-dark-border/30 flex flex-col gap-1.5 hover:shadow-sm transition-all duration-150">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="font-semibold text-slate-450 dark:text-slate-500 text-[10px]">{item.field}</span>
                                                <span className="font-bold text-slate-700 dark:text-github-dark-text select-all">{item.value}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-slate-200/50 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                                    <div className={`h-full ${confidenceBg}`} style={{ width: `${item.confidence}%` }}></div>
                                                </div>
                                                <span className={`text-[9px] font-black font-mono ${confidenceText}`}>
                                                    {item.confidence}% conf
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Panel: Security Verification Badges */}
                        <div className="p-4 space-y-4">
                            <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400">Document Authenticity & Security Checks</span>

                            {(() => {
                                const checks = securityChecks[currentDocKey] || {};

                                const hologramPassed = checks.hologram === 'Passed';
                                const blurPassed = checks.blur !== undefined && checks.blur < 0.15;
                                const metadataPassed = checks.metadata === 'Passed';
                                const editingPassed = checks.editing === 'Passed';

                                return (
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* 1. Hologram Test */}
                                        <div className="p-3 border border-slate-200/40 dark:border-github-dark-border rounded-xl flex flex-col justify-between gap-2 bg-slate-50/50 dark:bg-[#161b22]/10 hover:shadow-sm transition-all">
                                            <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500">Hologram Verification</span>
                                            <div className="flex items-center gap-1.5">
                                                {checks.hologram === 'N/A' ? (
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-github-dark-subtle text-slate-400 text-[10px] font-bold rounded-full">N/A</span>
                                                ) : hologramPassed ? (
                                                    <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> Passed</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-rose-500/10 dark:bg-rose-950/20 text-rose-500 text-[10px] font-bold rounded-full flex items-center gap-1"><XCircle size={10} /> Failed</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Blur / Legibility */}
                                        <div className="p-3 border border-slate-200/40 dark:border-github-dark-border rounded-xl flex flex-col justify-between gap-2 bg-slate-50/50 dark:bg-[#161b22]/10 hover:shadow-sm transition-all">
                                            <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500">Blur legibility test</span>
                                            <div className="flex items-center gap-1.5">
                                                {blurPassed ? (
                                                    <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1">
                                                        <CheckCircle2 size={10} /> Legible ({checks.blur})
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-rose-500/10 dark:bg-rose-950/20 text-rose-500 text-[10px] font-bold rounded-full flex items-center gap-1">
                                                        <XCircle size={10} /> Blur Alert ({checks.blur})
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 3. EXIF Metadata Check */}
                                        <div className="p-3 border border-slate-200/40 dark:border-github-dark-border rounded-xl flex flex-col justify-between gap-2 bg-slate-50/50 dark:bg-[#161b22]/10 hover:shadow-sm transition-all">
                                            <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500">Metadata Alteration</span>
                                            <div className="flex items-center gap-1.5">
                                                {metadataPassed ? (
                                                    <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> No Edits</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-amber-500/10 dark:bg-amber-950/20 text-amber-550 text-[10px] font-bold rounded-full flex items-center gap-1"><AlertTriangle size={10} /> Edited EXIF</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 4. Photoshop manipulation */}
                                        <div className="p-3 border border-slate-200/40 dark:border-github-dark-border rounded-xl flex flex-col justify-between gap-2 bg-slate-50/50 dark:bg-[#161b22]/10 hover:shadow-sm transition-all">
                                            <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500">Manipulation / Photoshop</span>
                                            <div className="flex items-center gap-1.5">
                                                {editingPassed ? (
                                                    <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> Authentic</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-rose-500/10 dark:bg-rose-950/20 text-rose-550 text-[10px] font-bold rounded-full flex items-center gap-1"><XCircle size={10} /> Tampering</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                        No OCR data extracted. Upload verification documents (e.g., Aadhaar Card, PAN Card, Degree Certificate) in the "Document Files" tab and run the AI auditor.
                    </div>
                )}
            </div>

            {/* Cross-Document Mismatch Matrix Comparison Grid */}
            <div className="border border-slate-200 dark:border-github-dark-border rounded-xl bg-white dark:bg-[#161b22]/30 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20">
                    <h5 className="font-bold text-xs text-slate-750 dark:text-github-dark-text">Cross-Document Discrepancy Matrix</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Discrepancies identified by comparing fields across different official source documents.</p>
                </div>

                {discrepancies.length > 0 ? (
                    <div className="divide-y divide-slate-200 dark:divide-github-dark-border">
                        {discrepancies.map(d => (
                            <div key={d.id} className="p-4 space-y-3 hover:bg-slate-50/30 dark:hover:bg-github-dark-subtle/5 transition-all">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">

                                    {/* Compare Fields info */}
                                    <div className="flex items-start md:items-center gap-3">
                                        <span className="px-2.5 py-1 bg-rose-105 dark:bg-rose-950/30 text-rose-600 dark:text-rose-455 rounded text-[10px] font-black uppercase">
                                            {d.field} Mismatch
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                            <span className="font-bold text-slate-500 dark:text-slate-400">{d.sourceA}:</span>
                                            <span className="text-slate-700 dark:text-github-dark-text bg-slate-100 dark:bg-github-dark-subtle px-2 py-0.5 rounded font-mono text-[11px]">{d.valueA}</span>
                                            <ArrowRight size={12} className="text-slate-450" />
                                            <span className="font-bold text-slate-500 dark:text-slate-400">{d.sourceB}:</span>
                                            <span className="text-rose-650 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded font-mono text-[11px] font-bold">{d.valueB}</span>
                                        </div>
                                    </div>

                                    {/* Status or Override actions */}
                                    <div className="flex items-center gap-2">
                                        {d.isOverridden ? (
                                            <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1 border border-emerald-500/20">
                                                <ShieldCheck size={12} /> Overridden & Approved
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-rose-500/10 dark:bg-rose-950/20 text-rose-500 text-[10px] font-bold rounded-full flex items-center gap-1 border border-rose-500/20 animate-pulse">
                                                <ShieldAlert size={12} /> Unresolved Discrepancy
                                            </span>
                                        )}

                                        {d.isOverridden ? (
                                            <button
                                                onClick={() => handleRevokeOverride(d.id)}
                                                className="text-[10px] text-slate-400 hover:text-red-500 font-bold underline transition-colors"
                                            >
                                                Revoke
                                            </button>
                                        ) : (
                                            overridingDiscrepancyId !== d.id && (
                                                <button
                                                    onClick={() => {
                                                        setOverridingDiscrepancyId(d.id);
                                                        setOverrideReasonText('');
                                                    }}
                                                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-github-dark-subtle dark:hover:bg-[#30363d] text-slate-700 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-lg text-[10px] font-bold transition-all shadow-sm"
                                                >
                                                    Override
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* Overridden justifications log */}
                                {d.isOverridden && (
                                    <div className="p-2.5 bg-emerald-50/30 dark:bg-emerald-950/5 border border-emerald-200/20 dark:border-emerald-900/30 rounded-lg text-[10px] text-slate-500 dark:text-emerald-400/90 leading-relaxed font-mono">
                                        <strong>Justification:</strong> {d.overrideReason}
                                        <div className="mt-1 text-[9px] text-slate-400">
                                            Approved by {d.overriddenBy} on {d.overriddenAt}
                                        </div>
                                    </div>
                                )}

                                {/* Inline overriding dialog form */}
                                {overridingDiscrepancyId === d.id && (
                                    <div className="p-3.5 bg-slate-50 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border rounded-xl space-y-2 mt-2">
                                        <label className="block text-[9px] uppercase font-black text-slate-450 dark:text-slate-500">Provide Justification / Reason for Mismatch</label>
                                        <textarea
                                            value={overrideReasonText}
                                            onChange={(e) => setOverrideReasonText(e.target.value)}
                                            placeholder="e.g., Degree certificate verified with university registrar; mismatch is due to name containing middle initial. Checked and approved."
                                            className="w-full p-2 text-xs bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            rows={2}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setOverridingDiscrepancyId(null)}
                                                className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleOverrideDiscrepancy(d.id, overrideReasonText)}
                                                className="px-3 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-all shadow-sm"
                                            >
                                                Approve Override
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                        No discrepancies identified. All document fields match HR profile.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiVerificationTab;
