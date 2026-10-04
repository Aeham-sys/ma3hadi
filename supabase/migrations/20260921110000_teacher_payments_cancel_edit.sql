ALTER TABLE public.teacher_payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.teacher_payments
  DROP CONSTRAINT IF EXISTS teacher_payments_status_check;
ALTER TABLE public.teacher_payments
  ADD CONSTRAINT teacher_payments_status_check CHECK (status IN ('active','cancelled'));

CREATE OR REPLACE FUNCTION public.touch_teacher_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    NEW.cancelled_at := now();
  ELSIF NEW.status = 'active' THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_teacher_payment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS touch_teacher_payment ON public.teacher_payments;
CREATE TRIGGER touch_teacher_payment
BEFORE UPDATE ON public.teacher_payments
FOR EACH ROW EXECUTE FUNCTION public.touch_teacher_payment();
