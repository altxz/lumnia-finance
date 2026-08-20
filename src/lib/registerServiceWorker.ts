/**
 * Registo único do service worker do PWA.
 *
 * Regras:
 * - Nunca registar em dev, dentro de iframe ou nos hosts de preview da Lovable.
 * - Nunca registar mais que um service worker no escopo "/" (o /sw.js já inclui
 *   os handlers de push via importScripts).
 * - `?sw=off` funciona como interruptor de emergência: desregista tudo e limpa caches.
 * - Quando uma versão nova ativa, a página recarrega uma única vez, de forma
 *   automática, para o utilizador nunca ficar com JS antigo em memória.
 */

const SW_URL = "/sw.js";
const LEGACY_SW_URLS = ["/sw-push.js", "/service-worker.js"];
const RELOAD_FLAG = "lumnia-sw-reloaded";

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

async function unregisterAll() {
  const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
  await Promise.allSettled(regs.map((r) => r.unregister()));
}

/** Desregista registos antigos (ex.: /sw-push.js) que competiam pelo escopo "/". */
async function cleanupLegacyRegistrations() {
  const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
  await Promise.allSettled(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        return LEGACY_SW_URLS.some((legacy) => url.endsWith(legacy));
      })
      .map((r) => r.unregister())
  );
}

/** Limpa tudo o que o browser guardou do app e recarrega (saída de emergência). */
export async function forceAppUpdate() {
  try {
    await unregisterAll();
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.allSettled(names.map((n) => caches.delete(n)));
    }
  } catch {
    // ignorar
  }
  window.location.reload();
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";

  if (!import.meta.env.PROD || isPreviewContext() || killSwitch) {
    void unregisterAll();
    return;
  }

  window.addEventListener("load", () => {
    void (async () => {
      await cleanupLegacyRegistrations();

      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
      } catch (err) {
        console.warn("SW registration failed:", err);
        return;
      }

      // Quando o controlador muda (versão nova ativou com skipWaiting),
      // recarregar uma única vez para garantir HTML + chunks da mesma versão.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem(RELOAD_FLAG)) return;
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
      });

      // Se já existe uma versão em espera, ativá-la imediatamente.
      const promoteWaiting = () => {
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      };
      promoteWaiting();
      registration.addEventListener("updatefound", promoteWaiting);

      const check = () => registration.update().catch(() => {});
      const interval = setInterval(check, 30_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      window.addEventListener("online", check);
      window.addEventListener("unload", () => clearInterval(interval));
    })();
  });
}
