ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS price_monthly numeric NOT NULL DEFAULT 29,
  ADD COLUMN IF NOT EXISTS price_yearly numeric NOT NULL DEFAULT 232;

ALTER TABLE public.institutes
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS owner_email text;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

INSERT INTO public.admin_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

UPDATE public.institutes i
SET owner_email = u.email
FROM auth.users u
WHERE u.id = i.owner_id AND i.owner_email IS DISTINCT FROM u.email;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.institutes (owner_id, name, owner_email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'institute_name', 'معهدي'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (owner_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;