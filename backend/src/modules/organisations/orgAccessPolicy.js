/**
 * Effective organization status for access checks.
 *
 * An org whose subscription expired more than `grace_period_days` ago (end of
 * that day, server time) is treated as 'inactive' even if its stored status
 * is still 'active'.
 *
 * @param {{ status: string, subscription_expiry?: Date|string|null, grace_period_days?: number|null }} org
 * @returns {{ status: string, isExpired: boolean }}
 */
export function evaluateOrgStatus(org) {
    let isExpired = false;
    if (org.subscription_expiry) {
        const graceDate = new Date(org.subscription_expiry);
        graceDate.setDate(graceDate.getDate() + (org.grace_period_days || 0));
        graceDate.setHours(23, 59, 59, 999);
        if (new Date() > graceDate) {
            isExpired = true;
        }
    }
    return { status: isExpired ? 'inactive' : org.status, isExpired };
}
