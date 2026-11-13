const CACHE_VERSION = 'medicare-cuidador-v5';
const SHELL_ASSETS = [
  '/manifest.json?v=5',
  '/icon-192.png?v=5',
  '/icon-512.png?v=5',
  '/apple-touch-icon.png?v=5',
];

const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>MediCare Cuidador — Sem conexão</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0b1120;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 24px;
    }
    .card {
      max-width: 380px;
      width: 100%;
      background: #131d31;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 28px 24px;
      text-align: center;
    }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0 0 20px; }
    button {
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sem conexão no momento</h1>
    <p>Verifique sua internet para sincronizar os dados de saúde dos seus pacientes no MediCare Cuidador.</p>
    <button onclick="window.location.reload()">Tentar novamente</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((legacyKey) => caches.delete(legacyKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca interceptar rotas dinâmicas de API, autenticação ou proxy
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/rest/')
  ) {
    return;
  }

  // Navegação HTML: Network-First para sempre obter chunks atuais do Next.js
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const cachedRoot = await caches.match('/cuidador');
          if (cachedRoot) return cachedRoot;
          return new Response(OFFLINE_FALLBACK_HTML, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // Assets estáticos (/icon-*, /_next/static/*): Stale-While-Revalidate seguro
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'MediCare Cuidador', body: event.data.text() };
  }
  const title = data.title || 'MediCare Cuidador';
  const options = {
    body: data.body || 'Nova atualização de acompanhamento.',
    icon: '/icon-192.png?v=5',
    badge: '/icon-96.png?v=5',
    data: { url: data.url || '/cuidador' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/cuidador';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/cuidador') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
