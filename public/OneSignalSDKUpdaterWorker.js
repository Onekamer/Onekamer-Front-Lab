/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// ✅ Correctif spécial Hostinger / Horizon
importScripts('https://cdn.onesignal.com/sdks/OneSignalSDK.js');

self.addEventListener('install', () => {
  console.log('✅ OneSignal Updater Worker enregistré sur Hostinger (fix temporaire)');
});

self.addEventListener('activate', () => {
  console.log('✅ OneSignal Updater Worker actif sur Hostinger');
});
