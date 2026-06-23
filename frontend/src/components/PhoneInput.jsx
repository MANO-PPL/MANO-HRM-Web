import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, parsePhoneNumber } from '../utils/validation';

const PhoneInput = ({
    value,
    onChange,
    disabled = false,
    variant = "admin-desktop", // "admin-desktop" | "admin-mobile" | "register-desktop" | "register-mobile"
    placeholder,
    className = ""
}) => {
    const { country: currentCountry, localNumber } = parsePhoneNumber(value);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);

    const toggleDropdown = (e) => {
        e.preventDefault();
        if (disabled) return;
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
        setIsOpen(!isOpen);
        setSearch("");
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                triggerRef.current &&
                !triggerRef.current.contains(event.target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            window.addEventListener("scroll", () => setIsOpen(false));
            window.addEventListener("resize", () => setIsOpen(false));
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", () => setIsOpen(false));
            window.removeEventListener("resize", () => setIsOpen(false));
        };
    }, [isOpen]);

    const handleCountrySelect = (country) => {
        setIsOpen(false);
        const combined = `${country.dial_code}${localNumber}`;
        onChange(combined);
    };

    const handleLocalNumberChange = (e) => {
        const cleanVal = e.target.value.replace(/[^0-9\s\-()]/g, ""); // allow digits and basic styling symbols
        const combined = `${currentCountry.dial_code}${cleanVal}`;
        onChange(combined);
    };

    const filteredCountries = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial_code.includes(search)
    );

    // Dynamic style mapping based on page context (variant)
    let containerClass = "flex items-center rounded-lg border transition-all duration-200 bg-white dark:bg-dark-card border-slate-300 dark:border-github-dark-border focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500";
    let inputClass = "w-full bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-github-dark-text focus:outline-none placeholder:text-slate-400";
    let triggerClass = "flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-github-dark-subtle/50 hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors rounded-l-lg border-r border-slate-200 dark:border-github-dark-border h-full";

    if (variant === "register-desktop") {
        containerClass = "flex items-center rounded-lg border transition-all bg-slate-50 dark:bg-[#0d1117] border-slate-200 dark:border-[#30363d] focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 shadow-sm";
        inputClass = "w-full bg-transparent py-4 px-4 text-slate-900 dark:text-white font-medium outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm";
        triggerClass = "flex items-center gap-1.5 px-4 py-4 text-slate-700 dark:text-slate-300 hover:bg-slate-150/50 dark:hover:bg-[#161b22] transition-colors rounded-l-lg border-r border-slate-200 dark:border-[#30363d] font-semibold text-sm shrink-0 h-full";
    } else if (variant === "register-mobile") {
        containerClass = "flex items-center rounded-lg border transition-all bg-white dark:bg-[#0d1117] border-slate-200 dark:border-[#30363d] focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 shadow-sm";
        inputClass = "w-full bg-transparent py-3.5 px-4 text-slate-900 dark:text-white font-medium outline-none placeholder:text-slate-400 text-sm";
        triggerClass = "flex items-center gap-1.5 px-4 py-3.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-[#161b22] transition-colors rounded-l-lg border-r border-slate-200 dark:border-[#30363d] font-semibold text-sm shrink-0 h-full";
    } else if (variant === "admin-mobile") {
        containerClass = "flex items-center rounded-xl border transition-all bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 focus-within:border-indigo-500";
        inputClass = "w-full bg-transparent py-3 px-4 text-sm text-slate-900 dark:text-white outline-none";
        triggerClass = "flex items-center gap-1 px-3 py-3 text-slate-700 dark:text-slate-300 rounded-l-xl border-r border-slate-200 dark:border-white/10 text-sm shrink-0 h-full";
    } else if (variant === "admin-desktop") {
        containerClass = `flex items-center rounded-lg border transition-all bg-white dark:bg-github-dark-subtle border-slate-300 dark:border-github-dark-border focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 ${className}`;
        inputClass = "w-full bg-transparent py-2.5 px-3 text-slate-900 dark:text-github-dark-text focus:outline-none placeholder:text-slate-450 text-sm";
        triggerClass = "flex items-center gap-1.5 px-3 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-[#21262d] transition-colors rounded-l-lg border-r border-slate-300 dark:border-github-dark-border text-sm shrink-0 h-full";
    }

    return (
        <div className="w-full relative">
            <div className={containerClass}>
                <button
                    ref={triggerRef}
                    onClick={toggleDropdown}
                    disabled={disabled}
                    className={triggerClass}
                    type="button"
                >
                    <span className="text-base select-none">{currentCountry.flag}</span>
                    <span className="text-xs font-mono">{currentCountry.dial_code}</span>
                    <ChevronDown size={14} className="opacity-55 shrink-0" />
                </button>

                <input
                    type="tel"
                    disabled={disabled}
                    value={localNumber}
                    onChange={handleLocalNumberChange}
                    className={inputClass}
                    placeholder={placeholder || currentCountry.placeholder}
                />
            </div>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[9999] bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden flex flex-col"
                    style={{
                        top: position.top,
                        left: position.left,
                        minWidth: '240px',
                        maxWidth: '280px',
                        maxHeight: '260px'
                    }}
                >
                    <div className="p-2 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#161b22]/50">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                autoFocus
                                type="text"
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-[#30363d] rounded-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-github-dark-text"
                                placeholder="Search country or code..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto p-1 custom-scrollbar flex-1">
                        {filteredCountries.length > 0 ? (
                            filteredCountries.map((c, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleCountrySelect(c)}
                                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between group transition-colors text-xs ${
                                        currentCountry.code === c.code
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        <span>{c.flag}</span>
                                        <span className="truncate">{c.name}</span>
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors">
                                        {c.dial_code}
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                                No countries found.
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PhoneInput;
