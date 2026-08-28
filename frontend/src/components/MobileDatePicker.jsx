import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react';

const MobileDatePicker = ({ label, value, onChange, placeholder = "Select date", minDate, maxDate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const containerRef = useRef(null);

    // Initialize based on value (YYYY-MM-DD)
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setCurrentMonth(date.getMonth());
                setCurrentYear(date.getFullYear());
            }
        }
    }, [value, isOpen]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const monthNames = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];

    const handleDayClick = (day) => {
        const monthStr = String(currentMonth + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const isToday = (day) => {
        const today = new Date();
        return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
    };

    const isSelected = (day) => {
        if (!value) return false;
        const selected = new Date(value);
        return day === selected.getDate() && currentMonth === selected.getMonth() && currentYear === selected.getFullYear();
    };

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    };

    const renderCalendar = () => {
        const totalDays = daysInMonth(currentMonth, currentYear);
        const startDay = firstDayOfMonth(currentMonth, currentYear);
        const days = [];

        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
        }

        for (let i = 1; i <= totalDays; i++) {
            const monthStr = String(currentMonth + 1).padStart(2, '0');
            const dayStr = String(i).padStart(2, '0');
            const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
            
            let isDisabled = false;
            if (minDate && dateStr < minDate) isDisabled = true;
            if (maxDate && dateStr > maxDate) isDisabled = true;

            days.push(
                <button
                    key={i}
                    onClick={() => !isDisabled && handleDayClick(i)}
                    disabled={isDisabled}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all
                        ${isDisabled
                            ? 'opacity-20 cursor-not-allowed text-slate-350 dark:text-slate-650'
                            : isSelected(i)
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : isToday(i)
                                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20'
                                    : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                        }
                    `}
                    type="button"
                >
                    {i}
                </button>
            );
        }

        return days;
    };

    const canPrevMonth = () => {
        if (!minDate) return true;
        const prevMonthEnd = new Date(currentYear, currentMonth, 0);
        const y = prevMonthEnd.getFullYear();
        const m = String(prevMonthEnd.getMonth() + 1).padStart(2, '0');
        const d = String(prevMonthEnd.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` >= minDate;
    };

    const canNextMonth = () => {
        if (!maxDate) return true;
        const nextMonthStart = new Date(currentYear, currentMonth + 1, 1);
        const y = nextMonthStart.getFullYear();
        const m = String(nextMonthStart.getMonth() + 1).padStart(2, '0');
        const d = String(nextMonthStart.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` <= maxDate;
    };

    const handlePrevMonth = () => {
        if (!canPrevMonth()) return;
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (!canNextMonth()) return;
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const todayDate = new Date();
    const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
    const isTodayDisabled = (minDate && todayStr < minDate) || (maxDate && todayStr > maxDate);

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <label className="block text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1 px-1">
                    {label}
                </label>
            )}

            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full py-1.5 px-2.5 rounded-lg border flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                    isOpen 
                        ? 'border-indigo-500 ring-2 ring-indigo-500/10 bg-white dark:bg-dark-card' 
                        : 'border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-white/5'
                }`}
            >
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <Calendar size={12} className="text-indigo-500 shrink-0" />
                    <span className={`text-[10px] font-bold truncate ${value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                        {value ? formatDateDisplay(value) : placeholder}
                    </span>
                </div>
                <ChevronDown size={11} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute left-0 mt-1.5 w-[250px] bg-white dark:bg-[#161b22] rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                    {/* Header */}
                    <div className="p-2 px-3 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
                        <button 
                            onClick={handlePrevMonth}
                            disabled={!canPrevMonth()}
                            type="button" 
                            className={`p-1.5 rounded-lg text-slate-500 transition-colors ${!canPrevMonth() ? 'opacity-20 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <div className="text-[9px] font-black text-slate-800 dark:text-white uppercase tracking-widest text-center">
                            {monthNames[currentMonth]} {currentYear}
                        </div>
                        <button 
                            onClick={handleNextMonth}
                            disabled={!canNextMonth()}
                            type="button" 
                            className={`p-1.5 rounded-lg text-slate-500 transition-colors ${!canNextMonth() ? 'opacity-20 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 gap-0.5 px-3 pt-3 text-center justify-items-center">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-[8px] uppercase font-black text-slate-400 tracking-tighter w-8 h-8 flex items-center justify-center">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-0.5 p-3 pt-1 justify-items-center">
                        {renderCalendar()}
                    </div>

                    {/* Footer */}
                    <div className="p-2 border-t border-slate-50 dark:border-slate-800 flex justify-between bg-slate-50/30 dark:bg-black/10">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isTodayDisabled) {
                                    onChange(todayStr);
                                    setIsOpen(false);
                                }
                            }}
                            disabled={isTodayDisabled}
                            type="button"
                            className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 ${isTodayDisabled ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-indigo-500'}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                            }}
                            type="button"
                            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileDatePicker;
