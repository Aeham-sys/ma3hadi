-- per-teacher price inside a course (NULL = use the course base price)
ALTER TABLE public.teacher_courses
  ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE public.teacher_courses
  DROP CONSTRAINT IF EXISTS teacher_courses_price_check;
ALTER TABLE public.teacher_courses
  ADD CONSTRAINT teacher_courses_price_check CHECK (price IS NULL OR price >= 0);

-- which teacher the student enrolled with
ALTER TABLE public.student_courses
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS student_courses_teacher_id_idx ON public.student_courses(teacher_id);

-- payments: cancel instead of delete, and track edits
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check CHECK (status IN ('active','cancelled'));
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);

CREATE OR REPLACE FUNCTION public.touch_payment()
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

DROP TRIGGER IF EXISTS touch_payment ON public.payments;
CREATE TRIGGER touch_payment
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.touch_payment();