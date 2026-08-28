import { auth, defineMcp, setLogLevel } from "@lovable.dev/mcp-js";
import listTransactions from "./tools/list-transactions";
import createTransaction from "./tools/create-transaction";
import updateTransaction from "./tools/update-transaction";
import createTransfer from "./tools/create-transfer";
import setTransactionPaid from "./tools/set-transaction-paid";
import listCategories from "./tools/list-categories";
import monthSummary from "./tools/month-summary";
import listWallets from "./tools/list-wallets";
import listCreditCards from "./tools/list-credit-cards";
import monthTransactions from "./tools/month-transactions";
import deleteTransaction from "./tools/delete-transaction";
import listBudgets from "./tools/list-budgets";
import upsertBudget from "./tools/upsert-budget";
import createBudget from "./tools/create-budget";
import updateBudget from "./tools/update-budget";
import deleteBudget from "./tools/delete-budget";
import invoiceDetails from "./tools/invoice-details";
import payInvoice from "./tools/pay-invoice";
import manageWallet from "./tools/manage-wallet";
import manageCategory from "./tools/manage-category";
import createCategory from "./tools/create-category";
import updateCategory from "./tools/update-category";
import deleteCategory from "./tools/delete-category";
import manageProject from "./tools/manage-project";
import investmentOps from "./tools/investment-ops";
import compareMonths from "./tools/compare-months";
import searchTool from "./tools/search";
import fetchTool from "./tools/fetch";


const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

// Registra o fluxo OAuth/transporte sem expor bearer token ou claims completos.
setLogLevel("info");

export default defineMcp({
  name: "lumnia-mcp",
  title: "Lumnia",
  version: "1.0.0",
  instructions:
    "MCP privado do Lumnia para gestão financeira pessoal. Valores em BRL, meses no formato YYYY-MM e datas YYYY-MM-DD. Consultas: search, fetch, list_transactions, month_summary, month_transactions, compare_months, list_budgets, list_categories, list_wallets, list_credit_cards e invoice_details. Operações: create_transaction, update_transaction, delete_transaction, set_transaction_paid, create_transfer, pay_invoice, upsert_budget, create_budget, update_budget, delete_budget, manage_wallet, manage_category, create_category, update_category, delete_category, manage_project e investments. Antes de qualquer escrita, confirme a intenção e repita o impacto financeiro, data e conta envolvidos. Em recorrências, parcelamentos, faturas, resgates ou exclusões, explique o alcance exato e obtenha confirmação explícita antes de chamar a ferramenta. Nunca invente IDs, saldos, carteiras, cartões, categorias ou projetos. Quando houver ambiguidade, use as ferramentas de listagem ou pesquisa antes de alterar dados.",
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
    updateTransaction,
    deleteTransaction,
    setTransactionPaid,
    createTransfer,
    monthSummary,
    monthTransactions,
    compareMonths,
    listCategories,
    manageCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    listWallets,
    manageWallet,
    manageProject,
    listCreditCards,
    invoiceDetails,
    payInvoice,
    listBudgets,
    upsertBudget,
    createBudget,
    updateBudget,
    deleteBudget,
    investmentOps,
  ],

});
