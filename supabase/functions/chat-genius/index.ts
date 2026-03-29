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
      description:
        "Retorna o total de receitas, despesas e saldo do mês atual ou de um mês específico.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "string",
            description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual.",
          },
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
          month: {
            type: "string",
            description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual.",
          },
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
      description:
        "Insere uma nova despesa no banco de dados do utilizador.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Descrição da despesa" },
          value: { type: "number", description: "Valor da despesa em reais" },
          category: {
            type: "string",
            description: "Categoria da despesa (ex: Alimentação, Transporte, Lazer, Saúde, Moradia, Educação, Outros)",
          },
          date: {
            type: "string",
            description: "Data da despesa no formato YYYY-MM-DD. Se omitido, usa a data de hoje.",
          },
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
      description:
        "Verifica como estão os orçamentos (budgets) do mês atual, comparando o valor alocado vs gasto por categoria.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "string",
            description: "Mês no formato YYYY-MM. Se omitido, usa o mês atual.",
          },
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

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const month = (args.month as string) || getCurrentMonth();
  const { start, end } = getMonthRange(month);

  switch (name) {
    case "consultar_resumo_mes": {
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
      return JSON.stringify({
        month,
        total_receitas: totalIncome,
        total_despesas: totalExpense,
        saldo: totalIncome - totalExpense,
      });
    }

    case "buscar_maior_gasto": {
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

      return JSON.stringify({
        descricao: data[0].description,
        valor: data[0].value,
        data: data[0].date,
        categoria: data[0].final_category,
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
      return JSON.stringify({
        sucesso: true,
        descricao: args.description,
        valor: args.value,
        categoria: args.category,
        data: date,
      });
    }

    case "consultar_status_orcamento": {
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
        spentByCategory[e.final_category] =
          (spentByCategory[e.final_category] || 0) + Number(e.value);
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
Quando o utilizador pedir para registar uma despesa, extraia descrição, valor e categoria da mensagem e use a ferramenta registrar_despesa.
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

    // First AI call with tools
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

    // Handle tool calls loop (max 5 iterations)
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

      // Follow-up AI call with tool results
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
