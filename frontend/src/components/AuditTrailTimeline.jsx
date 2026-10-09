import React from 'react';
import { Activity } from 'lucide-react';

/**
 * Safely extracts and normalizes an audit trail array from a record or string.
 * Generates synthetic initial/review steps if the database record lacks an explicit audit trail.
 */
export function getNormalizedAuditTrail(record) {
    if (!record) return [];

    let trail = [];
    const rawTrail = record.audit_trail || record.auditTrail;

    if (rawTrail) {
        try {
            trail = typeof rawTrail === 'string' ? JSON.parse(rawTrail) : rawTrail;
        } catch (_) {
            trail = [];
        }
    }

    if (!Array.isArray(trail) || trail.length === 0) {
        trail = [];
        const submissionDate = record.applied_at || record.created_at || record.date;
        if (submissionDate || record.user_id) {
            trail.push({
                action: 'submitted',
                by: record.user_id,
                by_name: record.user_name || 'Employee',
                at: submissionDate ? new Date(submissionDate).toISOString() : new Date().toISOString()
            });
        }

        const lowerStatus = String(record.status || 'pending').toLowerCase();
        if (['approved', 'rejected', 'cancelled'].includes(lowerStatus)) {
            const reviewDate = record.reviewed_at || record.updated_at || submissionDate || new Date().toISOString();
            trail.push({
                action: lowerStatus,
                by: record.reviewed_by || null,
                by_name: record.reviewer_name || (record.reviewed_by ? 'Admin' : 'System'),
                at: new Date(reviewDate).toISOString(),
                comments: record.admin_comment || record.review_comments || record.remarks || null
            });
        }
    }

    return Array.isArray(trail) ? trail : [];
}

/**
 * Unified timeline component for rendering audit trails across
 * attendance corrections and leave requests in desktop, mobile, admin, and employee views.
 *
 * @param {Object} props
 * @param {Object} [props.record] - The leave or correction request record
 * @param {Array} [props.trail] - Explicit audit trail array (optional, overrides record.audit_trail)
 * @param {boolean} [props.compact] - If true, uses compact padding and smaller typography
 * @param {string|number} [props.currentUserId] - ID of the logged-in user to show 'You'
 * @param {boolean} [props.isEmployee] - When true, hides admin personal names and displays 'Admin'
 * @param {string} [props.title] - Custom section header title
 * @param {string} [props.className] - Extra container styling
 */
export default function AuditTrailTimeline({
    record,
    trail: explicitTrail,
    compact = false,
    currentUserId = null,
    isEmployee = false,
    title = 'Audit Trail & History',
    className = ''
}) {
    const trail = explicitTrail || getNormalizedAuditTrail(record);
    if (!trail || !trail.length) return null;

    const recordUserId = record?.user_id;
    const recordUserName = record?.user_name;
    const recordReviewerName = record?.reviewer_name;

    return (
        <div
            className={
                className ||
                (compact
                    ? 'space-y-2 pt-2 border-t border-slate-100 dark:border-github-dark-border'
                    : 'border-t border-slate-200/60 dark:border-[#30363d] pt-5')
            }
        >
            <span
                className={
                    compact
                        ? 'text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5'
                        : 'text-base font-bold text-slate-900 dark:text-white block mb-3.5 flex items-center gap-2'
                }
            >
                <Activity size={compact ? 13 : 16} className="text-indigo-500" /> {title}
            </span>
            <div
                className={`relative pl-3.5 border-l-2 border-slate-200 dark:border-github-dark-border ${
                    compact ? 'space-y-3 my-2' : 'space-y-3.5'
                }`}
            >
                {trail.map((event, idx) => {
                    const actionName = String(event.action || '').toLowerCase();
                    const isSubmission = actionName === 'submitted';
                    const isCurrentUser =
                        currentUserId &&
                        event.by !== undefined &&
                        event.by !== null &&
                        Number(event.by) === Number(currentUserId);

                    let authorName = 'Admin';
                    if (isEmployee) {
                        // For employee view: submission is 'You' (or user's name), all reviews are 'Admin'
                        if (isSubmission) {
                            authorName = isCurrentUser ? 'You' : (recordUserName || event.by_name || 'Employee');
                        } else {
                            authorName = 'Admin';
                        }
                    } else if (isCurrentUser) {
                        authorName = 'You';
                    } else if (isSubmission && recordUserId && Number(event.by) === Number(recordUserId)) {
                        authorName = recordUserName || event.by_name || 'Employee';
                    } else {
                        authorName = event.by_name || recordReviewerName || 'Admin';
                    }

                    const commentText = event.comments || event.reason || event.remark;

                    return (
                        <div key={idx} className="relative">
                            <div
                                className={`absolute -left-[19px] ${
                                    compact ? 'top-1 w-2 h-2 ring-1' : 'top-1.5 w-2.5 h-2.5 ring-2'
                                } rounded-full bg-indigo-500 border-2 border-white dark:border-dark-card ring-indigo-200 dark:ring-indigo-800`}
                            ></div>
                            <p
                                className={`${
                                    compact ? 'text-xs' : 'text-sm'
                                } font-semibold text-slate-900 dark:text-white capitalize`}
                            >
                                {actionName || 'Event'}
                            </p>
                            <p
                                className={`${
                                    compact ? 'text-[11px]' : 'text-xs sm:text-sm'
                                } text-slate-500 dark:text-github-dark-muted font-normal mt-0.5`}
                            >
                                {event.at ? new Date(event.at).toLocaleString() : 'N/A'} • by {authorName}
                            </p>
                            {commentText && (
                                <p
                                    className={`${
                                        compact ? 'text-xs pl-2 border-l' : 'text-xs sm:text-sm pl-2.5 border-l-2'
                                    } text-slate-600 dark:text-slate-300 mt-1 italic border-slate-200 dark:border-github-dark-border font-medium`}
                                >
                                    "{commentText}"
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
