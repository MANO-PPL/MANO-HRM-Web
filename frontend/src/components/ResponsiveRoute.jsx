import React, { useState, useEffect } from 'react';

/**
 * Smart Mobile & Responsive Detection:
 * - Detects mobile device user agents (Android, iPhone, iPod, Mobile, etc.)
 * - Detects mobile/tablet viewport width (< 768px - matching Flutter app mobile threshold)
 * - Detects touch devices with screen width < 768px
 * - Preserves desktop layout on desktop laptops/monitors during browser zoom
 */
export const checkIsMobile = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    if (isMobileUA) return true;

    const isTablet = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isTablet && window.innerWidth < 768) return true;

    // Viewport width < 768px (dev tools mobile emulation, resized window, or phone screen)
    return window.innerWidth < 768;
};

const ResponsiveRoute = ({ DesktopComponent, MobileComponent }) => {
    const [isMobile, setIsMobile] = useState(checkIsMobile);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(checkIsMobile());
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    if (isMobile && MobileComponent) {
        return <MobileComponent />;
    }

    const Component = DesktopComponent || MobileComponent;
    return Component ? <Component /> : null;
};

export default ResponsiveRoute;

