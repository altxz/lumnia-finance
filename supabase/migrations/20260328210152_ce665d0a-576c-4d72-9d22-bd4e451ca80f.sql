ALTER TABLE public.user_settings
ADD COLUMN enable_crypto_module boolean NOT NULL DEFAULT true,
ADD COLUMN enable_projects_module boolean NOT NULL DEFAULT true,
ADD COLUMN enable_budget_module boolean NOT NULL DEFAULT true;