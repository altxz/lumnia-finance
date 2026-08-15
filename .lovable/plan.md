# Cache de dados: parar de recarregar tudo o tempo todo

## Situação atual
- O React Query já existe, mas com `staleTime` de apenas 30s e cache só em memória: ao recarregar a página (ou reabrir o PWA) tudo é buscado de novo e o utilizador vê skeletons.
- Vários ecrãs (Dashboard, CategoriesPage, TransactionFeed, WalletPage, CreditCardSummary, etc.) fazem `supabase.from(...)` direto em `useState`/`useEffect`, fora do cache — logo repetem as mesmas queries em cada navegação.
- O Realtime já invalida as chaves certas, então aumentar o tempo de cache é seguro: quando algo muda no banco, o cache é atualizado.

## O que fazer

### 1. Cache persistente (o ganho maior)
Adicionar `@tanstack/query-sync-storage-persister` + `persistQueryClient` gravando no `localStorage`:
- Ao abrir o app, os dados do último uso aparecem instantaneamente (sem skeleton) e são revalidados em segundo plano.
- Chave versionada (`buster`) para invalidar tudo em novos deploys, `maxAge` de 24h.
- Só persistir queries de dados financeiros (whitelist por queryKey), nunca sessão/tokens.

### 2. Afinar as políticas de cache em `src/App.tsx`
- `staleTime` de 5 min para dados financeiros, `gcTime` 30 min.
- `refetchOnWindowFocus: false` (o `useRealtimeSync` já força atualização ao voltar ao app).
- `placeholderData: keepPreviousData` nas queries com mês — trocar de mês passa a manter o gráfico anterior visível em vez de piscar.

### 3. Migrar as buscas soltas para React Query
Converter os `useEffect` + `supabase.from` em `useQuery` com chaves estáveis, começando pelos mais pesados:
- `Dashboard.tsx` (categorias, orçamentos, mês anterior)
- `CategoriesPage.tsx` / `CategoryDetailsPage.tsx`
- `TransactionFeed.tsx`, `WalletPage.tsx`, `CreditCardSummary.tsx`, `DashboardScoreCarousel.tsx`
Assim, navegar entre páginas reutiliza dados já carregados (categorias e carteiras deixam de ser buscadas dezenas de vezes).

### 4. Dados quase estáticos com cache longo
`categories`, `wallets`, `credit_cards`, `user_settings`: `staleTime` de 30 min (invalidados pelo Realtime quando editados).

### 5. Prefetch do mês vizinho
Ao ver um mês, pré-carregar mês anterior/seguinte em background — a navegação temporal fica instantânea.

## Nota técnica
Nada de novo no banco de dados; é tudo camada de cache no cliente. O Realtime existente continua a ser a fonte de verdade para invalidar, então não há risco de mostrar saldo desatualizado depois de uma edição.

## Sugestão de execução
Fase 1 (itens 1, 2 e 4) já resolve a maior parte da sensação de "carregar tudo sempre". Fase 2 (itens 3 e 5) é a migração das buscas soltas, mais extensa.
