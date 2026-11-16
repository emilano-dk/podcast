// Service worker: appens skal virker også uden net. Tallene ligger i localStorage (app.js),
// så her caches kun filerne. Netværk først, så en ny version altid slår igennem.
const CACHE = "emilanos-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname.endsWith("supabase.co")) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const kopi = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, kopi)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
