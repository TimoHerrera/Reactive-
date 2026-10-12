// Service worker de Reactive: SOLO el app shell público y los assets estáticos.
// - Nunca cachea páginas de usuarios (/app, /coach), payloads RSC (?_rsc), APIs ni Supabase.
// - Navegación: siempre red; sin conexión, se muestra el shell cacheado («/»).
// - Assets estáticos con hash (/_next/static), íconos y manifest: cache primero.
// Subir VERSION borra las cachés anteriores (v1 guardaba HTML de /app y /coach).
const VERSION = "reactive-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icons/192", "/icons/512"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, YouTube, etc.
  if (url.searchParams.has("_rsc") || req.headers.get("RSC")) return; // datos de Next: nunca

  if (req.mode === "navigate") {
    // Red siempre (las páginas dependen de la sesión). Sin conexión: el shell público.
    event.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
