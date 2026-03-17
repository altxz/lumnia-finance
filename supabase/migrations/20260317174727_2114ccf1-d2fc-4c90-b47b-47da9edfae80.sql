
-- Create credit_cards table
CREATE TABLE public.credit_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  limit_amount numeric NOT NULL DEFAULT 0,
  closing_day integer NOT NULL DEFAULT 1,
  due_day integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own cards" ON public.credit_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cards" ON public.credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cards" ON public.credit_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cards" ON public.credit_cards FOR DELETE USING (auth.uid() = user_id);

-- Add columns to expenses
ALTER TABLE public.expenses
  ADD COLUMN credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN installments integer NOT NULL DEFAULT 1;
