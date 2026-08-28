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
- Etapa 4: estrutura unificada implementada, pendente de validação completa no dispositivo.
- Etapa 6: escopo de Analytics implementado e pendente de validação física no Galaxy S22 Ultra.
- Etapa 7: diagnóstico das configurações iniciado em 26/08/2026.
- Próximo checkpoint: validar Analytics no Galaxy S22 Ultra antes de encerrar formalmente a etapa.

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

### Etapa 4: planejamento

- [ ] Orçamento. Implementação concluída, validação do dispositivo pendente.
- [ ] Categorias e detalhes. Implementação do checkpoint 2 concluída, validação pendente.
- [ ] Projetos. Implementação do checkpoint 3 concluída, validação pendente.
- [x] Metas: seção simulada removida de Analytics; recurso persistente futuro exige especificação própria.

### Etapa 5: patrimônio

- [ ] Carteira e contas.
- [ ] Cartões e faturas.
- [ ] Investimentos e movimentações.
- [ ] Ajuste de saldo.
- [ ] Evolução patrimonial.

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
- [~] Segurança. Fluxo de importação de backup JSON completo, JSON legado e planilha Excel implementado em 26/08/2026. O seletor HTML do WebView descartava a seleção ao retornar do aplicativo Documentos do Android. O teste do seletor externo confirmou que o retorno de atividade é consumido pela ponte nativa já existente. Em 26/08/2026 foi criado um seletor nativo próprio do Lumnia, registrado no mecanismo de retorno compatível com o aplicativo, com leitura direta do arquivo e progresso por etapa. Em 27/08/2026, a planilha original foi restaurada diretamente no novo Supabase após o seletor Android falhar: 665 lançamentos, 96 categorias, 2 contas, 2 cartões, 1 projeto e 23 orçamentos. A quantidade e as somas por tipo da planilha coincidiram com o banco. A aba Dívidas contém somente o nome da pessoa, sem valores ou saldo, portanto não foi restaurada para não criar informação financeira incorreta. Falta corrigir e validar o mesmo fluxo de seleção e importação no Galaxy S22 Ultra.
- [ ] Categorias.
- [ ] Módulos.
- [ ] Planos.
- [ ] Classificar cada item como funcional, incompleto, futuro ou removível.

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
| 3. Transações | Concluída em 25/08/2026 | [`transactions-redesign-audit.md`](transactions-redesign-audit.md) e [`transactions-validation`](transactions-validation/) | Nenhuma |
| 4. Planejamento | Estrutura unificada concluída em 25/08/2026: entrada única, cards, detalhe e compatibilidade de rota | [`planning-redesign-audit.md`](planning-redesign-audit.md) e `lumnia-planning-entry.png` | Validação completa, estados e auditoria visual em light e dark |
| 5. Patrimônio | Pendente | | |
| 6. Analytics | Fundação, visão geral, categorias e previsão em validação em 26/08/2026 | Modelo único de período, comparação real, previsão com base explícita, estados de erro e vazio, carregamento escalonado, remoção do treemap, gráfico principal de receitas, despesas e resultado, ranking de categorias, acompanhamento de orçamentos e cobertura de caixa derivada de movimentações. A auditoria de cálculo eliminou interpretação de sinal invertido e leitura de caixa persistido desatualizado. TypeScript, build web e 14 testes financeiros focados aprovados. APK instalado e aberto sem exceções no Galaxy S22 Ultra. A ausência do lançamento de 24/08 foi confirmada como esperada após exclusão pelo usuário. [`financial-calculation-audit.md`](financial-calculation-audit.md) | Publicar as funções de servidor e concluir a validação visual da etapa |
| 7. Configurações | Diagnóstico iniciado em 26/08/2026 | Inventário das abas Perfil, Automação, Notificações e Categorias iniciado. Em Segurança, importador com pré-validação para backup JSON completo, JSON legado de transações e planilha Excel foi implementado. O seletor de arquivos foi adaptado para toque direto no Android e a interface mostra progresso de leitura e de gravação. A foto de perfil é persistida imediatamente após o envio. A restauração direta da planilha no novo Supabase foi validada em 27/08/2026: 665 lançamentos, 96 categorias, 2 contas, 2 cartões, 1 projeto e 23 orçamentos, com somas de receitas e despesas conferidas. | Corrigir o retorno do seletor e validar a importação pelo Galaxy S22 Ultra, depois finalizar a classificação funcional, incompleta, futura ou removível das abas. |
| 8. Movimento e estados | Pendente | | |
| 9. Auditoria final | Pendente | | |
| MCP privado | Implementação e deploy concluídos em 27/08/2026 | Função `lumnia-mcp` v2 publicada no projeto Supabase, bundle portátil validado sem caminhos locais, 97 testes automatizados aprovados, metadados do recurso OAuth retornam HTTP 200 e chamadas sem autenticação retornam HTTP 401. A implementação antiga foi substituída pelo conjunto de ferramentas alinhado ao código atual do Lumnia. | Ativar o OAuth Server Beta no painel do Supabase e concluir a autorização no ChatGPT. |
