
CREATE OR REPLACE FUNCTION public.prevent_plan_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    -- Allow service_role to update plan (checked via current_setting)
    IF current_setting('role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    -- Block regular users from changing plan
    NEW.plan := OLD.plan;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lock_plan_update
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_plan_update();
