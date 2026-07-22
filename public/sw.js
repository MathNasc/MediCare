// MediCare Service Worker v5 — cache seguro + invalidação garantida a cada deploy
//
// O QUE MUDOU DA v4 PARA A v5:
// 1. BUG CORRIGIDO: "Failed to execute 'clone' on 'Response': Response
//    body is already used". Isso acontecia porque, em alguns caminhos do
//    fetch handler, o código tentava ler o corpo da resposta (ex: via
//    outra função) e DEPOIS chamar .clone() — mas clone() só funciona
//    ANTES do corpo ser consumido. Agora usamos um helper `safeCachePut`
//    que sempre clona a resposta imediatamente, antes de qualquer outro
//    uso, garantindo que nunca tentamos clonar um corpo já lido.
// 2. CACHE_VERSION foi incrementado (v4 → v5). Isso força TODOS os
//    usuários a descartarem qualquer cache antigo (mesmo corrompido
//    pelo bug acima) na próxima visita, sem precisar de nenhuma ação
//    manual do usuário.
// 3. O SW agora responde a uma mensagem 'CHECK_FOR_UPDATE' vinda da
//    página, permitindo forçar uma verificação de atualização sob
//    demanda (ver hook usePWAInstall no page.jsx).

const CACHE_VERSION  = 'medicare-v5';
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
      // Remove QUALQUER cache que não seja da versão atual — inclui
      // caches de v4 e anteriores, mesmo que estivessem corrompidos.
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('medicare-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => startNotificationLoop())
  );
});

// ─── Helper seguro para clonar + armazenar respostas em cache ─────────────────
// SEMPRE clona a resposta imediatamente ao recebê-la, antes de qualquer
// outra operação (incluindo retornar para quem chamou). Isso elimina a
// classe inteira de bugs "Response body is already used".
function safeCachePut(cacheName, request, response) {
  if (!response || !response.ok) return response;
  const toCache = response.clone();
  caches.open(cacheName)
    .then(cache => cache.put(request, toCache))
    .catch(() => { /* silencioso — cache é otimização, não requisito */ });
  return response;
}

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
  // Permite que a página peça explicitamente uma verificação de update do SW.
  if (msg.type === 'CHECK_FOR_UPDATE') {
    self.registration.update().catch(() => {});
  }
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

  // Documentos/navegação: SEMPRE rede, nunca cache — garante que o HTML
  // (e portanto as referências aos chunks JS/CSS mais recentes) esteja
  // sempre atualizado.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('<h1>Você está offline</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      )
    );
    return;
  }

  // Assets estáticos versionados pelo Next.js (nome do arquivo muda a cada
  // build) — cache-first é seguro aqui porque uma build nova nunca reusa
  // o mesmo nome de arquivo.
  if (url.pathname.startsWith('/_next/static') || url.pathname.match(/\.(png|ico|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => safeCachePut(STATIC_CACHE, request, res));
      })
    );
    return;
  }

  // Demais requisições GET: rede primeiro, cache como fallback offline.
  event.respondWith(
    fetch(request)
      .then(res => safeCachePut(DYNAMIC_CACHE, request, res))
      .catch(() => caches.match(request))
  );
});

startNotificationLoop();
