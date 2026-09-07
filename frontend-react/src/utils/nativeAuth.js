import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNativeApp = Capacitor.isNativePlatform();
export const GoogleAuth = registerPlugin('GoogleAuth');
