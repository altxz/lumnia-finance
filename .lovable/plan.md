# Remover Score Financeiro e adicionar mini-gráficos nos cards

## O que muda

1. **Score Financeiro removido de toda a plataforma**
   - Sai o carrossel de score ao lado dos cards no Dashboard.
   - Sai o card "Score Financeiro" da página de Análises.
   - A página de score (que hoje já não tem rota/link ativo) e o motor de cálculo são apagados, junto com a ferramenta de score da integração externa (ChatGPT/Cursor) e o teste correspondente.

2. **Cards de resumo maiores e com histórico**
   - Com o espaço liberado, os 4 cards (Saldo Projetado, Entradas, Saídas, Maior Subcategoria) voltam a ocupar toda a largura: 4 colunas no desktop, 2 no mobile, e ficam mais altos para acomodar o gráfico.
   - Cada card recebe um mini-gráfico de área (linha suave, sem eixos nem grade, na cor do próprio card) mostrando os últimos 6 meses:
     - Saldo Projetado → histórico do saldo mensal
     - Entradas → histórico de receitas
     - Saídas → histórico de despesas
     - Maior Subcategoria → histórico de gasto **daquela** subcategoria específica nos últimos 6 meses (recalculado sempre que a subcategoria em destaque mudar)
   - Ao passar o mouse/tocar, um tooltip discreto mostra mês e valor.
   - Sem dados suficientes (mês único), o card mostra apenas o valor, sem gráfico quebrado.

## Detalhes técnicos

- Novo hook `src/hooks/useSummaryHistory.ts`: uma única consulta de `expenses` cobrindo os 6 meses anteriores ao mês visualizado (respeitando o `DateContext`), agregando por mês em `{ month, income, expense, balance }` e, quando informada, a série da subcategoria (`final_category` com o matching tolerante de `src/lib/categoryMatch.ts`). Reutiliza a mesma base de regras de regime de competência já usada nos analytics (faturas de cartão excluídas do agrupamento por categoria) para não gerar dupla contagem.
- Novo componente `src/components/ui/mini-area-chart.tsx`: `ResponsiveContainer` + `AreaChart` com `Area` de gradiente `currentColor`, `domain={['auto','auto']}`, altura fixa (~40px mobile / 56px desktop), `Tooltip` padronizado via `src/components/ui/chart.tsx`.
- `src/components/SummaryCards.tsx`: remove a prop `healthScore` e o bloco lateral; grid volta a `grid-cols-2 lg:grid-cols-4`; cada card passa a layout vertical (ícone + rótulo no topo, valor, badge de tendência, gráfico na base).
- `src/pages/Dashboard.tsx`: remove o import lazy e o uso de `DashboardScoreCarousel`; passa os dados do novo hook para `SummaryCards`.
- `src/pages/AnalyticsPage.tsx` + `src/components/analytics/OverviewCards.tsx`: removem o card e a prop `financialScore`; `src/hooks/useAnalyticsData.ts` deixa de calcular/expor `financialScore`.
- Arquivos apagados: `src/components/DashboardScoreCarousel.tsx`, `src/pages/FinancialScorePage.tsx`, `src/lib/financialScore.ts`, `src/lib/mcp/tools/financial-score.ts` (registro removido de `src/lib/mcp/index.ts`, versão do MCP incrementada) e `src/test/financialScore.test.ts`.
- Validação: build limpo, testes, e screenshots do dashboard em desktop e mobile.
