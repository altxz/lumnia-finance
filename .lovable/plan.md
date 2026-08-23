# Centro de Crédito: pilha de cartões arrastável

Substituir os botões de troca de cartão por uma pilha de cartões empilhados (estilo da referência), onde arrastar o cartão da frente traz o próximo para o primeiro plano.

## O que muda visualmente

- Painel com fundo escuro translúcido (vidro), título "Meus cartões" à esquerda e a lista de transações recentes da fatura à direita, como na imagem.
- Todos os cartões cadastrados aparecem empilhados e levemente deslocados/rotacionados atrás do cartão ativo, cada um com o gradiente do banco já existente.
- O cartão da frente mostra: nome do cartão, últimos dígitos mascarados (`•••• 8702`), fechamento/vencimento, valor da fatura e limite.
- Arrastar (mouse ou toque) o cartão para o lado troca o cartão ativo, com animação de retorno se o arraste for curto. Pontinhos (dots) abaixo da pilha indicam o cartão ativo e permitem tocar para alternar (acessibilidade/teclado).
- Botão "Ver fatura completa" permanece, junto de "Pagar fatura" quando aplicável.
- Indicadores existentes (limite utilizado, transações, vencimento, melhor dia de compra) ficam mantidos, reorganizados ao lado da pilha.

## Comportamento

- A fatura exibida sempre corresponde ao cartão em primeiro plano e ao mês selecionado globalmente.
- Editar/excluir transação da fatura, pagar fatura e o modal de fatura completa continuam funcionando exatamente como hoje.
- Com um único cartão, a pilha mostra apenas ele (sem dots e sem arraste).
- Sem cartões cadastrados, mantém a mensagem atual de estado vazio.

## Detalhes técnicos

- Alterar apenas `src/components/analytics/CreditCardSummary.tsx` (apresentação) e extrair a pilha para `src/components/analytics/CreditCardStack.tsx`.
- Estado `selectedCardIdx` permanece a fonte de verdade; a pilha recebe `cards`, `invoices`, `activeIndex` e `onChange`.
- Arraste com eventos de ponteiro nativos (`onPointerDown/Move/Up`) + `transform` via Tailwind/inline style: sem novas dependências. Limiar de ~60px para confirmar a troca.
- Cores/gradientes vindos do `CARD_GRADIENTS` atual e tokens do design system (`glass-modal`/`glass-soft`); nenhuma cor fixa nova.
- Nenhuma mudança em queries, hooks financeiros ou banco de dados.
