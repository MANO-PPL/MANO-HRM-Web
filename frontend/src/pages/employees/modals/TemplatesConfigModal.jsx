import React from 'react';
import {
    Sliders, X, CheckCircle2, FileText, Award, ArrowRight, Plus,
    CheckCircle, Trash, Trash2
} from 'lucide-react';

const TemplatesConfigModal = ({
    showTemplatesModal,
    setShowTemplatesModal,
    templatesModalTab,
    setTemplatesModalTab,
    // Checklist
    checklistTemplates = [],
    selectedChecklistTemplateId,
    setSelectedChecklistTemplateId,
    tempChecklistName,
    setTempChecklistName,
    tempChecklistId,
    setTempChecklistId,
    newChecklistItemText,
    setNewChecklistItemText,
    handleAddChecklistTemplate,
    handleUpdateChecklistTemplateName,
    handleAddChecklistTemplateItem,
    handleDeleteChecklistTemplateItem,
    handleDeleteChecklistTemplate,
    // Documents
    documentTemplates = [],
    selectedDocTemplateId,
    setSelectedDocTemplateId,
    tempDocName,
    setTempDocName,
    tempDocId,
    setTempDocId,
    newDocCatText,
    setNewDocCatText,
    newDocItemNames = {},
    setNewDocItemNames,
    newDocItemRequired = {},
    setNewDocItemRequired,
    editingCategoryNames = {},
    setEditingCategoryNames,
    handleAddDocTemplate,
    handleUpdateDocTemplateName,
    handleAddDocTemplateCategory,
    handleRenameDocTemplateCategory,
    handleDeleteDocTemplateCategory,
    handleAddDocTemplateItem,
    handleDeleteDocTemplateItem,
    handleDeleteDocTemplate,
    // Appraisal Cycles
    cycles = [],
    selectedCyclesManagerId,
    setSelectedCyclesManagerId,
    tempCycleName,
    setTempCycleName,
    tempCycleId,
    setTempCycleId,
    tempStartDate,
    setTempStartDate,
    tempStartDateId,
    setTempStartDateId,
    tempEndDate,
    setTempEndDate,
    tempEndDateId,
    setTempEndDateId,
    handleCreateNewCycleInManager,
    handleUpdateCycleField,
    handleDeleteCycleFromManager
}) => {
    if (!showTemplatesModal) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/10">
                    <div>
                        <h4 className="font-black text-sm text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                            <Sliders size={16} className="text-indigo-600 dark:text-indigo-400" />
                            Global Templates Configurations Manager
                        </h4>
                        <p className="text-slate-500 dark:text-github-dark-muted text-[10px] mt-0.5">
                            Configure onboarding and document lists assigned dynamically to employees.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowTemplatesModal(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Segment Tab Toggle */}
                <div className="flex border-b border-slate-100 dark:border-github-dark-border text-xs bg-slate-50 dark:bg-github-dark-subtle/20 px-4">
                    <button
                        onClick={() => setTemplatesModalTab('checklist')}
                        className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition-all ${
                            templatesModalTab === 'checklist'
                                ? 'border-indigo-600 text-indigo-650 dark:border-indigo-400 dark:text-[#f0f6fc]'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-github-dark-muted dark:hover:text-slate-200'
                        }`}
                    >
                        <CheckCircle2 size={14} />
                        <span>Onboarding Checklist Templates</span>
                    </button>
                    <button
                        onClick={() => setTemplatesModalTab('document')}
                        className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition-all ${
                            templatesModalTab === 'document'
                                ? 'border-indigo-600 text-indigo-650 dark:border-indigo-400 dark:text-[#f0f6fc]'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-github-dark-muted dark:hover:text-slate-200'
                        }`}
                    >
                        <FileText size={14} />
                        <span>Required Documents Templates</span>
                    </button>
                    <button
                        onClick={() => setTemplatesModalTab('appraisal_cycles')}
                        className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition-all ${
                            templatesModalTab === 'appraisal_cycles'
                                ? 'border-indigo-600 text-indigo-650 dark:border-indigo-400 dark:text-[#f0f6fc]'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-github-dark-muted dark:hover:text-slate-200'
                        }`}
                    >
                        <Award size={14} />
                        <span>Performance Appraisal Cycles</span>
                    </button>
                </div>

                {/* Main Layout: Split Screen */}
                <div className="flex-1 flex overflow-hidden text-xs">

                    {/* Left Pane: Templates List Sidebar */}
                    <div className="w-1/3 border-r border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#161b22]/10 p-4 flex flex-col justify-between overflow-y-auto">
                        <div className="space-y-2">
                            <span className="block text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-github-dark-muted mb-2">
                                Available Templates
                            </span>
                            {templatesModalTab === 'checklist' ? (
                                checklistTemplates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedChecklistTemplateId(t.id)}
                                        className={`w-full text-left p-3 rounded-xl border font-bold transition-all flex items-center justify-between ${
                                            selectedChecklistTemplateId === t.id
                                                ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-650 dark:text-indigo-400'
                                                : 'bg-white dark:bg-github-dark-subtle/35 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                                        }`}
                                    >
                                        <span>{t.name}</span>
                                        <ArrowRight size={14} className={selectedChecklistTemplateId === t.id ? "opacity-100 text-indigo-600" : "opacity-0"} />
                                    </button>
                                ))
                            ) : templatesModalTab === 'document' ? (
                                documentTemplates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedDocTemplateId(t.id)}
                                        className={`w-full text-left p-3 rounded-xl border font-bold transition-all flex items-center justify-between ${
                                            selectedDocTemplateId === t.id
                                                ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-650 dark:text-indigo-400'
                                                : 'bg-white dark:bg-github-dark-subtle/35 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                                        }`}
                                    >
                                        <span>{t.name}</span>
                                        <ArrowRight size={14} className={selectedDocTemplateId === t.id ? "opacity-100 text-indigo-600" : "opacity-0"} />
                                    </button>
                                ))
                            ) : (
                                cycles.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedCyclesManagerId(c.id)}
                                        className={`w-full text-left p-3 rounded-xl border font-bold transition-all flex flex-col gap-1 ${
                                            selectedCyclesManagerId === c.id
                                                ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-650 dark:text-indigo-400'
                                                : 'bg-white dark:bg-github-dark-subtle/35 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span>{c.name}</span>
                                            <ArrowRight size={14} className={selectedCyclesManagerId === c.id ? "opacity-100 text-indigo-600" : "opacity-0"} />
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                                                c.status === 'Active'
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                                                    : c.status === 'Evaluating'
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                                                        : c.status === 'Upcoming'
                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                                                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                                {c.status}
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-normal">{c.type}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        <button
                            onClick={
                                templatesModalTab === 'checklist'
                                    ? handleAddChecklistTemplate
                                    : templatesModalTab === 'document'
                                        ? handleAddDocTemplate
                                        : handleCreateNewCycleInManager
                            }
                            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm mt-4 shrink-0"
                        >
                            <Plus size={14} />
                            <span>
                                {templatesModalTab === 'checklist'
                                    ? 'Create New Template'
                                    : templatesModalTab === 'document'
                                        ? 'Create New Template'
                                        : 'Create New Cycle'}
                            </span>
                        </button>
                    </div>

                    {/* Right Pane: Template Details Editor */}
                    <div className="flex-1 p-5 overflow-y-auto flex flex-col justify-between">

                        {templatesModalTab === 'checklist' ? (() => {
                            const template = checklistTemplates.find(t => t.id === selectedChecklistTemplateId) || checklistTemplates[0];
                            if (!template) return <div className="text-slate-400 italic p-6">No template selected</div>;
                            return (
                                <div className="space-y-6 flex-1 flex flex-col justify-between">
                                    <div className="space-y-5">
                                        {/* Template Header */}
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Template Name</label>
                                            <input
                                                type="text"
                                                value={tempChecklistId === template.id ? tempChecklistName : (template.name || '')}
                                                onChange={(e) => {
                                                    setTempChecklistId(template.id);
                                                    setTempChecklistName(e.target.value);
                                                }}
                                                onBlur={() => {
                                                    if (tempChecklistId === template.id && tempChecklistName.trim() !== '' && tempChecklistName !== template.name) {
                                                        handleUpdateChecklistTemplateName(template.id, tempChecklistName.trim());
                                                    }
                                                }}
                                                className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>

                                        {/* Add Task Input */}
                                        <div className="pt-2">
                                            <span className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5 font-bold">Add Onboarding Task</span>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Set up payroll dashboard, Assign company email"
                                                    value={newChecklistItemText}
                                                    onChange={(e) => setNewChecklistItemText(e.target.value)}
                                                    className="flex-1 bg-white dark:bg-github-dark-subtle/20 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleAddChecklistTemplateItem(template.id, newChecklistItemText);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleAddChecklistTemplateItem(template.id, newChecklistItemText)}
                                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-github-dark-border font-bold rounded-xl flex items-center gap-1 shrink-0"
                                                >
                                                    <Plus size={14} />
                                                    <span>Add Task</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Items List */}
                                        <div className="space-y-2">
                                            <span className="block text-[10px] uppercase font-black text-slate-450 tracking-wider font-bold">Checklist Tasks ({template.items?.length || 0})</span>
                                            <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
                                                {template.items && template.items.length === 0 ? (
                                                    <div className="text-slate-400 italic py-4">No tasks in this template yet.</div>
                                                ) : (
                                                    template.items?.map((item) => (
                                                        <div key={item.key} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-[#161b22]/30 border border-slate-100 dark:border-github-dark-border rounded-xl">
                                                            <div className="flex items-center gap-2">
                                                                <CheckCircle size={15} className="text-slate-400" />
                                                                <span className="font-semibold text-slate-700 dark:text-slate-350">{item.label}</span>
                                                                <span className="text-[9px] font-mono text-slate-400 opacity-60">({item.key})</span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteChecklistTemplateItem(template.id, item.key)}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                            >
                                                                <Trash size={13} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Delete Template */}
                                    <div className="pt-5 border-t border-slate-100 dark:border-github-dark-border flex justify-end">
                                        <button
                                            onClick={() => {
                                                if (confirm(`Are you sure you want to delete template "${template.name}"?`)) {
                                                    handleDeleteChecklistTemplate(template.id);
                                                }
                                            }}
                                            className="px-4 py-2 text-red-500 hover:text-red-600 border border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/10 font-bold rounded-xl flex items-center gap-1.5 transition-all"
                                        >
                                            <Trash2 size={13} />
                                            <span>Delete Checklist Template</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })() : templatesModalTab === 'document' ? (() => {
                            const template = documentTemplates.find(t => t.id === selectedDocTemplateId) || documentTemplates[0];
                            if (!template) return <div className="text-slate-400 italic p-6">No template selected</div>;
                            return (
                                <div className="space-y-6 flex-1 flex flex-col justify-between">
                                    <div className="space-y-5">
                                        {/* Template Header */}
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Template Name</label>
                                            <input
                                                type="text"
                                                value={tempDocId === template.id ? tempDocName : (template.name || '')}
                                                onChange={(e) => {
                                                    setTempDocId(template.id);
                                                    setTempDocName(e.target.value);
                                                }}
                                                onBlur={() => {
                                                    if (tempDocId === template.id && tempDocName.trim() !== '' && tempDocName !== template.name) {
                                                        handleUpdateDocTemplateName(template.id, tempDocName.trim());
                                                    }
                                                }}
                                                className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>

                                        {/* Add Category Section */}
                                        <div className="pt-2">
                                            <span className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5 font-bold">Add Document Category</span>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Legal Documents, Experience Letters"
                                                    value={newDocCatText}
                                                    onChange={(e) => setNewDocCatText(e.target.value)}
                                                    className="flex-1 bg-white dark:bg-github-dark-subtle/20 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleAddDocTemplateCategory(template.id, newDocCatText);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleAddDocTemplateCategory(template.id, newDocCatText)}
                                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-github-dark-border font-bold rounded-xl flex items-center gap-1 shrink-0"
                                                >
                                                    <Plus size={14} />
                                                    <span>Add Category</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Categories & Items Listing */}
                                        <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
                                            <span className="block text-[10px] uppercase font-black text-slate-450 tracking-wider font-bold">Configured Categories ({template.categories?.length || 0})</span>
                                            {template.categories && template.categories.length === 0 ? (
                                                <div className="text-slate-400 italic py-4">No categories configured yet.</div>
                                            ) : (
                                                template.categories?.map((cat) => (
                                                    <div key={cat.id} className="border border-slate-200 dark:border-github-dark-border p-4 rounded-xl space-y-3 bg-slate-50/20 dark:bg-[#161b22]/10">
                                                        <div className="flex justify-between items-center pb-2 border-b border-slate-150/60 dark:border-github-dark-border">
                                                            <input
                                                                type="text"
                                                                value={editingCategoryNames[cat.id] !== undefined ? editingCategoryNames[cat.id] : cat.name}
                                                                onChange={(e) => setEditingCategoryNames({ ...editingCategoryNames, [cat.id]: e.target.value })}
                                                                onBlur={() => handleRenameDocTemplateCategory(template.id, cat.id, editingCategoryNames[cat.id])}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.target.blur();
                                                                    }
                                                                }}
                                                                className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none font-bold text-indigo-655 dark:text-indigo-400 uppercase text-[10px] tracking-wider py-0.5 px-1 w-2/3"
                                                                placeholder="Category Name"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`Delete category "${cat.name}"? This removes all file fields inside it.`)) {
                                                                        handleDeleteDocTemplateCategory(template.id, cat.id);
                                                                    }
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-red-500 rounded"
                                                                title="Delete Category"
                                                            >
                                                                <Trash size={12} />
                                                            </button>
                                                        </div>

                                                        {/* Category Items List */}
                                                        <div className="space-y-1">
                                                            {cat.items && cat.items.length === 0 ? (
                                                                <p className="text-[10px] text-slate-400 italic">No document fields in this category.</p>
                                                            ) : (
                                                                cat.items?.map((item) => (
                                                                    <div key={item.key} className="flex justify-between items-center py-1.5 px-2.5 bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border/60 rounded-lg">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <FileText size={12} className="text-slate-400" />
                                                                            <span className="font-semibold">{item.name}</span>
                                                                            {item.required && <span className="text-red-500 font-bold">* Required</span>}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDeleteDocTemplateItem(template.id, cat.id, item.key)}
                                                                            className="p-1 text-slate-400 hover:text-red-500 rounded"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>

                                                        {/* Add Item Form inside Category */}
                                                        <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border/40 grid grid-cols-12 gap-2 items-center">
                                                            <div className="col-span-6">
                                                                <input
                                                                    type="text"
                                                                    placeholder="New field name (e.g. Passport Scan)"
                                                                    value={newDocItemNames[cat.id] || ''}
                                                                    onChange={(e) => setNewDocItemNames({ ...newDocItemNames, [cat.id]: e.target.value })}
                                                                    className="w-full bg-white dark:bg-github-dark-subtle/30 border border-slate-200 dark:border-github-dark-border px-2.5 py-1.5 rounded-lg text-xs"
                                                                />
                                                            </div>
                                                            <div className="col-span-3 flex items-center justify-center gap-1 bg-white dark:bg-github-dark-subtle/30 px-2 py-1.5 border border-slate-200 dark:border-github-dark-border rounded-lg">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`req_${cat.id}`}
                                                                    checked={!!newDocItemRequired[cat.id]}
                                                                    onChange={(e) => setNewDocItemRequired({ ...newDocItemRequired, [cat.id]: e.target.checked })}
                                                                    className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                                                                />
                                                                <label htmlFor={`req_${cat.id}`} className="text-[10px] font-bold text-slate-500 select-none cursor-pointer">Required</label>
                                                            </div>
                                                            <div className="col-span-3">
                                                                <button
                                                                    onClick={() => handleAddDocTemplateItem(template.id, cat.id, newDocItemNames[cat.id] || '', !!newDocItemRequired[cat.id])}
                                                                    className="w-full px-2 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-lg text-center"
                                                                >
                                                                    Add Field
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Delete Template */}
                                    <div className="pt-5 border-t border-slate-100 dark:border-github-dark-border flex justify-end">
                                        <button
                                            onClick={() => {
                                                if (confirm(`Are you sure you want to delete template "${template.name}"?`)) {
                                                    handleDeleteDocTemplate(template.id);
                                                }
                                            }}
                                            className="px-4 py-2 text-red-500 hover:text-red-600 border border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/10 font-bold rounded-xl flex items-center gap-1.5 transition-all"
                                        >
                                            <Trash2 size={13} />
                                            <span>Delete Document Template</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })() : (() => {
                            const cycle = cycles.find(c => c.id === selectedCyclesManagerId) || cycles[0];
                            if (!cycle) return <div className="text-slate-400 italic p-6">No cycle selected</div>;
                            return (
                                <div className="space-y-6 flex-1 flex flex-col justify-between">
                                    <div className="space-y-5">
                                        {/* Cycle Name */}
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Cycle Name</label>
                                            <input
                                                type="text"
                                                value={tempCycleId === cycle.id ? tempCycleName : (cycle.name || '')}
                                                onChange={(e) => {
                                                    setTempCycleId(cycle.id);
                                                    setTempCycleName(e.target.value);
                                                }}
                                                onBlur={() => {
                                                    if (tempCycleId === cycle.id && tempCycleName.trim() !== '' && tempCycleName !== cycle.name) {
                                                        handleUpdateCycleField(cycle.id, 'name', tempCycleName.trim());
                                                    }
                                                    setTempCycleId('');
                                                    setTempCycleName('');
                                                }}
                                                className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>

                                        {/* Cycle Type & Status */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Cycle Type</label>
                                                <select
                                                    value={cycle.type}
                                                    onChange={(e) => handleUpdateCycleField(cycle.id, 'type', e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-200 focus:outline-none"
                                                >
                                                    <option value="Quarterly">Quarterly</option>
                                                    <option value="Half Yearly">Half Yearly</option>
                                                    <option value="Yearly">Yearly</option>
                                                    <option value="Custom">Custom</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Status</label>
                                                <select
                                                    value={cycle.status}
                                                    onChange={(e) => handleUpdateCycleField(cycle.id, 'status', e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-200 focus:outline-none"
                                                >
                                                    <option value="Active">Active</option>
                                                    <option value="Evaluating">Evaluating</option>
                                                    <option value="Upcoming">Upcoming</option>
                                                    <option value="Closed">Closed</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Target Employee Type */}
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Target Employee Group</label>
                                            <select
                                                value={cycle.targetEmployeeType}
                                                onChange={(e) => handleUpdateCycleField(cycle.id, 'targetEmployeeType', e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-200 focus:outline-none"
                                            >
                                                <option value="All">All Staff (General)</option>
                                                <option value="Intern">Interns Only</option>
                                                <option value="Full-time">Permanent / Full-Time</option>
                                                <option value="Management">Management / Leads</option>
                                            </select>
                                            <p className="text-[10px] text-slate-455 dark:text-github-dark-muted mt-1">
                                                This cycle will only filter/appear for employees matching this employment type.
                                            </p>
                                        </div>

                                        {/* Start & End Dates */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={tempStartDateId === cycle.id ? tempStartDate : (cycle.startDate || '')}
                                                    onChange={(e) => {
                                                        setTempStartDateId(cycle.id);
                                                        setTempStartDate(e.target.value);
                                                    }}
                                                    onBlur={() => {
                                                        if (tempStartDateId === cycle.id && tempStartDate !== cycle.startDate) {
                                                            handleUpdateCycleField(cycle.id, 'startDate', tempStartDate);
                                                        }
                                                        setTempStartDateId('');
                                                        setTempStartDate('');
                                                    }}
                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">End Date</label>
                                                <input
                                                    type="date"
                                                    value={tempEndDateId === cycle.id ? tempEndDate : (cycle.endDate || '')}
                                                    onChange={(e) => {
                                                        setTempEndDateId(cycle.id);
                                                        setTempEndDate(e.target.value);
                                                    }}
                                                    onBlur={() => {
                                                        if (tempEndDateId === cycle.id && tempEndDate !== cycle.endDate) {
                                                            handleUpdateCycleField(cycle.id, 'endDate', tempEndDate);
                                                        }
                                                        setTempEndDateId('');
                                                        setTempEndDate('');
                                                    }}
                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Delete Cycle button */}
                                    <div className="pt-5 border-t border-slate-100 dark:border-github-dark-border flex justify-end">
                                        <button
                                            onClick={() => {
                                                if (confirm(`Are you sure you want to delete cycle "${cycle.name}"?`)) {
                                                    handleDeleteCycleFromManager(cycle.id);
                                                }
                                            }}
                                            className="px-4 py-2 text-red-500 hover:text-red-600 border border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/10 font-bold rounded-xl flex items-center gap-1.5 transition-all"
                                        >
                                            <Trash2 size={13} />
                                            <span>Delete Cycle</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/10 flex justify-end">
                    <button
                        onClick={() => setShowTemplatesModal(false)}
                        className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 hover:dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all"
                    >
                        Close Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TemplatesConfigModal;
