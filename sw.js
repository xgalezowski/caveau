// Service worker : cache-first pour un fonctionnement 100 % hors-ligne.
const CACHE = 'caveau-v45';
const ASSETS = [
  './', 'index.html', 'css/style.css',
  'js/app.js', 'js/ui.js', 'js/store.js', 'js/parser.js', 'js/sommelier.js',
  'js/wine-data.js', 'js/voice.js', 'js/ai.js', 'js/fx.js', 'js/orbe-fluide.js',
  'js/fluide-sim.js', 'js/carte.js', 'js/monde.js', 'js/i18n.js',
  'js/locales/fr.js', 'js/locales/en.js', 'js/locales/es.js',
  'js/locales/prompts-fr.js', 'js/locales/prompts-en.js', 'js/locales/prompts-es.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' force le réseau — sans ça, GitHub Pages (max-age=600)
  // laisse le cache HTTP resservir d'anciens fichiers au nouveau SW, et
  // l'app paraît « ne pas se mettre à jour » malgré les rechargements.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// app.js peut envoyer SKIP_WAITING pour forcer l'activation immédiate
// (double filet avec le skipWaiting() déjà dans install).
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Jamais de cache pour l'API Claude ni pour la page de reset (doit toujours
  // aller au réseau pour pouvoir débloquer un cache corrompu).
  if (e.request.url.includes('api.anthropic.com')) return;
  if (e.request.url.includes('reset.html')) return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit ||
      fetch(e.request).then((rep) => {
        if (rep.ok && e.request.method === 'GET' && e.request.url.startsWith(self.location.origin)) {
          const clone = rep.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return rep;
      }).catch(() => caches.match('index.html'))
    )
  );
});
