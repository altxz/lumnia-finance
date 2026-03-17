
-- Categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#6366f1',
  keywords TEXT[] DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- AI corrections table
CREATE TABLE public.ai_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  original_category TEXT NOT NULL,
  corrected_category TEXT NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own corrections" ON public.ai_corrections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own corrections" ON public.ai_corrections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own corrections" ON public.ai_corrections FOR DELETE USING (auth.uid() = user_id);
