# Ajuste de saldo das contas

Permitir informar o saldo real de uma conta e o app registra automaticamente a diferença como um lançamento de ajuste, que passa a valer em todo o sistema (saldo do dia, transações, projeções, património).

## Como vai funcionar

- Em Minha Carteira, cada conta ganha a ação "Ajustar saldo" (no menu do cartão da conta).
- O modal mostra o saldo atual calculado pelo app, um campo "Saldo real", a data do ajuste (padrão hoje) e um campo opcional de observação.
- Ao salvar, o app calcula a diferença e cria um lançamento:
  - saldo real maior → entrada de ajuste;
  - saldo real menor → saída de ajuste;
  - diferença zero → nada é criado, apenas um aviso.
- O lançamento nasce como já pago/recebido, vinculado à conta escolhida, descrito como "Ajuste de saldo — {nome da conta}" e na categoria "Ajuste de saldo".
- Como é uma transação normal, todo o motor financeiro já existente passa a refleti-la: saldo do dia na página de Transações, saldo previsto do mês, continuidade entre meses, património e carteiras.
- O ajuste aparece na lista de transações (com identificação clara de entrada/saída) e pode ser editado ou apagado como qualquer lançamento, revertendo o efeito.

## Fora das análises

O ajuste é uma correção de saldo, não um gasto ou receita real. Por isso ele fica de fora de:

- gráficos de categorias, subcategorias, ranking de gastos e cascata;
- receitas vs despesas, fixos vs variáveis, fontes de renda, média diária;
- orçamentos (planejado vs realizado) e score financeiro.

Ele continua contando apenas onde o assunto é saldo/caixa.

## Detalhes técnicos

- Novo `src/lib/balanceAdjustments.ts` com `BALANCE_ADJUSTMENT_CATEGORY`, `buildBalanceAdjustmentDescription(walletName)` e `isBalanceAdjustment(expense)` (checa categoria e prefixo da descrição, no mesmo espírito de `isCreditCardPaymentLabel`).
- Novo `src/components/wallet/AdjustBalanceModal.tsx`: recebe conta + saldo calculado, faz o `insert` em `expenses` (`type` income/expense, `is_paid: true`, `wallet_id`, `final_category`, `notes`), datas via `date-fns` (`yyyy-MM-dd`), padrão de modal do projeto (`max-h-[85dvh]`, footer fixo) e `QuickCalculator` no campo de valor.
- `src/pages/WalletPage.tsx`: abre o modal por conta usando `walletPaidMap` como saldo de referência; após salvar, invalida cache (`projected.refetch()`, `fetchWallets()`, invalidação das chaves de `expenses`) para atualizar na hora.
- Exclusão nas análises: aplicar `isBalanceAdjustment` nos mesmos pontos onde hoje se filtra `Pagamento fatura` — `TopCategoriesPie`, `SubcategoryTreemap`, `WaterfallChart`, `BudgetVsActualChart`, `CategoryCharts`, `IncomeSourcesPie`, `IncomeVsExpenseChart`, `FixedVsVariableChart`, `DailySpendingChart`, `TopExpensesList`, `useBudgetData`, `useAnalyticsData` e o score financeiro.
- Nenhuma mudança de schema: `wallets.initial_balance` continua intocado e o saldo permanece derivado das transações.
- Testes em `src/test/balanceAdjustment.test.ts`: ajuste positivo/negativo altera `paidBalanceToday` e `projectedEndOfMonth` da conta certa em `buildWalletBalances`; `isBalanceAdjustment` identifica corretamente o lançamento.
