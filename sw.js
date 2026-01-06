/* PEPSVAL service worker (safe + always update) */
const VERSION = "pepsval-sw-v3"; // change this if you ever want to force refresh again

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  // No aggressive caching. Let GitHub pages serve latest.
});