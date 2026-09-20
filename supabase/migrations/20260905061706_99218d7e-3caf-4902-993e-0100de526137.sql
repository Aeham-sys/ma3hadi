CREATE OR REPLACE FUNCTION public.guard_institute_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
     OR auth.uid() IS NULL
     OR public.is_admin() THEN
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

CREATE OR REPLACE FUNCTION public.guard_institute_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
     OR auth.uid() IS NULL
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.owner_id            := auth.uid();
  NEW.subscription_status := 'trial'::subscription_status;
  NEW.subscription_end    := NULL;
  NEW.trial_end           := now() + interval '3 days';
  NEW.created_at          := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_institute_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF session_user IN ('postgres', 'supabase_admin', 'service_role')
     OR auth.uid() IS NULL
     OR public.is_admin() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Not allowed: institutes cannot be deleted' USING ERRCODE = '42501';
END;
$$;