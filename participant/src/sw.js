// Service worker: keeps the app usable when the venue Wi-Fi is overloaded.
// - pages: from the cache if fetched < 10 min ago, else network first (3 s timeout), then the cached copy
// - hashed files (/assets, /js, /vendor): cache first, they never change
// - Google Fonts: stale-while-revalidate
// - /api/*: never cached
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = "tggc-act-" + VERSION;
const FRESH = 10 * 60e3;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("tggc-act-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms, p) {
  return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), ms); p.then((r) => { clearTimeout(t); res(r); }, rej); });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/api/")) return;
    if (req.mode === "navigate") {
      // the booth QR opens the site from the phone camera at every booth: if the page was fetched in the last
      // 10 minutes, open it straight from the cache (instant, and no request to the server); otherwise network
      // first (3 s timeout), then the cached copy
      e.respondWith(
        caches.open(CACHE).then(async (c) => {
          const hit = await c.match("/");
          if (hit && Date.now() - (+hit.headers.get("x-sw-at") || 0) < FRESH) return hit;
          return timeout(3000, fetch(req)).then(async (r) => {
            if (r.ok && r.type === "basic") {
              const h = new Headers(r.headers); h.set("x-sw-at", String(Date.now()));
              c.put("/", new Response(await r.clone().blob(), { status: r.status, headers: h }));
            }
            return r;
          }).catch(() => hit || fetch(req));
        })
      );
      return;
    }
    e.respondWith(
      caches.match(req, { ignoreSearch: false }).then((hit) => hit || fetch(req).then((r) => {
        if (r.ok && /^\/(assets|js|vendor)\//.test(url.pathname)) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return r;
      }))
    );
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open("tggc-fonts").then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
