# Ampliar a integração com o ChatGPT (MCP)

Hoje a integração tem 12 ferramentas: buscar, abrir detalhe, listar transações, criar, excluir, transações do mês, resumo do mês, categorias, carteiras, cartões, ler orçamentos e criar/editar orçamento.

Duas lacunas que você citou são reais: não existe ferramenta de **editar transação**, e o `create_transaction` só aceita descrição, valor, data, tipo, categoria, pago e observação — não aceita carteira, cartão de crédito, recorrência, parcelas nem projeto.

## O que será feito

### 1. Criar transação (completar os campos)
Passa a aceitar: carteira (nome ou id), cartão de crédito (nome ou id), forma de pagamento, mês da fatura, recorrência (fixa mensal), número de parcelas, projeto, tags e categoria por id. Sem carteira informada, usa a carteira padrão das configurações.

### 2. Editar transação (nova)
Alterar qualquer campo de uma transação existente: descrição, valor, data, tipo, categoria, carteira, cartão, pago/não pago, observação, projeto, tags. Para séries recorrentes/parceladas, escolher o escopo: só esta ocorrência, esta e as futuras, ou toda a série — igual ao que a plataforma já faz na tela de edição.

### 3. Transferências entre carteiras (nova)
Registrar movimentação de dinheiro entre duas carteiras (tipo `transfer`), que hoje só é possível pela interface.

### 4. Marcar como pago / desfazer pagamento (nova)
Quitar ou reverter uma transação, e pagar a fatura de um cartão de crédito no mês informado, usando a mesma lógica de pagamento de fatura da plataforma (para não contar duas vezes).

### 5. Cartões de crédito: detalhe da fatura (nova)
Ver a fatura de um cartão em um mês: total, status (aberta/fechada/paga), data de fechamento e vencimento, e a lista de compras que a compõem.

### 6. Carteiras (nova)
Criar e editar carteira (nome, saldo inicial, moeda, tipo) e consultar o saldo atual x previsto, alinhado ao motor de projeção usado nas telas.

### 7. Categorias (nova)
Criar, renomear e desativar categorias e subcategorias (respeitando a hierarquia com categoria-mãe).

### 8. Orçamentos (completar)
Adicionar exclusão de meta de orçamento, complementando o que já existe.

### 9. Investimentos (nova)
Listar investimentos (caixinhas) com valor aplicado, rendimento e taxa; registrar aporte e resgate, com o dinheiro saindo/entrando na carteira como já acontece na tela de Investimentos.

### 10. Projetos (nova)
Listar projetos/centros de custo com orçamento e total gasto, e vincular transações a um projeto.

### 11. Análises e projeções (nova)
- Saldo projetado por dia em um intervalo (mesmo motor da página de Transações).
- Ranking de categorias e maiores gastos de um mês.
- Score financeiro do mês com as 5 dimensões.
- Comparação entre meses (receita, despesa, saldo, variação por categoria).

### 12. Recorrências (nova)
Listar as despesas/receitas fixas ativas e permitir encerrar uma recorrência a partir de uma data.

## Ordem de entrega

1. Bloco de transações (itens 1 a 4) — resolve o que você pediu diretamente.
2. Cartões, carteiras, categorias e orçamentos (itens 5 a 8).
3. Investimentos, projetos, análises e recorrências (itens 9 a 12).

## Detalhes técnicos

- Cada ferramenta é um arquivo em `src/lib/mcp/tools/`, registrado em `src/lib/mcp/index.ts`, seguindo o padrão atual (`defineTool` + `safeHandler` + `supabaseForUser`, que respeita o RLS do usuário do OAuth).
- Escritas usam `annotations.destructiveHint` quando apagam/alteram dados, para o ChatGPT pedir confirmação.
- Ferramentas de escrita aceitam nome **ou** id (carteira, cartão, categoria, projeto) e resolvem o id internamente, retornando erro claro em caso de ambiguidade — mesmo comportamento do `upsert_budget`.
- Edição de série reaproveita `src/lib/recurringExceptions.ts` e a lógica de split de série de `src/lib/recurringProjection.ts`; pagamento de fatura reaproveita `src/lib/creditCardPayments.ts` e `src/lib/invoiceHelpers.ts`; projeções reaproveitam `buildDailyBalanceMap` de `src/lib/projectedBalanceMath.ts` e `src/lib/mcp/monthProjection.ts`, evitando lógica financeira duplicada.
- Investimentos reaproveitam `src/lib/investmentMath.ts` e criam a transação `transfer` correspondente, como a interface faz.
- Versão do servidor MCP sobe para `0.5.0` e as `instructions` são reescritas para descrever o novo catálogo; o manifesto (`.lovable/mcp/manifest.json`) é regerado no deploy da função `lumnia-mcp`.
- Após o deploy, é necessário reconectar/atualizar o conector no ChatGPT para ele enxergar as ferramentas novas.
