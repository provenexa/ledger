// 15 Nov 2026: the /next/ client pages are retired (members site replaces them). This worker clears the old offline copies
// on installed apps and then removes itself.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({type: "window"}))
      .then((cs) => cs.forEach((c) => c.navigate("/next/")))
  );
});
