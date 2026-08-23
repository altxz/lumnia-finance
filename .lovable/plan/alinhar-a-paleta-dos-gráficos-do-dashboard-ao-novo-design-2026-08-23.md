# Alinhar a paleta dos gráficos do Dashboard ao novo design

## O que está acontecendo

Os tokens globais (`--primary` roxo #8F41DE, `--accent` laranja #FF7535, lilás e pêssego) já estão no novo design, mas os gráficos do Dashboard continuam usando cores herdadas do design antigo:

- `--chart-5` (magenta 300°), `--chart-6` (azul-violeta 250°), `--chart-7` (vermelho) e `--chart-8` (verde escuro) não pertencem à nova paleta e aparecem em Tendências, Gasto Diário, Maiores Compras, Categorias e Fontes de Receita.
- Verde/vermelho puros (`--success` verde 152°, `--destructive` vermelho) são usados como cores decorativas de série (ex.: 2ª e 3ª barra de "Maiores Compras", pizza de categorias), não só como sinal de receita/despesa.
- Há hex fixos fora do design system: `#6366f1` (índigo) no treemap de despesas e a lista `#6366f1, #ef4444, #22c55e, #f59e0b, #8b5cf6, #ec4899, #14b8a6, #f97316` no treemap de subcategorias.

## O que será feito

1. **Nova rampa de cores de gráfico** no `index.css` (light e dark), derivada da marca: roxo → lilás → laranja → pêssego → violeta profundo, com variações de luminosidade em vez de matizes aleatórios. `--chart-1..8` passam a ser todos da família Lumnia.
2. **Paleta compartilhada** (`src/lib/chartPalette.ts`) exportando a sequência categórica oficial e os pares receita/despesa, para todos os gráficos consumirem a mesma ordem de cores.
3. **Semântica preservada**: verde e vermelho continuam exclusivamente para receita vs. despesa (e para "acima do orçamento"), mas re-tonalizados para harmonizar com o roxo/laranja. Deixam de ser usados como cor decorativa de série.
4. **Remoção dos hex fixos** nos treemaps, usando a paleta compartilhada como fallback quando a categoria não tem cor própria definida pelo usuário (a cor personalizada da categoria continua tendo prioridade).
5. **Revisão gráfico por gráfico** do Dashboard: Fluxo de Caixa, Receitas vs Despesas, Maiores Compras, Uso do Crédito, Gasto Diário, Fixo vs Variável, Comparativo Semanal, Fontes de Receita, Top Categorias, Tendências, Orçamento vs Real, Waterfall, Heatmap, Treemaps e os mini-gráficos dos summary cards — ajustando gradientes, grid, eixos e tooltips para o mesmo padrão.
6. **Verificação visual** com screenshots do Dashboard em modo claro e escuro (desktop e mobile) para confirmar contraste e consistência.

## Detalhes técnicos

- Sem mudanças em lógica financeira, hooks ou queries — apenas cores/estilos de apresentação.
- Nenhuma cor Tailwind literal (`text-green-500`, `bg-[#...]`) será introduzida; tudo via tokens `hsl(var(--chart-n))` e utilitários semânticos.
- Gradientes de barra/área passam a derivar de `--chart-*` com opacidade, mantendo o efeito vidro.
