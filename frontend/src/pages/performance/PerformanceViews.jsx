import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Award, FileText, Sparkles, CheckCircle2, Check, RefreshCw, User, AlertCircle, Star, Printer, TrendingUp, TrendingDown, ShieldCheck, Activity, Layers, Calendar, ChevronRight, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';

// HELPER: Fetch goals for an employee & cycle
const getEmployeeGoalsFromStorage = (empId, cycleId) => {
    const localKey = `mano_perf_goals_${empId}_${cycleId}`;
    const stored = localStorage.getItem(localKey);
    
    const variant = Number(empId) % 3;
    let defaultGoals = [];

    if (variant === 0) {
        defaultGoals = [
            { id: 'g-1', title: 'Complete Core Module Sprint Tasks', deadline: '2026-06-15', status: 'Completed', rating: 9, comments: 'Delivered all geofencing modules on time.' },
            { id: 'g-2', title: 'Achieve 95% Bug Resolution within SLA', deadline: '2026-06-20', status: 'Completed', rating: 8, comments: 'Resolved critical blocker tickets inside SLA limits.' },
            { id: 'g-3', title: 'Refactor Legacy Code and reduce smells', deadline: '2026-06-30', status: 'Completed', rating: 9, comments: 'Cleaned up CSS variables and reduced build sizes.' }
        ];
    } else if (variant === 1) {
        defaultGoals = [
            { id: 'g-1', title: 'Review and fix CSS scaling on tablet screens', deadline: '2026-06-15', status: 'Completed', rating: 7, comments: 'Fixed layout queries, but took extra time.' },
            { id: 'g-2', title: 'Conduct user feedback sessions for DAR logging', deadline: '2026-06-20', status: 'In-Progress', rating: 0, comments: '' },
            { id: 'g-3', title: 'Improve unit test coverage by 15%', deadline: '2026-06-30', status: 'Pending', rating: 0, comments: '' }
        ];
    } else {
        defaultGoals = [
            { id: 'g-1', title: 'Complete compliance training courses', deadline: '2026-06-10', status: 'Pending', rating: 0, comments: '' },
            { id: 'g-2', title: 'Update API endpoint error handling structures', deadline: '2026-06-25', status: 'In-Progress', rating: 0, comments: '' }
        ];
    }

    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error(e);
        }
    }
    return defaultGoals;
};

// HELPER: Fetch review data
const getEmployeeReviewFromStorage = (empId, cycleId) => {
    const localKey = `mano_perf_review_${empId}_${cycleId}`;
    const stored = localStorage.getItem(localKey);

    const variant = Number(empId) % 3;
    let defaultReview = {};

    if (variant === 0) {
        defaultReview = {
            selfAchievements: 'Delivered the attendance logging geofencing module ahead of the sprint timeline and verified all check-in edge cases. Mentored two interns.',
            selfChallenges: 'Faced layout scaling problems on specific tablet screen queries, but resolved them by refactoring index.css layout classes.',
            selfLearning: 'Learned HSL color palette designs, advanced Socket.io logic, and local storage state sync layouts.',
            managerComments: 'Consistently check-in on time. Excelled at frontend delivery. Suresh has shown superior engineering quality and was a great mentor this cycle.',
            managerRec: 'Promote to Senior Role',
            lastUpdated: '2026-06-05 11:10:00'
        };
    } else if (variant === 1) {
        defaultReview = {
            selfAchievements: 'Resolved CSS scaling query errors and updated client pages. Set up active DAR notifications.',
            selfChallenges: 'Struggled with unit testing frameworks configuration due to legacy mock setup libraries.',
            selfLearning: 'Learned CSS flexbox grid layouts and Jest mock testing suites.',
            managerComments: 'Good work on UI modifications. Need to show more speed in test cases and complete pending goals.',
            managerRec: 'Retain with Standard Increment',
            lastUpdated: '2026-06-05 13:40:00'
        };
    } else {
        defaultReview = {
            selfAchievements: 'Started refactoring error check routes in backend API systems.',
            selfChallenges: 'Faced frequent connectivity and local check-in deployment blockers.',
            selfLearning: 'Read express API routing documentation and basic node crash logs.',
            managerComments: 'Appraisal progress has been slow. Check-in records have also been irregular this quarter. Needs to show improvement in sprint velocity.',
            managerRec: 'Retain with Performance Improvement Plan',
            lastUpdated: '2026-06-05 16:20:00'
        };
    }

    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error(e);
        }
    }
    return defaultReview;
};

// =====================================================================
// CONSOLIDATED PerformanceHub COMPONENT
// =====================================================================
export const PerformanceHub = ({ employee, selectedCycleId }) => {
    const [goals, setGoals] = useState([]);
    const [review, setReview] = useState(null);
    const [newGoalForm, setNewGoalForm] = useState({ title: '', deadline: '' });
    
    // Rating / Recommendation state
    const [comments, setComments] = useState('');
    const [rec, setRec] = useState('Retain with Standard Increment');

    // Goal currently being edited for rating/comments
    const [editingGoalId, setEditingGoalId] = useState(null);
    const [goalRatingInput, setGoalRatingInput] = useState('8');
    const [goalCommentsInput, setGoalCommentsInput] = useState('');

    useEffect(() => {
        if (employee?.id) {
            setGoals(getEmployeeGoalsFromStorage(employee.id, selectedCycleId));
            const rev = getEmployeeReviewFromStorage(employee.id, selectedCycleId);
            setReview(rev);
            setComments(rev.managerComments || '');
            setRec(rev.managerRec || 'Retain with Standard Increment');
            setEditingGoalId(null);
        }
    }, [employee?.id, selectedCycleId]);

    const saveGoals = (updatedGoals) => {
        setGoals(updatedGoals);
        localStorage.setItem(`mano_perf_goals_${employee.id}_${selectedCycleId}`, JSON.stringify(updatedGoals));
    };

    const handleAddGoal = (e) => {
        e.preventDefault();
        if (!newGoalForm.title || !newGoalForm.deadline) {
            toast.error("Please fill in Goal Title and Due Deadline.");
            return;
        }

        const newGoal = {
            id: `goal-${Date.now()}`,
            title: newGoalForm.title,
            deadline: newGoalForm.deadline,
            status: 'Pending',
            rating: 0,
            comments: ''
        };

        const updated = [...goals, newGoal];
        saveGoals(updated);
        setNewGoalForm({ title: '', deadline: '' });
        toast.success("Appraisal Goal assigned successfully!");
    };

    const updateGoalField = (goalId, key, value) => {
        const updated = goals.map(g => {
            if (g.id === goalId) {
                return { ...g, [key]: value };
            }
            return g;
        });
        saveGoals(updated);
    };

    const handleDeleteGoal = (goalId) => {
        const updated = goals.filter(g => g.id !== goalId);
        saveGoals(updated);
        toast.info("Goal removed from sheet");
        if (editingGoalId === goalId) setEditingGoalId(null);
    };

    const handleSaveGoalReview = (goalId) => {
        const updated = goals.map(g => {
            if (g.id === goalId) {
                return {
                    ...g,
                    rating: parseInt(goalRatingInput),
                    comments: goalCommentsInput
                };
            }
            return g;
        });
        saveGoals(updated);
        setEditingGoalId(null);
        toast.success("Goal rating and comments saved.");
    };

    const handleSaveOverallAppraisal = (e) => {
        e.preventDefault();
        const updatedReview = {
            ...review,
            managerComments: comments,
            managerRec: rec,
            lastUpdated: new Date().toLocaleString()
        };
        setReview(updatedReview);
        localStorage.setItem(`mano_perf_review_${employee.id}_${selectedCycleId}`, JSON.stringify(updatedReview));
        toast.success("Appraisal report updated successfully!");
    };

    // Calculate arithmetic average score
    const ratedGoals = goals.filter(g => g.rating > 0);
    const totalRating = ratedGoals.reduce((sum, g) => sum + g.rating, 0);
    const averageScore = ratedGoals.length > 0 ? (totalRating / ratedGoals.length) : 0;
    const formattedAverageScore = Math.round(averageScore * 10) / 10;

    return (
        <div className="space-y-6 text-xs">
            {/* KPI Performance Header Score Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 p-4 bg-slate-50 dark:bg-[#161b22]/30 border border-slate-200 dark:border-github-dark-border rounded-xl flex flex-col justify-between">
                    <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                            <Award size={16} className="text-indigo-500" />
                            Performance Hub & Appraisal Panel
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                            Assign goals to employees, track execution progress, and record manager review feedback. The overall rating is calculated as a simple arithmetic average of all rated goals.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 mt-4 text-[10px] font-mono text-slate-455">
                        <span>Staff: <strong>{employee?.name}</strong> ({employee?.designation})</span>
                        <span>•</span>
                        <span>Dept: <strong>{employee?.department}</strong></span>
                    </div>
                </div>

                <div className="p-4 border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-xl flex flex-col items-center justify-center text-center">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500">Average Performance Rating</span>
                    <div className="text-3xl font-extrabold text-indigo-655 dark:text-indigo-400 my-1.5">
                        {formattedAverageScore > 0 ? `${formattedAverageScore} / 10` : 'Unrated'}
                    </div>
                    <div className="w-full bg-slate-200/50 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-indigo-500" style={{ width: `${formattedAverageScore * 10}%` }}></div>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
                        {ratedGoals.length} of {goals.length} goals rated
                    </span>
                </div>
            </div>

            {/* Main Content splits */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* Column A: Goals List & Review Matrix (8 Cols) */}
                <div className="lg:col-span-8 space-y-4">
                    
                    {/* Goal Assignment Matrix */}
                    <div className="bg-white dark:bg-[#161b22]/30 border border-slate-205 dark:border-github-dark-border rounded-xl p-4 space-y-4">
                        <div className="border-b border-slate-100 dark:border-github-dark-border pb-3 flex-wrap gap-2">
                            <h5 className="font-bold text-slate-800 dark:text-github-dark-text">Assigned Performance Goals</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">Establish targets, check completion status, and rate execution.</p>
                        </div>

                        <div className="space-y-4">
                            {goals.length > 0 ? (
                                goals.map(goal => {
                                    const isEditing = editingGoalId === goal.id;
                                    return (
                                        <div key={goal.id} className="p-4 border border-slate-200 dark:border-github-dark-border rounded-xl bg-slate-50/50 dark:bg-github-dark-subtle/5 space-y-3">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-1.5 flex-1">
                                                    <span className="font-bold text-slate-850 dark:text-github-dark-text text-[13px] block">{goal.title}</span>
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-3 font-mono">
                                                        <span>Due: {goal.deadline}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            Status:
                                                            <select
                                                                value={goal.status}
                                                                onChange={(e) => updateGoalField(goal.id, 'status', e.target.value)}
                                                                className="bg-transparent border-b border-slate-200 dark:border-github-dark-border font-bold text-slate-600 dark:text-slate-350 focus:outline-none cursor-pointer"
                                                            >
                                                                <option value="Pending">Pending</option>
                                                                <option value="In-Progress">In-Progress</option>
                                                                <option value="Completed">Completed</option>
                                                                <option value="Deferred">Deferred</option>
                                                            </select>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    {!isEditing && (
                                                        <button
                                                            onClick={() => {
                                                                setEditingGoalId(goal.id);
                                                                setGoalRatingInput(String(goal.rating || 8));
                                                                setGoalCommentsInput(goal.comments || '');
                                                            }}
                                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-github-dark-subtle dark:hover:bg-[#30363d] text-slate-700 dark:text-github-dark-text rounded text-[10px] font-bold shadow-sm"
                                                        >
                                                            {goal.rating > 0 ? 'Edit Review' : 'Rate Goal'}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteGoal(goal.id)}
                                                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-red-500 rounded"
                                                        title="Remove Goal"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Rating and comments output */}
                                            {goal.rating > 0 && !isEditing && (
                                                <div className="p-3 bg-white dark:bg-dark-card border border-slate-150 dark:border-github-dark-border rounded-xl space-y-2">
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-450 uppercase font-black tracking-wider block">Goal Score</span>
                                                        <span className="font-bold text-indigo-650 dark:text-indigo-400 flex items-center gap-0.5"><Star size={11} fill="currentColor" /> {goal.rating} / 10</span>
                                                    </div>
                                                    {goal.comments && (
                                                        <p className="text-slate-600 dark:text-slate-350 leading-relaxed font-semibold italic text-[11px]">
                                                            "{goal.comments}"
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Interactive editing review panel */}
                                            {isEditing && (
                                                <div className="p-3 bg-white dark:bg-dark-card border border-indigo-150 dark:border-indigo-950/40 rounded-xl space-y-3 shadow-inner">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Goal Score (1-10)</label>
                                                            <select
                                                                value={goalRatingInput}
                                                                onChange={(e) => setGoalRatingInput(e.target.value)}
                                                                className="w-full px-2 py-1 bg-slate-50 dark:bg-[#161b22] border border-slate-250 dark:border-github-dark-border rounded focus:outline-none"
                                                            >
                                                                {[...Array(10)].map((_, i) => (
                                                                    <option key={i+1} value={i+1}>{i+1} / 10</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="flex items-end justify-end gap-2">
                                                            <button
                                                                onClick={() => setEditingGoalId(null)}
                                                                className="px-2 py-1 text-slate-450 hover:text-slate-700"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => handleSaveGoalReview(goal.id)}
                                                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold transition-all shadow-sm"
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Feedback Comments & Notes</label>
                                                        <textarea
                                                            value={goalCommentsInput}
                                                            onChange={(e) => setGoalCommentsInput(e.target.value)}
                                                            placeholder="Enter feedback comments for this goal..."
                                                            className="w-full p-2 text-xs bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                            rows={2}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="py-12 text-center text-slate-450 italic">No goals assigned to this appraisal cycle yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Overall Summary appraisal comments */}
                    <div className="bg-white dark:bg-[#161b22]/30 border border-slate-200 dark:border-github-dark-border rounded-xl p-4 space-y-4">
                        <div className="border-b border-slate-100 dark:border-github-dark-border pb-2">
                            <h5 className="font-bold text-slate-800 dark:text-github-dark-text">Cycle Audit Recommendation & Summary</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">Submit the official recommendation and summary appraisal comments.</p>
                        </div>
                        
                        <form onSubmit={handleSaveOverallAppraisal} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 font-bold block uppercase">Official Recommendation *</label>
                                    <select
                                        value={rec}
                                        onChange={(e) => setRec(e.target.value)}
                                        required
                                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg text-xs"
                                    >
                                        <option value="Promote to Senior Role">Promote to Senior Role</option>
                                        <option value="Retain with Standard Increment">Retain with Standard Increment</option>
                                        <option value="Retain with Performance Improvement Plan">Retain with Performance Improvement Plan (PIP)</option>
                                        <option value="Cycle Deferred">Cycle Deferred</option>
                                    </select>
                                </div>
                                
                                {review?.lastUpdated && (
                                    <div className="flex items-end justify-end text-[9px] text-slate-400 font-mono pb-2">
                                        Last saved: {review.lastUpdated}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-bold block uppercase">Overall Appraisal Comments & Summary Feedback *</label>
                                <textarea
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    required
                                    rows={3}
                                    placeholder="Detail overall strengths, achievements, and feedback metrics..."
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl text-xs focus:outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                className="px-4 py-2 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm active:scale-98 transition-all"
                            >
                                <Check size={14} /> Submit Final Appraisal Review
                            </button>
                        </form>
                    </div>

                </div>

                {/* Column B: Goal Creation Form & Self-Appraisal (4 Cols) */}
                <div className="lg:col-span-4 space-y-4">
                    
                    {/* Goal Creation Form */}
                    <div className="bg-white dark:bg-[#161b22]/30 border border-slate-200 dark:border-github-dark-border rounded-xl p-4 space-y-4">
                        <h5 className="font-bold text-slate-800 dark:text-github-dark-text border-b border-slate-100 dark:border-github-dark-border pb-2">Assign Appraisal Goal</h5>
                        
                        <form onSubmit={handleAddGoal} className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-bold block uppercase">Goal Title *</label>
                                <textarea
                                    required
                                    value={newGoalForm.title}
                                    onChange={(e) => setNewGoalForm({ ...newGoalForm, title: e.target.value })}
                                    placeholder="e.g. Optimize React rendering and decrease LCP index speed"
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-bold block uppercase">Due Deadline *</label>
                                <input
                                    type="date"
                                    required
                                    value={newGoalForm.deadline}
                                    onChange={(e) => setNewGoalForm({ ...newGoalForm, deadline: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg text-xs"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-2.5 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg font-bold flex justify-center items-center gap-1 shadow-sm transition-all mt-2"
                            >
                                <Plus size={14} /> Assign Goal
                            </button>
                        </form>
                    </div>

                    {/* Employee Self appraisal report card */}
                    <div className="bg-white dark:bg-[#161b22]/30 border border-slate-200 dark:border-github-dark-border rounded-xl p-4 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-github-dark-border pb-2">
                            <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                                <User size={15} className="text-[#0969da]" />
                                Employee Self-Review
                            </h5>
                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 rounded text-[9px] font-bold uppercase border border-emerald-500/20">
                                Submitted
                            </span>
                        </div>

                        {review ? (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <span className="font-bold text-slate-450 text-[9px] uppercase block">1. Key Achievements</span>
                                    <p className="text-slate-655 dark:text-slate-300 leading-relaxed font-semibold bg-slate-50 dark:bg-github-dark-subtle/10 p-2.5 rounded-lg">
                                        "{review.selfAchievements || 'None reported.'}"
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <span className="font-bold text-slate-450 text-[9px] uppercase block">2. Obstacles & Challenges</span>
                                    <p className="text-slate-655 dark:text-slate-300 leading-relaxed font-semibold bg-slate-50 dark:bg-github-dark-subtle/10 p-2.5 rounded-lg">
                                        "{review.selfChallenges || 'None reported.'}"
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <span className="font-bold text-slate-450 text-[9px] uppercase block">3. Competencies & Learnings</span>
                                    <p className="text-slate-655 dark:text-slate-300 leading-relaxed font-semibold bg-slate-50 dark:bg-github-dark-subtle/10 p-2.5 rounded-lg">
                                        "{review.selfLearning || 'None reported.'}"
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="py-4 text-center text-slate-450 italic">No self review details registered.</p>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
};

// =====================================================================
// AI PERFORMANCE ANALYZER VIEW
// ==================================================================// AI PERFORMANCE ANALYZER VIEW
// =====================================================================
export const AiPerformanceAnalyzer = ({ employee, selectedCycleId, employeeId, employeeName, cycleId }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [auditStep, setAuditStep] = useState(0); // 0: Idle, 1: Check-in, 2: KPI SLA, 3: Sentiment, 4: Done
    const [aiResult, setAiResult] = useState(null);
    const [showReportCardModal, setShowReportCardModal] = useState(false);

    const empId = employee?.id || employeeId || 101;
    const empName = employee?.name || employeeName || 'Employee';
    const empDept = employee?.department || 'General';
    const activeCycleId = selectedCycleId || cycleId || 'cycle-2';

    useEffect(() => {
        if (empId) {
            setAiResult(null);
            setAuditStep(0);
            const storedReport = localStorage.getItem(`mano_perf_ai_${empId}_${activeCycleId}`);
            if (storedReport) {
                try {
                    setAiResult(JSON.parse(storedReport));
                } catch(e) {
                    console.error(e);
                }
            }
        }
    }, [empId, activeCycleId]);

    const runAiPerformanceAnalysis = () => {
        if (!empId) return;
        setIsAnalyzing(true);
        setAiResult(null);
        
        // Multi-stage audit animation
        setAuditStep(1);
        setTimeout(() => {
            setAuditStep(2);
            setTimeout(() => {
                setAuditStep(3);
                setTimeout(() => {
                    setAuditStep(4);
                    
                    // Generate results
                    const goals = getEmployeeGoalsFromStorage(empId, activeCycleId);
                    const review = getEmployeeReviewFromStorage(empId, activeCycleId);

                    const totalGoals = goals.length;
                    const completedGoals = goals.filter(g => g.status === 'Completed').length;
                    const completionRate = totalGoals > 0 ? (completedGoals / totalGoals) : 1;
                    
                    const ratedGoals = goals.filter(g => g.rating > 0);
                    const totalRating = ratedGoals.reduce((sum, g) => sum + g.rating, 0);
                    const ratingScore = ratedGoals.length > 0 ? (totalRating / ratedGoals.length) : 8.0;
                    
                    let overallScore = ((completionRate * 10) + ratingScore) / 2;
                    overallScore = Math.round(overallScore * 10) / 10;

                    let readiness = 'Medium';
                    if (overallScore >= 8.5) readiness = 'High';
                    if (overallScore < 7.0) readiness = 'Low';

                    const strengths = [];
                    const improvements = [];

                    // Attendance compliance logs simulation
                    const empIdNum = parseInt(empId) || 101;
                    const punctuality = Math.round((93 + (empIdNum % 7)) * 10) / 10; // 93% to 99%
                    const totalShifts = 62 + (empIdNum % 5);
                    const lateArrivals = empIdNum % 4;
                    const leaves = empIdNum % 3;

                    if (punctuality >= 95) {
                        strengths.push(`Superior shift check-in punctuality rate of ${punctuality}%`);
                        strengths.push(`Consistent work hours and low absenteeism (${leaves} leaves in cycle)`);
                    } else {
                        strengths.push(`Standard attendance presence with ${punctuality}% punctuality`);
                        improvements.push(`Improve check-in times to minimize delayed arrivals (${lateArrivals} late instances)`);
                    }

                    if (overallScore >= 8.0) {
                        strengths.push("Excellent task SLA velocity with on-time milestone delivery.");
                        strengths.push("Exceptional execution quality and self-monitoring capabilities.");
                    } else {
                        strengths.push("Satisfactory basic delivery of cycle objectives.");
                        improvements.push("Speed up resolution SLAs and review pending goals.");
                    }

                    if (review.selfLearning && review.selfLearning.length > 15) {
                        strengths.push("Proactive skills acquisition and self-learning dedication.");
                    }

                    if (review.selfChallenges && review.selfChallenges.length > 15) {
                        improvements.push("Address technical bottlenecks related to workflow styling and configurations.");
                    } else {
                        improvements.push("Standardize code comments and enhance deployment configurations.");
                    }

                    const appraisalKeyLabel = overallScore >= 8.5 ? 'superior' : 'competent';
                    const analysisReport = {
                        score: overallScore,
                        readiness,
                        strengths,
                        improvements,
                        summary: `Employee shows strong capability in general tasks. Overall performance is rated as ${appraisalKeyLabel} with a total index score of ${overallScore}/10. Task completion stands at ${completedGoals}/${totalGoals} goals during the cycle. Check-in compliance stands at ${punctuality}% over ${totalShifts} shifts.`,
                        attendance: {
                            punctuality,
                            totalShifts,
                            lateArrivals,
                            leaves
                        },
                        kpis: {
                            total: totalGoals,
                            completed: completedGoals,
                            completionRate: Math.round(completionRate * 100)
                        },
                        alignment: {
                            selfRating: review.selfAchievements ? 8.5 : 0,
                            managerRating: ratingScore,
                            gap: review.selfAchievements ? Math.round((ratingScore - 8.5) * 10) / 10 : 0
                        }
                    };

                    setAiResult(analysisReport);
                    setIsAnalyzing(false);
                    localStorage.setItem(`mano_perf_ai_${empId}_${activeCycleId}`, JSON.stringify(analysisReport));
                    toast.success("AI performance audit complete!");
                }, 600);
            }, 600);
        }, 600);
    };

    const handlePrint = () => {
        const printContent = document.getElementById('printable-appraisal-report');
        if (!printContent) return;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Appraisal Report Card - ${empName}</title>
                    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                    <style>
                        body { background: white; color: #1e293b; padding: 40px; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
                        @media print {
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body class="flex items-center justify-center min-h-screen">
                    <div class="w-full max-w-2xl border-8 border-double border-indigo-900 rounded-xl p-8 bg-white relative">
                        ${printContent.innerHTML}
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            // Optional: window.close();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const getScoreBadgeDetails = (score) => {
        if (score >= 8.5) return { label: 'Outstanding', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' };
        if (score >= 7.5) return { label: 'Exceeds Expectations', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' };
        if (score >= 6.0) return { label: 'Meets Expectations', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' };
        return { label: 'Underperforming', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' };
    };

    return (
        <div className="space-y-6 text-xs select-none">
            {/* Analyzer Controls Card */}
            <div className="bg-slate-50/50 dark:bg-[#161b22]/30 border border-slate-205 dark:border-github-dark-border rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-sm flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-550 dark:text-indigo-400" />
                        AI Performance Auditor & Summary Generator
                    </h4>
                </div>

                <p className="text-slate-500 dark:text-github-dark-muted leading-relaxed text-[11px]">
                    The AI Analyzer audits employee index ratings. It compiles **Check-in Attendance compliance**, **KPI Completion percent rates**, and **Manager Rating reviews** to formulate a comprehensive appraisal report card.
                </p>

                {isAnalyzing ? (
                    <div className="py-6 space-y-4">
                        {/* Custom visual progress list */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between font-semibold">
                                <span className="text-slate-700 dark:text-slate-350">Appraisal Engine Audits in Progress</span>
                                <span className="text-indigo-600 dark:text-indigo-400">{auditStep * 25}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-850 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-indigo-600 dark:bg-indigo-400 h-full transition-all duration-300"
                                    style={{ width: `${auditStep * 25}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="space-y-2 pl-1.5 font-semibold text-[10px] text-slate-450 dark:text-github-dark-muted">
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${auditStep >= 1 ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-800 animate-pulse'}`}></span>
                                <span className={auditStep === 1 ? 'text-slate-800 dark:text-slate-200' : ''}>Auditing check-in attendance compliance logs...</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${auditStep >= 2 ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-800'}`}></span>
                                <span className={auditStep === 2 ? 'text-slate-800 dark:text-slate-200' : ''}>Analyzing KPI goal completion deadlines and SLAs...</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${auditStep >= 3 ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-800'}`}></span>
                                <span className={auditStep === 3 ? 'text-slate-800 dark:text-slate-200' : ''}>Synthesizing manager rating scores & reviews...</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${auditStep >= 4 ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-800'}`}></span>
                                <span className={auditStep === 4 ? 'text-slate-800 dark:text-slate-200 animate-pulse' : ''}>Formulating Overall Appraisal Index Report Card...</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={runAiPerformanceAnalysis}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex justify-center items-center gap-1.5 shadow-md shadow-indigo-100 dark:shadow-none transition-all active:scale-98"
                    >
                        <Sparkles size={14} /> Auditing Performance & Generate AI Report
                    </button>
                )}
            </div>

            {/* AI Evaluation Report Output Card */}
            {aiResult && !isAnalyzing && (
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-[#0d1117] border border-slate-205 dark:border-github-dark-border rounded-xl p-5 space-y-5 shadow-sm"
                >
                    {/* Visual Appraisal Dial & Rating Header */}
                    <div className="flex flex-col md:flex-row gap-5 items-stretch border-b border-slate-100 dark:border-github-dark-border pb-4">
                        <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-github-dark-subtle/10 border border-slate-150 dark:border-github-dark-border/60 rounded-xl p-4 md:w-1/3 min-w-[160px] text-center">
                            <span className="text-[10px] text-slate-450 dark:text-github-dark-muted font-bold uppercase tracking-wider">Appraisal Index</span>
                            
                            {/* Dial Visual Circle */}
                            <div className="relative w-24 h-24 flex items-center justify-center my-3">
                                <svg className="absolute w-full h-full" viewBox="0 0 96 96">
                                    <g transform="rotate(-90 48 48)">
                                        <circle 
                                            cx="48" 
                                            cy="48" 
                                            r="40" 
                                            className="stroke-slate-200 dark:stroke-slate-800 fill-none"
                                            strokeWidth="8"
                                        />
                                        <circle 
                                            cx="48" 
                                            cy="48" 
                                            r="40" 
                                            className="stroke-indigo-600 dark:stroke-indigo-400 fill-none transition-all"
                                            strokeWidth="8"
                                            strokeDasharray={251.2}
                                            strokeDashoffset={251.2 - (251.2 * (aiResult.score || 8)) / 10}
                                            strokeLinecap="round"
                                        />
                                    </g>
                                </svg>
                                <div className="flex flex-col items-center justify-center">
                                    <span className="text-2xl font-black text-slate-800 dark:text-[#f0f6fc]">{aiResult.score}</span>
                                    <span className="text-[9px] text-slate-400 font-mono">OF 10</span>
                                </div>
                            </div>

                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreBadgeDetails(aiResult.score).color}`}>
                                {getScoreBadgeDetails(aiResult.score).label}
                            </span>
                        </div>

                        {/* Summary & Details */}
                        <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-sm">Appraisal Index Summary Report</h4>
                                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{empName} ({empDept})</p>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-xl ${
                                        aiResult.readiness === 'High' 
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' 
                                            : aiResult.readiness === 'Medium' 
                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' 
                                                : 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                                    }`}>
                                        Readiness: {aiResult.readiness}
                                    </span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-semibold mt-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/5 border border-slate-100 dark:border-github-dark-border/40 rounded-xl">
                                    {aiResult.summary}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Visual Auditing Details Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Attendance Auditor Card */}
                        <div className="border border-slate-200 dark:border-github-dark-border/70 bg-slate-50/30 dark:bg-github-dark-subtle/5 p-3 rounded-xl flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                                    <Activity size={14} className="text-emerald-500" />
                                    <span>Check-in Attendance</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-slate-800 dark:text-[#f0f6fc]">{aiResult.attendance.punctuality}%</span>
                                    <span className="text-[9px] text-slate-400 font-bold">Punctuality</span>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5">
                                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full" style={{ width: `${aiResult.attendance.punctuality}%` }}></div>
                                </div>
                                <div className="flex justify-between items-center text-[9px] font-mono text-slate-450 dark:text-github-dark-muted font-semibold">
                                    <span>{aiResult.attendance.totalShifts} Shifts</span>
                                    <span>{aiResult.attendance.lateArrivals} Late | {aiResult.attendance.leaves} Leaves</span>
                                </div>
                            </div>
                        </div>

                        {/* KPI Completion SLA Card */}
                        <div className="border border-slate-200 dark:border-github-dark-border/70 bg-slate-50/30 dark:bg-github-dark-subtle/5 p-3 rounded-xl flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                                    <Layers size={14} className="text-indigo-500" />
                                    <span>KPI Completion SLA</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-slate-800 dark:text-[#f0f6fc]">{aiResult.kpis.completionRate}%</span>
                                    <span className="text-[9px] text-slate-400 font-bold">Goal Success Rate</span>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5">
                                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-indigo-650 dark:bg-indigo-400 h-full" style={{ width: `${aiResult.kpis.completionRate}%` }}></div>
                                </div>
                                <div className="flex justify-between items-center text-[9px] font-mono text-slate-450 dark:text-github-dark-muted font-semibold">
                                    <span>Completed {aiResult.kpis.completed} of {aiResult.kpis.total}</span>
                                    <span>On-Time SLA: {aiResult.kpis.completionRate}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Evaluation Alignment Gap */}
                        <div className="border border-slate-200 dark:border-github-dark-border/70 bg-slate-50/30 dark:bg-github-dark-subtle/5 p-3 rounded-xl flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                                    <Award size={14} className="text-blue-500" />
                                    <span>Evaluation Alignment</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-xl font-black ${
                                        aiResult.alignment.gap === 0 ? 'text-slate-800 dark:text-[#f0f6fc]' :
                                        aiResult.alignment.gap > 0 ? 'text-emerald-500' : 'text-amber-500'
                                    }`}>
                                        {aiResult.alignment.gap === 0 ? 'Aligned' : 
                                         aiResult.alignment.gap > 0 ? `+${aiResult.alignment.gap} Gap` : `${aiResult.alignment.gap} Gap`}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold">Discrepancy</span>
                                </div>
                            </div>
                            <div className="mt-3 pt-1 border-t border-slate-100 dark:border-github-dark-border/40 flex justify-between items-center text-[9px] font-mono text-slate-450 dark:text-github-dark-muted font-semibold">
                                <span>Manager: {aiResult.alignment.managerRating}/10</span>
                                <span>Self: {aiResult.alignment.selfRating > 0 ? `${aiResult.alignment.selfRating}/10` : 'Unrated'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Strengths & Weaknesses SWOT grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-emerald-100 dark:border-emerald-950/20 bg-emerald-500/[0.02] dark:bg-emerald-950/5 p-4 rounded-xl space-y-3">
                            <span className="font-black text-emerald-650 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                <CheckCircle2 size={13} /> Audited Key Strengths
                            </span>
                            <ul className="text-slate-655 dark:text-slate-300 space-y-2.5">
                                {aiResult.strengths.map((str, i) => (
                                    <li key={i} className="flex gap-2 items-start font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5"></span>
                                        <span>{str}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="border border-amber-100 dark:border-amber-950/20 bg-amber-500/[0.02] dark:bg-amber-950/5 p-4 rounded-xl space-y-3">
                            <span className="font-black text-amber-650 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                <AlertCircle size={13} /> Areas for Improvement
                            </span>
                            <ul className="text-slate-655 dark:text-slate-300 space-y-2.5">
                                {aiResult.improvements.map((imp, i) => (
                                    <li key={i} className="flex gap-2 items-start font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5"></span>
                                        <span>{imp}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Report Card Controls Button Bar */}
                    <div className="pt-4 border-t border-slate-100 dark:border-github-dark-border flex justify-end gap-3 flex-wrap">
                        <button
                            onClick={runAiPerformanceAnalysis}
                            className="px-4 py-2 border border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-97"
                        >
                            <RefreshCw size={14} />
                            <span>Re-run Audit</span>
                        </button>
                        
                        <button
                            onClick={() => setShowReportCardModal(true)}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-indigo-150 transition-all active:scale-97"
                        >
                            <Printer size={14} />
                            <span>View & Print Official Report Card</span>
                        </button>
                    </div>
                </motion.div>
            )}

            {/* REPORT CARD MODAL OVERLAY */}
            {showReportCardModal && aiResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/10">
                            <h4 className="font-black text-slate-850 dark:text-github-dark-text flex items-center gap-1.5 text-xs">
                                <Award size={15} className="text-indigo-600" />
                                Appraisal Report Card Preview
                            </h4>
                            <button 
                                onClick={() => setShowReportCardModal(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        {/* Certificate Wrapper Content */}
                        <div className="flex-1 p-6 overflow-y-auto">
                            <div 
                                id="printable-appraisal-report"
                                className="bg-white text-slate-800 border-8 border-double border-indigo-900 rounded-xl p-8 relative flex flex-col justify-between"
                            >
                                {/* Background Seal Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
                                    <Sparkles size={300} className="text-indigo-950" />
                                </div>

                                <div className="space-y-6 relative z-10">
                                    {/* Company Title */}
                                    <div className="text-center border-b pb-4 border-slate-200">
                                        <h2 className="text-lg font-black tracking-widest text-indigo-950">MANO</h2>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Attendance & Performance Audit Systems</p>
                                    </div>

                                    {/* Report Label */}
                                    <div className="text-center space-y-1">
                                        <h3 className="text-base font-black text-slate-900 tracking-wider">OFFICIAL EMPLOYEE APPRAISAL SCORECARD</h3>
                                        <p className="text-[10px] text-slate-450 font-bold uppercase">Cycle: {activeCycleId.replace('cycle-', 'Q')}</p>
                                    </div>

                                    {/* Employee Details Grid */}
                                    <div className="grid grid-cols-2 gap-y-3 bg-slate-50 p-4 border rounded-xl text-[10px] font-semibold text-slate-700">
                                        <div>
                                            <span className="text-[8px] text-slate-400 block uppercase font-bold">Employee Name</span>
                                            <span className="font-bold text-slate-900">{empName}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] text-slate-400 block uppercase font-bold">Department</span>
                                            <span className="font-bold text-slate-900">{empDept}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] text-slate-400 block uppercase font-bold">Appraisal Index Rating</span>
                                            <span className="font-bold text-indigo-900">{aiResult.score} / 10 ({getScoreBadgeDetails(aiResult.score).label})</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] text-slate-400 block uppercase font-bold">Verification Seal</span>
                                            <span className="font-black text-emerald-600 flex items-center gap-1">
                                                <ShieldCheck size={12} />
                                                <span>MANO AI COMPLIANT</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Auditor Section */}
                                    <div className="space-y-3">
                                        <h4 className="font-black text-indigo-900 border-b border-indigo-100 pb-1 text-[10px] uppercase">AI Appraisal Executive Assessment</h4>
                                        <p className="text-[10px] leading-relaxed text-slate-655 italic font-medium">
                                            "{aiResult.summary}"
                                        </p>
                                    </div>

                                    {/* SWOT summary */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1 bg-emerald-50/30 p-3 border border-emerald-100 rounded-xl">
                                            <span className="text-[9px] font-black text-emerald-850 flex items-center gap-1 uppercase"><CheckCircle2 size={11} /> Audited Strengths</span>
                                            <ul className="text-[9px] text-slate-700 space-y-1 font-semibold">
                                                {aiResult.strengths.slice(0, 2).map((str, i) => (
                                                    <li key={i} className="flex gap-1 items-start">
                                                        <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                                                        <span>{str}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="space-y-1 bg-amber-50/30 p-3 border border-amber-100 rounded-xl">
                                            <span className="text-[9px] font-black text-amber-850 flex items-center gap-1 uppercase"><AlertCircle size={11} /> Improvements</span>
                                            <ul className="text-[9px] text-slate-700 space-y-1 font-semibold">
                                                {aiResult.improvements.slice(0, 2).map((imp, i) => (
                                                    <li key={i} className="flex gap-1 items-start">
                                                        <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                                                        <span>{imp}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Signatures */}
                                    <div className="pt-8 border-t border-dashed grid grid-cols-3 gap-4 text-center text-[9px] font-semibold text-slate-400">
                                        <div className="space-y-3 flex flex-col justify-end items-center">
                                            <span className="text-slate-800 italic font-cursive text-sm text-indigo-900 opacity-60">Verified via AI</span>
                                            <div className="w-full border-t border-slate-200 pt-1.5 font-bold uppercase tracking-wider text-[8px]">Appraisal Auditor Stamp</div>
                                        </div>
                                        <div className="space-y-3 flex flex-col justify-end items-center">
                                            <div className="h-6"></div>
                                            <div className="w-full border-t border-slate-200 pt-1.5 font-bold uppercase tracking-wider text-[8px]">Manager Signature</div>
                                        </div>
                                        <div className="space-y-3 flex flex-col justify-end items-center">
                                            <div className="h-6"></div>
                                            <div className="w-full border-t border-slate-200 pt-1.5 font-bold uppercase tracking-wider text-[8px]">HR Director Acknowledged</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Controls */}
                        <div className="p-4 border-t border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/10 flex justify-end gap-2.5">
                            <button
                                onClick={() => setShowReportCardModal(false)}
                                className="px-4 py-2 border border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-350 font-bold rounded-xl"
                            >
                                Close Preview
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-97"
                            >
                                <Printer size={14} />
                                <span>Print / Save as PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// =====================================================================
// BACKWARD COMPATIBILITY EXPORTS
// =====================================================================
export const KpiGoalSheets = ({ employeeId, cycleId }) => {
    const mockEmployee = { id: employeeId, department: 'General' };
    return <PerformanceHub employee={mockEmployee} selectedCycleId={cycleId} />;
};

export const ReviewsAndRatings = ({ employeeId, cycleId }) => {
    const mockEmployee = { id: employeeId, department: 'General' };
    return <PerformanceHub employee={mockEmployee} selectedCycleId={cycleId} />;
};
