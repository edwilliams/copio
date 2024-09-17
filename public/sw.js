// --------------------------------------------------------
// cache resources
// --------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open('copio-cache')
      .then((cache) =>
        cache.addAll([
          'index.html',
          './', // alias for index.html
          'app.min.js',
          'manifest.webmanifest',
          'favicon.ico',
          'apple-touch-ico.png',
          'icon-192.png',
          'icon-512.png',
          'copio.svg',
          'cropper.css',
          'reset.css',
          'utils.css',
          'main.css',
          'fonts/mont/regular.woff2',
          'fonts/mont/semibold.woff2',
          'pdfjs/pdf.min.js',
          'pdfkit.js',
          'runtime-generator.js'
        ])
      )
      .then(self.skipWaiting())
  )
})

// --------------------------------------------------------
// receipe: cache, falling back to network
// --------------------------------------------------------
self.addEventListener('fetch', (event) => {
  // skip cross-origin requests, like those for google analytics.
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((response) => response || fetch(event.request))
    )
  }
})
