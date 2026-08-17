# Corrigir valores das faturas na aba Cartões de Crédito

## O problema (confirmado)

Na aba Cartões de Crédito da página Minha Carteira, a fatura é montada por uma busca própria que pega **todas** as transações do cartão com aquele `invoice_month`. O registro de pagamento da fatura ("Pagamento fatura Nubank Crédito - 2026-08") é gravado com o mesmo cartão e o mesmo mês de fatura, então ele entra na lista e é somado ao total — a fatura fica inflada pelo próprio pagamento (praticamente o dobro quando já foi paga).

O mesmo acontece no "valor usado" mostrado no cartão: ele soma despesas de cartão por data do mês corrente, incluindo os registros de pagamento, e ignora o mês selecionado no seletor global.

O resto da plataforma (Análises > Cartões, modais de fatura) usa um motor único que exclui pagamentos e resolve o mês de vencimento corretamente. A aba de carteira é a única que faz o cálculo por conta própria.

## O que será feito

1. **Usar o motor único de faturas** na aba Cartões de Crédito: cada fatura passa a ser montada pelos mesmos helpers usados nas Análises, que excluem os registros de "Pagamento fatura", ignoram receitas/transferências e resolvem o mês de vencimento pelo ciclo do cartão.
2. **Total, contagem de lançamentos e status** da fatura passam a vir desse motor — mesmo número que aparece nas Análises e no resumo do mês.
3. **Valor usado / limite disponível** de cada cartão passa a ser o total da fatura em aberto do mês selecionado (sem pagamentos), em vez da soma por data do mês atual.
4. **Sincronizar a fatura exibida com o mês do seletor global**, para que trocar o mês na página mude a fatura mostrada, como nas outras telas.
5. **Pagar fatura** continua funcionando, agora sempre sobre o valor correto (e sem risco de gerar pagamento em dobro do valor).

## Detalhes técnicos

- `src/pages/WalletPage.tsx`:
  - remover `fetchInvoiceTransactions` (busca por `credit_card_id` + `invoice_month`) e o estado `cardExpenses`;
  - derivar as faturas de `getInvoicePeriod(card, ano, mês)` + `matchExpensesToInvoice(...)` (`src/lib/invoiceHelpers.ts`), alimentados pelos lançamentos já disponíveis em `useProjectedTotals` (`invoiceExpenses`), evitando novas requisições ao banco;
  - `invoiceTotal`, `invoiceTransactions` e o badge de status passam a vir do `InvoicePeriod` resultante;
  - `usedByCard` calculado a partir do total da fatura do mês selecionado;
  - `invoiceMonth` derivado de `useSelectedDate()` mantendo a navegação de mês da fatura.
- Nenhuma alteração de banco de dados. Sem mudança na lógica de pagamento além da fonte do valor.

## Verificação

- Comparar, para Agosto/2026 e meses anteriores já pagos, o total da fatura na aba Cartões com o valor mostrado em Análises > Cartões e com o registro de pagamento no extrato — devem coincidir.
- Conferir um cartão sem pagamento registrado (fatura em aberto) e um já pago.
