# Novo design da página de Transações (estilo Apple)

Direção escolhida: **Painel deslizante** — resumo leve no topo sobre o fundo com brilhos suaves da marca, e todo o conteúdo (título, abas, filtros e feed) dentro de um painel de vidro que "sobe" com cantos superiores arredondados.

## O que muda visualmente

1. **Topo leve**
   - Seletor de mês mantido, mas mais discreto (sem caixa pesada).
   - Três mini cards de vidro em linha: Entradas, Saídas, Previsto — rótulo em maiúsculas pequenas e valor em destaque com números tabulares.
   - Brilhos difusos (roxo / laranja / lilás) ao fundo, sem interferir na leitura.

2. **Painel de vidro deslizante**
   - Container único com `rounded-t-[32px]`, borda superior fina e vidro translúcido, encostado abaixo do resumo.
   - Dentro dele: título "Transações" + botão de exportar em ícone circular, abas Lançamentos / Assinaturas em segmented control, e filtros compactos (busca + categoria + tipo) como chips.

3. **Feed minimalista**
   - Fim dos cards por transação: linhas limpas separadas por hairlines, com ícone quadrado arredondado tingido pela cor da categoria.
   - Descrição em cima, "Carteira • Categoria" abaixo em texto suave.
   - Valor à direita em números tabulares (verde receita / vermelho despesa) e status como ponto colorido + texto pequeno ("Pago" / "Pendente"), no lugar de badges cheias.
   - Cabeçalho de dia sticky: data à esquerda, saldo do dia em pílula discreta à direita.
   - Hover apenas aumenta levemente o contraste da linha; sem sombras dramáticas.

4. **Assinaturas Fixas**
   - Os quatro cards coloridos sólidos passam a mini cards de vidro coerentes com o resumo do topo; a lista segue o mesmo padrão de linhas do feed.

5. **Modo claro e escuro**
   - Todos os valores via tokens semânticos (nada de branco/cinza fixo), garantindo contraste alto no modo claro e o mesmo painel de vidro no escuro.

## O que não muda

Toda a lógica financeira, os cálculos de saldo diário, filtros, abas, ações por transação (editar, quitar, excluir), exportação e o motor `useProjectedTotals` permanecem exatamente como estão. É uma refatoração só de apresentação.

## Detalhes técnicos

- `src/pages/HistoryPage.tsx`: nova estrutura de layout (topo + painel `rounded-t-[32px]`), resumo em 3 mini cards, header do painel com abas e filtros; props e handlers atuais preservados.
- `src/components/TransactionSummaryHeader.tsx`: recriado como trio de mini cards de vidro (`glass-soft`), tipografia menor e `tabular-nums`.
- `src/components/TransactionFeed.tsx`: apenas as camadas de apresentação das linhas e dos cabeçalhos de dia (classes, hairlines, ícone tingido, status em ponto); handlers, agrupamento por dia e cálculo de saldo intactos.
- `src/index.css`: se necessário, um utilitário `.glass-panel` (vidro do painel deslizante) e `.hairline` para separadores, ambos com variante dark, reaproveitando os tokens existentes.
- Paleta: cores de categoria e ícones vindas de `src/lib/chartPalette.ts` / tokens `--chart-1..8`; fonte Figtree mantida.
- Responsivo: mobile 393px como referência principal; no desktop o painel ganha largura máxima e o resumo respira em 3 colunas.
