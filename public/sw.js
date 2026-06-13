// MediCare Service Worker v2.0
const CACHE_VERSION = 'medicare-v2';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('medicare-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch (Network first → cache fallback) ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests (Supabase, Firebase, fonts)
  if (url.origin !== self.location.origin) return;

  // Skip Next.js HMR
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // Static assets: cache first
  if (url.pathname.startsWith('/_next/static') || url.pathname.match(/\.(png|ico|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // HTML pages: network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(DYNAMIC_CACHE).then((c) => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();

  const options = {
    body:             data.body || 'Hora de tomar seu medicamento',
    icon:             '/icon-192.png',
    badge:            '/icon-96.png',
    image:            data.image,
    vibrate:          [200, 100, 200, 100, 200],
    sound:            data.sound,
    tag:              data.tag || 'medication',
    renotify:         true,
    requireInteraction: data.requireInteraction !== false,
    timestamp:        Date.now(),
    data: {
      url:      data.url || '/',
      doseId:   data.doseId,
      medId:    data.medId,
      medName:  data.medName,
      hora:     data.hora,
    },
    actions: [
      { action: 'confirm', title: '✓ Tomei agora' },
      { action: 'snooze',  title: '⏰ 15 minutos' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '💊 MediCare', options)
  );
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action } = event;
  const notifData  = event.notification.data || {};

  let url = '/';
  if (action === 'confirm') url = `/?action=confirm&doseId=${notifData.doseId || ''}&hora=${notifData.hora || ''}`;
  else if (action === 'snooze') url = `/?action=snooze&doseId=${notifData.doseId || ''}`;
  else url = notifData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin) && 'focus' in c);
      if (existing) return existing.focus().then((c) => c.navigate(url));
      return clients.openWindow(url);
    })
  );
});

// ─── Background Sync ─────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-doses') {
    event.waitUntil(syncDoses());
  }
});

async function syncDoses() {
  // Sync pending offline confirmations when back online
  const cache = await caches.open(DYNAMIC_CACHE);
  const keys  = await cache.keys();
  // Implementation: post pending items from IndexedDB to Supabase
}
