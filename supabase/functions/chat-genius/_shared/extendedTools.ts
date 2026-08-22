/**
 * Ferramentas avançadas da IA interna (paridade com a integração MCP v0.5.0):
 * edição de transações com escopo de série, transferências, pagamento,
 * faturas de cartão, carteiras, categorias, projetos, investimentos,
 * score financeiro e exclusão de orçamento.
 */
import {
  ResolveError,
  defaultWalletId,
  resolveCategory,
  resolveCreditCard,
  resolveInvestment,
  resolveProject,
  resolveWallet,
} from "./resolve.ts";
import { computeFinancialScore } from "./financialScore.ts";
import {
  INVOICE_EXPENSE_COLS,
  getInvoicePeriod,
  getPaymentDate,
  matchExpensesToInvoice,
  pad2,
  toIsoDate,
} from "./invoice.ts";
import { buildFutureRecurringExceptionDates } from "./recurring.ts";
import { computeStats, investmentTypeLabel, rateLabel } from "./investmentMath.ts";

const MONTH_DESC = "Mês no formato YYYY-MM.";
const DATE_DESC = "Data no formato YYYY-MM-DD.";

function fn(name: string, description: string, properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties, required, additionalProperties: false },
    },
  };
}

const S = (description: string) => ({ type: "string", description });
const N = (description: string) => ({ type: "number", description });
const B = (description: string) => ({ type: "boolean", description });

export const extendedTools = [
  fn(
    "criar_transacao",
    "Cria uma despesa ou receita COMPLETA: aceita carteira/conta, cartão de crédito, mês da fatura, forma de pagamento, recorrência fixa, parcelamento, projeto, tags e observação. Prefira esta ferramenta a registrar_despesa/registrar_receita quando houver carteira, cartão, recorrência ou parcelas.",
    {
      description: S("Descrição da transação."),
      value: N("Valor positivo em BRL. Em parcelamentos é o valor total."),
      date: S(DATE_DESC),
      type: S("expense (despesa) ou income (receita)."),
      category: S("Nome da categoria."),
      wallet: S("Nome da conta/carteira. Se omitido usa a carteira padrão."),
      credit_card: S("Nome do cartão de crédito (compras no crédito)."),
      invoice_month: S("Mês da fatura (YYYY-MM). Se omitido é calculado pelo fechamento do cartão."),
      payment_method: S("Forma de pagamento (pix, debito, credito, dinheiro)."),
      is_paid: B("Se já foi pago/recebido. Padrão: true."),
      is_recurring: B("Despesa/receita fixa que se repete todo mês."),
      frequency: S("monthly (padrão) ou yearly."),
      installments: N("Número de parcelas. Acima de 1 cria uma parcela por mês."),
      project: S("Nome do projeto/centro de custo."),
      tags: { type: "array", items: { type: "string" }, description: "Etiquetas." },
      notes: S("Observações."),
    },
    ["description", "value", "date", "type"],
  ),
  fn(
    "editar_transacao",
    "Edita uma transação existente pelo id: descrição, valor, data, tipo, categoria, carteira, cartão, pago/não pago, recorrência, projeto, tags e observação. Em séries recorrentes ou parceladas informe scope: 'single' (só esta ocorrência), 'future' (esta e as próximas, preservando os meses anteriores) ou 'all' (toda a série). SEMPRE confirme com o utilizador antes de aplicar em série. Use buscar_transacoes para descobrir o id.",
    {
      id: S("ID UUID da transação."),
      scope: S("single (padrão), future ou all."),
      description: S("Nova descrição."),
      value: N("Novo valor."),
      date: S(DATE_DESC),
      type: S("expense ou income."),
      category: S("Nome da nova categoria."),
      wallet: S("Nome da conta/carteira."),
      credit_card: S("Nome do cartão."),
      remove_credit_card: B("true converte a despesa de cartão para débito."),
      invoice_month: S("Mês da fatura (YYYY-MM)."),
      payment_method: S("Forma de pagamento."),
      is_paid: B("Marcar pago/não pago."),
      is_recurring: B("Ativa/desativa recorrência fixa."),
      frequency: S("monthly ou yearly."),
      project: S("Nome do projeto."),
      tags: { type: "array", items: { type: "string" }, description: "Etiquetas." },
      notes: S("Observações."),
    },
    ["id"],
  ),
  fn(
    "marcar_pagamento",
    "Marca uma transação como paga/recebida ou desfaz o pagamento, podendo ajustar a data efetiva e a carteira usada.",
    {
      id: S("ID UUID da transação."),
      is_paid: B("true = pago/recebido, false = desfazer."),
      date: S("Data efetiva do pagamento (opcional)."),
      wallet: S("Nome da carteira usada no pagamento."),
    },
    ["id", "is_paid"],
  ),
  fn(
    "registrar_transferencia",
    "Registra uma transferência de dinheiro entre duas contas/carteiras do utilizador (sai de uma e entra na outra).",
    {
      from_wallet: S("Nome da carteira de origem."),
      to_wallet: S("Nome da carteira de destino."),
      value: N("Valor em BRL."),
      date: S(DATE_DESC),
      description: S("Descrição opcional."),
      notes: S("Observações."),
    },
    ["from_wallet", "to_wallet", "value", "date"],
  ),
  fn(
    "detalhe_fatura",
    "Mostra a fatura de um cartão num mês de vencimento: total, status (aberta/fechada/vencida/paga), período, vencimento e todas as compras que a compõem. Sem cartão informado, traz todos.",
    { month: S(MONTH_DESC + " Mês de vencimento da fatura."), credit_card: S("Nome do cartão (opcional).") },
    ["month"],
  ),
  fn(
    "pagar_fatura",
    "Registra o pagamento da fatura de um cartão num mês de vencimento, debitando de uma carteira, ou desfaz o pagamento (action='unpay'). Usa a mesma regra do app para não contar duas vezes fatura e pagamento. Confirme com o utilizador antes de executar.",
    {
      month: S(MONTH_DESC + " Mês de vencimento da fatura."),
      credit_card: S("Nome do cartão."),
      action: S("pay (padrão) ou unpay."),
      wallet: S("Nome da carteira que paga. Padrão: carteira padrão."),
      date: S("Data do pagamento. Padrão: data de vencimento."),
    },
    ["month", "credit_card"],
  ),
  fn(
    "gerir_carteira",
    "Cria uma nova conta/carteira ou edita uma existente (nome, saldo inicial, moeda e tipo).",
    {
      action: S("create ou update."),
      wallet: S("Nome da carteira a editar (em update)."),
      name: S("Nome (obrigatório em create; novo nome em update)."),
      initial_balance: N("Saldo inicial em BRL."),
      currency: S("Moeda (padrão BRL)."),
      asset_type: S("cash, bank, investment, crypto ou other. Padrão: bank."),
    },
    ["action"],
  ),
  fn(
    "gerir_categoria",
    "Cria uma categoria ou subcategoria (informe parent para vincular à categoria-mãe), renomeia, ou ativa/desativa uma existente.",
    {
      action: S("create ou update."),
      category: S("Nome da categoria a editar (em update)."),
      name: S("Nome (obrigatório em create; novo nome em update)."),
      parent: S("Nome da categoria-mãe, para criar subcategoria."),
      icon: S("Emoji/ícone."),
      color: S("Cor em hex."),
      active: B("false desativa a categoria."),
    },
    ["action"],
  ),
  fn(
    "gerir_projeto",
    "Lista, cria ou edita projetos/centros de custo (ex: Reforma, Viagem), com orçamento opcional e gasto acumulado.",
    {
      action: S("list, create ou update."),
      project: S("Nome do projeto a editar."),
      name: S("Nome do projeto."),
      budget: N("Orçamento total do projeto."),
      color: S("Cor em hex."),
    },
    ["action"],
  ),
  fn(
    "investimentos",
    "Lista os investimentos (caixinhas) com valor aplicado, valor atual, rendimento, taxa e projeção; ou registra um aporte (deposit) / resgate (withdraw), movimentando o dinheiro entre a carteira e o investimento como no app.",
    {
      action: S("list, deposit ou withdraw."),
      investment: S("Nome do investimento (para deposit/withdraw)."),
      value: N("Valor do aporte/resgate."),
      date: S("Data da movimentação. Padrão: hoje."),
      wallet: S("Carteira de origem (aporte) ou destino (resgate)."),
      close_investment: B("No resgate, true encerra o investimento."),
    },
    ["action"],
  ),
  fn(
    "score_financeiro",
    "Calcula o score financeiro do mês com as mesmas regras da página do app: nota geral 0-100 e as cinco dimensões (poupança 30%, dívidas e crédito 25%, orçamento 20%, reserva 15%, consistência 10%), com o número real que sustenta cada nota e o próximo passo recomendado.",
    { month: S(MONTH_DESC) },
    [],
  ),
  fn(
    "excluir_orcamento",
    "Exclui a meta de orçamento de uma categoria num mês. Confirme com o utilizador antes.",
    { month: S(MONTH_DESC), category: S("Nome da categoria do orçamento.") },
    ["month", "category"],
  ),
];

const okJson = (payload: Record<string, unknown>) => JSON.stringify({ sucesso: true, ...payload });
const failJson = (erro: string) => JSON.stringify({ sucesso: false, erro });

function monthParts(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthNumber };
}

export interface ExtendedHelpers {
  /** Projeção mensal já usada pela ferramenta projetar_saldo_final_mes. */
  projectMonth: (month: string) => Promise<any>;
  currentMonth: () => string;
}

export async function executeExtendedTool(
  name: string,
  args: Record<string, any>,
  userId: string,
  sb: any,
  helpers: ExtendedHelpers,
): Promise<string | null> {
  try {
    switch (name) {
      case "criar_transacao":
        return await createTransaction(args, userId, sb);
      case "editar_transacao":
        return await updateTransaction(args, userId, sb);
      case "marcar_pagamento":
        return await setPaid(args, userId, sb);
      case "registrar_transferencia":
        return await createTransfer(args, userId, sb);
      case "detalhe_fatura":
        return await invoiceDetails(args, userId, sb);
      case "pagar_fatura":
        return await payInvoice(args, userId, sb);
      case "gerir_carteira":
        return await manageWallet(args, userId, sb);
      case "gerir_categoria":
        return await manageCategory(args, userId, sb);
      case "gerir_projeto":
        return await manageProject(args, userId, sb);
      case "investimentos":
        return await investments(args, userId, sb);
      case "score_financeiro":
        return await financialScore(args, userId, sb, helpers);
      case "excluir_orcamento":
        return await deleteBudget(args, userId, sb);
      default:
        return null;
    }
  } catch (error) {
    if (error instanceof ResolveError) return failJson(error.message);
    return failJson(error instanceof Error ? error.message : String(error));
  }
}

/* ------------------------------- transações ------------------------------ */

async function createTransaction(args: any, userId: string, sb: any) {
  const card = await resolveCreditCard(sb, userId, { name: args.credit_card });
  const project = await resolveProject(sb, userId, { name: args.project });
  const category = await resolveCategory(sb, userId, { name: args.category });

  const wallet = await resolveWallet(sb, userId, { name: args.wallet });
  let walletId: string | null = wallet?.id ?? null;
  if (!card && !walletId) walletId = await defaultWalletId(sb, userId);

  const categoryName = category?.name ?? args.category ?? "outros";
  const installments = Number(args.installments ?? 1);
  const frequency = args.is_recurring ? (args.frequency ?? "monthly") : null;

  let invoiceMonth: string | null = args.invoice_month ?? null;
  if (card && !invoiceMonth) {
    const due = getPaymentDate(args.date, card as any);
    invoiceMonth = `${due.getFullYear()}-${pad2(due.getMonth() + 1)}`;
  }

  const base = {
    user_id: userId,
    description: args.description,
    type: args.type,
    final_category: categoryName,
    category_ai: categoryName,
    wallet_id: walletId,
    credit_card_id: card?.id ?? null,
    invoice_month: invoiceMonth,
    payment_method: args.payment_method ?? (card ? "credito" : null),
    is_paid: args.is_paid ?? true,
    is_recurring: !!args.is_recurring,
    frequency,
    project_id: project?.id ?? null,
    tags: args.tags ?? null,
    notes: args.notes ?? null,
  };

  if (installments > 1) {
    const groupId = crypto.randomUUID();
    const perInstallment = Math.round((Number(args.value) / installments) * 100) / 100;
    const start = new Date(`${args.date}T12:00:00`);
    const rows = Array.from({ length: installments }, (_, i) => {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      const iso = toIsoDate(d);
      let rowInvoice = invoiceMonth;
      if (card) {
        const due = getPaymentDate(iso, card as any);
        rowInvoice = `${due.getFullYear()}-${pad2(due.getMonth() + 1)}`;
      }
      return {
        ...base,
        date: iso,
        value: perInstallment,
        installments,
        installment_group_id: groupId,
        installment_info: `${i + 1}/${installments}`,
        invoice_month: rowInvoice,
        is_paid: i === 0 ? base.is_paid : false,
        is_recurring: false,
        frequency: null,
      };
    });
    const { data, error } = await sb.from("expenses").insert(rows).select("id,date,value");
    if (error) return failJson(error.message);
    return okJson({
      mensagem: `Criadas ${installments} parcelas de R$ ${perInstallment.toFixed(2)} para "${args.description}".`,
      parcelas: data,
      installment_group_id: groupId,
    });
  }

  const { data, error } = await sb
    .from("expenses")
    .insert({ ...base, date: args.date, value: args.value, installments: 1 })
    .select()
    .single();
  if (error) return failJson(error.message);
  return okJson({
    mensagem: `${args.description} — R$ ${Number(args.value).toFixed(2)} em ${args.date}${
      card ? ` (cartão ${card.name}, fatura ${invoiceMonth})` : ""
    }.`,
    transacao: data,
  });
}

async function updateTransaction(args: any, userId: string, sb: any) {
  const scope: "single" | "future" | "all" = args.scope ?? "single";
  const { data: row, error: rowError } = await sb
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("id", args.id)
    .maybeSingle();
  if (rowError) return failJson(rowError.message);
  if (!row) return failJson("Transação não encontrada para esta conta.");

  const card = args.remove_credit_card ? null : await resolveCreditCard(sb, userId, { name: args.credit_card });
  const wallet = await resolveWallet(sb, userId, { name: args.wallet });
  const project = await resolveProject(sb, userId, { name: args.project });
  const category = await resolveCategory(sb, userId, { name: args.category });

  const patch: Record<string, unknown> = {};
  if (args.description !== undefined) patch.description = args.description;
  if (args.value !== undefined) patch.value = args.value;
  if (args.date !== undefined) patch.date = args.date;
  if (args.type !== undefined) patch.type = args.type;
  if (category) patch.final_category = category.name;
  else if (args.category !== undefined) patch.final_category = args.category;
  if (wallet) patch.wallet_id = wallet.id;
  if (card) patch.credit_card_id = card.id;
  if (args.remove_credit_card) {
    patch.credit_card_id = null;
    patch.invoice_month = null;
  }
  if (args.payment_method !== undefined) patch.payment_method = args.payment_method;
  if (args.is_paid !== undefined) patch.is_paid = args.is_paid;
  if (args.project !== undefined) patch.project_id = project?.id ?? null;
  if (args.tags !== undefined) patch.tags = args.tags?.length ? args.tags : null;
  if (args.notes !== undefined) patch.notes = args.notes || null;
  if (args.is_recurring !== undefined) {
    patch.is_recurring = args.is_recurring;
    patch.frequency = args.is_recurring ? (args.frequency ?? row.frequency ?? "monthly") : null;
  } else if (args.frequency !== undefined) {
    patch.frequency = args.frequency;
  }

  const finalCardId = (patch.credit_card_id ?? row.credit_card_id) as string | null;
  if (args.invoice_month !== undefined) {
    patch.invoice_month = args.invoice_month;
  } else if (finalCardId && (args.date !== undefined || card)) {
    const cardData = card ?? (await resolveCreditCard(sb, userId, { id: finalCardId }));
    const due = getPaymentDate((patch.date ?? row.date) as string, cardData as any);
    patch.invoice_month = `${due.getFullYear()}-${pad2(due.getMonth() + 1)}`;
  }

  if (Object.keys(patch).length === 0) return failJson("Nenhum campo para atualizar foi informado.");

  // Parcelamento com escopo amplo: aplica a todas as parcelas do grupo.
  if (row.installment_group_id && scope !== "single") {
    const shared = { ...patch };
    delete shared.date;
    delete shared.invoice_month;
    const { data, error } = await sb
      .from("expenses")
      .update(shared)
      .eq("user_id", userId)
      .eq("installment_group_id", row.installment_group_id)
      .select("id");
    if (error) return failJson(error.message);
    return okJson({ mensagem: `Atualizadas ${data?.length ?? 0} parcelas do grupo.`, parcelas: data?.length ?? 0 });
  }

  // Ocorrência única de uma recorrência: exceção + lançamento avulso.
  if (row.is_recurring && scope === "single") {
    const occurrence = row.date;
    const { error: excError } = await sb
      .from("recurring_exceptions")
      .insert({ user_id: userId, template_id: row.id, occurrence_date: occurrence });
    if (excError && !`${excError.message}`.toLowerCase().includes("duplicate")) return failJson(excError.message);

    const { data, error } = await sb
      .from("expenses")
      .insert({
        ...row,
        ...patch,
        id: undefined,
        created_at: undefined,
        is_recurring: false,
        frequency: null,
        date: (patch.date ?? occurrence) as string,
      })
      .select()
      .single();
    if (error) return failJson(error.message);
    return okJson({ mensagem: "Alteração aplicada apenas nesta ocorrência.", transacao: data });
  }

  // Recorrência com escopo amplo: split de série preservando o histórico.
  if (row.is_recurring && scope !== "single") {
    const newDate = (patch.date ?? row.date) as string;
    const cutoff = row.date < newDate ? row.date : newDate;
    const frequency = (patch.frequency ?? row.frequency ?? "monthly") as string;
    const exceptionDates = buildFutureRecurringExceptionDates(row.date, cutoff, frequency);
    if (exceptionDates.length > 0) {
      const { error: excError } = await sb.from("recurring_exceptions").upsert(
        exceptionDates.map((occurrence_date) => ({ user_id: userId, template_id: row.id, occurrence_date })),
        { onConflict: "template_id,occurrence_date", ignoreDuplicates: true },
      );
      if (excError && !`${excError.message}`.toLowerCase().includes("duplicate")) return failJson(excError.message);
    }

    const { error: deactivateError } = await sb
      .from("expenses")
      .update({ is_recurring: false, frequency: null })
      .eq("user_id", userId)
      .eq("id", row.id);
    if (deactivateError) return failJson(deactivateError.message);

    const { error: cleanupError } = await sb
      .from("expenses")
      .delete()
      .eq("user_id", userId)
      .eq("description", row.description)
      .eq("type", row.type)
      .eq("is_recurring", false)
      .eq("is_paid", false)
      .gte("date", cutoff);
    if (cleanupError) return failJson(cleanupError.message);

    const { data, error } = await sb
      .from("expenses")
      .insert({
        ...row,
        ...patch,
        id: undefined,
        created_at: undefined,
        date: newDate,
        is_paid: false,
        is_recurring: true,
        frequency,
      })
      .select()
      .single();
    if (error) return failJson(error.message);
    return okJson({
      mensagem: "Recorrência atualizada a partir desta ocorrência (meses anteriores preservados).",
      transacao: data,
    });
  }

  const { data, error } = await sb
    .from("expenses")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", row.id)
    .select()
    .single();
  if (error) return failJson(error.message);
  return okJson({
    mensagem: `Transação atualizada: ${data.description} — R$ ${Number(data.value).toFixed(2)} em ${data.date}.`,
    transacao: data,
  });
}

async function setPaid(args: any, userId: string, sb: any) {
  const wallet = await resolveWallet(sb, userId, { name: args.wallet });
  const patch: Record<string, unknown> = { is_paid: args.is_paid };
  if (args.date) patch.date = args.date;
  if (wallet) patch.wallet_id = wallet.id;

  const { data, error } = await sb
    .from("expenses")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", args.id)
    .select()
    .maybeSingle();
  if (error) return failJson(error.message);
  if (!data) return failJson("Transação não encontrada para esta conta.");
  return okJson({
    mensagem: `${data.description}: ${args.is_paid ? "marcada como paga/recebida" : "pagamento desfeito"} (${data.date}).`,
    transacao: data,
  });
}

async function createTransfer(args: any, userId: string, sb: any) {
  const from = await resolveWallet(sb, userId, { name: args.from_wallet });
  const to = await resolveWallet(sb, userId, { name: args.to_wallet });
  if (!from || !to) return failJson("Informe a carteira de origem e a de destino.");
  if (from.id === to.id) return failJson("Origem e destino precisam ser carteiras diferentes.");

  const { data, error } = await sb
    .from("expenses")
    .insert({
      user_id: userId,
      date: args.date,
      description: args.description ?? `Transferência ${from.name} → ${to.name}`,
      value: args.value,
      type: "transfer",
      final_category: "transferencia",
      category_ai: "transferencia",
      wallet_id: from.id,
      destination_wallet_id: to.id,
      is_paid: true,
      is_recurring: false,
      installments: 1,
      notes: args.notes ?? null,
    })
    .select()
    .single();
  if (error) return failJson(error.message);
  return okJson({
    mensagem: `Transferência de R$ ${Number(args.value).toFixed(2)} de ${from.name} para ${to.name} em ${args.date}.`,
    transferencia: data,
  });
}

/* --------------------------------- cartões -------------------------------- */

async function loadInvoiceExpenses(sb: any, userId: string) {
  const { data, error } = await sb.from("expenses").select(INVOICE_EXPENSE_COLS).eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

async function invoiceDetails(args: any, userId: string, sb: any) {
  let cards: any[];
  if (args.credit_card) {
    cards = [await resolveCreditCard(sb, userId, { name: args.credit_card })];
  } else {
    const { data, error } = await sb.from("credit_cards").select("*").eq("user_id", userId);
    if (error) return failJson(error.message);
    cards = (data ?? []) as any[];
  }
  if (cards.length === 0) return failJson("Nenhum cartão de crédito cadastrado.");

  const rows = await loadInvoiceExpenses(sb, userId);
  const { year, monthNumber } = monthParts(args.month);

  const faturas = cards.map((card) => {
    const invoice = matchExpensesToInvoice(rows, getInvoicePeriod(card as any, year, monthNumber - 1));
    return {
      cartao: card.name,
      mes: args.month,
      status: invoice.status,
      total: Number(invoice.total.toFixed(2)),
      limite: Number(card.limit_amount ?? 0),
      periodo_inicio: toIsoDate(invoice.periodStart),
      periodo_fim: toIsoDate(invoice.periodEnd),
      vencimento: toIsoDate(invoice.dueDate),
      compras: invoice.transactions.map((t) => ({
        id: t.id,
        data: t.date,
        descricao: t.description,
        valor: Number(t.value),
        categoria: t.final_category,
      })),
    };
  });

  return okJson({ faturas });
}

async function payInvoice(args: any, userId: string, sb: any) {
  const action = args.action ?? "pay";
  const card = await resolveCreditCard(sb, userId, { name: args.credit_card });
  if (!card) return failJson("Informe o cartão.");

  if (action === "unpay") {
    const { data, error } = await sb
      .from("expenses")
      .delete()
      .eq("user_id", userId)
      .eq("invoice_month", args.month)
      .eq("credit_card_id", card.id)
      .ilike("description", "Pagamento fatura%")
      .not("wallet_id", "is", null)
      .select("id");
    if (error) return failJson(error.message);
    if (!data || data.length === 0)
      return failJson(`Não encontrei um pagamento registrado para a fatura de ${card.name} em ${args.month}.`);
    return okJson({ mensagem: `Pagamento da fatura ${card.name} (${args.month}) desfeito.` });
  }

  const rows = await loadInvoiceExpenses(sb, userId);
  const { year, monthNumber } = monthParts(args.month);
  const invoice = matchExpensesToInvoice(rows, getInvoicePeriod(card as any, year, monthNumber - 1));

  if (invoice.status === "paid") return failJson(`A fatura de ${card.name} em ${args.month} já está paga.`);
  if (invoice.total <= 0) return failJson(`A fatura de ${card.name} em ${args.month} não tem valor a pagar.`);

  const wallet = await resolveWallet(sb, userId, { name: args.wallet });
  const walletId = wallet?.id ?? (await defaultWalletId(sb, userId));
  if (!walletId) return failJson("Nenhuma carteira disponível para debitar o pagamento.");

  const dateStr = args.date ?? toIsoDate(invoice.dueDate);
  const { data, error } = await sb
    .from("expenses")
    .insert({
      user_id: userId,
      description: `Pagamento fatura ${card.name} - ${args.month}`,
      value: invoice.total,
      final_category: "cartao",
      category_ai: "cartao",
      type: "expense",
      date: dateStr,
      wallet_id: walletId,
      credit_card_id: card.id,
      is_paid: true,
      is_recurring: false,
      installments: 1,
      invoice_month: args.month,
    })
    .select()
    .single();
  if (error) return failJson(error.message);
  return okJson({
    mensagem: `Fatura ${card.name} (${args.month}) paga: R$ ${invoice.total.toFixed(2)} em ${dateStr}.`,
    pagamento: data,
    total_fatura: Number(invoice.total.toFixed(2)),
  });
}

/* ------------------------- carteiras / categorias ------------------------- */

async function manageWallet(args: any, userId: string, sb: any) {
  if (args.action === "create") {
    if (!args.name) return failJson("Informe o nome da carteira.");
    const initial = Number(args.initial_balance ?? 0);
    const { data, error } = await sb
      .from("wallets")
      .insert({
        user_id: userId,
        name: args.name,
        asset_type: args.asset_type ?? "bank",
        currency: args.currency ?? "BRL",
        initial_balance: initial,
        current_balance: initial,
      })
      .select()
      .single();
    if (error) return failJson(error.message);
    return okJson({ mensagem: `Carteira "${data.name}" criada com saldo inicial de R$ ${initial.toFixed(2)}.`, carteira: data });
  }

  const target = await resolveWallet(sb, userId, { name: args.wallet ?? args.name });
  if (!target) return failJson("Informe a carteira a editar.");
  const patch: Record<string, unknown> = {};
  if (args.wallet && args.name) patch.name = args.name;
  if (args.initial_balance !== undefined) patch.initial_balance = args.initial_balance;
  if (args.currency !== undefined) patch.currency = args.currency;
  if (args.asset_type !== undefined) patch.asset_type = args.asset_type;
  if (Object.keys(patch).length === 0) return failJson("Nenhum campo para atualizar.");

  const { data, error } = await sb
    .from("wallets")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", target.id)
    .select()
    .single();
  if (error) return failJson(error.message);
  return okJson({ mensagem: `Carteira "${data.name}" atualizada.`, carteira: data });
}

async function manageCategory(args: any, userId: string, sb: any) {
  const parent = args.parent ? await resolveCategory(sb, userId, { name: args.parent }) : null;

  if (args.action === "create") {
    if (!args.name) return failJson("Informe o nome da categoria.");
    const { data, error } = await sb
      .from("categories")
      .insert({
        user_id: userId,
        name: args.name,
        parent_id: parent?.id ?? null,
        icon: args.icon ?? "📦",
        color: args.color ?? "#94a3b8",
        active: args.active ?? true,
        sort_order: 999,
      })
      .select()
      .single();
    if (error) return failJson(error.message);
    return okJson({
      mensagem: `Categoria "${data.name}" criada${parent ? ` como subcategoria de "${parent.name}"` : ""}.`,
      categoria: data,
    });
  }

  const target = await resolveCategory(sb, userId, { name: args.category ?? args.name });
  if (!target) return failJson("Informe a categoria a editar.");
  const patch: Record<string, unknown> = {};
  if (args.category && args.name) patch.name = args.name;
  if (args.icon !== undefined) patch.icon = args.icon;
  if (args.color !== undefined) patch.color = args.color;
  if (args.active !== undefined) patch.active = args.active;
  if (args.parent) patch.parent_id = parent?.id ?? null;
  if (Object.keys(patch).length === 0) return failJson("Nenhum campo para atualizar.");

  const { data, error } = await sb
    .from("categories")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", target.id)
    .select()
    .single();
  if (error) return failJson(error.message);
  return okJson({ mensagem: `Categoria "${data.name}" atualizada${data.active ? "" : " (desativada)"}.`, categoria: data });
}

async function manageProject(args: any, userId: string, sb: any) {
  if (args.action === "list") {
    const { data, error } = await sb.from("projects").select("*").eq("user_id", userId).order("created_at");
    if (error) return failJson(error.message);
    const projects = (data ?? []) as any[];
    if (projects.length === 0) return okJson({ projetos: [] });

    const { data: expenses, error: expError } = await sb
      .from("expenses")
      .select("project_id,value,type")
      .eq("user_id", userId)
      .not("project_id", "is", null);
    if (expError) return failJson(expError.message);

    const spent = new Map<string, number>();
    for (const row of (expenses ?? []) as any[]) {
      if (row.type !== "expense") continue;
      spent.set(row.project_id, (spent.get(row.project_id) ?? 0) + Number(row.value));
    }

    return okJson({
      projetos: projects.map((p) => ({
        id: p.id,
        nome: p.name,
        orcamento: p.budget === null ? null : Number(p.budget),
        gasto: Number((spent.get(p.id) ?? 0).toFixed(2)),
      })),
    });
  }

  if (args.action === "create") {
    if (!args.name) return failJson("Informe o nome do projeto.");
    const { data, error } = await sb
      .from("projects")
      .insert({ user_id: userId, name: args.name, budget: args.budget ?? null, color: args.color ?? "#6366f1" })
      .select()
      .single();
    if (error) return failJson(error.message);
    return okJson({ mensagem: `Projeto "${data.name}" criado.`, projeto: data });
  }

  const target = await resolveProject(sb, userId, { name: args.project ?? args.name });
  if (!target) return failJson("Informe o projeto a editar.");
  const patch: Record<string, unknown> = {};
  if (args.project && args.name) patch.name = args.name;
  if (args.budget !== undefined) patch.budget = args.budget;
  if (args.color !== undefined) patch.color = args.color;
  if (Object.keys(patch).length === 0) return failJson("Nenhum campo para atualizar.");

  const { data, error } = await sb
    .from("projects")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", target.id)
    .select()
    .single();
  if (error) return failJson(error.message);
  return okJson({ mensagem: `Projeto "${data.name}" atualizado.`, projeto: data });
}

/* ------------------------------ investimentos ----------------------------- */

async function investments(args: any, userId: string, sb: any) {
  const { data: invRows, error: invError } = await sb
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (invError) return failJson(invError.message);
  const { data: movRows, error: movError } = await sb.from("investment_movements").select("*").eq("user_id", userId);
  if (movError) return failJson(movError.message);
  const allMovements = (movRows ?? []) as any[];

  if (args.action === "list") {
    const rows = (invRows ?? []) as any[];
    if (rows.length === 0) return okJson({ investimentos: [] });
    const result = rows.map((inv) => {
      const stats = computeStats(inv as any, allMovements.filter((m) => m.investment_id === inv.id) as any);
      return {
        id: inv.id,
        nome: inv.name,
        tipo: investmentTypeLabel(inv.investment_type),
        taxa: rateLabel(inv as any),
        status: inv.status,
        inicio: inv.start_date,
        vencimento: inv.maturity_date,
        aplicado: Number(stats.invested.toFixed(2)),
        valor_atual: Number(stats.currentValue.toFixed(2)),
        rendimento: Number(stats.earnings.toFixed(2)),
        rendimento_pct: Number(stats.earningsPct.toFixed(2)),
        valor_projetado: Number(stats.projectedValue.toFixed(2)),
        dias_restantes: stats.daysRemaining,
        taxa_anual_pct: Number(stats.annualRate.toFixed(2)),
      };
    });
    const total = result.reduce((s, r) => s + r.valor_atual, 0);
    return okJson({ investimentos: result, total_valor_atual: Number(total.toFixed(2)) });
  }

  const inv = await resolveInvestment(sb, userId, { name: args.investment });
  if (!inv) return failJson("Informe o investimento.");
  if (!args.value) return failJson("Informe o valor da movimentação.");
  if (!inv.investment_wallet_id) return failJson("Este investimento não tem carteira de investimento vinculada.");

  const isDeposit = args.action === "deposit";
  const wallet = await resolveWallet(sb, userId, { name: args.wallet });
  const cashWalletId = wallet?.id ?? inv.wallet_id ?? (await defaultWalletId(sb, userId));
  if (!cashWalletId) return failJson("Nenhuma carteira disponível para a movimentação.");

  const date = args.date ?? new Date().toISOString().slice(0, 10);
  const { data: expense, error: expError } = await sb
    .from("expenses")
    .insert({
      user_id: userId,
      date,
      description: isDeposit ? `Aporte em ${inv.name}` : `Resgate de ${inv.name}`,
      value: args.value,
      type: "transfer",
      final_category: "investimentos",
      category_ai: "investimentos",
      wallet_id: isDeposit ? cashWalletId : inv.investment_wallet_id,
      destination_wallet_id: isDeposit ? inv.investment_wallet_id : cashWalletId,
      is_paid: true,
      installments: 1,
      is_recurring: false,
    })
    .select("id")
    .single();
  if (expError) return failJson(expError.message);

  const { error: movInsertError } = await sb.from("investment_movements").insert({
    user_id: userId,
    investment_id: inv.id,
    kind: isDeposit ? "deposit" : "withdraw",
    amount: args.value,
    date,
    expense_id: expense.id,
  });
  if (movInsertError) {
    await sb.from("expenses").delete().eq("id", expense.id);
    return failJson(movInsertError.message);
  }

  if (!isDeposit && args.close_investment) {
    await sb.from("investments").update({ status: "redeemed" }).eq("user_id", userId).eq("id", inv.id);
  }

  return okJson({
    mensagem: `${isDeposit ? "Aporte" : "Resgate"} de R$ ${Number(args.value).toFixed(2)} em "${inv.name}" registrado em ${date}.`,
    investment_id: inv.id,
  });
}

/* --------------------------------- análises -------------------------------- */

async function financialScore(args: any, userId: string, sb: any, helpers: ExtendedHelpers) {
  const month = args.month || helpers.currentMonth();
  const { year, monthNumber } = monthParts(month);
  const monthAt = (offset: number) => {
    const d = new Date(year, monthNumber - 1 + offset, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  };

  // Usa o MESMO motor de projeção das telas (projetar_saldo_final_mes).
  const [current, prev1, prev2, prev3] = await Promise.all([
    helpers.projectMonth(month),
    helpers.projectMonth(monthAt(-1)),
    helpers.projectMonth(monthAt(-2)),
    helpers.projectMonth(monthAt(-3)),
  ]);
  const totalIncome = Number(current?.total_receitas_mes ?? 0);
  const totalExpense = Number(current?.total_despesas_mes ?? 0);
  const previousExpenses = [prev1, prev2, prev3].map((p) => Number(p?.total_despesas_mes ?? 0));

  const [{ data: budgetRows }, { data: debtRows }, { data: cardRows }, { data: walletRows }, { data: investmentRows }] =
    await Promise.all([
      sb.from("budgets").select("category, allocated_amount").eq("user_id", userId).eq("month_year", `${month}-01`),
      sb.from("debts").select("id, remaining_amount").eq("user_id", userId).eq("type", "i_owe"),
      sb.from("credit_cards").select("*").eq("user_id", userId),
      sb.from("wallets").select("current_balance, asset_type").eq("user_id", userId),
      sb.from("investments").select("principal, status").eq("user_id", userId),
    ]);

  const budgets = (budgetRows ?? []) as any[];
  const rows = await loadInvoiceExpenses(sb, userId);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${pad2(new Date(year, monthNumber, 0).getDate())}`;

  const spentByCategory: Record<string, number> = {};
  let ccExpenses = 0;
  let committed = 0;
  for (const e of rows) {
    if (e.type === "income" || e.type === "transfer") continue;
    if (e.date < monthStart || e.date > monthEnd) continue;
    const value = Number(e.value ?? 0);
    spentByCategory[e.final_category] = (spentByCategory[e.final_category] ?? 0) + value;
    if (e.credit_card_id) {
      ccExpenses += value;
      committed += value;
    } else if ((e as any).installment_group_id) {
      committed += value;
    }
    if ((e as any).debt_id) committed += value;
  }

  let totalLimit = 0;
  let hasOverdue = false;
  for (const card of (cardRows ?? []) as any[]) {
    totalLimit += Number(card.limit_amount ?? 0);
    const invoice = matchExpensesToInvoice(rows, getInvoicePeriod(card as any, year, monthNumber - 1));
    if (invoice.status === "overdue") hasOverdue = true;
  }
  const usageRatio = totalLimit > 0 ? ccExpenses / totalLimit : 0;

  const liquid = ((walletRows ?? []) as any[])
    .filter((w) => w.asset_type !== "crypto")
    .reduce((s, w) => s + Number(w.current_balance ?? 0), 0);
  const invested = ((investmentRows ?? []) as any[])
    .filter((i) => i.status === "active")
    .reduce((s, i) => s + Number(i.principal ?? 0), 0);

  const result = computeFinancialScore({
    totalIncome,
    totalExpense,
    budgets: budgets.map((b) => ({
      category: b.category,
      allocated: Number(b.allocated_amount ?? 0),
      spent: spentByCategory[b.category] ?? 0,
    })),
    committedAmount: committed,
    creditUsageRatio: usageRatio,
    hasOverdueInvoice: hasOverdue,
    liquidReserve: liquid + invested,
    previousExpenses,
  });

  const debts = ((debtRows ?? []) as any[]).filter((d) => Number(d.remaining_amount ?? 0) > 0);

  return okJson({
    month,
    score_geral: result.overall,
    classificacao: result.label,
    resumo: result.headline,
    dimensoes: result.dimensions.map((d) => ({
      chave: d.key,
      nome: d.label,
      nota: d.score,
      peso_pct: Number((d.weight * 100).toFixed(1)),
      avaliada: d.evaluated,
      numero_real: d.detail,
      acao: d.action,
    })),
    proximo_passo: result.nextStep,
    total_receitas: Math.round(totalIncome * 100) / 100,
    total_despesas: Math.round(totalExpense * 100) / 100,
    despesas_meses_anteriores: previousExpenses.map((v) => Math.round(v * 100) / 100),
    comprometido_no_mes: Math.round(committed * 100) / 100,
    uso_do_credito_pct: Number((usageRatio * 100).toFixed(1)),
    reserva_liquida: Math.round((liquid + invested) * 100) / 100,
    dividas_ativas: debts.length,
    fatura_vencida: hasOverdue,
  });
}

async function deleteBudget(args: any, userId: string, sb: any) {
  const category = await resolveCategory(sb, userId, { name: args.category }).catch(() => null);
  const categoryName = category?.name ?? args.category;
  const { data, error } = await sb
    .from("budgets")
    .delete()
    .eq("user_id", userId)
    .eq("month_year", `${args.month}-01`)
    .eq("category", categoryName)
    .select("id");
  if (error) return failJson(error.message);
  if (!data || data.length === 0)
    return failJson(`Não encontrei orçamento de "${categoryName}" em ${args.month}.`);
  return okJson({ mensagem: `Orçamento de "${categoryName}" em ${args.month} excluído.` });
}
