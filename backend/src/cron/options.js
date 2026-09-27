/**
 * Shared node-cron options.
 *
 * noOverlap: a run that is still going when the next tick fires makes that
 * tick skip, so slow jobs (e.g. the every-minute shift reminder scan) cannot
 * pile up. The job function must return its promise for this to work.
 *
 * Schedules use the server's local time unless CRON_TZ is set
 * (e.g. CRON_TZ=Asia/Kolkata).
 */
export function cronOptions(name) {
    return {
        name,
        noOverlap: true,
        ...(process.env.CRON_TZ ? { timezone: process.env.CRON_TZ } : {}),
    };
}
