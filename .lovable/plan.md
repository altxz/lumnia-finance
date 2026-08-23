# Alinhar os cards do Dashboard ao extrato de Transações

## Diagnóstico (reproduzido com os dados reais de agosto/2026)

Rodei o motor de projeção com as linhas da sua conta e cheguei exatamente aos valores dos cards
(Entradas 20.270,58 / Saídas 15.710,48 / Saldo Projetado 4.722,17 / Empréstimos 6.773,16).
Ou seja: os cards são fiéis ao motor — o motor é que usa bases diferentes das do extrato:

1. **Saídas** conta a fatura *vencida* em agosto calculada pelo período do cartão (5.125,23) e ignora
   as compras feitas no cartão em agosto (9.296,47). O extrato, somado linha a linha, dá 19.881,72.
2. **Maior Subcategoria** ("Empréstimos" 6.773,16) mistura 3.388,58 vindos da fatura de julho com
   3.384,58 de débito de agosto — valor que não existe em nenhum lugar do extrato.
3. **Percentuais de tendência** (+64% / +65% / +67%) vêm de um cálculo paralelo dentro do Dashboard
   que soma as linhas "Pagamento fatura" **e** o total da fatura do cartão (dupla contagem) e ainda
   ignora as recorrências projetadas.
4. **Mini-gráficos (sparklines)** usam outra base (data da compra no cartão, sem saldo inicial),
   então o último ponto da linha nunca fecha com o número exibido no card.

## Regra definida

**Saídas do mês = despesas em débito do mês + pagamentos de fatura do mês.**

- Pagamento de fatura é lido dos lançamentos reais ("Pagamento fatura ...") com data no mês.
- Se a fatura do mês ainda não tem pagamento lançado, ela entra projetada na data de vencimento
  (para o mês não ficar artificialmente barato).
- Compras no cartão continuam **fora** de Saídas (elas viram fatura), evitando dupla contagem.
- Entradas seguem a mesma regra atual (receitas do mês, pagas ou não, + resgates de investimento).

## O que será feito

### 1. Motor único com detalhamento
Expor no `useProjectedTotals` a quebra explícita do mês: `debitExpense`, `invoicePaid`
(pagamentos de fatura lançados), `invoiceProjected` (faturas do mês sem pagamento lançado) e
`cardPurchases` (compras no cartão no mês, apenas informativo). Saídas passa a ser
`debitExpense + invoicePaid + invoiceProjected`, sem sobreposição entre as duas parcelas de fatura.

### 2. Cards de resumo
- O card Saídas exibe o total e, abaixo, a quebra "Débito X · Fatura Y" (tooltip no mobile).
- Card informativo no tooltip: "compras no cartão no mês: Z" — explicando a diferença em relação
  ao extrato.

### 3. Maior Subcategoria verificável
Passa a ser calculada apenas com as categorias que aparecem no extrato do mês
(débito do mês + compras no cartão do mês), nunca com categorias de faturas de meses anteriores.
Assim o valor do card é reproduzível filtrando aquela categoria na página de Transações, e o
clique no card leva ao mesmo filtro.

### 4. Tendências corretas
Remover o cálculo paralelo `prevSummary` do Dashboard e passar a calcular o mês anterior com o
mesmo motor (recorrências projetadas + mesma regra de fatura), eliminando a dupla contagem dos
lançamentos "Pagamento fatura".

### 5. Sparklines na mesma base
`useSummaryHistory` passa a montar as séries mensais com a regra acima (débito + pagamento de
fatura, com recorrências projetadas), de modo que o último ponto de cada mini-gráfico seja
exatamente o valor mostrado no card.

### 6. Verificação
Teste automatizado com um cenário fixo garantindo que, para o mesmo mês:
`Saídas = soma das despesas em débito + pagamentos de fatura` e
`Saldo Projetado = Saldo Anterior + Entradas − Saídas`; além de checagem no navegador comparando
Dashboard e página de Transações no mês corrente.

## Detalhes técnicos

- `src/lib/projectedBalanceMath.ts`: `computeProjectedMonthResult` recebe `invoicePaid` e
  `invoiceProjected` separados e devolve o breakdown; ranking de categorias deixa de receber
  `invoiceByCategory` de faturas antigas e passa a receber as compras do mês.
- `src/lib/projectedInvoiceTotals.ts` / `src/lib/invoiceCashFlow.ts`: gerar eventos de caixa da
  fatura marcando quais já têm pagamento lançado, para não somar duas vezes.
- `src/hooks/useProjectedTotals.ts`: expor breakdown e o resultado do mês anterior pelo mesmo motor.
- `src/pages/Dashboard.tsx`: remover `prevSummary` e consumir o mês anterior do hook.
- `src/components/SummaryCards.tsx`: quebra "Débito · Fatura" e tooltips.
- `src/hooks/useSummaryHistory.ts`: séries mensais na base caixa unificada.
- `src/test/`: novo teste de coerência dos totais.

Sem alterações no banco de dados; nenhum lançamento existente é criado, alterado ou excluído.
As duplicidades encontradas (14/08 Magalu 481 x2, 14/08 Uno 500 x2, 15/09 ChatGPT 103,97 x3)
ficam para uma rodada futura, conforme sua escolha.
