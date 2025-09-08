const CACHE = 'kcal-local-v5';
const ASSETS = [
  './', './index.html', './app.js', './db.js', './foods.json',
  './manifest.webmanifest',
  'https://cdn.jsdelivr.net/npm/dexie@3.2.7/dist/dexie.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
