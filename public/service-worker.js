// KILL SWITCH — este caminho já não é um service worker de cache.
//
// Durante um período o app usou /service-worker.js (Workbox) para guardar o index.html em
// cache. Isso deixou dispositivos presos numa versão antiga do app: o HTML vinha
// da cache do service worker e carregava JavaScript desatualizado.
//
// Este ficheiro substitui esse registo: apaga as caches do próprio app, obriga
// as janelas abertas a recarregar e desregista-se. NÃO voltar a servir um
// service worker de cache neste caminho.

self.addEventListener("install", () => self.skipWaiting());

// Cache Storage é partilhada pela origem — apagar apenas as caches criadas por
// este app (Workbox e as caches nomeadas que usávamos).
function isOwnCache(name) {
  return (
    /(^|-)precache-v\d+-/.test(name) ||
    /(^|-)runtime-/.test(name) ||
    /(^|-)googleAnalytics-/.test(name) ||
    name === "html" ||
    name === "images" ||
    name === "fonts"
  );
}

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(names.filter(isOwnCache).map((n) => caches.delete(n)));
        await self.clients.claim();
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(clients.map((c) => c.navigate(c.url)));
      } finally {
        await self.registration.unregister();
      }
    })()
  )
);
