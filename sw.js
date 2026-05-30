// SecureKit service worker
// Caches every static asset so the app works offline after first visit.
// Bump CACHE_VERSION when you update any vendored library or shipped file.

const CACHE_VERSION = 'securekit-v2';

const PRECACHE_URLS = [
    './',
    'index.html',
    'merge.html',
    'split.html',
    'compress.html',
    'secure.html',
    'pdf-to-image.html',
    'image-to-pdf.html',

    'style.css',
    'merge-style.css',
    'split-style.css',
    'compress-style.css',
    'secure-style.css',
    'validation-styles.css',

    'shared-utils.js',
    'file-size-validation.js',
    'merge.js',
    'split.js',
    'compress.js',
    'secure.js',
    'pdf-to-image.js',
    'image-to-pdf.js',
    'sw-register.js',

    'lib/pdf-lib.min.js',
    'lib/pdf.min.js',
    'lib/pdf.worker.min.js',
    'lib/pdf-encrypt-lite.js',
    'lib/jszip.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names
                    .filter((name) => name !== CACHE_VERSION)
                    .map((name) => caches.delete(name))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Only handle same-origin GET requests. Everything else (POSTs, cross-origin
    // ad/analytics requests if ever added) passes straight through.
    if (request.method !== 'GET') return;
    if (new URL(request.url).origin !== self.location.origin) return;

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;

            return fetch(request).then((response) => {
                // Only cache successful basic responses.
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const copy = response.clone();
                caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                return response;
            }).catch(() => {
                // Offline and not cached: best-effort fallback to the landing page.
                if (request.mode === 'navigate') {
                    return caches.match('index.html');
                }
                return Response.error();
            });
        })
    );
});
