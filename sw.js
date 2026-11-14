/* Sieć najpierw, pamięć podręczna jako zapas — panel otwiera się też bez zasięgu (z ostatnio pobranymi plikami). */
const CACHE = "master-v2";
const key = req => { const u = new URL(req.url); u.search = ""; return u.href; }; /* ?v=… nie mnoży wpisów */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-store" }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key(e.request), copy)); } return r; })
      .catch(() => caches.match(key(e.request)))
  );
});
