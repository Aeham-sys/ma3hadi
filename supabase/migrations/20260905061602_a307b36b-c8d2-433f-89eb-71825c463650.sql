-- 1) Replace the over-broad FOR ALL owner policy with least-privilege policies
DROP POLICY IF EXISTS "owner manages institute" ON public.institutes;

CREATE POLICY "owner reads institute"
  ON public.institutes FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "owner updates institute"
  ON public.institutes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- no INSERT policy for authenticated: institutes are created only by the
-- SECURITY DEFINER signup trigger (handle_new_user), which bypasses RLS.

-- admins may delete (support/cleanup); regular users may not
CREATE POLICY "admins delete institutes"
  ON public.institutes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Defense in depth: force safe values on INSERT regardless of caller input
CREATE OR REPLACE FUNCTION public.guard_institute_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- trusted server-side roles and admins may set fields explicitly
  IF current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed: institutes are created by the system at signup'
      USING ERRCODE = '42501';
  END IF;

  -- client-supplied ownership and subscription state are never trusted
  NEW.owner_id            := auth.uid();
  NEW.subscription_status := 'trial'::subscription_status;
  NEW.subscription_end    := NULL;
  NEW.trial_end           := now() + interval '3 days';
  NEW.created_at          := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_institute_insert ON public.institutes;
CREATE TRIGGER guard_institute_insert
  BEFORE INSERT ON public.institutes
  FOR EACH ROW EXECUTE FUNCTION public.guard_institute_insert();

-- 3) Defense in depth: block deletes from anyone but trusted roles / admins
CREATE OR REPLACE FUNCTION public.guard_institute_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR public.is_admin() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Not allowed: institutes cannot be deleted'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS guard_institute_delete ON public.institutes;
CREATE TRIGGER guard_institute_delete
  BEFORE DELETE ON public.institutes
  FOR EACH ROW EXECUTE FUNCTION public.guard_institute_delete();

-- 4) Least-privilege grants: users never need INSERT/DELETE on institutes
REVOKE INSERT, DELETE ON public.institutes FROM authenticated;
REVOKE ALL ON public.institutes FROM anon;
GRANT SELECT, UPDATE ON public.institutes TO authenticated;
GRANT DELETE ON public.institutes TO authenticated; -- gated by admin-only RLS policy + trigger
GRANT ALL ON public.institutes TO service_role;