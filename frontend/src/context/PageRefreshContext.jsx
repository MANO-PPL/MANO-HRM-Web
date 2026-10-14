import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { invalidateAllCaches } from '../utils/cacheManager';

const PageRefreshContext = createContext(null);

export const PageRefreshProvider = ({ children, pageTitle = "Page", onRefresh: propOnRefresh }) => {
    const [pageKey, setPageKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const customHandlerRef = useRef(propOnRefresh || null);

    // Keep ref updated if prop changes
    useEffect(() => {
        customHandlerRef.current = propOnRefresh || null;
    }, [propOnRefresh]);

    const registerRefreshHandler = useCallback((fn) => {
        customHandlerRef.current = fn;
        return () => {
            if (customHandlerRef.current === fn) {
                customHandlerRef.current = null;
            }
        };
    }, []);

    const triggerRefresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);

        const startTime = Date.now();
        const displayName = typeof pageTitle === 'string' ? pageTitle : 'Page';

        try {
            // 1. Invalidate all client-side and memory caches
            invalidateAllCaches(displayName);

            // 2. If a custom data fetching handler was provided, call it
            if (typeof customHandlerRef.current === 'function') {
                await Promise.resolve(customHandlerRef.current());
            } else {
                // Otherwise increment pageKey to cleanly re-render the page component
                setPageKey(prev => prev + 1);
            }

            // Guarantee a minimum duration of 500ms so the user sees the spin animation
            const elapsed = Date.now() - startTime;
            if (elapsed < 500) {
                await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
            }

            toast.info(`${displayName} refreshed with latest data`, {
                toastId: `refresh-toast-${displayName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                autoClose: 1800,
                hideProgressBar: true,
                closeButton: true
            });
        } catch (error) {
            console.error(`[PageRefresh] Error refreshing ${displayName}:`, error);
            // Fallback: force remount of page component to recover state
            setPageKey(prev => prev + 1);
            toast.warn(`${displayName} reloaded`, { autoClose: 1800, hideProgressBar: true });
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, pageTitle]);

    return (
        <PageRefreshContext.Provider
            value={{
                pageKey,
                isRefreshing,
                triggerRefresh,
                registerRefreshHandler,
                pageTitle
            }}
        >
            {children}
        </PageRefreshContext.Provider>
    );
};

export const usePageRefresh = (onRefreshHandler) => {
    const ctx = useContext(PageRefreshContext);

    useEffect(() => {
        if (ctx && typeof onRefreshHandler === 'function') {
            return ctx.registerRefreshHandler(onRefreshHandler);
        }
    }, [ctx, onRefreshHandler]);

    return ctx || {
        pageKey: 0,
        isRefreshing: false,
        triggerRefresh: () => {},
        registerRefreshHandler: () => () => {},
        pageTitle: ''
    };
};

export default PageRefreshContext;
