import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
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
    ({
      // Carimbo de versão publicado com a build, para o app detetar deploys novos.
      name: "lumnia-version-stamp",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ buildId }),
        });
      },
    } as Plugin),
    // NOTA: o vite-plugin-pwa foi removido de propósito.
    // O service worker de cache (/sw.js) guardava o index.html e deixava
    // dispositivos presos em versões antigas. Agora o HTML vem sempre da rede,
    // o manifesto é estático (public/manifest.webmanifest) e o único service
    // worker é o de notificações push (public/push-sw.js), sem cache.

  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});

