# Refinamento visual dos modais: campos integrados ao fundo escuro

## Contexto
O modal "Nova Transação" usa o estilo `.glass-modal` com fundo escuro translúcido, mas os campos de input ainda aparecem como blocos cinza claros que contrastam demais e não combinam com o vidro escuro. O campo de valor, em especial, chama atenção com uma caixa cinza que quebra a coesão visual.

## Decisões tomadas
- Campos devem ficar **totalmente integrados** ao fundo do modal: sem blocos cinza, apenas bordas sutis.
- O campo de valor mantém uma **caixa sutil**, mas alinhada ao tom escuro/translúcido do modal.
- A mudança se aplica a **todos os modais, drawers e sheets** da plataforma para manter consistência.

## O que será feito

### 1. Revisar o token `.glass-modal` em `src/index.css`
- Ajustar o gradiente/fundo para um tom mais uniforme e menos acinzentado.
- Reduzir a saturação do fundo para que os inputs não precisem de contraste cinza para serem legíveis.
- Manter o blur e a borda de vidro.

### 2. Criar estilo de input integrado para modais escuros
- Adicionar utilitários ou ajustar as regras filhas de `.glass-modal` para:
  - `input`, `textarea`, `select`, `[role="combobox"]` com fundo transparente ou `hsl(0 0% 100% / 0.04)`.
  - Bordas de `hsl(0 0% 100% / 0.10)` a `0.14`.
  - Cor do texto em branco/cinza muito claro.
  - Placeholder em tom médio.
  - Estados `focus` e `hover` com elevação sutil da borda (primary ou branco).

### 3. Redesenhar o campo de valor no `AddExpenseModal.tsx`
- Substituir a caixa cinza atual por uma área delimitada com:
  - Fundo escuro/translúcido alinhado ao modal.
  - Borda fina e sutil.
  - Tipografia grande e clara.
  - Indicador de tipo (R$) e ícone de calculadora integrados sem peso visual excessivo.
- Manter o comportamento da calculadora rápida e do QuickCalculator.

### 4. Atualizar componentes de UI compartilhados
- `src/components/ui/dialog.tsx`: garantir que `DialogContent` use `.glass-modal` corretamente.
- `src/components/ui/drawer.tsx`: mesmo ajuste para o drawer mobile.
- `src/components/ui/sheet.tsx`: verificar e aplicar o mesmo padrão de vidro escuro.
- `src/components/ui/input.tsx`, `select.tsx`, `textarea.tsx`, `switch.tsx`, `badge.tsx`: revisar cores para garantir legibilidade dentro do modal escuro.

### 5. Revisar componentes internos do modal
- `CategoryPicker`, `DescriptionAutocomplete`, `Accordion` de recorrência, toggles de pagamento e recorrência.
- Garantir que fundos secundários, badges e divisores dentro do modal usem tons escuros com bordas sutis, nunca cinza claro.

### 6. Validação de contraste
- Verificar legibilidade no modo escuro e no modo claro (se o modal for reutilizado em contextos claros).
- Garantir que labels, placeholders e valores tenham contraste adequado.

## Escopo fora desta tarefa
- Não alterar a lógica de criação/edição de transações.
- Não adicionar novos campos ou funcionalidades.
- Não mudar a estrutura de navegação.

## Critério de aceitação
- O modal "Nova Transação" exibe campos integrados ao fundo escuro, sem blocos cinza claros.
- O campo de valor mantém destaque sutil, mas visualmente coeso com o restante do modal.
- Todos os modais/drawers/sheets da plataforma seguem o mesmo padrão visual.
- Textos e placeholders permanecem legíveis em ambos os temas.