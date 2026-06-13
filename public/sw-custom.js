// MediCare Custom Service Worker
const CACHE_NAME = 'medicare-v1';
const STATIC_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'Hora de tomar seu medicamento',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'medication-reminder',
    requireInteraction: true,
    actions: [
      { action: 'confirm', title: '✓ Tomei', icon: '/icons/icon-96.png' },
      { action: 'snooze',  title: '⏰ 15 min', icon: '/icons/icon-96.png' },
    ],
    data: { url: data.url || '/', medicationId: data.medicationId },
  };
  event.waitUntil(self.registration.showNotification(data.title || 'MediCare', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'confirm') {
    event.waitUntil(
      clients.openWindow(`/?action=confirm&id=${event.notification.data.medicationId}`)
    );
  } else if (event.action === 'snooze') {
    event.waitUntil(clients.openWindow('/?action=snooze'));
  } else {
    event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
  }
});
