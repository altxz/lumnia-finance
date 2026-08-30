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
- Auditoria de 30/08/2026 encontrou que apenas 3 das 8 funções de servidor do código-fonte estavam publicadas no projeto novo (`snapshot-net-worth`, `lumnia-mcp`, `lumnia-backup-import-once`). Publicadas e validadas ponta a ponta nesta auditoria: `delete-account` (usuário descartável: transação e conta removidas, confirmado por SQL), `generate-recurring`, `chat-genius` (corrigida quanto à autenticação, ver `02-falhas-e-correcoes.md`, publicada via `supabase functions deploy` local e conferida byte a byte) e `check-due-bills` (criou uma notificação real e válida no teste, no sininho do app). Publicada mas sem uso: `categorize-expense` (recurso descontinuado, ver abaixo).
- `LOVABLE_API_KEY` (usada por `categorize-expense` e `chat-genius`) não existe no projeto Supabase independente atual — era provisionada automaticamente pela plataforma Lovable. O usuário decidiu descontinuar os dois recursos de IA (chat in-app e sugestão automática de categoria) em vez de contratar um provedor próprio; os componentes de UI foram desmontados, mas o código e as funções de servidor permanecem no repositório.
- `VAPID_PRIVATE_KEY` (usada por `send-push`, chamada internamente por `check-due-bills`) também não existe no projeto novo — confirmado por teste real (`{"error":"VAPID_PRIVATE_KEY not configured"}`). `check-due-bills` ainda funciona para criar notificações dentro do app; só o envio de push físico falha, silenciosamente. Sem decisão tomada sobre reativar esse recurso.
- O bundle web publicado na Vercel (produção) estava compilado contra o projeto Supabase antigo (`nvskvrgsfzaynotdgzoy`) até 30/08/2026. Corrigido: usuário atualizou as variáveis de ambiente, um push disparou novo deploy, e o bundle publicado foi conferido — já não contém nenhuma referência ao projeto antigo.

## Segurança e dados pessoais

- Nunca registrar valores, IDs, planilhas ou extratos completos em logs, comentários ou documentação compartilhada.
- Para teste de importação, usar base descartável, cópia ou lançamento de valor mínimo que possa ser removido e auditado.
- Não limpar ou recriar dados reais durante teste de importação.
