// Service worker : cache-first pour un fonctionnement 100 % hors-ligne.
const CACHE = 'caveau-v3';
const ASSETS = [
  './', 'index.html', 'css/style.css',
  'js/app.js', 'js/ui.js', 'js/store.js', 'js/parser.js', 'js/sommelier.js',
  'js/wine-data.js', 'js/voice.js', 'js/ai.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Jamais de cache pour l'API Claude
  if (e.request.url.includes('api.anthropic.com')) return;
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
