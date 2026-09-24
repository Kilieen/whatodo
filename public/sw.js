// Network-first documents avoid mixing old HTML with newly deployed JavaScript.
// No authenticated API responses or HTML are persisted offline.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('whatodo-')).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => new Response(
    '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Whatodo — hors ligne</title><body><h1>Connexion indisponible</h1><p>Votre session est conservée. Rétablissez la connexion puis rechargez cette page.</p><button onclick="location.reload()">Réessayer</button></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )))
})
