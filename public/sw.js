// Offline shell. The app page is network-first so updates show up right away;
// static files and fonts are cache-first. API and database calls are never cached.
const CACHE = 'cc-shell-v1';
const SHELL = ['/', '/shim.js', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;
  if (/supabase\.co$/.test(url.hostname)) return;
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/shim.js'));
  if (isPage) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? '/' : req, copy)); return r; })
      .catch(() => caches.match(req.mode === 'navigate' ? '/' : req)));
    return;
  }
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'cdn.jsdelivr.net';
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
});
