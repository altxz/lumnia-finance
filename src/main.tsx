import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Prevent service worker from interfering in preview/iframe contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
} else {
  // In production: listen for SW updates and reload automatically
  navigator.serviceWorker?.ready.then((registration) => {
    registration.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    // Check for SW updates every 30 seconds so mobile/PWA picks up new versions fast
    const checkInterval = setInterval(() => {
      registration.update().catch(() => {});
    }, 30_000);

    // Also check immediately when the tab/app becomes visible again
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        registration.update().catch(() => {});
      }
    });

    // Cleanup on page unload
    window.addEventListener("unload", () => clearInterval(checkInterval));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
