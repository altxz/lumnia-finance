/**
 * Motor único do Score Financeiro.
 *
 * Fonte de verdade compartilhada pelo painel, pela página de Score e pelas
 * integrações de IA (MCP / Chat Genius). Função pura: sem React, sem Supabase.
 *
 * Cinco dimensões, cada uma com nota 0-100, peso relativo e o número real que
 * sustenta a nota. Dimensões sem dados suficientes não pontuam zero: saem do
 * cálculo e o peso é redistribuído proporcionalmente entre as avaliadas.
 *
 * Mapeamento para as colunas existentes de `financial_scores`
 * (nenhuma migração necessária):
 *   savings_score     -> poupança
 *   budget_score      -> orçamento
 *   debt_score        -> dívidas e crédito
 *   consistency_score -> consistência
 *   credit_score      -> reserva / folga (runway)
 */

export type ScoreDimensionKey = 'savings' | 'budget' | 'debtCredit' | 'reserve' | 'consistency';

export type ScoreState = 'good' | 'warning' | 'critical' | 'unevaluated';

export interface ScoreBudgetLine {
  category: string;
  allocated: number;
  spent: number;
}

export interface ScoreInput {
  /** Receitas do mês (sem transferências e sem ajustes de saldo). */
  totalIncome: number;
  /** Despesas do mês (sem transferências e sem ajustes de saldo). */
  totalExpense: number;
  /** Orçamentos definidos no mês, com o realizado por categoria. */
  budgets?: ScoreBudgetLine[];
  /** Compromissos do mês: faturas de cartão + parcelas + parcelas de dívidas. */
  committedAmount?: number;
  /** Utilização do limite total dos cartões (0-1). */
  creditUsageRatio?: number;
  /** Existe fatura vencida em aberto. */
  hasOverdueInvoice?: boolean;
  /** Saldo líquido disponível (carteiras) + investimentos resgatáveis. */
  liquidReserve?: number;
  /** Despesas totais dos meses anteriores, do mais recente para o mais antigo. */
  previousExpenses?: number[];
}

export interface ScoreDimension {
  key: ScoreDimensionKey;
  label: string;
  /** Nota 0-100. `null` quando a dimensão não pôde ser avaliada. */
  score: number | null;
  /** Peso efetivo aplicado no cálculo (já redistribuído), 0-1. */
  weight: number;
  evaluated: boolean;
  state: ScoreState;
  /** Número real que sustenta a nota, ex.: "poupou 18% da renda". */
  detail: string;
  /** Ação concreta para melhorar (ou confirmação de que está bem). */
  action: string;
  /** Explicação da regra, para o popover de ajuda. */
  tip: string;
}

export interface ScoreNextStep {
  key: ScoreDimensionKey;
  label: string;
  /** Ganho estimado no score geral se a dimensão chegar a 100. */
  potentialGain: number;
  action: string;
}

export interface ScoreResult {
  overall: number;
  label: string;
  emoji: string;
  /** Frase única que resume o mês em linguagem simples. */
  headline: string;
  dimensions: ScoreDimension[];
  nextStep: ScoreNextStep | null;
  /** Notas para persistir em `financial_scores`. */
  persisted: {
    savings_score: number;
    budget_score: number;
    debt_score: number;
    consistency_score: number;
    credit_score: number;
  };
}

const BASE_WEIGHTS: Record<ScoreDimensionKey, number> = {
  savings: 0.3,
  budget: 0.2,
  debtCredit: 0.25,
  reserve: 0.15,
  consistency: 0.1,
};

const LABELS: Record<ScoreDimensionKey, string> = {
  savings: 'Poupança',
  budget: 'Orçamento',
  debtCredit: 'Dívidas e crédito',
  reserve: 'Reserva',
  consistency: 'Consistência',
};

const TIPS: Record<ScoreDimensionKey, string> = {
  savings:
    'Quanto da renda do mês sobrou depois das despesas. 30% ou mais vale nota máxima; 20% já é muito bom; abaixo de 0% (gastou mais do que ganhou) a nota cai rápido.',
  budget:
    'Aderência aos orçamentos definidos, avaliada categoria por categoria. Estourar uma categoria não é compensado por sobrar em outra.',
  debtCredit:
    'Quanto da renda está comprometida com faturas de cartão, parcelas e dívidas. Até 30% é saudável; acima de 50% derruba a nota. Fatura vencida limita o máximo.',
  reserve:
    'Meses de despesa que o seu saldo disponível mais os investimentos conseguem cobrir. 6 meses ou mais vale nota máxima.',
  consistency:
    'Desvio dos gastos deste mês contra a média dos meses anteriores. Só gastar acima da média penaliza — economizar nunca perde ponto.',
};

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

/** Interpolação linear entre pontos de referência (curva contínua, sem degraus). */
function curve(value: number, points: [number, number][]): number {
  if (value <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (value >= x1 && value <= x2) {
      const t = x2 === x1 ? 0 : (value - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }
  return last[1];
}

function stateOf(score: number | null): ScoreState {
  if (score === null) return 'unevaluated';
  if (score >= 70) return 'good';
  if (score >= 45) return 'warning';
  return 'critical';
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excelente';
  if (score >= 75) return 'Muito bom';
  if (score >= 60) return 'Bom';
  if (score >= 45) return 'Regular';
  if (score >= 30) return 'Atenção';
  return 'Crítico';
}

export function getScoreEmoji(score: number): string {
  if (score >= 75) return '🏆';
  if (score >= 60) return '👍';
  if (score >= 45) return '⚠️';
  return '🚨';
}

/** Cor semântica do score (HSL literal usada nos anéis e barras). */
export function getScoreColor(score: number): string {
  if (score >= 75) return 'hsl(142, 71%, 45%)';
  if (score >= 60) return 'hsl(45, 93%, 47%)';
  if (score >= 45) return 'hsl(25, 95%, 53%)';
  return 'hsl(0, 72%, 51%)';
}

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export function computeFinancialScore(input: ScoreInput): ScoreResult {
  const {
    totalIncome,
    totalExpense,
    budgets = [],
    committedAmount = 0,
    creditUsageRatio = 0,
    hasOverdueInvoice = false,
    liquidReserve,
    previousExpenses = [],
  } = input;

  const raw: Record<ScoreDimensionKey, { score: number | null; detail: string; action: string }> = {
    savings: { score: null, detail: 'Sem receita registada no mês', action: 'Registe as suas receitas para avaliar a poupança' },
    budget: { score: null, detail: 'Nenhum orçamento definido', action: 'Defina orçamentos para as suas principais categorias' },
    debtCredit: { score: null, detail: 'Sem renda para comparar compromissos', action: 'Registe as suas receitas do mês' },
    reserve: { score: null, detail: 'Sem dados de saldo e investimentos', action: 'Cadastre as suas carteiras e investimentos' },
    consistency: { score: null, detail: 'Sem histórico suficiente', action: 'Continue a registar — a partir do segundo mês dá para comparar' },
  };

  // 1. Poupança — curva contínua sobre a taxa de poupança.
  if (totalIncome > 0) {
    const rate = (totalIncome - totalExpense) / totalIncome;
    const score = curve(rate, [
      [-0.3, 0],
      [-0.1, 20],
      [0, 40],
      [0.1, 65],
      [0.2, 85],
      [0.3, 100],
    ]);
    const saved = totalIncome - totalExpense;
    raw.savings = {
      score: clamp(score),
      detail:
        rate >= 0
          ? `poupou ${pct(rate)} da renda (${money(saved)})`
          : `gastou ${pct(Math.abs(rate))} mais do que ganhou (${money(Math.abs(saved))})`,
      action:
        rate >= 0.2
          ? 'Taxa de poupança saudável — mantenha o ritmo'
          : `Poupar ${money(Math.max(0, totalIncome * 0.2 - saved))} a mais no mês chega aos 20% ideais`,
    };
  }

  // 2. Orçamento — média por categoria, ponderada pelo valor orçado.
  const activeBudgets = budgets.filter(b => b.allocated > 0);
  if (activeBudgets.length > 0) {
    let weighted = 0;
    let totalAllocated = 0;
    let worst: { category: string; over: number } | null = null;
    for (const b of activeBudgets) {
      const ratio = b.spent / b.allocated;
      const line = curve(ratio, [
        [0.8, 100],
        [0.95, 88],
        [1, 75],
        [1.1, 50],
        [1.3, 20],
        [1.6, 0],
      ]);
      weighted += line * b.allocated;
      totalAllocated += b.allocated;
      const over = b.spent - b.allocated;
      if (over > 0 && (!worst || over > worst.over)) worst = { category: b.category, over };
    }
    const score = clamp(weighted / totalAllocated);
    const totalSpent = activeBudgets.reduce((s, b) => s + b.spent, 0);
    raw.budget = {
      score,
      detail: worst
        ? `estourou ${money(worst.over)} em ${worst.category}`
        : `${money(totalSpent)} de ${money(totalAllocated)} orçados`,
      action: worst
        ? `Cortar ${money(worst.over)} em ${worst.category} fecha o orçamento`
        : 'Todas as categorias dentro do planeado',
    };
  }

  // 3. Dívidas e crédito — comprometimento da renda + uso do limite.
  if (totalIncome > 0) {
    const commitmentRatio = committedAmount / totalIncome;
    let score = curve(commitmentRatio, [
      [0, 100],
      [0.3, 85],
      [0.4, 65],
      [0.5, 45],
      [0.7, 20],
      [1, 0],
    ]);
    // Uso alto do limite do cartão limita a nota, mesmo com renda folgada.
    if (creditUsageRatio > 0.9) score = Math.min(score, 30);
    else if (creditUsageRatio > 0.7) score = Math.min(score, 55);
    else if (creditUsageRatio > 0.5) score = Math.min(score, 75);
    if (hasOverdueInvoice) score = Math.min(score, 25);
    raw.debtCredit = {
      score: clamp(score),
      detail: hasOverdueInvoice
        ? `fatura vencida em aberto · ${pct(commitmentRatio)} da renda comprometida`
        : `${pct(commitmentRatio)} da renda comprometida · ${pct(creditUsageRatio)} do limite usado`,
      action: hasOverdueInvoice
        ? 'Pague a fatura vencida — é o que mais pesa no score agora'
        : commitmentRatio > 0.3
          ? `Reduzir ${money(committedAmount - totalIncome * 0.3)} de compromissos volta ao nível saudável de 30%`
          : 'Compromissos em nível saudável',
    };
  }

  // 4. Reserva — meses de folga cobertos pelo saldo disponível.
  if (liquidReserve !== undefined) {
    const monthlyNeed = (() => {
      const hist = [totalExpense, ...previousExpenses].filter(v => v > 0);
      if (hist.length === 0) return 0;
      return hist.reduce((s, v) => s + v, 0) / hist.length;
    })();
    if (monthlyNeed > 0) {
      const months = Math.max(0, liquidReserve) / monthlyNeed;
      const score = curve(months, [
        [0, 0],
        [1, 30],
        [3, 70],
        [6, 100],
      ]);
      raw.reserve = {
        score: clamp(score),
        detail: `${months.toFixed(1)} ${months === 1 ? 'mês' : 'meses'} de folga (${money(Math.max(0, liquidReserve))})`,
        action:
          months >= 6
            ? 'Reserva de emergência completa'
            : `Guardar ${money(Math.max(0, monthlyNeed * 6 - liquidReserve))} completa 6 meses de reserva`,
      };
    }
  }

  // 5. Consistência — desvio acima da média dos meses anteriores.
  const hist = previousExpenses.filter(v => v > 0).slice(0, 3);
  if (hist.length > 0 && totalExpense > 0) {
    const avg = hist.reduce((s, v) => s + v, 0) / hist.length;
    const deviation = (totalExpense - avg) / avg;
    const score = deviation <= 0
      ? 100
      : curve(deviation, [
          [0, 100],
          [0.1, 85],
          [0.25, 60],
          [0.5, 30],
          [1, 0],
        ]);
    raw.consistency = {
      score: clamp(score),
      detail:
        deviation <= 0
          ? `${pct(Math.abs(deviation))} abaixo da média (${money(avg)})`
          : `${pct(deviation)} acima da média (${money(avg)})`,
      action:
        deviation <= 0.1
          ? 'Gastos estáveis em relação à média'
          : `Voltar à média significa gastar ${money(totalExpense - avg)} a menos`,
    };
  }

  // Redistribuição de peso entre as dimensões avaliadas.
  const keys = Object.keys(BASE_WEIGHTS) as ScoreDimensionKey[];
  const evaluatedKeys = keys.filter(k => raw[k].score !== null);
  const baseSum = evaluatedKeys.reduce((s, k) => s + BASE_WEIGHTS[k], 0);

  const dimensions: ScoreDimension[] = keys.map(key => {
    const { score: rawScore, detail, action } = raw[key];
    const evaluated = rawScore !== null;
    const score = rawScore === null ? null : Math.round(rawScore);
    return {
      key,
      label: LABELS[key],
      score,
      weight: evaluated && baseSum > 0 ? BASE_WEIGHTS[key] / baseSum : 0,
      evaluated,
      state: stateOf(score),
      detail,
      action,
      tip: TIPS[key],
    };
  });

  const overall = baseSum > 0
    ? Math.round(dimensions.reduce((s, d) => s + (d.score ?? 0) * d.weight, 0))
    : 50;

  // Próximo passo: dimensão com maior ganho potencial no score geral.
  let nextStep: ScoreNextStep | null = null;
  for (const d of dimensions) {
    if (!d.evaluated || d.score === null || d.score >= 95) continue;
    const gain = Math.round((100 - d.score) * d.weight);
    if (gain <= 0) continue;
    if (!nextStep || gain > nextStep.potentialGain) {
      nextStep = { key: d.key, label: d.label, potentialGain: gain, action: d.action };
    }
  }

  const weakest = dimensions
    .filter(d => d.evaluated && d.score !== null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const strongest = dimensions
    .filter(d => d.evaluated && d.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  const headline = (() => {
    if (!weakest) return 'Registe receitas e despesas para calcular o seu score.';
    if (overall >= 75) return `Mês sob controlo: ${strongest.label.toLowerCase()} ${strongest.detail}.`;
    if (weakest === strongest) return `${weakest.label}: ${weakest.detail}.`;
    return `${strongest.label} bem (${strongest.detail}), mas ${weakest.label.toLowerCase()} ${weakest.detail}.`;
  })();

  const scoreOf = (key: ScoreDimensionKey) => Math.round(raw[key].score ?? 0);

  return {
    overall,
    label: getScoreLabel(overall),
    emoji: getScoreEmoji(overall),
    headline,
    dimensions,
    nextStep,
    persisted: {
      savings_score: scoreOf('savings'),
      budget_score: scoreOf('budget'),
      debt_score: scoreOf('debtCredit'),
      consistency_score: scoreOf('consistency'),
      credit_score: scoreOf('reserve'),
    },
  };
}
