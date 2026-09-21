import { Capacitor } from '@capacitor/core';

export const getWebAppOrigin = () => {
    let origin = window.location.origin;
    
    // In Capacitor or localhost environments, attempt to get the production/live URL
    if (Capacitor.isNativePlatform() || origin.includes('localhost') || origin.includes('capacitor://')) {
        // Use explicitly set web URL if available
        if (import.meta.env.VITE_PUBLIC_WEB_URL) {
            return import.meta.env.VITE_PUBLIC_WEB_URL;
        } 
        
        // Try to derive the web URL from the API URL
        if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')) {
            try {
                const url = new URL(import.meta.env.VITE_API_URL);
                return `${url.protocol}//${url.hostname}`;
            } catch(e) {
                // Ignore parse errors
            }
        } else if (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.startsWith('http')) {
             try {
                const url = new URL(import.meta.env.VITE_API_BASE_URL);
                return `${url.protocol}//${url.hostname}`;
            } catch(e) {
                // Ignore parse errors
            }
        }
        
        // Fallback hardcoded production IP/domain if all else fails
        return 'http://16.171.242.175'; 
    }
    
    return origin;
};
