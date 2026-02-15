/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'onekamer-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // ✅ NE PAS intercepter les blob URLs (MediaRecorder, createObjectURL, etc.)
  // Cela évite que le SW bloque la lecture des fichiers audio/vidéo/images créés en mémoire
  if (event.request.url.startsWith('blob:')) {
    return; // Laisse passer directement sans interception
  }

  // ✅ Ignorer les appels API (laisser passer vers le réseau)
  try {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/')) {
      return;
    }
  } catch {}

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          return caches.match('/offline.html');
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { return; }
  const title = payload.title || payload.data?.title || 'OneKamer';
  const body = payload.body || payload.data?.message || '';
  const icon = payload.icon || payload.data?.icon || '/ok_logo.png';
  const url = payload.url || payload.data?.url || '/';
  const options = { body, icon, data: { url, userId: payload?.data?.userId } };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  const targetUserId = event.notification?.data?.userId || null;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const postSwitch = (client) => { try { client.postMessage({ type: 'ok_switch_to', userId: targetUserId, url }); } catch {} };
      for (const client of clientList) {
        if ('focus' in client) client.focus();
        if (targetUserId) postSwitch(client);
        if ('navigate' in client) client.navigate(url);
        return true;
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return false;
    })
  );
});

self.addEventListener('pushsubscriptionchange', () => {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      try { client.postMessage({ type: 'ok_push_subscription_changed' }); } catch {}
    }
  });
});
