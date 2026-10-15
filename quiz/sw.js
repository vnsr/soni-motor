// LL Practice offline cache: the quiz works without signal once opened. Results counts are sent only when online.
const CACHE = 'll-practice-v2-0-0';
const FILES = ['./', './index.html', './bank.js', './manifest.webmanifest', '../config.js', '../icon-180.png', '../icon-192.png', '../icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('ll-practice') && x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return res; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(h => h || caches.match('./index.html'))));
});
