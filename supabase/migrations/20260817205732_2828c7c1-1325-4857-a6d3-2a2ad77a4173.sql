ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_asset_type_check;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_asset_type_check CHECK (asset_type = ANY (ARRAY['checking_account'::text, 'savings'::text, 'stocks'::text, 'crypto'::text, 'investment'::text]));

CREATE TABLE public.investments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  investment_type text NOT NULL DEFAULT 'caixinha',
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  investment_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  principal numeric NOT NULL DEFAULT 0,
  rate_kind text NOT NULL DEFAULT 'cdi_percent',
  rate_value numeric NOT NULL DEFAULT 100,
  index_value numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  maturity_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investments_rate_kind_check CHECK (rate_kind = ANY (ARRAY['cdi_percent','prefixado','ipca_plus'])),
  CONSTRAINT investments_status_check CHECK (status = ANY (ARRAY['active','redeemed']))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own investments" ON public.investments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON public.investments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON public.investments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON public.investments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.investment_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investment_movements_kind_check CHECK (kind = ANY (ARRAY['deposit','withdrawal']))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_movements TO authenticated;
GRANT ALL ON public.investment_movements TO service_role;
ALTER TABLE public.investment_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own investment movements" ON public.investment_movements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investment movements" ON public.investment_movements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investment movements" ON public.investment_movements FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own investment movements" ON public.investment_movements FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_investments_user ON public.investments(user_id);
CREATE INDEX idx_investment_movements_investment ON public.investment_movements(investment_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();