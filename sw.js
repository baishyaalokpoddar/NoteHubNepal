/**
 * Service Worker for NoteHub Nepal
 * Provides robust offline caching for all assets, fonts, styles, and scripts.
 */

const CACHE_NAME = 'notehub-nepal-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/nepali-calendar.js',
  '/js/nepali-transliterate.js',
  '/js/dictionary.js',
  '/js/caption-formatter.js',
  '/js/github-sync.js',
  '/js/storage.js',
  '/js/reminder.js',
  '/js/sync.js',
  '/js/admin.js',
  '/js/editor.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Pre-caching offline assets for NoteHub Nepal');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { mode: 'no-cors' })));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch network in background for fresh content
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
