# Atualização definitiva: acabar com a versão antiga presa no celular e no app

## O que eu confirmei agora

- A versão publicada na web **já contém** o código novo: o `version.json` publicado é o desta build e o pacote publicado inclui a lógica nova de categorias (o alias legado `salary` aparece no chunk do seletor de categorias) e a verificação de versão (`version.json` no chunk principal).
- Os cabeçalhos do servidor estão corretos: `index.html` e `/sw.js` vão com `no-cache`, `version.json` com `no-store`.

Conclusão: o problema não é o servidor nem "cookies". O que está preso é o **service worker antigo** dentro do teu celular/app. Ele guardou o `index.html` antigo em cache e continua a servi-lo, logo o telefone carrega os ficheiros JavaScript antigos. Como o código que corre nesse aparelho é antigo, nada do que criámos depois existe lá: nem as categorias corrigidas, nem o aviso "Nova versão disponível", nem o botão "Forçar atualização" em Configurações → Segurança. É exatamente o sintoma que descreves.

## A solução definitiva

Deixar de servir o HTML do app a partir de cache do service worker. Assim, qualquer aparelho passa a receber sempre a página mais recente da rede (o servidor já responde `no-cache`), e a atualização deixa de depender do que o browser guardou.

Três camadas, para que nunca volte a acontecer:

### 1. Release de "kill switch" no caminho do service worker atual
Substituir `/sw.js` por um service worker que apenas se autodestrói: apaga as caches do próprio app, obriga as janelas abertas a recarregar e desregista-se. Aparelhos presos numa versão antiga saem do estado preso na primeira vez que abrirem o app. Também cobrimos `/service-worker.js` e mantemos o `/sw-push.js` que já é kill switch.

### 2. Guarda de arranque dentro do `index.html`
Um script pequeno e inline no `index.html` (que vem sempre da rede, sem cache) que corre antes do app:
- desregista qualquer service worker que ainda esteja a controlar o app, exceto o de notificações;
- apaga as caches do app que restarem;
- compara o `buildId` do `version.json` com o da página carregada e, se forem diferentes, faz um recarregamento forçado uma única vez (com marca temporal na URL, ignorando cache do browser).

Como isto vive no HTML e não no pacote JavaScript, funciona mesmo que o aparelho ainda tenha código antigo — é o "passar por cima" que pediste.

### 3. Manter as notificações push, sem cache de páginas
As notificações precisam de um service worker. Passa a existir um service worker exclusivo de push (`/push-sw.js`), sem qualquer interceção de pedidos e sem cache — só recebe notificações. Deixa de haver cache do shell do app, mantendo o push a funcionar. O app continua instalável no ecrã inicial (isso vem do manifesto, não do service worker).

Efeito colateral aceite: deixa de haver modo offline. O app já não funcionava offline de forma útil (todos os dados vêm do servidor).

### 4. Botão de atualização sempre acessível
Além do cartão em Configurações → Segurança, criar um endereço direto `/atualizar` que limpa tudo e recarrega. Se um aparelho voltar a ficar preso, abrir `lumnia-app.lovable.app/atualizar` resolve sem precisar de encontrar um botão dentro do app antigo.

## Detalhes técnicos

- `vite.config.ts`: remover o `VitePWA` do fluxo de service worker de cache (mantendo apenas a geração do manifesto e o carimbo `version.json`), para não voltar a gerar precache de `index.html` com `navigateFallback`.
- `public/sw.js`: passa a kill switch (apaga apenas as caches Workbox do próprio escopo, `unregister()` em `finally`), mantendo o mesmo caminho para os aparelhos antigos o receberem. Igual em `public/service-worker.js`.
- `public/push-sw.js`: novo worker apenas com os handlers de `push` e `notificationclick` (reaproveita `public/push-handlers.js`), sem `fetch`.
- `src/lib/registerServiceWorker.ts`: deixa de registar shell; passa a registar `/push-sw.js` só em produção e fora de preview/iframe, e continua a desregistar os caminhos antigos (`/sw.js`, `/sw-push.js`, `/service-worker.js`). `forceAppUpdate()` mantém-se e passa a preservar o worker de push.
- `src/hooks/usePushNotifications.ts`: apontar a subscrição ao registo de `/push-sw.js`.
- `index.html`: script inline de guarda de arranque (sem módulos, sem dependências).
- `src/App.tsx`: rota `/atualizar` com página simples de limpeza e recarregamento.
- `src/hooks/useAppVersionCheck.ts` e `UpdateBanner`: continuam a funcionar como estão, agora como aviso normal e não como único mecanismo.

## Depois de aprovar

É obrigatório publicar. A partir dessa publicação, cada aparelho recebe o kill switch na primeira abertura, recarrega uma vez e fica atualizado — e das próximas vezes a atualização é imediata, sem cache pelo meio. Se um aparelho estiver mesmo muito preso, abrir `/atualizar` força a limpeza.
