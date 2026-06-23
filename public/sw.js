// MediCare Service Worker v3 — fix: stale HTML causing ChunkLoadError
// v2 → v3: bump força a invalidação de todos os caches antigos
const CACHE_VERSION = 'medicare-v3';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Apenas assets verdadeiramente estáticos (ícones/manifest).
// O documento HTML ('/') NUNCA é pré-cacheado: ele precisa sempre
// vir da rede para referenciar os chunks JS corretos da build atual.
const STATIC_ASSETS = [
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

// ─── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests (Supabase, Firebase, fonts)
  if (url.origin !== self.location.origin) return;

  // Skip Next.js HMR
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // ── Documentos HTML (navegação) ────────────────────────────────────────────
  // NUNCA servir do cache. Sempre rede. Isso garante que o HTML carregado
  // sempre referencia os chunks JS da build atualmente publicada,
  // evitando ChunkLoadError (404 em chunks de builds anteriores).
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/manifest.json').then(() =>
          new Response(
            '<h1>Você está offline</h1><p>Verifique sua conexão e tente novamente.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        )
      )
    );
    return;
  }

  // ── Chunks JS/CSS imutáveis do Next (_next/static) ─────────────────────────
  // Cache-first, mas NUNCA armazenar respostas de erro (404/5xx) —
  // isso evita "envenenar" o cache com um chunk que não existe mais
  // e impede o navegador de tentar buscar novamente na rede.
  if (url.pathname.startsWith('/_next/static') || url.pathname.match(/\.(png|ico|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // ── Demais requisições: rede primeiro, cache como fallback offline ─────────
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
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
