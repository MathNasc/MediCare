// Self-cleaning Service Worker to purge legacy PWA caches that reference outdated /_next/static/css/* hashes
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        clients.forEach((client) => {
          if ('navigate' in client) {
            client.navigate(client.url);
          }
        });
      })
  );
});
