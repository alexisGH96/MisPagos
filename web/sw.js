// Guarda la app para que abra sin internet; siempre intenta traer la versión nueva primero.
const CACHE = 'mispagos-web-v4';
const ARCHIVOS = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png', './perfil_0.jpg', './perfil_1.jpg', './perfil_2.jpg', './perfil_3.jpg', './perfil_4.jpg', './perfil_5.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
