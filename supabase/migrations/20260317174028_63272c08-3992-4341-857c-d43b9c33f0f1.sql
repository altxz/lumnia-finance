
-- Add transaction type, recurring, and frequency columns to expenses
ALTER TABLE public.expenses 
  ADD COLUMN type text NOT NULL DEFAULT 'expense',
  ADD COLUMN is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN frequency text DEFAULT NULL;

-- Add check constraint for type values
ALTER TABLE public.expenses 
  ADD CONSTRAINT expenses_type_check CHECK (type IN ('income', 'expense'));

-- Add check constraint for frequency values  
ALTER TABLE public.expenses 
  ADD CONSTRAINT expenses_frequency_check CHECK (frequency IS NULL OR frequency IN ('monthly', 'annual'));
