/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// ✅ Correctif spécial Hostinger / Horizon
// Ce script charge directement le SDK OneSignal
// et empêche les conflits avec ton sw.js principal
importScripts('https://cdn.onesignal.com/sdks/OneSignalSDK.js');

self.addEventListener('install', () => {
  console.log('✅ OneSignal Worker enregistré sur Hostinger (fix temporaire)');
});

self.addEventListener('activate', () => {
  console.log('✅ OneSignal Worker actif sur Hostinger');
});
