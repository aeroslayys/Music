const CACHE_NAME = "feather-player-cache-v1";
const urlsToCache = [
  "/Music/",
  "/Music/index.html",
  "/Music/manifest.json",
  "/Music/service-worker.js",
  // Add CSS, JS, font, and audio files you want cached
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
