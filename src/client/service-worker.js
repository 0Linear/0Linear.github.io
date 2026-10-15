/*
 * Offline cache for the desktop (service worker)
 *
 * scripts/build-sw.js turns this file into dist/sw.js, filling in VERSION
 * (a hash of the site's files) and PRECACHE (the files every visit needs,
 * each with its own content hash).
 *
 *  - On install, the PRECACHE files are downloaded once and stored. After a
 *    deploy, only files whose hash changed are downloaded again.
 *  - Every request is then answered from the browser's cache when possible;
 *    anything not stored yet (icons, sounds) is fetched once and kept.
 *  - Welcome files have content-hashed names, so they are kept across
 *    deploys; ones the site no longer lists are removed.
 *  - A new deploy changes VERSION, so browsers fetch only the new sw.js,
 *    store the new files and drop the old ones.
 *
 * The browser checks sw.js for changes on each visit; that small request
 * is the only one a returning visitor makes.
 */

/* global __PRECACHE__ */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;

const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const WELCOME = 'welcome-files';
const BASE = new URL('./', self.location).href;
const MANIFEST = BASE + 'welcome/manifest.json';

// Stores a response with its file hash, so the next version can reuse it
const stamp = (response, hash) => response.blob().then(body => {
  const headers = new Headers(response.headers);
  headers.set('x-sw-hash', hash);
  return new Response(body, {status: response.status, statusText: response.statusText, headers});
});

// A file unchanged since an earlier version is copied from its cache
const reuse = (url, hash) => caches.keys()
  .then(keys => keys.filter(key => key.startsWith('shell-') && key !== SHELL))
  .then(keys => keys.reduce((found, key) => found.then(hit => hit || caches.open(key)
    .then(cache => cache.match(url))
    .then(res => (res && res.headers.get('x-sw-hash') === hash ? res : null))), Promise.resolve(null)));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL)
    .then(cache => Promise.all(PRECACHE.map(([file, hash]) => {
      const url = BASE + file;
      return reuse(url, hash).then(hit => hit || fetch(new Request(url, {cache: 'reload'}))
        .then(res => {
          if (!res.ok) {
            throw new Error(`Could not download ${file} (${res.status})`);
          }
          return stamp(res, hash);
        }))
        .then(res => cache.put(url, res));
    })))
    .then(() => self.skipWaiting()));
});

// Removes stored welcome files that the current manifest no longer lists
const pruneWelcomeFiles = () => caches.open(SHELL)
  .then(cache => cache.match(MANIFEST))
  .then(res => (res ? res.json() : null))
  .then(manifest => {
    if (!manifest || !manifest.mounts) {
      return undefined;
    }
    const wanted = new Set();
    Object.values(manifest.mounts).forEach(list => list
      .filter(f => f.url)
      .forEach(f => wanted.add(BASE + f.url)));

    return caches.open(WELCOME).then(cache => cache.keys().then(keys => Promise.all(keys
      .filter(req => !wanted.has(req.url))
      .map(req => cache.delete(req)))));
  })
  .catch(() => undefined);

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(key => key !== SHELL && key !== RUNTIME && key !== WELCOME)
      .map(key => caches.delete(key))))
    .then(pruneWelcomeFiles)
    .then(() => self.clients.claim()));
});

const fromCacheOrNetwork = (request, cacheName) => caches.match(request, {ignoreSearch: true})
  .then(hit => hit || fetch(request).then(res => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(cacheName).then(cache => cache.put(request, copy));
    }
    return res;
  }));

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET' || !request.url.startsWith(BASE)) {
    return;
  }

  // Audio/video seek with Range requests; let those go to the network
  if (request.headers.has('range')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(caches.match(BASE + 'index.html')
      .then(hit => hit || fetch(request)));
    return;
  }

  const path = request.url.slice(BASE.length);
  event.respondWith(fromCacheOrNetwork(request, path.startsWith('welcome/files/') ? WELCOME : RUNTIME));
});
