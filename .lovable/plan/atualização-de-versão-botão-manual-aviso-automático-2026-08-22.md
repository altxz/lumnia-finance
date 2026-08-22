# Atualização de versão: botão manual + aviso automático

## Situação atual (verificada no código)

O botão "Forçar atualização" **já existe** em Configurações → Segurança, no cartão "Versão do app" (`src/components/settings/SecuritySection.tsx`). Ele mostra a versão instalada, limpa o cache persistido, desregista o service worker, apaga o CacheStorage e recarrega.

O que falta é a parte 2: hoje não há nenhuma forma de o app saber que existe um deploy mais recente enquanto está aberto. O único mecanismo é o service worker, que só funciona no site publicado e falha silenciosamente quando fica preso numa versão antiga.

## O que vou construir

### 1. Um "carimbo" de versão publicado junto com a build
Cada build passa a gerar um ficheiro leve `version.json` na raiz do site, contendo o identificador da build (o mesmo `BUILD_ID` já usado no cache de dados). Esse ficheiro nunca é guardado em cache — é sempre buscado à rede.

### 2. Deteção automática de nova versão
Um verificador global compara a versão que está a correr no browser com a do servidor:
- ao abrir o app;
- a cada 60 segundos;
- sempre que o app volta a ficar visível (voltar ao separador / reabrir o app no celular);
- quando a ligação volta.

Se o identificador do servidor for diferente do que está em memória, há versão nova.

### 3. Banner "Atualizar agora"
Quando é detetada uma versão nova, aparece um banner discreto (fixo em baixo no celular, canto inferior no computador, respeitando a área segura e o estilo minimalista com `rounded-2xl`):

```text
Nova versão disponível        [ Agora não ]  [ Atualizar agora ]
```

- "Atualizar agora" executa exatamente a mesma rotina do botão das Configurações (limpa cache, ativa o service worker novo e recarrega).
- "Agora não" esconde o banner nesta sessão; volta a aparecer no próximo arranque ou se surgir outra versão mais recente.
- O banner também aparece quando o service worker sinaliza uma versão em espera, cobrindo o caso do app instalado (PWA).

### 4. Recarga automática deixa de ser silenciosa
Hoje o app recarrega sozinho quando o service worker troca de versão — isso pode interromper um formulário a meio. Passa a mostrar o banner e a decisão fica com o utilizador, exceto quando não há nada em edição no arranque.

## Detalhes técnicos

- Plugin Vite pequeno (em `vite.config.ts`) que escreve `dist/version.json` com `{ buildId: __BUILD_ID__ }`; em desenvolvimento o verificador fica inativo.
- Regra `NetworkOnly` no Workbox para `/version.json` e `globIgnores` para não o precachear.
- Novo `src/hooks/useAppVersionCheck.ts`: faz `fetch('/version.json', { cache: 'no-store' })`, compara com `BUILD_ID` de `src/lib/queryClient.ts`, expõe `{ updateAvailable, applyUpdate, dismiss }`; ignora falhas de rede em silêncio.
- Novo `src/components/UpdateBanner.tsx`, montado em `src/components/AuthenticatedExtras.tsx` (fica em todas as telas autenticadas). Reutiliza `forceAppUpdate` de `src/lib/registerServiceWorker.ts` e `clearPersistedCache`.
- `src/lib/registerServiceWorker.ts`: expõe um callback de "versão em espera" em vez de recarregar de imediato; mantém a verificação periódica e o `?sw=off`.
- Nenhuma alteração no banco de dados nem nas Edge Functions.

## Como validar

- Build de produção local: confirmar que `version.json` existe e responde sem cache.
- Simular deploy novo (alterar o identificador servido) e confirmar que o banner aparece em até 60 s e que "Atualizar agora" carrega a versão nova.
- Confirmar que o botão das Configurações continua a funcionar e mostra o identificador da build.
