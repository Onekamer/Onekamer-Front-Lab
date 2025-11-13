/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// OneKamer Web Push Service Worker (LAB)
// Affiche les notifications push reçues depuis le serveur OneKamer

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'OneKamer';
    const body = data.body || data.message || 'Nouvelle notification';
    const icon = data.icon || 'https://onekamer-media-cdn.b-cdn.net/logo/IMG_0885%202.PNG';
    const badge = data.badge || icon; // badge optionnel (monochrome recommandé)
    const url = data.url || (data.data && data.data.url) || '/';

    const options = {
      body,
      icon,
      badge,
      data: { url, ...data.data },
      vibrate: data.vibrate || [100, 50, 100],
      actions: data.actions || [],
      requireInteraction: Boolean(data.requireInteraction),
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // fallback minimaliste
    event.waitUntil(self.registration.showNotification('OneKamer', {
      body: 'Nouvelle notification',
      icon: 'https://onekamer-media-cdn.b-cdn.net/logo/IMG_0885%202.PNG',
    }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          // si l’onglet est déjà ouvert, le focus et le redirige
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
