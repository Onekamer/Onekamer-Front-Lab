/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'onekamer-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  const title = payload.data?.title || payload.title || 'OneKamer';
  const body = payload.data?.body || payload.body || 'Nouvelle notification';
  const icon = payload.icon || payload.data?.icon || '/ok_logo.png';
  const badge = payload.badge || payload.data?.badge || 'https://onekamer-media-cdn.b-cdn.net/android-chrome-72x72.png';
  const image = payload.image || payload.data?.image || '';
  const sound = payload.sound || payload.data?.sound || '';
  const vibration = payload.vibrate || payload.data?.vibrate || [100, 50, 100];
  const url = payload.data?.url || payload.url || '/';
  const options = {
    body,
    icon,
    badge,
    image,
    sound,
    vibrate: vibration,
    requireInteraction: true,
    tag: payload.data?.tag || payload.tag || 'ok-general',
    renotify: true,
    data: { url },
    actions: [
      { action: 'open', title: 'Ouvrir', icon: '/icons/open.png' },
      { action: 'close', title: 'Fermer', icon: '/icons/close.png' },
    ],
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll().then((clients) => {
        if (clients.length) {
          clients[0].focus();
        } else {
          self.clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
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
    })
  );
});