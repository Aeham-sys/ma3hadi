-- 1) user_roles: explicit, policy-independent protection against privilege escalation
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.guard_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
     OR auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Not allowed: user roles can only be managed by the system'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_user_roles() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_user_roles_ins ON public.user_roles;
CREATE TRIGGER guard_user_roles_ins BEFORE INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles();

DROP TRIGGER IF EXISTS guard_user_roles_upd ON public.user_roles;
CREATE TRIGGER guard_user_roles_upd BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles();

DROP TRIGGER IF EXISTS guard_user_roles_del ON public.user_roles;
CREATE TRIGGER guard_user_roles_del BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles();

-- 2) trigger-only SECURITY DEFINER functions must not be callable through the API
REVOKE ALL ON FUNCTION public.guard_institute_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_institute_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_institute_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_receipt_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_receipt_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_receipt_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- keep RLS/business helpers callable exactly as before (no anon)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_institute_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.subscription_allowed() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.plan_price(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.plan_months(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_receipt(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_receipt(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_subscription(uuid, integer, integer, boolean) FROM PUBLIC, anon;

-- 3) admin_settings: least privilege via a narrow payment view
CREATE OR REPLACE VIEW public.payment_settings
WITH (security_invoker = off) AS
  SELECT s.shamcash_qr_url, s.price_monthly, s.price_yearly
  FROM public.admin_settings s
  ORDER BY s.id
  LIMIT 1;

GRANT SELECT ON public.payment_settings TO authenticated;

DROP POLICY IF EXISTS "anyone signed in reads settings" ON public.admin_settings;
CREATE POLICY "admins read settings" ON public.admin_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));