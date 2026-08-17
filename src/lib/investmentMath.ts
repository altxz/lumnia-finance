import { differenceInCalendarDays, parseISO, format, addMonths, startOfMonth } from 'date-fns';

export type RateKind = 'cdi_percent' | 'prefixado' | 'ipca_plus';

export interface Investment {
  id: string;
  user_id: string;
  name: string;
  investment_type: string;
  wallet_id: string | null;
  investment_wallet_id: string | null;
  principal: number;
  rate_kind: RateKind;
  rate_value: number;
  index_value: number;
  start_date: string;
  maturity_date: string | null;
  status: 'active' | 'redeemed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentMovement {
  id: string;
  investment_id: string;
  kind: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  expense_id: string | null;
}

export const INVESTMENT_TYPES: { value: string; label: string }[] = [
  { value: 'caixinha', label: 'Caixinha / Cofrinho' },
  { value: 'cdb', label: 'CDB' },
  { value: 'lci_lca', label: 'LCI / LCA' },
  { value: 'tesouro', label: 'Tesouro Direto' },
  { value: 'fundo', label: 'Fundo de Investimento' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'outro', label: 'Outro' },
];

export const RATE_KINDS: { value: RateKind; label: string; hint: string }[] = [
  { value: 'cdi_percent', label: '% do CDI', hint: 'Ex: 100% do CDI, com CDI anual de 14,90%' },
  { value: 'prefixado', label: 'Prefixado (% a.a.)', hint: 'Ex: 12,5% ao ano' },
  { value: 'ipca_plus', label: 'IPCA + % a.a.', hint: 'Ex: IPCA de 4,5% + 6% ao ano' },
];

export function investmentTypeLabel(type: string): string {
  return INVESTMENT_TYPES.find(t => t.value === type)?.label ?? type;
}

/** Taxa efetiva anual (decimal, ex: 0.149) a partir da configuração do investimento. */
export function effectiveAnnualRate(inv: Pick<Investment, 'rate_kind' | 'rate_value' | 'index_value'>): number {
  const rate = (inv.rate_value || 0) / 100;
  const index = (inv.index_value || 0) / 100;
  switch (inv.rate_kind) {
    case 'cdi_percent':
      return index * rate;
    case 'prefixado':
      return rate;
    case 'ipca_plus':
      return (1 + index) * (1 + rate) - 1;
    default:
      return 0;
  }
}

/** Taxa diária equivalente (base 365 dias corridos). */
export function dailyRate(annual: number): number {
  if (annual <= -1) return 0;
  return Math.pow(1 + annual, 1 / 365) - 1;
}

export function rateLabel(inv: Pick<Investment, 'rate_kind' | 'rate_value' | 'index_value'>): string {
  const fmt = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  switch (inv.rate_kind) {
    case 'cdi_percent':
      return `${fmt(inv.rate_value)} do CDI (CDI ${fmt(inv.index_value)} a.a.)`;
    case 'prefixado':
      return `${fmt(inv.rate_value)} a.a. (prefixado)`;
    case 'ipca_plus':
      return `IPCA (${fmt(inv.index_value)}) + ${fmt(inv.rate_value)} a.a.`;
    default:
      return '—';
  }
}

function toDate(iso: string): Date {
  return parseISO(iso.length > 10 ? iso.slice(0, 10) : iso);
}

interface Flow {
  date: Date;
  amount: number; // positivo = aporte, negativo = resgate
}

function buildFlows(inv: Investment, movements: InvestmentMovement[]): Flow[] {
  const flows: Flow[] = [];
  const deposits = movements.filter(m => m.kind === 'deposit');
  if (deposits.length === 0 && inv.principal > 0) {
    flows.push({ date: toDate(inv.start_date), amount: inv.principal });
  }
  movements.forEach(m => {
    flows.push({ date: toDate(m.date), amount: m.kind === 'deposit' ? m.amount : -m.amount });
  });
  return flows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Valor do investimento numa data, com juros compostos diários
 * aplicados sobre o saldo entre cada movimentação.
 */
export function valueAt(inv: Investment, movements: InvestmentMovement[], asOf: Date): number {
  const flows = buildFlows(inv, movements);
  if (flows.length === 0) return 0;
  const d = dailyRate(effectiveAnnualRate(inv));
  let balance = 0;
  let cursor = flows[0].date;

  for (const flow of flows) {
    if (flow.date > asOf) break;
    const days = Math.max(0, differenceInCalendarDays(flow.date, cursor));
    balance = balance * Math.pow(1 + d, days);
    balance = Math.max(0, balance + flow.amount);
    cursor = flow.date;
  }
  const remaining = Math.max(0, differenceInCalendarDays(asOf, cursor));
  balance = balance * Math.pow(1 + d, remaining);
  return balance;
}

/** Soma líquida investida (aportes - resgates). */
export function netInvested(inv: Investment, movements: InvestmentMovement[]): number {
  const flows = buildFlows(inv, movements);
  return flows.reduce((s, f) => s + f.amount, 0);
}

export interface InvestmentStats {
  invested: number;
  currentValue: number;
  earnings: number;
  earningsPct: number;
  projectedValue: number;
  projectedEarnings: number;
  daysRemaining: number | null;
  annualRate: number;
}

export function computeStats(
  inv: Investment,
  movements: InvestmentMovement[],
  today: Date = new Date(),
): InvestmentStats {
  const invested = netInvested(inv, movements);
  const currentValue = inv.status === 'redeemed' ? 0 : valueAt(inv, movements, today);
  const earnings = inv.status === 'redeemed' ? 0 : currentValue - invested;
  const maturity = inv.maturity_date ? toDate(inv.maturity_date) : null;
  const projectedValue = maturity && inv.status === 'active'
    ? valueAt(inv, movements, maturity > today ? maturity : today)
    : currentValue;
  return {
    invested,
    currentValue,
    earnings,
    earningsPct: invested > 0 ? (earnings / invested) * 100 : 0,
    projectedValue,
    projectedEarnings: projectedValue - invested,
    daysRemaining: maturity ? differenceInCalendarDays(maturity, today) : null,
    annualRate: effectiveAnnualRate(inv) * 100,
  };
}

export interface GrowthPoint {
  month: string;
  label: string;
  invested: number;
  value: number;
  projected: boolean;
}

/** Série mensal de evolução: do início até o vencimento (ou +12 meses). */
export function buildGrowthSeries(
  investments: { inv: Investment; movements: InvestmentMovement[] }[],
  today: Date = new Date(),
): GrowthPoint[] {
  const active = investments.filter(i => i.inv.status === 'active');
  if (active.length === 0) return [];

  const starts = active.map(i => toDate(i.inv.start_date).getTime());
  let start = startOfMonth(new Date(Math.min(...starts)));

  const ends = active.map(i =>
    i.inv.maturity_date ? toDate(i.inv.maturity_date).getTime() : addMonths(today, 12).getTime(),
  );
  const end = startOfMonth(new Date(Math.max(...ends, addMonths(today, 1).getTime())));

  // Limita a 60 pontos para o gráfico ficar legível
  const points: GrowthPoint[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 60) {
    const asOf = cursor;
    const value = active.reduce((s, i) => s + valueAt(i.inv, i.movements, asOf), 0);
    const invested = active.reduce((s, i) => {
      const flows = i.movements.length
        ? i.movements
        : [{ kind: 'deposit' as const, amount: i.inv.principal, date: i.inv.start_date, id: '', investment_id: '', expense_id: null }];
      return s + flows
        .filter(m => toDate(m.date) <= asOf)
        .reduce((acc, m) => acc + (m.kind === 'deposit' ? m.amount : -m.amount), 0);
    }, 0);
    points.push({
      month: format(asOf, 'yyyy-MM'),
      label: format(asOf, 'MMM/yy'),
      invested,
      value,
      projected: asOf > today,
    });
    cursor = addMonths(cursor, 1);
    guard++;
  }
  return points;
}
