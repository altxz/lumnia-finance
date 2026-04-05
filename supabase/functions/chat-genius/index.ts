import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const tools = [
  {
    type: "function",
    function: {
      name: "consultar_resumo_mes",
      description: "Retorna o total de receitas, despesas e saldo do mês atual ou de um mês específico.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_maior_gasto",
      description: "Busca a transação de maior valor num mês específico.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_despesa",
      description: "Insere uma nova despesa no banco de dados do utilizador.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Descrição da despesa" },
          value: { type: "number", description: "Valor da despesa em reais" },
          category: { type: "string", description: "Categoria da despesa (ex: Alimentação, Transporte, Lazer, Saúde, Moradia, Educação, Outros)" },
          date: { type: "string", description: "Data da despesa no formato YYYY-MM-DD. Se omitido, usa a data de hoje." },
        },
        required: ["description", "value", "category"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_status_orcamento",
      description: "Verifica como estão os orçamentos (budgets) do mês atual, comparando o valor alocado vs gasto por categoria.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "projetar_saldo_final_mes",
      description: "Projeta o saldo no final do mês considerando saldo atual das carteiras, receitas e despesas pendentes e faturas de cartão de crédito. Responde 'como vou fechar o mês?'.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_receita",
      description: "Insere uma receita (entrada de dinheiro) no banco de dados do utilizador. Ex: salário, freelance, renda extra.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Descrição da receita" },
          value: { type: "number", description: "Valor da receita em reais" },
          category: { type: "string", description: "Categoria da receita (ex: Salário, Freelance, Investimentos, Outros)" },
          date: { type: "string", description: "Data no formato YYYY-MM-DD. Se omitido, usa hoje." },
          wallet_id: { type: "string", description: "ID da carteira. Se omitido, não vincula a nenhuma carteira." },
          is_paid: { type: "boolean", description: "Se já foi recebido. Default: true." },
        },
        required: ["description", "value", "category"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_gastos_por_categoria",
      description: "Consulta os gastos numa categoria específica ou por termo de busca na descrição. Ex: 'Quanto gastei em Alimentação?' ou 'Quanto gastei no iFood?'.",
      parameters: {
        type: "object",
        properties: {
          categoria: { type: "string", description: "Nome da categoria ou termo de busca na descrição" },
          mes: { type: "number", description: "Mês (1-12). Se omitido, usa o mês atual." },
          ano: { type: "number", description: "Ano (ex: 2026). Se omitido, usa o ano atual." },
        },
        required: ["categoria"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_fatura_cartao",
      description: "Consulta o total da fatura de um cartão de crédito para um mês específico. Ex: 'Quanto está a fatura do Nubank para Abril?'.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "number", description: "Mês (1-12). Se omitido, usa o mês atual." },
          ano: { type: "number", description: "Ano. Se omitido, usa o ano atual." },
          nome_cartao: { type: "string", description: "Nome do cartão de crédito. Se omitido, mostra todos os cartões." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_contas_pendentes",
      description: "Lista todas as contas/despesas pendentes (não pagas) de um mês. Ex: 'Que contas faltam pagar este mês?'.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "number", description: "Mês (1-12). Se omitido, usa o mês atual." },
          ano: { type: "number", description: "Ano. Se omitido, usa o ano atual." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ---- NEW TOOLS ----
  {
    type: "function",
    function: {
      name: "listar_carteiras",
      description: "Lista todas as carteiras/contas bancárias do utilizador com saldos atuais. Ex: 'Quais meus saldos?' ou 'Quanto tenho em cada conta?'.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "comparar_meses",
      description: "Compara receitas, despesas e saldo entre dois meses. Ex: 'Compare abril com março' ou 'Gastei mais esse mês que no anterior?'.",
      parameters: {
        type: "object",
        properties: {
          mes1: { type: "string", description: "Primeiro mês no formato YYYY-MM." },
          mes2: { type: "string", description: "Segundo mês no formato YYYY-MM." },
        },
        required: ["mes1", "mes2"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_transacoes",
      description: "Busca transações por termo na descrição, retornando as mais recentes. Ex: 'Mostre minhas compras no Mercado Livre' ou 'Busque transações de Uber'.",
      parameters: {
        type: "object",
        properties: {
          termo: { type: "string", description: "Termo de busca na descrição da transação." },
          limite: { type: "number", description: "Quantidade máxima de resultados. Default: 10." },
        },
        required: ["termo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_dividas",
      description: "Lista as dívidas/empréstimos do utilizador. Mostra quem deve ao utilizador e quanto ele deve a outros. Ex: 'Quem me deve dinheiro?' ou 'Quais minhas dívidas?'.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["they_owe", "i_owe", "all"], description: "Filtrar por tipo: 'they_owe' (devem a mim), 'i_owe' (eu devo), 'all' (todas). Default: all." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "top_categorias_gastos",
      description: "Retorna as categorias com mais gastos no mês, rankeadas do maior para o menor. Ex: 'Onde gasto mais?' ou 'Quais minhas maiores categorias de despesa?'.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual." },
          limite: { type: "number", description: "Quantidade de categorias. Default: 5." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "media_diaria_gastos",
      description: "Calcula a média diária de gastos do mês e estima o total projetado para o final do mês. Ex: 'Qual minha média diária de gastos?' ou 'Quanto estou gastando por dia?'.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_receitas_pendentes",
      description: "Lista receitas pendentes (não recebidas) do mês. Ex: 'Que receitas faltam receber?' ou 'Quanto tenho para receber ainda?'.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "number", description: "Mês (1-12). Se omitido, usa o mês atual." },
          ano: { type: "number", description: "Ano. Se omitido, usa o ano atual." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_transacoes_recorrentes",
      description: "Lista todas as transações recorrentes/fixas ativas do utilizador (contas fixas, salário, assinaturas). Ex: 'Quais minhas contas fixas?' ou 'Mostre minhas assinaturas'.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["income", "expense", "all"], description: "Filtrar: 'income' (receitas fixas), 'expense' (despesas fixas), 'all'. Default: all." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_patrimonio",
      description: "Consulta o patrimônio líquido do utilizador (total de ativos menos passivos). Ex: 'Qual meu patrimônio?' ou 'Quanto tenho de patrimônio líquido?'.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "analise_economia",
      description: "Analisa a taxa de economia/poupança do mês (% da renda que sobrou). Ex: 'Quanto estou economizando?' ou 'Qual minha taxa de poupança?'.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deletar_transacao",
      description: "Exclui uma transação específica pelo ID. O utilizador precisa confirmar. Ex: 'Apague a despesa X'.",
      parameters: {
        type: "object",
        properties: {
          transacao_id: { type: "string", description: "ID da transação a ser excluída." },
        },
        required: ["transacao_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "evolucao_gastos",
      description: "Mostra a evolução dos gastos nos últimos N meses, útil para ver tendências. Ex: 'Como meus gastos evoluíram nos últimos 6 meses?'.",
      parameters: {
        type: "object",
        properties: {
          meses: { type: "number", description: "Quantidade de meses para analisar. Default: 6." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "oportunidades_economia",
      description: "Analisa oportunidades de economia do utilizador combinando: top categorias de gastos, comparação com mês anterior, orçamentos, transações recorrentes e média diária. Usa quando perguntarem 'onde posso economizar?', 'como reduzir gastos?', 'oportunidades de economia'.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preparar_orcamento",
      description: "Busca todos os dados necessários para criar ou sugerir um orçamento mensal: receitas do mês atual e anterior, gastos por categoria, orçamentos existentes do mês anterior e categorias do utilizador. Usa quando perguntarem 'me ajude a criar um orçamento', 'quero montar meu orçamento', 'criar orçamento para o próximo mês'.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês-alvo para o orçamento no formato YYYY-MM. Se omitido, usa o próximo mês." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_orcamento",
      description: "Salva/atualiza orçamentos de múltiplas categorias de uma vez. Use para aplicar todas as sugestões quando o utilizador confirmar.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mês no formato YYYY-MM." },
          budgets: {
            type: "array",
            description: "Lista de orçamentos a salvar.",
            items: {
              type: "object",
              properties: {
                category_id: { type: "string", description: "ID UUID da categoria." },
                category_name: { type: "string", description: "Nome da categoria." },
                amount: { type: "number", description: "Valor alocado." },
              },
              required: ["category_id", "category_name", "amount"],
            },
          },
        },
        required: ["month", "budgets"],
        additionalProperties: false,
      },
    },
  },
];

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
  return { start, end };
}

function resolveMonthYear(args: Record<string, unknown>): { mes: number; ano: number; monthStr: string } {
  const now = new Date();
  const mes = (args.mes as number) || now.getMonth() + 1;
  const ano = (args.ano as number) || now.getFullYear();
  const monthStr = `${ano}-${String(mes).padStart(2, "0")}`;
  return { mes, ano, monthStr };
}

function getMonthSummary(expenses: Array<{ value: number; type: string }>) {
  let totalIncome = 0;
  let totalExpense = 0;
  for (const e of expenses) {
    if (e.type === "income") totalIncome += Number(e.value);
    else if (e.type !== "transfer") totalExpense += Number(e.value);
  }
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  switch (name) {
    case "consultar_resumo_mes": {
      const month = (args.month as string) || getCurrentMonth();
      const { start, end } = getMonthRange(month);
      const { data: expenses } = await supabase
        .from("expenses")
        .select("value, type")
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end)
        .eq("is_paid", true);

      const summary = getMonthSummary(expenses || []);
      return JSON.stringify({ month, total_receitas: summary.totalIncome, total_despesas: summary.totalExpense, saldo: summary.balance });
    }

    case "buscar_maior_gasto": {
      const month = (args.month as string) || getCurrentMonth();
      const { start, end } = getMonthRange(month);
      const { data } = await supabase
        .from("expenses")
        .select("description, value, date, final_category")
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end)
        .neq("type", "income")
        .neq("type", "transfer")
        .order("value", { ascending: false })
        .limit(5);

      if (!data || data.length === 0)
        return JSON.stringify({ message: "Nenhuma despesa encontrada neste mês." });
      return JSON.stringify({
        maiores_gastos: data.map(d => ({ descricao: d.description, valor: d.value, data: d.date, categoria: d.final_category })),
      });
    }

    case "registrar_despesa": {
      const date = (args.date as string) || new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("expenses").insert({
        user_id: userId,
        description: args.description as string,
        value: args.value as number,
        final_category: args.category as string,
        date,
        type: "expense",
        is_paid: true,
      });
      if (error) return JSON.stringify({ sucesso: false, erro: error.message });
      return JSON.stringify({ sucesso: true, descricao: args.description, valor: args.value, categoria: args.category, data: date });
    }

    case "consultar_status_orcamento": {
      const month = (args.month as string) || getCurrentMonth();
      const { start, end } = getMonthRange(month);
      const monthDate = `${month}-01`;
      const { data: budgets } = await supabase
        .from("budgets")
        .select("category, allocated_amount")
        .eq("user_id", userId)
        .eq("month_year", monthDate);

      const { data: expenses } = await supabase
        .from("expenses")
        .select("final_category, value")
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end)
        .neq("type", "income")
        .eq("is_paid", true);

      const spentByCategory: Record<string, number> = {};
      for (const e of expenses || []) {
        spentByCategory[e.final_category] = (spentByCategory[e.final_category] || 0) + Number(e.value);
      }
      const result = (budgets || []).map((b) => ({
        categoria: b.category,
        orcamento: b.allocated_amount,
        gasto: spentByCategory[b.category] || 0,
        restante: b.allocated_amount - (spentByCategory[b.category] || 0),
        percentual: b.allocated_amount > 0 ? Math.round(((spentByCategory[b.category] || 0) / b.allocated_amount) * 100) : 0,
      }));
      if (result.length === 0)
        return JSON.stringify({ message: "Nenhum orçamento configurado para este mês." });
      return JSON.stringify({ month, categorias: result });
    }

    case "projetar_saldo_final_mes": {
      const month = (args.month as string) || getCurrentMonth();
      const { start, end } = getMonthRange(month);

      const { data: wallets } = await supabase
        .from("wallets")
        .select("name, current_balance")
        .eq("user_id", userId);
      const saldoAtual = (wallets || []).reduce((s, w) => s + Number(w.current_balance), 0);

      const { data: pendingIncome } = await supabase
        .from("expenses")
        .select("value, description")
        .eq("user_id", userId)
        .eq("type", "income")
        .eq("is_paid", false)
        .gte("date", start)
        .lte("date", end);
      const totalReceitasPendentes = (pendingIncome || []).reduce((s, e) => s + Number(e.value), 0);

      const { data: pendingExpenses } = await supabase
        .from("expenses")
        .select("value, description")
        .eq("user_id", userId)
        .neq("type", "income")
        .neq("type", "transfer")
        .eq("is_paid", false)
        .is("credit_card_id", null)
        .gte("date", start)
        .lte("date", end);
      const totalDespesasPendentes = (pendingExpenses || []).reduce((s, e) => s + Number(e.value), 0);

      const { data: ccExpenses } = await supabase
        .from("expenses")
        .select("value")
        .eq("user_id", userId)
        .not("credit_card_id", "is", null)
        .eq("invoice_month", month);
      const totalFaturas = (ccExpenses || []).reduce((s, e) => s + Number(e.value), 0);

      const saldoProjetado = saldoAtual + totalReceitasPendentes - totalDespesasPendentes - totalFaturas;

      return JSON.stringify({
        month,
        saldo_atual_carteiras: saldoAtual,
        receitas_pendentes: totalReceitasPendentes,
        despesas_pendentes: totalDespesasPendentes,
        faturas_cartao: totalFaturas,
        saldo_projetado: saldoProjetado,
        carteiras: (wallets || []).map(w => ({ nome: w.name, saldo: w.current_balance })),
      });
    }

    case "registrar_receita": {
      const date = (args.date as string) || new Date().toISOString().split("T")[0];
      const insertData: Record<string, unknown> = {
        user_id: userId,
        description: args.description as string,
        value: args.value as number,
        final_category: args.category as string,
        date,
        type: "income",
        is_paid: args.is_paid !== undefined ? args.is_paid : true,
      };
      if (args.wallet_id) insertData.wallet_id = args.wallet_id;

      const { error } = await supabase.from("expenses").insert(insertData);
      if (error) return JSON.stringify({ sucesso: false, erro: error.message });
      return JSON.stringify({
        sucesso: true,
        descricao: args.description,
        valor: args.value,
        categoria: args.category,
        data: date,
        tipo: "receita",
      });
    }

    case "consultar_gastos_por_categoria": {
      const { monthStr } = resolveMonthYear(args);
      const { start, end } = getMonthRange(monthStr);
      const categoria = (args.categoria as string) || "";

      const { data: byCat } = await supabase
        .from("expenses")
        .select("description, value, date, final_category")
        .eq("user_id", userId)
        .neq("type", "income")
        .gte("date", start)
        .lte("date", end)
        .ilike("final_category", `%${categoria}%`);

      const { data: byDesc } = await supabase
        .from("expenses")
        .select("description, value, date, final_category")
        .eq("user_id", userId)
        .neq("type", "income")
        .gte("date", start)
        .lte("date", end)
        .ilike("description", `%${categoria}%`);

      const seen = new Set<string>();
      const all: Array<{ description: string; value: number; date: string; final_category: string }> = [];
      for (const list of [byCat || [], byDesc || []]) {
        for (const e of list) {
          const key = `${e.description}-${e.value}-${e.date}`;
          if (!seen.has(key)) { seen.add(key); all.push(e); }
        }
      }

      const total = all.reduce((s, e) => s + Number(e.value), 0);
      return JSON.stringify({
        termo_busca: categoria,
        mes: monthStr,
        total,
        quantidade: all.length,
        transacoes: all.slice(0, 10).map(e => ({ descricao: e.description, valor: e.value, data: e.date, categoria: e.final_category })),
      });
    }

    case "consultar_fatura_cartao": {
      const { monthStr } = resolveMonthYear(args);
      const nomeCartao = args.nome_cartao as string | undefined;

      let cardsQuery = supabase.from("credit_cards").select("id, name, limit_amount, due_day").eq("user_id", userId);
      if (nomeCartao) cardsQuery = cardsQuery.ilike("name", `%${nomeCartao}%`);
      const { data: cards } = await cardsQuery;

      if (!cards || cards.length === 0)
        return JSON.stringify({ message: nomeCartao ? `Nenhum cartão encontrado com o nome "${nomeCartao}".` : "Nenhum cartão de crédito cadastrado." });

      const results = [];
      for (const card of cards) {
        const { data: expenses } = await supabase
          .from("expenses")
          .select("value, description, date")
          .eq("user_id", userId)
          .eq("credit_card_id", card.id)
          .eq("invoice_month", monthStr);

        const total = (expenses || []).reduce((s, e) => s + Number(e.value), 0);
        results.push({
          cartao: card.name,
          limite: card.limit_amount,
          dia_vencimento: card.due_day,
          total_fatura: total,
          limite_disponivel: card.limit_amount - total,
          qtd_transacoes: (expenses || []).length,
        });
      }

      return JSON.stringify({ mes: monthStr, cartoes: results });
    }

    case "listar_contas_pendentes": {
      const { monthStr } = resolveMonthYear(args);
      const { start, end } = getMonthRange(monthStr);

      const { data } = await supabase
        .from("expenses")
        .select("description, value, date, final_category, is_recurring, frequency")
        .eq("user_id", userId)
        .eq("type", "expense")
        .eq("is_paid", false)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      if (!data || data.length === 0)
        return JSON.stringify({ message: "Nenhuma conta pendente encontrada para este mês. 🎉" });

      const total = data.reduce((s, e) => s + Number(e.value), 0);
      return JSON.stringify({
        mes: monthStr,
        total_pendente: total,
        quantidade: data.length,
        contas: data.map(e => ({
          descricao: e.description,
          valor: e.value,
          data_vencimento: e.date,
          categoria: e.final_category,
          recorrente: e.is_recurring,
        })),
      });
    }

    // ---- NEW TOOLS ----

    case "listar_carteiras": {
      const { data: wallets } = await supabase
        .from("wallets")
        .select("id, name, current_balance, initial_balance, currency, asset_type, crypto_symbol, crypto_amount")
        .eq("user_id", userId)
        .order("name");

      if (!wallets || wallets.length === 0)
        return JSON.stringify({ message: "Nenhuma carteira cadastrada." });

      const total = wallets.reduce((s, w) => s + Number(w.current_balance), 0);
      return JSON.stringify({
        total_geral: total,
        carteiras: wallets.map(w => ({
          nome: w.name,
          saldo_atual: w.current_balance,
          saldo_inicial: w.initial_balance,
          moeda: w.currency,
          tipo: w.asset_type,
          ...(w.crypto_symbol ? { crypto: w.crypto_symbol, quantidade_crypto: w.crypto_amount } : {}),
        })),
      });
    }

    case "comparar_meses": {
      const mes1 = args.mes1 as string;
      const mes2 = args.mes2 as string;
      const r1 = getMonthRange(mes1);
      const r2 = getMonthRange(mes2);

      const [{ data: exp1 }, { data: exp2 }] = await Promise.all([
        supabase.from("expenses").select("value, type").eq("user_id", userId).gte("date", r1.start).lte("date", r1.end).eq("is_paid", true),
        supabase.from("expenses").select("value, type").eq("user_id", userId).gte("date", r2.start).lte("date", r2.end).eq("is_paid", true),
      ]);

      const s1 = getMonthSummary(exp1 || []);
      const s2 = getMonthSummary(exp2 || []);

      return JSON.stringify({
        [mes1]: { receitas: s1.totalIncome, despesas: s1.totalExpense, saldo: s1.balance },
        [mes2]: { receitas: s2.totalIncome, despesas: s2.totalExpense, saldo: s2.balance },
        variacao: {
          receitas: s2.totalIncome - s1.totalIncome,
          despesas: s2.totalExpense - s1.totalExpense,
          saldo: s2.balance - s1.balance,
          pct_despesas: s1.totalExpense > 0 ? Math.round(((s2.totalExpense - s1.totalExpense) / s1.totalExpense) * 100) : 0,
        },
      });
    }

    case "buscar_transacoes": {
      const termo = args.termo as string;
      const limite = (args.limite as number) || 10;

      const { data } = await supabase
        .from("expenses")
        .select("id, description, value, date, type, final_category, is_paid, is_recurring, credit_card_id, installment_info")
        .eq("user_id", userId)
        .ilike("description", `%${termo}%`)
        .order("date", { ascending: false })
        .limit(limite);

      if (!data || data.length === 0)
        return JSON.stringify({ message: `Nenhuma transação encontrada com "${termo}".` });

      return JSON.stringify({
        termo,
        quantidade: data.length,
        transacoes: data.map(e => ({
          id: e.id,
          descricao: e.description,
          valor: e.value,
          data: e.date,
          tipo: e.type,
          categoria: e.final_category,
          pago: e.is_paid,
          recorrente: e.is_recurring,
          cartao: !!e.credit_card_id,
          parcela: e.installment_info,
        })),
      });
    }

    case "consultar_dividas": {
      const tipo = (args.tipo as string) || "all";

      let query = supabase
        .from("debts")
        .select("id, person_name, total_amount, remaining_amount, due_date, type")
        .eq("user_id", userId);

      if (tipo !== "all") query = query.eq("type", tipo);

      const { data } = await query.order("remaining_amount", { ascending: false });

      if (!data || data.length === 0)
        return JSON.stringify({ message: "Nenhuma dívida registrada. 🎉" });

      const totalDevemAMim = data.filter(d => d.type === "they_owe").reduce((s, d) => s + Number(d.remaining_amount), 0);
      const totalEuDevo = data.filter(d => d.type === "i_owe").reduce((s, d) => s + Number(d.remaining_amount), 0);

      return JSON.stringify({
        total_devem_a_mim: totalDevemAMim,
        total_eu_devo: totalEuDevo,
        saldo_liquido: totalDevemAMim - totalEuDevo,
        dividas: data.map(d => ({
          pessoa: d.person_name,
          valor_total: d.total_amount,
          valor_restante: d.remaining_amount,
          vencimento: d.due_date,
          tipo: d.type === "they_owe" ? "Devem a mim" : "Eu devo",
        })),
      });
    }

    case "top_categorias_gastos": {
      const month = (args.month as string) || getCurrentMonth();
      const { start, end } = getMonthRange(month);
      const limite = (args.limite as number) || 5;

      const { data: expenses } = await supabase
        .from("expenses")
        .select("final_category, value")
        .eq("user_id", userId)
        .neq("type", "income")
        .neq("type", "transfer")
        .gte("date", start)
        .lte("date", end);

      const byCategory: Record<string, number> = {};
      for (const e of expenses || []) {
        byCategory[e.final_category] = (byCategory[e.final_category] || 0) + Number(e.value);
      }

      const totalGeral = Object.values(byCategory).reduce((s, v) => s + v, 0);
      const sorted = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limite)
        .map(([cat, val]) => ({
          categoria: cat,
          total: val,
          percentual: totalGeral > 0 ? Math.round((val / totalGeral) * 100) : 0,
        }));

      return JSON.stringify({ month, total_geral: totalGeral, categorias: sorted });
    }

    case "media_diaria_gastos": {
      const month = (args.month as string) || getCurrentMonth();
      const { start, end } = getMonthRange(month);
      const [y, m] = month.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();

      const now = new Date();
      const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m;
      const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;

      const { data: expenses } = await supabase
        .from("expenses")
        .select("value")
        .eq("user_id", userId)
        .neq("type", "income")
        .neq("type", "transfer")
        .eq("is_paid", true)
        .gte("date", start)
        .lte("date", end);

      const total = (expenses || []).reduce((s, e) => s + Number(e.value), 0);
      const mediaDiaria = daysElapsed > 0 ? total / daysElapsed : 0;
      const projecaoMes = mediaDiaria * daysInMonth;

      return JSON.stringify({
        month,
        total_gasto_ate_agora: total,
        dias_decorridos: daysElapsed,
        dias_no_mes: daysInMonth,
        media_diaria: Math.round(mediaDiaria * 100) / 100,
        projecao_fim_mes: Math.round(projecaoMes * 100) / 100,
      });
    }

    case "consultar_receitas_pendentes": {
      const { monthStr } = resolveMonthYear(args);
      const { start, end } = getMonthRange(monthStr);

      const { data } = await supabase
        .from("expenses")
        .select("description, value, date, final_category, is_recurring")
        .eq("user_id", userId)
        .eq("type", "income")
        .eq("is_paid", false)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      if (!data || data.length === 0)
        return JSON.stringify({ message: "Nenhuma receita pendente para este mês." });

      const total = data.reduce((s, e) => s + Number(e.value), 0);
      return JSON.stringify({
        mes: monthStr,
        total_pendente: total,
        quantidade: data.length,
        receitas: data.map(e => ({
          descricao: e.description,
          valor: e.value,
          data_prevista: e.date,
          categoria: e.final_category,
          recorrente: e.is_recurring,
        })),
      });
    }

    case "listar_transacoes_recorrentes": {
      const tipo = (args.tipo as string) || "all";

      let query = supabase
        .from("expenses")
        .select("description, value, date, type, final_category, frequency, credit_card_id")
        .eq("user_id", userId)
        .eq("is_recurring", true);

      if (tipo === "income") query = query.eq("type", "income");
      else if (tipo === "expense") query = query.neq("type", "income");

      const { data } = await query.order("description");

      if (!data || data.length === 0)
        return JSON.stringify({ message: "Nenhuma transação recorrente encontrada." });

      // Deduplicate by description+value (templates repeat)
      const seen = new Set<string>();
      const unique = data.filter(e => {
        const key = `${e.description}-${e.value}-${e.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const receitasFixas = unique.filter(e => e.type === "income");
      const despesasFixas = unique.filter(e => e.type !== "income");

      return JSON.stringify({
        total_receitas_fixas: receitasFixas.reduce((s, e) => s + Number(e.value), 0),
        total_despesas_fixas: despesasFixas.reduce((s, e) => s + Number(e.value), 0),
        receitas: receitasFixas.map(e => ({ descricao: e.description, valor: e.value, frequencia: e.frequency, categoria: e.final_category })),
        despesas: despesasFixas.map(e => ({ descricao: e.description, valor: e.value, frequencia: e.frequency, categoria: e.final_category, cartao: !!e.credit_card_id })),
      });
    }

    case "consultar_patrimonio": {
      const { data: wallets } = await supabase
        .from("wallets")
        .select("name, current_balance, asset_type")
        .eq("user_id", userId);

      const { data: debtsOwed } = await supabase
        .from("debts")
        .select("remaining_amount")
        .eq("user_id", userId)
        .eq("type", "i_owe");

      const { data: debtsToMe } = await supabase
        .from("debts")
        .select("remaining_amount")
        .eq("user_id", userId)
        .eq("type", "they_owe");

      const { data: ccExpenses } = await supabase
        .from("expenses")
        .select("value")
        .eq("user_id", userId)
        .not("credit_card_id", "is", null)
        .eq("is_paid", false);

      const totalAtivos = (wallets || []).reduce((s, w) => s + Number(w.current_balance), 0);
      const totalAReceber = (debtsToMe || []).reduce((s, d) => s + Number(d.remaining_amount), 0);
      const totalDividas = (debtsOwed || []).reduce((s, d) => s + Number(d.remaining_amount), 0);
      const totalFaturasPendentes = (ccExpenses || []).reduce((s, e) => s + Number(e.value), 0);

      const patrimonioLiquido = totalAtivos + totalAReceber - totalDividas - totalFaturasPendentes;

      return JSON.stringify({
        ativos: totalAtivos,
        a_receber: totalAReceber,
        dividas: totalDividas,
        faturas_pendentes: totalFaturasPendentes,
        patrimonio_liquido: patrimonioLiquido,
        carteiras: (wallets || []).map(w => ({ nome: w.name, saldo: w.current_balance, tipo: w.asset_type })),
      });
    }

    case "analise_economia": {
      const month = (args.month as string) || getCurrentMonth();
      const { start, end } = getMonthRange(month);

      const { data: expenses } = await supabase
        .from("expenses")
        .select("value, type")
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end)
        .eq("is_paid", true);

      const summary = getMonthSummary(expenses || []);
      const taxaEconomia = summary.totalIncome > 0 ? ((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100 : 0;

      let avaliacao = "";
      if (taxaEconomia >= 30) avaliacao = "Excelente! Você está poupando mais de 30% da renda. 🏆";
      else if (taxaEconomia >= 20) avaliacao = "Muito bom! Meta de 20% atingida. 💪";
      else if (taxaEconomia >= 10) avaliacao = "Razoável. Tente chegar a 20%. 📈";
      else if (taxaEconomia > 0) avaliacao = "Atenção: economia abaixo de 10%. Revise gastos. ⚠️";
      else avaliacao = "Alerta: gastos superaram receitas! Ação urgente necessária. 🚨";

      return JSON.stringify({
        month,
        receitas: summary.totalIncome,
        despesas: summary.totalExpense,
        economia: Math.round((summary.totalIncome - summary.totalExpense) * 100) / 100,
        taxa_economia: Math.round(taxaEconomia * 10) / 10,
        avaliacao,
      });
    }

    case "deletar_transacao": {
      const id = args.transacao_id as string;
      const { data: existing } = await supabase
        .from("expenses")
        .select("id, description, value, type")
        .eq("user_id", userId)
        .eq("id", id)
        .single();

      if (!existing) return JSON.stringify({ sucesso: false, erro: "Transação não encontrada." });

      const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", userId);
      if (error) return JSON.stringify({ sucesso: false, erro: error.message });

      return JSON.stringify({
        sucesso: true,
        descricao: existing.description,
        valor: existing.value,
        tipo: existing.type,
      });
    }

    case "evolucao_gastos": {
      const meses = (args.meses as number) || 6;
      const now = new Date();
      const resultado = [];

      for (let i = meses - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const { start, end } = getMonthRange(monthStr);

        const { data: expenses } = await supabase
          .from("expenses")
          .select("value, type")
          .eq("user_id", userId)
          .gte("date", start)
          .lte("date", end)
          .eq("is_paid", true);

        const summary = getMonthSummary(expenses || []);
        resultado.push({
          mes: monthStr,
          receitas: summary.totalIncome,
          despesas: summary.totalExpense,
          saldo: summary.balance,
        });
      }

      return JSON.stringify({ evolucao: resultado });
    }

    case "oportunidades_economia": {
      const month = (args.month as string) || getCurrentMonth();
      const { start, end } = getMonthRange(month);
      const [y, m] = month.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const now = new Date();
      const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m;
      const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;

      // Previous month
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      const prevMonth = `${prevY}-${String(prevM).padStart(2, "0")}`;
      const prevRange = getMonthRange(prevMonth);

      // Parallel queries
      const [
        { data: curExpenses },
        { data: prevExpenses },
        { data: budgets },
        { data: recurring },
      ] = await Promise.all([
        supabase.from("expenses").select("value, type, final_category, description, is_recurring, credit_card_id")
          .eq("user_id", userId).gte("date", start).lte("date", end),
        supabase.from("expenses").select("value, type, final_category")
          .eq("user_id", userId).neq("type", "income").neq("type", "transfer")
          .gte("date", prevRange.start).lte("date", prevRange.end),
        supabase.from("budgets").select("category, allocated_amount")
          .eq("user_id", userId).eq("month_year", `${month}-01`),
        supabase.from("expenses").select("description, value, type, final_category, frequency")
          .eq("user_id", userId).eq("is_recurring", true).neq("type", "income"),
      ]);

      // Current month breakdown
      const curByCategory: Record<string, number> = {};
      let totalExpense = 0, totalIncome = 0;
      for (const e of curExpenses || []) {
        if (e.type === "income") { totalIncome += Number(e.value); continue; }
        if (e.type === "transfer") continue;
        totalExpense += Number(e.value);
        curByCategory[e.final_category] = (curByCategory[e.final_category] || 0) + Number(e.value);
      }

      // Previous month breakdown
      const prevByCategory: Record<string, number> = {};
      let prevTotal = 0;
      for (const e of prevExpenses || []) {
        prevTotal += Number(e.value);
        prevByCategory[e.final_category] = (prevByCategory[e.final_category] || 0) + Number(e.value);
      }

      // Top categories with comparison
      const topCats = Object.entries(curByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([cat, val]) => ({
          categoria: cat,
          gasto_atual: val,
          gasto_mes_anterior: prevByCategory[cat] || 0,
          variacao_pct: prevByCategory[cat] > 0 ? Math.round(((val - prevByCategory[cat]) / prevByCategory[cat]) * 100) : null,
          percentual_do_total: totalExpense > 0 ? Math.round((val / totalExpense) * 100) : 0,
        }));

      // Categories that increased significantly
      const aumentaram = topCats.filter(c => c.variacao_pct !== null && c.variacao_pct > 20);

      // Budget overruns
      const orcamentosEstourados = (budgets || [])
        .map(b => ({
          categoria: b.category,
          orcamento: b.allocated_amount,
          gasto: curByCategory[b.category] || 0,
          pct: b.allocated_amount > 0 ? Math.round(((curByCategory[b.category] || 0) / b.allocated_amount) * 100) : 0,
        }))
        .filter(b => b.pct >= 70);

      // Recurring expenses summary
      const seen = new Set<string>();
      const uniqueRecurring = (recurring || []).filter(e => {
        const key = `${e.description}-${e.value}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      const totalRecorrente = uniqueRecurring.reduce((s, e) => s + Number(e.value), 0);

      // Daily average & projection
      const mediaDiaria = daysElapsed > 0 ? totalExpense / daysElapsed : 0;
      const projecaoMes = mediaDiaria * daysInMonth;
      const taxaEconomia = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

      return JSON.stringify({
        mes: month,
        resumo: {
          receitas: totalIncome,
          despesas: totalExpense,
          taxa_economia: taxaEconomia,
          media_diaria: Math.round(mediaDiaria * 100) / 100,
          projecao_fim_mes: Math.round(projecaoMes * 100) / 100,
          despesas_mes_anterior: prevTotal,
          variacao_total_pct: prevTotal > 0 ? Math.round(((totalExpense - prevTotal) / prevTotal) * 100) : null,
        },
        top_categorias: topCats,
        categorias_que_aumentaram: aumentaram,
        orcamentos_em_risco: orcamentosEstourados,
        despesas_fixas: {
          total: totalRecorrente,
          itens: uniqueRecurring.slice(0, 10).map(e => ({ descricao: e.description, valor: e.value, categoria: e.final_category })),
        },
      });
    }

    case "preparar_orcamento": {
      const now = new Date();
      let targetMonth = args.month as string;
      if (!targetMonth) {
        const nextM = now.getMonth() + 2; // getMonth is 0-based, we want next month
        const nextY = nextM > 12 ? now.getFullYear() + 1 : now.getFullYear();
        const m = nextM > 12 ? nextM - 12 : nextM;
        targetMonth = `${nextY}-${String(m).padStart(2, "0")}`;
      }

      // Current month for reference
      const curMonth = getCurrentMonth();
      const { start: curStart, end: curEnd } = getMonthRange(curMonth);
      
      // Previous month
      const [ty, tm] = targetMonth.split("-").map(Number);
      const prevM = tm === 1 ? 12 : tm - 1;
      const prevY = tm === 1 ? ty - 1 : ty;
      const prevMonth = `${prevY}-${String(prevM).padStart(2, "0")}`;
      const { start: prevStart, end: prevEnd } = getMonthRange(prevMonth);

      const [
        { data: categories },
        { data: curExpenses },
        { data: prevExpenses },
        { data: prevBudgets },
        { data: curIncome },
        { data: recurringExpenses },
      ] = await Promise.all([
        supabase.from("categories").select("id, name, parent_id, icon").eq("user_id", userId).eq("active", true).order("sort_order"),
        supabase.from("expenses").select("final_category, value, type").eq("user_id", userId).gte("date", curStart).lte("date", curEnd),
        supabase.from("expenses").select("final_category, value, type").eq("user_id", userId).gte("date", prevStart).lte("date", prevEnd),
        supabase.from("budgets").select("category, category_id, allocated_amount").eq("user_id", userId).eq("month_year", `${prevMonth}-01`),
        supabase.from("expenses").select("value").eq("user_id", userId).eq("type", "income").gte("date", curStart).lte("date", curEnd),
        supabase.from("expenses").select("description, value, final_category, frequency").eq("user_id", userId).eq("is_recurring", true).neq("type", "income").neq("type", "transfer"),
      ]);

      // Income
      const totalIncome = (curIncome || []).reduce((s, e) => s + Number(e.value), 0);

      // Spending by category (current month)
      const curByCategory: Record<string, number> = {};
      (curExpenses || []).forEach((e: any) => {
        if (e.type !== "income" && e.type !== "transfer") {
          curByCategory[e.final_category] = (curByCategory[e.final_category] || 0) + Number(e.value);
        }
      });

      // Spending by category (prev month)
      const prevByCategory: Record<string, number> = {};
      (prevExpenses || []).forEach((e: any) => {
        if (e.type !== "income" && e.type !== "transfer") {
          prevByCategory[e.final_category] = (prevByCategory[e.final_category] || 0) + Number(e.value);
        }
      });

      // Previous budgets map
      const prevBudgetMap: Record<string, number> = {};
      (prevBudgets || []).forEach((b: any) => {
        prevBudgetMap[b.category] = Number(b.allocated_amount);
      });

      // Unique recurring
      const seen = new Set<string>();
      const uniqueRecurring = (recurringExpenses || []).filter((e: any) => {
        const key = `${e.description}-${e.value}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });

      // Parent categories with spending data
      const parents = (categories || []).filter((c: any) => !c.parent_id);
      const catSuggestions = parents.map((cat: any) => {
        const children = (categories || []).filter((c: any) => c.parent_id === cat.id);
        const allNames = [cat.name, ...children.map((c: any) => c.name)];
        const curSpent = allNames.reduce((s, n) => s + (curByCategory[n] || 0), 0);
        const prevSpent = allNames.reduce((s, n) => s + (prevByCategory[n] || 0), 0);
        const prevBudget = prevBudgetMap[cat.name] || 0;
        return {
          id: cat.id,
          nome: cat.name,
          gasto_mes_atual: Math.round(curSpent * 100) / 100,
          gasto_mes_anterior: Math.round(prevSpent * 100) / 100,
          orcamento_anterior: prevBudget,
          sugestao: prevBudget > 0 ? prevBudget : Math.round(Math.max(curSpent, prevSpent) * 1.1 * 100) / 100,
          subcategorias: children.map((c: any) => c.name),
        };
      }).filter((c: any) => c.gasto_mes_atual > 0 || c.gasto_mes_anterior > 0 || c.orcamento_anterior > 0);

      return JSON.stringify({
        mes_alvo: targetMonth,
        receita_mensal: totalIncome,
        categorias: catSuggestions,
        despesas_fixas_recorrentes: uniqueRecurring.slice(0, 15).map((e: any) => ({
          descricao: e.description,
          valor: e.value,
          categoria: e.final_category,
        })),
        total_fixo: uniqueRecurring.reduce((s, e: any) => s + Number(e.value), 0),
      });
    }

    case "salvar_orcamento": {
      const month = args.month as string;
      const monthDate = `${month}-01`;
      const budgetsList = args.budgets as Array<{ category_id: string; category_name: string; amount: number }>;
      
      if (!budgetsList || budgetsList.length === 0) {
        // Fallback: single budget (backward compat)
        const categoryId = args.category_id as string;
        const categoryName = args.category_name as string;
        const amount = args.amount as number;
        if (!categoryId || !amount) return JSON.stringify({ sucesso: false, erro: "Parâmetros inválidos" });
        
        const { data: existing } = await supabase.from("budgets").select("id").eq("user_id", userId).eq("category_id", categoryId).eq("month_year", monthDate).maybeSingle();
        if (existing) {
          await supabase.from("budgets").update({ allocated_amount: amount }).eq("id", existing.id);
        } else {
          await supabase.from("budgets").insert({ user_id: userId, category: categoryName, category_id: categoryId, month_year: monthDate, allocated_amount: amount });
        }
        return JSON.stringify({ sucesso: true, categorias_salvas: 1 });
      }

      const results: string[] = [];
      for (const b of budgetsList) {
        const { data: existing } = await supabase.from("budgets").select("id").eq("user_id", userId).eq("category_id", b.category_id).eq("month_year", monthDate).maybeSingle();
        if (existing) {
          const { error } = await supabase.from("budgets").update({ allocated_amount: b.amount }).eq("id", existing.id);
          if (error) results.push(`❌ ${b.category_name}: ${error.message}`);
          else results.push(`✅ ${b.category_name}: R$ ${b.amount.toFixed(2)}`);
        } else {
          const { error } = await supabase.from("budgets").insert({ user_id: userId, category: b.category_name, category_id: b.category_id, month_year: monthDate, allocated_amount: b.amount });
          if (error) results.push(`❌ ${b.category_name}: ${error.message}`);
          else results.push(`✅ ${b.category_name}: R$ ${b.amount.toFixed(2)}`);
        }
      }

      return JSON.stringify({ sucesso: true, categorias_salvas: budgetsList.length, detalhes: results });
    }

    default:
      return JSON.stringify({ error: "Função desconhecida" });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, user_id, history } = await req.json();
    if (!message || !user_id) {
      return new Response(
        JSON.stringify({ error: "message e user_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const systemPrompt = `Você é a Lumnia, uma assistente financeira pessoal inteligente e autônoma. Responda sempre em português do Brasil.
Você tem acesso a ferramentas para consultar dados financeiros REAIS do utilizador e registar transações.
Seja concisa, use emojis com moderação e formate valores em R$.

## REGRA FUNDAMENTAL — CONSULTAR PRIMEIRO, RESPONDER DEPOIS

Você é PROIBIDA de pedir ao utilizador qualquer informação que possa ser obtida através das suas ferramentas. Isso inclui, mas não se limita a:
- Categorias de gasto (você pode consultar com top_categorias_gastos)
- Receita/salário (você pode consultar com consultar_resumo_mes)
- Saldos de carteiras (você pode consultar com listar_carteiras)
- Gastos por categoria (você pode consultar com consultar_gastos_por_categoria)
- Faturas de cartão (você pode consultar com consultar_fatura_cartao)
- Despesas fixas/recorrentes (você pode consultar com listar_transacoes_recorrentes)
- Orçamentos existentes (você pode consultar com consultar_status_orcamento)
- Patrimônio (você pode consultar com consultar_patrimonio)

ANTES de responder a QUALQUER pergunta financeira, SEMPRE chame as ferramentas relevantes para obter os dados. Combine múltiplas ferramentas quando necessário para dar uma resposta completa.

Exemplos de comportamento CORRETO:
- "Me ajude a criar um orçamento" → chame preparar_orcamento → sugira valores baseados nos dados reais
- "Como estão minhas finanças?" → chame consultar_resumo_mes + top_categorias_gastos + listar_carteiras → analise tudo
- "Dá para cortar algum gasto?" → chame oportunidades_economia → analise com dados reais
- "Quanto gastei esse mês?" → chame consultar_resumo_mes → responda com números reais
- "Me dê dicas financeiras" → chame consultar_resumo_mes + top_categorias_gastos + analise_economia → personalize as dicas com dados reais

Exemplos de comportamento PROIBIDO:
- ❌ "Qual sua receita mensal?" — você pode descobrir sozinha
- ❌ "Quais são seus tipos de despesas?" — você pode consultar
- ❌ "Me informe seus gastos fixos" — você tem acesso a esses dados
- ❌ Responder com conselhos genéricos sem consultar dados primeiro

## Ferramentas disponíveis:
- consultar_resumo_mes: Resumo financeiro (receitas, despesas, saldo)
- buscar_maior_gasto: Top maiores gastos do mês
- registrar_despesa / registrar_receita: Registar transações
- consultar_status_orcamento: Orçamentos por categoria
- projetar_saldo_final_mes: Projeção de fechamento do mês
- consultar_gastos_por_categoria: Gastos por categoria/termo
- consultar_fatura_cartao: Faturas de cartão de crédito
- listar_contas_pendentes / consultar_receitas_pendentes: Contas a pagar/receber
- listar_carteiras: Carteiras e saldos
- comparar_meses: Comparar dois meses
- buscar_transacoes: Buscar por nome/descrição
- consultar_dividas: Dívidas e empréstimos
- top_categorias_gastos: Ranking de categorias
- media_diaria_gastos: Média diária e projeção
- listar_transacoes_recorrentes: Assinaturas/contas fixas
- consultar_patrimonio: Patrimônio líquido
- analise_economia: Taxa de poupança
- deletar_transacao: Excluir transação
- evolucao_gastos: Evolução nos últimos meses
- oportunidades_economia: Análise completa de oportunidades de economia
- preparar_orcamento: Busca dados completos para sugerir orçamento mensal
- salvar_orcamento: Salva orçamento de uma categoria após confirmação

## Diretrizes adicionais:
- Para registar despesa, extraia descrição, valor e categoria → use registrar_despesa
- Categoria desconhecida → use "Outros"
- Comparar meses sem especificar → compare o mês atual com o anterior
- Evolução sem período → últimos 6 meses
- Se a pergunta for vaga, consulte os dados PRIMEIRO e depois peça clarificação apenas se necessário com base nos dados.`;

    const conversationMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (history && Array.isArray(history)) {
      for (const h of history) {
        conversationMessages.push({ role: h.role, content: h.content });
      }
    }
    conversationMessages.push({ role: "user", content: message });

    let aiResponse = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: conversationMessages,
        tools,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const text = await aiResponse.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI error: ${status}`);
    }

    let data = await aiResponse.json();
    let assistantMessage = data.choices?.[0]?.message;

    let iterations = 0;
    while (assistantMessage?.tool_calls && iterations < 8) {
      iterations++;
      conversationMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments || "{}");
        console.log(`Executing tool: ${fnName}`, fnArgs);

        const result = await executeTool(fnName, fnArgs, user_id, supabase);

        conversationMessages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
        } as any);
      }

      aiResponse = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: conversationMessages,
          tools,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI follow-up error: ${aiResponse.status}`);
      }

      data = await aiResponse.json();
      assistantMessage = data.choices?.[0]?.message;
    }

    const reply = assistantMessage?.content || "Desculpe, não consegui processar o seu pedido.";

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("chat-genius error:", error);
    return new Response(
      JSON.stringify({
        error: "Erro ao processar mensagem",
        reply: "Desculpe, ocorreu um erro. Tente novamente.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
