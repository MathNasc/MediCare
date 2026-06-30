// MediCare Service Worker v4 — notificações em background garantidas
const CACHE_VERSION  = 'medicare-v4';
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE  = `${CACHE_VERSION}-dynamic`;
const CHECK_INTERVAL = 60 * 1000;

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
      .then(() => startNotificationLoop())
  );
});

let loopTimer = null;
let cachedSchedule = [];
let firedIds = new Set();

function startNotificationLoop() {
  if (loopTimer) clearInterval(loopTimer);
  loopTimer = setInterval(tick, CHECK_INTERVAL);
  tick();
}

async function tick() {
  const clientList = await self.clients.matchAll({ includeUncontrolled: true });
  if (clientList.length > 0) {
    clientList[0].postMessage({ type: 'GET_SCHEDULE' });
  } else {
    await fireScheduled(cachedSchedule);
  }
}

async function fireScheduled(schedule) {
  if (!Array.isArray(schedule) || !schedule.length) return;
  const now = Date.now();
  const WINDOW = 90 * 1000;

  for (const item of schedule) {
    if (item.fireAt <= now + 5000 && item.fireAt > now - WINDOW && !firedIds.has(item.id)) {
      firedIds.add(item.id);
      try {
        await self.registration.showNotification(item.title, {
          body: item.body,
          icon: '/icon-192.png',
          badge: '/icon-96.png',
          vibrate: [200, 100, 200, 100, 200],
          tag: item.tag,
          renotify: true,
          requireInteraction: true,
          data: {
            doseId: item.doseId, medId: item.medId, hora: item.hora,
            title: item.title, body: item.body, tag: item.tag,
            url: `/?action=confirm&doseId=${item.doseId}&hora=${item.hora}`,
          },
          actions: [
            { action: 'confirm', title: '✓ Tomei agora' },
            { action: 'snooze',  title: '⏰ 15 minutos' },
          ],
        });
      } catch (e) { firedIds.delete(item.id); }
    }
  }
}

self.addEventListener('message', async (event) => {
  const msg = event.data || {};
  if (msg.type === 'SCHEDULE_DATA' && Array.isArray(msg.schedule)) {
    cachedSchedule = msg.schedule;
    await fireScheduled(msg.schedule);
  }
  if (msg.type === 'CHECK_SCHEDULE') await tick();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { action } = event;
  const d = event.notification.data || {};

  if (action === 'snooze') {
    cachedSchedule = [...cachedSchedule, {
      id: `${d.tag}-snooze-${Date.now()}`,
      fireAt: Date.now() + 15 * 60 * 1000,
      title: `⏰ Lembrete: ${d.title || 'Medicamento'}`,
      body: d.body || 'Hora de tomar seu medicamento',
      tag: `${d.tag}-snooze`,
      doseId: d.doseId, medId: d.medId, hora: d.hora,
    }];
    return;
  }

  let url = d.url || '/';
  if (action === 'confirm') url = `/?action=confirm&doseId=${d.doseId || ''}&hora=${d.hora || ''}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});

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

startNotificationLoop();
