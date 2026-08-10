const CACHE_NAME = 'copio-cache-v11'; // bump this on every deploy

// --------------------------------------------------------
// install: fetch files-to-cache.json & cache all listed files
// --------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/files-to-cache.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch files-to-cache.json');
        }
        return response.json();
      })
      .then((files) =>
        caches.open(CACHE_NAME).then((cache) => cache.addAll(files)),
      )
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error('Service Worker install failed:', err);
      }),
  );
});

// --------------------------------------------------------
// activate: delete any caches from old versions
// --------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// --------------------------------------------------------
// fetch: cache-first with fallback to network
// --------------------------------------------------------
self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      }),
    );
  }
});
