CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT current_date,
  note text,
  status text NOT NULL DEFAULT 'active',
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_category_check
    CHECK (category IN ('rent','utilities','supplies','marketing','maintenance','staff','other')),
  CONSTRAINT expenses_amount_check CHECK (amount > 0),
  CONSTRAINT expenses_status_check CHECK (status IN ('active','cancelled')),
  CONSTRAINT expenses_note_check CHECK (note IS NULL OR char_length(note) <= 500)
);

CREATE INDEX IF NOT EXISTS expenses_institute_date_idx
  ON public.expenses (institute_id, date);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.expenses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

DROP POLICY IF EXISTS "own expenses" ON public.expenses;
CREATE POLICY "own expenses" ON public.expenses FOR ALL TO authenticated
  USING (institute_id = (SELECT public.my_institute_id()) AND (SELECT public.subscription_allowed()))
  WITH CHECK (institute_id = (SELECT public.my_institute_id()) AND (SELECT public.subscription_allowed()));

CREATE OR REPLACE FUNCTION public.touch_expense()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.institute_id := OLD.institute_id;
  NEW.updated_at := now();
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    NEW.cancelled_at := now();
  ELSIF NEW.status = 'active' THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_expense() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS touch_expense ON public.expenses;
CREATE TRIGGER touch_expense
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.touch_expense();
