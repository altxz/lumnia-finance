# Etapa 3: auditoria e redesign de Transações

## Status

Etapa iniciada em 25/08/2026 na branch `codex/android-capacitor`. O primeiro checkpoint visual foi implementado e validado no Galaxy S22 Ultra. A etapa permanece aberta.

## Escopo funcional preservado

- Consulta mensal e saldo diário.
- Pesquisa por descrição.
- Filtros por categoria e tipo.
- Agrupamento de compras por fatura.
- Edição e exclusão.
- Confirmação e reversão de pagamento.
- Recorrências, parcelas e exceções.
- Exportação CSV.
- Detalhes e pagamento de faturas.

## Problemas encontrados no baseline

1. Resumo financeiro dividido em três cartões estreitos, com pouca hierarquia entre saldo, entradas e saídas.
2. Painel de transações visualmente desconectado do restante do produto.
3. Busca e filtros quebravam em linhas sem uma ordem clara no mobile.
4. Três ações permanentes em cada lançamento competiam com descrição, valor e estado.
5. Cabeçalhos diários fixos podiam colidir com o cabeçalho do aplicativo durante a rolagem.
6. Padrões diferentes entre lista, recorrentes, confirmação de pagamento, edição, exclusão e faturas.

## Arquitetura aplicada no checkpoint 1

1. Título explícito da área de Atividade.
2. Seletor de mês.
3. Um único resumo financeiro com saldo como informação principal e entradas e saídas como contexto.
4. Segmentação entre lançamentos e recorrentes.
5. Busca em largura total e filtros em duas colunas.
6. Lista agrupada por dia com saldo diário preservado.
7. Um menu contextual por lançamento para confirmar, reverter, editar ou excluir.

## Evidências

- `transactions-baseline-top.png`: baseline do topo antes da Etapa 3.
- `transactions-baseline-list.png`: baseline da lista com ações permanentes.
- `transactions-checkpoint-1.png`: nova hierarquia do topo, resumo e busca.
- `transactions-checkpoint-list.png`: nova densidade da lista e filtros.
- `transactions-checkpoint-menu.png`: menu contextual com ações financeiras preservadas.

## Validação do checkpoint 1

| Verificação | Resultado |
|---|---|
| TypeScript | Aprovado |
| Lint dos arquivos alterados | 0 erros, 9 avisos preexistentes de tipagem |
| Build web de produção | Aprovado |
| Capacitor sync Android | Aprovado |
| Build Android debug | Aprovado |
| Instalação preservando dados | Aprovada |
| Galaxy S22 Ultra dark | Aprovado |
| Menu contextual | Aprovado |

## Próximo bloco

1. Confirmações de pagamento e exclusão.
2. Importação, captura bancária e faturas.
3. Estados loading, vazio, erro e offline.
4. Tema light, celular estreito e desktop.

## Checkpoint 2: criação, edição e parcelamento

- Drawer mobile ampliado de 85% para 92% da altura útil.
- Título contextual para despesa, receita e transferência.
- Rodapé de ação unificado e separado da área rolável.
- Formulário descartado ao cancelar ou fechar, evitando rascunhos antigos na próxima abertura.
- Valor zero, negativo ou inválido bloqueado antes de qualquer gravação.
- Data vazia bloqueada antes de qualquer gravação.
- Parcelamentos com valor total agora distribuem os centavos entre as parcelas e preservam exatamente o total informado.
- A mesma regra foi aplicada à criação e à conversão de uma transação existente em parcelamento.

### Evidências adicionais

- `transaction-create-baseline.png`: drawer anterior com menor área útil.
- `transaction-transfer-baseline.png`: fluxo de transferência preservado.
- `transaction-create-checkpoint.png`: drawer ampliado, título contextual e categoria visível antes do rodapé.
- `transaction-zero-validation.png`: bloqueio explícito de valor igual a zero, sem gravação.

### Validação automatizada do checkpoint 2

| Verificação | Resultado |
|---|---|
| Testes de parcelamento | 3 aprovados |
| Testes de recorrência e exceções | 40 aprovados |
| Total do bloco | 43 testes aprovados |
| TypeScript | Aprovado |
| Lint dos arquivos alterados | 0 erros, 4 avisos preexistentes de tipagem |
| Build web | Aprovado |
| Build Android | Aprovado |
| Instalação no Galaxy S22 Ultra | Aprovada |
| Bloqueio de valor zero no Galaxy | Aprovado |

## Checkpoint 3: pagamento, exclusão, importação e faturas

- Exclusão de recorrências passou a usar o identificador estável do molde recorrente. Descrição, tipo e valor não são mais usados como chave, evitando apagar recorrências distintas que tenham conteúdo igual.
- Alterações de pagamento, recorrência, parcelas e exclusão agora incluem o usuário autenticado no filtro da operação.
- Desfazer pagamento de fatura passou a considerar também o cartão, evitando remover o pagamento de outro cartão no mesmo mês.
- Pagamento de fatura agora verifica se já existe um registro equivalente antes de inserir, impedindo pagamentos duplicados por toque repetido.
- Reimportação do mesmo extrato passou a ser identificada por uma impressão digital estável do arquivo, linha e destino.
- Duas linhas bancárias legítimas com mesma data, descrição e valor continuam preservadas porque a posição da linha faz parte da impressão digital.
- O cabeçalho da fatura perdeu o bloco saturado e passou a usar superfície neutra, com melhor hierarquia em dark e light.
- Ações permanentes de editar e excluir na fatura foram reunidas em menu contextual.
- Rodapés de pagamento e drawers foram alinhados ao padrão de superfície e altura útil da etapa.

### Validação automatizada do checkpoint 3

| Verificação | Resultado |
|---|---|
| Testes da impressão digital de importação | 3 aprovados |
| Testes de parcelamento executados em conjunto | 3 aprovados |
| Suíte completa | 93 testes aprovados em 13 arquivos |
| TypeScript | Aprovado |
| Lint dos arquivos alterados | 0 erros |
| Lint crítico de `src` | 0 erros |
| Build web de produção | Aprovado |
| Capacitor sync Android | Aprovado |
| Build Android debug | Aprovado |
| Instalação preservando dados | Aprovada |
| Inicialização no Galaxy S22 Ultra dark | Aprovada |

### Pendências antes de encerrar a Etapa 3

1. Validar visualmente importação e fatura no Galaxy S22 Ultra em dark e light.
2. Auditar estados loading, vazio, erro e offline.
3. Validar celular estreito e desktop.

### Evidência adicional

- `lumnia-checkpoint3.png`: inicialização do APK do checkpoint 3 no Galaxy S22 Ultra em dark, com área segura, cabeçalho, resumo e navegação preservados.

## Checkpoint 4: estados, responsividade e fechamento visual

- A busca passou a filtrar também as compras agrupadas em faturas. Faturas sem nenhuma transação correspondente não permanecem mais no resultado.
- O estado vazio agora explica se o período está realmente vazio ou se a busca e os filtros não encontraram resultados.
- O estado vazio filtrado oferece uma ação explícita para limpar busca, categoria e tipo.
- Falhas de atualização passaram a exibir mensagem de erro e ação de nova tentativa.
- O modo offline passou a informar que os dados em cache continuam visíveis, mas alterações exigem conexão.
- A aba de recorrentes passou a tratar falha de consulta e indisponibilidade offline.
- O resumo financeiro ganhou skeleton estrutural, evitando mostrar saldo zerado durante a primeira consulta.
- O backdrop dos drawers passou a usar superfície temática mais opaca com blur, eliminando a sobreposição visual de conteúdo.
- O drawer de fatura foi fixado em superfície temática sólida dentro do vidro funcional e validado em light e dark.
- Plurais de transações foram corrigidos no feed e no resumo por categoria da fatura.

### Validação do checkpoint 4

| Verificação | Resultado |
|---|---|
| Busca sem resultado com faturas agrupadas | Aprovada |
| Busca dentro de lançamentos e compras de cartão | Aprovada |
| Estado vazio contextual e limpeza de filtros | Aprovado |
| Loading do resumo e da lista | Aprovado |
| Tratamento de erro e retry | Implementado e aprovado por inspeção |
| Tratamento offline com dados em cache | Implementado e aprovado por inspeção |
| Celular estreito 360 px, light e dark | Aprovado no navegador autenticado |
| Desktop 1440 px light | Aprovado no navegador autenticado |
| Galaxy S22 Ultra, Atividade light e dark | Aprovado |
| Galaxy S22 Ultra, drawer de fatura light e dark | Aprovado |
| Drawer inicial de importação | Estrutura e conteúdo aprovados sem envio de arquivo |
| TypeScript | Aprovado |
| Lint crítico | 0 erros |
| Suíte completa | 93 testes aprovados em 13 arquivos |
| Build web de produção | Aprovado |
| Capacitor sync Android | Aprovado |
| Build Android debug | Aprovado |
| Instalação preservando dados | Aprovada |

### Evidências do checkpoint 4

- `tx-stage3-final-dark.png`: skeleton estrutural durante o carregamento no Galaxy.
- `tx-stage3-activity-dark.png`: Atividade em dark no Galaxy.
- `tx-stage3-activity-light.png`: Atividade em light no Galaxy.
- `tx-invoice-drawer-dark.png`: detalhes de fatura em dark no Galaxy.
- `tx-invoice-drawer-light.png`: detalhes de fatura em light no Galaxy.

### Pendências residuais

Nenhuma. A Etapa 3 foi encerrada após os testes reais abaixo.

### Fechamento da Etapa 3

| Verificação final | Resultado |
|---|---|
| Perda real de Wi-Fi e dados móveis no Galaxy S22 Ultra | Aprovada |
| Detecção por consulta real ao serviço, sem depender apenas de `navigator.onLine` | Aprovada |
| Aviso offline antes dos valores financeiros | Aprovado |
| Restauração automática de Wi-Fi e dados móveis após o teste | Confirmada |
| Importação descartável de uma despesa de R$ 0,01 | Aprovada |
| Reimportação do mesmo arquivo e destino | Bloqueada, permaneceu apenas uma transação |
| Exclusão do registro descartável | Confirmada |
| Saldo após limpeza | Restaurado de R$ 4.537,48 para R$ 4.537,49 |
| Saídas após limpeza | Restauradas de R$ 15.895,17 para R$ 15.895,16 |

Evidência visual adicional: `transactions-validation/tx-offline-fixed-clean.png`.

Durante o teste foi identificado um ciclo de renderização na página de Configurações. A causa era a identidade instável das funções retornadas por `useInvalidateUserSettings`; os callbacks passaram a ser memoizados para impedir que o efeito da página fosse executado continuamente.
