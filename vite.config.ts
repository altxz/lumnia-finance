import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildId =
    mode === "development" ? "dev" : new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

  return {
  define: {
    // Identificador único desta build — usado para versionar o cache de dados
    // no localStorage e para mostrar a versão nas Configurações.
    __BUILD_ID__: JSON.stringify(buildId),
  },


  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-recharts': ['recharts'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-dropdown-menu',
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    mcpPlugin({ functionName: "lumnia-mcp" }),
    mode === "development" && componentTagger(),
    {
      // Carimbo de versão publicado com a build, para o app detetar deploys novos.
      name: "lumnia-version-stamp",
      apply: "build" as const,
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ buildId }),
        });
      },
    },
    VitePWA({

      registerType: "autoUpdate",
      // O registo é feito por src/lib/registerServiceWorker.ts (guardado para
      // dev/preview). O plugin não deve injetar o seu próprio script.
      injectRegister: null,
      filename: "sw.js",
      devOptions: {
        enabled: false,
      },
      workbox: {
        // Handlers de Web Push dentro do MESMO service worker (antes havia
        // um /sw-push.js a competir pelo escopo "/").
        importScripts: ["/push-handlers.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/\.lovable\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Nunca precachear o kill switch antigo nem o HTML como asset estático.
        globIgnores: ["**/sw-push.js", "**/push-handlers.js"],
        runtimeCaching: [
          {
            // Rotas internas da Lovable (consentimento OAuth do conector MCP)
            // nunca podem ser servidas de cache.
            urlPattern: /\/\.lovable\//,
            handler: 'NetworkOnly',
          },
          {
            // NUNCA fazer cache de chamadas à API (REST/Auth/Realtime/Functions)
            // Isso evita ver dados desatualizados após pagar fatura, editar despesa etc.
            urlPattern: /^https:\/\/.*\.supabase\.co\/(rest|auth|realtime|functions)\/.*/,
            handler: 'NetworkOnly',
          },

          {
            // HTML sempre da rede quando há ligação (cache só como fallback offline).
            urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10 },
            },
          },

          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|otf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: "Lumnia",
        short_name: "Lumnia",
        description: "Gerencie receitas e despesas com IA",
        theme_color: "#5447BC",
        background_color: "#5447BC",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
