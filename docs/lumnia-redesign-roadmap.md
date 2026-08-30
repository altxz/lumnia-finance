# Lumnia UI/UX Redesign Roadmap

## Objetivo

Refatorar integralmente a UI e a UX do Lumnia com uma linguagem premium, calma, orientada a dados e inspirada nos princípios de design da Apple, sem copiar componentes específicos do iOS e sem comprometer a identidade própria do Lumnia ou a usabilidade no Android.

## Estado atual

- Branch de trabalho: `codex/android-capacitor`
- A branch `main` não deve ser alterada.
- Direção proposta: `Lumnia Calm Intelligence`.
- Direção `Lumnia Calm Intelligence` aprovada explicitamente em 24/08/2026.
- Etapa 0 concluída em 24/08/2026.
- Etapa 1 concluída em 24/08/2026.
- Etapa 2 aprovada visualmente pelo usuário em 25/08/2026.
- Etapa 3 concluída em 25/08/2026.
- Etapa 4 concluída e validada integralmente pelo usuário em 30/08/2026.
- Etapa 5: concluída e validada pelo usuário em 30/08/2026.
- Etapa 6: escopo de Analytics implementado; validação física no Galaxy S22 Ultra confirmada pelo usuário em 30/08/2026.
- Etapa 7: concluída em 30/08/2026. Todas as abas reais classificadas; corrigidos dois bugs que auditorias anteriores diziam ter resolvido mas não tinham (validação de senha atual, categorias reais em Automação).
- Etapas 8 e 9: pendentes, sem início.
- Última atualização de integridade financeira: 30/08/2026.
- Correção de manutenção de faturas: unificada em todas as rotas (Transações, Carteira, Resumo de cartões, Notificações), com conta e data efetiva sempre confirmadas. O usuário validou fisicamente no Galaxy S22 Ultra, incluindo o cenário de pagamento com data diferente do vencimento nos dois caminhos, e uma importação completa de dados. Ambos considerados concluídos em 30/08/2026.
- Recurso de chat de IA dentro do app (`chat-genius`) removido da interface em 30/08/2026, decisão do usuário: o secret de IA usado antes (`LOVABLE_API_KEY`) era provisionado automaticamente pela Lovable e não existe no projeto Supabase independente; manter o recurso ligado exigiria contratar um provedor de IA. O código e a função de servidor continuam no repositório para uma eventual reativação. A sugestão automática de categoria (`categorize-expense`) foi removida pelo mesmo motivo e não será retomada.
- MCP: decisão do usuário em 30/08/2026 de manter a integração só no Claude (Custom Connector, plano Pro), abandonando a integração com o ChatGPT. Conector configurado e testado com sucesso no Claude após corrigir duas causas raiz: (1) o site em produção da Vercel ainda apontava para o Supabase antigo — corrigido com a atualização das variáveis de ambiente e um novo deploy; (2) nenhuma delas era falta de URL de redirecionamento no Supabase (já estavam corretas).
- Próximo checkpoint: revisar e classificar as abas de Configurações (Etapa 7), depois avançar para Movimento e estados (Etapa 8) e auditoria final (Etapa 9). Publicar a conta do Google Play Console continua fora de escopo por decisão do usuário.
- Auditoria de 30/08/2026: confirmado que o projeto Supabase `ulszjqppxceqbeoyyqbb` ("Lumnia") é o atual. Publicadas e validadas ponta a ponta: `delete-account`, `generate-recurring`, `chat-genius` (corrigida e com segurança testada), `check-due-bills` (cria notificações reais no app; envio de push depende de `VAPID_PRIVATE_KEY`, também ausente). Publicada mas não funcional por falta de secret: `categorize-expense` (`LOVABLE_API_KEY`, ausente — recurso descontinuado, ver acima). `send-push` publicada, mas inoperante por falta de `VAPID_PRIVATE_KEY` — sem uso enquanto não houver decisão sobre notificações push. Build Android completo (commits `7328588`…`07f50a0`) instalado e validado no Galaxy S22 Ultra às 17:56 (ver `docs/ai-memory/03-entrega-android-e-validacao.md`).

## Regra de conclusão

Uma etapa só pode ser marcada como concluída quando:

1. Todo o escopo definido tiver sido implementado.
2. Light e dark tiverem sido verificados.
3. Estados de dados, carregamento, vazio e erro tiverem sido verificados quando aplicáveis.
4. A interface tiver sido validada no Galaxy S22 Ultra.
5. TypeScript, lint crítico, testes e build tiverem passado.
6. Evidências e pendências tiverem sido registradas neste documento.

Código alterado não equivale a etapa concluída.

## Matriz obrigatória

Cada página deve ser validada por:

- Tema: light e dark.
- Estado: dados, carregamento, vazio, erro e offline, quando aplicável.
- Tela: Galaxy S22 Ultra, celular estreito e desktop.
- Conteúdo: valores curtos, valores grandes e textos longos.
- Interação: toque, scroll, teclado, modal e retorno.
- Acessibilidade: contraste, área mínima de toque e rótulos.

## Etapas

### Etapa 0: inventário e especificação

- [x] Catalogar rotas e páginas.
- [x] Catalogar modais, drawers, menus e popovers.
- [x] Mapear componentes repetidos.
- [x] Mapear cores, gradientes, vidro, sombras e tipografia existentes.
- [x] Mapear estados de loading, vazio, erro e offline.
- [x] Separar problemas visuais de problemas de lógica.
- [x] Registrar baseline visual light e dark.

### Etapa 1: sistema visual

- [x] Definir tokens light e dark.
- [x] Definir cores semânticas.
- [x] Definir escala tipográfica Inter.
- [x] Definir espaçamentos, raios, bordas e sombras.
- [x] Restringir vidro à camada funcional.
- [x] Definir movimento e redução de movimento.
- [x] Criar componentes-base reutilizáveis.

### Etapa 2: protótipo vertical

- [x] Redesenhar cabeçalho.
- [x] Redesenhar Dashboard.
- [x] Redesenhar navegação inferior.
- [x] Criar cartão financeiro principal.
- [x] Criar resumo mensal.
- [x] Criar ações rápidas.
- [x] Criar gráfico principal.
- [x] Criar insights e atividade recente.
- [x] Validar visualmente loading, vazio e erro com cenários controlados no Galaxy S22 Ultra.
- [x] Validar o breakpoint desktop com sessão autenticada.
- [x] Obter aprovação visual antes de propagar o sistema.

### Etapa 3: transações e atividade

- [x] Lista, pesquisa e filtros.
- [x] Criação e edição.
- [x] Exclusão e confirmações.
- [x] Débito, crédito, receita e transferência.
- [x] Recorrência e parcelamento.
- [x] Importação e captura bancária.
- [x] Faturas e detalhes.
- [x] Correção de manutenção em 30/08/2026: pagamento de fatura unificado em todas as rotas; escolha explícita de conta e data; feed de transações alinhado à data efetiva reconhecida pelo motor financeiro. Após um caso real, a base confirmou o pagamento da fatura `2026-09` em `29/08`; a lista foi corrigida para construir também essa fatura em agosto, em vez de limitá-la ao vencimento de setembro. O modal foi adaptado para tela estreita, com opções de data empilhadas e conteúdo quebrável. TypeScript e 97 testes passaram; build web, sincronização Android e APK novo SHA-256 `0405CEE37462B642793C0A6A294CD77698C12AEE870694F96DC90927ACB77630` concluídos. O usuário validou fisicamente no Galaxy S22 Ultra a fatura com data diferente do vencimento nos dois caminhos de pagamento, confirmado em 30/08/2026. Lint crítico segue bloqueado apenas por dependência desnecessária preexistente em `src/hooks/useProjectedTotals.ts`.

### Etapa 4: planejamento

- [x] Orçamento. Implementação e validação concluídas.
- [x] Categorias e detalhes. Implementação e validação concluídas.
- [x] Projetos. Implementação e validação concluídas.
- [x] Metas: seção simulada removida de Analytics; recurso persistente futuro exige especificação própria.

### Etapa 5: patrimônio

- [x] Carteira e contas. A visão consolidada passou a separar contas líquidas de investimentos, trocar o rótulo financeiro impreciso de patrimônio líquido por total em ativos e usar composição comparável por tipo, sem alterar cálculos. Cards aceitam nomes e valores longos sem reticências.
- [x] Cartões e faturas. Cards, detalhe da fatura, resumo e lista foram adaptados para telas estreitas: valores e descrições quebram dentro do grid, os indicadores empilham quando necessário e o botão de pagamento mantém a leitura completa. O fluxo financeiro de pagamento permanece o mesmo e não foi alterado nesta etapa.
- [x] Investimentos e movimentações. A distribuição por tipo deixou de usar gráfico circular e passou a usar barras comparáveis com valor completo e percentual. A evolução é exibida somente quando há base temporal suficiente. Cards de aplicação, rendimentos, aportes e resgates receberam grid responsivo e quebra de conteúdo.
- [x] Ajuste de saldo. O modal mantém a transação de ajuste já auditável e agora explica a diferença registrada, protege textos longos, usa altura independente da viewport dinâmica do teclado e empilha ações em tela estreita.
- [x] Evolução patrimonial. A série usa exclusivamente snapshots persistidos de ativos e passivos, sem preencher meses ausentes nem misturar saldo atual com histórico. Há gráfico de linha único somente com pelo menos dois registros, métricas completas fora do gráfico e estados explícitos de carregamento, ausência de histórico e falha com nova tentativa.

### Etapa 6: Analytics

- [x] Fundação analítica e precisão dos dados. Validada fisicamente pelo usuário no Galaxy S22 Ultra em 30/08/2026.
- [x] Reestruturar hierarquia da página.
- [x] Exibir um gráfico principal por contexto.
- [x] Carregar gráficos secundários progressivamente.
- [x] Padronizar tooltips para toque.
- [x] Criar resumos textuais acessíveis.
- [x] Revisar comparações e percentuais enganosos.
- [x] Implementar carregamento progressivo, vazio e erro.

### Etapa 7: configurações e recursos secundários

- [x] Perfil. Funcional: foto, nome (atualiza também os metadados do cabeçalho), e-mail, carteira padrão.
- [x] IA. Removida da interface em 30/08/2026 por decisão do usuário (sem provedor de IA próprio configurado). Ver `chat-genius` na tabela de progresso.
- [x] Automação. Auditoria de 30/08/2026 encontrou que as regras de importação usavam uma lista de categorias genérica e fixa, sem relação com as categorias reais do usuário — mesmo problema já relatado antes e nunca de fato corrigido. Corrigido: agora usa as categorias reais (por nome). Removido o contador `applied_count`, que nunca era atualizado.
- [x] Notificações. Detecção bancária no Android funcional e validada. O card de push (fora do Android) aparentava funcionar mas dependia de `VAPID_PRIVATE_KEY`, ausente no projeto atual — escondido, com estado vazio explicando a limitação.
- [x] Segurança. Fluxo de importação de backup JSON completo, JSON legado e planilha Excel implementado em 26/08/2026, com seletor nativo Android. Em 27–29/08, a planilha original foi restaurada e auditada (665 lançamentos, 96 categorias, 2 contas, 2 cartões, 1 projeto, 23 orçamentos; 174 meses de fatura corrigidos). O usuário validou fisicamente uma importação completa pelo seletor Android em 30/08/2026. Auditoria de 30/08 também encontrou que o campo "senha atual" nunca era validado (mesmo problema já relatado antes e nunca corrigido) — corrigido com reautenticação via `signInWithPassword` antes de trocar a senha, e o mínimo de senha corrigido para 8 caracteres de fato (só o texto dizia isso).
- [x] Categorias. CRUD completo funcional: hierarquia, ícones, cores, exclusão com confirmação.
- [x] Módulos e Planos. Confirmado como órfãos: os arquivos `ModulesSection.tsx` e `PlansSection.tsx` não eram importados por nenhuma tela desde a reformulação anterior. Removidos do repositório em 30/08/2026, junto com `AiSection.tsx`.

### Registro de integridade financeira: restauração de dados

- [x] Conferir a planilha de exportação com a base restaurada, item a item.
- [x] Normalizar os meses de fatura de cartão do formato `MM/AAAA` para `AAAA-MM`.
- [x] Corrigir o pagamento de fatura que havia sido associado indevidamente ao cartão.
- [x] Garantir que o importador normalize os dois formatos ao importar JSON ou Excel.
- [x] Gerar, sincronizar, instalar e abrir o APK com a prevenção no Galaxy S22 Ultra.
- [x] Validar pelo seletor Android uma importação real. Confirmado pelo usuário em 30/08/2026.
- [x] Confirmar a integração MCP contra a mesma base do aplicativo. Decisão de 30/08/2026: a integração segue apenas via Claude (Custom Connector, plano Pro), não mais via ChatGPT. Conectado e testado com sucesso após corrigir o deploy da Vercel, que ainda apontava para o projeto Supabase antigo.

### Etapa 8: movimento e estados

- [x] Transições discretas. Já em uso amplo (78 arquivos com `transition-`/`animate-`).
- [x] Bottom sheets. Auditoria de 30/08 encontrou que o padrão `ResponsiveModal` (bottom sheet no celular, dialog no desktop) só era usado em 2 de 15 modais. Estendido com `className` e `ResponsiveModalDescription`, e uma prop `dismissible` para fluxos que não podem ser fechados sem confirmação (ex.: importação). Migrados os 12 modais restantes: Automação, Categorias (configurações e página), Projetos, Carteira, Ajuste de saldo, Investimentos, Fatura (detalhes e pagamento), confirmação rápida de pagamento, importação de backup. `ImportTransactionsModal` já implementava o padrão manualmente. Validado visualmente alternando o viewport com o mesmo modal aberto.
- [x] Feedback de toque. Já coberto por padrão no componente `Button` (`active:scale-[0.98]`).
- [x] Skeletons estruturais. Já usados em 14 páginas/componentes.
- [ ] Carregamento escalonado. Gap real: só existe uma animação de "bolinhas carregando"; não há um padrão de revelar seções progressivamente.
- [ ] Estado offline e retry. Gap real: o padrão existe (`StatePanel` com `tone="offline"`), mas só está ligado em uma página (Histórico).
- [x] `prefers-reduced-motion`. Já tratado em `index.css` e `App.css`.

### Etapa 9: auditoria final

- [ ] TypeScript.
- [ ] Lint crítico.
- [ ] Testes automatizados.
- [ ] Build web.
- [ ] Build Android.
- [ ] Galaxy S22 Ultra.
- [ ] Light e dark.
- [ ] Teclado, scroll e navegação.
- [ ] Acessibilidade.
- [ ] Performance.
- [ ] Relatório final e APK candidato.

## Decisões visuais propostas, ainda não aprovadas

- Canvas neutro e sólido.
- Cards de conteúdo sólidos ou tonais.
- Vidro apenas em navegação, cabeçalho flutuante, menus, popovers e modais.
- No máximo um elemento de destaque com gradiente por tela.
- Roxo para ação principal e seleção.
- Verde para estado positivo.
- Vermelho para despesa, erro ou risco.
- Inter como fonte da plataforma.
- Dashboard orientado a saldo, situação do mês, atenção necessária e atividade recente.
- Analytics com progressão de visão geral para detalhe.

## Registro de progresso

Atualizar esta seção ao iniciar e encerrar cada etapa.

| Etapa | Status | Evidência | Pendências |
|---|---|---|---|
| 0. Inventário | Concluída em 24/08/2026 | [`lumnia-redesign-inventory.md`](lumnia-redesign-inventory.md) e [`redesign-baseline`](redesign-baseline/) | Nenhuma |
| 1. Sistema visual | Concluída em 24/08/2026 | [`lumnia-design-system.md`](lumnia-design-system.md) e [`design-system-validation`](design-system-validation/) | Propagação visual ocorrerá nas Etapas 2 a 8 |
| 2. Protótipo vertical | Concluída e aprovada em 25/08/2026 | [`dashboard-validation`](dashboard-validation/) e [`dashboard-prototype-validation.md`](dashboard-prototype-validation.md) | Nenhuma |
| 3. Transações | Concluída em 25/08/2026; correção de manutenção validada fisicamente pelo usuário em 30/08/2026 | [`transactions-redesign-audit.md`](transactions-redesign-audit.md), [`transactions-validation`](transactions-validation/) e APK debug SHA-256 `0405CEE37462B642793C0A6A294CD77698C12AEE870694F96DC90927ACB77630`, instalado no Galaxy S22 Ultra em 30/08 às 11:33 sem exceção | Nenhuma |
| 4. Planejamento | Concluída e validada pelo usuário em 30/08/2026: entrada única, cards, detalhe e compatibilidade de rota | [`planning-redesign-audit.md`](planning-redesign-audit.md) e `lumnia-planning-entry.png` | Nenhuma |
| 5. Patrimônio | Concluída e validada pelo usuário em 30/08/2026 | TypeScript e 97 testes aprovados. Build web, sincronização Capacitor e APK debug reconstruído SHA-256 `9A85C354064E9CF7CD71662974CD5A5B1CC42940D63BDBBE8F70CBF83CCF1B72` concluídos. O APK contém o bundle `NetWorthChart-DwpOsr4k.js` com a nova evolução patrimonial, foi instalado e aberto no Galaxy S22 Ultra às 14:00 sem exceção fatal. | Nenhuma nesta etapa. |
| 6. Analytics | Concluída e validada fisicamente pelo usuário em 30/08/2026 | Modelo único de período, comparação real, previsão com base explícita, estados de erro e vazio, carregamento escalonado, remoção do treemap, gráfico principal de receitas, despesas e resultado, ranking de categorias, acompanhamento de orçamentos e cobertura de caixa derivada de movimentações. A auditoria de cálculo eliminou interpretação de sinal invertido e leitura de caixa persistido desatualizado. TypeScript, build web e 14 testes financeiros focados aprovados. [`financial-calculation-audit.md`](financial-calculation-audit.md) | Nenhuma |
| 7. Configurações | Concluída em 30/08/2026 | Todas as 5 abas reais classificadas e funcionais: Conta, Automação, Notificações, Categorias, Dados e segurança (`Módulos`, `Planos` e `IA` eram órfãos e foram removidos). Auditoria de 30/08 encontrou e corrigiu dois bugs reais que auditorias anteriores diziam ter corrigido mas não tinham: "senha atual" nunca era validada, e as regras de Automação usavam uma lista de categorias genérica em vez das categorias reais do usuário. Importação completa validada fisicamente pelo usuário. [`financial-calculation-audit.md`](financial-calculation-audit.md) | Nenhuma |
| 8. Movimento e estados | Em andamento em 30/08/2026 | 5 de 7 itens já estavam prontos ou foram corrigidos: transições, feedback de toque, skeletons e `prefers-reduced-motion` já cobertos; bottom sheets migrados para os 12 modais restantes (commit `ffb6b52`) | Carregamento escalonado (só existe uma animação de loading, sem padrão real) e estado offline+retry (só implementado no Histórico, falta espalhar para as outras páginas). |
| 9. Auditoria final | Pendente | | |
| MCP | Conectado e validado no Claude em 30/08/2026 | Decisão do usuário: manter a integração só no Claude (Custom Connector, plano Pro), abandonando o ChatGPT. Função `lumnia-mcp` v2 publicada no projeto Supabase, bundle portátil validado sem caminhos locais, 97 testes automatizados aprovados. A causa raiz do erro inicial de conexão ("unauthorized request origin") não foi falta de redirect URL (já estavam corretas) nem problema no servidor MCP (o `project_id` já estava correto) — era o site em produção da Vercel, que hospeda a tela de consentimento OAuth, ainda compilado contra o Supabase antigo. Corrigido com a atualização das variáveis de ambiente na Vercel e um novo deploy; conector testado com sucesso em seguida. | Nenhuma. O antigo conector MCP do ChatGPT pode ser desconectado manualmente pelo usuário nas configurações do ChatGPT, se desejado (não é urgente). |
| Migração Supabase (projeto novo) | Concluída em 30/08/2026 | Confirmado com o usuário: `ulszjqppxceqbeoyyqbb` ("Lumnia") é o projeto Supabase correto e atual, com os 666 lançamentos, 96 categorias, 2 carteiras, 2 cartões, 23 orçamentos e 1 projeto reconciliados. `supabase/config.toml` e o bundle de `lumnia-mcp` já apontavam para ele. Publicadas e validadas de ponta a ponta: `delete-account` (teste com usuário descartável: transação e usuário removidos, confirmado por SQL), `generate-recurring`, `chat-genius` (corrigida e testada) e `check-due-bills` (criou uma notificação real e válida no teste). O bundle web publicado na Vercel foi corrigido e um novo deploy confirmado sem nenhuma referência ao projeto antigo (`nvskvrgsfzaynotdgzoy`). | `send-push` e o envio de push de `check-due-bills` continuam inoperantes por falta do secret `VAPID_PRIVATE_KEY` — sem uso enquanto não houver decisão sobre reativar notificações push. `categorize-expense` está publicada mas foi descontinuada por decisão do usuário (ver `chat-genius`), não precisa de correção. |
| Segurança: `chat-genius` sem autenticação | Corrigido e publicado em 30/08/2026 | Auditoria de segurança encontrou uma falha crítica: `chat-genius` rodava com `verify_jwt = false` e também não validava a sessão internamente — confiava no `user_id` enviado no corpo da requisição por um cliente `service_role` (que ignora RLS). Qualquer pessoa com a URL da função e um UUID de usuário podia ler, criar ou apagar transações de qualquer conta, sem login. Corrigido para extrair e validar o usuário a partir do cabeçalho `Authorization`, no mesmo padrão já usado por `delete-account`. Publicada via `supabase functions deploy` local (CLI instalada via winget + npm, pois o ambiente não tinha Node.js). Os 7 arquivos publicados (`index.ts` + 6 em `_shared/`) foram baixados de volta e comparados byte a byte com o código local: idênticos. Testado sem cabeçalho `Authorization`: rejeitado imediatamente com "Sessão não encontrada", sem tocar no banco. | Teste completo com sessão válida (confirmando que os dados retornados pertencem ao usuário autenticado, nunca a outro) só é possível depois de configurar um secret de IA funcional — hoje qualquer chamada autenticada esbarra primeiro no erro de `LOVABLE_API_KEY` ausente. |
