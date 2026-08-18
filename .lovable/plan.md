# Grid de blocos (estilo Windows Phone) no Painel de Análises

## Problema
No Dashboard todos os cards de gráfico ocupam a mesma célula com altura fixa (`min-h-[280px] sm:min-h-[350px]`). Gráficos pequenos (donuts, gauge, barra única) ficam perdidos num quadro grande — como nas imagens de "Fixos vs Variáveis", "Fontes de Renda" e "Receita vs Despesas".

## Solução
Trocar o grid atual por um grid de blocos com três tamanhos, no espírito dos live tiles:

- **Pequeno (1x1)** — quadrado compacto: donuts, gauge, comparativos simples.
- **Médio (2x2)** — quadrado grande: gráficos de barras/linhas do mês, listas, calendário, heatmap.
- **Largo (4x2)** — retângulo: fluxo de caixa, resumo de cartões, patrimônio.

Distribuição pretendida:

```text
[      Resumo de Cartões  (largo)      ]
[      Fluxo de Caixa     (largo)      ]
[ Top Despesas (médio) ][ Subcategorias (médio) ]
[Fix/Var][Fontes][Rec/Desp][Poupança]   <- 4 pequenos
[ Gasto Diário (médio) ][ Waterfall (médio) ]
[ Semanas (médio) ][ Burndown (médio) ]
[ Previsão (médio) ][ Calendário (médio) ]
[ Heatmap (médio) ][ Uso do Crédito (médio) ]
[      Patrimônio Líquido (largo)      ]
```

Responsivo: 4 colunas no desktop, 2 no tablet, 1 no celular (blocos pequenos ficam 2 por linha no celular).

## Ajuste dentro dos blocos
Nos gráficos que hoje "somem" no quadro, o desenho passa a acompanhar o tamanho do bloco:
- Donuts (Fixos vs Variáveis, Fontes de Renda, Top Categorias) com raios em percentual (ex. 58%/85%) em vez de pixels fixos, legenda compacta.
- Receita vs Despesas com barras mais largas e margens reduzidas.
- Gauge de poupança centralizado e proporcional.

## Detalhes técnicos
- Novo componente `src/components/analytics/TileGrid.tsx`: `<TileGrid>` (grid `grid-cols-2 md:grid-cols-2 xl:grid-cols-4`, gap consistente) e `<Tile size="small" | "medium" | "wide">` que aplica col-span/row-span e altura por tamanho (`h-[180px]` pequeno, `h-[340px]` médio/largo em desktop), preservando `flex flex-col` + `h-full` que os cards já esperam.
- `src/pages/Dashboard.tsx`: substituir o bloco do grid (linhas ~244-272) pelos novos `<Tile>`, mantendo `Suspense`/lazy e as mesmas props. `ChartFallback` recebe altura pelo Tile.
- Ajustes pontuais de raio/margem em `FixedVsVariableChart.tsx`, `IncomeSourcesPie.tsx`, `IncomeVsExpenseChart.tsx`, `SavingsRateGauge.tsx` — apenas visual, sem mudar cálculo.
- Sem alteração de dados, hooks ou banco.
