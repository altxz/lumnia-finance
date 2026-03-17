
-- Add initial_balance to wallets
ALTER TABLE public.wallets ADD COLUMN initial_balance numeric NOT NULL DEFAULT 0;

-- Add wallet_id to expenses (nullable for credit card transactions)
ALTER TABLE public.expenses ADD COLUMN wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL DEFAULT NULL;
