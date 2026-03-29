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

      let totalIncome = 0;
      let totalExpense = 0;
      for (const e of expenses || []) {
        if (e.type === "income") totalIncome += Number(e.value);
        else if (e.type === "expense" || e.type === "credit_card")
          totalExpense += Number(e.value);
      }
      return JSON.stringify({ month, total_receitas: totalIncome, total_despesas: totalExpense, saldo: totalIncome - totalExpense });
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
        .eq("is_paid", true)
        .order("value", { ascending: false })
        .limit(1);

      if (!data || data.length === 0)
        return JSON.stringify({ message: "Nenhuma despesa encontrada neste mês." });
      return JSON.stringify({ descricao: data[0].description, valor: data[0].value, data: data[0].date, categoria: data[0].final_category });
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
      }));
      if (result.length === 0)
        return JSON.stringify({ message: "Nenhum orçamento configurado para este mês." });
      return JSON.stringify({ month, categorias: result });
    }

    case "projetar_saldo_final_mes": {
      const month = (args.month as string) || getCurrentMonth();
      const { start, end } = getMonthRange(month);

      // 1. Saldo atual das carteiras
      const { data: wallets } = await supabase
        .from("wallets")
        .select("name, current_balance")
        .eq("user_id", userId);
      const saldoAtual = (wallets || []).reduce((s, w) => s + Number(w.current_balance), 0);

      // 2. Receitas pendentes do mês
      const { data: pendingIncome } = await supabase
        .from("expenses")
        .select("value, description")
        .eq("user_id", userId)
        .eq("type", "income")
        .eq("is_paid", false)
        .gte("date", start)
        .lte("date", end);
      const totalReceitasPendentes = (pendingIncome || []).reduce((s, e) => s + Number(e.value), 0);

      // 3. Despesas pendentes do mês (sem cartão de crédito)
      const { data: pendingExpenses } = await supabase
        .from("expenses")
        .select("value, description")
        .eq("user_id", userId)
        .eq("type", "expense")
        .eq("is_paid", false)
        .is("credit_card_id", null)
        .gte("date", start)
        .lte("date", end);
      const totalDespesasPendentes = (pendingExpenses || []).reduce((s, e) => s + Number(e.value), 0);

      // 4. Total das faturas de cartão do mês (by invoice_month)
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

      // Search by final_category match OR description containing the term
      const { data: byCat } = await supabase
        .from("expenses")
        .select("description, value, date, final_category")
        .eq("user_id", userId)
        .neq("type", "income")
        .eq("is_paid", true)
        .gte("date", start)
        .lte("date", end)
        .ilike("final_category", `%${categoria}%`);

      const { data: byDesc } = await supabase
        .from("expenses")
        .select("description, value, date, final_category")
        .eq("user_id", userId)
        .neq("type", "income")
        .eq("is_paid", true)
        .gte("date", start)
        .lte("date", end)
        .ilike("description", `%${categoria}%`);

      // Merge and deduplicate
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

      // Get cards
      let cardsQuery = supabase.from("credit_cards").select("id, name, limit_amount").eq("user_id", userId);
      if (nomeCartao) cardsQuery = cardsQuery.ilike("name", `%${nomeCartao}%`);
      const { data: cards } = await cardsQuery;

      if (!cards || cards.length === 0)
        return JSON.stringify({ message: nomeCartao ? `Nenhum cartão encontrado com o nome "${nomeCartao}".` : "Nenhum cartão de crédito cadastrado." });

      const results = [];
      for (const card of cards) {
        const { data: expenses } = await supabase
          .from("expenses")
          .select("value, description")
          .eq("user_id", userId)
          .eq("credit_card_id", card.id)
          .eq("invoice_month", monthStr);

        const total = (expenses || []).reduce((s, e) => s + Number(e.value), 0);
        results.push({
          cartao: card.name,
          limite: card.limit_amount,
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

    const systemPrompt = `Você é a Lumnia, uma assistente financeira pessoal inteligente e simpática. Responda sempre em português do Brasil.
Você tem acesso a ferramentas para consultar dados financeiros reais do utilizador e registar transações.
Seja concisa, use emojis com moderação e formate valores em R$.

Suas capacidades:
- Consultar resumo financeiro do mês (receitas, despesas, saldo)
- Buscar o maior gasto do mês
- Registar despesas e receitas
- Verificar orçamentos por categoria
- Projetar o saldo no final do mês (considerando contas pendentes e faturas)
- Consultar gastos por categoria ou termo de busca
- Ver faturas de cartão de crédito
- Listar contas pendentes

Quando o utilizador pedir para registar uma despesa, extraia descrição, valor e categoria da mensagem e use registrar_despesa.
Quando pedir para registar receita/salário/entrada, use registrar_receita.
Quando não souber a categoria, use "Outros".
Se não conseguir entender o pedido, pergunte para clarificar.`;

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
    while (assistantMessage?.tool_calls && iterations < 5) {
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
