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
import financialScore from "./tools/financial-score";
import searchTool from "./tools/search";
import fetchTool from "./tools/fetch";


const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

// Registra o fluxo OAuth/transporte sem expor bearer token ou claims completos.
setLogLevel("info");

export default defineMcp({
  name: "lumnia-mcp",
  title: "Lumnia",
  version: "0.5.1",
  instructions:
    "Ferramentas para o app Lumnia (gestão financeira pessoal, valores em BRL, meses no formato YYYY-MM e datas YYYY-MM-DD). Consultar: search + fetch para localizar e abrir transações, list_transactions, month_summary, month_transactions (dia a dia com saldo projetado), compare_months (variação por categoria), financial_score, list_budgets, list_categories, list_wallets, list_credit_cards, invoice_details (fatura de um cartão num mês). Registrar e editar: create_transaction, update_transaction (use scope 'single' para uma ocorrência, 'future' para esta e as próximas de uma recorrência, 'all' para toda a série/parcelamento), delete_transaction, set_transaction_paid (marcar pago/recebido ou desfazer), create_transfer (entre carteiras), pay_invoice (pagar/desfazer fatura de cartão), upsert_budget, manage_wallet, manage_category (criar, editar e excluir categorias e subcategorias), manage_project e investments (listar caixinhas, aportar ou resgatar). Antes de qualquer operação que altere séries recorrentes, parcelamentos, faturas ou exclua dados, confirme com o usuário. Sempre resolva nomes de carteiras, cartões, categorias e projetos com as ferramentas de listagem quando houver dúvida.",
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
    financialScore,
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
    investmentOps,
  ],

});
