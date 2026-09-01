import React from 'react';
import { Building, User, ChevronRight, Search, Upload, UserPlus, Plus, Calendar, DollarSign } from 'lucide-react';
import MinimalSelect from '../../../components/MinimalSelect';
import DatePicker from '../../../components/DatePicker';
import MonthPicker from '../../../components/MonthPicker';
import { DEFAULT_PREVIEW_WORKERS } from '../utils/labourUtils';

const LabourHeader = ({
    activeTab,
    setActiveTab,
    selectedSite,
    setSelectedSite,
    labourSearch,
    setLabourSearch,
    labourRoleFilter,
    setLabourRoleFilter,
    labourSiteFilter,
    setLabourSiteFilter,
    labours,
    sites,
    setSelectedLabourIds,
    setBulkSourceSiteId,
    setBulkDestinationSiteId,
    setBulkRoleFilter,
    setShowBulkTransferModal,
    parsedLabours,
    setParsedLabours,
    setCsvPreviewError,
    setShowBulkLabourModal,
    setEditingLabour,
    setLabourForm,
    setShowLabourModal,
    siteSearch,
    setSiteSearch,
    setEditingSite,
    setSiteForm,
    setShowSiteModal,
    subTab,
    setSubTab,
    attendanceRoleFilter,
    setAttendanceRoleFilter,
    attendanceDate,
    setAttendanceDate,
    getMaxAttendanceDate,
    gridRoleFilter,
    setGridRoleFilter,
    gridMonth,
    setGridMonth,
    financeRoleFilter,
    setFinanceRoleFilter,
    financeMonth,
    setFinanceMonth,
    ledgerViewMode,
    setLedgerViewMode
}) => {
    return (
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-3 select-none">
            <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-[#f6f8fa] dark:bg-[#161b22] p-1 rounded-xl border border-[#d0d7de] dark:border-[#30363d] w-fit select-none shrink-0">
                    {[
                        { id: 'sites', label: 'Sites Overview', icon: <Building size={14} /> },
                        { id: 'directory', label: 'Labour Force Directory', icon: <User size={14} /> }
                    ].map((tab) => {
                        const isSelected = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                }}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${isSelected
                                    ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Breadcrumb inline next to tab bar */}
                {activeTab === 'sites' && selectedSite !== null && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 select-none bg-[#f6f8fa] dark:bg-[#161b22] px-3 py-1.5 rounded-xl border border-[#d0d7de] dark:border-[#30363d]">
                        <span className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors" onClick={() => setSelectedSite(null)}>Sites Overview</span>
                        <ChevronRight size={12} className="text-slate-400 dark:text-slate-600" />
                        <span className="text-slate-800 dark:text-github-dark-text font-bold">{selectedSite.site_name}</span>
                        <span className={`ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                            selectedSite.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-500'
                        }`}>
                            {selectedSite.status}
                        </span>
                    </div>
                )}
            </div>

            {/* Single Row on Right: Search, Filters, and Action Buttons */}
            {activeTab === 'directory' && (
                <div className="flex items-center gap-2 flex-wrap ml-auto">
                    {/* Search Bar */}
                    <div className="relative w-44 sm:w-52">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={labourSearch}
                            onChange={(e) => setLabourSearch(e.target.value)}
                            className="pl-8 pr-2.5 py-1.5 w-full bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 shadow-2xs h-[32px]"
                        />
                    </div>

                    {/* Filters */}
                    <MinimalSelect
                        value={labourRoleFilter}
                        onChange={(val) => setLabourRoleFilter(val)}
                        options={[
                            { value: '', label: 'All Roles' },
                            ...((() => { const seen = new Map(); labours.forEach(l => { const r = (l.role || '').trim(); if (r) { const key = r.toLowerCase(); if (!seen.has(key)) seen.set(key, r); } }); return [...seen.values()].sort(); })().map(r => ({ value: r, label: r })))
                        ]}
                        size="sm"
                        triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-github-dark-text cursor-pointer rounded-lg h-[32px] text-xs shadow-2xs min-w-[110px]"
                        variant="input"
                    />
                    <MinimalSelect
                        value={labourSiteFilter}
                        onChange={(val) => setLabourSiteFilter(val)}
                        options={[
                            { value: 'All', label: 'All Sites' },
                            { value: 'Unassigned', label: 'Unassigned' },
                            ...sites.map(s => ({ value: String(s.site_id), label: s.site_name }))
                        ]}
                        size="sm"
                        triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-github-dark-text cursor-pointer rounded-lg h-[32px] text-xs shadow-2xs min-w-[110px]"
                        variant="input"
                    />

                    {/* Action Buttons */}
                    <button
                        onClick={() => {
                            setSelectedLabourIds([]);
                            setBulkSourceSiteId('All');
                            setBulkDestinationSiteId(selectedSite ? String(selectedSite.site_id) : '');
                            setBulkRoleFilter('All');
                            setShowBulkTransferModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-2xs transition-all border border-[#d0d7de] dark:border-[#30363d] cursor-pointer h-[32px] shrink-0"
                    >
                        <Building size={13} />
                        <span>Bulk Transfer</span>
                    </button>
                    <button
                        onClick={() => {
                            if (!parsedLabours || parsedLabours.length === 0) {
                                setParsedLabours(DEFAULT_PREVIEW_WORKERS);
                            }
                            setCsvPreviewError('');
                            setShowBulkLabourModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer h-[32px] shrink-0"
                    >
                        <Upload size={13} />
                        <span>Bulk Add Labours</span>
                    </button>
                    <button
                        onClick={() => { setEditingLabour(null); setLabourForm({ name: '', phone: '', sex: 'Male', role: '', wage_type: 'Daily Wage', monthly_salary: '', allowed_leaves: '0', site_id: '' }); setShowLabourModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer h-[32px] shrink-0"
                    >
                        <UserPlus size={13} />
                        <span>Add Labour Worker</span>
                    </button>
                </div>
            )}

            {activeTab === 'sites' && selectedSite === null && (
                <div className="flex items-center gap-2 ml-auto">
                    <div className="relative w-44 sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                        <input
                            type="text"
                            placeholder="Search sites..."
                            value={siteSearch}
                            onChange={(e) => setSiteSearch(e.target.value)}
                            className="pl-8 pr-2.5 py-1.5 w-full bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 shadow-2xs h-[32px]"
                        />
                    </div>
                    <button
                        onClick={() => { setEditingSite(null); setSiteForm({ site_name: '', location_details: '', status: 'Active' }); setShowSiteModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer h-[32px] shrink-0"
                    >
                        <Plus size={13} />
                        <span>Create Site</span>
                    </button>
                </div>
            )}

            {/* In line with the tab bar: Filters & View Buttons when a site is selected */}
            {activeTab === 'sites' && selectedSite !== null && (
                <div className="flex items-center gap-2 flex-wrap ml-auto">
                    {/* Context-sensitive filters */}
                    {subTab === 'attendance' && (
                        <>
                            <MinimalSelect
                                value={attendanceRoleFilter}
                                onChange={(val) => setAttendanceRoleFilter(val)}
                                options={[
                                    { value: '', label: 'All Roles' },
                                    ...((() => { const seen = new Map(); labours.forEach(l => { const r = (l.role || '').trim(); if (r) { const key = r.toLowerCase(); if (!seen.has(key)) seen.set(key, r); } }); return [...seen.values()].sort(); })().map(r => ({ value: r, label: r })))
                                ]}
                                size="sm"
                                triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-github-dark-text cursor-pointer h-[32px] text-xs shadow-2xs min-w-[110px]"
                                variant="input"
                            />
                            <DatePicker
                                value={attendanceDate}
                                onChange={(val) => setAttendanceDate(val)}
                                maxDate={getMaxAttendanceDate()}
                                compact={true}
                            />
                        </>
                    )}
                    {subTab === 'grid' && (
                        <>
                            <MinimalSelect
                                value={gridRoleFilter}
                                onChange={(val) => setGridRoleFilter(val)}
                                options={[
                                    { value: '', label: 'All Roles' },
                                    ...((() => { const seen = new Map(); labours.forEach(l => { const r = (l.role || '').trim(); if (r) { const key = r.toLowerCase(); if (!seen.has(key)) seen.set(key, r); } }); return [...seen.values()].sort(); })().map(r => ({ value: r, label: r })))
                                ]}
                                size="sm"
                                triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-github-dark-text cursor-pointer h-[32px] text-xs shadow-2xs min-w-[110px]"
                                variant="input"
                            />
                            <MonthPicker
                                value={gridMonth}
                                onChange={(val) => setGridMonth(val)}
                                compact={true}
                            />
                        </>
                    )}
                    {subTab === 'finances' && (
                        <>
                            <MinimalSelect
                                value={financeRoleFilter}
                                onChange={(val) => setFinanceRoleFilter(val)}
                                options={[
                                    { value: '', label: 'All Roles' },
                                    ...((() => { const seen = new Map(); labours.forEach(l => { const r = (l.role || '').trim(); if (r) { const key = r.toLowerCase(); if (!seen.has(key)) seen.set(key, r); } }); return [...seen.values()].sort(); })().map(r => ({ value: r, label: r })))
                                ]}
                                size="sm"
                                triggerClassName="bg-white dark:bg-[#161b22] border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-github-dark-text cursor-pointer h-[32px] text-xs shadow-2xs min-w-[110px]"
                                variant="input"
                            />
                            <MonthPicker
                                value={financeMonth}
                                onChange={(val) => setFinanceMonth(val)}
                                compact={true}
                            />
                            <div className="flex bg-[#f6f8fa] dark:bg-[#161b22] p-1 rounded-xl border border-[#d0d7de] dark:border-[#30363d] select-none shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setLedgerViewMode('matrix')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                        ledgerViewMode === 'matrix'
                                            ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Calendar size={12} />
                                    <span>3-Row Daily Spreadsheet</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLedgerViewMode('summary')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                        ledgerViewMode === 'summary'
                                            ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <DollarSign size={12} />
                                    <span>Summary Table</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* View Switcher Buttons */}
                    <div className="flex bg-[#f6f8fa] dark:bg-[#161b22] p-1 rounded-xl border border-[#d0d7de] dark:border-[#30363d] select-none shrink-0">
                        {[
                            { id: 'attendance', label: 'Daily Roll Call', icon: <Calendar size={12} /> },
                            { id: 'grid', label: 'Monthly Matrix', icon: <Calendar size={12} /> },
                            { id: 'finances', label: 'Salary Ledger', icon: <DollarSign size={12} /> }
                        ].map((tab) => {
                            const isSelected = subTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setSubTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${isSelected
                                        ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LabourHeader;
