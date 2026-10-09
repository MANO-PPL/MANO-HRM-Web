import React from 'react';

// Custom right-aligned 3 horizontal bars icon matching the user's provided toggle icon
export const SummaryToggleIcon = ({ size = 15, className = '' }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <line x1="22" y1="5" x2="7" y2="5" />
        <line x1="22" y1="12" x2="2" y2="12" />
        <line x1="22" y1="19" x2="11" y2="19" />
    </svg>
);

export default SummaryToggleIcon;
