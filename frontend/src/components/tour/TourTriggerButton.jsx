/**
 * TourTriggerButton
 * A small "?" help icon that starts the per-page tour on click.
 * Drop it near any page title - it is self-contained.
 *
 * Usage:
 *   import TourTriggerButton from '../components/tour/TourTriggerButton';
 *   <TourTriggerButton pageKey="dashboard" steps={DASHBOARD_STEPS} />
 */
import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useTour } from '../../context/TourContext';

const TourTriggerButton = ({ pageKey, steps, className = '' }) => {
    const { startTour, tourEnabled } = useTour();

    if (!tourEnabled) return null;

    return (
        <button
            onClick={() => startTour(pageKey, steps, true)}
            title="Start page tour"
            className={`p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/25 transition-colors ${className}`}
            aria-label="Start tour for this page"
        >
            <HelpCircle size={17} strokeWidth={2} />
        </button>
    );
};

export default TourTriggerButton;
