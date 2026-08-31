# Dados financeiros e integrações

## Modelo financeiro confirmado

- Valores de transação são magnitudes. O tipo determina se entra ou sai do caixa.
- Compras de cartão formam fatura por `invoice_month` no formato `AAAA-MM`.
- Pagamento de fatura é saída na conta de origem na data efetiva do pagamento. Não é compra no cartão.
- Faturas e saldos precisam ser derivados do mesmo motor de transações para evitar divergência entre telas.
- Patrimônio histórico usa `net_worth_history` com snapshots de ativos e passivos. A série não deve ser estimada em meses sem snapshot.

## Reconciliação de planilha concluída em 29/08/2026

| Item | Resultado |
|---|---:|
| Lançamentos na origem | 665 |
| Compras no cartão | 174 |
| Compras coincidentes na base | 174 |
| Faturas esperadas e encontradas | 28 |
| Total de compras no cartão | R$ 51.061,84 |
| Cartões, meses e valores divergentes | 0 |

Correções aplicadas:

1. Conversão de 174 meses de fatura de `MM/AAAA` para `AAAA-MM`.
2. Remoção do vínculo indevido de cartão do pagamento Nubank de R$ 1.856,32, preservando-o como saída de caixa.
3. Atualização do importador para aceitar os dois formatos e normalizar antes da persistência.

## Procedimento de reconciliação

1. Exportar ou obter fonte de referência confiável.
2. Particionar consultas grandes. A ferramenta MCP de transações aceita no máximo 500 registros por chamada.
3. Normalizar campos financeiros e comparar como multiconjunto, preservando repetição legítima de lançamentos iguais.
4. Comparar categoria, cartão, carteira, mês de fatura, data, valor e estado de pagamento.
5. Só criar ou corrigir registros que tenham diferença inequívoca.
6. Registrar totais como evidência complementar, nunca como único critério.

## Supabase e MCP

- O projeto Supabase atual (confirmado pelo usuário em 30/08/2026) é `ulszjqppxceqbeoyyqbb` ("Lumnia"). `supabase/config.toml` e o bundle publicado de `lumnia-mcp` já referenciam esse projeto corretamente.
- Decisão do usuário em 30/08/2026: manter a integração MCP apenas via **Claude** (Custom Connector, plano Pro), abandonando o ChatGPT. O conector foi configurado e testado com sucesso (Autenticação "Sempre obrigatório", Cliente OAuth "Sem ID de cliente — registrar automaticamente", ambos detectados automaticamente pelo Claude; Transporte HTTP Streamable).
- O erro inicial de conexão do Claude ("unauthorized request origin") **não** era falta de redirect URL no Supabase (`https://claude.ai/api/mcp/auth_callback` e `https://claude.com/api/mcp/auth_callback` já estavam corretamente cadastrados) nem um problema no servidor MCP (o `project_id` já estava correto). A causa real: o site em produção da Vercel, que hospeda a tela de consentimento OAuth (`Site URL` + `Authorization Path` do OAuth Server do Supabase), ainda estava com o bundle compilado contra o projeto Supabase antigo. Corrigido com a atualização das variáveis de ambiente na Vercel e um novo deploy; o Claude conectou normalmente em seguida.
- A função e o script do MCP ainda usam `@lovable.dev/mcp-js`. Não remover esta dependência sem substituir e testar o protocolo de autenticação e todas as ferramentas.
- Auditoria de 30/08/2026 encontrou que apenas 3 das 8 funções de servidor do código-fonte estavam publicadas no projeto novo (`snapshot-net-worth`, `lumnia-mcp`, `lumnia-backup-import-once`). Publicadas e validadas nesta auditoria: `delete-account` (usuário descartável: transação e conta removidas, confirmado por SQL), `generate-recurring`, `chat-genius` (corrigida quanto à autenticação, ver `02-falhas-e-correcoes.md`, publicada via `supabase functions deploy` local e conferida byte a byte) e `check-due-bills` (criou uma notificação real e válida no teste, no sininho do app). Publicada mas sem uso: `categorize-expense` (recurso descontinuado, ver abaixo).
- **Correção em 30/08/2026 (achado do usuário)**: "generate-recurring" e "check-due-bills" terem sido validadas por invocação manual não significava que estavam realmente em produção — nenhuma das duas tinha agendamento (`cron.job` estava vazio, apesar de `pg_cron` e `pg_net` já estarem instalados no projeto). Isso é a causa raiz confirmada do bug relatado pelo usuário "recorrência fixa só aparece no primeiro mês": a projeção visual no app (mês a mês, em `buildEffectiveMonthExpenses`) sempre funcionou corretamente, mas nada materializava a ocorrência real no banco para os meses seguintes, então notificações, push e qualquer leitura direta do banco (inclusive MCP) nunca viam a recorrência além do mês em que foi criada manualmente. Parcelamento (`installments`) não é afetado — todas as parcelas são inseridas de uma vez na criação, sem depender de job nenhum. Corrigido agendando dois cron jobs diários via `pg_cron`/`pg_net` (`generate-recurring-daily` às 03:05 UTC, `check-due-bills-daily` às 03:10 UTC — meia-noite e 00:10 em Brasília). Ambos testados por invocação manual após o agendamento: `generate-recurring` respondeu `success:true` (todas as 12 recorrências existentes puladas por já terem origem no mês corrente ou já estarem materializadas — comportamento correto), `check-due-bills` criou uma notificação real e válida.
- **Lição de processo**: "a função roda sem erro quando eu chamo manualmente" não é o mesmo que "a função está de fato agendada em produção". Sempre conferir `cron.job` (ou o equivalente) antes de considerar uma função dependente de agendamento como funcional.
- **Correção em 30/08/2026 (achado do usuário, segunda parte)**: depois de agendar o cron, o usuário reportou que uma recorrência fixa **no cartão de crédito** ("Claude") só aparecia numa única fatura (outubro), mesmo tendo sido criada em agosto. Causa: `generate-recurring` materializava recorrências de cartão usando a data de calendário (mês corrente do servidor) para decidir o `invoice_month` da cópia gerada, ignorando o fechamento do cartão. Como o fechamento desse cartão é dia ~29 (dia do vencimento menos dias antes do vencimento), uma compra fixa no dia 30 sempre cai na fatura **dois meses à frente** da data de lançamento (compra 30/08 → fatura de outubro), e o restante do fluxo nunca sabia disso — cada execução tentava gerar uma cópia para o "mês atual" em vez de avançar por fatura. Corrigido reescrevendo o trecho de cartão de `generate-recurring` para avançar a partir do próprio `invoice_month` do molde, usando a mesma regra de fechamento/vencimento já usada no cliente (`src/lib/invoiceHelpers.ts` `getPaymentDate`). Validado com dado real em produção: o molde "Game Pass" (fatura de origem 2026-09) gerou corretamente a ocorrência da fatura 2026-10 ao rodar a função em 31/08. Parcelamento continua não afetado.
- **Resolvido em 30/08/2026 (mesma sessão)**: o motor de projeção visual de recorrência de cartão (`src/lib/recurringCardProjection.ts`) foi ligado a `matchExpensesToInvoice` (`src/lib/invoiceHelpers.ts`), a função central usada por Carteira, Histórico e o resumo de cartões. Recorrência fixa de cartão agora aparece na hora em qualquer fatura futura ainda não materializada, igual ao lado débito, sem depender do cron rodar primeiro. Nunca duplica: se o cron já materializou a fatura, a projeção virtual é descartada. Convenção usada: a ocorrência virtual reaproveita o MESMO id do molde (igual ao lado débito em `buildEffectiveMonthExpenses`), só sobrescrevendo `invoice_month`/`date`/`is_paid` — isso é o que torna editar/excluir seguro.
  - Como isso torna essas ocorrências alcançáveis por editar/excluir pela primeira vez, também corrigido: excluir uma recorrência de cartão pela fatura (`InvoiceDetailsModal`) ou pelo extrato desagrupado (`TransactionFeed`, modo "Desagrupado") nunca apaga o molde inteiro por engano — usa `deleteSingleCardRecurringOccurrence`, que só registra uma exceção para aquela fatura específica (ou avança o molde, se for a fatura atual dele). Validado na UI real: o diálogo mostra "Remover desta fatura? Isso remove [descrição] apenas da fatura de [mês]. A recorrência continua normalmente nas próximas faturas."
  - Cobertura de teste: `src/test/recurringCardProjection.test.ts` (aritmética de fatura, round-trip da data de compra, projeção ponta a ponta via `matchExpensesToInvoice`, dedução contra materialização real).
- **Resolvido em 31/08/2026**: o risco correlato acima (editar uma recorrência de cartão e escolher "Todas as recorrências" caindo na lógica de data de calendário) foi corrigido. `EditExpenseModal.tsx` agora tem um caminho dedicado para moldes com `credit_card_id`: desativa o molde antigo, limpa cópias não pagas já materializadas a partir da fatura de corte (preservando as pagas) e cria o novo molde com a fatura correta — espelhando campo a campo o fluxo de débito, só trocando data de calendário por `invoice_month`. Nova função pura `resolveCardSplitSeriesCutoffLabel` (em `recurringCardProjection.ts`) calcula o corte (menor entre a fatura clicada e a nova) com 5 testes cobrindo mesma fatura, fatura posterior, anterior e virada de ano. Trabalho feito numa sessão paralela (task em background), revisado linha a linha nesta sessão antes de aplicar (lógica financeira sensível), e verificado de novo aqui: typecheck limpo, 115/115 testes, build OK.
- `LOVABLE_API_KEY` (usada por `categorize-expense` e `chat-genius`) não existe no projeto Supabase independente atual — era provisionada automaticamente pela plataforma Lovable. O usuário decidiu descontinuar os dois recursos de IA (chat in-app e sugestão automática de categoria) em vez de contratar um provedor próprio; os componentes de UI foram desmontados, mas o código e as funções de servidor permanecem no repositório.
- `VAPID_PRIVATE_KEY` (usada por `send-push`, chamada internamente por `check-due-bills`) também não existe no projeto novo — confirmado por teste real (`{"error":"VAPID_PRIVATE_KEY not configured"}`). `check-due-bills` ainda funciona para criar notificações dentro do app; só o envio de push físico falha, silenciosamente. Sem decisão tomada sobre reativar esse recurso.
- O bundle web publicado na Vercel (produção) estava compilado contra o projeto Supabase antigo (`nvskvrgsfzaynotdgzoy`) até 30/08/2026. Corrigido: usuário atualizou as variáveis de ambiente, um push disparou novo deploy, e o bundle publicado foi conferido — já não contém nenhuma referência ao projeto antigo.

## Segurança e dados pessoais

- Nunca registrar valores, IDs, planilhas ou extratos completos em logs, comentários ou documentação compartilhada.
- Para teste de importação, usar base descartável, cópia ou lançamento de valor mínimo que possa ser removido e auditado.
- Não limpar ou recriar dados reais durante teste de importação.
