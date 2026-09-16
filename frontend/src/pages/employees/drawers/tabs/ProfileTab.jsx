import React from 'react';
import EmployeeFormContent from '../../../components/employees/EmployeeFormContent';

const ProfileTab = ({
    selectedEmployee,
    editMode,
    setEditMode,
    avatarTimestamp,
    handleFormSuccess,
    checklistTemplates = [],
    documentTemplates = [],
    handleChecklistTemplateChange,
    handleDocumentTemplateChange
}) => {
    if (!selectedEmployee) return null;

    if (editMode) {
        return (
            <div className="bg-slate-50 dark:bg-github-dark-subtle/10 p-4 rounded-xl border border-slate-100 dark:border-github-dark-border/60">
                <EmployeeFormContent
                    userId={selectedEmployee.id}
                    isSidebarMode={true}
                    onSuccess={handleFormSuccess}
                    onCancel={() => setEditMode(false)}
                />
            </div>
        );
    }

    const profile = selectedEmployee.profile || {};

    return (
        <div className="space-y-6">
            {/* Employee Avatar & Basic Info */}
            <div className="flex flex-col items-center gap-3 text-center border-b border-slate-100 dark:border-github-dark-border pb-5">
                <div className="relative w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-3xl overflow-hidden border border-slate-200 dark:border-github-dark-border shadow-sm">
                    {selectedEmployee.profile_image_url ? (
                        <img
                            src={`${selectedEmployee.profile_image_url}?t=${avatarTimestamp}`}
                            alt={selectedEmployee.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        selectedEmployee.name.charAt(0)
                    )}
                </div>
                <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-github-dark-text tracking-tight">
                        {selectedEmployee.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-github-dark-muted">{selectedEmployee.email}</p>

                    <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        selectedEmployee.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>
                        {selectedEmployee.status}
                    </span>
                </div>
            </div>

            {/* Profile Fields Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                    <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Role Designation</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedEmployee.designation}</span>
                </div>
                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                    <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Department Scope</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedEmployee.department}</span>
                </div>
                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                    <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Mobile Contact</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">{selectedEmployee.phone}</span>
                </div>
                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                    <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Work Shift Schedule</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedEmployee.shift}</span>
                </div>
                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                    <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Reporting Manager</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{profile.reporting_manager || 'N/A'}</span>
                </div>
                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                    <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Joining Date</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">{profile.joining_date || selectedEmployee.joiningDate || 'N/A'}</span>
                </div>
            </div>

            {/* Geofences, Locations, and Addresses */}
            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border space-y-3">
                <div>
                    <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Geofence Permissions</span>
                    <div className="flex flex-wrap gap-1.5">
                        {selectedEmployee.workLocations && selectedEmployee.workLocations.filter(l => l.is_active).length > 0 ? (
                            selectedEmployee.workLocations.filter(l => l.is_active).map((loc, i) => (
                                <span key={i} className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-lg">
                                    {loc.loc_name}
                                </span>
                            ))
                        ) : (
                            <span className="text-slate-400 italic">No custom geofences assigned (bound to global settings)</span>
                        )}
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border">
                    <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Office Work Location</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{profile.work_location || 'N/A'}</span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border">
                    <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Residential Address</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{profile.address || 'N/A'}</span>
                </div>

                {/* Templates Selection */}
                <div className="pt-3 border-t border-slate-100 dark:border-github-dark-border grid grid-cols-2 gap-4">
                    <div>
                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1.5">Checklist Template</span>
                        <select
                            value={profile.checklist_template_id || (checklistTemplates[0]?.id || '')}
                            onChange={(e) => handleChecklistTemplateChange(e.target.value)}
                            className="w-full bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                            {checklistTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1.5">Document Template</span>
                        <select
                            value={profile.document_template_id || (documentTemplates[0]?.id || '')}
                            onChange={(e) => handleDocumentTemplateChange(e.target.value)}
                            className="w-full bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                            {documentTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileTab;
