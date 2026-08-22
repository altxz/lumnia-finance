// Handlers de Web Push, importados por /push-sw.js.
// NÃO registar este ficheiro diretamente como service worker.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: data.icon || "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      vibrate: [200, 100, 200],
      tag: data.tag || "lumnia-notification",
      renotify: true,
      data: {
        url: data.url || "/",
      },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Lumnia", options)
    );
  } catch (e) {
    console.error("Push event error:", e);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
