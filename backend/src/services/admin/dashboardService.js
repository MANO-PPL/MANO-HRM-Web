import { attendanceDB } from '../../config/database.js';

/**
 * Calculate date ranges for the given period.
 */
function getDateRanges(range, year, month) {
    const today = new Date().toISOString().split('T')[0];
    let currentStartStr, currentEndStr, prevStartStr, prevEndStr, daysInPeriod;

    if (year && month) {
        const selectedMonth = parseInt(month);
        const selectedYear = parseInt(year);

        const startDate = new Date(selectedYear, selectedMonth - 1, 1);
        const endDate = new Date(selectedYear, selectedMonth, 0);

        currentStartStr = startDate.toISOString().split('T')[0];
        currentEndStr = endDate.toISOString().split('T')[0];
        daysInPeriod = endDate.getDate();

        const prevMonthDate = new Date(selectedYear, selectedMonth - 2, 1);
        const prevMonthEndDate = new Date(selectedYear, selectedMonth - 1, 0);
        prevStartStr = prevMonthDate.toISOString().split('T')[0];
        prevEndStr = prevMonthEndDate.toISOString().split('T')[0];
    } else if (range === 'daily') {
        currentStartStr = today;
        currentEndStr = today;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        prevStartStr = yesterday.toISOString().split('T')[0];
        prevEndStr = today;
        daysInPeriod = 1;
    } else if (range === 'monthly') {
        const currentStart = new Date();
        currentStart.setDate(currentStart.getDate() - 29);
        currentStartStr = currentStart.toISOString().split('T')[0];
        currentEndStr = today;

        const prevStart = new Date();
        prevStart.setDate(prevStart.getDate() - 59);
        prevStartStr = prevStart.toISOString().split('T')[0];
        prevEndStr = currentStartStr;
        daysInPeriod = 30;
    } else {
        // default: weekly
        const currentStart = new Date();
        currentStart.setDate(currentStart.getDate() - 6);
        currentStartStr = currentStart.toISOString().split('T')[0];
        currentEndStr = today;

        const prevStart = new Date();
        prevStart.setDate(prevStart.getDate() - 13);
        prevStartStr = prevStart.toISOString().split('T')[0];
        prevEndStr = currentStartStr;
        daysInPeriod = 7;
    }

    return { today, currentStartStr, currentEndStr, prevStartStr, prevEndStr, daysInPeriod };
}

function calculateTrend(current, previous) {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * Get dashboard statistics for an organization.
 */
export async function getDashboardStats(org_id, { range = 'weekly', year, month }) {
    const { today, currentStartStr, currentEndStr, prevStartStr, prevEndStr, daysInPeriod } = getDateRanges(range, year, month);

    const orgUserIds = attendanceDB("core_users").select("user_id").where("org_id", org_id);

    // Execute all queries in parallel
    const [
        totalEmployeesRes,
        todaySummary,
        periodSummary,
        prevPeriodSummary,
        activities
    ] = await Promise.all([
        attendanceDB("core_users").where("org_id", org_id).where("user_type", "employee").count("user_id as count").first(),
        attendanceDB("attn_daily_summary")
            .whereIn("user_id", orgUserIds)
            .where("date", today)
            .whereIn("status", ["PRESENT", "HALF_DAY"])
            .select(
                attendanceDB.raw("COUNT(DISTINCT user_id) as present_count"),
                attendanceDB.raw("COUNT(DISTINCT CASE WHEN late_minutes > 0 THEN user_id END) as late_count")
            )
            .first()
            .catch(() => ({ present_count: 0, late_count: 0 })),
        attendanceDB("attn_daily_summary")
            .whereIn("user_id", orgUserIds)
            .whereRaw("date >= ? AND date <= ?", [currentStartStr, currentEndStr])
            .whereIn("status", ["PRESENT", "HALF_DAY"])
            .select(
                attendanceDB.raw("COUNT(user_id) as present_count"),
                attendanceDB.raw("COUNT(CASE WHEN late_minutes > 0 THEN user_id END) as late_count")
            )
            .first()
            .catch(() => ({ present_count: 0, late_count: 0 })),
        attendanceDB("attn_daily_summary")
            .whereIn("user_id", orgUserIds)
            .whereRaw("date >= ? AND date <= ?", [prevStartStr, prevEndStr])
            .whereIn("status", ["PRESENT", "HALF_DAY"])
            .select(
                attendanceDB.raw("COUNT(user_id) as present_count"),
                attendanceDB.raw("COUNT(CASE WHEN late_minutes > 0 THEN user_id END) as late_count")
            )
            .first()
            .catch(() => ({ present_count: 0, late_count: 0 })),
        attendanceDB("sys_activity_logs as al")
            .leftJoin("core_users as u", "al.user_id", "u.user_id")
            .leftJoin("org_designations as d", "u.desg_id", "d.desg_id")
            .select("al.activity_id as id", "u.user_name as user", "d.desg_name as role", "al.description as action", "al.occurred_at as time", "u.profile_image_url")
            .where("al.org_id", org_id)
            .whereNot("al.event_type", "API_CALL")
            .whereRaw("DATE(al.occurred_at) = ?", [today])
            .orderBy("al.occurred_at", "desc")
            .limit(20)
    ]);

    const totalEmployees = totalEmployeesRes?.count || 0;
    const presentToday = Number(todaySummary?.present_count || 0);
    const lateCheckins = Number(todaySummary?.late_count || 0);
    const absentToday = Math.max(0, totalEmployees - presentToday);

    const periodPresentAvg = Number(periodSummary?.present_count || 0) / daysInPeriod;
    const prevPeriodPresentAvg = Number(prevPeriodSummary?.present_count || 0) / daysInPeriod;
    const periodLateAvg = Number(periodSummary?.late_count || 0) / daysInPeriod;
    const prevPeriodLateAvg = Number(prevPeriodSummary?.late_count || 0) / daysInPeriod;

    const periodAbsentAvg = Math.max(0, totalEmployees - periodPresentAvg);
    const prevPeriodAbsentAvg = Math.max(0, totalEmployees - prevPeriodPresentAvg);

    const trends = {
        present: calculateTrend(periodPresentAvg, prevPeriodPresentAvg),
        absent: calculateTrend(periodAbsentAvg, prevPeriodAbsentAvg),
        late: calculateTrend(periodLateAvg, prevPeriodLateAvg)
    };

    // Chart Data
    const chartDaysCount = range === 'monthly' ? 30 : 7;
    const chartDays = [];
    if (year && month) {
        for (let d = 1; d <= daysInPeriod; d++) {
            const date = new Date(year, month - 1, d);
            chartDays.push(date.toISOString().split('T')[0]);
        }
    } else {
        for (let i = chartDaysCount - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            chartDays.push(d.toISOString().split('T')[0]);
        }
    }

    const chartData = await Promise.all(
        chartDays.map(async (dayStr) => {
            const dayName = new Date(dayStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
            let dayRes = await attendanceDB("attn_daily_summary")
                .whereIn("user_id", orgUserIds)
                .where("date", dayStr)
                .whereIn("status", ["PRESENT", "HALF_DAY"])
                .select(
                    attendanceDB.raw("COUNT(DISTINCT user_id) as present_count"),
                    attendanceDB.raw("COUNT(DISTINCT CASE WHEN late_minutes > 0 THEN user_id END) as late_count")
                )
                .first()
                .catch(() => null);

            let present = Number(dayRes?.present_count || 0);
            let late = Number(dayRes?.late_count || 0);

            if (present === 0) {
                // Check legacy table
                const [pRes, lRes] = await Promise.all([
                    attendanceDB("attn_records").whereIn("user_id", orgUserIds).whereRaw("DATE(time_in) = ?", [dayStr]).countDistinct("user_id as count").first().catch(() => ({})),
                    attendanceDB("attn_records").whereIn("user_id", orgUserIds).whereRaw("DATE(time_in) = ?", [dayStr]).where("late_minutes", ">", 0).countDistinct("user_id as count").first().catch(() => ({}))
                ]);
                present = Number(pRes?.count || 0);
                late = Number(lRes?.count || 0);
            }

            const absent = Math.max(0, Number(totalEmployees) - present);
            return { name: dayName, present, late, absent };
        })
    );

    const formattedActivities = activities.map(a => ({
        ...a,
        time: new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: a.action.toLowerCase().includes('clocked in') ? 'present' :
            a.action.toLowerCase().includes('late') ? 'late' : 'absent'
    }));

    return {
        stats: { presentToday, totalEmployees, absentToday, lateCheckins },
        trends,
        chartData,
        activities: formattedActivities
    };
}
