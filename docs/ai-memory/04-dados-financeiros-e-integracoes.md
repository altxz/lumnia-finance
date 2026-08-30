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
- O MCP privado `lumnia-mcp` foi publicado e responde metadados OAuth. A causa dos IDs divergentes vistos em 29/08/2026 foi isolada em 30/08: não é um problema de servidor — é o cliente autorizado no ChatGPT usando um token OAuth antigo. Corrigir exige desconectar e reconectar (novo login) o conector MCP no ChatGPT, não alterar código.
- A função e o script do MCP ainda usam `@lovable.dev/mcp-js`. Não remover esta dependência sem substituir e testar o protocolo de autenticação e todas as ferramentas.
- Auditoria de 30/08/2026 encontrou que apenas 3 das 8 funções de servidor do código-fonte estavam publicadas no projeto novo (`snapshot-net-worth`, `lumnia-mcp`, `lumnia-backup-import-once`). Publicadas nesta auditoria: `delete-account` (validada ponta a ponta com usuário descartável), `generate-recurring` (validada), `categorize-expense` (publicada, mas não funcional), `send-push` e `check-due-bills` (publicadas, validação ponta a ponta pendente). `chat-genius` recebeu correção de segurança crítica no código local (ver `02-falhas-e-correcoes.md`) e foi publicada via `supabase functions deploy` local (Node.js e a CLI do Supabase precisaram ser instalados nesta sessão). Os arquivos publicados foram baixados e comparados byte a byte com o código local: idênticos.
- `categorize-expense` e `chat-genius` dependem do secret `LOVABLE_API_KEY`, provisionado automaticamente pela plataforma Lovable. Esse secret não existe no projeto Supabase independente atual — as duas funções ficam indisponíveis até se decidir e configurar um provedor de IA próprio (proposta em avaliação: `OPENAI_API_KEY`).
- O bundle web publicado na Vercel (produção) estava compilado contra o projeto Supabase antigo (`nvskvrgsfzaynotdgzoy`) até esta auditoria, ou seja, o site publicado não lia a base de dados reconciliada. O usuário está corrigindo as variáveis de ambiente na Vercel diretamente.

## Segurança e dados pessoais

- Nunca registrar valores, IDs, planilhas ou extratos completos em logs, comentários ou documentação compartilhada.
- Para teste de importação, usar base descartável, cópia ou lançamento de valor mínimo que possa ser removido e auditado.
- Não limpar ou recriar dados reais durante teste de importação.
