const CACHE_NAME = "dainiki-static-cache-v1";
const OFFLINE_URLS = [
  "/",
  "/manifest.json",
  "/dainiki-logo.jpg"
];

// Install Phase - Cache essential files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching offline pages and assets");
      return cache.addAll(OFFLINE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Phase - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Phase - Intercept requests
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip tracking non-HTTP or third-party extension schemas
  if (!url.protocol.startsWith("http")) return;

  // Let Server Actions / API POST requests pass straight through to the network
  if (request.method !== "GET") return;

  // Page Navigations (HTML requests) - Network First falling back to cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Dynamic caching of pages we visit
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });
          return response;
        })
        .catch(() => {
          // Offline fallback - search caches for a matching page or return home
          // Strip query parameters to match cached page (e.g. /?id=12 -> /)
          const urlNoParams = request.url.split('?')[0];
          return caches.match(urlNoParams).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            
            return caches.match(request).then((res) => {
              if (res) return res;
              // Fall back to main dashboard shell
              return caches.match("/");
            });
          });
        })
    );
    return;
  }

  // Static Assets (JS, CSS, Images, Fonts) - Cache First falling back to Network
  const isStaticAsset = 
    url.pathname.includes("/_next/") || 
    url.pathname.endsWith(".js") || 
    url.pathname.endsWith(".css") || 
    url.pathname.endsWith(".png") || 
    url.pathname.endsWith(".jpg") || 
    url.pathname.endsWith(".svg") || 
    url.pathname.endsWith(".ico") || 
    url.pathname.endsWith(".json");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;

          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });
          return response;
        }).catch(() => {
          // Fail silently, or return a placeholder if image
          return null;
        });
      })
    );
    return;
  }

  // Fallback default: Network First
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
