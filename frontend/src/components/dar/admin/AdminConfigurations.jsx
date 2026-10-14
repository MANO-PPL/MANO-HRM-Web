
import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, Trash2, X } from 'lucide-react';
import api from '../../../services/api';
import { toast } from 'react-toastify';

const AdminConfigurations = ({ onClose }) => {
    // --- SETTINGS STATE ---
    const [categories, setCategories] = useState([]);
    const [newCat, setNewCat] = useState("");
    const [bufferTime, setBufferTime] = useState(30);
    const [loadingSettings, setLoadingSettings] = useState(false);

    // Fetch Settings
    const fetchSettings = async () => {
        setLoadingSettings(true);
        try {
            const res = await api.get('/dar/settings/list');
            if (res.data.ok) {
                setCategories(res.data.data.categories);
                setBufferTime(res.data.data.buffer_minutes);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load settings");
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleSaveSettings = async () => {
        try {
            await api.post('/dar/settings/update', {
                buffer_minutes: parseInt(bufferTime),
                categories
            });
            toast.success("Settings updated successfully!");
        } catch (err) {
            toast.error("Failed to update settings");
        }
    };

    const handleAddCategory = async () => {
        if (newCat.trim()) {
            const updated = [...categories, newCat.trim()];
            setCategories(updated);
            setNewCat("");
            try {
                await api.post('/dar/settings/update', {
                    buffer_minutes: parseInt(bufferTime),
                    categories: updated
                });
                toast.success("Category added");
            } catch (err) {
                toast.error("Failed to add category");
            }
        }
    };

    const handleRemoveCategory = async (cat) => {
        const updated = categories.filter(c => c !== cat);
        setCategories(updated);
        try {
            await api.post('/dar/settings/update', {
                buffer_minutes: parseInt(bufferTime),
                categories: updated
            });
            toast.success("Category removed");
        } catch (err) {
            toast.error("Failed to remove category");
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-github-dark-subtle overflow-hidden text-slate-800 dark:text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-200/80 dark:border-github-dark-border bg-white dark:bg-github-dark-subtle shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 -ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer active:scale-95"
                            title="Close configurations"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                        <Settings size={15} className="text-indigo-600 dark:text-indigo-400" />
                        Configurations
                    </h2>
                </div>
                <button
                    onClick={handleSaveSettings}
                    className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all text-xs shadow-xs cursor-pointer active:scale-95"
                >
                    <Save size={13} />
                    Save
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 pb-8 sm:pb-4 flex flex-col gap-3.5 sm:gap-4">

                {/* Section 1: Categories */}
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-0.5">Activity Categories</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                        Standard activities available for employees to select when logging daily tasks.
                    </p>

                    {/* Add Category Input */}
                    <div className="flex gap-1.5 mb-2.5">
                        <input
                            type="text"
                            value={newCat}
                            onChange={(e) => setNewCat(e.target.value)}
                            placeholder="Enter new category..."
                            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <button
                            type="button"
                            onClick={handleAddCategory}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-95"
                            title="Add category"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {/* Category List */}
                    <div className="grid grid-cols-2 gap-1.5 max-h-[260px] sm:max-h-[300px] overflow-y-auto custom-scrollbar pr-0.5">
                        {categories.map((cat, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-github-dark-border rounded-lg group hover:border-indigo-300 dark:hover:border-indigo-800 transition-all text-xs"
                            >
                                <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-1 text-[11px]" title={cat}>
                                    {cat}
                                </span>
                                <button
                                    onClick={() => handleRemoveCategory(cat)}
                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors shrink-0 cursor-pointer opacity-70 group-hover:opacity-100"
                                    title={`Remove ${cat}`}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-200 dark:border-github-dark-border text-slate-400 text-xs italic">
                                <Settings size={20} className="mb-1 opacity-25" />
                                No categories defined. Add one above.
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full h-[1px] bg-slate-100 dark:bg-github-dark-border"></div>

                {/* Section 2: Buffer Time */}
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Grace Period Buffer</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5 leading-relaxed">
                        Leeway minutes allowed after current time for 'Execution Mode' tasks. Tasks logged after this are marked as future planning.
                    </p>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-github-dark-border rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Execution Buffer</div>
                                <div className="text-[10px] text-slate-400">Current setting</div>
                            </div>
                            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-github-dark-border rounded-lg p-0.5 shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => setBufferTime(Math.max(0, bufferTime - 5))}
                                    className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all font-bold text-xs cursor-pointer"
                                >
                                    -
                                </button>
                                <span className="w-11 text-center font-bold text-xs text-slate-800 dark:text-slate-100">
                                    {bufferTime}m
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setBufferTime(bufferTime + 5)}
                                    className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all font-bold text-xs cursor-pointer"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-github-dark-border/60">
                            <span className="text-[10px] text-slate-400 mr-1">Presets:</span>
                            {[15, 30, 45, 60].map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setBufferTime(m)}
                                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${
                                        bufferTime === m
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-github-dark-border hover:border-indigo-300'
                                    }`}
                                >
                                    {m}m
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminConfigurations;
