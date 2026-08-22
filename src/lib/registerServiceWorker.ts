/**
 * Gestão de service workers do Lumnia.
 *
 * Decisão arquitetural: o app NÃO tem service worker de cache. O HTML e os
 * assets vêm sempre da rede (o servidor responde `no-cache` no HTML), para que
 * qualquer publicação chegue de imediato ao browser, ao celular e ao app
 * instalado. Não há modo offline.
 *
 * O único service worker registado é o de notificações push (/push-sw.js), que
 * não intercepta pedidos nem guarda nada em cache.
 *
 * Os caminhos antigos (/sw.js, /service-worker.js, /sw-push.js) passaram a ser
 * "kill switches" e são desregistados aqui também, para dispositivos presos numa
 * versão antiga saírem desse estado.
 */

export const PUSH_SW_URL = "/push-sw.js";

/** Caminhos que nunca podem voltar a controlar o app. */
const LEGACY_SW_URLS = ["/sw.js", "/service-worker.js", "/sw-push.js"];

/** Nomes de cache criados pelas versões antigas com Workbox. */
function isAppCacheName(name: string) {
  return (
    /(^|-)precache-v\d+-/.test(name) ||
    /(^|-)runtime-/.test(name) ||
    /(^|-)googleAnalytics-/.test(name) ||
    name === "html" ||
    name === "images" ||
    name === "fonts"
  );
}

/** Ouvintes avisados quando existe uma versão nova pronta a assumir. */
const updateListeners = new Set<() => void>();
let updateReady = false;

/** Regista um ouvinte de "versão nova pronta". Devolve a função para remover. */
export function onServiceWorkerUpdateReady(listener: () => void) {
  updateListeners.add(listener);
  if (updateReady) listener();
  return () => updateListeners.delete(listener);
}

function notifyUpdateReady() {
  updateReady = true;
  updateListeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignorar
    }
  });
}

function isPreviewContext(): boolean {
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const h = window.location.hostname;
  const previewHost =
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev");
  return inIframe || previewHost;
}

function scriptUrlOf(reg: ServiceWorkerRegistration) {
  return reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
}

async function getRegistrations() {
  try {
    return (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
  } catch {
    return [];
  }
}

/** Desregista tudo o que não seja o worker de push. */
export async function unregisterLegacyWorkers() {
  const regs = await getRegistrations();
  const legacy = regs.filter((r) => {
    const url = scriptUrlOf(r);
    if (!url) return false;
    if (url.endsWith(PUSH_SW_URL)) return false;
    return LEGACY_SW_URLS.some((p) => url.endsWith(p)) || true;
  });
  await Promise.allSettled(legacy.map((r) => r.unregister()));
  return legacy.length > 0;
}

/** Apaga as caches criadas pelas versões antigas do app. */
export async function clearAppCaches() {
  if (!("caches" in window)) return;
  try {
    const names = await caches.keys();
    await Promise.allSettled(names.filter(isAppCacheName).map((n) => caches.delete(n)));
  } catch {
    // ignorar
  }
}

/**
 * Saída de emergência: remove qualquer service worker (incluindo o de push),
 * apaga todas as caches e recarrega ignorando o cache do browser.
 */
export async function forceAppUpdate() {
  try {
    const regs = await getRegistrations();
    await Promise.allSettled(regs.map((r) => r.unregister()));
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.allSettled(names.map((n) => caches.delete(n)));
    }
  } catch {
    // ignorar
  }
  // Marca temporal na URL para o browser não reutilizar a resposta em cache.
  const url = new URL(window.location.href);
  url.searchParams.set("_fresh", String(Date.now()));
  window.location.replace(url.toString());
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";

  // Em dev/preview, ou com ?sw=off, não existe nenhum service worker.
  if (!import.meta.env.PROD || isPreviewContext() || killSwitch) {
    void (async () => {
      const regs = await getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));
      await clearAppCaches();
    })();
    return;
  }

  window.addEventListener("load", () => {
    void (async () => {
      // 1. Garantir que nenhum worker de cache antigo continua a controlar o app.
      await unregisterLegacyWorkers();
      await clearAppCaches();

      // 2. Registar apenas o worker de push (sem fetch, sem cache).
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: "/" });
      } catch (err) {
        console.warn("Push SW registration failed:", err);
        return;
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            notifyUpdateReady();
          }
        });
      });
    })();
  });
}
