// Garde le bon de commande des salons disponible même sans réseau (uniquement ces fichiers).
const CACHE = 'bon-salon-v1';
const FICHIERS = ['/bon-salon.html', '/manifest-salon.json', '/favicon-48.png', '/apple-touch-icon.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !FICHIERS.includes(u.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const vieux = await c.match(u.pathname);
    const reseau = fetch(e.request).then((r) => { if (r && r.ok) c.put(u.pathname, r.clone()); return r; }).catch(() => vieux);
    return vieux || reseau;
  }));
});
