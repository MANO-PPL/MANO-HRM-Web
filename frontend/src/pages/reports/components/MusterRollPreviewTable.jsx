import React, { useState, useMemo } from 'react';
import { Search, FileSpreadsheet } from 'lucide-react';

const BORDER = '1px solid #E2E8F0';
const DIVIDER = '1px solid #CBD5E1';
const HEADER_DIVIDER = '1.5px solid #CBD5E1';

const MusterRollPreviewTable = ({ musterRoll, searchQuery = '' }) => {
    const {
        companyName = 'Mano Project Consultant Pvt Ltd',
        dateHeaders = [],
        employees = []
    } = musterRoll || {};

    const filteredEmployees = useMemo(() => {
        const q = (searchQuery || '').toLowerCase().trim();
        if (!q) return employees;
        return employees.filter(emp =>
            (emp.name && emp.name.toLowerCase().includes(q)) ||
            (emp.employeeCode && emp.employeeCode.toLowerCase().includes(q)) ||
            (emp.position && emp.position.toLowerCase().includes(q))
        );
    }, [employees, searchQuery]);

    if (!musterRoll || employees.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white dark:bg-dark-card border border-dashed border-slate-200 dark:border-github-dark-border rounded-xl">
                <FileSpreadsheet className="text-slate-300 dark:text-slate-600" size={48} />
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">No muster roll records found.</p>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col">
            {/* Muster Roll Excel Spreadsheet Grid */}
            <div
                className="rounded-xl overflow-auto border border-slate-200 dark:border-[#30363d] shadow-sm bg-white select-text print:border-none print:shadow-none print:rounded-none"
                style={{ maxHeight: 'calc(100vh - 250px)', minHeight: '380px' }}
            >
                <table
                    className="w-full text-left"
                    style={{
                        borderCollapse: 'separate',
                        borderSpacing: 0,
                        fontFamily: '"Segoe UI", Calibri, Arial, sans-serif',
                        fontSize: '11px',
                        minWidth: 'max-content'
                    }}
                >
                    {/* Header: Double row matching reference sheet */}
                    <thead className="sticky top-0 z-30 shadow-xs">
                        {/* Header Row 1: Left static titles + Date Day-of-week */}
                        <tr className="bg-slate-50 dark:bg-slate-800">
                            {/* Sticky Col 1: SR No */}
                            <th
                                rowSpan={2}
                                style={{
                                    width: '42px',
                                    minWidth: '42px',
                                    maxWidth: '42px',
                                    left: '0px',
                                    backgroundColor: '#F8FAFC',
                                    color: '#334155',
                                    border: BORDER,
                                    borderBottom: HEADER_DIVIDER,
                                    zIndex: 50
                                }}
                                className="sticky text-center font-semibold px-1 py-1 uppercase"
                            >
                                SR<br />No.
                            </th>
                            {/* Sticky Col 2: Name */}
                            <th
                                rowSpan={2}
                                style={{
                                    width: '160px',
                                    minWidth: '160px',
                                    maxWidth: '160px',
                                    left: '42px',
                                    backgroundColor: '#F8FAFC',
                                    color: '#334155',
                                    border: BORDER,
                                    borderBottom: HEADER_DIVIDER,
                                    zIndex: 50
                                }}
                                className="sticky text-left font-semibold px-3 py-1 uppercase"
                            >
                                Name
                            </th>
                            {/* Sticky Col 3: Position / Row Type */}
                            <th
                                rowSpan={2}
                                style={{
                                    width: '120px',
                                    minWidth: '120px',
                                    maxWidth: '120px',
                                    left: '202px',
                                    backgroundColor: '#F8FAFC',
                                    color: '#334155',
                                    border: BORDER,
                                    borderBottom: HEADER_DIVIDER,
                                    zIndex: 50
                                }}
                                className="sticky text-left font-semibold px-2 py-1 uppercase"
                            >
                                Position
                            </th>
                            {/* Sticky Col 4: Employee Code - Vertical */}
                            <th
                                rowSpan={2}
                                style={{
                                    width: '64px',
                                    minWidth: '64px',
                                    maxWidth: '64px',
                                    left: '322px',
                                    backgroundColor: '#F8FAFC',
                                    color: '#334155',
                                    border: BORDER,
                                    borderBottom: HEADER_DIVIDER,
                                    verticalAlign: 'middle',
                                    height: '96px',
                                    zIndex: 50
                                }}
                                className="sticky text-center font-semibold p-1 select-none"
                            >
                                <div className="flex items-center justify-center h-full w-full">
                                    <span
                                        style={{
                                            writingMode: 'vertical-rl',
                                            transform: 'rotate(180deg)'
                                        }}
                                        className="whitespace-nowrap text-[10.5px] font-semibold tracking-wide uppercase"
                                    >
                                        Employee Code
                                    </span>
                                </div>
                            </th>
                            {/* Sticky Col 5: Grade - Vertical */}
                            <th
                                rowSpan={2}
                                style={{
                                    width: '42px',
                                    minWidth: '42px',
                                    maxWidth: '42px',
                                    left: '386px',
                                    backgroundColor: '#F8FAFC',
                                    color: '#334155',
                                    border: BORDER,
                                    borderBottom: HEADER_DIVIDER,
                                    verticalAlign: 'middle',
                                    height: '96px',
                                    zIndex: 50
                                }}
                                className="sticky text-center font-semibold p-1 select-none"
                            >
                                <div className="flex items-center justify-center h-full w-full">
                                    <span
                                        style={{
                                            writingMode: 'vertical-rl',
                                            transform: 'rotate(180deg)'
                                        }}
                                        className="whitespace-nowrap text-[10.5px] font-semibold tracking-wide uppercase"
                                    >
                                        Grade
                                    </span>
                                </div>
                            </th>
                            {/* Sticky Col 6: Days in Month - Vertical */}
                            <th
                                rowSpan={2}
                                style={{
                                    width: '48px',
                                    minWidth: '48px',
                                    maxWidth: '48px',
                                    left: '428px',
                                    backgroundColor: '#F8FAFC',
                                    color: '#334155',
                                    border: BORDER,
                                    borderBottom: HEADER_DIVIDER,
                                    verticalAlign: 'middle',
                                    height: '96px',
                                    zIndex: 50
                                }}
                                className="sticky text-center font-semibold p-1 select-none"
                            >
                                <div className="flex items-center justify-center h-full w-full">
                                    <span
                                        style={{
                                            writingMode: 'vertical-rl',
                                            transform: 'rotate(180deg)'
                                        }}
                                        className="whitespace-nowrap text-[10.5px] font-semibold tracking-wide uppercase"
                                    >
                                        Days in Month
                                    </span>
                                </div>
                            </th>
                            {/* Sticky Col 7: Present Days - Vertical */}
                            <th
                                rowSpan={2}
                                style={{
                                    width: '48px',
                                    minWidth: '48px',
                                    maxWidth: '48px',
                                    left: '476px',
                                    backgroundColor: '#F8FAFC',
                                    color: '#334155',
                                    border: BORDER,
                                    borderRight: DIVIDER,
                                    borderBottom: HEADER_DIVIDER,
                                    verticalAlign: 'middle',
                                    height: '96px',
                                    zIndex: 50,
                                    boxShadow: '4px 0 8px rgba(0,0,0,0.12)'
                                }}
                                className="sticky text-center font-semibold p-1 select-none"
                            >
                                <div className="flex items-center justify-center h-full w-full">
                                    <span
                                        style={{
                                            writingMode: 'vertical-rl',
                                            transform: 'rotate(180deg)'
                                        }}
                                        className="whitespace-nowrap text-[10.5px] font-semibold tracking-wide uppercase"
                                    >
                                        Present Days
                                    </span>
                                </div>
                            </th>

                            {/* Date columns Row 1: Day of week - Vertical */}
                            {dateHeaders.map((dh, dIdx) => (
                                <th
                                    key={dIdx}
                                    style={{
                                        width: '40px',
                                        minWidth: '40px',
                                        height: '32px',
                                        backgroundColor: dh.isHighlight ? '#FEF9C3' : '#F8FAFC',
                                        color: dh.isHighlight ? '#713F12' : '#334155',
                                        border: BORDER,
                                        verticalAlign: 'middle'
                                    }}
                                    className="text-center font-semibold p-0.5 select-none"
                                >
                                    <div className="flex items-center justify-center h-full w-full">
                                        <span
                                            style={{
                                                writingMode: 'vertical-rl',
                                                transform: 'rotate(180deg)'
                                            }}
                                            className="whitespace-nowrap text-[10px] font-semibold"
                                        >
                                            {dh.dayOfWeek}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>

                        {/* Header Row 2: Date String - Vertical */}
                        <tr className="bg-slate-50 dark:bg-slate-800">
                            {dateHeaders.map((dh, dIdx) => (
                                <th
                                    key={dIdx}
                                    style={{
                                        width: '40px',
                                        minWidth: '40px',
                                        height: '64px',
                                        backgroundColor: dh.isHighlight ? '#FEF9C3' : '#F8FAFC',
                                        color: dh.isHighlight ? '#713F12' : '#475569',
                                        border: BORDER,
                                        borderBottom: HEADER_DIVIDER,
                                        verticalAlign: 'middle'
                                    }}
                                    className="text-center font-normal p-0.5 select-none"
                                >
                                    <div className="flex items-center justify-center h-full w-full">
                                        <span
                                            style={{
                                                writingMode: 'vertical-rl',
                                                transform: 'rotate(180deg)'
                                            }}
                                            className="whitespace-nowrap text-[9.5px] font-normal"
                                        >
                                            {dh.dateFormatted}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody>
                        {/* Employee Rows: 4 Rows Per Employee */}
                        {filteredEmployees.map((emp, eIdx) => {
                            const isBlockEven = eIdx % 2 === 0;
                            const leftBg = isBlockEven ? '#FFFFFF' : '#F8FAFC';

                            return (
                                <React.Fragment key={emp.userId || eIdx}>
                                    {/* ROW 1: STATUS / UNITS */}
                                    <tr className="hover:brightness-98 transition-all">
                                        {/* Col 1: SR No. (RowSpan 4, Sticky) - Normal unbold */}
                                        <td
                                            rowSpan={4}
                                            style={{
                                                width: '42px',
                                                minWidth: '42px',
                                                maxWidth: '42px',
                                                left: '0px',
                                                backgroundColor: leftBg,
                                                border: BORDER,
                                                borderBottom: DIVIDER,
                                                zIndex: 20
                                            }}
                                            className="sticky text-center font-normal px-1 text-slate-600 align-middle"
                                        >
                                            {emp.srNo}
                                        </td>

                                        {/* Col 2: Name (RowSpan 4, Sticky) - Medium for clear identity */}
                                        <td
                                            rowSpan={4}
                                            style={{
                                                width: '160px',
                                                minWidth: '160px',
                                                maxWidth: '160px',
                                                left: '42px',
                                                backgroundColor: leftBg,
                                                border: BORDER,
                                                borderBottom: DIVIDER,
                                                zIndex: 20
                                            }}
                                            className="sticky px-3 font-medium text-slate-800 text-xs align-middle"
                                        >
                                            {emp.name}
                                        </td>

                                        {/* Col 3: Position (Row 1 cell, Sticky) - Normal unbold */}
                                        <td
                                            style={{
                                                width: '120px',
                                                minWidth: '120px',
                                                maxWidth: '120px',
                                                left: '202px',
                                                backgroundColor: leftBg,
                                                border: BORDER,
                                                zIndex: 20
                                            }}
                                            className="sticky px-2 py-1 text-slate-600 font-normal truncate align-middle"
                                        >
                                            {emp.position}
                                        </td>

                                        {/* Sticky Col 4: Employee Code (RowSpan 4) - Normal unbold */}
                                        <td
                                            rowSpan={4}
                                            style={{
                                                width: '64px',
                                                minWidth: '64px',
                                                maxWidth: '64px',
                                                left: '322px',
                                                backgroundColor: leftBg,
                                                border: BORDER,
                                                borderBottom: DIVIDER,
                                                zIndex: 20
                                            }}
                                            className="sticky text-center font-mono font-normal px-2 text-slate-600 align-middle"
                                        >
                                            {emp.employeeCode}
                                        </td>

                                        {/* Sticky Col 5: Grade (RowSpan 4) - Normal unbold */}
                                        <td
                                            rowSpan={4}
                                            style={{
                                                width: '42px',
                                                minWidth: '42px',
                                                maxWidth: '42px',
                                                left: '386px',
                                                backgroundColor: leftBg,
                                                border: BORDER,
                                                borderBottom: DIVIDER,
                                                zIndex: 20
                                            }}
                                            className="sticky text-center font-mono font-normal px-1 text-slate-600 align-middle"
                                        >
                                            {emp.grade}
                                        </td>

                                        {/* Sticky Col 6: Days in Month (RowSpan 4) - Normal unbold */}
                                        <td
                                            rowSpan={4}
                                            style={{
                                                width: '48px',
                                                minWidth: '48px',
                                                maxWidth: '48px',
                                                left: '428px',
                                                backgroundColor: leftBg,
                                                border: BORDER,
                                                borderBottom: DIVIDER,
                                                zIndex: 20
                                            }}
                                            className="sticky text-center font-normal px-1 text-slate-600 align-middle"
                                        >
                                            {emp.daysInMonth}
                                        </td>

                                        {/* Sticky Col 7: Present Days (RowSpan 4) - Medium */}
                                        <td
                                            rowSpan={4}
                                            style={{
                                                width: '48px',
                                                minWidth: '48px',
                                                maxWidth: '48px',
                                                left: '476px',
                                                backgroundColor: leftBg,
                                                border: BORDER,
                                                borderRight: DIVIDER,
                                                borderBottom: DIVIDER,
                                                zIndex: 20,
                                                boxShadow: '4px 0 8px rgba(0,0,0,0.10)'
                                            }}
                                            className="sticky text-center font-medium px-2 text-emerald-800 text-xs align-middle"
                                        >
                                            {emp.presentDays}
                                        </td>

                                        {/* Date Units (Row 1) */}
                                        {emp.statusRow.map((val, dIdx) => {
                                            const dh = dateHeaders[dIdx];
                                            let cellBg = '#FFFFFF';
                                            let cellColor = '#334155';
                                            let cellFontWeight = 'normal';

                                            if (val === '0.0') {
                                                cellBg = '#FEE2E2';
                                                cellColor = '#991B1B';
                                                cellFontWeight = '600'; // Subtle red highlight for absence
                                            } else if (dh?.isHighlight) {
                                                cellBg = '#FEF9C3';
                                                cellColor = '#713F12';
                                                cellFontWeight = 'normal'; // Soft warm yellow on holiday/Sunday
                                            }

                                            return (
                                                <td
                                                    key={dIdx}
                                                    style={{
                                                        backgroundColor: cellBg,
                                                        color: cellColor,
                                                        fontWeight: cellFontWeight,
                                                        border: BORDER
                                                    }}
                                                    className="text-center py-1 text-xs"
                                                >
                                                    {val}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* ROW 2: WORK HOUR */}
                                    <tr className="hover:brightness-98 transition-all">
                                        {/* Row Type: Work Hour - Normal */}
                                        <td
                                            style={{
                                                width: '120px',
                                                minWidth: '120px',
                                                maxWidth: '120px',
                                                left: '202px',
                                                backgroundColor: leftBg,
                                                color: '#475569',
                                                border: BORDER,
                                                zIndex: 20
                                            }}
                                            className="sticky px-2 py-0.5 text-[10px] font-normal"
                                        >
                                            Work Hour
                                        </td>

                                        {/* Hours across dates - Normal unbold */}
                                        {emp.workHourRow.map((val, dIdx) => {
                                            const dh = dateHeaders[dIdx];
                                            const cellBg = dh?.isHighlight ? '#FEF9C3' : '#FFFFFF';
                                            const cellColor = dh?.isHighlight ? '#713F12' : '#334155';
                                            return (
                                                <td
                                                    key={dIdx}
                                                    style={{
                                                        backgroundColor: cellBg,
                                                        color: cellColor,
                                                        border: BORDER
                                                    }}
                                                    className="text-center py-0.5 text-[10px] font-normal"
                                                >
                                                    {val}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* ROW 3: IN PUNCH */}
                                    <tr className="hover:brightness-98 transition-all">
                                        {/* Row Type: In - Normal */}
                                        <td
                                            style={{
                                                width: '120px',
                                                minWidth: '120px',
                                                maxWidth: '120px',
                                                left: '202px',
                                                backgroundColor: leftBg,
                                                color: '#475569',
                                                border: BORDER,
                                                zIndex: 20
                                            }}
                                            className="sticky px-2 py-0.5 text-[10px] font-normal"
                                        >
                                            In
                                        </td>

                                        {/* In Punch across dates - Normal unbold */}
                                        {emp.inRow.map((val, dIdx) => {
                                            const dh = dateHeaders[dIdx];
                                            const cellBg = dh?.isHighlight ? '#FEF9C3' : '#FFFFFF';
                                            const cellColor = dh?.isHighlight ? '#713F12' : '#334155';
                                            return (
                                                <td
                                                    key={dIdx}
                                                    style={{
                                                        backgroundColor: cellBg,
                                                        color: cellColor,
                                                        border: BORDER
                                                    }}
                                                    className="text-center py-0.5 text-[10px] font-normal"
                                                >
                                                    {val}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* ROW 4: OUT PUNCH */}
                                    <tr className="hover:brightness-98 transition-all">
                                        {/* Row Type: Out - Normal */}
                                        <td
                                            style={{
                                                width: '120px',
                                                minWidth: '120px',
                                                maxWidth: '120px',
                                                left: '202px',
                                                backgroundColor: leftBg,
                                                color: '#475569',
                                                border: BORDER,
                                                borderBottom: DIVIDER,
                                                zIndex: 20
                                            }}
                                            className="sticky px-2 py-0.5 text-[10px] font-normal"
                                        >
                                            Out
                                        </td>

                                        {/* Out Punch across dates - Normal unbold */}
                                        {emp.outRow.map((val, dIdx) => {
                                            const dh = dateHeaders[dIdx];
                                            const cellBg = dh?.isHighlight ? '#FEF9C3' : '#FFFFFF';
                                            const cellColor = dh?.isHighlight ? '#713F12' : '#334155';
                                            return (
                                                <td
                                                    key={dIdx}
                                                    style={{
                                                        backgroundColor: cellBg,
                                                        color: cellColor,
                                                        border: BORDER,
                                                        borderBottom: DIVIDER
                                                    }}
                                                    className="text-center py-0.5 text-[10px] font-normal"
                                                >
                                                    {val}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MusterRollPreviewTable;
