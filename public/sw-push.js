// KILL SWITCH — este caminho já não é um service worker ativo.
// Durante muito tempo o app registou /sw-push.js no escopo "/", competindo com o
// service worker do PWA (/sw.js) e deixando dispositivos presos numa versão antiga.
// Este ficheiro substitui esse registo: limpa as caches órfãs, força os clientes a
// recarregar e desregista-se a si mesmo. Não voltar a registar este caminho.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        const stale = names.filter((n) =>
          /(^|-)precache-v\d+-|(^|-)runtime-|^images$|^fonts$/.test(n)
        );
        await Promise.allSettled(stale.map((n) => caches.delete(n)));
        await self.clients.claim();
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(clients.map((c) => c.navigate(c.url)));
      } finally {
        await self.registration.unregister();
      }
    })()
  )
);
