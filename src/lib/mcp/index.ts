import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTransactions from "./tools/list-transactions";
import createTransaction from "./tools/create-transaction";
import listCategories from "./tools/list-categories";
import monthSummary from "./tools/month-summary";
import listWallets from "./tools/list-wallets";
import listCreditCards from "./tools/list-credit-cards";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lumnia-mcp",
  title: "Lumnia",
  version: "0.1.0",
  instructions:
    "Ferramentas para o app Lumnia (gestão financeira pessoal). Use list_transactions/month_summary para consultar dados, create_transaction para lançar despesas ou receitas, e list_categories/list_wallets/list_credit_cards para contexto do usuário.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listTransactions,
    createTransaction,
    listCategories,
    monthSummary,
    listWallets,
    listCreditCards,
  ],
});
