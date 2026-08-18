# Substituir o Burndown por "Orçado vs Realizado"

## O que muda

O bloco "Burndown de Orçamento" no Painel de Análises do Dashboard sai e no lugar entra um gráfico de barras horizontais comparando, para cada categoria com orçamento definido no mês:

- **Planejado**: valor do orçamento da categoria
- **Realizado**: quanto já foi gasto nela no mês selecionado

Detalhes de comportamento:

- Só aparecem categorias com orçamento maior que zero, ordenadas do maior orçamento para o menor.
- Cada categoria mostra as duas barras (planejado em tom neutro, realizado em cor de destaque) e fica em vermelho quando o realizado passa do planejado.
- Rodapé com o total planejado, total realizado e o percentual consumido do orçamento total do mês.
- Tooltip com os dois valores e o saldo restante (ou o excedente).
- Se nenhum orçamento estiver definido, mantém a mensagem atual convidando a configurar orçamentos.
- Como o número de categorias varia, o bloco fica com scroll interno quando a lista for longa, mantendo o tamanho do quadro atual (médio) na grade.

## Consistência dos valores

O gasto por categoria usa a mesma base do resto do Dashboard (transações projetadas do mês), excluindo receitas, transferências e pagamentos de fatura, para não contar valores em dobro. Os orçamentos incluem também os orçamentos recorrentes herdados de meses anteriores, igual à página de Orçamento — hoje o Dashboard busca apenas os orçamentos gravados no mês, então essa busca será estendida para refletir a mesma regra.

## Detalhes técnicos

- Novo componente `src/components/analytics/BudgetVsActualChart.tsx` (recharts `BarChart` com `layout="vertical"`, `ResponsiveContainer` em 100%/100%, `Card` `rounded-2xl` no padrão dos outros blocos).
- Props: lista de orçamentos (`category`, `allocated_amount`) e `expenses` do mês; agregação por `final_category` feita no componente com `useMemo`.
- `src/pages/Dashboard.tsx`: trocar o import lazy e o `Tile size="medium"` do `BurndownChart` pelo novo componente; ampliar a query `dashboard-extra` para trazer também os orçamentos recorrentes anteriores e mesclá-los como na `useBudgetData`.
- Remover `src/components/analytics/BurndownChart.tsx` e suas referências.
