CREATE OR REPLACE FUNCTION public.guard_institute_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- trusted server-side roles (service_role / superuser maintenance) and admins may pass
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_end IS DISTINCT FROM OLD.subscription_end
     OR NEW.trial_end IS DISTINCT FROM OLD.trial_end
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed: subscription fields can only be changed by an administrator'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_institute_subscription() FROM PUBLIC, anon, authenticated;
