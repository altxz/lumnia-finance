ALTER TABLE public.expenses
  ADD COLUMN is_paid boolean NOT NULL DEFAULT true,
  ADD COLUMN notes text,
  ADD COLUMN tags text[] DEFAULT '{}'::text[];