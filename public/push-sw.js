// Service worker EXCLUSIVO de notificações push.
//
// Regras deste ficheiro:
// - não tem handler de `fetch`, logo nunca serve HTML ou assets de cache;
// - não cria nenhuma cache;
// - existe apenas para receber Web Push e abrir o app ao clicar na notificação.
//
// O shell do app deixou de ser guardado em cache de propósito: o HTML vem sempre
// da rede, para as atualizações chegarem de imediato a todos os dispositivos.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

importScripts("/push-handlers.js");
