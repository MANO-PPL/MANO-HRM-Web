
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Calendar, Download, Users, Building, Clock, FileText, Plus, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MinimalSelect from "../../MinimalSelect"; // Ensure path is correct relative to new location
import MiniCalendar from '../MiniCalendar'; // Ensure path is correct relative to new location
import api from '../../../services/api'; // Ensure path is correct relative to new location
import { toast } from 'react-toastify';
import { getStatusStyle, ATTENDANCE_STATUS } from '../../../utils/attendanceStatus';
import { formatPlatformDate } from '../../../utils/dateUtils';

function shiftDateYMD(dateStr, deltaDays) {
    const base = new Date(`${dateStr}T00:00:00`);
    base.setDate(base.getDate() + deltaDays);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function buildRangeByMode(anchorDate, mode) {
    if (mode === 'week') {
        return { start: shiftDateYMD(anchorDate, -6), end: anchorDate };
    }
    if (mode === 'month') {
        return { start: shiftDateYMD(anchorDate, -29), end: anchorDate };
    }
    return { start: anchorDate, end: anchorDate };
}

function enumerateDates(startDate, endDate) {
    if (!startDate || !endDate) return [];
    const dates = [];
    let cursor = startDate;
    while (cursor <= endDate) {
        dates.push(cursor);
        cursor = shiftDateYMD(cursor, 1);
    }
    return dates;
}

const MasterDataView = ({
    departments = [],
    shifts = [],
    allUsers = [],
    dateRange: propDateRange,
    setDateRange: propSetDateRange,
    datePreset,
    setDatePreset,
    timeMode: propTimeMode,
    setTimeMode: propSetTimeMode,
    selectedDepartment: propDepartment,
    setSelectedDepartment: propSetDepartment,
    selectedDesignation: propDesignation,
    setSelectedDesignation: propSetDesignation,
    selectedShift: propShift,
    setSelectedShift: propSetShift,
    searchQuery: propSearchQuery = '',
    isEmbeddedInAdmin = false
}) => {
    // Helper to get local YYYY-MM-DD
    const getLocalToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [internalDateRange, setInternalDateRange] = useState({ start: getLocalToday(), end: getLocalToday() });
    const dateRange = propDateRange !== undefined ? propDateRange : internalDateRange;
    const setDateRange = propSetDateRange !== undefined ? propSetDateRange : setInternalDateRange;

    const [internalTimeMode, setInternalTimeMode] = useState(() => {
        if (datePreset === '30d') return 'month';
        if (datePreset === '7d') return 'week';
        if (propDateRange && propDateRange.start !== propDateRange.end) return 'week';
        return 'day';
    });
    const timeMode = propTimeMode !== undefined ? propTimeMode : internalTimeMode;
    const setTimeMode = propSetTimeMode !== undefined ? propSetTimeMode : setInternalTimeMode;

    // Synchronize timeMode with datePreset or dateRange
    useEffect(() => {
        if (datePreset === 'today') {
            setTimeMode('day');
        } else if (datePreset === '7d') {
            setTimeMode('week');
        } else if (datePreset === '30d') {
            setTimeMode('month');
        } else if (dateRange.start === dateRange.end) {
            setTimeMode('day');
        }
    }, [datePreset, dateRange.start, dateRange.end]);

    const [loadingData, setLoadingData] = useState(false);
    const [timelineData, setTimelineData] = useState([]);
    const [summaryByQuery, setSummaryByQuery] = useState({});
    const [sidebarConfig, setSidebarConfig] = useState({ isOpen: false, user: null });
    const [hoveredTask, setHoveredTask] = useState(null);
    const [selectedDayFilter, setSelectedDayFilter] = useState('all');
    const holidaysCacheRef = useRef(null);
    const activeFetchIdRef = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            if (hoveredTask) setHoveredTask(null);
        };
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [hoveredTask]);

    const [internalShift, setInternalShift] = useState('All Shifts');
    const selectedShift = propShift !== undefined ? propShift : internalShift;
    const setSelectedShift = propSetShift !== undefined ? propSetShift : setInternalShift;

    const [currentShift, setCurrentShift] = useState({ start: 8, end: 19 }); // Default View Range
    const [usersList, setUsersList] = useState([]);

    const effectiveUsers = usersList.length > 0 ? usersList : allUsers;

    const [internalDept, setInternalDept] = useState("All Departments");
    const selectedDepartment = propDepartment !== undefined ? propDepartment : internalDept;
    const setSelectedDepartment = propSetDepartment !== undefined ? propSetDepartment : setInternalDept;

    const [internalDesg, setInternalDesg] = useState("All Designations");
    const selectedDesignation = propDesignation !== undefined ? propDesignation : internalDesg;
    const setSelectedDesignation = propSetDesignation !== undefined ? propSetDesignation : setInternalDesg;

    const [selectedEmployee, setSelectedEmployee] = useState("All Employees");
    const [employeesList, setEmployeesList] = useState([]);

    const designationsList = React.useMemo(() => {
        const desgs = effectiveUsers.map(u => u.designation).filter(d => d && d !== '-' && d !== 'N/A');
        return ["All Designations", ...new Set(desgs)].sort((a, b) => a.localeCompare(b));
    }, [effectiveUsers]);

    // Calendar Popup State
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);

    const toggleCalendar = () => {
        if (!showCalendar && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCalendarPos({
                top: rect.bottom + 8,
                left: rect.left
            });
        }
        setShowCalendar(!showCalendar);
    };

    // Update Timeline Range when Shift Changes or Shifts Load
    useEffect(() => {
        if (!selectedShift || selectedShift === "All Shifts" || shifts.length === 0) {
            let minStart = 8;
            let maxEnd = 19;
            let foundAny = false;
            if (shifts.length > 0) {
                shifts.forEach(s => {
                    try {
                        const rules = typeof s.policy_rules === 'string' ? JSON.parse(s.policy_rules) : s.policy_rules;
                        const startStr = rules?.shift_timing?.start_time;
                        const endStr = rules?.shift_timing?.end_time;
                        if (startStr && endStr) {
                            let sH = parseInt(startStr.split(':')[0]);
                            let eH = parseInt(endStr.split(':')[0]);
                            if (eH < sH) eH += 24;
                            if (!foundAny) {
                                minStart = sH;
                                maxEnd = eH;
                                foundAny = true;
                            } else {
                                minStart = Math.min(minStart, sH);
                                maxEnd = Math.max(maxEnd, eH);
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                });
            }
            setCurrentShift({
                start: Math.max(0, minStart - 1),
                end: maxEnd + 1
            });
            return;
        }

        let targetShift = shifts.find(s => s.shift_name === selectedShift);
        if (!targetShift) targetShift = shifts[0]; // Fallback

        if (targetShift) {
            try {
                // Parse policy_rules
                const rules = typeof targetShift.policy_rules === 'string'
                    ? JSON.parse(targetShift.policy_rules)
                    : targetShift.policy_rules;

                const startStr = rules?.shift_timing?.start_time || "09:00";
                const endStr = rules?.shift_timing?.end_time || "18:00";

                let startH = parseInt(startStr.split(':')[0]);
                let endH = parseInt(endStr.split(':')[0]);

                // Handle Overnight Shifts (e.g. 18:00 to 02:00)
                if (endH < startH) {
                    endH += 24;
                }

                // Set timeline to -1hr start and +1hr end
                setCurrentShift({
                    start: Math.max(0, startH - 1),
                    end: endH + 1
                });

            } catch (e) {
                console.error("Error parsing shift rules", e);
                setCurrentShift({ start: 8, end: 18 });
            }
        }
    }, [selectedShift, shifts]);

    // Dynamic Employee List based on Selected Dept, Shift & Role
    useEffect(() => {
        let filtered = effectiveUsers;

        // 1. Filter by Department
        const isAllDepts = !selectedDepartment || selectedDepartment === 'All' || selectedDepartment === 'All Departments';
        if (!isAllDepts) {
            filtered = filtered.filter(u => u.dept === selectedDepartment);
        }

        // 2. Filter by Shift
        if (selectedShift && selectedShift !== "All Shifts") {
            filtered = filtered.filter(u => u.shift === selectedShift);
        }

        // 3. Filter by Designation
        const isAllDesgs = !selectedDesignation || selectedDesignation === 'All' || selectedDesignation === 'All Designations';
        if (!isAllDesgs) {
            filtered = filtered.filter(u => u.designation === selectedDesignation);
        }

        setEmployeesList(filtered.map(u => u.name));
    }, [selectedDepartment, selectedShift, selectedDesignation, effectiveUsers]);

    const fetchMasterData = async () => {
        setLoadingData(true);
        const fetchId = ++activeFetchIdRef.current;
        try {
            const selectedStart = dateRange.start;
            const selectedEnd = dateRange.end;

            // Parallel Fetch using allSettled for resilience: Activities, Users, Attendance (skip images for speed), Holidays, Events
            const reqPromises = [
                (!allUsers || allUsers.length === 0)
                    ? api.get('/admin/users', { params: { startDate: selectedStart, endDate: selectedEnd } })
                    : Promise.resolve({ data: { success: true, users: [] } }),
                api.get(`/dar/activities/admin/all?startDate=${selectedStart}&endDate=${selectedEnd}`),
                api.get('/attendance/records/admin', { params: { date_from: selectedStart, date_to: selectedEnd, limit: 2000, skip_images: 'true' } }),
                holidaysCacheRef.current
                    ? Promise.resolve({ data: { holidays: holidaysCacheRef.current } })
                    : api.get('/holiday'),
                api.get('/dar/events/admin/all', { params: { date_from: selectedStart, date_to: selectedEnd } })
            ];

            const [usersSettled, actSettled, attSettled, holSettled, eventsSettled] = await Promise.allSettled(reqPromises);
            if (fetchId !== activeFetchIdRef.current) return; // Stale request, ignore

            // 1. Determine active users with robust fallback
            let activeUsers = [];
            if (Array.isArray(allUsers) && allUsers.length > 0) {
                activeUsers = allUsers.map(u => ({
                    userId: u.userId || u.user_id,
                    name: u.name || u.user_name,
                    dept: u.dept || u.dept_name,
                    shift: u.shift || u.shift_name,
                    role: u.role || u.user_type,
                    designation: u.designation || u.desg_name || 'N/A'
                }));
            } else {
                const usersRes = usersSettled.status === 'fulfilled' ? usersSettled.value : null;
                if (usersRes?.data?.success && Array.isArray(usersRes.data.users) && usersRes.data.users.length > 0) {
                    activeUsers = usersRes.data.users.map(u => ({
                        userId: u.user_id,
                        name: u.user_name,
                        dept: u.dept_name,
                        shift: u.shift_name,
                        role: u.user_type,
                        designation: u.desg_name || 'N/A'
                    }));
                    setUsersList(activeUsers);
                }
            }

            // 2. Extract activities
            const res = actSettled.status === 'fulfilled' ? actSettled.value : null;
            const activitiesData = (res?.data?.ok && Array.isArray(res.data.data)) ? res.data.data : [];

            // 3. Process Holidays
            const holRes = holSettled.status === 'fulfilled' ? holSettled.value : null;
            if (!holidaysCacheRef.current && holRes?.data?.holidays && Array.isArray(holRes.data.holidays)) {
                holidaysCacheRef.current = holRes.data.holidays;
            }
            const holidayMap = {};
            const holList = holidaysCacheRef.current || holRes?.data?.holidays || [];
            if (Array.isArray(holList)) {
                holList.forEach(h => {
                    if (h.holiday_date) {
                        const d = String(h.holiday_date).split('T')[0];
                        holidayMap[d] = h.holiday_name;
                    }
                });
            }

            // 4. Process Attendance efficiently
            const attRes = attSettled.status === 'fulfilled' ? attSettled.value : null;
            const attendanceMap = {};
            if (attRes?.data?.data && Array.isArray(attRes.data.data)) {
                attRes.data.data.forEach(att => {
                    if (!att.time_in) return;
                    const cleanTime = String(att.time_in).replace('T', ' ');
                    const [datePart, timePart] = cleanTime.split(' ');
                    if (!datePart || !timePart) return;
                    if (datePart < selectedStart || datePart > selectedEnd) return;

                    const [h, m] = timePart.split(':').map(Number);
                    const dec = (h || 0) + ((m || 0) / 60);

                    const key = `${att.user_id}-${datePart}`;
                    const status = String(att.status || '').toUpperCase();
                    const existing = attendanceMap[key];

                    if (!existing || dec < existing.timeInDecimal) {
                        attendanceMap[key] = {
                            hasTimedIn: true,
                            timeInDecimal: dec,
                            timeInStr: `${String(h || 0).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`,
                            status
                        };
                    } else if (!existing.status && status) {
                        existing.status = status;
                    }
                });
            }

            // 5. Group activities
            const grouped = {};
            const userMap = {};
            activeUsers.forEach(u => { userMap[u.userId] = u; });

            const parseTimeHelper = (t) => {
                if (!t) return 0;
                const [h, m] = String(t).split(':').map(Number);
                return (h || 0) + ((m || 0) / 60);
            };

            activitiesData.forEach(a => {
                const localDate = String(a.activity_date || '').split('T')[0];
                if (!localDate) return;
                if (localDate < selectedStart || localDate > selectedEnd) return;
                const key = `${a.user_id}-${localDate}`;
                const u = userMap[a.user_id];

                if (!grouped[key]) {
                    grouped[key] = {
                        id: key,
                        userId: a.user_id,
                        name: a.user_name || u?.name || 'Employee',
                        role: a.user_role || u?.role || 'Employee',
                        designation: u?.designation || 'N/A',
                        date: localDate,
                        dept: a.user_dept || u?.dept,
                        shift: a.user_shift_name || u?.shift,
                        activities: [],
                        isHoliday: !!holidayMap[localDate],
                        holidayName: holidayMap[localDate],
                        isAbsent: false,
                        attendance: attendanceMap[`${a.user_id}-${localDate}`]
                    };
                }

                grouped[key].activities.push({
                    id: a.id || a.activity_id,
                    start: parseTimeHelper(a.start_time),
                    end: parseTimeHelper(a.end_time),
                    category: a.activity_type,
                    title: a.title || 'Task',
                    description: a.description || '',
                    status: a.status,
                    activityDate: localDate
                });
            });

            // Process Events
            const eventsRes = eventsSettled.status === 'fulfilled' ? eventsSettled.value : null;
            if (eventsRes?.data?.data && Array.isArray(eventsRes.data.data)) {
                eventsRes.data.data.forEach(e => {
                    const eventDate = String(e.event_date || '').split('T')[0];
                    if (!eventDate || eventDate < selectedStart || eventDate > selectedEnd) return;

                    const key = `${e.user_id}-${eventDate}`;
                    const u = userMap[e.user_id];

                    if (!grouped[key] && u) {
                        grouped[key] = {
                            id: key,
                            userId: u.userId,
                            name: u.name,
                            role: u.role || 'Employee',
                            designation: u.designation || 'N/A',
                            date: eventDate,
                            dept: u.dept,
                            shift: u.shift,
                            activities: [],
                            isHoliday: !!holidayMap[eventDate],
                            holidayName: holidayMap[eventDate],
                            isAbsent: false,
                            attendance: attendanceMap[`${e.user_id}-${eventDate}`]
                        };
                    }

                    if (grouped[key]) {
                        grouped[key].activities.push({
                            id: `evt-${e.event_id}`,
                            start: parseTimeHelper(e.start_time),
                            end: parseTimeHelper(e.end_time),
                            category: (e.type || '').toUpperCase(),
                            title: e.title,
                            description: e.description || '',
                            isEvent: true,
                            location: e.location,
                            activityDate: eventDate
                        });
                    }
                });
            }

            // Backfill Gaps for all active users across date range
            const dates = [];
            let cursor = selectedStart;
            while (cursor <= selectedEnd) {
                dates.push(cursor);
                cursor = shiftDateYMD(cursor, 1);
            }

            activeUsers.forEach(u => {
                dates.forEach(dateStr => {
                    const key = `${u.userId}-${dateStr}`;
                    const isHol = !!holidayMap[dateStr];
                    const attData = attendanceMap[`${u.userId}-${dateStr}`];

                    if (!grouped[key]) {
                        grouped[key] = {
                            id: key,
                            userId: u.userId,
                            name: u.name,
                            role: u.role || 'Employee',
                            designation: u.designation || 'N/A',
                            date: dateStr,
                            dept: u.dept,
                            shift: u.shift,
                            activities: [],
                            isHoliday: isHol,
                            holidayName: holidayMap[dateStr],
                            isAbsent: false,
                            attendance: attData
                        };
                    } else {
                        grouped[key].isHoliday = isHol;
                        grouped[key].holidayName = holidayMap[dateStr];
                        if (!grouped[key].attendance) grouped[key].attendance = attData;
                    }
                });
            });

            // Final absence pass: do not label as absent when DAR/Event activities exist.
            Object.values(grouped).forEach((item) => {
                const hasActivities = Array.isArray(item.activities) && item.activities.length > 0;
                const explicitAbsent = String(item.attendance?.status || '').toUpperCase() === ATTENDANCE_STATUS.ABSENT;
                item.isAbsent = !item.isHoliday && !hasActivities && explicitAbsent;
            });

            // Re-aggregate data if multi-day or timeMode is not 'day'
            const isMultiDay = selectedStart !== selectedEnd;
            let finalData = Object.values(grouped);

            if (timeMode !== 'day' || isMultiDay) {
                const aggregated = {};
                Object.values(grouped).forEach((item) => {
                    const key = item.userId;
                    if (!aggregated[key]) {
                        aggregated[key] = {
                            id: key,
                            userId: item.userId,
                            name: item.name,
                            role: item.role,
                            designation: item.designation,
                            dateStart: item.date,
                            dateEnd: item.date,
                            dept: item.dept,
                            shift: item.shift,
                            activities: [],
                            holidayDates: [],
                            absentDates: [],
                            attendance: item.attendance
                        };
                    }
                    aggregated[key].dateEnd = item.date;
                    aggregated[key].activities.push(...item.activities);
                    if (item.isHoliday) {
                        aggregated[key].holidayDates.push(item.date);
                    }
                    if (item.isAbsent) {
                        aggregated[key].absentDates.push(item.date);
                    }
                    if (!aggregated[key].attendance && item.attendance) {
                        aggregated[key].attendance = item.attendance;
                    }
                });

                Object.values(aggregated).forEach((item) => {
                    item.isHoliday = item.holidayDates.length > 0;
                    item.isAbsent = item.absentDates.length > 0 && item.holidayDates.length === 0;
                });

                finalData = Object.values(aggregated);
            }

            const sorted = finalData.sort((a, b) => {
                if (a.name === b.name) return new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date);
                return (a.name || '').localeCompare(b.name || '');
            });

            setTimelineData(sorted);
        } catch (err) {
            console.error('Failed to load timeline data:', err);
            // Fallback: populate from allUsers so user always sees employees
            const fallbackUsers = (usersList.length > 0 ? usersList : allUsers).map(u => ({
                id: u.userId || u.user_id,
                userId: u.userId || u.user_id,
                name: u.name || u.user_name,
                role: u.role || u.user_type || 'Employee',
                designation: u.designation || u.desg_name || 'N/A',
                dept: u.dept || u.dept_name,
                shift: u.shift || u.shift_name,
                activities: [],
                dateStart: dateRange.start,
                dateEnd: dateRange.end,
                date: dateRange.start
            }));
            if (fallbackUsers.length > 0) {
                setTimelineData(fallbackUsers);
            }
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        setSelectedDayFilter('all');
        fetchMasterData();
    }, [dateRange.start, dateRange.end]);

    const filteredTimelineData = React.useMemo(() => {
        return timelineData.filter(user => {
            const deptNorm = (selectedDepartment || '').toLowerCase().trim();
            if (deptNorm && deptNorm !== 'all' && deptNorm !== 'all departments') {
                if ((user.dept || '').toLowerCase().trim() !== deptNorm) return false;
            }

            const shiftNorm = (selectedShift || '').toLowerCase().trim();
            if (shiftNorm && shiftNorm !== 'all' && shiftNorm !== 'all shifts') {
                if ((user.shift || '').toLowerCase().trim() !== shiftNorm) return false;
            }

            const empNorm = (selectedEmployee || '').toLowerCase().trim();
            if (empNorm && empNorm !== 'all' && empNorm !== 'all employees') {
                if ((user.name || '').toLowerCase().trim() !== empNorm) return false;
            }

            const desgNorm = (selectedDesignation || '').toLowerCase().trim();
            if (desgNorm && desgNorm !== 'all' && desgNorm !== 'all designations') {
                if ((user.designation || '').toLowerCase().trim() !== desgNorm) return false;
            }

            if (propSearchQuery && propSearchQuery.trim()) {
                const q = propSearchQuery.toLowerCase().trim();
                const nameMatch = (user.name || '').toLowerCase().includes(q);
                const deptMatch = (user.dept || '').toLowerCase().includes(q);
                const desgMatch = (user.designation || '').toLowerCase().includes(q);
                if (!nameMatch && !deptMatch && !desgMatch) return false;
            }

            return true;
        });
    }, [timelineData, selectedDepartment, selectedShift, selectedEmployee, selectedDesignation, propSearchQuery]);

    const timeSlots = [];
    for (let i = currentShift.start; i <= currentShift.end; i++) {
        timeSlots.push(i);
    }

    const formatTime = (val, isAxis = false) => {
        if (val === undefined || val === null || isNaN(val)) return '';
        const normalized = val >= 24 ? val - 24 : val;
        const h = Math.floor(normalized);
        const rawM = (normalized - h) * 60;
        const m = Math.round(rawM);
        const finalH = (h + Math.floor(m / 60)) % 24;
        const finalM = m % 60;
        const ampm = finalH >= 12 ? 'PM' : 'AM';
        const h12 = finalH % 12 || 12;
        if (isAxis && finalM === 0) {
            return `${h12} ${ampm}`;
        }
        const mStr = String(finalM).padStart(2, '0');
        return `${h12}:${mStr} ${ampm}`;
    };

    const formatDurationBetween = (start, end) => {
        const diff = Math.max(0, (end || 0) - (start || 0));
        const totalMinutes = Math.round(diff * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h > 0 && m > 0) return `${h} hr and ${m} mins`;
        if (h > 0 && m === 0) return `${h} hr`;
        return `${m} mins`;
    };

    const reportType = timeMode === 'day' ? 'daily' : (timeMode === 'week' ? 'weekly' : 'monthly');

    const buildSummaryKey = (userId) => `${userId}|${reportType}|${dateRange.start}|${dateRange.end}`;

    const formatDateDisplay = (user) => {
        if (!user) return '';
        const s = user.date || user.dateStart || dateRange.start;
        const e = user.dateEnd || dateRange.end;
        if (!s) return '';
        if (s === e) {
            const d = new Date(s + 'T00:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        const d1 = new Date(s + 'T00:00:00');
        const d2 = new Date(e + 'T00:00:00');
        const s1 = d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const s2 = d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${s1} – ${s2}`;
    };

    const handleSummaryClick = async (user) => {
        setSidebarConfig({ isOpen: true, user });

        const summaryKey = buildSummaryKey(user.userId);
        const cached = summaryByQuery[summaryKey];
        if (cached?.loading || cached?.data || cached?.error) return;

        setSummaryByQuery((prev) => ({
            ...prev,
            [summaryKey]: { loading: true },
        }));

        try {
            const toTimeString = (decimalHour) => {
                const safe = Number.isFinite(decimalHour) ? decimalHour : 0;
                const totalMinutes = Math.max(0, Math.round(safe * 60));
                const hh = Math.floor(totalMinutes / 60) % 24;
                const mm = totalMinutes % 60;
                return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
            };

            const userRows = timelineData.filter((row) => row.userId === user.userId);
            const allRowActivities = userRows.flatMap((row) => (row.activities || []).map((act) => ({
                ...act,
                activityDate: act.activityDate || row.date,
            })));

            const activitiesPayload = allRowActivities
                .filter((act) => {
                    const cat = String(act.category || '').toUpperCase();
                    return !act.isEvent && cat !== 'EVENT' && cat !== 'MEETING';
                })
                .map((act) => ({
                    activity_date: act.activityDate,
                    title: act.title || 'Task',
                    activity_type: String(act.category || 'WORK').toUpperCase(),
                    start_time: toTimeString(act.start),
                    end_time: toTimeString(act.end),
                }));

            const eventsPayload = allRowActivities
                .filter((act) => {
                    const cat = String(act.category || '').toUpperCase();
                    return act.isEvent || cat === 'EVENT' || cat === 'MEETING';
                })
                .map((act) => ({
                    event_date: act.activityDate,
                    title: act.title || 'Event',
                    type: String(act.category || 'EVENT').toUpperCase(),
                    start_time: toTimeString(act.start),
                    end_time: toTimeString(act.end),
                }));

            const res = await api.post('/dar/reports/preview/client', {
                type: reportType,
                start: dateRange.start,
                end: dateRange.end,
                generation: 'llm',
                employee: {
                    user_id: user.userId,
                    user_name: user.name,
                    dept_name: user.dept,
                    shift_name: user.shift,
                },
                activities: activitiesPayload,
                events: eventsPayload,
            });

            const employeeSummary = res?.data?.data?.[0];
            if (!employeeSummary) {
                throw new Error('No summary available for this employee and timeframe.');
            }

            setSummaryByQuery((prev) => ({
                ...prev,
                [summaryKey]: {
                    loading: false,
                    data: {
                        report_summary: employeeSummary.report_summary,
                        work_summary: employeeSummary.work_summary,
                    },
                },
            }));
        } catch (error) {
            setSummaryByQuery((prev) => ({
                ...prev,
                [summaryKey]: {
                    loading: false,
                    error: error?.response?.data?.message || 'Failed to generate summary.',
                },
            }));
        }
    };

    const handleExportCSV = () => {
        if (!filteredTimelineData || filteredTimelineData.length === 0) {
            toast.info("No data available to export");
            return;
        }
        const rows = [
            ["Employee", "Department", "Designation", "Shift", "Date", "Attendance Status", "Time In", "Tasks Count"]
        ];
        filteredTimelineData.forEach(u => {
            rows.push([
                `"${u.name || ''}"`,
                `"${u.dept || ''}"`,
                `"${u.designation || ''}"`,
                `"${u.shift || ''}"`,
                `"${u.date || dateRange.start || ''}"`,
                `"${u.attendanceStatus || 'N/A'}"`,
                `"${u.timeIn || 'N/A'}"`,
                (u.activities || []).length
            ]);
        });
        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `DAR_Activity_Timeline_${dateRange.start}_${dateRange.end}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Activity timeline exported successfully");
    };

    return (
        <div data-tour-id="dar-admin-master-data" className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden relative">

            {/* Toolbar */}
            {isEmbeddedInAdmin ? (
                <div className="p-3 border-b border-slate-100 dark:border-github-dark-border flex flex-wrap gap-3 items-center justify-between bg-white dark:bg-dark-card z-20">
                    <div className="flex items-center gap-3">
                        {/* Day / Week / Month Mode Pills */}
                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-github-dark-border overflow-hidden">
                            {[
                                { key: 'day', label: 'Day', preset: 'today' },
                                { key: 'week', label: 'Week', preset: '7d' },
                                { key: 'month', label: 'Month', preset: '30d' },
                            ].map((option) => (
                                <button
                                    key={option.key}
                                    onClick={() => {
                                        setTimeMode(option.key);
                                        if (setDatePreset) {
                                            setDatePreset(option.preset);
                                        }
                                        setDateRange(buildRangeByMode(dateRange.end, option.key));
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold transition-colors border-r last:border-r-0 border-slate-200 dark:border-github-dark-border cursor-pointer ${timeMode === option.key
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white dark:bg-github-dark-subtle text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {/* Calendar Date Range Inputs */}
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg px-2.5 py-1">
                            <Calendar size={13} className="text-indigo-500 shrink-0" />
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => {
                                    if (setDatePreset) setDatePreset('custom');
                                    setDateRange(prev => ({ ...prev, start: e.target.value }));
                                }}
                                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-[95px] cursor-pointer"
                            />
                            <span className="text-slate-400 text-[10px] font-bold uppercase">to</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => {
                                    if (setDatePreset) setDatePreset('custom');
                                    setDateRange(prev => ({ ...prev, end: e.target.value }));
                                }}
                                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-[95px] cursor-pointer"
                            />
                        </div>

                        {/* Focus Day Filter (when multi-day range) */}
                        {dateRange.start !== dateRange.end && (
                            <MinimalSelect
                                icon={Calendar}
                                placeholder="Focus Day"
                                options={[
                                    { value: 'all', label: `All Active Days (${enumerateDates(dateRange.start, dateRange.end).length}d)` },
                                    ...enumerateDates(dateRange.start, dateRange.end).map(d => {
                                        const dateObj = new Date(d + 'T00:00:00');
                                        const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
                                        return { value: d, label };
                                    })
                                ]}
                                value={selectedDayFilter}
                                onChange={(val) => setSelectedDayFilter(val)}
                                size="sm"
                            />
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 text-xs text-slate-500 mr-1">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded bg-indigo-500"></div>
                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Task Logged</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded bg-slate-100 dark:bg-github-dark-subtle border border-slate-300 dark:border-github-dark-border border-dashed"></div>
                                <span className="text-[11px] font-medium text-slate-400">Empty</span>
                            </div>
                        </div>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                            <Download size={14} />
                            <span>Export</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-4 border-b border-slate-100 dark:border-github-dark-border flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-dark-card z-20">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <MinimalSelect
                                icon={Clock}
                                placeholder="Shift"
                                options={["All Shifts", ...shifts.map(s => s.shift_name)]}
                                value={selectedShift || "All Shifts"}
                                onChange={(val) => setSelectedShift(val)}
                                searchable
                            />
                        </div>
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    {/* Date Picker using MiniCalendar (Portal) */}
                    <div className="relative">
                        <button
                            ref={buttonRef}
                            onClick={toggleCalendar}
                            className="flex items-center gap-2 pl-3 pr-4 py-2 bg-slate-50 dark:bg-github-dark-subtle rounded-lg border border-slate-200 dark:border-github-dark-border hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        >
                            <Calendar size={16} className="text-indigo-500" />
                            <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">
                                {dateRange.start === dateRange.end
                                    ? formatPlatformDate(dateRange.start)
                                    : `${formatPlatformDate(dateRange.start)} - ${formatPlatformDate(dateRange.end)}`
                                }
                            </span>
                        </button>

                        {showCalendar && createPortal(
                            <div className="fixed inset-0 z-[9999] isolate">
                                <div
                                    className="fixed inset-0 bg-transparent"
                                    onClick={() => setShowCalendar(false)}
                                />
                                <div
                                    className="fixed z-[10000] drop-shadow-2xl"
                                    style={{
                                        top: calendarPos.top,
                                        left: calendarPos.left,
                                        maxWidth: '350px'
                                    }}
                                >
                                    <MiniCalendar
                                        selectedDate={dateRange.start}
                                        startDate={dateRange.start}
                                        endDate={dateRange.end}
                                        maxDate={new Date().toISOString().split('T')[0]}
                                        onDateSelect={(range) => {
                                            const nextRange = buildRangeByMode(range.start, timeMode);
                                            setDateRange(nextRange);
                                            setShowCalendar(false);
                                        }}
                                    />
                                </div>
                            </div>,
                            document.body
                        )}
                    </div>

                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-github-dark-border overflow-hidden">
                        {[
                            { key: 'day', label: 'Day', preset: 'today' },
                            { key: 'week', label: 'Week', preset: '7d' },
                            { key: 'month', label: 'Month', preset: '30d' },
                        ].map((option) => (
                            <button
                                key={option.key}
                                onClick={() => {
                                    setTimeMode(option.key);
                                    if (setDatePreset) {
                                        setDatePreset(option.preset);
                                    }
                                    setDateRange(buildRangeByMode(dateRange.end, option.key));
                                }}
                                className={`px-3 py-2 text-xs font-bold transition-colors border-r last:border-r-0 border-slate-200 dark:border-github-dark-border cursor-pointer ${timeMode === option.key
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-github-dark-subtle text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    {/* Filters */}
                    <div className="flex items-center gap-2">
                        <MinimalSelect
                            icon={Building}
                            placeholder="Department"
                            options={["All Departments", ...departments]}
                            value={selectedDepartment}
                            onChange={setSelectedDepartment}
                            searchable
                        />

                        <MinimalSelect
                            icon={UserCheck}
                            placeholder="Designation"
                            options={designationsList}
                            value={selectedDesignation}
                            onChange={setSelectedDesignation}
                            searchable
                        />
                        <MinimalSelect
                            icon={Users}
                            placeholder="Employee"
                            options={["All Employees", ...employeesList]}
                            value={selectedEmployee}
                            onChange={setSelectedEmployee}
                            searchable
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 mr-4">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-indigo-200 dark:bg-indigo-900/50"></div>
                                <span className="text-xs text-slate-500">Task Logged</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-slate-100 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border border-dashed"></div>
                                <span className="text-xs text-slate-500">Empty</span>
                            </div>
                        </div>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors"
                        >
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>
            )}

            {/* Timeline Grid */}
            <div className="flex-1 overflow-auto relative custom-scrollbar">
                <div className="min-w-[1600px]">
                    {/* Table Header (Time Slots) */}
                    <div className="flex border-b border-slate-100 dark:border-github-dark-border bg-slate-50/80 dark:bg-github-dark-subtle/80 sticky top-0 z-10 backdrop-blur-sm">
                        <div className="w-48 p-3 text-xs font-bold text-slate-500 uppercase flex-shrink-0 sticky left-0 bg-slate-50 dark:bg-github-dark-subtle border-r border-slate-100 dark:border-github-dark-border z-20">
                            Employee
                        </div>
                        <div className="flex-1 flex">
                            {timeSlots.map(hour => (
                                <div key={hour} className="flex-1 min-w-[120px] p-3 text-center border-r border-dashed border-slate-200 dark:border-github-dark-border/50 last:border-none">
                                    <span className="text-[10px] font-bold text-slate-500">{formatTime(hour)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {loadingData ? (
                            Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className="flex animate-pulse">
                                    <div className="w-48 p-4 flex flex-col justify-center border-r border-slate-100 dark:border-github-dark-border flex-shrink-0 sticky left-0 bg-white dark:bg-dark-card z-30 space-y-2">
                                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-28"></div>
                                        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-16"></div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-20"></div>
                                    </div>
                                    <div className="flex-1 flex relative py-4 px-2 min-h-[72px] items-center">
                                        {timeSlots.map(hour => (
                                            <div key={hour} className="flex-1 min-w-[120px] border-r border-dashed border-slate-100 dark:border-github-dark-border/20 h-full absolute" style={{
                                                left: `${((hour - currentShift.start) / (currentShift.end - currentShift.start + 1)) * 100}%`,
                                                width: `${(1 / (currentShift.end - currentShift.start + 1)) * 100}%`
                                            }}></div>
                                        ))}
                                        <div
                                            className="h-6 rounded-md bg-slate-100 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50"
                                            style={{
                                                marginLeft: `${(idx % 4) * 15 + 10}%`,
                                                width: `${20 + (idx % 3) * 12}%`
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        ) : filteredTimelineData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-500 mb-4 shadow-sm">
                                    <Users size={32} />
                                </div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-github-dark-text mb-1">
                                    No Employees Found
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted max-w-md mb-4">
                                    {(propSearchQuery || (selectedDepartment && selectedDepartment !== 'All' && selectedDepartment !== 'All Departments') || (selectedShift && selectedShift !== 'All Shifts') || (selectedDesignation && selectedDesignation !== 'All' && selectedDesignation !== 'All Designations') || (selectedEmployee && selectedEmployee !== 'All Employees' && selectedEmployee !== 'All'))
                                        ? "No employees match your active filters. Try clearing filters or searching with a different term."
                                        : "No active employee records were found for the selected date range."}
                                </p>
                                {(propSearchQuery || (selectedDepartment && selectedDepartment !== 'All' && selectedDepartment !== 'All Departments') || (selectedShift && selectedShift !== 'All Shifts') || (selectedDesignation && selectedDesignation !== 'All' && selectedDesignation !== 'All Designations') || (selectedEmployee && selectedEmployee !== 'All Employees' && selectedEmployee !== 'All')) && (
                                    <button
                                        onClick={() => {
                                            setSelectedDepartment(isEmbeddedInAdmin ? "All" : "All Departments");
                                            setSelectedDesignation(isEmbeddedInAdmin ? "All" : "All Designations");
                                            setSelectedShift("All Shifts");
                                            setSelectedEmployee(isEmbeddedInAdmin ? "All" : "All Employees");
                                        }}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                                    >
                                        Reset Filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredTimelineData.map(user => {
                                const summaryKey = buildSummaryKey(user.userId);
                                const summaryState = summaryByQuery[summaryKey];

                                const allDatesInRange = enumerateDates(dateRange.start, dateRange.end);
                                const isSingleDay = (dateRange.start === dateRange.end);

                                const activitiesByDate = {};
                                (user.activities || []).forEach((act) => {
                                    const d = act.activityDate || user.date || dateRange.start;
                                    if (!activitiesByDate[d]) activitiesByDate[d] = [];
                                    activitiesByDate[d].push(act);
                                });

                                let dayDates;
                                if (isSingleDay) {
                                    dayDates = [user.date || user.dateStart || dateRange.start];
                                } else if (selectedDayFilter && selectedDayFilter !== 'all') {
                                    dayDates = [selectedDayFilter];
                                } else {
                                    // In multi-day mode, only render days that actually have activities or attendance/holiday/absent!
                                    const activeDates = allDatesInRange.filter(d =>
                                        (activitiesByDate[d] && activitiesByDate[d].length > 0) ||
                                        (user.holidayDates && user.holidayDates.includes(d)) ||
                                        (user.absentDates && user.absentDates.includes(d))
                                    );
                                    dayDates = activeDates.length > 0 ? activeDates : [dateRange.end];
                                }

                                const getVisibleWindow = (act) => {
                                    let actStart = act.start;
                                    let actEnd = act.end;

                                    if (currentShift.end > 24) {
                                        if (actStart < currentShift.start) actStart += 24;
                                        if (actEnd < currentShift.start) actEnd += 24;
                                        if (actEnd < actStart) actEnd += 24;
                                    }

                                    if (actEnd <= currentShift.start || actStart >= currentShift.end + 1) return null;

                                    const clampedStart = Math.max(actStart, currentShift.start);
                                    const clampedEnd = Math.min(actEnd, currentShift.end + 1);
                                    if (clampedEnd <= clampedStart) return null;

                                    return { start: clampedStart, end: clampedEnd };
                                };

                                const dayLayout = (() => {
                                    const layout = [];
                                    const placements = {};
                                    let runningTop = 0;

                                    const laneHeight = (timeMode === 'day' && isSingleDay) ? 24 : 22;
                                    const laneGap = 4;
                                    const dayTopPadding = (!isSingleDay && dayDates.length > 1) ? 20 : 16;
                                    const dayBottomPadding = 8;
                                    const minDayHeight = (timeMode === 'day' && isSingleDay) ? 72 : 36;

                                    dayDates.forEach((date) => {
                                        const dayActs = (activitiesByDate[date] || []).slice();
                                        const sortable = dayActs
                                            .map((act) => ({ act, window: getVisibleWindow(act) }))
                                            .filter((item) => Boolean(item.window))
                                            .sort((a, b) => {
                                                if (a.window.start === b.window.start) {
                                                    return (a.window.end - a.window.start) - (b.window.end - b.window.start);
                                                }
                                                return a.window.start - b.window.start;
                                            });

                                        const laneEndTimes = [];

                                        sortable.forEach(({ act, window }) => {
                                            let laneIdx = laneEndTimes.findIndex((laneEnd) => laneEnd <= window.start);
                                            if (laneIdx === -1) {
                                                laneIdx = laneEndTimes.length;
                                                laneEndTimes.push(window.end);
                                            } else {
                                                laneEndTimes[laneIdx] = window.end;
                                            }
                                            placements[act.id] = { laneIdx, window, date };
                                        });

                                        const laneCount = Math.max(1, laneEndTimes.length);
                                        const dayHeight = Math.max(minDayHeight, dayTopPadding + laneCount * (laneHeight + laneGap) + dayBottomPadding);

                                        layout.push({
                                            date,
                                            top: runningTop,
                                            height: dayHeight,
                                            laneHeight,
                                            laneGap,
                                            dayTopPadding,
                                            laneCount,
                                        });
                                        runningTop += dayHeight;
                                    });

                                    return {
                                        days: layout,
                                        placements,
                                        rowHeight: Math.max(isSingleDay ? 80 : 44, runningTop || 44),
                                    };
                                })();

                            const getCategoryStyles = (category) => {
                                const cat = (category || '').toUpperCase();
                                if (cat === 'MEETING') {
                                    return {
                                        bgClass: 'bg-purple-100 dark:bg-purple-900/40 border-purple-200 dark:border-purple-700/50',
                                        textClass: 'text-purple-800 dark:text-purple-100',
                                        subTextClass: 'text-purple-600 dark:text-purple-200',
                                    };
                                }
                                if (cat === 'EVENT') {
                                    return {
                                        bgClass: 'bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700/50',
                                        textClass: 'text-blue-800 dark:text-blue-100',
                                        subTextClass: 'text-blue-600 dark:text-blue-200',
                                    };
                                }
                                if (cat === 'BREAK') {
                                    return {
                                        bgClass: 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700/50',
                                        textClass: 'text-amber-800 dark:text-amber-100',
                                        subTextClass: 'text-amber-600 dark:text-amber-200',
                                    };
                                }
                                return {
                                    bgClass: 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700/50',
                                    textClass: 'text-indigo-800 dark:text-indigo-100',
                                    subTextClass: 'text-indigo-600 dark:text-indigo-200',
                                };
                            };

                            return (
                                <div key={user.id}>
                                    <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                        {/* User Info Column */}
                                        <div className="w-48 p-3 flex flex-col justify-center border-r border-slate-100 dark:border-github-dark-border flex-shrink-0 sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-slate-800 z-30">
                                            <span className="text-sm font-bold text-slate-800 dark:text-github-dark-text truncate" title={user.name}>{user.name}</span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                    {formatDateDisplay(user)}
                                                </span>
                                            </div>
                                            {user.holidayDates && user.holidayDates.length > 0 ? (
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Holiday {user.holidayDates.length > 1 ? `(${user.holidayDates.length})` : ''}
                                                </span>
                                            ) : user.absentDates && user.absentDates.length > 0 ? (
                                                <span className="text-[10px] text-red-500 dark:text-red-400 font-bold mt-1 flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Absent {user.absentDates.length > 1 ? `(${user.absentDates.length})` : ''}
                                                </span>
                                            ) : user.activities.length === 0 && (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1 flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> No DAR
                                                </span>
                                            )}

                                                {/* Attendance Status badge */}
                                            {user.attendance?.status && (() => {
                                                const style = getStatusStyle(user.attendance.status);
                                                return (
                                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex items-center gap-1 w-fit mt-1 ${style.bg} ${style.text}`}>
                                                        <span className={`w-1 h-1 rounded-full ${style.dot}`} />
                                                        {style.label}
                                                    </span>
                                                );
                                            })()}

                                            <button
                                                onClick={() => handleSummaryClick(user)}
                                                className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors w-fit border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400 cursor-pointer"
                                            >
                                                <FileText size={12} />
                                                View Summary
                                            </button>
                                        </div>

                                        {/* Time Slots & Bars */}
                                        <div className="flex-1 flex relative py-2 overflow-hidden">
                                            {/* Background Grid Lines */}
                                            {timeSlots.map(hour => (
                                                <div key={hour} className="flex-1 min-w-[120px] border-r border-dashed border-slate-100 dark:border-github-dark-border/30 h-full absolute" style={{
                                                    left: `${((hour - currentShift.start) / (currentShift.end - currentShift.start + 1)) * 100}%`,
                                                    width: `${(1 / (currentShift.end - currentShift.start + 1)) * 100}%`
                                                }}></div>
                                            ))}

                                            {/* Activities Bars or STATUS OVERLAY */}
                                            <div className="relative w-full" style={{ minHeight: `${dayLayout.rowHeight}px` }}>
                                                {/* Day separators and labels */}
                                                {!isSingleDay && dayLayout.days.map((day, idx) => (
                                                    <React.Fragment key={day.date}>
                                                        {idx < dayLayout.days.length - 1 && (
                                                            <div
                                                                className="absolute w-full border-b border-slate-200 dark:border-github-dark-border"
                                                                style={{ top: `${day.top + day.height}px` }}
                                                            ></div>
                                                        )}
                                                        <div
                                                            className="absolute z-10 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/95 dark:bg-[#161b22]/95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#30363d] shadow-xs backdrop-blur-xs"
                                                            style={{ top: `${day.top + 3}px`, left: '6px' }}
                                                        >
                                                            {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                                                        </div>
                                                    </React.Fragment>
                                                ))}

                                                {/* Empty state for user with 0 activities in range */}
                                                {user.activities.length === 0 && (
                                                    <div className="absolute inset-0 flex items-center pl-6 text-xs text-slate-400 dark:text-slate-500 italic pointer-events-none select-none">
                                                        No activities logged for this period
                                                    </div>
                                                )}

                                                {/* 1. Holiday Overlay (Background) */}
                                                {user.isHoliday && (
                                                    <div className="absolute inset-x-0 inset-y-1 bg-emerald-50/40 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-800/30 rounded-lg pointer-events-none z-0"></div>
                                                )}

                                                {/* 2. Status-based Overlays */}
                                                {!user.isHoliday && (user.attendance?.status === ATTENDANCE_STATUS.MISSED_PUNCH) && (
                                                    <div className={`absolute inset-x-0 inset-y-1 ${getStatusStyle(ATTENDANCE_STATUS.MISSED_PUNCH).bg} border border-rose-200 dark:border-rose-700/30 rounded-lg pointer-events-none z-0`} title="Missed Punch: Auto-closed by system" />
                                                )}
                                                {!user.isHoliday && (user.attendance?.status === ATTENDANCE_STATUS.OVERTIME) && (
                                                    <div className={`absolute inset-x-0 inset-y-1 ${getStatusStyle(ATTENDANCE_STATUS.OVERTIME).bg} border border-violet-200 dark:border-violet-700/30 rounded-lg pointer-events-none z-0`} title="Overtime shift" />
                                                )}

                                                {/* 3. Absent Overlay (Background) - Exclusive to No Holiday */}
                                                {!user.isHoliday && user.isAbsent && (
                                                    <div className="absolute inset-x-0 inset-y-1 bg-red-50/40 dark:bg-red-900/15 border border-red-100 dark:border-red-800/30 rounded-lg pointer-events-none z-0"></div>
                                                )}

                                                {/* 4. Time-In Marker (Only in single-day view so it doesn't span across multiple days) */}
                                                {isSingleDay && user.attendance?.hasTimedIn && (
                                                    <div
                                                        className="absolute inset-y-0 border-l-2 border-emerald-500 z-20 group/marker"
                                                        style={{
                                                            left: `${((user.attendance.timeInDecimal - currentShift.start) / (currentShift.end - currentShift.start + 1)) * 100}%`
                                                        }}
                                                    >
                                                        <div className="absolute top-0 left-0.5 bg-emerald-500 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow-sm opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                                            IN {user.attendance.timeInStr}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 4. Activities (Z-Index 10) */}
                                                {user.activities.map((act) => {
                                                    const placement = dayLayout.placements[act.id];
                                                    if (!placement) return null;

                                                    const totalHours = currentShift.end - currentShift.start + 1;
                                                    const offset = placement.window.start - currentShift.start;
                                                    const duration = placement.window.end - placement.window.start;
                                                    const leftPct = (offset / totalHours) * 100;
                                                    const widthPct = (duration / totalHours) * 100;

                                                    const dayMeta = dayLayout.days.find((d) => d.date === placement.date);
                                                    if (!dayMeta) return null;

                                                    const topPx = dayMeta.top + dayMeta.dayTopPadding + placement.laneIdx * (dayMeta.laneHeight + dayMeta.laneGap);
                                                    const { bgClass, textClass, subTextClass } = getCategoryStyles(act.category);
                                                    const canShowCategory = widthPct >= 14 && dayMeta.laneHeight >= 24;

                                                    return (
                                                        <div
                                                            key={act.id}
                                                            className={`absolute rounded-lg border flex items-center pl-2 pr-1 overflow-hidden hover:z-[6] hover:scale-[1.02] transition-all cursor-pointer shadow-sm z-[5] ${bgClass}`}
                                                            style={{
                                                                left: `${Math.max(0, leftPct)}%`,
                                                                width: `${Math.min(100, widthPct)}%`,
                                                                top: `${topPx}px`,
                                                                height: `${dayMeta.laneHeight}px`
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                setHoveredTask({
                                                                    act,
                                                                    user,
                                                                    date: placement.date,
                                                                    rect
                                                                });
                                                            }}
                                                            onMouseLeave={() => setHoveredTask(null)}
                                                        >
                                                            <div className="w-full overflow-hidden">
                                                                <span className={`block text-[11px] font-semibold truncate leading-[1.1] ${textClass}`}>{act.title}</span>
                                                                {canShowCategory && (
                                                                    <span className={`block text-[9px] truncate uppercase tracking-wide ${subTextClass}`}>{act.category}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            );
                        })
                    )}
                    </div>
                </div>

                {hoveredTask && createPortal(
                    <div
                        className="fixed z-[99999] pointer-events-none transition-all duration-100 ease-out drop-shadow-2xl"
                        style={{
                            position: 'fixed',
                            top: `${hoveredTask.rect.top < 160 ? hoveredTask.rect.bottom + 8 : hoveredTask.rect.top - 8}px`,
                            left: `${Math.min(Math.max(16, hoveredTask.rect.left + (hoveredTask.rect.width / 2) - 145), window.innerWidth - 306)}px`,
                            transform: hoveredTask.rect.top < 160 ? 'none' : 'translateY(-100%)',
                            width: '290px',
                            pointerEvents: 'none'
                        }}
                    >
                        <div className="bg-white/95 dark:bg-[#161b22]/95 text-slate-800 dark:text-white backdrop-blur-md border border-slate-200 dark:border-[#30363d] rounded-xl p-3.5 text-xs shadow-2xl relative">
                            {/* Header: Category Badge & Duration */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    hoveredTask.act.category === 'MEETING' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50' :
                                    hoveredTask.act.category === 'EVENT' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50' :
                                    hoveredTask.act.category === 'BREAK' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50' :
                                    'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50'
                                }`}>
                                    {hoveredTask.act.category || 'TASK'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
                                    {formatDurationBetween(hoveredTask.act.start, hoveredTask.act.end)}
                                </span>
                            </div>

                            {/* Full Task Name */}
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug break-words mb-2.5">
                                {hoveredTask.act.title}
                            </h4>

                            {/* Timing, Date, Employee */}
                            <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-[#30363d] pt-2">
                                <div className="flex items-center gap-2">
                                    <Clock size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {formatTime(hoveredTask.act.start)} – {formatTime(hoveredTask.act.end)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={13} className="text-slate-400 shrink-0" />
                                    <span className="font-medium text-slate-600 dark:text-slate-300">{formatPlatformDate(hoveredTask.date)}</span>
                                </div>
                                {hoveredTask.user?.name && (
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                        <Users size={13} className="text-slate-400 shrink-0" />
                                        <span className="font-medium truncate">{hoveredTask.user.name}</span>
                                    </div>
                                )}
                                {hoveredTask.act.location && (
                                    <div className="text-slate-500 dark:text-slate-400 text-[10px] pl-5">
                                        📍 {hoveredTask.act.location}
                                    </div>
                                )}
                            </div>

                            {/* Description if present */}
                            {hoveredTask.act.description && (
                                <div className="text-[10.5px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700/60 mt-2 italic line-clamp-3">
                                    {hoveredTask.act.description}
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )}

                {createPortal(
                    <EmployeeInsightSidebar
                        isOpen={sidebarConfig.isOpen}
                        onClose={() => setSidebarConfig({ ...sidebarConfig, isOpen: false })}
                        user={sidebarConfig.user}
                        summaryState={sidebarConfig.user ? summaryByQuery[buildSummaryKey(sidebarConfig.user.userId)] : null}
                        formatDateDisplay={formatDateDisplay}
                    />,
                    document.body
                )}
            </div>
        </div>
    );
};

const EmployeeInsightSidebar = ({ isOpen, onClose, user, summaryState, formatDateDisplay }) => {
    if (!user) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[9998]"
                    />
                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-[420px] bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl z-[9999] flex flex-col dar-context"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-github-dark-subtle/20 sticky top-0 z-10">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text">{user.name}</h3>
                                <p className="text-[10px] text-slate-500 dark:text-github-dark-muted mt-0.5">{user.role} • {user.dept}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-github-dark-muted"
                            >
                                <Plus size={18} className="rotate-45" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
                            {/* Stats/Badges */}
                                <div className="flex flex-wrap gap-2">
                                    <div className="px-2.5 py-1 bg-slate-100 dark:bg-github-dark-subtle rounded-md flex items-center gap-1.5 border border-slate-200 dark:border-github-dark-border">
                                        <Calendar size={12} className="text-indigo-500" />
                                        <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">{formatDateDisplay(user)}</span>
                                    </div>
                                    <div className="px-2.5 py-1 bg-slate-100 dark:bg-github-dark-subtle rounded-md flex items-center gap-1.5 border border-slate-200 dark:border-github-dark-border">
                                        <Clock size={12} className="text-emerald-500" />
                                        <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">{user.shift}</span>
                                    </div>
                                </div>

                                {/* AI SUMMARY SECTION */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-1 bg-indigo-500 rounded-full"></div>
                                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">AI Report Insight</h4>
                                    </div>

                                    {summaryState?.loading ? (
                                        <div className="space-y-3 p-4 bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl animate-pulse">
                                            <div className="h-3 bg-slate-200 dark:bg-github-dark-subtle rounded w-full"></div>
                                            <div className="h-3 bg-slate-200 dark:bg-github-dark-subtle rounded w-[90%]"></div>
                                            <div className="h-3 bg-slate-200 dark:bg-github-dark-subtle rounded w-[40%]"></div>
                                        </div>
                                    ) : summaryState?.error ? (
                                        <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-xl">
                                            <p className="text-[11px] text-rose-500">{summaryState.error}</p>
                                        </div>
                                    ) : summaryState?.data ? (
                                        <div className="space-y-6">
                                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl shadow-sm">
                                                <p className="text-xs text-slate-700 dark:text-github-dark-text leading-relaxed italic">
                                                    "{summaryState.data.report_summary}"
                                                </p>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-5 w-1 bg-emerald-500 rounded-full"></div>
                                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Work Breakdown</h4>
                                                </div>
                                                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border rounded-xl">
                                                    <div className="text-[11px] leading-relaxed text-slate-600 dark:text-github-dark-muted whitespace-pre-line">
                                                        {summaryState.data.work_summary.split(/(\bWeek\s+\d+-\s*)/i).map((part, index) => {
                                                            if (part.match(/Week\s+\d+-/i)) {
                                                                return <strong key={index} className="text-indigo-600 dark:text-indigo-400 block mt-3 first:mt-0 uppercase tracking-widest text-[10px]">{part}</strong>;
                                                            }
                                                            return <span key={index}>{part}</span>;
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-10 flex flex-col items-center justify-center text-center opacity-50">
                                            <FileText size={32} className="text-slate-300 dark:text-slate-700 mb-2" />
                                            <p className="text-xs text-slate-500">Wait, checking for observations...</p>
                                        </div>
                                    )}
                                </div>

                                {/* ACTIVITY LIST PREVIEW (Mini) */}
                                {user.activities?.length > 0 && (
                                    <div className="space-y-3 mt-6">
                                        <div className="flex items-center gap-2">
                                            <div className="h-5 w-1 bg-amber-500 rounded-full"></div>
                                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Logged Activities</h4>
                                        </div>
                                        <div className="space-y-2">
                                            {user.activities
                                                .filter(act => String(act.category || '').toUpperCase() !== 'BREAK')
                                                .map(act => (
                                                    <div key={act.id} className="p-3 bg-white dark:bg-github-dark-subtle/40 border border-slate-100 dark:border-github-dark-border rounded-xl flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[11px] font-medium text-slate-700 dark:text-github-dark-text leading-tight">
                                                                {act.title}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                            <button
                                onClick={onClose}
                                className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-lg shadow-slate-200 dark:shadow-none hover:opacity-90 transition-all uppercase tracking-widest"
                            >
                                Close Insights
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default MasterDataView;
