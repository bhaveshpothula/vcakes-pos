const CACHE_NAME = "bakery-pos-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/login",
  "/pos",
  "/dashboard",
  "/manifest.json",
  "/favicon.ico"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker: Caching assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Service Worker: Removing old cache", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and exclude Next.js dev hot-reload assets (webpack-hmr)
  if (
    event.request.method !== "GET" || 
    event.request.url.includes("/_next/webpack-hmr") ||
    event.request.url.includes("chrome-extension")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached asset, but fetch updated asset in background (stale-while-revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => { /* ignore offline fetch failures */ });
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Cache successful GET api requests (like item listings) for offline use
          if (
            networkResponse.status === 200 &&
            (event.request.url.includes("/api/items") || event.request.url.includes("/api/categories"))
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          if (event.request.headers.get("accept").includes("text/html")) {
            return caches.match("/");
          }
        });
    })
  );
});
