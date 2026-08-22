# Correção: editar uma ocorrência futura apaga o mês passado

## O que está a acontecer

Quando ativa a recorrência fixa numa transação já paga (ex.: Condomínio de agosto), essa própria linha do banco passa a ser o "molde" da série. Os meses seguintes (setembro, outubro...) são projeções desse molde — não são linhas próprias no banco.

Ao editar a ocorrência de setembro e mudar a data de 17 para 10, o sistema gravou a nova data **na própria linha de agosto**. Resultado: a despesa paga de agosto desapareceu de agosto e reapareceu como o lançamento de setembro (e ainda perdeu o estado "pago").

Confirmado nos dados da sua conta:
- `Condomínio`: o molde mensal está com data 10/09 e valor 660,00, criado no momento em que ativou a recorrência — era a linha de agosto. Depois recriou manualmente a de 17/08.
- `Adiantamento`: mesmo padrão — o molde mensal ficou com data 15/09 e a linha original de julho teve de ser recriada.

Isto acontece com qualquer transação (despesa ou receita) nessa sequência: recorrência ativada num mês já pago + edição de uma ocorrência futura.

## Correção

1. **Nunca reescrever o molde quando a edição é de uma ocorrência projetada.** Ao editar setembro com "aplicar às próximas", usar o caminho de "divisão de série" que já existe: encerrar o molde antigo a partir do mês editado, registar as exceções dos meses futuros e criar um molde novo com a nova data/valor. Os meses anteriores (incluindo o pago de agosto) ficam intactos.
2. **Separar "ativar recorrência" de "editar recorrência existente".** Hoje o ramo que grava `is_recurring = true` na linha original também é executado para transações que já são recorrentes, o que causa a sobregravação da data. Passa a valer só para transações que ainda não são recorrentes.
3. **Proteger a data e o estado de pagamento do molde.** Quando a ocorrência editada não é a linha real do banco, a atualização direta dessa linha nunca inclui `date` nem `is_paid`.
4. **Regra igual na IA e na integração.** O mesmo cuidado é aplicado em `update_transaction` (integração externa) e no chat interno, para não abrirem o mesmo buraco.

## Detalhes técnicos

- `src/components/EditExpenseModal.tsx`: reordenar as condições de `doSave`. O ramo `wantInstallment && installmentMode === 'fixed'` passa a exigir `!expense.is_recurring`. Para `expense.is_recurring` (mesmo com `wantInstallment` ativo) o fluxo vai sempre para o tratamento de escopo: `single` → lançamento avulso + exceção; `all` → divisão de série (exceções futuras via `buildFutureRecurringExceptionDates`, desativação do molde antigo, limpeza só de cópias não pagas, inserção do molde novo).
- Usar `isProjectedOccurrence` (já calculado no modal) como guarda: se `true`, nenhum `update` direto na linha `expense.id` pode conter `date`/`is_paid`.
- `src/lib/mcp/tools/update-transaction.ts` e `supabase/functions/chat-genius/_shared/extendedTools.ts`: aplicar a mesma guarda ao ativar/editar recorrência com mudança de data.
- Teste em `src/test/recurringFutureExceptions.test.ts`: cenário "molde pago no mês N, edição da ocorrência N+1 com nova data" garantindo que a data do molde original não muda e que o mês N continua com a linha paga.

## Limpeza dos dados já afetados

Além do código, corrigir as duas séries já danificadas: devolver o molde do `Condomínio` e do `Adiantamento` para as datas/estados corretos e remover as linhas duplicadas que criou manualmente para compensar, mantendo o histórico dos meses anteriores.
