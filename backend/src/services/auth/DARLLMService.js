import axios from 'axios';

function sanitizeList(values, key) {
    return [...new Set((values || []).map((item) => item?.[key]).filter(Boolean))];
}

function buildDailyContext(dateList, activitiesByDate, eventsByDate) {
    return dateList.map((date) => {
        const activities = activitiesByDate[date] || [];
        const events = eventsByDate[date] || [];

        return {
            date,
            day: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
            work_items: sanitizeList(activities, 'title').slice(0, 10),
            work_types: sanitizeList(activities, 'activity_type').slice(0, 6),
            meeting_items: sanitizeList(events, 'title').slice(0, 8),
            meeting_types: sanitizeList(events, 'type').slice(0, 5),
            work_count: activities.length,
            meeting_count: events.length,
        };
    });
}

function buildWeeklyContext(dailyContext) {
    const weekly = [];
    for (let i = 0; i < dailyContext.length; i += 7) {
        const block = dailyContext.slice(i, i + 7);
        const weekNumber = Math.floor(i / 7) + 1;
        const dates = block.map((d) => d.date);

        const workItems = [...new Set(block.flatMap((d) => d.work_items || []))];
        const workTypes = [...new Set(block.flatMap((d) => d.work_types || []))];
        const meetingItems = [...new Set(block.flatMap((d) => d.meeting_items || []))];
        const meetingTypes = [...new Set(block.flatMap((d) => d.meeting_types || []))];

        weekly.push({
            week: weekNumber,
            range: `${dates[0]} to ${dates[dates.length - 1]}`,
            active_days: block.filter((d) => d.work_count > 0 || d.meeting_count > 0).length,
            work_items: [...new Set(block.flatMap((d) => d.work_items || []))].slice(0, 15),
            work_types: [...new Set(block.flatMap((d) => d.work_types || []))].slice(0, 8),
            meeting_items: [...new Set(block.flatMap((d) => d.meeting_items || []))].slice(0, 10),
            meeting_types: [...new Set(block.flatMap((d) => d.meeting_types || []))].slice(0, 8),
            work_count: block.reduce((sum, d) => sum + d.work_count, 0),
            meeting_count: block.reduce((sum, d) => sum + d.meeting_count, 0),
        });
    }
    return weekly;
}

function buildDayWorkTextFromSource(dayActivities) {
    if (!Array.isArray(dayActivities) || dayActivities.length === 0) return '';
    const titles = [...new Set(dayActivities.map((a) => a?.title).filter(Boolean))].slice(0, 4);
    if (titles.length > 0) return titles.join(', ');
    const types = [...new Set(dayActivities.map((a) => a?.activity_type).filter(Boolean))].slice(0, 3);
    if (types.length > 0) return types.join(', ');
    return 'Work updated in DAR';
}

function buildDayMeetingTextFromSource(dayEvents) {
    if (!Array.isArray(dayEvents) || dayEvents.length === 0) return '';
    const titles = [...new Set(dayEvents.map((e) => e?.title).filter(Boolean))].slice(0, 4);
    if (titles.length > 0) return titles.join(', ');
    const types = [...new Set(dayEvents.map((e) => e?.type).filter(Boolean))].slice(0, 3);
    if (types.length > 0) return types.join(', ');
    return 'Meetings/events updated';
}

function buildDeterministicMonthlyWorkSummary(dateList, activitiesByDate, eventsByDate) {
    const weekRanges = buildWeekRanges(dateList);
    const weekBlocks = weekRanges.map(({ weekNumber, dates }) => {
        const lines = [`Week ${weekNumber}`];
        dates.forEach((date, index) => {
            const dayWork = buildDayWorkTextFromSource(activitiesByDate[date] || []);
            const dayMeetings = buildDayMeetingTextFromSource(eventsByDate[date] || []);

            const workLine = dayWork || 'No work updates.';

            lines.push(`${index + 1}. ${workLine}`);
            if (dayMeetings) {
                lines.push(`   Meetings: ${dayMeetings}`);
            }
        });

        // Pad short final week to preserve consistent 1..7 structure.
        for (let i = dates.length + 1; i <= 7; i += 1) {
            lines.push(`${i}. No work updates.`);
        }

        return lines.join('\n');
    });

    return weekBlocks.join('\n\n');
}

function buildContextSummary(dailyContext) {
    const activeDays = dailyContext.filter((row) => row.work_count > 0 || row.meeting_count > 0).length;
    const totalWork = dailyContext.reduce((sum, row) => sum + row.work_count, 0);
    const totalMeetings = dailyContext.reduce((sum, row) => sum + row.meeting_count, 0);
    return { active_days: activeDays, total_work_entries: totalWork, total_meeting_entries: totalMeetings };
}

function getFormatRules(reportType, totalDays) {
    if (totalDays > 7) {
        return [
            'For this long-range/monthly report, you MUST group the work_summary by weeks.',
            'Format EXACTLY like this (using these exact headers):',
            'Week 1-',
            '<Analysis of work and impact for the first 7 days>',
            '',
            'Week 2-',
            '<Analysis of work and impact for the next 7 days>',
            '...and so on.',
            'Direct Outcome Rule:',
            '- Use professional, direct, and outcome-focused language.',
            '- If a week is empty, simply state: "No activity logged." DO NOT add robotic filler about "notable declines" or productivity.',
            '- Each "Week X-" header must be followed by a concise, human-sounding narrative.',
        ].join('\n');
    }

    return [
        'Each day MUST be a professional, detailed analytical summary of what was accomplished.',
        'Format exactly like this:',
        '1. <DayName (e.g. Mon)>',
        '   Work: <A detailed paragraph or bullets describing specific work accomplishments>',
        '   Meetings: <Summary of meetings/events>',
        'Use the "Work Breakdown" to provide specific context for each day.',
    ].join('\n');
}

async function buildPrompt({ employeeName, reportType, dateList, activitiesByDate, eventsByDate }) {
    const dailyContext = buildDailyContext(dateList, activitiesByDate, eventsByDate);
    const contextSummary = buildContextSummary(dailyContext);
    const formatRules = getFormatRules(reportType, dateList.length);
    const isWeekStyle = reportType === 'monthly' || (reportType === 'custom' && dateList.length > 7);
    const contextData = isWeekStyle ? buildWeeklyContext(dailyContext) : dailyContext;
    const contextLabel = isWeekStyle ? 'Week-wise JSON data:' : 'Day-wise JSON data:';

    return {
        system: [
            'You are a Direct, Professional, and Outcome-Focused Analyst who generates insightful employee DAR summaries.',
            'Return strict JSON only. No markdown, no explanation.',
            'IMPORTANT: Avoid "robotic" AI filler words like "Notably", "Similarly", "Furthermore", or "Notably".',
            'DO NOT comment on reporting behavior (e.g., "marking a significant decline"). Focus solely on accomplishments or the absence of data.',
            'JSON schema: {"report_summary": string, "work_summary": string}',
            'The "report_summary" should be a high-level qualitative observation of achievements (1 sentence). Use a natural, professional human tone.',
            'The "work_summary" should be a detailed, fact-based breakdown focusing on impact.',
        ].join(' '),
        user: [
            `Employee: ${employeeName}`,
            `Report type: ${reportType}`,
            `Date range: ${dateList[0]} to ${dateList[dateList.length - 1]}`,
            '',
            'Analysis Instructions:',
            '- Describe what the employee actually accomplished using human-like, dense professionalism.',
            '- Avoid generic framing sentences like "Employee engaged in a wide range of..."',
            '- For days/weeks without data, use exactly "No activity logged." and leave it at that.',
            '',
            'Formatting rules:',
            formatRules,
            '',
            'Employee Context Data:',
            JSON.stringify(contextData),
            '',
            'Provide the detailed analytical report in JSON format.',
        ].join('\n'),
    };
}

function validateLLMResponse(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid LLM response payload.');
    }

    const reportSummary = typeof parsed.report_summary === 'string' ? parsed.report_summary.trim() : '';
    const workSummary = typeof parsed.work_summary === 'string' ? parsed.work_summary.trim() : '';

    if (!reportSummary || !workSummary) {
        throw new Error('Missing required report_summary/work_summary from LLM response.');
    }

    return {
        report_summary: reportSummary,
        work_summary: workSummary,
    };
}

function extractJSONObject(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') return null;

    const isPayload = (obj) => (
        obj
        && typeof obj === 'object'
        && typeof obj.report_summary === 'string'
        && typeof obj.work_summary === 'string'
    );

    const parseCandidates = (text) => {
        const matches = text.match(/\{[\s\S]*?\}/g) || [];
        const parsed = [];
        for (const candidate of matches) {
            try {
                const obj = JSON.parse(candidate);
                parsed.push(obj);
            } catch (_) {
                // Ignore malformed candidate chunks.
            }
        }
        return parsed;
    };

    const trimmed = rawContent.trim();
    try {
        const whole = JSON.parse(trimmed);
        if (isPayload(whole)) return whole;
    } catch (_) {
        // Continue to fenced/substring extraction below.
    }

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
        try {
            const fencedObj = JSON.parse(fenced[1].trim());
            if (isPayload(fencedObj)) return fencedObj;
        } catch (_) {
            // Continue to bracket extraction.
        }
    }

    const parsedCandidates = parseCandidates(trimmed);
    const payloadCandidate = parsedCandidates.find(isPayload);
    if (payloadCandidate) return payloadCandidate;

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        const candidate = trimmed.slice(start, end + 1);
        try {
            const bracketObj = JSON.parse(candidate);
            if (isPayload(bracketObj)) return bracketObj;
            return null;
        } catch (_) {
            return null;
        }
    }

    return null;
}

function normalizeNonJSONContent(rawContent) {
    const text = String(rawContent || '').trim();
    if (!text) {
        return {
            report_summary: 'Monthly activity overview for the selected range.',
            work_summary: 'No activity logged.',
        };
    }

    // If model returned multiple concatenated JSON objects, recover the first valid payload.
    const embeddedJson = text.match(/\{[\s\S]*?\}/g) || [];
    for (const item of embeddedJson) {
        try {
            const parsed = JSON.parse(item);
            if (parsed && typeof parsed.report_summary === 'string' && typeof parsed.work_summary === 'string') {
                return validateLLMResponse(parsed);
            }
        } catch (_) {
            // Ignore malformed fragments.
        }
    }

    // Remove leaked JSON payload blobs from free-form text before surfacing summary.
    const cleanedText = text
        .replace(/\{[\s\S]*?"report_summary"[\s\S]*?"work_summary"[\s\S]*?\}/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] || cleanedText;
    const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0]?.trim() || firstLine;
    const fallbackOneLine = 'Worked on recorded DAR activities and updates during the selected period.';
    const normalizedReport = firstSentence.length > 12
        ? firstSentence
        : 'Monthly summary generated from available DAR records for the selected period.';
    const normalizedWork = cleanedText || fallbackOneLine;

    return {
        report_summary: normalizedReport,
        work_summary: normalizedWork,
    };
}

function buildWeekRanges(dateList) {
    const ranges = [];
    for (let i = 0; i < dateList.length; i += 7) {
        ranges.push({ weekNumber: Math.floor(i / 7) + 1, dates: dateList.slice(i, i + 7) });
    }
    return ranges;
}

function buildMeetingsTextForWeek(weekDates, eventsByDate) {
    const weekEvents = weekDates.flatMap((d) => eventsByDate[d] || []);
    if (weekEvents.length === 0) return 'No meetings/events.';

    const titles = [...new Set(weekEvents.map((e) => e?.title).filter(Boolean))].slice(0, 4);
    if (titles.length > 0) return titles.join(', ');

    const types = [...new Set(weekEvents.map((e) => e?.type).filter(Boolean))].slice(0, 3);
    if (types.length > 0) return types.join(', ');

    return 'Meetings/events updated.';
}

function enforceWeeklyMeetingSections(workSummary, dateList, eventsByDate) {
    if (!workSummary || !dateList?.length) return workSummary;

    const weekRanges = buildWeekRanges(dateList);
    const text = String(workSummary);

    // If no week headers exist, append a deterministic week skeleton with day-style lines.
    if (!/(^|\n)\s*Week\s+\d+/i.test(text)) {
        const appendix = weekRanges.map(({ weekNumber, dates }) => (
            [
                `Week ${weekNumber}`,
                '1. Work updates captured in DAR.',
                '2. Key activities were recorded.',
                '3. Focus areas tracked for the week.',
                '4. Work updates continued.',
                '5. Work updates continued.',
                '6. Work updates continued.',
                '7. Work updates continued.',
                ...(buildMeetingsTextForWeek(dates, eventsByDate) !== 'No meetings/events.'
                    ? [`   Meetings: ${buildMeetingsTextForWeek(dates, eventsByDate)}`]
                    : []),
            ].join('\n')
        )).join('\n\n');
        return `${text.trim()}\n\n${appendix}`.trim();
    }

    const blocks = text.split(/\n\s*\n/);
    const updated = blocks.map((block) => {
        const weekMatch = block.match(/(^|\n)\s*Week\s+(\d+)/i);
        if (!weekMatch) return block;

        const weekNumber = Number(weekMatch[2]);
        const weekRange = weekRanges.find((w) => w.weekNumber === weekNumber);
        const meetingsText = buildMeetingsTextForWeek(weekRange?.dates || [], eventsByDate);

        const hasInlineMeetings = /(^|\n)\s*Meetings\s*:/i.test(block);
        if (hasInlineMeetings) {
            return block;
        }

        if (meetingsText === 'No meetings/events.') {
            return block;
        }

        const numbered = [...block.matchAll(/(^|\n)\s*(\d+)\./g)];
        const maxPoint = numbered.length > 0
            ? Math.max(...numbered.map((m) => Number(m[2]) || 0))
            : 0;
        const nextPoint = Math.min(7, Math.max(1, maxPoint + 1));
        return `${block}\n${nextPoint}. Work updates continued.\n   Meetings: ${meetingsText}`;
    });

    return updated.join('\n\n');
}

function sanitizeReportSummaryText(reportSummary) {
    let text = String(reportSummary || '').trim();
    if (!text) return 'Monthly summary generated from available DAR records for the selected period.';

    text = text
        .replace(/\\r\\n/g, ' ')
        .replace(/\\n/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

    // Aggressively strip any leaked JSON structures at the start
    // Matches: {"report_summary": "...", "report_summary": "...", "report_summary":
    const prefixesToStrip = [
        /^\{?\s*["']?report_summary["']?\s*:\s*["']?/i,
        /^\{?\s*["']?report_summary["']?\s*:\s*/i,
        /^\{?\s*/
    ];
    
    let cleaned = text;
    for (const regex of prefixesToStrip) {
        cleaned = cleaned.replace(regex, '');
    }

    // Strip trailing JSON artifacts
    cleaned = cleaned.replace(/["']?\s*,?\s*["']?work_summary["']?\s*:[\s\S]*$/i, '');
    cleaned = cleaned.replace(/["']?\s*\}?\s*$/i, '');

    const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned;
    return firstSentence || 'Monthly summary generated from available DAR records for the selected period.';
}

function sanitizeWorkSummaryText(workSummary) {
    let text = String(workSummary || '').trim();
    if (!text) return text;

    // Decode escaped newlines/quotes that sometimes arrive inside JSON strings.
    text = text
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'");

    const hasLeakedPayload = /['"]report_summary['"]\s*:|['"]work_summary['"]\s*:/i.test(text);
    if (hasLeakedPayload) {
        const weekStart = text.search(/\bWeek\s+1\b/i);
        const dayStart = text.search(/(^|\n)\s*1\.\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
        const numberedStart = text.search(/(^|\n)\s*1\.\s+/m);
        const start = weekStart >= 0 ? weekStart : (dayStart >= 0 ? dayStart : numberedStart);

        if (start >= 0) {
            text = text.slice(start).trim();
        }

        // Remove any remaining leaked key/value lines.
        text = text
            .split('\n')
            .filter((line) => !/report_summary|work_summary/i.test(line))
            .join('\n')
            .trim();
    }

    return text.replace(/\n{3,}/g, '\n\n').trim();
}

async function requestGroqJSON({ model, prompt }) {
    const body = {
        model,
        temperature: 0.1,
        max_completion_tokens: 1200,
        messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
        ],
    };

    const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        body,
        {
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            timeout: 25000,
        }
    );

    const content = response?.data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Empty response from Groq model.');
    }

    const parsed = extractJSONObject(content);
    if (!parsed) return validateLLMResponse(normalizeNonJSONContent(content));

    return validateLLMResponse(parsed);
}

export function isGroqEnabled() {
    return Boolean(process.env.GROQ_API_KEY);
}

export async function generateNarrativeWithGroq({
    employeeName,
    reportType,
    dateList,
    activitiesByDate,
    eventsByDate,
}) {
    if (!isGroqEnabled()) {
        throw new Error('GROQ_API_KEY is not configured.');
    }
    if (!dateList || dateList.length === 0) {
        throw new Error('Date range is empty for LLM report generation.');
    }
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const prompt = await buildPrompt({ employeeName, reportType, dateList, activitiesByDate, eventsByDate });

    try {
        const normalized = await requestGroqJSON({ model, prompt });
        const finalReportSummary = sanitizeReportSummaryText(normalized.report_summary);
        const finalWorkSummary = sanitizeWorkSummaryText(normalized.work_summary);

        return {
            ...normalized,
            report_summary: finalReportSummary,
            work_summary: finalWorkSummary,
            generation_mode: 'llm',
        };
    } catch (error) {
        console.error('[DAR LLM] Groq generation failed:', error?.response?.data || error.message);
        if (error?.response?.status === 429) {
            throw new Error('Groq rate limit reached. Please wait 60 seconds and retry, or reduce employees/date range.');
        }
        throw new Error(error?.response?.data?.error?.message || error.message || 'Groq generation failed.');
    }
}
