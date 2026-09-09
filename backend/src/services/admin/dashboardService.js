import { attendanceDB } from '../../config/database.js';
const pad = (n) => String(n).padStart(2, '0');
const formatLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Calculate date ranges for the given period.
 */
function getDateRanges(range, year, month) {
    const now = new Date();
    const today = formatLocalDate(now);
    let currentStartStr, currentEndStr, prevStartStr, prevEndStr, daysInPeriod;

    if (year && month) {
        const selectedMonth = parseInt(month, 10);
        const selectedYear = parseInt(year, 10);
        daysInPeriod = new Date(selectedYear, selectedMonth, 0).getDate();

        currentStartStr = `${selectedYear}-${pad(selectedMonth)}-01`;
        currentEndStr = `${selectedYear}-${pad(selectedMonth)}-${pad(daysInPeriod)}`;

        const prevMonthDate = new Date(selectedYear, selectedMonth - 2, 1);
        const prevYear = prevMonthDate.getFullYear();
        const prevMonth = prevMonthDate.getMonth() + 1;
        const prevDays = new Date(prevYear, prevMonth, 0).getDate();

        prevStartStr = `${prevYear}-${pad(prevMonth)}-01`;
        prevEndStr = `${prevYear}-${pad(prevMonth)}-${pad(prevDays)}`;
    } else if (range === 'daily') {
        currentStartStr = today;
        currentEndStr = today;
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        prevStartStr = formatLocalDate(yesterday);
        prevEndStr = today;
        daysInPeriod = 1;
    } else if (range === 'monthly') {
        const currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 29);
        currentStartStr = formatLocalDate(currentStart);
        currentEndStr = today;

        const prevStart = new Date(now);
        prevStart.setDate(prevStart.getDate() - 59);
        prevStartStr = formatLocalDate(prevStart);
        prevEndStr = currentStartStr;
        daysInPeriod = 30;
    } else {
        // default: weekly
        const currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 6);
        currentStartStr = formatLocalDate(currentStart);
        currentEndStr = today;

        const prevStart = new Date(now);
        prevStart.setDate(prevStart.getDate() - 13);
        prevStartStr = formatLocalDate(prevStart);
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

    const activeUserQuery = () => attendanceDB("core_users")
        .where("org_id", org_id)
        .where("user_type", "employee")
        .where(function () {
            this.where("is_active", 1).orWhere("is_active", true);
        })
        .where(function () {
            this.where("is_deleted", 0).orWhere("is_deleted", false).orWhereNull("is_deleted");
        });

    const activeUserIds = activeUserQuery().select("user_id");

    // Single query per period: counts present + late together via conditional aggregation
    const periodStatsQuery = (startStr, endStr) =>
        attendanceDB("attn_records")
            .whereIn("user_id", activeUserIds)
            .whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ?", [startStr, endStr])
            .select(
                attendanceDB.raw("COUNT(DISTINCT user_id) as present"),
                attendanceDB.raw("COUNT(DISTINCT CASE WHEN late_minutes > 0 THEN user_id END) as late")
            )
            .first();

    const [
        totalEmployeesRes,
        todayStatsRes,
        currentPeriodRes,
        prevPeriodRes,
        rangeChartRes,
        activities
    ] = await Promise.all([
        activeUserQuery().count("user_id as count").first(),
        periodStatsQuery(today, today),
        periodStatsQuery(currentStartStr, currentEndStr),
        periodStatsQuery(prevStartStr, prevEndStr),
        // one grouped query covering the whole chart range, instead of a query per day
        attendanceDB("attn_records")
            .whereIn("user_id", activeUserIds)
            .whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ?", [currentStartStr, currentEndStr])
            .select(attendanceDB.raw("DATE_FORMAT(time_in, '%Y-%m-%d') as day"))
            .select(
                attendanceDB.raw("COUNT(DISTINCT user_id) as present"),
                attendanceDB.raw("COUNT(DISTINCT CASE WHEN late_minutes > 0 THEN user_id END) as late")
            )
            .groupBy(attendanceDB.raw("DATE_FORMAT(time_in, '%Y-%m-%d')")),
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

    const totalEmployees = Number(totalEmployeesRes.count || 0);
    const presentToday = Number(todayStatsRes.present || 0);
    const lateCheckins = Number(todayStatsRes.late || 0);
    const absentToday = Math.max(0, totalEmployees - presentToday);

    const periodPresentAvg = Number(currentPeriodRes.present || 0) / daysInPeriod;
    const prevPeriodPresentAvg = Number(prevPeriodRes.present || 0) / daysInPeriod;
    const periodLateAvg = Number(currentPeriodRes.late || 0) / daysInPeriod;
    const prevPeriodLateAvg = Number(prevPeriodRes.late || 0) / daysInPeriod;

    const periodAbsentAvg = Math.max(0, totalEmployees - periodPresentAvg);
    const prevPeriodAbsentAvg = Math.max(0, totalEmployees - prevPeriodPresentAvg);

    const trends = {
        present: calculateTrend(periodPresentAvg, prevPeriodPresentAvg),
        absent: calculateTrend(periodAbsentAvg, prevPeriodAbsentAvg),
        late: calculateTrend(periodLateAvg, prevPeriodLateAvg)
    };

    // Build the day list for the chart
    const chartDaysCount = range === 'monthly' ? 30 : 7;
    const chartDays = [];
    if (year && month) {
        for (let d = 1; d <= daysInPeriod; d++) {
            chartDays.push(`${year}-${pad(month)}-${pad(d)}`);
        }
    } else {
        for (let i = chartDaysCount - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            chartDays.push(formatLocalDate(d));
        }
    }

    // Map grouped results by day for O(1) lookup directly matching DB date string
    const byDay = new Map(rangeChartRes.map(r => [
        (typeof r.day === 'string' ? r.day : formatLocalDate(new Date(r.day))),
        r
    ]));

    const chartData = chartDays.map(dayStr => {
        const [y, m, d] = dayStr.split('-').map(Number);
        const dayName = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
        const row = byDay.get(dayStr);
        const present = Number(row?.present || 0);
        const late = Number(row?.late || 0);
        const absent = Math.max(0, totalEmployees - present);
        return { name: dayName, present, late, absent };
    });

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
