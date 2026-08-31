import type * as XLSXType from 'xlsx';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { getPaymentDate, type CreditCard } from '@/lib/invoiceHelpers';

const TYPE_LABELS: Record<string, string> = {
  expense: 'Despesa',
  income: 'Receita',
  transfer: 'Transferência',
};

const FREQ_LABELS: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

function fmtDate(value?: string | Date | null) {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T12:00:00`) : value;
  if (isNaN(d.getTime())) return '';
  return format(d, 'dd/MM/yyyy');
}

function monthLabel(value?: string | null) {
  if (!value) return '';
  const [y, m] = value.slice(0, 7).split('-');
  return `${m}/${y}`;
}

function num(value: any) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function autoWidth(rows: Record<string, any>[]) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((key) => {
    const maxLen = rows.reduce(
      (acc, row) => Math.max(acc, String(row[key] ?? '').length),
      key.length,
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
  });
}

function addSheet(XLSX: typeof XLSXType, wb: XLSXType.WorkBook, name: string, rows: Record<string, any>[], empty: Record<string, any>) {
  const data = rows.length ? rows : [empty];
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = autoWidth(data);
  ws['!autofilter'] = { ref: ws['!ref'] as string };
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  return ws;
}

export async function exportFinancialWorkbook(userId: string) {
  const XLSX = await import('xlsx');
  const [
    { data: expenses },
    { data: categories },
    { data: wallets },
    { data: cards },
    { data: projects },
    { data: debts },
    { data: budgets },
  ] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: true }),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('wallets').select('*').eq('user_id', userId),
    supabase.from('credit_cards').select('*').eq('user_id', userId),
    supabase.from('projects').select('*').eq('user_id', userId),
    supabase.from('debts').select('*').eq('user_id', userId),
    supabase.from('budgets').select('*').eq('user_id', userId),
  ]);

  const tx = expenses || [];
  const cardList = (cards || []) as CreditCard[];
  const cardById = new Map(cardList.map((c) => [c.id, c]));
  const walletById = new Map((wallets || []).map((w: any) => [w.id, w]));
  const projectById = new Map((projects || []).map((p: any) => [p.id, p]));
  const debtById = new Map((debts || []).map((d: any) => [d.id, d]));

  const invoiceDueDate = (t: any, card?: CreditCard) => {
    if (!card) return null;
    if (t.invoice_month) {
      const [y, m] = t.invoice_month.slice(0, 7).split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return new Date(y, m - 1, Math.min(card.due_day, lastDay));
    }
    return getPaymentDate(t.date, card);
  };

  const wb = XLSX.utils.book_new();

  // ---------- 1. Transações (completo, por dia) ----------
  const txRows = tx.map((t: any) => {
    const card = t.credit_card_id ? cardById.get(t.credit_card_id) : undefined;
    const value = num(t.value);
    const isCard = !!t.credit_card_id;
    const due = invoiceDueDate(t, card);
    return {
      Data: fmtDate(t.date),
      Dia: fmtDate(t.date).slice(0, 2),
      'Mês': monthLabel(t.date),
      Ano: t.date?.slice(0, 4) ?? '',
      'Descrição': t.description ?? '',
      Tipo: TYPE_LABELS[t.type] ?? t.type ?? '',
      Categoria: t.final_category ?? '',
      'Categoria sugerida (IA)': t.category_ai ?? '',
      Valor: value,
      'Débito (saída)': t.type === 'expense' && !isCard ? value : 0,
      'Crédito (entrada)': t.type === 'income' ? value : 0,
      'Cartão (fatura)': t.type === 'expense' && isCard ? value : 0,
      'Transferência': t.type === 'transfer' ? value : 0,
      'Forma de pagamento': isCard ? 'Cartão de crédito' : (t.payment_method ?? ''),
      'Cartão': card?.name ?? '',
      'Mês da fatura': monthLabel(t.invoice_month) || (due ? monthLabel(format(due, 'yyyy-MM-dd')) : ''),
      'Vencimento da fatura': due ? fmtDate(due) : '',
      Carteira: walletById.get(t.wallet_id)?.name ?? '',
      'Carteira destino': walletById.get(t.destination_wallet_id)?.name ?? '',
      Status: t.is_paid ? 'Pago/Recebido' : 'Pendente',
      Recorrente: t.is_recurring ? 'Sim' : 'Não',
      'Frequência': FREQ_LABELS[t.frequency] ?? t.frequency ?? '',
      Parcelas: num(t.installments) || 1,
      'Info parcela': t.installment_info ?? '',
      'Grupo parcelamento': t.installment_group_id ?? '',
      Projeto: projectById.get(t.project_id)?.name ?? '',
      'Dívida': debtById.get(t.debt_id)?.person_name ?? '',
      Tags: Array.isArray(t.tags) ? t.tags.join(', ') : '',
      'Observações': t.notes ?? '',
      'Criado em': fmtDate(t.created_at),
      ID: t.id,
    };
  });
  addSheet(XLSX, wb, 'Transações', txRows, { Data: '', 'Descrição': 'Sem transações' });

  // ---------- 2. Cartão de crédito (transações por cartão) ----------
  const cardTx = tx
    .filter((t: any) => t.credit_card_id)
    .map((t: any) => {
      const card = cardById.get(t.credit_card_id)!;
      const due = invoiceDueDate(t, card);
      const invMonth = t.invoice_month
        ? monthLabel(t.invoice_month)
        : due
          ? monthLabel(format(due, 'yyyy-MM-dd'))
          : '';
      return {
        'Cartão': card?.name ?? '—',
        'Data da transação': fmtDate(t.date),
        'Descrição': t.description ?? '',
        Categoria: t.final_category ?? '',
        Valor: num(t.value),
        Tipo: TYPE_LABELS[t.type] ?? t.type,
        'Mês da fatura': invMonth,
        'Vencimento da fatura': due ? fmtDate(due) : '',
        'Fechamento (dia)': card?.closing_day ?? '',
        'Vencimento (dia)': card?.due_day ?? '',
        Parcelas: num(t.installments) || 1,
        'Info parcela': t.installment_info ?? '',
        Status: t.is_paid ? 'Pago' : 'Pendente',
        Projeto: projectById.get(t.project_id)?.name ?? '',
        Tags: Array.isArray(t.tags) ? t.tags.join(', ') : '',
        'Observações': t.notes ?? '',
        ID: t.id,
      };
    })
    .sort((a, b) => (a['Cartão'] + a['Mês da fatura']).localeCompare(b['Cartão'] + b['Mês da fatura']));
  addSheet(XLSX, wb, 'Cartões de Crédito', cardTx, { 'Cartão': '', 'Descrição': 'Sem transações de cartão' });

  // ---------- 3. Faturas (resumo por cartão/mês) ----------
  const invoiceMap = new Map<string, any>();
  tx.filter((t: any) => t.credit_card_id).forEach((t: any) => {
    const card = cardById.get(t.credit_card_id);
    const due = invoiceDueDate(t, card);
    const key = `${t.credit_card_id}|${t.invoice_month?.slice(0, 7) || (due ? format(due, 'yyyy-MM') : '')}`;
    const current = invoiceMap.get(key) || {
      'Cartão': card?.name ?? '—',
      'Mês da fatura': t.invoice_month ? monthLabel(t.invoice_month) : due ? monthLabel(format(due, 'yyyy-MM-dd')) : '',
      'Vencimento': due ? fmtDate(due) : '',
      'Total da fatura': 0,
      'Total pago': 0,
      'Total pendente': 0,
      'Qtd. transações': 0,
      'Limite do cartão': num(card?.limit_amount),
    };
    const v = num(t.value);
    current['Total da fatura'] += v;
    if (t.is_paid) current['Total pago'] += v;
    else current['Total pendente'] += v;
    current['Qtd. transações'] += 1;
    invoiceMap.set(key, current);
  });
  addSheet(
    XLSX,
    wb,
    'Faturas',
    Array.from(invoiceMap.values()).sort((a, b) => (a['Cartão'] as string).localeCompare(b['Cartão'])),
    { 'Cartão': '', 'Mês da fatura': 'Sem faturas' },
  );

  // ---------- 4. Resumo mensal ----------
  const monthMap = new Map<string, any>();
  tx.forEach((t: any) => {
    const key = t.date?.slice(0, 7) ?? '';
    const row = monthMap.get(key) || {
      'Mês': monthLabel(key),
      Receitas: 0,
      'Despesas (débito)': 0,
      'Despesas (cartão)': 0,
      'Total de despesas': 0,
      Saldo: 0,
      'Transferências': 0,
      'Qtd. transações': 0,
    };
    const v = num(t.value);
    if (t.type === 'income') row.Receitas += v;
    else if (t.type === 'transfer') row['Transferências'] += v;
    else if (t.credit_card_id) row['Despesas (cartão)'] += v;
    else row['Despesas (débito)'] += v;
    row['Total de despesas'] = row['Despesas (débito)'] + row['Despesas (cartão)'];
    row.Saldo = row.Receitas - row['Total de despesas'];
    row['Qtd. transações'] += 1;
    monthMap.set(key, row);
  });
  addSheet(
    XLSX,
    wb,
    'Resumo Mensal',
    Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v),
    { 'Mês': 'Sem dados' },
  );

  // ---------- 5. Resumo por categoria ----------
  const catMap = new Map<string, any>();
  tx.forEach((t: any) => {
    const key = `${t.final_category}|${t.type}`;
    const row = catMap.get(key) || {
      Categoria: t.final_category ?? '',
      Tipo: TYPE_LABELS[t.type] ?? t.type,
      Total: 0,
      'Qtd. transações': 0,
      'Ticket médio': 0,
    };
    row.Total += num(t.value);
    row['Qtd. transações'] += 1;
    row['Ticket médio'] = row.Total / row['Qtd. transações'];
    catMap.set(key, row);
  });
  addSheet(
    XLSX,
    wb,
    'Por Categoria',
    Array.from(catMap.values()).sort((a, b) => b.Total - a.Total),
    { Categoria: 'Sem dados' },
  );

  // ---------- 6. Carteiras ----------
  addSheet(
    XLSX,
    wb,
    'Carteiras',
    (wallets || []).map((w: any) => ({
      Nome: w.name,
      Tipo: w.asset_type,
      Moeda: w.currency,
      'Saldo inicial': num(w.initial_balance),
      'Saldo atual': num(w.current_balance),
      'Cripto (símbolo)': w.crypto_symbol ?? '',
      'Cripto (qtd.)': num(w.crypto_amount),
      'Cripto (preço)': num(w.crypto_price),
      'Criada em': fmtDate(w.created_at),
    })),
    { Nome: 'Sem carteiras' },
  );

  // ---------- 7. Cartões (cadastro) ----------
  addSheet(
    XLSX,
    wb,
    'Cadastro de Cartões',
    cardList.map((c: any) => ({
      Nome: c.name,
      Limite: num(c.limit_amount),
      'Dia de fechamento': c.closing_day,
      'Dia de vencimento': c.due_day,
      'Estratégia de fechamento': c.closing_strategy,
      'Dias antes do vencimento': c.closing_days_before_due,
      'Criado em': fmtDate(c.created_at),
    })),
    { Nome: 'Sem cartões' },
  );

  // ---------- 8. Categorias ----------
  const catById = new Map((categories || []).map((c: any) => [c.id, c]));
  addSheet(
    XLSX,
    wb,
    'Categorias',
    (categories || []).map((c: any) => ({
      Nome: c.name,
      'Categoria pai': catById.get(c.parent_id)?.name ?? '',
      'Ícone': c.icon,
      Cor: c.color,
      'Palavras-chave': Array.isArray(c.keywords) ? c.keywords.join(', ') : '',
      Ativa: c.active ? 'Sim' : 'Não',
      Ordem: c.sort_order,
    })),
    { Nome: 'Sem categorias' },
  );

  // ---------- 9. Orçamentos ----------
  addSheet(
    XLSX,
    wb,
    'Orçamentos',
    (budgets || []).map((b: any) => ({
      'Mês': monthLabel(b.month_year),
      Categoria: catById.get(b.category_id)?.name ?? b.category,
      'Valor planejado': num(b.allocated_amount),
      Recorrente: b.is_recurring ? 'Sim' : 'Não',
      'Criado em': fmtDate(b.created_at),
    })),
    { 'Mês': 'Sem orçamentos' },
  );

  // ---------- 10. Dívidas ----------
  addSheet(
    XLSX,
    wb,
    'Dívidas',
    (debts || []).map((d: any) => ({
      Pessoa: d.person_name,
      Tipo: d.type === 'i_owe' ? 'Eu devo' : 'Me devem',
      'Valor total': num(d.total_amount),
      'Valor restante': num(d.remaining_amount),
      Vencimento: fmtDate(d.due_date),
      'Criada em': fmtDate(d.created_at),
    })),
    { Pessoa: 'Sem dívidas' },
  );

  // ---------- 11. Projetos ----------
  addSheet(
    XLSX,
    wb,
    'Projetos',
    (projects || []).map((p: any) => ({
      Nome: p.name,
      'Orçamento': num(p.budget),
      Cor: p.color,
      'Total gasto': tx
        .filter((t: any) => t.project_id === p.id && t.type === 'expense')
        .reduce((s: number, t: any) => s + num(t.value), 0),
      'Criado em': fmtDate(p.created_at),
    })),
    { Nome: 'Sem projetos' },
  );

  const fileName = `lumnia-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return { transactions: tx.length, cardTransactions: cardTx.length, sheets: wb.SheetNames.length };
}
