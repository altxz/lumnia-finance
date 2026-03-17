
-- Create wallets table
CREATE TABLE public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'checking_account',
  current_balance numeric NOT NULL DEFAULT 0,
  -- crypto-specific fields
  crypto_symbol text DEFAULT NULL,
  crypto_amount numeric DEFAULT NULL,
  crypto_price numeric DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Constraint for asset_type values
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_asset_type_check CHECK (asset_type IN ('checking_account', 'savings', 'stocks', 'crypto'));

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own wallets" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallets" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallets" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own wallets" ON public.wallets FOR DELETE USING (auth.uid() = user_id);
