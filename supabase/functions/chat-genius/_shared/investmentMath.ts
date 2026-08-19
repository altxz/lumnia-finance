/**
 * Porte de src/lib/investmentMath.ts para Deno (sem date-fns).
 * Mesma matemática de juros compostos diários usada na página de Investimentos.
 */

export interface Investment {
  id: string;
  name: string;
  investment_type: string;
  wallet_id: string | null;
  investment_wallet_id: string | null;
  principal: number;
  rate_kind: string;
  rate_value: number;
  index_value: number;
  start_date: string;
  maturity_date: string | null;
  status: string;
}

export interface InvestmentMovement {
  investment_id: string;
  kind: string;
  amount: number;
  date: string;
}

const INVESTMENT_TYPES: Record<string, string> = {
  caixinha: "Caixinha / Cofrinho",
  cdb: "CDB",
  lci_lca: "LCI / LCA",
  tesouro: "Tesouro Direto",
  fundo: "Fundo de Investimento",
  poupanca: "Poupança",
  outro: "Outro",
};

export function investmentTypeLabel(type: string): string {
  return INVESTMENT_TYPES[type] ?? type;
}

export function effectiveAnnualRate(inv: Pick<Investment, "rate_kind" | "rate_value" | "index_value">): number {
  const rate = Number(inv.rate_value ?? 0) / 100;
  const index = Number(inv.index_value ?? 0) / 100;
  switch (inv.rate_kind) {
    case "cdi_percent":
      return index * rate;
    case "prefixado":
      return rate;
    case "ipca_plus":
      return (1 + index) * (1 + rate) - 1;
    default:
      return 0;
  }
}

function dailyRate(annual: number): number {
  if (annual <= -1) return 0;
  return Math.pow(1 + annual, 1 / 365) - 1;
}

export function rateLabel(inv: Pick<Investment, "rate_kind" | "rate_value" | "index_value">): string {
  const fmt = (n: number) => `${Number(n ?? 0).toFixed(2).replace(".", ",")}%`;
  switch (inv.rate_kind) {
    case "cdi_percent":
      return `${fmt(inv.rate_value)} do CDI (CDI ${fmt(inv.index_value)} a.a.)`;
    case "prefixado":
      return `${fmt(inv.rate_value)} a.a. (prefixado)`;
    case "ipca_plus":
      return `IPCA (${fmt(inv.index_value)}) + ${fmt(inv.rate_value)} a.a.`;
    default:
      return "—";
  }
}

function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

interface Flow {
  date: Date;
  amount: number;
}

function buildFlows(inv: Investment, movements: InvestmentMovement[]): Flow[] {
  const flows: Flow[] = [];
  const deposits = movements.filter((m) => m.kind === "deposit");
  if (deposits.length === 0 && Number(inv.principal) > 0) {
    flows.push({ date: toDate(inv.start_date), amount: Number(inv.principal) });
  }
  movements.forEach((m) => {
    flows.push({ date: toDate(m.date), amount: m.kind === "deposit" ? Number(m.amount) : -Number(m.amount) });
  });
  return flows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function valueAt(inv: Investment, movements: InvestmentMovement[], asOf: Date): number {
  const flows = buildFlows(inv, movements);
  if (flows.length === 0) return 0;
  const d = dailyRate(effectiveAnnualRate(inv));
  let balance = 0;
  let cursor = flows[0].date;

  for (const flow of flows) {
    if (flow.date > asOf) break;
    const days = Math.max(0, diffDays(flow.date, cursor));
    balance = balance * Math.pow(1 + d, days);
    balance = Math.max(0, balance + flow.amount);
    cursor = flow.date;
  }
  const remaining = Math.max(0, diffDays(asOf, cursor));
  return balance * Math.pow(1 + d, remaining);
}

export function netInvested(inv: Investment, movements: InvestmentMovement[]): number {
  return buildFlows(inv, movements).reduce((s, f) => s + f.amount, 0);
}

export function computeStats(inv: Investment, movements: InvestmentMovement[], today: Date = new Date()) {
  const invested = netInvested(inv, movements);
  const currentValue = inv.status === "redeemed" ? 0 : valueAt(inv, movements, today);
  const earnings = inv.status === "redeemed" ? 0 : currentValue - invested;
  const maturity = inv.maturity_date ? toDate(inv.maturity_date) : null;
  const projectedValue =
    maturity && inv.status === "active" ? valueAt(inv, movements, maturity > today ? maturity : today) : currentValue;
  return {
    invested,
    currentValue,
    earnings,
    earningsPct: invested > 0 ? (earnings / invested) * 100 : 0,
    projectedValue,
    projectedEarnings: projectedValue - invested,
    daysRemaining: maturity ? diffDays(maturity, today) : null,
    annualRate: effectiveAnnualRate(inv) * 100,
  };
}
