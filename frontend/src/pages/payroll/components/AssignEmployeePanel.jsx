import React from 'react';
import { X } from 'lucide-react';

const AssignEmployeePanel = ({
    selectedEmployeeForAssign,
    selectedPackage,
    assignForm,
    setAssignForm,
    onSubmit,
    onClose
}) => {
    return (
        <>
            <div className="flex items-center justify-between p-5 border-b border-slate-105 dark:border-github-dark-border">
                <h3 className="font-semibold text-slate-900 dark:text-github-dark-text text-base">Assign Package</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-655 p-1 rounded-lg cursor-pointer">
                    <X size={18} />
                </button>
            </div>
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl space-y-2 border border-slate-100 dark:border-github-dark-border">
                    <p className="text-xs font-normal text-slate-400">Employee</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedEmployeeForAssign?.user_name}</p>
                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-750 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-normal text-slate-400">Target Package</p>
                            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{selectedPackage?.package_name}</p>
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Effective From</label>
                    <input
                        type="date" required value={assignForm.effectiveFrom}
                        onChange={e => setAssignForm({ ...assignForm, effectiveFrom: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 font-normal">This package settings will apply from the selected date onwards.</p>
                </div>
                <div className="flex gap-3 pt-2">
                    <button
                        type="button" onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-github-dark-text rounded-lg transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                    >
                        Assign Package
                    </button>
                </div>
            </form>
        </>
    );
};

export default AssignEmployeePanel;
