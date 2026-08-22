# Redesign completo da UI (estilo "Purse")

Objetivo: aplicar a identidade visual dos mockups anexados em toda a plataforma — tipografia Poppins, paleta roxo/laranja, cartões com efeito de vidro, sombras suaves, menu lateral escuro em barra estreita e gráficos arredondados. Nenhuma lógica financeira é alterada: só camada visual.

## 1. Fundação (tokens)

- Trocar a fonte Figtree por **Poppins** (300–700) e definir a escala do mockup: H1 36px medium, H2 22px medium, corpo 16px/14px regular.
- Nova paleta (convertida para HSL nos tokens):
  - Roxo primário `#8F41DE`, laranja de destaque `#FF7535`
  - Lilás claro `#DAC0F4`, pêssego `#FFD6C2`, branco `#FFFFFF`, grafite `#2C2C2C`
- Fundo com gradiente suave (lilás → pêssego) no modo claro; grafite/preto com o mesmo gradiente atenuado no modo escuro.
- Novos tokens de gradiente e sombra: `--gradient-primary` (roxo→laranja), `--gradient-card`, `--gradient-surface`, `--shadow-soft`, `--shadow-card`, `--shadow-float`, `--glass-border`.
- Raio de canto mais generoso (`--radius: 1.5rem`) para o aspeto "squircle" dos cartões.
- Paleta de gráficos (`--chart-1..8`) redefinida a partir do roxo/laranja/lilás/pêssego, com versões dessaturadas no modo escuro.
- Registar tudo em `src/index.css` + `tailwind.config.ts` (cores, fontFamily, boxShadow, backgroundImage, keyframes de fade/scale suaves).

## 2. Primitivos (shadcn)

- `card`: superfície translúcida (glass) com borda de 1px clara, sombra suave e raio grande; variantes `glass`, `solid` e `gradient` (cartão de destaque roxo→laranja).
- `button`: variantes `primary` (roxo), `accent` (laranja em pill), `soft` (lilás), `ghost`; todas em formato pill como no mockup.
- `tabs` / `toggle-group`: barra segmentada em pill branca com item ativo laranja (padrão "Day / Week / Month / Year" do mockup).
- `badge`, `input`, `select`, `switch`, `progress`, `dialog`/`sheet`/`drawer`, `tooltip`/`popover`, `table`: alinhados às novas sombras, raios e cores.
- `progress`: barra multi-segmento fina (roxo/laranja/lilás) como a barra de gastos do mockup.

## 3. Casca da aplicação

- **Sidebar**: barra escura estreita só com ícones (estilo do mockup), item ativo destacado, expansão para rótulos ao abrir; logo no topo, ícone de configurações fixo no fundo. Mantém o `SidebarTrigger` sempre visível.
- **DashboardHeader**: seletor de período em pill, busca, notificações e avatar do utilizador alinhados à direita, tudo sobre superfície de vidro.
- **FloatingActionButton / GeniusChatbot**: botão pill com gradiente roxo→laranja e sombra flutuante.
- Barra inferior/menu mobile e modais seguindo os mesmos tokens (mantendo `max-h-[85dvh]`, footer fixo e safe area já usados).

## 4. Páginas e cartões

Aplicar a nova linguagem sem mudar dados nem estrutura de informação:

- **Dashboard**: tiles do `TileGrid` como cartões de vidro; cartão de saldo destacado com donut de progresso (roxo com pista clara), valor grande e lista de categorias com ícone + valor, tal como o mockup.
- **Carteira**: cartões de conta/cartão de crédito com gradiente roxo→laranja, empilhamento com sobreposição e chip/bandeira, como os "My cards".
- **Transações / Categorias / Orçamento / Projetos / Investimentos / Score / Configurações / Auth**: cabeçalhos, listas, linhas de transação (ícone circular + descrição + subtítulo + valor à direita) e formulários atualizados aos novos tokens.
- **Gráficos (Recharts)**: linhas suaves com gradiente de área, barras com cantos arredondados e barra em foco laranja, grelha discreta, tooltips em vidro, donuts com espessura fina — mantendo `ResponsiveContainer` e as regras de domínio de eixo já definidas.

## 5. Verificação

- Revisão visual em desktop e mobile (393px) das páginas principais em modo claro e escuro via captura do preview.
- Garantir contraste AA nos pares texto/fundo e zero cores fixas (`text-white`, `bg-[#...]`) nos componentes — tudo via tokens.
- Build e testes existentes a passar.

## Notas técnicas

- Trabalho concentrado em `src/index.css`, `tailwind.config.ts` e `src/components/ui/*`, para que a maior parte das páginas herde o novo estilo automaticamente; depois passagem página a página para ajustes de layout e gráficos.
- O modo claro continua o padrão; o modo escuro passa a usar grafite `#2C2C2C`/preto com os mesmos acentos, como no mockup.
- Fonte Poppins carregada via Google Fonts com `preconnect`, substituindo a importação de Figtree.
