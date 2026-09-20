REVOKE ALL ON FUNCTION public.guard_institute_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_receipt_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_receipt_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_institute_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_institute_id() TO authenticated;
