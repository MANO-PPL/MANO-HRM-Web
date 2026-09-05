/**
 * Centralized utility for querying and requesting browser permissions
 * (Camera and Geolocation) with detailed diagnostic states and user guidance.
 */

export const queryPermissionState = async (permissionName) => {
    if (!navigator?.permissions?.query) {
        return 'unsupported';
    }
    try {
        const result = await navigator.permissions.query({ name: permissionName });
        return result.state; // 'granted', 'denied', 'prompt'
    } catch (err) {
        // Some browsers (e.g. Firefox) do not support querying 'camera' via Permissions API
        return 'unsupported';
    }
};

/**
 * Checks current permission states without triggering user prompts.
 */
export const checkAttendancePermissions = async () => {
    const [cameraState, locationState] = await Promise.all([
        queryPermissionState('camera'),
        queryPermissionState('geolocation')
    ]);

    return {
        camera: cameraState,
        location: locationState,
        allGranted: cameraState === 'granted' && locationState === 'granted',
        anyDenied: cameraState === 'denied' || locationState === 'denied',
        needsPrompt: cameraState === 'prompt' || locationState === 'prompt'
    };
};

/**
 * Explicitly triggers browser camera permission prompt.
 * Immediately frees media stream tracks once permission is validated.
 */
export const requestCameraAccess = async (facingMode = 'user') => {
    if (!navigator?.mediaDevices?.getUserMedia) {
        return {
            success: false,
            errorType: 'unsupported',
            message: 'Camera capture is not supported by this browser.'
        };
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode }
        });

        // Free the camera tracks immediately so device indicator turns off
        stream.getTracks().forEach((track) => track.stop());

        return { success: true };
    } catch (err) {
        const name = err.name || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            return {
                success: false,
                errorType: 'denied',
                message: 'Camera permission was blocked. Please allow camera access in your browser settings.'
            };
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            return {
                success: false,
                errorType: 'no_device',
                message: 'No camera detected on this system.'
            };
        }
        if (name === 'NotReadableError' || name === 'TrackStartError') {
            return {
                success: false,
                errorType: 'busy',
                message: 'Camera is currently in use by another application.'
            };
        }
        return {
            success: false,
            errorType: 'unknown',
            message: err.message || 'Unable to access camera.'
        };
    }
};

/**
 * Explicitly triggers browser location permission prompt.
 */
export const requestLocationAccess = (options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }) => {
    return new Promise((resolve) => {
        if (!navigator?.geolocation) {
            resolve({
                success: false,
                errorType: 'unsupported',
                message: 'Geolocation is not supported by your browser.'
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    success: true,
                    coords: {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    }
                });
            },
            (error) => {
                let errorType = 'unknown';
                let message = error.message || 'Unable to retrieve location.';

                if (error.code === 1) { // PERMISSION_DENIED
                    errorType = 'denied';
                    message = 'Location access was blocked. Please allow location access in your browser settings.';
                } else if (error.code === 2) { // POSITION_UNAVAILABLE
                    errorType = 'unavailable';
                    message = 'GPS or location service is currently unavailable.';
                } else if (error.code === 3) { // TIMEOUT
                    errorType = 'timeout';
                    message = 'Location acquisition timed out.';
                }

                resolve({ success: false, errorType, message });
            },
            options
        );
    });
};

/**
 * Triggers both camera and location permission requests in one user action.
 */
export const requestAllAttendancePermissions = async () => {
    const cameraRes = await requestCameraAccess();
    const locationRes = await requestLocationAccess();

    return {
        camera: cameraRes,
        location: locationRes,
        success: cameraRes.success && locationRes.success
    };
};
