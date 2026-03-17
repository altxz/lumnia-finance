
-- User settings table
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  currency TEXT NOT NULL DEFAULT 'BRL',
  ai_auto_categorize BOOLEAN NOT NULL DEFAULT true,
  ai_min_confidence INT NOT NULL DEFAULT 70,
  ai_learn_corrections BOOLEAN NOT NULL DEFAULT true,
  ai_model TEXT NOT NULL DEFAULT 'gemini-flash',
  ai_personal_context TEXT,
  notify_email_weekly BOOLEAN NOT NULL DEFAULT true,
  notify_email_alerts BOOLEAN NOT NULL DEFAULT true,
  notify_email_news BOOLEAN NOT NULL DEFAULT false,
  notify_app_suggestions BOOLEAN NOT NULL DEFAULT true,
  notify_app_reminders BOOLEAN NOT NULL DEFAULT true,
  notify_app_achievements BOOLEAN NOT NULL DEFAULT true,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Automation rules table
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  condition_field TEXT NOT NULL DEFAULT 'description',
  condition_operator TEXT NOT NULL DEFAULT 'contains',
  condition_value TEXT NOT NULL,
  target_category TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  applied_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rules" ON public.automation_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rules" ON public.automation_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rules" ON public.automation_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rules" ON public.automation_rules FOR DELETE USING (auth.uid() = user_id);

-- Avatar storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
