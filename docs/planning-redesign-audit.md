# Etapa 4: Planejamento

## Escopo

### Navegação unificada de Planejamento, 25/08/2026

- A barra inferior, ações rápidas, menu de perfil, menu lateral e insights agora apontam para `/categorias` como ponto único de entrada de Planejar.
- A rota legada `/orcamento` redireciona para `/categorias`, preservando acessos existentes.
- Validado no Galaxy S22 Ultra, dark mode, com o item Planejar abrindo a página Categorias. Evidência: `lumnia-planning-entry.png`.
- Nesta mudança não houve alteração do conteúdo de Categorias nem do detalhe da categoria. Essas etapas serão executadas separadamente.

Esta etapa cobre Orçamento, Categorias e seus detalhes, Projetos e Metas. A regra financeira aprovada permanece: um teto de gastos é definido pelo usuário e não depende da receita disponível no mês.

## Diagnóstico inicial

### Orçamento

- O resumo não priorizava categorias próximas ou acima do teto.
- Categorias monitoradas, sem teto e em risco apareciam na mesma lista, sem busca ou filtros.
- Falhas de carregamento podiam parecer um estado vazio.
- Em categorias com subcategorias, o teto da categoria principal entrava nos totais, mas não aparecia para edição.
- A interface alternava os termos `meta`, `limite` e `orçamento` para a mesma função.

### Categorias

- A gestão básica existe, mas precisa ser separada da leitura financeira de cada categoria.
- Detalhes, hierarquia, estados vazios e impacto de exclusão exigem auditoria própria no checkpoint 2.

### Projetos

- A página reúne criação, progresso e lançamentos, mas precisa de hierarquia de situação e tratamento explícito de loading, vazio e erro.
- A regra de progresso e os estados de projeto precisam ser confirmados antes de mudanças estruturais.

### Metas

- A permanência como recurso independente ainda precisa ser decidida com base na sobreposição com Projetos e tetos por categoria.
- Nenhuma remoção será feita sem validar dados existentes e caminhos de migração.

## Arquitetura da etapa

1. Orçamento: situação geral, atenção, busca, filtros e edição por categoria.
2. Categorias: gestão estrutural e detalhe financeiro separados.
3. Projetos: visão por situação, progresso real e acesso às movimentações relacionadas.
4. Metas: manter, integrar ou remover somente após auditoria funcional e de dados.

## Checkpoint 1: Orçamento

### Alterações implementadas

- Resumo principal focado na situação dos tetos.
- Contagem de categorias monitoradas e ultrapassadas.
- Busca e filtros por atenção, monitoradas e sem teto.
- Ordenação automática por risco.
- Estado de erro com nova tentativa e estados vazios contextuais.
- Padronização do termo `teto`.
- Exposição do teto da categoria principal quando ela possui subcategorias.
- Gasto direto da categoria principal separado dos gastos das subcategorias para evitar dupla contagem.
- Rótulos acessíveis nos controles de repetição e sugestão do mês anterior.

### Critério financeiro preservado

Cada categoria e subcategoria possui teto independente. A soma dos tetos é informativa e não representa orçamento disponível baseado em renda. Gastos de uma subcategoria não consomem automaticamente o teto da categoria principal.

### Validação pendente

- TypeScript, lint crítico, testes e build.
- Tema light e dark.
- Dados, loading, vazio e erro.
- Galaxy S22 Ultra e desktop.
- Edição, repetição mensal, sugestão anterior, busca e filtros.

### Validação executada

- TypeScript e lint crítico aprovados.
- 93 testes automatizados aprovados.
- Build de produção aprovado.
- Tema dark e light inspecionados com sessão autenticada.
- Breakpoint 412 x 915 inspecionado como referência do Galaxy S22 Ultra.
- Filtro de atenção e expansão de categoria principal verificados.

## Checkpoint 2: Categorias e detalhes

### Alterações implementadas

- Busca única por categoria principal ou subcategoria.
- Estado de erro com nova tentativa na visão geral.
- Estado vazio contextual para cadastro vazio e busca sem resultado.
- Separação visual entre indicadores do período e estrutura gerenciável.
- Aviso de exclusão corrigido: subcategorias são removidas em cascata, enquanto lançamentos históricos permanecem pelo nome atual.
- Falhas independentes de categoria, hierarquia e lançamentos agora são tratadas na página de detalhes.
- Categoria inexistente possui estado próprio e retorno seguro para a listagem.

## Checkpoint 3: Projetos e Metas

### Projetos

- Busca e filtros por atenção e ausência de limite.
- Ordenação automática pelo percentual consumido.
- Estados de loading, erro, vazio e busca sem resultado.
- Terminologia alterada de `orçamento` para `limite de gastos`, evitando conflito com os tetos mensais por categoria.

### Metas

A seção chamada `Metas` em Analytics não era um recurso real. Ela combinava números fixos, um progresso artificial e um simulador mantido apenas no estado local, sem persistência e sem vínculo com contas, projetos ou transações. Exibir isso como meta financeira era enganoso.

Decisão do redesign: remover essa seção de Analytics. Projetos continuam sendo o recurso persistente para objetivos com despesas vinculadas. Uma futura função de metas de acumulação exigirá modelo de dados próprio, origem de saldo definida e histórico de aportes. Ela não será simulada como se estivesse funcional.

## Validação dos checkpoints 2 e 3

- TypeScript e lint crítico aprovados após as alterações finais.
- 93 testes automatizados aprovados.
- Build de produção aprovado.
- Categorias inspecionada em 412 x 915, no tema light, com dados autenticados.
- Rankings redundantes removidos após inspeção visual; a estrutura gerenciável passou para a primeira dobra.
- Projetos inspecionada em 412 x 915, no tema light, com dados autenticados.
- Abertura do detalhe do projeto, limite de gastos e estado vazio de transações verificados.
- Tema dark já validado nos componentes-base e em Orçamento; a revisão visual completa no aparelho físico permanece pendente.

## Impedimento atual

O Galaxy S22 Ultra não apareceu na lista de dispositivos conectados ao final desta rodada. Por isso a Etapa 4 não foi marcada como concluída. Ainda faltam sincronização Android, inspeção física light e dark e verificação de scroll, teclado e áreas de toque no aparelho.

## Ajuste estrutural: cards de categorias, 25/08/2026

- A grade de categorias deixa de expandir conteúdo na própria página.
- Cada card agora apresenta, de forma estável, gasto no período, orçamento configurado e progresso de utilização.
- Categorias sem orçamento mantêm o gasto visível e comunicam claramente que o orçamento ainda não foi definido.
- Categorias em alerta ou ultrapassadas preservam o destaque sem alterar a altura ou a estrutura do card.
- O toque no card continua levando ao detalhe da categoria, que será tratado no próximo ajuste estrutural.

### Validação desta mudança

- TypeScript, lint do arquivo, build web, sincronização Capacitor e APK debug concluídos sem erros.
- APK instalado no Galaxy S22 Ultra. A validação de dados confirmou cards sem expansão e estados de orçamento, incluindo alerta de 133%.
- A revisão visual completa em light e dark permanece pendente para o fechamento da Etapa 4.

## Ajuste estrutural: detalhe completo da categoria, 25/08/2026

- O toque em um card da grade abre a rota de detalhe da categoria.
- A tela reúne gasto do período, comparação mensal, orçamento monitorado, progresso, lançamentos e gráficos de comportamento.
- O orçamento da própria categoria pode ser definido ou atualizado diretamente no detalhe.
- Categorias principais mostram as subcategorias em cards independentes, cada uma com gasto, orçamento e progresso próprios.
- Categorias sem orçamento continuam mostrando os gastos e deixam explícito que não há valor configurado.
- Títulos, nomes de subcategorias, descrições e valores deixam de usar reticências nessa tela. O layout usa quebra de linha controlada e valores numéricos sem corte.

### Validação desta mudança

- TypeScript, lint do arquivo, build web, sincronização Capacitor e APK debug concluídos sem erros.
- Rota validada com sessão autenticada: `Categorias → Alimentação → detalhe`, incluindo oito subcategorias, lançamentos e estado sem orçamento.
- Layout móvel 412 x 915 inspecionado no tema dark. A validação integral dos dois temas no Galaxy S22 Ultra continua pendente para o encerramento da Etapa 4.

## Ajuste estrutural: compatibilidade da rota antiga, 25/08/2026

- A rota histórica `/orcamento` permanece disponível exclusivamente para compatibilidade com favoritos, links internos antigos e navegação já persistida.
- Ela usa redirecionamento com substituição de histórico para `/categorias`, evitando que o botão voltar leve o usuário a uma página duplicada.
- Não existe mais entrada visual que apresente Orçamento como página concorrente de Planejamento.

### Validação desta mudança

- Rota verificada com sessão autenticada: `http://127.0.0.1:8080/orcamento` resolve para `http://127.0.0.1:8080/categorias` e renderiza o título `Categorias`.

## Ajustes de navegação e cabeçalho, 25/08/2026

- Em Categorias, o seletor de mês não exibe mais o botão `Hoje` em uma segunda linha. O seletor e a ação `Nova` permanecem alinhados.
- O menu de perfil substitui `Planejamento` por `Patrimônio`.
- A barra inferior móvel passa a usar: `Resumo`, `Atividade`, adicionar transação, `IA` e `Planejar`.
- `Patrimônio` deixa a barra inferior e permanece acessível pelo menu de perfil. A IA da barra dispara o mesmo painel de inteligência do cabeçalho.

### Validação desta mudança

- Inspeção autenticada em largura móvel 412 x 915 confirmou alinhamento da ação `Nova`, ordem da barra inferior e itens do menu de perfil.
- TypeScript, lint dos quatro componentes modificados, build web, sincronização Capacitor e APK debug concluídos sem erros.
- APK atualizado instalado no Galaxy S22 Ultra.
