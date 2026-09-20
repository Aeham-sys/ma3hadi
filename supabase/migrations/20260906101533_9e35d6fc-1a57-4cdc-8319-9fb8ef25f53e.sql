DROP VIEW IF EXISTS public.payment_settings;

CREATE OR REPLACE FUNCTION public.get_payment_settings()
RETURNS TABLE(shamcash_qr_url text, price_monthly numeric, price_yearly numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.shamcash_qr_url, s.price_monthly, s.price_yearly
  FROM public.admin_settings s
  ORDER BY s.id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_payment_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_settings() TO authenticated;