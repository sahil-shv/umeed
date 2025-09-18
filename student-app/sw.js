const CACHE = 'umeed-student-cache-v1';
const FILES = [
  '/student-app/',
  '/student-app/index.html',
  '/student-app/styles.css',
  '/student-app/app.js',
  '/student-app/manifest.json'
];

self.addEventListener('install', evt=>{
  evt.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', evt => { evt.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', evt=>{
  const req = evt.request;
  // API calls should go to network-first
  if(req.url.includes('/api/')) {
    evt.respondWith(fetch(req).catch(()=>caches.match('/student-app/index.html')));
    return;
  }
  // static: cache-first
  evt.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    return caches.open(CACHE).then(cache => { cache.put(req, res.clone()); return res; });
  }).catch(()=>caches.match('/student-app/index.html'))));
});
