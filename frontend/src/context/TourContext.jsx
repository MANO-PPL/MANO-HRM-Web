import React, {
    createContext,
    useContext,
    useEffect,
    useReducer,
    useCallback,
    useRef,
} from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

// ─── Context ────────────────────────────────────────────────────────────────
const TourContext = createContext(null);

// ─── Initial State ───────────────────────────────────────────────────────────
const initialState = {
    isActive: false,
    currentPageKey: null,   // e.g. 'dashboard', 'attendance'
    currentStepIndex: 0,
    steps: [],
    targetElementRect: null,
    // Session-level: pages skipped this login (won't auto-restart, but not persisted)
    sessionSkipped: {},     // { pageKey: true }
};

// ─── Reducer ─────────────────────────────────────────────────────────────────
function tourReducer(state, action) {
    switch (action.type) {
        case 'START_TOUR':
            return {
                ...state,
                isActive: true,
                currentPageKey: action.payload.pageKey,
                steps: action.payload.steps,
                currentStepIndex: 0,
                targetElementRect: null,
            };
        case 'NEXT_STEP':
            if (state.currentStepIndex < state.steps.length - 1) {
                return { ...state, currentStepIndex: state.currentStepIndex + 1, targetElementRect: null };
            }
            return state;
        case 'PREV_STEP':
            if (state.currentStepIndex > 0) {
                return { ...state, currentStepIndex: state.currentStepIndex - 1, targetElementRect: null };
            }
            return state;
        case 'SKIP_TOUR':
            return {
                ...state,
                isActive: false,
                sessionSkipped: { ...state.sessionSkipped, [state.currentPageKey]: true },
            };
        case 'STOP_TOUR':
            return { ...state, isActive: false };
        case 'SET_TARGET_RECT':
            return { ...state, targetElementRect: action.payload };
        default:
            return state;
    }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export const TourProvider = ({ children }) => {
    const { user, setUser } = useAuth();
    const [state, dispatch] = useReducer(tourReducer, initialState);


    const lastScrolledStepIndexRef = useRef(-1);

    useEffect(() => {
        if (!state.isActive) {
            lastScrolledStepIndexRef.current = -1;
        }
    }, [state.isActive]);

    useEffect(() => {
        if (state.isActive) {
            document.body.classList.add('tour-active');
        } else {
            document.body.classList.remove('tour-active');
        }
        return () => {
            document.body.classList.remove('tour-active');
        };
    }, [state.isActive]);

    // ── Spotlight tracking ─────────────────────────────────────────────────
    useEffect(() => {
        if (!state.isActive || !state.steps.length) return;

        const currentStep = state.steps[state.currentStepIndex];

        // Execute side-effect if step defines one (e.g., switching tabs)
        if (typeof currentStep?.action === 'function') {
            currentStep.action();
        }

        if (!currentStep?.targetId) return;

        const updateRect = () => {
            const el = document.querySelector(`[data-tour-id="${currentStep.targetId}"]`);
            if (el) {
                const rect = el.getBoundingClientRect();
                // Only update if rect has meaningful dimensions
                if (rect.width > 0 && rect.height > 0) {
                    // Scroll into view exactly once when the element is first resolved for this step
                    if (lastScrolledStepIndexRef.current !== state.currentStepIndex) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                        lastScrolledStepIndexRef.current = state.currentStepIndex;
                    }
                    dispatch({ type: 'SET_TARGET_RECT', payload: rect });
                    return true;
                }
            }
            return false;
        };

        // Try immediately
        updateRect();

        // Periodically poll the target element's bounding rect during the first 1000ms.
        // This ensures we capture the final settled position of elements that animate (e.g., slide-in drawers,
        // modal transitions, layout shifts) which do not trigger ResizeObserver or scroll/resize events during their CSS/spring motion.
        const pollInterval = setInterval(updateRect, 50);
        const pollTimeout = setTimeout(() => {
            clearInterval(pollInterval);
        }, 1000);

        const observer = new ResizeObserver(updateRect);
        const el = document.querySelector(`[data-tour-id="${currentStep.targetId}"]`);
        if (el) observer.observe(el);
        window.addEventListener('resize', updateRect, { passive: true });
        window.addEventListener('scroll', updateRect, { capture: true, passive: true });

        return () => {
            clearInterval(pollInterval);
            clearTimeout(pollTimeout);
            observer.disconnect();
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, { capture: true });
        };
    }, [state.isActive, state.currentStepIndex, state.steps]);

    // ── Public API ────────────────────────────────────────────────────────
    /**
     * Start the tour for a page. Always works - ignores seen state.
     * @param {string} pageKey - e.g. 'dashboard', 'attendance'
     * @param {Array}  steps   - array of { targetId, title, description }
     */
    const startTour = useCallback((pageKey, steps) => {
        dispatch({ type: 'START_TOUR', payload: { pageKey, steps } });
    }, []);

    /**
     * Skip mid-tour. Only sets session-level dismissal - no DB write.
     * Does NOT mark pages_tour_seen. User will see auto-start again next login.
     */
    const skipTour = useCallback(() => {
        dispatch({ type: 'SKIP_TOUR' });
    }, []);

    /**
     * Called when the user clicks "Finish" on the last step.
     * Marks pages_tour_seen[pageKey] = true in the DB.
     */
    const completeTour = useCallback(async (pageKey) => {
        dispatch({ type: 'STOP_TOUR' });
        if (!pageKey) return;
        try {
            await api.patch('/profile/preferences', {
                pages_tour_seen: { [pageKey]: true }
            });
            // Optimistically update user in AuthContext so re-renders reflect new state
            if (setUser) {
                setUser(prev => ({
                    ...prev,
                    pages_tour_seen: {
                        ...(prev?.pages_tour_seen || {}),
                        [pageKey]: true,
                    }
                }));
            }
        } catch (e) {
            console.warn('[Tour] Failed to persist tour completion:', e.message);
        }
    }, [setUser]);

    /**
     * Navigate steps
     */
    const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), []);
    const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), []);

    /**
     * Whether the user has FULLY COMPLETED a page's tour (DB-persisted).
     * Depends on user.pages_tour_seen so page effects re-run whenever it changes.
     */
    const pagesSeen = user?.pages_tour_seen || {};
    const hasSeenPage = useCallback((pageKey) => {
        return !!(pagesSeen[pageKey]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagesSeen]);

    /**
     * Whether the tour is allowed to auto-start (global preference).
     * Reads tour_dismissed === false (false means "show tours").
     */
    const tourEnabled = !!user && !user.tour_dismissed;

    /**
     * Whether a page tour was skipped this session (not persisted).
     */
    const wasSkippedThisSession = useCallback((pageKey) => {
        return !!(state.sessionSkipped[pageKey]);
    }, [state.sessionSkipped]);

    // ── Global Site Tour Steps (Site Walkthrough) ────────────────────────
    const getGlobalTourSteps = useCallback((userType) => {
        const isEmployee = userType === 'employee';
        
        const sidebarDescription = isEmployee
            ? "This is your main navigation panel. It provides access to all your personal tools, including your dashboard, attendance history, daily activity reports, and holiday calendars."
            : "This is your main navigation panel. It provides access to advanced management features including the employee directory, live attendance monitoring, shift planning, geofencing controls, and comprehensive reports.";

        return [
            {
                targetId: 'sidebar-links',
                title: 'Navigation Sidebar',
                description: sidebarDescription,
                placement: 'right'
            },
            {
                targetId: 'header-right-tools',
                title: 'Header Toolbar',
                description: "The top toolbar gives you quick access to collaboration chat, theme settings, your real-time notifications, and your profile preferences."
            },
            {
                targetId: 'copilot-toggle-btn',
                title: 'Mano AI Copilot',
                description: "Meet Mano AI, your intelligent assistant. Click this button at any time to ask questions about attendance policies, raise correction requests, or get help navigating the platform."
            },
            {
                targetId: 'sidebar-bugs-feedback',
                title: 'Bugs & Feedback',
                description: "Have you encountered a bug or want to suggest an improvement? Use this button to instantly submit feedback or report issues directly to the support team.",
                placement: 'right'
            }
        ];
    }, []);

    const startGlobalTour = useCallback((force = false) => {
        const userType = user?.user_type || 'employee';
        const steps = getGlobalTourSteps(userType);

        if (!force) {
            // Auto-start check
            if (hasSeenPage('global_site_tour') || wasSkippedThisSession('global_site_tour')) {
                return;
            }
        }
        startTour('global_site_tour', steps);
    }, [user, getGlobalTourSteps, hasSeenPage, wasSkippedThisSession, startTour]);

    const currentStep = state.steps[state.currentStepIndex] || null;
    const isLastStep = state.currentStepIndex === state.steps.length - 1;

    return (
        <TourContext.Provider value={{
            // State
            isActive: state.isActive,
            currentStep,
            currentStepIndex: state.currentStepIndex,
            totalSteps: state.steps.length,
            targetElementRect: state.targetElementRect,
            currentPageKey: state.currentPageKey,
            isLastStep,
            tourEnabled,
            // Actions
            startTour,
            skipTour,
            completeTour,
            nextStep,
            prevStep,
            hasSeenPage,
            wasSkippedThisSession,
            startGlobalTour,
        }}>
            {children}
        </TourContext.Provider>
    );
};

export const useTour = () => {
    const ctx = useContext(TourContext);
    if (!ctx) throw new Error('useTour must be used inside <TourProvider>');
    return ctx;
};
