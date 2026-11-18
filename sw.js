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

// Morgenbesked fra Supabase-funktionen morgenbesked: {titel, tekst, url}.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { tekst: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.titel || "emilanos", {
    body: d.tekst || "", icon: "ikoner/ikon-hq-192.png", badge: "ikoner/ikon-hq-192.png", data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    return c ? c.focus() : self.clients.openWindow(e.notification.data?.url || "./");
  }));
});
