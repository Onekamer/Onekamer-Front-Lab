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

self.addEventListener('fetch', (event) => {
  // ✅ NE PAS intercepter les blob URLs (MediaRecorder, createObjectURL, etc.)
  // Cela évite que le SW bloque la lecture des fichiers audio/vidéo/images créés en mémoire
  if (event.request.url.startsWith('blob:')) {
    return; // Laisse passer directement sans interception
  }

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
    })
  );
});