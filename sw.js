// Service worker d'Horizon : fonctionnement hors ligne. Aucune donnée personnelle ne transite ici
// (les données restent dans le stockage local du navigateur, jamais dans ce cache).
// Sur GitHub Pages, plusieurs sites peuvent partager la même origine : Horizon ne touche qu'à ses propres caches.
const PREFIX = 'horizon-';
const CACHE = PREFIX + 'e4e187e125';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './favicon-64.png'];
const NETWORK_TIMEOUT_MS = 3500;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Page : réseau d'abord (pour recevoir les mises à jour), avec délai court ; sinon la version en cache.
// Seule une réponse valide remplace la page en cache (une erreur 404 ou 500 ne casse jamais le mode hors ligne).
function navigation(req) {
  const network = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      // Si une version plus récente a déjà supprimé ce cache, ne pas le recréer.
      caches.has(CACHE).then((has) => has && caches.open(CACHE).then((c) => c.put('./index.html', copy)));
    }
    return res;
  });
  network.catch(() => {});
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  return Promise.race([network.then((res) => (res.ok ? res : caches.match('./index.html').then((hit) => hit || res))), timeout.then(() => caches.match('./index.html'))])
    .then((res) => res || network)
    .catch(() => caches.match('./index.html'));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (!new URL(req.url).pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(navigation(req));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
