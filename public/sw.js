// MediCare Service Worker v6 — notificações via Web Push (VAPID)
//
// Removido nesta versão: o loop `setInterval` que tentava disparar
// lembretes localmente (startNotificationLoop/tick/fireScheduled).
// Isso NUNCA foi confiável — o navegador encerra Service Workers ociosos
// (geralmente em ~30s), então o setInterval parava de rodar assim que o
// app saía de primeiro plano, e cachedSchedule (em memória) se perdia
// toda vez que o SW reiniciava. Quem dispara os lembretes agora é a
// Edge Function `send-medication-reminders` via pg_cron, chegando aqui
// como um evento `push` real — isso funciona mesmo com o app fechado,
// porque o navegador acorda o SW especificamente para entregar o push.

const CACHE_VERSION = 'medicare-v6';
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

// ─── Web Push — entregue pelo navegador quando a Edge Function envia ────────
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

// ─── Fetch strategy (inalterado da v5) ───────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('<h1>Você está offline</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      )
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static') || url.pathname.match(/\.(png|ico|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res && res.ok) caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(res => { if (res && res.ok) caches.open(DYNAMIC_CACHE).then(c => c.put(request, res.clone())); return res; })
      .catch(() => caches.match(request))
  );
});
