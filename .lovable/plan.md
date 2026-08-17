# Saldo das carteiras alinhado às transações

Hoje o saldo de cada carteira é calculado de forma isolada (saldo inicial + todas as transações de todos os tempos, pagas ou não), então nunca fecha com o saldo mostrado na página de Transações. A proposta é usar o mesmo motor financeiro do app, mas repartido por carteira.

## O que cada carteira vai mostrar

- **Saldo atual (número principal)**: saldo inicial da carteira + apenas as transações **já pagas/recebidas** com data até hoje, vinculadas àquela carteira.
- **Previsto no fim do mês (linha secundária)**: parte do saldo atual e aplica todo o restante do mês selecionado (pendentes, recorrências projetadas e o "tombo" da fatura do cartão no vencimento), usando exatamente o mesmo motor da página de Transações.
- A soma dos "previstos" de todas as carteiras passa a bater com o saldo final do mês exibido nas Transações.

## Regras de atribuição por carteira

- Receita com carteira definida: credita aquela carteira.
- Despesa em débito com carteira definida: debita aquela carteira.
- Transferência: debita a carteira de origem e credita a de destino (já funciona, mantém).
- Compra no cartão de crédito: **não** afeta carteira nenhuma. Quem afeta é o pagamento da fatura / o vencimento da fatura, debitando a carteira usada no pagamento. Isso corrige uma dupla contagem existente hoje (25 compras de cartão hoje carregam uma carteira e estão sendo descontadas duas vezes).
- Transações sem carteira definida (hoje 243 lançamentos em débito) passam a cair numa **carteira padrão** escolhida por você.

## Carteira padrão

- Novo campo de configuração "Carteira padrão" (em Minha Carteira e em Configurações), guardado no seu perfil.
- Enquanto nenhuma for escolhida, o app usa a primeira conta corrente e mostra um aviso discreto para você definir.
- Todo lançamento sem carteira é somado à carteira padrão, tanto no saldo atual como no previsto.

## Ajuste automático ao pagar/receber

- Ao marcar uma transação como paga/recebida, ao criar, editar, apagar ou pagar fatura, o saldo da carteira envolvida se recalcula na hora (invalidação do cache já existente + sincronização em tempo real).
- Nada é gravado em `wallets.current_balance` como "verdade": o saldo passa a ser sempre derivado das transações, evitando divergências. O campo continua existindo apenas por compatibilidade.

## Detalhes técnicos

- Nova função `buildWalletBalances` em `src/lib/walletBalances.ts`, recebendo carteiras, lançamentos do mês, histórico, recorrências, exceções, cartões e a carteira padrão. Retorna, por carteira: `paidBalanceToday` e `projectedEndOfMonth`.
- Reaproveita `buildEffectiveMonthExpenses`, `buildInvoiceCashEvents` e `isTrackedCreditCardPayment` para que a soma por carteira use a mesma matemática de `useProjectedTotals` / `buildDailyBalanceMap`.
- `useProjectedTotals` expõe os dados brutos necessários (já busca quase tudo); se faltar algum campo (`wallet_id`, `destination_wallet_id`, `is_paid`) nas queries, ele é adicionado.
- `src/pages/WalletPage.tsx`: remove o `walletBalanceMap` module-level e passa a consumir `buildWalletBalances`; cards por carteira mostram saldo atual + previsto; os totais "Saldo atual" / "Saldo em investimentos" / "Património" passam a usar essa mesma fonte.
- Migração: coluna `default_wallet_id` em `user_settings` (referência a `wallets`, apagada em cascata suave via `on delete set null`).
- Testes em `src/test/walletBalances.test.ts`: soma das carteiras = saldo previsto do mês; compra de cartão não mexe na carteira; pagamento de fatura debita só a carteira do pagamento; lançamento sem carteira cai na padrão.
