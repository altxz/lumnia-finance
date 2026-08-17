ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS default_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL;