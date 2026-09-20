CREATE OR REPLACE FUNCTION public.subscription_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
        FROM public.institutes i
       WHERE i.owner_id = auth.uid()
         AND CASE
               WHEN i.subscription_status IN ('cancelled'::subscription_status,
                                              'expired'::subscription_status) THEN false
               WHEN i.subscription_status = 'trial'::subscription_status THEN i.trial_end > now()
               ELSE (i.subscription_end IS NULL
                     OR i.subscription_end + interval '7 days' > now())
             END
    )
$function$;