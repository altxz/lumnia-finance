# Levar a IA interna (Lumnia Genius) ao mesmo nível da integração com o ChatGPT

Hoje o chat interno tem 25 ferramentas, quase todas de consulta. Ele sabe registrar despesa/receita, excluir transação e salvar orçamento — mas **não sabe editar transação, transferir entre carteiras, marcar como pago, pagar fatura, gerir carteiras/categorias/projetos, mexer em investimentos nem calcular o score financeiro**. Tudo isso já existe na integração externa (MCP v0.5.0).

## O que será feito

### 1. Transações (paridade)
- **Editar transação**: alterar descrição, valor, data, tipo, categoria, carteira, cartão, pago/não pago, observação, projeto e tags — com escopo `só esta`, `esta e as próximas` ou `toda a série`, igual à tela de edição.
- **Criar transação completa**: passa a aceitar carteira, cartão de crédito, mês da fatura, recorrência fixa, parcelas e projeto (hoje só aceita o básico).
- **Marcar como pago / desfazer pagamento**, com data efetiva.
- **Transferência entre carteiras**.

### 2. Cartões de crédito
- **Detalhe da fatura** de um cartão num mês: total, status, fechamento, vencimento e lista de compras.
- **Pagar / desfazer pagamento de fatura**, com a mesma regra anti-dupla-contagem do app.

### 3. Carteiras, categorias e projetos
- Criar/editar carteira; criar/renomear/desativar categoria e subcategoria; criar/editar projeto e ver o gasto acumulado.

### 4. Investimentos
- Listar caixinhas com valor aplicado, rendimento e taxa; registrar aporte e resgate movimentando a carteira.

### 5. Análises
- **Score financeiro** do mês com as 5 dimensões (mesmos pesos da página de Score).
- **Excluir meta de orçamento** (complemento do que já existe).

### 6. Segurança na conversa
Antes de qualquer ação que altere série recorrente, parcelamento, fatura ou apague dados, a IA pergunta e só executa após confirmação explícita — e sempre responde em português.

## Revisão junto (o "revisar" do pedido)
- Conferir as ferramentas atuais que se afastaram do motor financeiro do app (resumo do mês e projeção usam filtros próprios) e alinhá-las à mesma lógica de projeção usada nas telas, para a IA nunca dar número diferente do que aparece na página de Transações.
- Padronizar mensagens de erro em português e resolver nomes (carteira, cartão, categoria, projeto) por nome **ou** id, com aviso quando houver ambiguidade.

## Detalhes técnicos
- Todas as ferramentas novas entram em `supabase/functions/chat-genius/index.ts`: definição no array `tools` + `case` no `executeTool`, mantendo o padrão atual (`supabase` com o token do usuário, respeitando RLS).
- Para evitar duplicar regra de negócio, a lógica de cada ferramenta é portada a partir dos equivalentes já validados em `src/lib/mcp/tools/` (`update-transaction`, `create-transfer`, `set-transaction-paid`, `invoice-details`, `pay-invoice`, `manage-wallet`, `manage-category`, `manage-project`, `investment-ops`, `financial-score`) e do resolvedor `src/lib/mcp/resolve.ts` — a edge function é Deno e não importa `src/`, então o código compartilhado será extraído para um módulo interno da função (`supabase/functions/chat-genius/_shared/`) mantendo uma única fonte de verdade por regra.
- O prompt do sistema é reescrito para descrever o catálogo novo e exigir confirmação antes de operações destrutivas ou em série.
- Como o arquivo já tem ~1.700 linhas, as definições de ferramenta e os handlers serão divididos em módulos por domínio (transações, cartões, organização, investimentos, análises) dentro da pasta da função.
- Ao final, a função `chat-genius` é redeployada e testada com chamadas reais (uma consulta e uma escrita) antes de considerar pronto.
