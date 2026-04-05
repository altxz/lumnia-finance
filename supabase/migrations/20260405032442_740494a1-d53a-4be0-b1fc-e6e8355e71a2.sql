
CREATE TABLE public.financial_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month_year DATE NOT NULL,
  overall_score INTEGER NOT NULL DEFAULT 0,
  savings_score INTEGER NOT NULL DEFAULT 0,
  budget_score INTEGER NOT NULL DEFAULT 0,
  debt_score INTEGER NOT NULL DEFAULT 0,
  consistency_score INTEGER NOT NULL DEFAULT 0,
  credit_score INTEGER NOT NULL DEFAULT 0,
  total_income NUMERIC NOT NULL DEFAULT 0,
  total_expense NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_year)
);

ALTER TABLE public.financial_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scores" ON public.financial_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scores" ON public.financial_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scores" ON public.financial_scores FOR UPDATE USING (auth.uid() = user_id);
