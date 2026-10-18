// Next Moves installable app (Sumit, 18 Oct 2026): lets the /next/ pages install to the home screen and open offline.
// Pages: network first (stories update every morning), cached copy only when offline. Pages stay encrypted in the cache.
// Alerts (18 Oct): the push itself is empty; we fetch the counts from the push helper and write one line. Never company names.
const CACHE = "next-moves-v5";
const SHELL = ["/next/", "/next/manifest.webmanifest", "/next/icons/icon-192.png", "/next/icons/icon-512.png"];
const PUSH_API = "https://provenexa-next-push.provenexa.workers.dev";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(
      // no-cache = always ask the site for the newest page (the site's own 10-minute browser cache hid new versions, 18 Oct)
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/next/")))
    );
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

function line(name, c) {
  if (!c) return "";
  const bits = [];
  if (c.added) bits.push(plural(c.added, "new company", "new companies"));
  if (c.updated) bits.push(plural(c.updated, "story updated", "stories updated"));
  return bits.length ? name + ": " + bits.join(", ") : "";
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let body = "New moves are on your Next Moves pages.";
    let url = "/next/";
    try {
      const r = await (await fetch(PUSH_API + "/latest", { cache: "no-store" })).json();
      if (r && r.counts) {
        const g = line("New GCCs", r.counts.gcc), p = line("Plants and offices", r.counts.plants);
        if (r.kind === "weekly") body = "This week's Next Moves are ready." + (g || p ? " " + [g, p].filter(Boolean).join(". ") + "." : "");
        else if (g || p) body = [g, p].filter(Boolean).join(". ") + ".";
        if (g && !p) url = "/next/gcc/";
        if (p && !g) url = "/next/plants/";
      }
    } catch (e) { /* offline: the general line above still shows */ }
    await self.registration.showNotification("Next Moves", {
      body, icon: "/next/icons/icon-192.png", badge: "/next/icons/badge-96.png", tag: "next-moves-daily", renotify: true, data: { url },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/next/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    const open = wins.find((w) => w.url.startsWith(self.location.origin + "/next/"));
    if (open) return open.navigate(target).then((w) => (w || open).focus()).catch(() => open.focus());
    return self.clients.openWindow(target);
  }));
});
