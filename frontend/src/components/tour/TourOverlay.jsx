import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTour } from '../../context/TourContext';
import TourTooltip from './TourTooltip.jsx';

const TourOverlay = () => {
    const { isActive, currentStep, currentStepIndex, totalSteps, targetElementRect } = useTour();

    // Track when the step index changes to apply smooth transition only on step changes.
    // If the step index has not changed, coordinate updates are due to scrolling/resizing,
    // so we disable the transition delay to lock the border instantaneously.
    const lastStepIndexRef = useRef(currentStepIndex);
    const stepChanged = lastStepIndexRef.current !== currentStepIndex;

    useEffect(() => {
        lastStepIndexRef.current = currentStepIndex;
    }, [currentStepIndex]);

    const rect = targetElementRect;

    // Default to center screen if no target rect yet (element still rendering)
    let cutout = {
        x: window.innerWidth / 2 - 60,
        y: window.innerHeight / 2 - 30,
        w: 120,
        h: 60,
    };

    if (rect && rect.width > 0 && rect.height > 0) {
        let x = rect.left - 8;
        let y = rect.top - 8;
        let w = rect.width + 16;
        let h = rect.height + 16;

        // Detect if the target element is inside a fixed header to bypass vertical clipping
        const el = currentStep?.targetId 
            ? document.querySelector(`[data-tour-id="${currentStep.targetId}"]`)
            : null;
        const isInHeader = el ? !!el.closest('header') : false;

        if (!isInHeader) {
            // Clip the spotlight cutout vertically to the visible scrollable content viewport
            // (below the 64px tall fixed header and above the bottom of the window).
            const minY = 50;
            const maxY = window.innerHeight;

            if (y < minY) {
                const clipTop = minY - y;
                y = minY;
                h = Math.max(0, h - clipTop);
            }
            if (y + h > maxY) {
                const clipBottom = (y + h) - maxY;
                h = Math.max(0, h - clipBottom);
            }
        }

        cutout = { x, y, w, h };
    }

    // Intercept clicks outside the spotlight cutout and the tooltip to prevent accidental page interactions,
    // while leaving wheel, scroll, hover, and swipe events completely unblocked.
    useEffect(() => {
        if (!isActive) return;

        const handleCapture = (e) => {
            // 1. Allow clicking inside the tooltip
            const tooltipEl = document.querySelector('[data-tour-id="tour-tooltip"]');
            if (tooltipEl && tooltipEl.contains(e.target)) {
                return;
            }

            // 2. Allow clicking the global layout structures (sidebar, top header)
            // or any page-level navigation tabs to ensure users can navigate freely
            // or switch view modes during the tour.
            if (
                e.target.closest('aside') || // Sidebar navigation
                e.target.closest('header') || // Top navbar/header
                e.target.closest('[data-tour-id*="tab"]') || // Page-level navigation tabs
                e.target.closest('.tour-allow-click') // Generic escape hatch
            ) {
                return;
            }

            // 3. Allow clicking inside the spotlight cutout
            const { clientX, clientY } = e;
            const isInsideCutout =
                clientX >= cutout.x &&
                clientX <= cutout.x + cutout.w &&
                clientY >= cutout.y &&
                clientY <= cutout.y + cutout.h;

            if (isInsideCutout) {
                return;
            }

            // 4. Block all other click-like interactions
            e.preventDefault();
            e.stopPropagation();
        };

        window.addEventListener('click', handleCapture, true);
        window.addEventListener('mousedown', handleCapture, true);
        window.addEventListener('mouseup', handleCapture, true);

        return () => {
            window.removeEventListener('click', handleCapture, true);
            window.removeEventListener('mousedown', handleCapture, true);
            window.removeEventListener('mouseup', handleCapture, true);
        };
    }, [isActive, cutout.x, cutout.y, cutout.w, cutout.h]);

    if (!isActive || totalSteps === 0 || !currentStep) return null;

    // If the step expects a target element, but it is not found or not visible,
    // we hide the entire tour overlay to prevent displaying a misplaced spotlight/tooltip
    // or locking the screen with a dark overlay.
    if (currentStep.targetId && (!rect || rect.width === 0 || rect.height === 0)) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            <AnimatePresence>
                <motion.div
                    key="tour-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                >
                    {/* Spotlight Cutout - boxShadow creates the dim overlay outside this div */}
                    <motion.div
                        className="absolute rounded-lg border-2 border-indigo-500/60 pointer-events-none z-10"
                        animate={{
                            left: cutout.x,
                            top: cutout.y,
                            width: cutout.w,
                            height: cutout.h,
                        }}
                        transition={
                            stepChanged
                                ? { type: 'spring', bounce: 0, duration: 0.4 }
                                : { type: 'tween', ease: 'linear', duration: 0 }
                        }
                        style={{
                            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.78)',
                        }}
                    />

                    <TourTooltip cutout={cutout} />
                </motion.div>
            </AnimatePresence>
        </div>,
        document.body
    );
};

export default TourOverlay;
