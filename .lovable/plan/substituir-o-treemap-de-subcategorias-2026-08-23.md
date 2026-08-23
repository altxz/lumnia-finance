# Substituir o treemap de subcategorias

O treemap atual é bonito, mas ruim de ler: os blocos cortam os nomes ("Transferênc", "Condomín"), não mostram valores nem percentuais, e blocos pequenos ficam invisíveis. Vou trocá-lo por um ranking de participação de gastos, que aproveita melhor o espaço do quadro.

## O que passa a aparecer no quadro

1. **Barra de participação no topo**: uma única barra segmentada (100%) mostrando como o gasto do mês se divide entre as principais subcategorias, com "Outras" agrupando o restante.
2. **Ranking abaixo**: cada subcategoria em uma linha com posição, nome completo (com reticências só se realmente não couber), valor em R$, percentual do total e uma barra de progresso proporcional ao maior gasto.
3. **Total do mês** no cabeçalho, para dar referência ao percentual.
4. **Hover/toque** mostra o valor exato e o percentual, sem tooltip flutuante de gráfico.

Ficam visíveis as 6 maiores subcategorias no desktop e 5 no celular, sempre com o mesmo padrão visual dos outros cards ("Maiores Compras").

## Adequação ao quadro

- A lista se adapta à altura do tile (`h-full` + `flex-1`), sem sobra de espaço vazio nem transbordo.
- Nomes usam truncamento com `title` para leitura completa.
- Cores vindas de `@/lib/chartPalette` (cor do banco quando a categoria tem cor definida), mantendo a paleta da marca em modo claro e escuro.

## Detalhes técnicos

- Reescrever `src/components/analytics/SubcategoryTreemap.tsx` como componente HTML/CSS (sem Recharts), renomeando a exportação para `SubcategoryBreakdown` e mantendo o mesmo contrato de props (`expenses`, `categories`).
- Manter exatamente a lógica financeira atual: ignora `income`/`transfer`, "Pagamento fatura" e ajustes de saldo (`isBalanceAdjustment`), agrupa por `final_category`.
- Atualizar o import/lazy em `src/pages/Dashboard.tsx` (linhas 38 e 230); o tile continua `size="medium"` / `mobile="tall"`.
- Reaproveitar `formatCurrency`, `InfoPopover` e o padrão de barras de `TopExpensesList` para consistência.
