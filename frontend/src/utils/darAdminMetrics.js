/**
 * Metrics and KPI computation helpers for Daily Activity Report (DAR) Admin
 */

export const parseTimeToMinutes = (t) => {
    if (!t) return 0;
    const parts = String(t).split(':');
    return (parseInt(parts[0], 10) * 60) + (parseInt(parts[1], 10) || 0);
};

export const formatDurationFromMinutes = (totalMinutes) => {
    if (!totalMinutes || totalMinutes <= 0) return '0h 0m';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h}h ${m}m`;
};

export const formatDurationFromHours = (val) => {
    if (!val || val <= 0) return '0h 0m';
    const hrs = Math.floor(val);
    const mins = Math.round((val - hrs) * 60);
    return `${hrs}h ${mins}m`;
};

export const formatTaskDuration = (durationOrHours, startTime, endTime) => {
    let totalMinutes = 0;

    if (startTime && endTime) {
        const sM = parseTimeToMinutes(startTime);
        let eM = parseTimeToMinutes(endTime);
        if (eM < sM) eM += (24 * 60);
        totalMinutes = Math.max(0, eM - sM);
    } else if (typeof durationOrHours === 'number') {
        totalMinutes = Math.round(durationOrHours * 60);
    } else if (durationOrHours) {
        const parsed = parseFloat(durationOrHours);
        if (!isNaN(parsed)) {
            totalMinutes = Math.round(parsed * 60);
        }
    }

    if (!totalMinutes || totalMinutes <= 0) {
        return '0 mins';
    }

    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);

    if (h > 0 && m > 0) {
        return `${h} hr and ${m} mins`;
    }
    if (h > 0 && m === 0) {
        return `${h} hr`;
    }
    return `${m} mins`;
};

export const calculateAvgWorkHours = (activities = []) => {
    let totalH = 0;
    const userDayKeys = new Set();

    activities.forEach(a => {
        if (a.status === 'COMPLETED') {
            userDayKeys.add(`${a.user_id}_${String(a.activity_date || '').split('T')[0]}`);
        }
        if (!a.start_time || !a.end_time) return;

        const startM = parseTimeToMinutes(a.start_time);
        let endM = parseTimeToMinutes(a.end_time);
        if (endM < startM) endM += (24 * 60); // handle past-midnight intervals

        totalH += Math.max(0, (endM - startM) / 60);
    });

    return userDayKeys.size > 0 ? (totalH / userDayKeys.size) : 0;
};

export const calculateSubmissionRate = (activities = [], totalEmployees = 0, startDate, endDate) => {
    if (totalEmployees === 0) return { rate: 0, count: 0 };

    const dateMap = {};
    activities.forEach(a => {
        const d = String(a.activity_date || '').split('T')[0];
        if (!d) return;
        if (!dateMap[d]) dateMap[d] = new Set();
        if (a.status === 'COMPLETED') dateMap[d].add(a.user_id);
    });

    let totalCount = 0;
    Object.values(dateMap).forEach(usersSet => {
        totalCount += usersSet.size;
    });

    let duration = 1;
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (diff > 0) duration = diff;
    }

    const avgCount = totalCount / duration;
    const rate = Math.min(100, Math.round((avgCount / totalEmployees) * 100));

    return { rate, count: avgCount };
};

export const calculateIdleTimeMinutes = (activities = []) => {
    const userDayMap = {};
    activities.forEach(a => {
        if (!a.start_time || !a.end_time) return;
        const key = `${a.user_id}_${String(a.activity_date || '').split('T')[0]}`;
        if (!userDayMap[key]) userDayMap[key] = [];

        const startM = parseTimeToMinutes(a.start_time);
        let endM = parseTimeToMinutes(a.end_time);
        if (endM < startM) endM += (24 * 60);

        userDayMap[key].push({ start: startM, end: endM });
    });

    let totalIdleM = 0;
    let dayCount = 0;

    Object.values(userDayMap).forEach(dayActs => {
        dayCount++;
        dayActs.sort((a, b) => a.start - b.start);
        for (let i = 0; i < dayActs.length - 1; i++) {
            const gap = dayActs[i + 1].start - dayActs[i].end;
            if (gap > 0) totalIdleM += gap;
        }
    });

    return dayCount > 0 ? Math.round(totalIdleM / dayCount) : 0;
};

export const calculateTopActivity = (activities = []) => {
    const activityHours = {};
    const activityFrequency = {};
    let totalH = 0;

    activities.forEach(a => {
        if (!a.start_time || !a.end_time) return;
        const startM = parseTimeToMinutes(a.start_time);
        let endM = parseTimeToMinutes(a.end_time);
        if (endM < startM) endM += (24 * 60);

        const hours = Math.max(0, (endM - startM) / 60);
        totalH += hours;

        const type = a.activity_type || 'Uncategorized';
        activityHours[type] = (activityHours[type] || 0) + hours;
        activityFrequency[type] = (activityFrequency[type] || 0) + 1;
    });

    let topAct = 'None';
    let maxFreq = 0;
    Object.entries(activityFrequency).forEach(([act, freq]) => {
        if (freq > maxFreq) {
            topAct = act;
            maxFreq = freq;
        }
    });

    const topActHours = activityHours[topAct] || 0;
    const topActPercent = totalH > 0 ? Math.round((topActHours / totalH) * 100) : 0;

    return { topActivity: topAct, topActivityPercent: topActPercent, totalHours: totalH };
};
