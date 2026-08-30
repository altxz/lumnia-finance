# Lumnia Calm Intelligence Design System

## Status

- Direção aprovada em 24/08/2026.
- Implementação inicial: Etapa 1 do roadmap.
- Fonte da plataforma: Inter.
- Princípio: clareza financeira antes de decoração.

## 1. Princípios

1. Hierarquia por espaço, tipografia e contraste antes de cor.
2. Uma ação principal por contexto.
3. Conteúdo permanente em superfícies sólidas.
4. Vidro somente em navegação, menus, popovers, tooltips e modais.
5. Um gradiente de marca, usado no máximo uma vez por tela.
6. Verde significa resultado positivo ou sucesso.
7. Vermelho significa despesa, erro ou risco.
8. Âmbar significa atenção ou estado intermediário.
9. Roxo significa marca, seleção ou ação principal.
10. Movimento explica mudança de estado e nunca atrasa a interação.

## 2. Paleta semântica

### Light

| Token | Valor aproximado | Uso |
|---|---|---|
| Background | `#F6F7F9` | Canvas |
| Foreground | `#17151F` | Texto principal |
| Card | `#FFFFFF` | Conteúdo permanente |
| Primary | `#6D5CE7` | Ação e seleção |
| Muted foreground | `#676470` | Texto secundário |
| Success | `#187C5E` | Positivo e confirmação |
| Destructive | `#CC3D4E` | Despesa, erro e risco |
| Warning | `#935C10` | Atenção |

### Dark

| Token | Valor aproximado | Uso |
|---|---|---|
| Background | `#0F1014` | Canvas |
| Foreground | `#F3F2F6` | Texto principal |
| Card | `#17181D` | Conteúdo permanente |
| Primary | `#A18FFF` | Ação e seleção |
| Muted foreground | `#AAA7B2` | Texto secundário |
| Success | `#58CAA2` | Positivo e confirmação |
| Destructive | `#F36C7C` | Despesa, erro e risco |
| Warning | `#F3B75E` | Atenção |

## 3. Contraste validado

| Par | Contraste aproximado | Resultado |
|---|---:|---|
| Light foreground sobre background | 16,84:1 | AAA |
| Light muted sobre background | 5,39:1 | AA para texto normal |
| Branco sobre primary light | 4,84:1 | AA para texto normal |
| Branco sobre success light | 5,14:1 | AA para texto normal |
| Branco sobre destructive light | 4,83:1 | AA para texto normal |
| Dark foreground sobre background | 17,06:1 | AAA |
| Dark muted sobre background | 8,04:1 | AAA |
| Foreground escuro sobre primary dark | 6,86:1 | AA |

Os valores foram calculados segundo a fórmula de luminância relativa WCAG. Variações com transparência devem ser testadas sobre o fundo real.

## 4. Tipografia

| Papel | Mobile | Desktop | Peso | Uso |
|---|---:|---:|---:|---|
| Display | 32 px | 40 px | 600 | Valor ou mensagem principal excepcional |
| Title 1 | 28 px | 32 px | 600 | Título de página |
| Title 2 | 20 px | 24 px | 600 | Seção principal |
| Title 3 | 16 px | 18 px | 600 | Card e subseção |
| Body | 14 px | 16 px | 400 | Conteúdo corrente |
| Label | 12 px | 12 px | 600 | Campo e controle |
| Caption | 12 px | 12 px | 500 | Metadado |

Regras:

- Valores financeiros usam números tabulares quando a comparação vertical exigir alinhamento.
- Caixa alta deixa de ser padrão para títulos e navegação.
- Eyebrows podem usar caixa alta apenas quando curtos e funcionais.
- Texto não deve ser reduzido para corrigir layout. Deve quebrar, truncar com contexto ou reorganizar a composição.

## 5. Espaçamento e forma

- Unidade base: 4 px.
- Espaçamentos preferidos: 4, 8, 12, 16, 20, 24, 32 e 40 px.
- Raio XS: 10 px.
- Raio SM: 12 px.
- Raio MD: 16 px.
- Raio LG: 20 px.
- Raio XL: 24 px.
- Cápsula: somente botões, filtros e controles segmentados.
- Círculo: somente ícones e ações isoladas com largura igual à altura.
- Área mínima de toque: 44 por 44 px.

## 6. Superfícies

| Superfície | Tratamento |
|---|---|
| Canvas | Cor sólida neutra |
| Card base | Sólido, borda sutil, sombra mínima |
| Card elevado | Sólido, sombra moderada |
| Superfície rebaixada | Tonal, sem blur |
| Menu ou popover | Vidro funcional com blur de 20 px |
| Modal ou bottom sheet | Vidro funcional com blur de 24 px |
| Navegação flutuante | Vidro funcional com blur de 22 px |

## 7. Componentes-base

### Button

- Altura mínima de 44 px.
- Texto semibold.
- Estado ativo com escala de 0,98.
- Gradiente apenas na variante explícita `gradient`.

### Input, Select e Textarea

- Fundo sólido de card.
- Raio MD.
- Foco por borda e halo de baixa opacidade.
- Placeholder com contraste secundário.
- Sem blur.

### Card e Surface

- `Card` permanece compatível com usos existentes.
- `Surface` é o contrato novo para superfícies base, elevadas, rebaixadas e flutuantes.
- Cards de conteúdo não usam vidro.

### StatePanel

- Contrato para vazio, erro e offline.
- Título, descrição, ícone e ação de recuperação opcionais.
- O tom altera significado sem depender apenas da cor.

### Overlay

- Dialog, Drawer, Popover e Select compartilham raio, sombra, blur e movimento.
- A ação de fechar possui área mínima de 44 px.

## 8. Movimento

- Rápido: 120 ms.
- Padrão: 180 ms.
- Lento: 280 ms.
- Curva padrão: `cubic-bezier(0.2, 0, 0, 1)`.
- Curva enfatizada: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- `prefers-reduced-motion` continua obrigatório.
- Skeleton representa a estrutura real e deve ser substituído progressivamente conforme os blocos carregam.

## 9. Restrições para as próximas etapas

1. Nenhuma página pode introduzir um valor de cor direto se existir token semântico equivalente.
2. Nenhum card de conteúdo novo pode usar blur.
3. Nenhum gráfico pode depender apenas da cor para distinguir séries.
4. Nenhuma ação crítica pode ter menos de 44 por 44 px no mobile.
5. Nenhuma etapa é concluída sem validação light, dark e Galaxy S22 Ultra.

## 10. Integração Android

- A barra de status e a barra de navegação seguem o tema resolvido pelo aplicativo.
- Tema light usa ícones escuros sobre o canvas `#F6F7F9`.
- Tema dark usa ícones claros sobre o canvas `#0F1014`.
- A sincronização é feita pelo plugin nativo `SystemBars`, acionado pelo `SystemBarsSync` quando o tema muda.

## 11. Validação da Etapa 1

- TypeScript da aplicação: aprovado.
- TypeScript da configuração: aprovado.
- Lint crítico: aprovado.
- Testes: 87 aprovados em 11 arquivos.
- Build web: aprovado.
- Capacitor sync Android: aprovado.
- Build Android debug: aprovado.
- Galaxy S22 Ultra light: aprovado.
- Galaxy S22 Ultra dark: aprovado.
- Barra de status light e dark: aprovada após correção nativa.

Evidências visuais em [`design-system-validation`](design-system-validation/).
