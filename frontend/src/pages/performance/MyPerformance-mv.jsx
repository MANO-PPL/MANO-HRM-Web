import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import MobileSelect from '../../components/MobileSelect';
import { useAuth } from '../../context/AuthContext';
import { performanceGoalService } from '../../services/performanceGoalService';
import { toast } from 'react-toastify';
import {
    Award,
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar,
    Sparkles,
    Check,
    Info,
    User,
    FileText,
    ListTodo,
    Layers
} from 'lucide-react';

const COMPANY_DECORUM_GUIDELINES = [
    { key: 'attendance_time', title: 'Attendance Punctuality', detail: 'Mark attendance before 09:30 AM.' },
    { key: 'dar_submissions', title: 'Daily Report (DAR)', detail: 'Submit comprehensive updates before 07:00 PM.' },
    { key: 'geofence_compliance', title: 'Geofence Bound Compliance', detail: 'Clock in only from assigned coordinates.' },
    { key: 'task_sla_velocity', title: 'Milestone Execution SLA', detail: 'Maintain task resolution and quality SLAs.' },
    { key: 'collaboration_comms', title: 'Professional Comms', detail: 'Keep active presence on Slack/collaboration.' },
    { key: 'professional_conduct', title: 'Corporate Decorum', detail: 'Adhere to corporate professional guidelines.' }
];

const MyPerformanceMobile = () => {
    const { user } = useAuth();
    const empId = user?.user_id ?? user?.id ?? 101;

    const [cycles, setCycles] = useState([]);
    const [selectedCycleId, setSelectedCycleId] = useState('');
    const [goals, setGoals] = useState([]);
    const [review, setReview] = useState(null);
    const [aiResult, setAiResult] = useState(null);
    const [loading, setLoading] = useState(true);

    const [commentingGoalId, setCommentingGoalId] = useState(null);
    const [employeeCommentInput, setEmployeeCommentInput] = useState('');

    // 1. Fetch cycles on mount
    useEffect(() => {
        if (!empId) return;
        const fetchCycles = async () => {
            try {
                const res = await performanceGoalService.getPerformanceCycles();
                if (res.success && res.data.length > 0) {
                    setCycles(res.data);
                    
                    // Find most recent active/evaluating cycle with assigned tasks
                    let defaultCycleId = '';
                    for (const cycle of res.data) {
                        if (cycle.status !== 'Active' && cycle.status !== 'Evaluating') {
                            continue;
                        }
                        try {
                            const goalsRes = await performanceGoalService.getEmployeeGoals(empId, cycle.id);
                            if (goalsRes.success && goalsRes.data.length > 0) {
                                defaultCycleId = cycle.id;
                                break;
                            }
                        } catch (err) {
                            console.error(`Error checking goals for cycle ${cycle.id}:`, err);
                        }
                    }
                    
                    // Fallback 1: Check if any other cycle (e.g. Closed) has assigned goals
                    if (!defaultCycleId) {
                        for (const cycle of res.data) {
                            if (cycle.status === 'Upcoming') continue;
                            try {
                                const goalsRes = await performanceGoalService.getEmployeeGoals(empId, cycle.id);
                                if (goalsRes.success && goalsRes.data.length > 0) {
                                    defaultCycleId = cycle.id;
                                    break;
                                }
                            } catch (err) {
                                console.error(`Error checking goals for fallback cycle ${cycle.id}:`, err);
                            }
                        }
                    }
                    
                    // Fallback 2: Fallback to most recent Active cycle, or Evaluating cycle, or first cycle
                    if (!defaultCycleId) {
                        const activeCycle = res.data.find(c => c.status === 'Active') || 
                                            res.data.find(c => c.status === 'Evaluating') || 
                                            res.data[0];
                        defaultCycleId = activeCycle.id;
                    }
                    
                    setSelectedCycleId(defaultCycleId);
                }
            } catch (err) {
                console.error("Error fetching performance cycles:", err);
            }
        };
        fetchCycles();
    }, [empId]);

    // 2. Load data based on selected cycle and employee ID from API
    useEffect(() => {
        if (!empId || !selectedCycleId) return;

        const loadCycleData = async () => {
            setLoading(true);
            try {
                // Fetch Goals
                const goalsRes = await performanceGoalService.getEmployeeGoals(empId, selectedCycleId);
                if (goalsRes.success) {
                    setGoals(goalsRes.data);
                } else {
                    setGoals([]);
                }

                // Fetch Review
                const reviewRes = await performanceGoalService.getEmployeeReview(empId, selectedCycleId);
                if (reviewRes.success && reviewRes.data) {
                    const rev = reviewRes.data;
                    const mappedRev = {
                        selfAchievements: rev.self_achievements || '',
                        selfChallenges: rev.self_challenges || '',
                        selfLearning: rev.self_learning || '',
                        managerComments: rev.manager_comments || '',
                        managerRec: rev.manager_recommendation || '',
                        lastUpdated: rev.updated_at ? new Date(rev.updated_at).toLocaleString() : ''
                    };
                    setReview(mappedRev);

                    // Parse AI report card if present in DB
                    if (rev.ai_analysis_report) {
                        try {
                            const aiReportObj = typeof rev.ai_analysis_report === 'string'
                                ? JSON.parse(rev.ai_analysis_report)
                                : rev.ai_analysis_report;
                            setAiResult(aiReportObj);
                        } catch (aiErr) {
                            console.error("Error parsing AI analysis report from DB:", aiErr);
                            setAiResult(null);
                        }
                    } else {
                        // Fallback to localStorage if not in DB yet for legacy compatibility
                        const storedAi = localStorage.getItem(`mano_perf_ai_${empId}_${selectedCycleId}`);
                        if (storedAi) {
                            try {
                                setAiResult(JSON.parse(storedAi));
                            } catch(e) {
                                setAiResult(null);
                            }
                        } else {
                            setAiResult(null);
                        }
                    }
                } else {
                    setReview(null);
                    // Fallback to localStorage if review row doesn't exist yet but report is in local storage
                    const storedAi = localStorage.getItem(`mano_perf_ai_${empId}_${selectedCycleId}`);
                    if (storedAi) {
                        try {
                            setAiResult(JSON.parse(storedAi));
                        } catch(e) {
                            setAiResult(null);
                        }
                    } else {
                        setAiResult(null);
                    }
                }
            } catch (err) {
                console.error("Error loading performance cycle data:", err);
                setGoals([]);
                setReview(null);
                setAiResult(null);
            } finally {
                setLoading(false);
            }
        };

        loadCycleData();
    }, [empId, selectedCycleId]);

    const handleStatusChange = async (goal, newStatus) => {
        if (newStatus === 'Completed') {
            setCommentingGoalId(goal.id);
            setEmployeeCommentInput(goal.employee_comments || '');
        } else {
            try {
                const res = await performanceGoalService.updateGoal(goal.id, {
                    status: newStatus
                });
                if (res.success) {
                    setGoals(goals.map(g => g.id === goal.id ? { ...g, status: newStatus } : g));
                    toast.success(`Goal status updated to ${newStatus}`);
                }
            } catch (err) {
                console.error(err);
                toast.error("Failed to update status");
            }
        }
    };

    const submitCompletionWithComment = async (goalId) => {
        try {
            const res = await performanceGoalService.updateGoal(goalId, {
                status: 'Completed',
                employee_comments: employeeCommentInput
            });
            if (res.success) {
                setGoals(goals.map(g => g.id === goalId ? { ...g, status: 'Completed', employee_comments: employeeCommentInput } : g));
                setCommentingGoalId(null);
                setEmployeeCommentInput('');
                toast.success("Goal completed successfully with comments!");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to complete goal with comments");
        }
    };

    // Calculate arithmetic average score
    const ratedGoals = goals.filter(g => g.rating > 0);
    const totalRating = ratedGoals.reduce((sum, g) => sum + g.rating, 0);
    const averageScore = ratedGoals.length > 0 ? (totalRating / ratedGoals.length) : 0;
    const formattedAverageScore = Math.round(averageScore * 10) / 10;

    const getScoreBadgeDetails = (score) => {
        if (score >= 8.5) return { label: 'Outstanding', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' };
        if (score >= 7.5) return { label: 'Exceeds Expects', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' };
        if (score >= 6.0) return { label: 'Meets Expects', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' };
        if (score > 0) return { label: 'Underperforming', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' };
        return { label: 'Pending Review', color: 'text-slate-500 bg-slate-500/10 border-slate-500/30' };
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Completed':
                return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20';
            case 'In-Progress':
                return 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400 border border-blue-500/20';
            case 'Deferred':
                return 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border border-amber-500/20';
            default:
                return 'bg-slate-100 dark:bg-[#21262d] text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-github-dark-border';
        }
    };

    return (
        <MobileDashboardLayout title="Performance" hideHeader={false}>
            <div className="space-y-4 pb-6 select-none text-[11px]">
                
                {/* 1. Header & Appraisal Selector */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border p-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Award size={16} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-xs leading-none">Evaluation Panel</h4>
                            <span className="text-[10px] text-slate-400 mt-1 block">View-only guidelines & feedback</span>
                        </div>
                    </div>
                    
                    <div className="w-40 shrink-0 select-none">
                        {cycles.length > 0 ? (
                            <MobileSelect
                                value={cycles.find(c => c.id === selectedCycleId)?.name || ''}
                                options={cycles.map(c => c.name)}
                                onChange={(val) => {
                                    const found = cycles.find(c => c.name === val);
                                    if (found) setSelectedCycleId(found.id);
                                }}
                                placeholder="Select cycle"
                            />
                        ) : (
                            <span className="text-[10px] text-slate-400 italic">Loading...</span>
                        )}
                    </div>
                </div>

                {/* 2. Overall KPI Score & Recommendation */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1 items-start">
                            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Appraisal Index</span>
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${getScoreBadgeDetails(formattedAverageScore).color}`}>
                                {getScoreBadgeDetails(formattedAverageScore).label}
                            </span>
                        </div>

                        {/* Dial Circle inside a compact container */}
                        <div className="relative w-14 h-14 flex items-center justify-center">
                            <svg className="absolute w-full h-full" viewBox="0 0 48 48">
                                <g transform="rotate(-90 24 24)">
                                    <circle 
                                        cx="24" 
                                        cy="24" 
                                        r="20" 
                                        className="stroke-slate-200 dark:stroke-slate-800 fill-none"
                                        strokeWidth="4"
                                    />
                                    <circle 
                                        cx="24" 
                                        cy="24" 
                                        r="20" 
                                        className="stroke-indigo-600 dark:stroke-indigo-400 fill-none transition-all duration-500"
                                        strokeWidth="4"
                                        strokeDasharray={125.6}
                                        strokeDashoffset={125.6 - (125.6 * (formattedAverageScore || 0)) / 10}
                                        strokeLinecap="round"
                                    />
                                </g>
                            </svg>
                            <div className="flex flex-col items-center justify-center">
                                <span className="text-sm font-black text-slate-800 dark:text-[#f0f6fc]">
                                    {formattedAverageScore > 0 ? formattedAverageScore : '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-github-dark-border/40 pt-3 space-y-2.5">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Official Recommendation</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {review?.managerRec || 'Evaluation Pending'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Manager Feedback</span>
                            <p className="text-slate-600 dark:text-slate-350 leading-relaxed font-semibold italic bg-slate-50 dark:bg-github-dark-subtle/20 p-2.5 rounded-xl border border-slate-100 dark:border-github-dark-border/50">
                                "{review?.managerComments || 'No manager comments registered.'}"
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. Assigned KPIs (Goals) */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-3">
                    <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5 text-xs">
                        <Layers size={14} className="text-[#0969da]" />
                        Assigned KPIs & Targets
                    </h5>

                    <div className="space-y-3">
                        {goals.length > 0 ? (
                            goals.map(goal => (
                                <div key={goal.id} className="p-3 border border-slate-200 dark:border-github-dark-border rounded-xl bg-slate-50/50 dark:bg-github-dark-subtle/10 space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <span className="font-bold text-slate-800 dark:text-github-dark-text text-xs leading-snug">{goal.title}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                                        <span>Due: {goal.deadline}</span>
                                        <span className="flex items-center gap-1">
                                            Status:
                                            {cycles.find(c => c.id === selectedCycleId)?.status !== 'Closed' ? (
                                                <select
                                                    value={goal.status}
                                                    onChange={(e) => handleStatusChange(goal, e.target.value)}
                                                    className="bg-transparent border-b border-slate-200 dark:border-github-dark-border font-bold text-slate-650 dark:text-slate-350 focus:outline-none cursor-pointer"
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="In-Progress">In-Progress</option>
                                                    <option value="Completed">Completed</option>
                                                </select>
                                            ) : (
                                                <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase shrink-0 ${getStatusBadgeClass(goal.status)}`}>
                                                    {goal.status}
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    {/* Employee completion notes display */}
                                    {goal.employee_comments && (
                                        <div className="p-2 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-[10px] space-y-0.5">
                                            <span className="text-[8px] text-indigo-500 font-bold uppercase tracking-wider block">My Completion Note</span>
                                            <p className="text-slate-600 dark:text-slate-350 italic font-semibold leading-relaxed">
                                                "{goal.employee_comments}"
                                            </p>
                                        </div>
                                    )}

                                    {/* Inline commenting form */}
                                    {commentingGoalId === goal.id && (
                                        <div className="p-2.5 bg-white dark:bg-dark-card border border-indigo-200 dark:border-indigo-950/40 rounded-xl space-y-2 shadow-inner">
                                            <div className="space-y-1">
                                                <label className="text-[8px] uppercase font-black text-indigo-500 tracking-wider block">Add Completion Note</label>
                                                <textarea
                                                    value={employeeCommentInput}
                                                    onChange={(e) => setEmployeeCommentInput(e.target.value)}
                                                    placeholder="Describe how you completed this KPI..."
                                                    className="w-full p-2 text-[10px] bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-github-dark-text"
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    onClick={() => {
                                                        setCommentingGoalId(null);
                                                        setEmployeeCommentInput('');
                                                    }}
                                                    className="px-2 py-0.5 text-slate-450 hover:text-slate-655 text-[9px] font-bold"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => submitCompletionWithComment(goal.id)}
                                                    className="px-3 py-0.5 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg text-[9px] font-bold shadow-sm"
                                                >
                                                    Submit
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {goal.rating > 0 ? (
                                        <div className="p-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl space-y-1 mt-1">
                                            <div className="flex justify-between items-center text-[9px]">
                                                <span className="text-slate-400 uppercase font-black tracking-wider block">Goal Score</span>
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                                                    <Check size={10} className="stroke-[3]" />
                                                    {goal.rating} / 10
                                                </span>
                                            </div>
                                            {goal.comments && (
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic font-semibold leading-relaxed">
                                                    "{goal.comments}"
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-1.5 bg-slate-100/30 dark:bg-github-dark-subtle/5 border border-dashed border-slate-200 dark:border-github-dark-border rounded-lg text-slate-400 italic text-[9px] text-center mt-1">
                                            Rating pending manager feedback cycle.
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="py-6 text-center text-slate-400 italic font-medium">No KPIs assigned for this cycle.</p>
                        )}
                    </div>
                </div>

                {/* 4. AI Appraisal Performance Summary */}
                {aiResult && (
                    <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-3">
                        <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5 text-xs">
                            <Sparkles size={14} className="text-indigo-550 dark:text-indigo-400" />
                            AI Performance Auditor
                        </h5>

                        <div className="space-y-3">
                            {/* Score badges */}
                            <div className="flex justify-between items-center text-[10px] bg-slate-50 dark:bg-github-dark-subtle/20 p-2.5 rounded-xl border border-slate-100 dark:border-github-dark-border/40 font-semibold">
                                <span className="text-slate-500">Punctuality: <strong className="text-slate-750 dark:text-slate-200">{aiResult.attendance.punctuality}%</strong></span>
                                <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                                <span className="text-slate-500">Goal SLA: <strong className="text-slate-750 dark:text-slate-200">{aiResult.kpis.completionRate}%</strong></span>
                            </div>

                            <p className="text-[10px] text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-github-dark-subtle/10 p-2.5 rounded-xl leading-relaxed font-semibold italic">
                                "{aiResult.summary}"
                            </p>

                            <div className="space-y-2 pt-1">
                                <div className="space-y-1">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase text-[9px] flex items-center gap-1">
                                        <CheckCircle2 size={10} /> Strengths
                                    </span>
                                    <ul className="text-slate-600 dark:text-slate-400 space-y-1 text-[10px] pl-1 font-semibold">
                                        {aiResult.strengths.slice(0, 2).map((str, i) => (
                                            <li key={i} className="flex gap-1 items-start leading-snug">
                                                <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                                <span>{str}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. Company Decorum Guidelines */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-3">
                    <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5 text-xs">
                        <ListTodo size={14} className="text-[#0969da]" />
                        Company Decorum Rules
                    </h5>

                    <div className="space-y-2.5">
                        {COMPANY_DECORUM_GUIDELINES.map((guide) => (
                            <div key={guide.key} className="flex gap-2 items-start bg-slate-50/50 dark:bg-github-dark-subtle/5 p-2 rounded-xl border border-slate-100 dark:border-github-dark-border/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0969da] shrink-0 mt-1.5" />
                                <div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 block text-[10px] leading-tight">{guide.title}</span>
                                    <p className="text-slate-500 dark:text-slate-400 text-[9.5px] mt-0.5 leading-normal">
                                        {guide.detail}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 6. Static Self-Appraisal summary */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-3">
                    <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5 text-xs">
                        <FileText size={14} className="text-[#0969da]" />
                        Self-Appraisal Record
                    </h5>

                    <div className="space-y-3 text-[10px]">
                        <div className="space-y-1">
                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[8px]">Key Achievements</span>
                            <div className="text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-github-dark-subtle/20 p-2.5 rounded-xl font-semibold leading-relaxed">
                                {review?.selfAchievements ? `"${review.selfAchievements}"` : 'No achievements reported.'}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[8px]">Obstacles & Challenges</span>
                            <div className="text-slate-655 dark:text-slate-350 bg-slate-50 dark:bg-github-dark-subtle/20 p-2.5 rounded-xl font-semibold leading-relaxed">
                                {review?.selfChallenges ? `"${review.selfChallenges}"` : 'No obstacles reported.'}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </MobileDashboardLayout>
    );
};

export default MyPerformanceMobile;
