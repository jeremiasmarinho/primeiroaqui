// Service worker minimalista do Primeiro Aqui.
//
// Estratégia deliberadamente simples e segura:
// - Navegações (HTML) e /api: SEMPRE network-first. O servidor já manda
//   `Cache-Control: no-cache` no index.html (ver src/server/root.ts) — o SW
//   respeita a mesma regra. Cache-first aqui serviria app velho após deploy.
// - /assets/*: hasheados e imutáveis pelo Vite -> cache-first.
// - Sem Workbox: ~60 linhas legíveis, fácil de auditar.

const CACHE_VERSION = 'pa-v1'
const SHELL_CACHE = `pa-shell-${CACHE_VERSION}`
const ASSETS_CACHE = `pa-assets-${CACHE_VERSION}`

const OFFLINE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Primeiro Aqui — sem conexão</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#F8FAFC; color:#0B1F5C; font-family:system-ui,-apple-system,sans-serif; text-align:center; padding:24px; }
  .card { max-width:360px; }
  .dot { width:64px; height:64px; border-radius:50%; background:#FFE600; margin:0 auto 16px;
    display:flex; align-items:center; justify-content:center; font-size:28px; }
  h1 { font-size:18px; margin:0 0 8px; }
  p { font-size:14px; color:#3f4a63; margin:0; }
</style>
</head>
<body>
  <div class="card">
    <div class="dot">📍</div>
    <h1>Você está offline</h1>
    <p>Não foi possível carregar o Primeiro Aqui agora. Verifique sua conexão e tente novamente.</p>
  </div>
</body>
</html>`

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== ASSETS_CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const isAsset = url.origin === self.location.origin && url.pathname.startsWith('/assets/')
  const isNavigation = request.mode === 'navigate'
  const isApi = url.pathname.startsWith('/api/')

  if (isAsset) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      }),
    )
    return
  }

  if (isNavigation || isApi) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE)
        const cached = await cache.match(request)
        if (cached) return cached
        if (isNavigation) {
          return new Response(OFFLINE_HTML, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
  }
})
