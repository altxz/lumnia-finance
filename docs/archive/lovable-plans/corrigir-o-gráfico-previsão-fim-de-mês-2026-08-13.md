# Corrigir o gráfico "Previsão Fim de Mês"

## O problema

O cartão "Previsão Fim de Mês" usa um motor de cálculo próprio, separado do motor oficial da plataforma (`useProjectedTotals` / `projectedBalanceMath`). Isso explica exatamente o gráfico achatado da captura:

- Ele busca as transações do mês selecionado, mas **nunca as usa** no cálculo da curva (a lista é carregada e descartada). Logo, despesas e receitas normais do mês não movem o saldo — só recorrências e faturas de cartão movem, o que deixa a linha praticamente reta.
- O saldo inicial da curva soma apenas lançamentos já **pagos** de toda a história, ignorando lançamentos pendentes de meses anteriores e o efeito de caixa das faturas de cartão.
- O dia de vencimento da fatura usa um valor padrão fixo quando o cartão não tem dia definido, em vez da regra de fatura já centralizada na plataforma.

Resultado: o valor final do gráfico não bate com a projeção mostrada nas outras telas (Transações / cartões de resumo).

## O que será feito

1. Ligar o gráfico ao motor único de cálculo já usado pelas Transações:
   - saldo inicial do mês vindo de `useProjectedTotals` (mesma base do "Saldo Anterior");
   - fluxo diário vindo de `buildDailyBalanceMap`, que já considera receitas, despesas em débito (pagas e não pagas), recorrências projetadas e o "tombo" da fatura no dia do vencimento.
2. Curva do mês inteiro, com acumulação diária real: cada dia soma/subtrai o que acontece nele, então a linha passa a variar de acordo com as despesas ao longo do tempo.
3. Marcar o dia de hoje na linha (ponto de referência) quando o mês visualizado for o mês atual, mantendo o visual atual (linha tracejada roxa).
4. Garantir que o valor grande do cabeçalho do cartão seja exatamente o `projectedBalance` do mês — o mesmo número exibido no resto da plataforma, sem recálculo paralelo.
5. Eixo Y com `domain={['auto', 'auto']}` para que as variações diárias fiquem visíveis, em vez de a curva parecer reta perto do topo.

## Detalhes técnicos

- Arquivo principal: `src/components/analytics/EndOfMonthForecast.tsx`.
- Remover as 4 consultas locais ao banco (`allTxns`, `monthTxns`, `recurring`, `unpaidCredit`) e o cálculo manual de saldo; passar a consumir `useProjectedTotals()` (que já traz `monthExpenses` com recorrências virtuais, `invoiceExpenses`, `creditCards`, `startingBalance`, `projectedBalance`).
- Usar `buildDailyBalanceMap({ monthExpenses, invoiceExpenses, creditCards, startDate, endDate, startingBalance, isCreditCardPayment: isTrackedCreditCardPayment })` e preencher os dias sem movimento com o último saldo conhecido (forward fill), do dia 1 ao último dia do mês.
- Reaproveitar `isTrackedCreditCardPayment` (`src/lib/creditCardPayments.ts`) para não contar duas vezes gasto no cartão e pagamento de fatura.
- Ajustar `src/pages/Dashboard.tsx` apenas se as props `creditCards`/`wallets` deixarem de ser necessárias.
- Verificação: comparar o valor final do cartão com o "Saldo Previsto" da página de Transações no mesmo mês, e conferir que o último ponto da curva é igual a esse valor.
