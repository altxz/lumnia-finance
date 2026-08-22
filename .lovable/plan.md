# Otimizar os gráficos do painel no celular

Auditei o painel a 393px de largura e medi cada bloco. Os problemas confirmados:

| Bloco | Tamanho do quadro | Área real do gráfico |
| --- | --- | --- |
| Fixos vs Variáveis | 179 x 200 | 131 x 112 |
| Fontes de Renda | 179 x 200 | 131 x 132 (legenda com 6 itens ocupa mais que o gráfico) |
| Receita vs Despesas | 179 x 200 | 131 x 112 |
| Taxa de Poupança | 179 x 200 | medidor cortado |
| Fluxo de Caixa | 369 x 320 | 321 x 154 (metade do quadro vira cabeçalho/legenda) |
| Orçado vs Realizado | 369 x 300 | 321 x 160 (≈110px vazios abaixo das barras) |

Ou seja: os quatro blocos pequenos ficam com um gráfico de ~130px, os títulos quebram em duas linhas e as legendas comem o espaço; os blocos largos têm altura fixa que sobra quando há poucos dados e falta quando o gráfico é denso.

## O que vai mudar

**1. Grid com tamanhos próprios para o celular**
O grid passa a aceitar um tamanho específico de celular por bloco, mantendo o layout de desktop exatamente como está hoje. No celular:
- Fixos vs Variáveis e Taxa de Poupança continuam 2 por linha, mas em versão compacta (número grande + mini gráfico) e com altura menor — sem espaço morto.
- Fontes de Renda e Receita vs Despesas passam a ocupar a largura total no celular, com o gráfico à esquerda e a leitura/legenda à direita, aproveitando os 369px.

**2. Versões compactas dos blocos pequenos**
- Cabeçalhos com título em uma linha só (texto menor, sem quebra) e menos espaçamento vertical no celular.
- Legendas do Recharts substituídas por rótulos próprios ao lado do gráfico (mais legíveis e sem roubar altura).
- Taxa de Poupança: medidor redimensionado para caber inteiro, com a percentagem e o rótulo dentro do arco.

**3. Blocos largos com altura útil**
- Fluxo de Caixa no celular: esconde o eixo direito duplicado, reduz margens e mostra o seletor/legenda em linha única, devolvendo ~80px de altura ao gráfico.
- Orçado vs Realizado: altura acompanha o número de orçamentos (sem sobra quando há poucos) e mantém rolagem interna quando há muitos.
- Confiro também Mapa de Gastos, Calendário e Uso de Cartão de Crédito para folgas semelhantes e ajusto as alturas mínimas.

**4. Sem alteração de dados**
Nenhuma mudança de cálculo, consulta ou lógica financeira — apenas layout e apresentação. O desktop e o tablet mantêm o grid atual de 4 colunas.

## Detalhes técnicos

- `src/components/analytics/TileGrid.tsx`: `Tile` ganha a prop opcional `mobile` (`'half' | 'full'`) que aplica `col-span-*` e `min-h-*` só abaixo de `sm`, mantendo `SIZE_CLASSES` atuais para os breakpoints maiores.
- `src/pages/Dashboard.tsx`: passa `mobile` nos blocos pequenos e nos largos que precisam de altura diferente.
- Componentes tocados: `FixedVsVariableChart`, `IncomeSourcesPie`, `IncomeVsExpenseChart`, `SavingsRateGauge`, `CashFlowChart` (apenas eixos/margens/legenda), `BudgetVsActualChart` (altura por número de linhas).
- Densidade responsiva via `useIsMobile` onde a mudança é estrutural (eixo direito, orientação do gráfico) e via classes Tailwind quando é só espaçamento.
- Validação: capturas a 393px antes/depois de cada bloco, confirmando que a área do gráfico ocupa pelo menos ~70% da altura do quadro, e uma passagem a 1280px para garantir que o desktop não mudou.
