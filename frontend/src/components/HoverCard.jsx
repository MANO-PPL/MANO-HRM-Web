import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';

/**
 * Reusable HoverCard Component
 * 
 * @param {React.ReactNode} children - The trigger element to hover over
 * @param {React.ReactNode} content - Content shown inside the hover card
 * @param {'top' | 'bottom' | 'auto'} side - Preferred position relative to trigger (default: 'auto')
 * @param {'center' | 'start' | 'end'} align - Alignment along trigger (default: 'center')
 * @param {number} openDelay - Delay in ms before opening (default: 150)
 * @param {number} closeDelay - Delay in ms before closing, allows hovering into card (default: 200)
 * @param {boolean} interactive - Whether the user can hover into the card itself (default: true)
 * @param {boolean} showArrow - Whether to display a centered anchor arrow pointing at the trigger (default: true)
 * @param {string} className - Optional custom classes for the card container
 * @param {string} containerClassName - Optional custom classes for the trigger wrapper
 * @param {boolean} disabled - Disable hover card from showing
 */
const HoverCard = ({
    children,
    content,
    side = 'auto',
    align = 'center',
    openDelay = 150,
    closeDelay = 200,
    interactive = true,
    showArrow = true,
    className = '',
    containerClassName = 'inline-block',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({
        top: 0,
        left: 0,
        arrowLeft: 120,
        effectiveSide: 'bottom',
    });

    const triggerRef = useRef(null);
    const cardRef = useRef(null);
    const openTimerRef = useRef(null);
    const closeTimerRef = useRef(null);

    // Calculate exact pixel position taking viewport bounds into account so it NEVER exceeds the window
    const calculatePosition = useCallback((cardElement = cardRef.current) => {
        if (!triggerRef.current) return null;
        const triggerRect = triggerRef.current.getBoundingClientRect();
        
        // Accurate card dimensions
        const cardWidth = cardElement?.offsetWidth || 240;
        const cardHeight = cardElement?.offsetHeight || 120;
        
        const margin = 8;
        const screenMargin = 12;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

        // Exact horizontal anchor center of the trigger
        const anchorX = triggerRect.left + triggerRect.width / 2;

        // Vertical collision detection & auto-flipping
        const spaceBelow = vh - triggerRect.bottom - margin - screenMargin;
        const spaceAbove = triggerRect.top - margin - screenMargin;

        let resolvedSide = side;
        if (side === 'auto') {
            resolvedSide = spaceBelow >= cardHeight || spaceBelow >= spaceAbove ? 'bottom' : 'top';
        } else if (side === 'bottom' && spaceBelow < cardHeight && spaceAbove > spaceBelow) {
            resolvedSide = 'top';
        } else if (side === 'top' && spaceAbove < cardHeight && spaceBelow > spaceAbove) {
            resolvedSide = 'bottom';
        }

        let rawTop = 0;
        if (resolvedSide === 'top') {
            rawTop = triggerRect.top - margin - cardHeight;
        } else {
            rawTop = triggerRect.bottom + margin;
        }

        // Clamp top coordinate so the card NEVER exceeds the top or bottom of the screen
        const minTop = screenMargin;
        const maxTop = Math.max(minTop, vh - cardHeight - screenMargin);
        const clampedTop = Math.max(minTop, Math.min(rawTop, maxTop));

        // Horizontal positioning:
        // Position card directly centered under/over the trigger's center (anchorX)
        let desiredLeft = anchorX - cardWidth / 2;
        if (align === 'start') {
            desiredLeft = triggerRect.left;
        } else if (align === 'end') {
            desiredLeft = triggerRect.right - cardWidth;
        }

        // Strict horizontal clamp so the card NEVER exceeds the window left or right edges:
        // Left edge >= screenMargin, Right edge <= vw - screenMargin
        const minLeft = screenMargin;
        const maxLeft = Math.max(minLeft, vw - cardWidth - screenMargin);
        const clampedLeft = Math.max(minLeft, Math.min(desiredLeft, maxLeft));

        // Calculate exact arrow offset pointing directly at the trigger's anchorX
        // Relative to the card's left boundary (which is clampedLeft)
        const rawArrowOffset = anchorX - clampedLeft;
        // Clamp arrow between 16px and cardWidth - 16px to stay within the card's rounded borders
        const arrowLeft = Math.max(16, Math.min(rawArrowOffset, cardWidth - 16));

        return {
            top: Math.round(clampedTop),
            left: Math.round(clampedLeft),
            arrowLeft: Math.round(arrowLeft),
            effectiveSide: resolvedSide,
        };
    }, [side, align]);

    // Ref callback to measure actual card DOM size synchronously upon mounting
    const cardCallbackRef = useCallback((node) => {
        cardRef.current = node;
        if (node && triggerRef.current) {
            const next = calculatePosition(node);
            if (next) {
                setCoords(prev => {
                    if (
                        Math.abs(prev.top - next.top) < 1 &&
                        Math.abs(prev.left - next.left) < 1 &&
                        Math.abs(prev.arrowLeft - next.arrowLeft) < 1 &&
                        prev.effectiveSide === next.effectiveSide
                    ) {
                        return prev;
                    }
                    return next;
                });
            }
        }
    }, [calculatePosition]);

    const handleMouseEnter = () => {
        if (disabled) return;
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        openTimerRef.current = setTimeout(() => {
            const initialCoords = calculatePosition();
            if (initialCoords) {
                setCoords(initialCoords);
            }
            setIsOpen(true);
        }, openDelay);
    };

    const handleMouseLeave = () => {
        if (openTimerRef.current) {
            clearTimeout(openTimerRef.current);
            openTimerRef.current = null;
        }

        closeTimerRef.current = setTimeout(() => {
            setIsOpen(false);
        }, closeDelay);
    };

    const handleCardMouseEnter = () => {
        if (!interactive) return;
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };

    const handleCardMouseLeave = () => {
        if (!interactive) return;
        closeTimerRef.current = setTimeout(() => {
            setIsOpen(false);
        }, closeDelay);
    };

    // Close on window scroll or resize to prevent detached floating tooltips
    useEffect(() => {
        if (!isOpen) return;

        const handleScrollOrResize = () => {
            setIsOpen(false);
        };

        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (openTimerRef.current) clearTimeout(openTimerRef.current);
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, []);

    const isTop = coords.effectiveSide === 'top';

    return (
        <div
            ref={triggerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={containerClassName}
        >
            {children}

            {typeof document !== 'undefined' &&
                createPortal(
                    <AnimatePresence>
                        {isOpen && content && (
                            <Motion.div
                                ref={cardCallbackRef}
                                initial={{
                                    opacity: 0,
                                    scale: 0.95,
                                    y: isTop ? 4 : -4,
                                }}
                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    y: 0,
                                }}
                                exit={{
                                    opacity: 0,
                                    scale: 0.95,
                                    transition: { duration: 0.1 },
                                }}
                                transition={{
                                    type: 'spring',
                                    damping: 26,
                                    stiffness: 340,
                                    mass: 0.4,
                                }}
                                onMouseEnter={handleCardMouseEnter}
                                onMouseLeave={handleCardMouseLeave}
                                data-hover-card-portal="true"
                                style={{
                                    position: 'fixed',
                                    top: coords.top,
                                    left: coords.left,
                                    transformOrigin: `${coords.arrowLeft}px ${isTop ? 'bottom' : 'top'}`,
                                    zIndex: 99999,
                                }}
                                className={`${interactive ? 'pointer-events-auto' : 'pointer-events-none'} ${
                                    className ||
                                    'w-72 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-md text-slate-800 dark:text-[#f0f6fc] border border-slate-200 dark:border-[#30363d] rounded-2xl p-4 shadow-2xl text-xs'
                                }`}
                            >
                                {/* Centered Anchor Arrow pointing to trigger */}
                                {showArrow && (
                                    <div
                                        style={{ left: coords.arrowLeft }}
                                        className={`absolute w-2.5 h-2.5 rotate-45 pointer-events-none -translate-x-1/2 ${
                                            isTop
                                                ? '-bottom-1.5 bg-slate-900 dark:bg-[#161b22] border-r border-b border-slate-800 dark:border-[#30363d]'
                                                : '-top-1.5 bg-slate-900 dark:bg-[#161b22] border-l border-t border-slate-800 dark:border-[#30363d]'
                                        }`}
                                    />
                                )}

                                {content}
                            </Motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
        </div>
    );
};

export default HoverCard;
