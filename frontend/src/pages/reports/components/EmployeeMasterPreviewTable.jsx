import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Users, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

const BORDER = '1px solid #E2E8F0';
const STICKY_DIVIDER = '1.5px solid #CBD5E1';

const EmployeeMasterPreviewTable = ({
    activeFilters,
    previewData,
    loadingPreview,
    cacheHit,
    searchQuery = '',
    statusFilter = 'All'
}) => {
    const [sortKey, setSortKey] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

    // Extract user items from enriched previewData or fallback to parsing previewData.rows
    const allUsers = useMemo(() => {
        if (Array.isArray(previewData?.users) && previewData.users.length > 0) {
            return previewData.users;
        }

        const rows = previewData?.rows || [];
        const cols = previewData?.columns || [];

        return rows.map((row, idx) => {
            const getVal = (colName) => {
                const cIdx = cols.findIndex(c => (c || '').toString().toLowerCase() === colName.toLowerCase());
                return cIdx !== -1 ? row[cIdx] : '';
            };

            return {
                id: idx + 1,
                code: getVal('Code') || row[0] || `EMP-${idx + 1}`,
                name: getVal('Name') || row[1] || 'Unknown',
                department: getVal('Department') || getVal('Dept') || row[2] || '-',
                designation: getVal('Designation') || row[3] || '-',
                shift: getVal('Shift') || row[4] || 'General Shift',
                phone: getVal('Phone') || row[5] || '-',
                email: getVal('Email') || row[6] || '-',
                joiningDate: getVal('Joining Date') || row[7] || '-',
                role: getVal('Role') || row[8] || 'employee',
                status: getVal('Status') || row[9] || 'Active',
            };
        });
    }, [previewData]);

    // Status counts for top summary bar
    const counts = useMemo(() => {
        const total = allUsers.length;
        let active = 0;
        let inactive = 0;
        let deleted = 0;
        allUsers.forEach(u => {
            const s = (u.status || '').toLowerCase();
            if (s === 'active') active++;
            else if (s === 'deleted') deleted++;
            else inactive++;
        });
        return { total, active, inactive, deleted };
    }, [allUsers]);

    // Filter by live search and status chip
    const filteredUsers = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return allUsers.filter(u => {
            const matchesStatus = statusFilter === 'All' || u.status.toLowerCase() === statusFilter.toLowerCase();
            if (!matchesStatus) return false;

            if (!q) return true;
            return (
                (u.name && u.name.toLowerCase().includes(q)) ||
                (u.code && u.code.toLowerCase().includes(q)) ||
                (u.department && u.department.toLowerCase().includes(q)) ||
                (u.designation && u.designation.toLowerCase().includes(q)) ||
                (u.phone && u.phone.toLowerCase().includes(q)) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.shift && u.shift.toLowerCase().includes(q))
            );
        });
    }, [allUsers, searchQuery, statusFilter]);

    // Sorted items
    const sortedUsers = useMemo(() => {
        return [...filteredUsers].sort((a, b) => {
            const aVal = (a[sortKey] || '').toString().toLowerCase();
            const bVal = (b[sortKey] || '').toString().toLowerCase();
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredUsers, sortKey, sortOrder]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    if (loadingPreview) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border">
                <div className="w-9 h-9 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold">Loading employee master data...</p>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col">
            {/* Table Container - Excel Master Replica */}
            <div
                className="rounded-xl overflow-auto border border-slate-200 dark:border-[#30363d] shadow-sm bg-white select-text"
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
                    {/* Header Row */}
                    <thead className="sticky top-0 z-30 shadow-xs">
                        <tr className="bg-[#1F4E78] text-white">
                            {/* Sticky Col 1: # */}
                            <th
                                style={{
                                    width: '42px',
                                    minWidth: '42px',
                                    maxWidth: '42px',
                                    left: '0px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB',
                                    zIndex: 40
                                }}
                                className="sticky text-center font-bold px-1 py-2.5 uppercase text-[9.5px]"
                            >
                                #
                            </th>

                            {/* Sticky Col 2: Code */}
                            <th
                                onClick={() => handleSort('code')}
                                style={{
                                    width: '100px',
                                    minWidth: '100px',
                                    left: '42px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB',
                                    zIndex: 40
                                }}
                                className="sticky text-left font-bold px-3 py-2.5 uppercase text-[10px] cursor-pointer select-none group"
                                title="Sort by Code"
                            >
                                <div className="flex items-center justify-between">
                                    <span>Code</span>
                                    {sortKey === 'code' ? (
                                        sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    ) : (
                                        <ChevronsUpDown size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                                    )}
                                </div>
                            </th>

                            {/* Sticky Col 3: Employee Name */}
                            <th
                                onClick={() => handleSort('name')}
                                style={{
                                    width: '180px',
                                    minWidth: '180px',
                                    left: '142px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB',
                                    borderRight: STICKY_DIVIDER,
                                    zIndex: 40
                                }}
                                className="sticky text-left font-bold px-3 py-2.5 uppercase text-[10px] cursor-pointer select-none group"
                                title="Sort by Name"
                            >
                                <div className="flex items-center justify-between">
                                    <span>Employee Name</span>
                                    {sortKey === 'name' ? (
                                        sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    ) : (
                                        <ChevronsUpDown size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                                    )}
                                </div>
                            </th>

                            {/* Department */}
                            <th
                                onClick={() => handleSort('department')}
                                style={{
                                    width: '140px',
                                    minWidth: '140px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB'
                                }}
                                className="text-left font-bold px-3 py-2.5 uppercase text-[10px] cursor-pointer select-none group"
                                title="Sort by Department"
                            >
                                <div className="flex items-center justify-between">
                                    <span>Department</span>
                                    {sortKey === 'department' ? (
                                        sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    ) : (
                                        <ChevronsUpDown size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                                    )}
                                </div>
                            </th>

                            {/* Designation */}
                            <th
                                onClick={() => handleSort('designation')}
                                style={{
                                    width: '140px',
                                    minWidth: '140px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB'
                                }}
                                className="text-left font-bold px-3 py-2.5 uppercase text-[10px] cursor-pointer select-none group"
                                title="Sort by Designation"
                            >
                                <div className="flex items-center justify-between">
                                    <span>Designation</span>
                                    {sortKey === 'designation' ? (
                                        sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    ) : (
                                        <ChevronsUpDown size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                                    )}
                                </div>
                            </th>

                            {/* Shift */}
                            <th
                                onClick={() => handleSort('shift')}
                                style={{
                                    width: '130px',
                                    minWidth: '130px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB'
                                }}
                                className="text-left font-bold px-3 py-2.5 uppercase text-[10px] cursor-pointer select-none group"
                                title="Sort by Shift"
                            >
                                <div className="flex items-center justify-between">
                                    <span>Shift</span>
                                    {sortKey === 'shift' ? (
                                        sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    ) : (
                                        <ChevronsUpDown size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                                    )}
                                </div>
                            </th>

                            {/* Phone */}
                            <th
                                style={{
                                    width: '115px',
                                    minWidth: '115px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB'
                                }}
                                className="text-center font-bold px-3 py-2.5 uppercase text-[10px]"
                            >
                                Phone
                            </th>

                            {/* Email */}
                            <th
                                onClick={() => handleSort('email')}
                                style={{
                                    width: '190px',
                                    minWidth: '190px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB'
                                }}
                                className="text-left font-bold px-3 py-2.5 uppercase text-[10px] cursor-pointer select-none group"
                                title="Sort by Email"
                            >
                                <div className="flex items-center justify-between">
                                    <span>Email</span>
                                    {sortKey === 'email' ? (
                                        sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    ) : (
                                        <ChevronsUpDown size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                                    )}
                                </div>
                            </th>

                            {/* Joining Date */}
                            <th
                                onClick={() => handleSort('joiningDate')}
                                style={{
                                    width: '110px',
                                    minWidth: '110px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB'
                                }}
                                className="text-center font-bold px-2 py-2.5 uppercase text-[10px] cursor-pointer select-none group"
                                title="Sort by Joining Date"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <span>Joining Date</span>
                                    {sortKey === 'joiningDate' && (
                                        sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    )}
                                </div>
                            </th>

                            {/* Role */}
                            <th
                                style={{
                                    width: '90px',
                                    minWidth: '90px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB'
                                }}
                                className="text-center font-bold px-2 py-2.5 uppercase text-[10px]"
                            >
                                Role
                            </th>

                            {/* Status */}
                            <th
                                onClick={() => handleSort('status')}
                                style={{
                                    width: '100px',
                                    minWidth: '100px',
                                    backgroundColor: '#1F4E78',
                                    color: '#FFFFFF',
                                    border: '1px solid #2563EB'
                                }}
                                className="text-center font-bold px-2 py-2.5 uppercase text-[10px] cursor-pointer select-none group"
                                title="Sort by Status"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <span>Status</span>
                                    {sortKey === 'status' && (
                                        sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    )}
                                </div>
                            </th>
                        </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody>
                        {sortedUsers.length > 0 ? (
                            sortedUsers.map((emp, idx) => {
                                const isEven = idx % 2 === 0;
                                const rowBg = isEven ? '#F8FAFD' : '#FFFFFF';
                                const initials = (emp.name || '')
                                    .split(' ')
                                    .filter(Boolean)
                                    .map(p => p[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase();

                                const statusLower = (emp.status || '').toLowerCase();
                                const isDeleted = statusLower === 'deleted';
                                const isActive = statusLower === 'active';

                                return (
                                    <tr
                                        key={emp.id || idx}
                                        className="hover:bg-slate-100/80 transition-colors"
                                        style={{ backgroundColor: rowBg }}
                                    >
                                        {/* Col 1: # */}
                                        <td
                                            style={{
                                                width: '42px',
                                                minWidth: '42px',
                                                maxWidth: '42px',
                                                left: '0px',
                                                backgroundColor: isEven ? '#EFF6FF' : '#F8FAFD',
                                                border: BORDER,
                                                color: '#64748B'
                                            }}
                                            className="sticky text-center font-semibold text-[9.5px] px-1 py-2 z-20 select-none"
                                        >
                                            {idx + 1}
                                        </td>

                                        {/* Col 2: Code */}
                                        <td
                                            style={{
                                                width: '100px',
                                                minWidth: '100px',
                                                maxWidth: '100px',
                                                left: '42px',
                                                backgroundColor: rowBg,
                                                border: BORDER,
                                                color: '#334155'
                                            }}
                                            className="sticky px-3 py-2 z-20 font-mono text-[10.5px] font-semibold"
                                        >
                                            {emp.code}
                                        </td>

                                        {/* Col 3: Employee Name */}
                                        <td
                                            style={{
                                                width: '180px',
                                                minWidth: '180px',
                                                maxWidth: '180px',
                                                left: '142px',
                                                backgroundColor: rowBg,
                                                border: BORDER,
                                                borderRight: STICKY_DIVIDER,
                                                boxShadow: '4px 0 8px rgba(0,0,0,0.10)',
                                                color: '#0F172A'
                                            }}
                                            className="sticky px-3 py-2 z-20"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                                                    {initials || 'U'}
                                                </div>
                                                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate" title={emp.name}>
                                                    {emp.name}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Col 4: Department */}
                                        <td
                                            style={{ border: BORDER, color: '#334155' }}
                                            className="px-3 py-2 text-[11px]"
                                        >
                                            {emp.department}
                                        </td>

                                        {/* Col 5: Designation */}
                                        <td
                                            style={{ border: BORDER, color: '#334155' }}
                                            className="px-3 py-2 text-[11px]"
                                        >
                                            {emp.designation}
                                        </td>

                                        {/* Col 6: Shift */}
                                        <td
                                            style={{ border: BORDER }}
                                            className="px-3 py-2 text-[10.5px]"
                                        >
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                                {emp.shift}
                                            </span>
                                        </td>

                                        {/* Col 7: Phone */}
                                        <td
                                            style={{ border: BORDER, color: '#475569' }}
                                            className="px-3 py-2 text-center text-[10.5px] font-mono"
                                        >
                                            {emp.phone}
                                        </td>

                                        {/* Col 8: Email */}
                                        <td
                                            style={{ border: BORDER, color: '#2563EB' }}
                                            className="px-3 py-2 text-[11px] truncate max-w-[200px]"
                                            title={emp.email}
                                        >
                                            {emp.email}
                                        </td>

                                        {/* Col 9: Joining Date */}
                                        <td
                                            style={{ border: BORDER, color: '#475569' }}
                                            className="px-2 py-2 text-center text-[10.5px] font-mono whitespace-nowrap"
                                        >
                                            {emp.joiningDate}
                                        </td>

                                        {/* Col 10: Role */}
                                        <td
                                            style={{ border: BORDER, color: '#475569' }}
                                            className="px-2 py-2 text-center text-[10px] uppercase font-semibold tracking-wider"
                                        >
                                            {emp.role}
                                        </td>

                                        {/* Col 11: Status */}
                                        <td
                                            style={{ border: BORDER }}
                                            className="px-2 py-2 text-center"
                                        >
                                            <span
                                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                                                    isActive
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : isDeleted
                                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        isActive
                                                            ? 'bg-emerald-500'
                                                            : isDeleted
                                                            ? 'bg-rose-500'
                                                            : 'bg-amber-500'
                                                    }`}
                                                />
                                                {emp.status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td
                                    colSpan={11}
                                    style={{ border: BORDER }}
                                    className="px-6 py-16 text-center text-slate-400 text-xs font-semibold"
                                >
                                    No employee records matched your filter criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EmployeeMasterPreviewTable;
