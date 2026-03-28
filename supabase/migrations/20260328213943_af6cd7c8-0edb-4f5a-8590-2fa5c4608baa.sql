
-- Create debts table
CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  person_name text NOT NULL,
  type text NOT NULL DEFAULT 'they_owe',
  total_amount numeric NOT NULL,
  remaining_amount numeric NOT NULL,
  due_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- Add debt_id to expenses
ALTER TABLE public.expenses ADD COLUMN debt_id uuid REFERENCES public.debts(id) ON DELETE SET NULL;
