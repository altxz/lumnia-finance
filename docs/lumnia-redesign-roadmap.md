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
- Etapa 6: escopo de Analytics implementado e pendente de validação física no Galaxy S22 Ultra.
- Etapa 7: diagnóstico das configurações iniciado em 26/08/2026.
- Última atualização de integridade financeira: 30/08/2026.
- Correção de manutenção de faturas em validação: as rotas de Transações, Carteira, Resumo de cartões e Notificações passaram a compartilhar um único fluxo de pagamento, com conta e data explicitamente confirmadas. A linha da fatura usa a data efetiva do pagamento, a mesma fonte de verdade do fluxo de caixa. Em 30/08, o filtro da lista foi corrigido para incluir faturas pagas dentro do mês visualizado, mesmo quando o vencimento fica em outro mês. O modal também passou a empilhar as opções de data em tela estreita e a permitir quebra de texto sem sobreposição. APK instalado e aberto sem exceção no Galaxy S22 Ultra às 11:33; falta a validação visual manual da fatura de setembro em agosto.
- Próximo checkpoint: validar no Galaxy S22 Ultra um pagamento de fatura com data diferente do vencimento, nos dois caminhos de pagamento, sem alterar a base reconciliada sem consentimento explícito. Depois, validar uma importação completa em ambiente seguro, reconectar o cliente MCP no ChatGPT (novo login OAuth) e concluir a validação física de Analytics.
- Auditoria de 30/08/2026: confirmado que o projeto Supabase `ulszjqppxceqbeoyyqbb` ("Lumnia") é o atual; publicadas 5 das 6 funções de servidor que faltavam (`delete-account` e `generate-recurring` validadas ponta a ponta; `send-push`/`check-due-bills` publicadas, validação pendente; `categorize-expense` publicada mas não funcional por falta do secret `LOVABLE_API_KEY`). Encontrada e corrigida no código local uma falha crítica de segurança em `chat-genius` (sem autenticação, ainda não publicada). Ver detalhes na tabela de progresso.

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
- [~] Correção de manutenção em 30/08/2026: pagamento de fatura unificado em todas as rotas; escolha explícita de conta e data; feed de transações alinhado à data efetiva reconhecida pelo motor financeiro. Após um caso real, a base confirmou o pagamento da fatura `2026-09` em `29/08`; a lista foi corrigida para construir também essa fatura em agosto, em vez de limitá-la ao vencimento de setembro. O modal foi adaptado para tela estreita, com opções de data empilhadas e conteúdo quebrável. TypeScript e 97 testes passaram; build web, sincronização Android e APK novo SHA-256 `0405CEE37462B642793C0A6A294CD77698C12AEE870694F96DC90927ACB77630` concluídos. O APK foi instalado e aberto sem exceções no Galaxy S22 Ultra às 11:33. Lint crítico segue bloqueado apenas por dependência desnecessária preexistente em `src/hooks/useProjectedTotals.ts`. Falta validar visualmente a fatura de setembro sob 29/08 na página de transações.

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

- [~] Fundação analítica e precisão dos dados. Implementação em validação.
- [x] Reestruturar hierarquia da página.
- [x] Exibir um gráfico principal por contexto.
- [x] Carregar gráficos secundários progressivamente.
- [x] Padronizar tooltips para toque.
- [x] Criar resumos textuais acessíveis.
- [x] Revisar comparações e percentuais enganosos.
- [x] Implementar carregamento progressivo, vazio e erro.

### Etapa 7: configurações e recursos secundários

- [ ] Perfil.
- [ ] IA.
- [ ] Automação.
- [ ] Notificações.
- [~] Segurança. Fluxo de importação de backup JSON completo, JSON legado e planilha Excel implementado em 26/08/2026. O seletor HTML do WebView descartava a seleção ao retornar do aplicativo Documentos do Android. O teste do seletor externo confirmou que o retorno de atividade é consumido pela ponte nativa já existente. Em 26/08/2026 foi criado um seletor nativo próprio do Lumnia, registrado no mecanismo de retorno compatível com o aplicativo, com leitura direta do arquivo e progresso por etapa. Em 27/08/2026, a planilha original foi restaurada diretamente no novo Supabase após o seletor Android falhar: 665 lançamentos, 96 categorias, 2 contas, 2 cartões, 1 projeto e 23 orçamentos. A quantidade e as somas por tipo da planilha coincidiram com o banco. A aba Dívidas contém somente o nome da pessoa, sem valores ou saldo, portanto não foi restaurada para não criar informação financeira incorreta. Em 29/08, a auditoria da mesma planilha corrigiu 174 meses de fatura no formato incompatível e removeu o vínculo indevido do pagamento da fatura Nubank de R$ 1.856,32. Após a correção, as 174 compras de cartão, 28 faturas e R$ 51.061,84 coincidem com o arquivo de origem. O importador passou a normalizar MM/AAAA para AAAA-MM; o APK foi gerado, instalado e aberto sem exceções no Galaxy S22 Ultra. Falta validar uma importação completa pelo seletor Android sem alterar a base já reconciliada.
- [ ] Categorias.
- [ ] Módulos.
- [ ] Planos.
- [ ] Classificar cada item como funcional, incompleto, futuro ou removível.

### Registro de integridade financeira: restauração de dados

- [x] Conferir a planilha de exportação com a base restaurada, item a item.
- [x] Normalizar os meses de fatura de cartão do formato `MM/AAAA` para `AAAA-MM`.
- [x] Corrigir o pagamento de fatura que havia sido associado indevidamente ao cartão.
- [x] Garantir que o importador normalize os dois formatos ao importar JSON ou Excel.
- [x] Gerar, sincronizar, instalar e abrir o APK com a prevenção no Galaxy S22 Ultra.
- [ ] Validar pelo seletor Android uma importação real, com prévia, progresso, persistência e totais agregados, usando uma base descartável ou cópia de segurança para não modificar os dados reconciliados.
- [ ] Reconectar o cliente MCP privado ao projeto Supabase atual e confirmar que ele retorna os mesmos identificadores e dados que o aplicativo.

### Etapa 8: movimento e estados

- [ ] Transições discretas.
- [ ] Bottom sheets.
- [ ] Feedback de toque.
- [ ] Skeletons estruturais.
- [ ] Carregamento escalonado.
- [ ] Estado offline e retry.
- [ ] `prefers-reduced-motion`.

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
| 3. Transações | Concluída em 25/08/2026, com correção de manutenção em validação em 30/08/2026 | [`transactions-redesign-audit.md`](transactions-redesign-audit.md), [`transactions-validation`](transactions-validation/) e APK debug SHA-256 `0405CEE37462B642793C0A6A294CD77698C12AEE870694F96DC90927ACB77630`, instalado no Galaxy S22 Ultra em 30/08 às 11:33 sem exceção | Validar visualmente a fatura de setembro no dia 29/08 e os dois caminhos de pagamento |
| 4. Planejamento | Concluída e validada pelo usuário em 30/08/2026: entrada única, cards, detalhe e compatibilidade de rota | [`planning-redesign-audit.md`](planning-redesign-audit.md) e `lumnia-planning-entry.png` | Nenhuma |
| 5. Patrimônio | Concluída e validada pelo usuário em 30/08/2026 | TypeScript e 97 testes aprovados. Build web, sincronização Capacitor e APK debug reconstruído SHA-256 `9A85C354064E9CF7CD71662974CD5A5B1CC42940D63BDBBE8F70CBF83CCF1B72` concluídos. O APK contém o bundle `NetWorthChart-DwpOsr4k.js` com a nova evolução patrimonial, foi instalado e aberto no Galaxy S22 Ultra às 14:00 sem exceção fatal. | Nenhuma nesta etapa. |
| 6. Analytics | Fundação, visão geral, categorias e previsão em validação em 26/08/2026 | Modelo único de período, comparação real, previsão com base explícita, estados de erro e vazio, carregamento escalonado, remoção do treemap, gráfico principal de receitas, despesas e resultado, ranking de categorias, acompanhamento de orçamentos e cobertura de caixa derivada de movimentações. A auditoria de cálculo eliminou interpretação de sinal invertido e leitura de caixa persistido desatualizado. TypeScript, build web e 14 testes financeiros focados aprovados. APK instalado e aberto sem exceções no Galaxy S22 Ultra. A ausência do lançamento de 24/08 foi confirmada como esperada após exclusão pelo usuário. [`financial-calculation-audit.md`](financial-calculation-audit.md) | Publicar as funções de servidor e concluir a validação visual da etapa |
| 7. Configurações | Diagnóstico iniciado em 26/08/2026 | Inventário das abas Perfil, Automação, Notificações e Categorias iniciado. Em Segurança, importador com pré-validação para backup JSON completo, JSON legado de transações e planilha Excel foi implementado. O seletor de arquivos foi adaptado para toque direto no Android e a interface mostra progresso de leitura e de gravação. A foto de perfil é persistida imediatamente após o envio. Em 29/08, a auditoria da planilha confirmou e corrigiu 174 meses de fatura, uma associação indevida de pagamento e a normalização preventiva no importador. O APK com a correção foi instalado e aberto sem exceções no Galaxy S22 Ultra. [`financial-calculation-audit.md`](financial-calculation-audit.md) | Validar uma importação completa em base segura pelo Galaxy S22 Ultra e finalizar a classificação funcional, incompleta, futura ou removível das abas. |
| 8. Movimento e estados | Pendente | | |
| 9. Auditoria final | Pendente | | |
| MCP privado | Função publicada, conexão cliente pendente | Função `lumnia-mcp` v2 publicada no projeto Supabase, bundle portátil validado sem caminhos locais, 97 testes automatizados aprovados, metadados do recurso OAuth retornam HTTP 200 e chamadas sem autenticação retornam HTTP 401. Em 30/08 a causa raiz foi confirmada por inspeção direta do código publicado: a função já referencia corretamente o `project_id` atual (`ulszjqppxceqbeoyyqbb`) no seu emissor OAuth; não é um problema de servidor. O `issuer` desatualizado existia apenas em `.lovable/mcp/manifest.json` (arquivo de referência, não usado em runtime) e foi corrigido. | O cliente MCP autorizado no ChatGPT precisa ser desconectado e reconectado (novo login OAuth) para descartar o token antigo. Depois, confirmar uma leitura com os mesmos identificadores do aplicativo. |
| Migração Supabase (projeto novo) | Em andamento em 30/08/2026 | Confirmado com o usuário: `ulszjqppxceqbeoyyqbb` ("Lumnia") é o projeto Supabase correto e atual, com os 666 lançamentos, 96 categorias, 2 carteiras, 2 cartões, 23 orçamentos e 1 projeto reconciliados. `supabase/config.toml` e o bundle de `lumnia-mcp` já apontavam para ele. Publicadas e validadas de ponta a ponta: `delete-account` (teste com usuário descartável: transação e usuário removidos, confirmado por SQL) e `generate-recurring` (rodou sem erro). Publicadas mas **não funcionais**: `categorize-expense` e `chat-genius` — faltando o secret `LOVABLE_API_KEY`, que era provisionado automaticamente pela plataforma Lovable e não existe neste projeto independente. `chat-genius` foi publicada via `supabase functions deploy` local (Node.js e a CLI do Supabase foram instalados nesta sessão, pois o ambiente não tinha nenhum dos dois) e os 7 arquivos publicados foram baixados e conferidos byte a byte contra o código local. Publicadas mas **pendentes de validação ponta a ponta**: `send-push` e `check-due-bills` (bloqueado temporariamente pelo limite de envio de e-mail do Supabase ao criar um segundo usuário descartável para teste). O bundle web publicado na Vercel (produção) ainda estava compilado contra o projeto Supabase antigo (`nvskvrgsfzaynotdgzoy`) até esta auditoria; o usuário está atualizando as variáveis de ambiente na Vercel diretamente. | Decidir o provedor de IA substituto para `LOVABLE_API_KEY` (proposta de migração para `OPENAI_API_KEY` em avaliação). Concluir validação de `send-push`/`check-due-bills` com usuário descartável assim que o limite de e-mail liberar. Confirmar que o novo deploy da Vercel não contém mais referências a `nvskvrgsfzaynotdgzoy`. |
| Segurança: `chat-genius` sem autenticação | Corrigido e publicado em 30/08/2026 | Auditoria de segurança encontrou uma falha crítica: `chat-genius` rodava com `verify_jwt = false` e também não validava a sessão internamente — confiava no `user_id` enviado no corpo da requisição por um cliente `service_role` (que ignora RLS). Qualquer pessoa com a URL da função e um UUID de usuário podia ler, criar ou apagar transações de qualquer conta, sem login. Corrigido para extrair e validar o usuário a partir do cabeçalho `Authorization`, no mesmo padrão já usado por `delete-account`. Publicada via `supabase functions deploy` local (CLI instalada via winget + npm, pois o ambiente não tinha Node.js). Os 7 arquivos publicados (`index.ts` + 6 em `_shared/`) foram baixados de volta e comparados byte a byte com o código local: idênticos. Testado sem cabeçalho `Authorization`: rejeitado imediatamente com "Sessão não encontrada", sem tocar no banco. | Teste completo com sessão válida (confirmando que os dados retornados pertencem ao usuário autenticado, nunca a outro) só é possível depois de configurar um secret de IA funcional — hoje qualquer chamada autenticada esbarra primeiro no erro de `LOVABLE_API_KEY` ausente. |
