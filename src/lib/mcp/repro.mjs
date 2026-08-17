import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { computeMonthProjection } = await import('/dev-server/src/lib/mcp/monthProjection.ts');
for (const m of ['2026-10','2026-11','2026-12']) {
  const r = await computeMonthProjection(sb, m);
  const gamepass = r.invoiceTotals.byCategory;
  console.log(m, 'invoiceTotal=', r.invoiceTotals.total);
}
