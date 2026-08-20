import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Cache de dados da plataforma.
 *
 * - Cache em memória generoso (5 min fresco / 30 min mantido).
 * - Cache persistido no localStorage: ao reabrir o app os dados do último
 *   uso aparecem instantaneamente e são revalidados em background.
 * - O `useRealtimeSync` continua a ser a fonte de verdade: qualquer mudança
 *   no banco invalida as chaves e atualiza o cache.
 */

// Dados quase estáticos — podem ficar frescos por muito mais tempo.
export const STATIC_STALE_TIME = 1000 * 60 * 30; // 30 min
export const FINANCIAL_STALE_TIME = 1000 * 60 * 5; // 5 min

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FINANCIAL_STALE_TIME,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false, // useRealtimeSync já revalida ao voltar ao app
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

/** Chaves cujos dados podem ser gravados no localStorage. */
const PERSISTABLE_KEYS = new Set([
  "projected-totals",
  "expenses",
  "analytics",
  "analytics-data",
  "budget-data",
  "budgets",
  "wallets",
  "credit-cards",
  "categories",
  "debts",
  "projects",
  "net-worth",
  "financial-score",
  "user-settings",
  "dashboard-extra",
  "category-details",
  "exchange-rates",
]);

export const CACHE_STORAGE_KEY = "lumnia-query-cache";
// O buster é o id da build: cada deploy invalida automaticamente o cache
// persistido, evitando dados em formato antigo depois de uma atualização.
export const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const CACHE_BUSTER = `v2-${BUILD_ID}`;




export const persister =
  typeof window !== "undefined"
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: CACHE_STORAGE_KEY,
        throttleTime: 1000,
      })
    : undefined;

export const persistOptions = {
  persister: persister!,
  maxAge: 1000 * 60 * 60 * 24, // 24 h
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) => {
      if (query.state.status !== "success") return false;
      const root = query.queryKey?.[0];
      return typeof root === "string" && PERSISTABLE_KEYS.has(root);
    },
  },
};

/** Limpa o cache persistido (usado no logout para não vazar dados entre contas). */
export function clearPersistedCache() {
  try {
    window.localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // localStorage indisponível — ignorar
  }
}
