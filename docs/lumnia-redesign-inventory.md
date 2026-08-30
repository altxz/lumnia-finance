# Lumnia UI/UX Redesign Inventory

## 1. Escopo e método

- Data da auditoria: 24/08/2026.
- Branch avaliada: `codex/android-capacitor`.
- Dispositivo real: Samsung Galaxy S22 Ultra, Android, pacote `com.lumnia.finance`.
- Escopo: estrutura de navegação, páginas, superfícies sobrepostas, sistema visual, estados de interface e separação entre problemas visuais e funcionais.
- Esta etapa não redesenha a interface. Ela estabelece o baseline e os requisitos que impedirão alterações fragmentadas ou sem validação.
- A direção `Lumnia Calm Intelligence` continua como proposta até aprovação explícita.

## 2. Inventário de rotas

| Rota | Página | Papel no produto | Observação inicial |
|---|---|---|---|
| `/` | Dashboard | Resumo financeiro | Página principal, com alta densidade e excesso de destaques concorrentes. |
| `/auth` | AuthPage | Autenticação | Possui tratamento de erro, mas precisa entrar na matriz final de estados e acessibilidade. |
| `/categorias` | CategoriesPage | Gestão de categorias | Página extensa, com diálogos de criação, edição e exclusão. |
| `/categorias/:id` | CategoryDetailsPage | Detalhe de categoria | Estado vazio existe; erro explícito não foi identificado. |
| `/historico` | HistoryPage | Atividade e transações | Estado vazio existe; erro explícito não foi identificado. |
| `/configuracoes` | SettingsPage | Preferências e conta | Exibe cinco seções. IA, Módulos e Planos estão implementados, mas não são montados. |
| `/analytics` | AnalyticsPage | Análises e projeções | Conteúdo muito saturado e sem estados vazio ou erro explícitos na página. |
| `/wallet` | WalletPage | Contas, cartões e patrimônio | Arquivo com 1.208 linhas e várias responsabilidades. Deve ser decomposto. |
| `/orcamento` | BudgetPage | Planejamento | Estado vazio existe; erro explícito não foi identificado. |
| `/projetos` | ProjectsPage | Projetos financeiros | Estados vazio e erro aparecem em fluxos específicos. |
| `/investimentos` | InvestmentsPage | Investimentos | Possui estados de loading, vazio e erro em partes do fluxo. |
| `/atualizar` | ForceUpdatePage | Atualização obrigatória | Fluxo especial e sem estados intermediários identificados. |
| `/.lovable/oauth/consent` | OAuthConsentPage | Consentimento OAuth | Fluxo técnico separado da navegação principal. |
| `*` | NotFound | Rota desconhecida | Fallback global. |

`Index.tsx` permanece em `src/pages`, mas não está conectado ao roteamento atual. Deve ser classificado como legado ou removido depois de confirmar que não é importado indiretamente.

## 3. Shell global e navegação

O shell autenticado monta globalmente:

- `FloatingActionButton`.
- `GeniusChatbot`.
- `MobileBottomNav`.
- `UpdateBanner`.
- `BankTransactionCapture`.

Riscos observados:

1. A navegação inferior é fixa e visualmente dominante. Embora exista compensação em parte do conteúdo, ela ainda compete com cards e informações próximas ao rodapé.
2. O botão central de transação concentra atenção por tamanho, cor e posição. A importância funcional é correta, mas o tratamento atual desequilibra a barra.
3. Cabeçalho e navegação usam efeitos e cores fortes ao mesmo tempo que o conteúdo, reduzindo a hierarquia.
4. Alguns botões usam 36 px ou 40 px de altura. O sistema novo deve garantir área de toque mínima de 44 por 44 px.

## 4. Superfícies sobrepostas

Foram identificadas as seguintes famílias:

| Família | Uso observado | Risco de consistência |
|---|---:|---|
| `ResponsiveModal` | 2 fluxos principais | Bom ponto de consolidação para criação e edição de transação. |
| `DialogContent` | 24 ocorrências | Variações locais de largura, raio, padding e altura. |
| `AlertDialogContent` | 14 ocorrências | Confirmações com estilização repetida e potencial divergência. |
| `SheetContent` | 4 ocorrências | Padrões diferentes para painéis laterais e detalhes. |
| `DrawerContent` | 4 ocorrências | Usado no mobile, mas sem contrato visual único documentado. |
| `PopoverContent` | 7 ocorrências | Menus, calculadora, notificações e datas usam tratamentos diferentes. |
| `DropdownMenuContent` | Cabeçalho e primitivo | O menu de perfil usa `floating-glass`, enquanto outros conteúdos usam estilos próprios. |

Decisão requerida para a Etapa 1: criar uma única especificação para modal, bottom sheet, menu, popover, alerta e tooltip. Vidro deve ser reservado a superfícies temporárias e funcionais, não a cards de conteúdo.

## 5. Componentes repetidos e concentração de responsabilidade

Pontos de consolidação prioritários:

- Cabeçalho: `DashboardHeader` deve se tornar o contrato único do shell autenticado.
- Navegação: `MobileBottomNav`, `FloatingActionButton` e entradas de IA precisam ser tratados como um único sistema, não como camadas independentes.
- Transações: `AddExpenseModal`, `EditExpenseModal` e `QuickAddModal` repetem padrões de seleção, valor, data, categoria e ações.
- Feedback: loading, vazio, erro, offline e retry não possuem cobertura uniforme entre páginas.
- Cards financeiros: resumos, cartões de crédito, previsões e analytics usam composições próprias de cor, ícone, valor e sparkline.
- Gráficos: tooltips e legendas precisam de um contrato touch-first, com o mesmo tratamento em light e dark.
- `WalletPage` deve ser decomposta antes de um redesign profundo, pois 1.208 linhas elevam o risco de regressão visual e funcional.

## 6. Auditoria do sistema visual atual

### 6.1 Cor

- A cor primária atual usa saturação aproximada de 95%.
- O gradiente principal combina violeta, lavanda e verde menta.
- O fundo aplica três gradientes radiais em ambos os temas.
- Roxo, verde, vermelho e gradientes aparecem simultaneamente em áreas de alta prioridade.

Consequência: a cor não codifica prioridade com precisão. Muitos elementos parecem igualmente importantes.

### 6.2 Vidro e transparência

- O componente de card padrão usa transparência, sombra e `backdrop-blur`.
- Input, select, tabs, fallback de página e tooltip de gráfico também utilizam transparência ou blur.
- Existem cinco famílias auxiliares: `glass`, `glass-soft`, `glass-panel`, `floating-glass` e `glass-modal`.

Consequência: o vidro deixou de indicar elevação temporária e passou a ser textura geral. Isso reduz contraste e torna a interface mais pesada.

### 6.3 Tipografia

- Inter já é a fonte pretendida, mas a escala não é aplicada de forma uniforme.
- Há títulos muito grandes em páginas secundárias, labels em caixa alta com espaçamento forte e diferenças de peso entre componentes equivalentes.
- Textos extensos e valores financeiros grandes não possuem uma estratégia global de quebra, redução ou truncamento.

### 6.4 Forma, borda e sombra

- Raios grandes aparecem em cards, menus, modais e botões sem distinção clara de função.
- Sombras e bordas variam localmente.
- Controles selecionados alternam entre círculo, cápsula e quadrado arredondado.

### 6.5 Movimento

- Existe uma animação global de entrada de página.
- Existe suporte global a `prefers-reduced-motion`, o que deve ser preservado.
- Não há progressão de carregamento documentada por prioridade de conteúdo.
- O Dashboard apresentou skeleton por mais de sete segundos antes dos dados, seguido de carregamento completo posterior. Isso exige medição e carregamento progressivo, não apenas uma animação mais longa.

## 7. Matriz de estados por página

A tabela registra presença identificável no código da página. Componentes filhos podem possuir tratamentos adicionais.

| Página | Loading | Vazio | Erro | Offline | Avaliação |
|---|---|---|---|---|---|
| Dashboard | Sim | Não explícito | Não explícito | Não centralizado | Incompleto |
| Analytics | Sim | Não explícito | Não explícito | Não centralizado | Incompleto |
| History | Sim | Sim | Não explícito | Não centralizado | Incompleto |
| Budget | Sim | Sim | Não explícito | Não centralizado | Incompleto |
| Categories | Sim | Sim | Sim em ações | Não centralizado | Parcial |
| CategoryDetails | Sim | Sim | Não explícito | Não centralizado | Incompleto |
| Projects | Sim | Sim | Sim em ações | Não centralizado | Parcial |
| Investments | Sim | Sim | Sim em partes | Não centralizado | Parcial |
| Wallet | Sim | Sim | Sim em partes | Não centralizado | Parcial e concentrado |
| Settings | Sim | Não aplicável em todas as seções | Sim em partes | Não centralizado | Parcial |
| Auth | Sim | Não aplicável | Sim | Dependente da falha | Parcial |
| ForceUpdate | Não explícito | Não aplicável | Não explícito | Não centralizado | Incompleto |

Requisito transversal: todas as consultas críticas devem ter loading estrutural, vazio informativo, erro com retry e estado offline distinguível.

## 8. Configurações e coerência funcional

### Seções montadas atualmente

- Conta.
- Automação.
- Notificações.
- Categorias.
- Dados e segurança.

### Seções presentes no código, mas não montadas

- `AiSection`.
- `ModulesSection`.
- `PlansSection`.

Conclusões:

1. A percepção de recursos ausentes ou inativos é objetiva. Três seções existem, mas não são acessíveis pela página.
2. `AiSection` usa tipagem genérica em partes da configuração e precisa de contrato funcional antes de ser exposta.
3. `ModulesSection` está conectado ao contexto de preferências e pode ser reaproveitado, após revisão da arquitetura de módulos.
4. `PlansSection` contém valores comerciais fixos e uma ação de upgrade sem integração de cobrança confirmada. Não deve ser publicada como funcional até existir regra de produto, backend e fluxo de compra compatível com Google Play.
5. A Etapa 7 deve classificar cada item como funcional, incompleto, futuro ou removível antes de redesenhar sua apresentação.

## 9. Problemas visuais e problemas de lógica

### Visuais

- Saturação excessiva e muitos gradientes simultâneos.
- Vidro aplicado a conteúdo permanente.
- Hierarquia tipográfica irregular.
- Raios, sombras, bordas e estados selecionados sem contrato único.
- Navegação inferior dominante e próxima demais do conteúdo.
- Contraste inconsistente em light e dark.
- Tooltips e overlays sem padrão único.

### Funcionais ou estruturais

- Seções de Configurações implementadas, mas não montadas.
- Plano comercial exposto em código sem cobrança confirmada.
- Cobertura desigual de erro, vazio e offline.
- `WalletPage` concentra responsabilidades demais.
- Página `Index.tsx` aparentemente órfã.
- Carregamento inicial longo sem progressão por prioridade.
- Percentuais financeiros precisam de regra semântica para evitar comparações enganosas quando a base anterior é baixa ou zero.

## 10. Prioridades

### P0, antes de propagar o redesign

1. Definir a taxonomia funcional de Configurações e impedir que recursos incompletos sejam apresentados como ativos.
2. Definir contratos de loading, vazio, erro, offline e retry para consultas críticas.
3. Definir regras de percentuais, projeções e comparações financeiras para evitar informação enganosa.
4. Preservar navegação, criação de transação, autenticação e dados durante a troca visual.

### P1, sistema e protótipo vertical

1. Aprovar ou ajustar a direção `Lumnia Calm Intelligence`.
2. Criar tokens light e dark com contraste mensurável.
3. Criar escala tipográfica e de espaçamento.
4. Consolidar cards, botões, campos, overlays, feedback e navegação.
5. Redesenhar Dashboard como protótipo vertical e validar no Galaxy S22 Ultra.

### P2, propagação e refinamento

1. Decompor páginas extensas durante suas respectivas etapas.
2. Padronizar gráficos, tooltips e carregamento progressivo.
3. Implementar movimento discreto e feedback tátil quando suportado.
4. Validar conteúdo extremo, telas estreitas e desktop.

## 11. Baseline visual

### Dark

- [Dashboard, dados](redesign-baseline/dark/dashboard-top.png)
- [Dashboard, carregamento](redesign-baseline/dark/dashboard.png)
- [Atividade](redesign-baseline/dark/activity.png)
- [Planejamento](redesign-baseline/dark/planning.png)
- [Patrimônio](redesign-baseline/dark/patrimony.png)
- [Categorias](redesign-baseline/dark/categories.png)
- [Analytics](redesign-baseline/dark/analytics.png)
- [Configurações](redesign-baseline/dark/settings.png)
- [Modal de transação](redesign-baseline/dark/transaction-modal.png)

### Light

- [Dashboard](redesign-baseline/light/dashboard.png)
- [Atividade](redesign-baseline/light/activity.png)
- [Planejamento](redesign-baseline/light/planning.png)
- [Patrimônio](redesign-baseline/light/patrimony.png)
- [Configurações](redesign-baseline/light/settings.png)
- [Modal de transação](redesign-baseline/light/transaction-modal.png)

As capturas constituem baseline de comparação, não aprovação do estado atual.

## 12. Critérios de entrada da Etapa 1

A Etapa 1 pode começar quando:

1. Este inventário estiver aceito como fonte de verdade técnica.
2. A direção `Lumnia Calm Intelligence` for aprovada ou ajustada explicitamente.
3. For confirmado que a primeira implementação visual será um protótipo vertical no Dashboard, sem propagação antecipada.
4. Tokens forem definidos antes de alterar páginas.
5. Mudanças existentes do usuário na branch continuarem preservadas e separadas do escopo de cada etapa.

## 13. Resultado da Etapa 0

A Etapa 0 está concluída documentalmente. Ela não altera a UI, não resolve bugs e não valida a lógica financeira. Seu resultado é uma especificação verificável para impedir que a refatoração avance por ajustes isolados.
