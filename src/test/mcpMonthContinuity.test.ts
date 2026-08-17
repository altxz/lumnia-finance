import { describe, expect, it } from 'vitest';
import { computeMonthProjection } from '@/lib/mcp/monthProjection';

const expenses = [
  { id: '1', description: 'Salário', value: 5000, date: '2026-01-05', type: 'income', final_category: 'Renda', is_paid: true, is_recurring: true, frequency: 'monthly', credit_card_id: null },
  { id: '2', description: 'Aluguel', value: 2000, date: '2026-01-10', type: 'expense', final_category: 'Moradia', is_paid: true, is_recurring: true, frequency: 'monthly', credit_card_id: null },
  { id: '3', description: 'Curso', value: 300, date: '2026-03-12', type: 'expense', final_category: 'Educação', is_paid: false, is_recurring: false, credit_card_id: null },
];

function makeClient() {
  return {
    from(_table: string) {
      const state: any = { table: _table, filters: [] as any[] };
      const api: any = {
        select: () => api,
        order: () => api,
        eq: (col: string, val: any) => { state.filters.push({ op: 'eq', col, val }); return api; },
        gte: (col: string, val: any) => { state.filters.push({ op: 'gte', col, val }); return api; },
        lt: (col: string, val: any) => { state.filters.push({ op: 'lt', col, val }); return api; },
        is: (col: string, val: any) => { state.filters.push({ op: 'is', col, val }); return api; },
        not: (col: string, _o: string, val: any) => { state.filters.push({ op: 'not', col, val }); return api; },
        like: (col: string, val: any) => { state.filters.push({ op: 'like', col, val }); return api; },
        then(resolve: any) {
          let data: any[] = [];
          if (state.table === 'expenses') {
            data = expenses.filter((e: any) =>
              state.filters.every((f: any) => {
                const v = (e as any)[f.col];
                if (f.op === 'eq') return v === f.val;
                if (f.op === 'gte') return v >= f.val;
                if (f.op === 'lt') return v < f.val;
                if (f.op === 'is') return f.val === null ? v == null : v === f.val;
                if (f.op === 'not') return f.val === null ? v != null : v !== f.val;
                if (f.op === 'like') return typeof v === 'string' && v.startsWith(String(f.val).replace('%', ''));
                return true;
              }),
            );
          } else if (state.table === 'wallets') {
            data = [{ id: 'w1', name: 'Conta', initial_balance: 1000 }];
          }
          return resolve({ data, error: null });
        },
      };
      return api;
    },
  };
}

describe('MCP month projection continuity', () => {
  it('saldo inicial do mês N = saldo previsto do mês N-1', async () => {
    const sb = makeClient();
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    const results = [];
    for (const m of months) results.push(await computeMonthProjection(sb, m));

    for (let i = 1; i < results.length; i++) {
      expect(results[i].startingBalance).toBeCloseTo(results[i - 1].totals.projectedBalance, 2);
    }
  });
});
