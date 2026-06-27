// frontend/src/services/fcm.js
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { notificationService } from './notificationService';

// Replace these placeholders with your actual Web App credentials from the Firebase Console
// or set the corresponding environment variables in frontend/src/.env or system variables.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_FIREBASE_AUTH_DOMAIN",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_FIREBASE_PROJECT_ID",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_FIREBASE_MESSAGING_SENDER_ID",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_FIREBASE_APP_ID"
};

// Web Push Certificate VAPID Key from Firebase Console > Project Settings > Cloud Messaging > Web configuration
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "YOUR_VAPID_KEY";

let messaging = null;

try {
    // Check if configuration is set
    const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY";
    if (isConfigured) {
        const app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);
        console.log('✅ Firebase Web Messaging initialized successfully.');
    }
} catch (error) {
    console.error('❌ Failed to initialize Firebase Messaging:', error);
}

/**
 * Requests notification permissions from the user, retrieves the FCM registration token,
 * and updates the token registry in the database via the backend API.
 */
export const requestAndRegisterFCMToken = async () => {
    if (!messaging) {
        console.warn('⚠️ FCM Web SDK not active: To enable browser push notifications, configure your VITE_FIREBASE_* environment variables.');
        return null;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('🔄 Registering Firebase messaging service worker with config URL...');
            
            const configParams = new URLSearchParams({
                apiKey: firebaseConfig.apiKey || '',
                authDomain: firebaseConfig.authDomain || '',
                projectId: firebaseConfig.projectId || '',
                storageBucket: firebaseConfig.storageBucket || '',
                messagingSenderId: firebaseConfig.messagingSenderId || '',
                appId: firebaseConfig.appId || ''
            }).toString();

            const swUrl = `/firebase-messaging-sw.js?${configParams}`;

            let registration = null;
            try {
                registration = await navigator.serviceWorker.register(swUrl, {
                    scope: '/'
                });
                console.log('✅ Service Worker registered with scope:', registration.scope);
            } catch (swErr) {
                if (swErr.name === 'SecurityError' || swErr.message?.includes('SSL certificate error')) {
                    console.warn('⚠️ FCM ServiceWorker registration skipped: SSL certificate error on localhost HTTPS. (Service Workers require trusted SSL certs or http://localhost during development).');
                    return null;
                }
                throw swErr;
            }

            console.log('🔑 Fetching FCM token using VAPID Key:', VAPID_KEY);
            const token = await getToken(messaging, { 
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('🔑 FCM Web Registration Token successfully retrieved:', token);
                await notificationService.registerFCMToken(token, 'web');
                return token;
            } else {
                console.warn('⚠️ No FCM registration token returned.');
            }
        } else {
            console.warn('⚠️ Notification permission denied by the user.');
        }
    } catch (error) {
        if (error.name === 'SecurityError' || error.message?.includes('SSL certificate error')) {
            console.warn('⚠️ SSL certificate issue blocked Service Worker registration on dev server.');
        } else {
            console.error('❌ Error getting or registering FCM token:', error);
            if (error.message && error.message.includes('vapid')) {
                console.error('💡 TIP: The VAPID key you provided may be invalid or truncated. Firebase Web Push VAPID keys are usually long base64 strings starting with a "B". Please verify the key under Settings > Cloud Messaging > Web Push certificates in the Firebase Console.');
            }
        }
    }
    return null;
};

/**
 * Listener callback for foreground web push notifications.
 */
export const onForegroundMessage = (callback) => {
    if (!messaging) return () => {};
    return onMessage(messaging, (payload) => {
        console.log('📬 Foreground Push Notification received:', payload);
        if (callback) {
            callback(payload);
        }
    });
};

/**
 * Requests all platform permissions (Notifications, Geolocation, Camera) in one flow.
 */
export const requestAllPlatformPermissions = async () => {
    console.log('🔄 Requesting platform permissions...');

    // 1. Request Notification Permission
    try {
        if ('Notification' in window) {
            const notificationPermission = await Notification.requestPermission();
            console.log(`Notification permission state: ${notificationPermission}`);
            if (notificationPermission === 'granted') {
                await requestAndRegisterFCMToken();
            }
        }
    } catch (err) {
        console.error('Error requesting notification permission:', err);
    }

    // 2. Request Geolocation Permission
    try {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => console.log('✅ Geolocation access granted'),
                (err) => console.warn('⚠️ Geolocation access denied:', err.message),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    } catch (err) {
        console.error('Error requesting geolocation permission:', err);
    }

    // 3. Camera Permission (Selfie Verification) is requested on-demand 
    // when the user goes to Time In or Time Out, to avoid camera flicking on reload.
};
