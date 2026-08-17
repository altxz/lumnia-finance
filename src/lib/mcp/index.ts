import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTransactions from "./tools/list-transactions";
import createTransaction from "./tools/create-transaction";
import listCategories from "./tools/list-categories";
import monthSummary from "./tools/month-summary";
import listWallets from "./tools/list-wallets";
import listCreditCards from "./tools/list-credit-cards";
import monthTransactions from "./tools/month-transactions";
import deleteTransaction from "./tools/delete-transaction";
import searchTool from "./tools/search";
import fetchTool from "./tools/fetch";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lumnia-mcp",
  title: "Lumnia",
  version: "0.2.1",
  instructions:
    "Ferramentas para o app Lumnia (gestão financeira pessoal). Use search para localizar transações por texto ou mês (YYYY-MM) e fetch para abrir os detalhes de um id encontrado. Use list_transactions/month_summary para consultar dados, create_transaction para lançar despesas ou receitas, delete_transaction para excluir uma transação (confirme com o usuário antes, é irreversível), month_transactions para ver, dia a dia, todas as transações de um mês com o saldo projetado ao final de cada dia, e list_categories/list_wallets/list_credit_cards para contexto do usuário.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
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
