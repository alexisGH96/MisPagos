// Guarda la app para que abra sin internet; siempre intenta traer la versión nueva primero.
const CACHE = 'mispagos-web-v38';
const ARCHIVOS = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png', './perfil_0.jpg', './perfil_1.jpg', './perfil_2.jpg', './perfil_3.jpg', './perfil_4.jpg', './perfil_5.jpg', './fondo-glass-2.jpg', './fondo-blanco-2.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, {cache: 'no-store'}).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});

// avisos de pagos que manda la tarea diaria de GitHub
self.addEventListener('push', e => {
  let d = {title: 'Mis Pagos', body: 'Tienes pagos por vencer'};
  try { d = e.data.json(); } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title, {body: d.body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'pagos', renotify: true}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type: 'window'}).then(l => l.length ? l[0].focus() : clients.openWindow('./')));
});
