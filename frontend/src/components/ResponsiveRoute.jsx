import React from 'react';

/**
 * ResponsiveRoute enforces Desktop Mode across all platform pages.
 * Prevents browser zoom in / out (100%, 125%, 150%, 200%) from switching
 * to mobile layouts or causing page re-renders.
 */
const ResponsiveRoute = ({ DesktopComponent, MobileComponent }) => {
    const Component = DesktopComponent || MobileComponent;
    return Component ? <Component /> : null;
};

export default ResponsiveRoute;

