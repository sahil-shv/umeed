const CACHE = 'umeed-teacher-cache-v1';
const FILES = [
  '/teacher-app/',
  '/teacher-app/index.html',
  '/teacher-app/styles.css',
  '/teacher-app/app.js',
  '/teacher-app/manifest.json'
];
self.addEventListener('install', evt=>{
  evt.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', evt => { evt.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', evt=>{
  const req = evt.request;
  if(req.url.includes('/api/')) {
    evt.respondWith(fetch(req).catch(()=>caches.match('/teacher-app/index.html')));
    return;
  }
  evt.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    return caches.open(CACHE).then(cache => { cache.put(req, res.clone()); return res; });
  }).catch(()=>caches.match('/teacher-app/index.html'))));
});
