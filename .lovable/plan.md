# Score Financeiro: cálculo mais inteligente e leitura fácil

## Problema

O bloco de score no painel mostra um anel `60/100`, cinco barras (Poupança 85, Orçamento 20, Dívidas 80, Consistência 65, Crédito 30) e um botão "Salvar Score". Não dá para saber o que cada número significa, por que o geral deu 60, nem o que fazer para melhorar.

Além disso a matemática hoje é frágil e está duplicada em três lugares (`DashboardScoreCarousel.tsx`, `FinancialScorePage.tsx`, `src/lib/mcp/tools/financial-score.ts`), com regras que dão resultados estranhos:

- Dívidas: perde 10 pontos por dívida existente, independentemente do valor. Uma dívida de R$ 50 pesa igual a uma de R$ 50.000.
- Orçamento: usa só o total agregado; estourar uma categoria e sobrar em outra se cancelam.
- Consistência: qualquer variação de gasto vira punição, mesmo quando o gasto caiu (economizar é penalizado).
- Poupança: degraus fixos que fazem o score saltar de 50 para 70 por um centavo de diferença.
- Nada considera reserva de emergência nem meses de folga (runway), que o app já calcula.

## Motor de score novo (uma única fonte)

Criar `src/lib/financialScore.ts` como fonte única usada pelo painel, pela página de Score e pelas integrações de IA. Regras:

| Dimensão | Peso | Como é medida |
| --- | --- | --- |
| Poupança | 30% | Taxa de poupança do mês, em curva contínua: 0% → 40 pts, 20% → 85 pts, 30%+ → 100 pts; negativa cai proporcionalmente até 0 |
| Orçamento | 20% | Média ponderada por categoria (estouro numa categoria não é compensado por sobra noutra); sem orçamentos definidos, a dimensão é marcada como "não avaliada" e o peso é redistribuído |
| Dívidas e crédito | 25% | Comprometimento da renda: (parcelas + faturas + dívidas do mês) / renda; até 30% é saudável, acima de 50% derruba; fatura vencida aplica teto |
| Reserva / folga | 15% | Meses de despesa cobertos pelo saldo líquido e investimentos (runway): 6+ meses → 100, 0 → 0 |
| Consistência | 10% | Desvio dos gastos contra a média dos últimos 3 meses, penalizando só desvios para cima; queda de gasto não perde ponto |

Pontos importantes:
- Dimensões sem dados suficientes não pontuam zero — saem do cálculo e o peso é redistribuído, com o motivo exposto na interface.
- Cada dimensão retorna, além da nota: o número real que a sustenta (ex.: "poupou 18% de R$ 12.400"), o estado (bom / atenção / crítico) e uma ação concreta ("reduzir R$ 320 em Restaurantes fecha o orçamento").
- Ajustes de saldo continuam excluídos, como já acontece no resto da plataforma.

## Nova apresentação

Substituir o anel + barras cruas por uma leitura em três camadas no card do painel:

```text
┌───────────────────────────────────────────────┐
│ Score Financeiro                     agosto ▸ │
│  ┌────┐  68 / 100  Bom   (+6 vs. julho)       │
│  │ arc│  "Você poupou 18% e o crédito está    │
│  └────┘   apertado este mês."                 │
│───────────────────────────────────────────────│
│ Poupança      ●●●●○  85   poupou 18%          │
│ Orçamento     ●○○○○  20   estourou R$ 640     │
│ Dívidas/créd. ●●●○○  62   38% da renda        │
│ Reserva       ●●○○○  40   1,8 mês de folga    │
│ Consistência  ●●●○○  65   +12% vs. média      │
│───────────────────────────────────────────────│
│ Próximo passo: cortar R$ 640 em Assinaturas   │
│ sobe o score para ~74                         │
└───────────────────────────────────────────────┘
```

- Cada linha mostra o número real ao lado da nota, então a barra deixa de ser abstrata.
- Faixa de cor e rótulo (Crítico / Atenção / Regular / Bom / Excelente) coerentes com os tokens do tema.
- Comparação com o mês anterior a partir do histórico já gravado em `financial_scores`.
- Bloco "Próximo passo" com a maior alavanca calculada: qual dimensão, quanto ganha, quanto é preciso mudar.
- O botão "Salvar Score" sai da frente: o snapshot do mês passa a ser gravado automaticamente quando o valor muda (mesma tabela, mesmo `upsert`); a página de Score mantém um botão de recalcular manual.
- O radar continua no segundo slide, agora com a nota de cada dimensão no rótulo.
- A página de Score Financeiro passa a consumir o mesmo motor, ganhando o detalhamento por dimensão com os números que a sustentam e a evolução histórica já existente.

## Detalhes técnicos

- Novo `src/lib/financialScore.ts`: tipos `ScoreInput`, `ScoreDimension`, `ScoreResult` e a função pura `computeFinancialScore`, sem dependência de React ou Supabase.
- `DashboardScoreCarousel.tsx` e `FinancialScorePage.tsx` deixam de ter `calculateScores` própria e passam a chamar o motor; a query de extras é ampliada para trazer valor das dívidas, orçamentos por categoria, saldo/investimentos e os 3 meses anteriores (via os hooks e helpers já existentes de projeção e carteiras).
- `src/lib/mcp/tools/financial-score.ts` e o equivalente do Chat Genius passam a usar as mesmas regras, para a IA responder igual à interface.
- Testes unitários em `src/test/financialScore.test.ts` cobrindo: poupança negativa, sem orçamento (peso redistribuído), fatura vencida, runway alto, e queda de gasto sem penalização.
- Persistência mantém as colunas atuais de `financial_scores` (nenhuma migração necessária): reserva/runway grava na coluna hoje usada por dívidas/crédito conforme mapeamento documentado no motor.
