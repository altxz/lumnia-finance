import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";

// Registo único e guardado do service worker (não corre em dev/preview).
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
