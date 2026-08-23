# Corrigir o gráfico Cascata do Mês

## O que está errado (confirmado nos dados de agosto/2026)

O gráfico de cascata calcula tudo por conta própria, em paralelo ao motor oficial de projeção, e nesse cálculo ele:

- **ignora os pagamentos de fatura do cartão** (filtra fora tudo que começa com "Pagamento fatura");
- **ignora as compras no cartão** (filtra fora `credit_card_id`), ou seja, o cartão simplesmente desaparece da conta;
- ignora as transferências para investimentos, que no motor oficial contam como saída de caixa.

Números reais de agosto/2026:

```text
Receitas ........................ R$ 27.670,58
Despesas em débito .............. R$ 19.679,25
Pagamentos de fatura ............ R$  5.125,23  <-- ignorado pela cascata
Compras no cartão ............... R$  9.293,47  (viram fatura)
```

Cascata hoje: saldo inicial + 27.670,58 − 19.679,25 = saldo inicial **+ 7.991,33** → daí o "mais de 9 mil".
Motor oficial (base caixa): saldo inicial + 27.670,58 − (19.679,25 + 5.125,23) = saldo inicial **+ 2.866,10**.

A diferença é exatamente a fatura do cartão que o gráfico deixou de subtrair.

## Correção

Parar de recalcular no componente e passar a consumir os mesmos números do motor `useProjectedTotals` / `computeMonthTotals`, que já é a fonte de verdade do dashboard e da página de transações.

A cascata passa a ser montada assim:

1. **Saldo Inicial** — `startingBalance`.
2. **Receitas** — `totalIncome` (inclui resgates de investimento, igual ao motor).
3. **Barras de despesa** — as 5 maiores categorias de saída de caixa vindas do `byCategory` do motor, mais "Outras" com o resto, escaladas para somar exatamente `totalExpense` (débito + fatura). Assim nenhuma saída fica de fora.
4. **Fatura do Cartão** — barra própria com o valor de fatura que sai do caixa no mês (`invoiceTotal`), separando pago e projetado no tooltip, para ficar claro de onde vem a queda.
5. **Saldo Final** — `projectedBalance`, exatamente o mesmo valor exibido nos cards do dashboard e no fim do mês na tela de transações.

Também acrescento no tooltip do Saldo Final a conta explícita (inicial + receitas − saídas) e no rodapé do card uma nota curta indicando o total de compras no cartão do mês (informativo, já que elas entram como fatura e não como saída direta) — evitando a impressão de que o cartão foi ignorado.

## Detalhes técnicos

- `src/components/analytics/WaterfallChart.tsx`: trocar as props por `startingBalance`, `totalIncome`, `totalExpense`, `debitExpense`, `invoiceTotal`, `invoicePaid`, `invoiceProjected`, `cardPurchases`, `byCategory` e `projectedBalance`; remover o cálculo local de receitas/categorias e as barras derivadas de `expenses`.
- `src/pages/Dashboard.tsx:238`: passar esses campos a partir de `projected`.
- `src/hooks/useProjectedTotals.ts`: expor `byCategory: Record<string, number>` na interface `ProjectedTotals` (hoje já vem no objeto via spread, mas sem tipo).
- Manter paleta e estilo atuais (`--success`, `--destructive`, `--primary`, `chartPalette`), rótulos do eixo X e altura do card inalterados.
- Adicionar teste em `src/test/` verificando que a soma das barras da cascata fecha em `projectedBalance` e que a fatura entra como saída.
