/* ==========================================================================
   KLIPIN — Service Worker
   Strategi: cache-first untuk aset statis, network-first untuk /api,
   fallback ke offline.html saat navigasi gagal tanpa koneksi.
   ========================================================================== */

const CACHE_NAME = "klipin-cache-v2";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/css/style.css",
  "/js/app.js",
  "/js/download.js",
  "/js/admin.js",
  "/manifest.json",
  "/cara-penggunaan",
  "/larangan",
  "/donasi",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Jangan cache API — selalu ambil data terbaru dari network.
  if (url.pathname.startsWith("/api")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ success: false, message: "Tidak ada koneksi internet." }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        })
      )
    );
    return;
  }

  // Navigasi halaman: network-first, fallback offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Aset statis: cache-first.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
