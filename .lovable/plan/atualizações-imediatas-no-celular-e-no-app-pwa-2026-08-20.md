# Atualizações imediatas no celular e no app (PWA)

## Diagnóstico (verificado no código)

Há **dois service workers a competir pelo mesmo escopo `/`**:

1. O service worker do PWA gerado pelo `vite-plugin-pwa` (`VitePWA` em `vite.config.ts`, com precache de todos os ficheiros da build).
2. `public/sw-push.js`, registado manualmente em `src/hooks/usePushNotifications.ts` (`navigator.serviceWorker.register('/sw-push.js', { scope: '/' })`).

Como o escopo é o mesmo, cada registo tenta substituir o outro. O resultado é um controlador instável: às vezes o app é servido a partir do precache antigo do Workbox, às vezes fica sem o SW de push. Ficheiros antigos permanecem no CacheStorage e o utilizador continua a ver uma versão desatualizada mesmo depois de recarregar.

Segundo problema, em `src/main.tsx`: o listener de atualização está no objeto errado —

```text
registration.addEventListener("controllerchange", ...)   // nunca dispara
navigator.serviceWorker.addEventListener("controllerchange", ...)  // correto
```

Ou seja, mesmo quando uma versão nova ativa (`skipWaiting` está ligado), a página **não** recarrega; o utilizador continua com o JS antigo em memória enquanto o novo já está no cache — a mistura clássica de versões (e a origem provável dos erros de "chunk" já vistos antes).

Terceiro: o cache persistido do React Query (`localStorage`, `buster: "v1"`) nunca muda entre deploys, então dados antigos de formatos antigos continuam a ser hidratados.

Nota sobre o ChatGPT: o conector MCP corre na Edge Function (`lumnia-mcp`), que é publicada de imediato e não passa por este cache. Se ele continuar a ver ferramentas antigas, é cache do lado do ChatGPT — resolve-se reconectando o conector. Vou incluir um endpoint/versão visível para confirmar qual versão está no ar.

## Solução

### 1. Um único service worker
- Mudar o `VitePWA` para a estratégia `injectManifest` com um SW próprio (`src/sw.ts`) que junta o precache do Workbox **e** os handlers de `push`/`notificationclick` hoje em `public/sw-push.js`.
- `usePushNotifications` deixa de registar `/sw-push.js` e passa a usar o registo único (`navigator.serviceWorker.ready`) para subscrever o push.
- Remover `public/sw-push.js` e limpar caches antigos na ativação (`cleanupOutdatedCaches` + remoção de caches com nomes anteriores).

### 2. `index.html` nunca em cache
- `navigateFallback` para `index.html` com revisão por build e regra de runtime `NetworkFirst` para navegações, com fallback ao cache só offline. Assim o HTML que aponta para os hashes novos é sempre buscado à rede quando há ligação.

### 3. Fluxo de atualização automático e correto
- Substituir o bloco de `main.tsx` pelo registo do `virtual:pwa-register` com `onNeedRefresh` → ativa a nova versão e recarrega uma vez (com guarda para não entrar em loop).
- Corrigir o listener para `navigator.serviceWorker.addEventListener("controllerchange", ...)`.
- Manter a verificação periódica (30s) e ao voltar a ficar visível, agora sobre o registo correto.

### 4. Versão da build visível e cache de dados versionado
- Injetar a versão/hash da build (`define` no Vite) e usá-la como `buster` do cache persistido do React Query — cada deploy limpa automaticamente os dados guardados no `localStorage`.
- Mostrar a versão nas Configurações, com botão "Forçar atualização" que desregista o SW, limpa CacheStorage e o cache do React Query e recarrega. Serve como saída de emergência para dispositivos presos numa versão antiga.

### 5. Migração dos dispositivos já presos
- No arranque, se existir um registo antigo de `/sw-push.js`, desregistá-lo e limpar as caches órfãs antes de registar o SW novo (código de transição, mantido por alguns deploys).

## Detalhes técnicos
- `vite.config.ts`: `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`, `injectRegister: null` (registo feito por nós), mantendo `maximumFileSizeToCacheInBytes: 5MB` e a regra `NetworkOnly` para `*.supabase.co/(rest|auth|realtime|functions)`.
- `src/sw.ts`: `precacheAndRoute(self.__WB_MANIFEST)`, `clientsClaim()`, `skipWaiting`, `NavigationRoute` com `NetworkFirst`, e os listeners de push.
- Nada muda no banco de dados nem nas Edge Functions.

## Como validar
- Build de produção, confirmar um único SW ativo e que o `index.html` responde sem cache.
- Publicar, abrir no celular, publicar de novo e confirmar que o app recarrega sozinho para a versão nova em segundos.
