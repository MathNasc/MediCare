// MediCare Service Worker v6 — notificações via Web Push (VAPID)

const CACHE_VERSION = 'medicare-v9'; // Atualizado para v9
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('medicare-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Web Push ────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: '💊 MediCare', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || '💊 MediCare', {
      body: data.body || 'Hora de tomar seu medicamento',
      icon: '/icon-192.png', badge: '/icon-96.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: data.tag || `med-${Date.now()}`,
      renotify: true, requireInteraction: true,
      data: { url: data.url || '/', doseId: data.doseId, medId: data.medId, hora: data.hora, title: data.title, body: data.body, tag: data.tag },
      actions: [
        { action: 'confirm', title: '✓ Tomei agora' },
        { action: 'snooze',  title: '⏰ 15 minutos' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { action } = event;
  const d = event.notification.data || {};
  let url = d.url || '/';
  if (action === 'confirm') url = `/?action=confirm&doseId=${d.doseId || ''}&hora=${d.hora || ''}`;
  if (action === 'snooze')  url = `/?action=snooze&doseId=${d.doseId || ''}&hora=${d.hora || ''}`;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});

// ─── Fetch strategy (Network-First) ──────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;
  
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res && res.ok) {
          const resToCache = res.clone();
          const cacheName = url.pathname.startsWith('/_next/static') || url.pathname.match(/\.(png|ico|svg|woff2?)$/)
             ? STATIC_CACHE
             : DYNAMIC_CACHE;
          caches.open(cacheName).then(c => c.put(request, resToCache));
        }
        return res;
      })
      .catch(() => {
        return caches.match(request).then(cached => {
          if (cached) return cached;
          if (request.mode === 'navigate' || request.destination === 'document') {
            return new Response('<h1>Você está offline</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
          }
          return new Response('', { status: 404 });
        });
      })
  );
});
