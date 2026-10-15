// Soni Motor offline cache: keeps the app itself on the phone so it opens without signal.
// Student data is never cached here; it comes from the Google Sheet (the app keeps only the last loaded copy).
const CACHE = 'soni-motor-v1-2-1';
const FILES = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './lib/qrcode.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // Sheet API calls go straight to the network
  if (url.pathname.includes('/quiz/')) return;                                  // the public quiz is not part of the app
  const net = () => fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  });
  // network first for the page and settings so updates arrive quickly; cache when offline
  e.respondWith(net().catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
