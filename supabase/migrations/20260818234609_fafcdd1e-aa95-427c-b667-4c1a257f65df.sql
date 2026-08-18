CREATE INDEX IF NOT EXISTS idx_expenses_user_card ON public.expenses (user_id, credit_card_id) WHERE credit_card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_user_recurring ON public.expenses (user_id) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories (user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON public.credit_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.budgets (user_id, month_year);