import { auth, defineMcp, setLogLevel } from "@lovable.dev/mcp-js";
import listTransactions from "./tools/list-transactions";
import createTransaction from "./tools/create-transaction";
import listCategories from "./tools/list-categories";
import monthSummary from "./tools/month-summary";
import listWallets from "./tools/list-wallets";
import listCreditCards from "./tools/list-credit-cards";
import monthTransactions from "./tools/month-transactions";
import deleteTransaction from "./tools/delete-transaction";
import listBudgets from "./tools/list-budgets";
import upsertBudget from "./tools/upsert-budget";
import searchTool from "./tools/search";
import fetchTool from "./tools/fetch";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

// Registra o fluxo OAuth/transporte sem expor bearer token ou claims completos.
setLogLevel("info");

export default defineMcp({
  name: "lumnia-mcp",
  title: "Lumnia",
  version: "0.4.0",
  instructions:
    "Ferramentas para o app Lumnia (gestão financeira pessoal). Use search para localizar transações por texto ou mês (YYYY-MM) e fetch para abrir os detalhes de um id encontrado. Use list_transactions/month_summary para consultar dados, create_transaction para lançar despesas ou receitas, delete_transaction para excluir uma transação (confirme com o usuário antes, é irreversível), month_transactions para ver, dia a dia, todas as transações de um mês com o saldo projetado ao final de cada dia, list_budgets para ler os orçamentos do mês (planejado, gasto e restante) e upsert_budget para criar ou editar a meta de uma categoria, e list_categories/list_wallets/list_credit_cards para contexto do usuário.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    // O ChatGPT pode concluir o OAuth com um token de sessão válido que não
    // inclui client_id/azp. Issuer, assinatura e audience continuam obrigatórios.
    requireOAuthClientClaim: false,
  }),
  tools: [
    searchTool,
    fetchTool,
    listTransactions,
    createTransaction,
    listCategories,
    monthSummary,
    listWallets,
    listCreditCards,
    monthTransactions,
    deleteTransaction,
  ],
});
