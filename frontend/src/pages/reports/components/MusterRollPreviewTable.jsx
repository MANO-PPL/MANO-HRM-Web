import React, { useMemo } from 'react';
import { FileSpreadsheet } from 'lucide-react';

const BORDER = '1px solid #E2E8F0';
const DIVIDER = '1.5px solid #CBD5E1';
const HEADER_DIVIDER = '1.5px solid #CBD5E1';

// Memoized single-employee subrows block for fast reconciliation & 0ms DOM updates
const EmployeeRowBlock = React.memo(({
    emp,
    eIdx,
    showPosition,
    showWorkHour,
    showIn,
    showOut,
    showEmpCode,
    showDaysInMonth,
    showPresentDays,
    empCodeLeft,
    daysInMonthLeft,
    presentDaysLeft,
    lastStickyCol,
    dateHeaders
}) => {
    const isBlockEven = eIdx % 2 === 0;
    const leftBg = isBlockEven ? '#FFFFFF' : '#F8FAFC';

    const subRows = [
        { type: 'status', label: showPosition ? (emp.position || 'Status') : 'Status', rowData: emp.statusRow },
        ...(showWorkHour ? [{ type: 'workHour', label: 'Work Hour', rowData: emp.workHourRow }] : []),
        ...(showIn ? [{ type: 'in', label: 'In', rowData: emp.inRow }] : []),
        ...(showOut ? [{ type: 'out', label: 'Out', rowData: emp.outRow }] : [])
    ];
    const rowSpanCount = subRows.length;

    return (
        <React.Fragment>
            {subRows.map((sr, rIdx) => {
                const isFirstRow = rIdx === 0;
                const isLastRow = rIdx === rowSpanCount - 1;
                const rowBottomBorder = isLastRow ? DIVIDER : BORDER;

                return (
                    <tr key={sr.type} className="hover:brightness-98 transition-all">
                        {/* On the first sub-row, render the merged left columns */}
                        {isFirstRow && (
                            <>
                                {/* Col 1: SR No. */}
                                <td
                                    rowSpan={rowSpanCount}
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

                                {/* Col 2: Name */}
                                <td
                                    rowSpan={rowSpanCount}
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
                            </>
                        )}

                        {/* Col 3: Attributes (Position / Work Hour / In / Out) */}
                        <td
                            style={{
                                width: '120px',
                                minWidth: '120px',
                                maxWidth: '120px',
                                left: '202px',
                                backgroundColor: leftBg,
                                color: isFirstRow ? '#334155' : '#475569',
                                border: BORDER,
                                borderRight: lastStickyCol === 'attributes' ? DIVIDER : BORDER,
                                borderBottom: rowBottomBorder,
                                zIndex: 20,
                                boxShadow: lastStickyCol === 'attributes' ? '4px 0 8px rgba(0,0,0,0.10)' : 'none'
                            }}
                            className={`sticky px-2 ${isFirstRow ? 'py-1 font-normal truncate align-middle text-xs' : 'py-0.5 text-[10px] font-normal'}`}
                        >
                            {sr.label}
                        </td>

                        {/* On the first sub-row, render the remaining merged columns */}
                        {isFirstRow && (
                            <>
                                {/* Sticky Col 4: Employee Code */}
                                {showEmpCode && (
                                    <td
                                        rowSpan={rowSpanCount}
                                        style={{
                                            width: '64px',
                                            minWidth: '64px',
                                            maxWidth: '64px',
                                            left: empCodeLeft,
                                            backgroundColor: leftBg,
                                            border: BORDER,
                                            borderRight: lastStickyCol === 'empCode' ? DIVIDER : BORDER,
                                            borderBottom: DIVIDER,
                                            zIndex: 20,
                                            boxShadow: lastStickyCol === 'empCode' ? '4px 0 8px rgba(0,0,0,0.10)' : 'none'
                                        }}
                                        className="sticky text-center font-mono font-normal px-2 text-slate-600 align-middle"
                                    >
                                        {emp.employeeCode}
                                    </td>
                                )}

                                {/* Sticky Col 5: Days in Month */}
                                {showDaysInMonth && (
                                    <td
                                        rowSpan={rowSpanCount}
                                        style={{
                                            width: '48px',
                                            minWidth: '48px',
                                            maxWidth: '48px',
                                            left: daysInMonthLeft,
                                            backgroundColor: leftBg,
                                            border: BORDER,
                                            borderRight: lastStickyCol === 'daysInMonth' ? DIVIDER : BORDER,
                                            borderBottom: DIVIDER,
                                            zIndex: 20,
                                            boxShadow: lastStickyCol === 'daysInMonth' ? '4px 0 8px rgba(0,0,0,0.10)' : 'none'
                                        }}
                                        className="sticky text-center font-normal px-1 text-slate-600 align-middle"
                                    >
                                        {emp.daysInMonth}
                                    </td>
                                )}

                                {/* Sticky Col 6: Present Days */}
                                {showPresentDays && (
                                    <td
                                        rowSpan={rowSpanCount}
                                        style={{
                                            width: '48px',
                                            minWidth: '48px',
                                            maxWidth: '48px',
                                            left: presentDaysLeft,
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
                                )}
                            </>
                        )}

                        {/* Date values across dates for this sub-row */}
                        {sr.rowData.map((val, dIdx) => {
                            const dh = dateHeaders[dIdx];
                            let cellBg = dh?.isHighlight ? '#FEF9C3' : '#FFFFFF';
                            let cellColor = dh?.isHighlight ? '#713F12' : '#334155';
                            let cellFontWeight = 'normal';

                            if (sr.type === 'status') {
                                if (val === '0.0') {
                                    cellBg = '#FEE2E2';
                                    cellColor = '#991B1B';
                                    cellFontWeight = '600';
                                }
                            }

                            return (
                                <td
                                    key={dIdx}
                                    style={{
                                        backgroundColor: cellBg,
                                        color: cellColor,
                                        fontWeight: cellFontWeight,
                                        border: BORDER,
                                        borderBottom: rowBottomBorder
                                    }}
                                    className={`text-center ${sr.type === 'status' ? 'py-1 text-xs' : 'py-0.5 text-[10px] font-normal'}`}
                                >
                                    {val}
                                </td>
                            );
                        })}
                    </tr>
                );
            })}
        </React.Fragment>
    );
});

const MusterRollPreviewTable = ({ musterRoll, searchQuery = '', columnsConfig = null }) => {
    const {
        dateHeaders = [],
        employees = []
    } = musterRoll || {};

    const activeCols = columnsConfig || musterRoll?.columnsConfig || {};
    const showPosition = activeCols.position !== false && activeCols.positionName !== false;
    const showWorkHour = activeCols.workedHours !== false && activeCols.workHour !== false;
    const showIn = activeCols.timeIn !== false && activeCols.inPunch !== false && activeCols.in !== false;
    const showOut = activeCols.timeOut !== false && activeCols.outPunch !== false && activeCols.out !== false;
    const showEmpCode = activeCols.employeeCode !== false && activeCols.empCode !== false;
    const showDaysInMonth = activeCols.daysInMonth !== false;
    const showPresentDays = activeCols.presentDays !== false;

    // Calculate left positions dynamically for sticky columns
    let nextLeft = 322;
    const empCodeLeft = `${nextLeft}px`;
    if (showEmpCode) nextLeft += 64;

    const daysInMonthLeft = `${nextLeft}px`;
    if (showDaysInMonth) nextLeft += 48;

    const presentDaysLeft = `${nextLeft}px`;
    if (showPresentDays) nextLeft += 48;

    const lastStickyCol = showPresentDays
        ? 'presentDays'
        : showDaysInMonth
            ? 'daysInMonth'
            : showEmpCode
                ? 'empCode'
                : 'attributes';

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

                            {/* Sticky Col 3: Attributes (renamed from Position) */}
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
                                    borderRight: lastStickyCol === 'attributes' ? DIVIDER : BORDER,
                                    borderBottom: HEADER_DIVIDER,
                                    zIndex: 50,
                                    boxShadow: lastStickyCol === 'attributes' ? '4px 0 8px rgba(0,0,0,0.12)' : 'none'
                                }}
                                className="sticky text-left font-semibold px-2 py-1 uppercase"
                            >
                                Attributes
                            </th>

                            {/* Sticky Col 4: Employee Code - Vertical */}
                            {showEmpCode && (
                                <th
                                    rowSpan={2}
                                    style={{
                                        width: '64px',
                                        minWidth: '64px',
                                        maxWidth: '64px',
                                        left: empCodeLeft,
                                        backgroundColor: '#F8FAFC',
                                        color: '#334155',
                                        border: BORDER,
                                        borderRight: lastStickyCol === 'empCode' ? DIVIDER : BORDER,
                                        borderBottom: HEADER_DIVIDER,
                                        verticalAlign: 'middle',
                                        height: '96px',
                                        zIndex: 50,
                                        boxShadow: lastStickyCol === 'empCode' ? '4px 0 8px rgba(0,0,0,0.12)' : 'none'
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
                            )}

                            {/* Sticky Col 5: Days in Month - Vertical */}
                            {showDaysInMonth && (
                                <th
                                    rowSpan={2}
                                    style={{
                                        width: '48px',
                                        minWidth: '48px',
                                        maxWidth: '48px',
                                        left: daysInMonthLeft,
                                        backgroundColor: '#F8FAFC',
                                        color: '#334155',
                                        border: BORDER,
                                        borderRight: lastStickyCol === 'daysInMonth' ? DIVIDER : BORDER,
                                        borderBottom: HEADER_DIVIDER,
                                        verticalAlign: 'middle',
                                        height: '96px',
                                        zIndex: 50,
                                        boxShadow: lastStickyCol === 'daysInMonth' ? '4px 0 8px rgba(0,0,0,0.12)' : 'none'
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
                            )}

                            {/* Sticky Col 6: Present Days - Vertical */}
                            {showPresentDays && (
                                <th
                                    rowSpan={2}
                                    style={{
                                        width: '48px',
                                        minWidth: '48px',
                                        maxWidth: '48px',
                                        left: presentDaysLeft,
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
                            )}

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
                        {filteredEmployees.map((emp, eIdx) => (
                            <EmployeeRowBlock
                                key={emp.userId || emp.employeeCode || eIdx}
                                emp={emp}
                                eIdx={eIdx}
                                showPosition={showPosition}
                                showWorkHour={showWorkHour}
                                showIn={showIn}
                                showOut={showOut}
                                showEmpCode={showEmpCode}
                                showDaysInMonth={showDaysInMonth}
                                showPresentDays={showPresentDays}
                                empCodeLeft={empCodeLeft}
                                daysInMonthLeft={daysInMonthLeft}
                                presentDaysLeft={presentDaysLeft}
                                lastStickyCol={lastStickyCol}
                                dateHeaders={dateHeaders}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default React.memo(MusterRollPreviewTable);
