# Revisão completa do modo claro

Hoje vários elementos ficam escuros mesmo no tema claro: as janelas (modais/drawers) usam um vidro grafite fixo, o menu lateral é um rail escuro, e muitos componentes escrevem cores fixas (`text-white`, `bg-white/5`) que só funcionam sobre fundo escuro. O objetivo é deixar o modo claro realmente claro, com textos de alto contraste, mantendo o modo escuro como está hoje.

## O que muda

### 1. Janelas (Nova Transação, Editar, Carteira, Investimentos…)
- No modo claro: vidro branco translúcido, borda lilás suave, texto escuro (`foreground`) e campos levemente acinzentados/lilás para se destacarem do fundo branco.
- No modo escuro: continua o vidro grafite atual.
- Campo de valor, seletores de tipo (Despesa/Receita/Transf.), toggles Débito/Crédito, resumo de parcelas, acordeões e tags passam a usar tokens semânticos, então trocam de cor junto com o tema.

### 2. Menu lateral claro
- No modo claro o rail passa a ser branco/lilás claro com texto escuro, item ativo em laranja/roxo da marca e labels legíveis (hoje o cinza claro sobre branco fica ilegível).
- No modo escuro segue grafite.
- Ajuste vale também para o menu lateral mobile (drawer) e para o cabeçalho.

### 3. Contraste de textos
- Revisão dos tokens de texto secundário no claro para garantir contraste mínimo AA.
- Cards de resumo, categorias, orçamentos, pilha de cartões de crédito, feed de transações e legendas de gráficos revisados para não depender de branco fixo.

### 4. Verificação
Captura de telas no modo claro e escuro (Dashboard, Transações, Carteira, Orçamento, Investimentos, Categorias, Configurações, além dos modais Nova Transação / Editar / Ajustar saldo) para confirmar que nada ficou escuro por engano nem ilegível.

## Detalhes técnicos

- `src/index.css`
  - `.glass-modal`: versão clara por padrão (gradiente de `--card`, borda `--border`, `color: hsl(var(--foreground))`) e sobrescrita `.dark .glass-modal` com o grafite atual.
  - Todas as regras filhas `.glass-modal input/textarea/[role=combobox]/.bg-secondary/[data-state]/.value-box` deixam de usar `hsl(0 0% 100% / x)` e passam a usar `hsl(var(--muted))`, `hsl(var(--border))`, `hsl(var(--foreground))`, com variantes `.dark .glass-modal …` mantendo os valores brancos translúcidos.
  - Tokens `--sidebar-*` do `:root` reescritos para a paleta clara (fundo `0 0% 100%`/lilás muito claro, foreground `0 0% 17%`, `--sidebar-muted` ~`0 0% 40%`); bloco `.dark` permanece.
  - Revisar `--muted-foreground` no claro (hoje `0 0% 36%`) e tokens de badge/legenda que ficaram baixos de contraste.
- Componentes com cores fixas a converter para tokens (`bg-muted/60`, `border-border`, `text-foreground`, `text-muted-foreground`, ou pares `bg-foreground/5 dark:bg-white/5`):
  - `src/components/AddExpenseModal.tsx`, `EditExpenseModal.tsx`, `QuickAddModal.tsx`
  - `src/components/wallet/AdjustBalanceModal.tsx`
  - `src/components/investments/InvestmentMovementModal.tsx`, `InvestmentFormModal.tsx`
  - `src/components/analytics/CreditCardStack.tsx` (mantém texto branco apenas sobre o plástico colorido do cartão)
  - `src/components/budget/BudgetSummaryCards.tsx`, `src/pages/HistoryPage.tsx`
  - `src/components/AppSidebar.tsx` e `DashboardHeader.tsx` para usar apenas tokens `sidebar-*`.
- Sem mudanças de lógica financeira, queries ou banco de dados — apenas apresentação.
