// Garde le bon de commande des salons disponible même sans réseau (uniquement ces fichiers).
// Avec du réseau : toujours la dernière version. Sans réseau : la dernière version enregistrée.
const CACHE = 'bon-salon-v13';
const FICHIERS = ['/bon-salon.html', '/manifest-salon.json', '/favicon-48.png', '/apple-touch-icon.png', '/icone-bon-192.png', '/icone-bon-512.png', '/app.html', '/app-espace.js', '/donnees-exh.js', '/manifest-app.json', '/outil.html', '/carnet-fidelite.html', '/logo.webp', '/favicon-192.png'];
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
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r && r.ok) c.put(u.pathname, r.clone());
      return r;
    } catch (err) {
      const vieux = await c.match(u.pathname);
      if (vieux) return vieux;
      throw err;
    }
  }));
});
