# Auditoria de cálculo financeiro

Data: 26/08/2026
Status: implementação validada por tipos, build web, testes automatizados e instalação no Galaxy S22 Ultra.

## Contrato único

- `value` representa sempre a magnitude monetária. O tipo da transação define o sentido financeiro.
- Receita aumenta o caixa.
- Despesa reduz o caixa.
- Transferência só muda o total quando entra ou sai de uma carteira de investimento.
- Compra no cartão não reduz caixa na data da compra. O caixa é reduzido no pagamento ou vencimento da fatura.
- Saldo de conta e poupança é derivado das movimentações pagas, não de `wallets.current_balance`.

## Correções aplicadas

1. Criado `transactionAmount`, que converte entradas negativas de importações legadas para magnitude positiva.
2. Centralizados cálculos de saldo diário, projeção mensal, carteira, fatura, orçamento, categorias, dashboard, projetos e gráficos analíticos nessa regra.
3. Removida a atualização parcial de `current_balance` no pagamento de fatura. Ela ignorava o próprio pagamento por possuir `credit_card_id`.
4. Cobertura de caixa passou a usar saldos calculados pelas movimentações.
5. Snapshot de patrimônio e consultas da IA passaram a normalizar valores. Consultas de contas e patrimônio da IA recalculam contas de caixa a partir do histórico pago; investimentos preservam a cotação/saldo da carteira de investimento.
6. Corrigida a semântica de `previousMonth.balance`: agora representa o resultado do mês anterior, e não o saldo inicial do mês atual.

## Cenário observado

Na captura reportada, o saldo diário está aritmeticamente correto:

`R$ 4.537,49 - R$ 41,90 = R$ 4.495,59`.

O risco confirmado não estava nesse registro, mas em rotas secundárias que podiam interpretar uma despesa negativa como entrada ou consultar saldo persistido desatualizado.

Na validação física após a atualização, a lista retornou lançamentos até 23/08. O registro de 24/08 da captura anterior havia sido removido pelo usuário, portanto sua ausência é esperada e não representa divergência de consulta ou cálculo.

## Cobertura automatizada

- Valores positivos, negativos, texto numérico e inválidos.
- Despesa legada negativa reduz carteira e projeção.
- Receita legada negativa continua sendo receita.
- Débito, transferência, compra no cartão, pagamento de fatura e continuidade mensal.

## Limites conhecidos

- O APK de depuração foi instalado e abriu sem exceções no Galaxy S22 Ultra.
- A validação física confirmou que a ausência do lançamento de 24/08 era esperada após sua remoção.
- Funções de servidor atualizadas precisam ser publicadas no Supabase para refletir a mesma regra na IA e nos snapshots remotos.

## Reconciliação da restauração de dados em 29/08/2026

### Escopo

- Origem auditada: planilha de exportação do Lumnia com 665 lançamentos e 174 compras no cartão.
- Destino auditado: base Supabase própria atualmente utilizada pelo aplicativo.
- Método: comparação de quantidade, cartão, mês de fatura e valor de cada compra, além do total agregado das faturas.

### Divergências encontradas

1. As 174 compras no cartão tinham `invoice_month` no formato `MM/AAAA`, enquanto o aplicativo consulta `AAAA-MM`. Com isso, faturas passadas podiam não aparecer na tela e nos cálculos dependentes delas.
2. O pagamento da fatura Nubank de R$ 1.856,32 foi importado como compra vinculada ao cartão. A origem o classifica como pagamento de fatura em conta, portanto a associação criava duplicidade na fatura de abril.

### Correções aplicadas

1. Normalizados os 174 meses de fatura para `AAAA-MM`.
2. Removido o vínculo de cartão do pagamento de fatura, preservando o lançamento como saída de caixa.
3. Atualizado o importador para aceitar `AAAA-MM`, `MM/AAAA` e valores de data compatíveis, convertendo todos para o formato único `AAAA-MM` antes de persistir.

### Resultado verificado

| Verificação | Resultado |
|---|---:|
| Compras de cartão da planilha | 174 |
| Compras correspondentes na base | 174 |
| Cartões divergentes | 0 |
| Meses de fatura divergentes | 0 |
| Valores divergentes | 0 |
| Total das compras de cartão na planilha | R$ 51.061,84 |
| Total correspondente na base | R$ 51.061,84 |
| Faturas esperadas | 28 |
| Faturas encontradas na base | 28 |
| Compras extras no cartão | 0 |

### Evidência de entrega Android

- Build web concluído e sincronizado ao projeto Android.
- Bundle copiado para o Android confirmado com a regra de normalização.
- APK de depuração gerado, instalado sobre o aplicativo existente e aberto no Galaxy S22 Ultra sem exceção fatal registrada.

### Pendências reais

1. A importação completa pelo seletor Android ainda não foi executada contra uma base descartável ou cópia de segurança. Isso permanece pendente para validar prévia, progresso, retorno do seletor e persistência sem arriscar a base reconciliada.
2. O cliente MCP conectado ao ChatGPT apresenta identificadores diferentes dos existentes na base Supabase atual. Ele precisa ser reconectado antes de ser utilizado em qualquer nova auditoria financeira.
