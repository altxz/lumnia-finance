# Página de Investimentos (estilo "Caixinha")

Nova área onde você cadastra investimentos (CDB, caixinha, Tesouro, etc.), define a taxa e o prazo, e a plataforma calcula o rendimento. O dinheiro sai da carteira via transferência com categoria "Investimentos", e a carteira passa a mostrar dois saldos separados: **Saldo atual** e **Saldo em investimentos**.

## O que você poderá fazer

- Criar um investimento com: nome, tipo (Caixinha/CDB/LCI/Tesouro/Fundo/Outro), carteira de origem, valor aportado, data de início, prazo (em dias/meses ou data de vencimento) e a taxa.
- Informar a taxa por investimento (sem CDI global): escolher entre
  - `% do CDI` + o valor do CDI anual que você digitar naquele investimento,
  - `Prefixado` (% ao ano),
  - `IPCA + %` (com o IPCA que você informar).
- Ver, para cada investimento: valor aportado, rendimento acumulado até hoje, valor atual, valor projetado no vencimento, rentabilidade % e dias restantes.
- Fazer novos aportes em um investimento existente (sai da carteira escolhida).
- Resgatar total ou parcial: o valor sugerido é aportado + rendimento, **e você pode editar o valor devolvido** antes de confirmar (sem cálculo de IR).
- Cards de resumo no topo: total investido, rendimento acumulado, valor atual total, projeção no vencimento.
- Gráfico de evolução do patrimônio investido (curva de juros compostos por mês) e distribuição por tipo de investimento.

## Efeito na carteira e nas transações

- Aporte: cria uma transação do tipo **transferência** com categoria "Investimentos", saindo da carteira escolhida e entrando numa carteira de investimento correspondente. Reduz o saldo atual e aumenta o saldo investido.
- Resgate: transferência inversa (investimento → carteira), com o valor que você confirmar.
- Na página **Minha Carteira**, os cartões de resumo passam a exibir duas linhas: `Saldo atual` (carteiras líquidas) e `Saldo em investimentos` (carteiras de investimento), além do total.
- O rendimento não vira receita no extrato — ele aparece como valorização do investimento; apenas o resgate movimenta o extrato.

## Detalhes técnicos

**Banco de dados (migração)**
- `investments`: `user_id`, `name`, `investment_type`, `wallet_id` (carteira de origem), `investment_wallet_id` (carteira que guarda o saldo investido), `principal`, `rate_kind` (`cdi_percent` | `prefixado` | `ipca_plus`), `rate_value`, `index_value` (CDI/IPCA anual informado), `start_date`, `maturity_date`, `status` (`active` | `redeemed`), `notes`, timestamps + trigger de `updated_at`.
- `investment_movements`: `investment_id`, `user_id`, `kind` (`deposit` | `withdrawal`), `amount`, `date`, `expense_id` (transferência gerada), `created_at`.
- Ambas: GRANT para `authenticated` e `service_role`, RLS habilitada, políticas por `auth.uid()`.
- Carteiras de investimento reutilizam `wallets` com `asset_type = 'investment'`, para que o motor de saldo existente continue válido.

**Frontend**
- `src/lib/investmentMath.ts`: taxa efetiva anual → diária (base 252 para CDI/prefixado, 365 opcional), juros compostos por dia, valor atual, projeção no vencimento, série mensal para o gráfico. Uso de `date-fns` em timezone local (`yyyy-MM-dd`).
- `src/pages/InvestmentsPage.tsx` + `src/components/investments/` (`InvestmentCard`, `AddInvestmentModal`, `DepositModal`, `RedeemModal` com valor editável, `InvestmentsSummaryCards`, `InvestmentGrowthChart`, `InvestmentAllocationPie`).
- `src/hooks/useInvestments.ts` com React Query (mesmo padrão de cache/realtime já usado).
- Aporte/resgate gravam a transação de transferência (`type: 'transfer'`, `final_category: 'investimentos'`, `wallet_id` / `destination_wallet_id`) e ajustam `wallets.current_balance`, invalidando as queries de carteira e dashboard.
- Rota `/investimentos` em `src/App.tsx` (lazy) e item "Investimentos" no `AppSidebar` com ícone `TrendingUp`.
- `WalletPage`: separar totais por `asset_type` para exibir saldo líquido vs. investido.
- Estilo: `rounded-2xl`, tokens semânticos, modais `max-h-[85dvh]` com footer fixo, textos em PT-BR.
