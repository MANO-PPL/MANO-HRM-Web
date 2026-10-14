import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date(dateStr);
};

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const MiniCalendar = ({ selectedDate, endDate, onDateSelect, disableRange = false, maxDate }) => {
    const [currentMonth, setCurrentMonth] = useState(() => parseLocalDate(selectedDate));

    React.useEffect(() => {
        if (selectedDate) {
            setCurrentMonth(parseLocalDate(selectedDate));
        }
    }, [selectedDate]);

    // Helper: Get days in month
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
    };

    // Helper: Get blank days for padding start of month
    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const days = getDaysInMonth(currentMonth);
    const startPadding = Array.from({ length: getFirstDayOfMonth(currentMonth) });

    const isSameDay = (d1, d2) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    // State for drag selection
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [dragEnd, setDragEnd] = useState(null);
    const [selectingStart, setSelectingStart] = useState(null);

    const handleDateClick = (dateStr) => {
        if (disableRange) {
            onDateSelect({ start: dateStr, end: dateStr });
            return;
        }

        if (!selectingStart) {
            setSelectingStart(dateStr);
            setDragStart(dateStr);
            setDragEnd(dateStr);
        } else {
            const start = selectingStart <= dateStr ? selectingStart : dateStr;
            const end = selectingStart <= dateStr ? dateStr : selectingStart;
            setSelectingStart(null);
            setIsDragging(false);
            setDragStart(null);
            setDragEnd(null);
            onDateSelect({ start, end });
        }
    };

    const handleMouseDown = (dateStr) => {
        if (disableRange) {
            onDateSelect({ start: dateStr, end: dateStr });
            return;
        }
        setIsDragging(true);
        setDragStart(dateStr);
        setDragEnd(dateStr);
    };

    const handleMouseEnter = (dateStr) => {
        if (isDragging && !disableRange) {
            setDragEnd(dateStr);
        }
    };

    const handleMouseUp = () => {
        if (isDragging && dragStart && dragEnd && !disableRange) {
            setIsDragging(false);
            const start = dragStart <= dragEnd ? dragStart : dragEnd;
            const end = dragStart <= dragEnd ? dragEnd : dragStart;
            onDateSelect({ start, end });
        }
    };

    // Helper to check if date is in current drag / tap range
    const rangeStatus = (() => {
        const s = dragStart || selectingStart;
        const e = dragEnd || selectingStart;
        if (!s || !e) return {};
        const start = s <= e ? s : e;
        const end = s <= e ? e : s;
        return { start, end };
    })();

    const { start: rStart, end: rEnd } = rangeStatus;

    return (
        <div
            className="p-3.5 bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border w-full max-w-[240px] select-none transition-all duration-300"
            onMouseLeave={() => {
                if (isDragging) handleMouseUp(); // Auto-finalize if leaving calendar
            }}
            onMouseUp={() => {
                if (isDragging) handleMouseUp(); // Catch-all mouseup
            }}
        >
            <div className="flex justify-between items-center mb-4 px-1">
                <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-xs tracking-tight">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h4>
                 <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-github-dark-muted transition-colors">
                        <ChevronLeft size={18} />
                    </button>
                    <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-github-dark-muted transition-colors">
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {selectingStart && !disableRange && (
                <div className="text-[10px] text-center font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 py-1 px-2 rounded-lg mb-2.5 animate-pulse">
                    Tap end date to set range
                </div>
            )}

            <div className="grid grid-cols-7 gap-1 text-center mb-3">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={`${day}-${i}`} className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase">{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {startPadding.map((_, i) => <div key={`pad-${i}`} />)}

                {days.map((date) => {
                    const dateStr = formatDate(date);
                    const isToday = isSameDay(date, new Date());

                    let isSelected = false;
                    let isRangeStart = false;
                    let isRangeEnd = false;
                    let isInRange = false;

                    // 1. Dragging or Tap-Selection Phase
                    if ((isDragging || selectingStart) && rStart && rEnd) {
                        isRangeStart = dateStr === rStart;
                        isRangeEnd = dateStr === rEnd;
                        isInRange = dateStr >= rStart && dateStr <= rEnd;
                        isSelected = isRangeStart || isRangeEnd;
                    }
                    // 2. Persistent View Phase (Props)
                    else {
                        const start = selectedDate;
                        // Use provided endDate or default to start if missing
                        const end = endDate || start;

                        const d = new Date(dateStr);
                        const dStart = new Date(start);
                        const dEnd = new Date(end);

                        // Basic range check
                        isInRange = d >= dStart && d <= dEnd;
                        isRangeStart = dateStr === start;
                        isRangeEnd = dateStr === end;
                        isSelected = isRangeStart || isRangeEnd || (start === end && isRangeStart);

                        // Edge Case: If daysToShow=1 (start==end), treat as single selection
                        if (start === end) {
                            isInRange = false;
                            isRangeStart = false;
                            isRangeEnd = false;
                            isSelected = dateStr === start;
                        }
                    }

                    const isDisabled = maxDate && dateStr > maxDate;

                    return (
                        <div
                            key={dateStr}
                            className={`relative w-6 h-6 flex items-center justify-center`}
                            onMouseDown={() => !isDisabled && handleMouseDown(dateStr)}
                            onMouseEnter={() => !isDisabled && handleMouseEnter(dateStr)}
                        >
                            {/* Range Background Connector */}
                            {isInRange && !isRangeStart && !isDisabled && (
                                <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-indigo-50 dark:bg-indigo-900/50 z-0" />
                            )}
                            {isInRange && !isRangeEnd && !isDisabled && (
                                <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-indigo-50 dark:bg-indigo-900/50 z-0" />
                            )}
                            {isInRange && !isDisabled && (
                                <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/50 rounded-full z-0 opacity-50" />
                            )}

                            {/* Date Circle */}
                            <button
                                type="button"
                                disabled={isDisabled}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isDisabled) handleDateClick(dateStr);
                                }}
                                className={`
                                    relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all duration-200 font-medium
                                    ${isDisabled ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed' :
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none scale-110 font-bold'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}
                                    ${!isSelected && isToday && !isDisabled ? 'text-indigo-600 dark:text-indigo-400 font-black ring-1 ring-indigo-200 dark:ring-indigo-800' : ''}
                                `}
                            >
                                {date.getDate()}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MiniCalendar;
