/* 知忆 · Service Worker：静态资源缓存优先，页面导航网络优先 */
const CACHE = 'zhiyi-v2';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/util.js',
  './assets/js/db.js',
  './assets/js/tts.js',
  './assets/js/localai.js',
  './assets/js/webkb.js',
  './assets/js/ai.js',
  './assets/js/translate.js',
  './assets/js/importer.js',
  './assets/js/reader.js',
  './assets/js/mindmap.js',
  './assets/js/annotate.js',
  './assets/data/knowledge.js',
  './assets/js/lab.js',
  './assets/js/review.js',
  './assets/js/chat.js',
  './assets/js/demo.js',
  './assets/js/app.js',
  './assets/vendor/mammoth.browser.min.js',
  './assets/vendor/jszip.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
