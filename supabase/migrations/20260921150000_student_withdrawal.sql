-- Student withdrawal: keep the file and the payments; fresh balance on return (additive)

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_status_check CHECK (status IN ('active','withdrawn'));

-- Balance with the same fee rules as the app: custom fee -> teacher price -> course price.
-- Payments count only from period_start (NULL = all payments).
CREATE OR REPLACE FUNCTION public.student_balance(p_student_id uuid)
RETURNS TABLE (due numeric, paid numeric, owed numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH d AS (
    SELECT COALESCE(sum(COALESCE(
             sc.custom_fee,
             (SELECT tc.price FROM public.teacher_courses tc
               WHERE tc.course_id = sc.course_id AND tc.teacher_id = sc.teacher_id),
             c.price,
             0)), 0) AS due_total
      FROM public.student_courses sc
      JOIN public.courses c ON c.id = sc.course_id
     WHERE sc.student_id = p_student_id
  ),
  p AS (
    SELECT COALESCE(sum(pay.amount), 0) AS paid_total
      FROM public.payments pay
      LEFT JOIN public.students st ON st.id = pay.student_id
     WHERE pay.student_id = p_student_id
       AND pay.status = 'active'
       AND (st.period_start IS NULL OR pay.date >= st.period_start)
  )
  SELECT d.due_total, p.paid_total, d.due_total - p.paid_total FROM d, p;
$$;

-- Guard: end users cannot change the withdrawal columns directly; only the two functions below can.
-- No end-user context (service role / SQL editor) => unrestricted.
CREATE OR REPLACE FUNCTION public.guard_student_withdrawal_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.student_withdrawal', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'active';
    NEW.withdrawn_at := NULL;
    NEW.period_start := NULL;
    NEW.history := '[]'::jsonb;
  ELSE
    NEW.status := OLD.status;
    NEW.withdrawn_at := OLD.withdrawn_at;
    NEW.period_start := OLD.period_start;
    NEW.history := OLD.history;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_student_withdrawal_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_student_withdrawal_columns ON public.students;
CREATE TRIGGER guard_student_withdrawal_columns
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.guard_student_withdrawal_columns();

-- A student with any payment cannot be deleted by an end user (cascade would erase income history).
CREATE OR REPLACE FUNCTION public.block_student_delete_with_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments p WHERE p.student_id = OLD.id) THEN
    RAISE EXCEPTION 'هالطالب عنده دفعات، استخدم "انسحاب الطالب" بدل الحذف / This student has payments and cannot be deleted. Use Withdraw student instead.'
      USING ERRCODE = 'SD001';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.block_student_delete_with_payments() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS block_student_delete_with_payments ON public.students;
CREATE TRIGGER block_student_delete_with_payments
BEFORE DELETE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.block_student_delete_with_payments();

-- Withdraw: only when owed = 0. Saves a period summary, clears enrollments, hides the student.
CREATE OR REPLACE FUNCTION public.withdraw_student(
  p_student_id uuid,
  p_reason text DEFAULT NULL,
  p_today date DEFAULT NULL
)
RETURNS public.students
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student public.students;
  v_today date := COALESCE(p_today, current_date);
  v_due numeric;
  v_paid numeric;
  v_owed numeric;
  v_courses jsonb;
  v_entry jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_today < current_date - 1 OR v_today > current_date + 1 THEN
    RAISE EXCEPTION 'Invalid date' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'SW003';
  END IF;
  IF v_student.status = 'withdrawn' THEN
    RAISE EXCEPTION 'Student is already withdrawn' USING ERRCODE = 'SW002';
  END IF;

  SELECT b.due, b.paid, b.owed INTO v_due, v_paid, v_owed
    FROM public.student_balance(p_student_id) AS b;
  IF v_owed <> 0 THEN
    RAISE EXCEPTION 'Account is not settled' USING ERRCODE = 'SW001', DETAIL = v_owed::text;
  END IF;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'course', c.name,
             'fee', COALESCE(
                      sc.custom_fee,
                      (SELECT tc.price FROM public.teacher_courses tc
                        WHERE tc.course_id = sc.course_id AND tc.teacher_id = sc.teacher_id),
                      c.price,
                      0)
           ) ORDER BY c.name), '[]'::jsonb)
    INTO v_courses
    FROM public.student_courses sc
    JOIN public.courses c ON c.id = sc.course_id
   WHERE sc.student_id = p_student_id;

  v_entry := jsonb_build_object(
    'started', COALESCE(v_student.period_start, v_student.enrollment_date),
    'withdrawn_on', v_today,
    'reason', NULLIF(left(btrim(COALESCE(p_reason, '')), 500), ''),
    'courses', v_courses,
    'due', v_due,
    'paid', v_paid
  );

  PERFORM set_config('app.student_withdrawal', 'on', true);
  DELETE FROM public.student_courses WHERE student_id = p_student_id;
  UPDATE public.students
     SET status = 'withdrawn',
         withdrawn_at = now(),
         period_start = v_today + 1,
         history = history || jsonb_build_array(v_entry)
   WHERE id = p_student_id
  RETURNING * INTO v_student;
  PERFORM set_config('app.student_withdrawal', 'off', true);

  RETURN v_student;
END;
$$;

-- Reactivate: the file returns, a new period starts (old payments stop counting toward the balance).
CREATE OR REPLACE FUNCTION public.reactivate_student(
  p_student_id uuid,
  p_start date DEFAULT NULL
)
RETURNS public.students
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student public.students;
  v_start date := COALESCE(p_start, current_date);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_start < current_date - 1 OR v_start > current_date + 1 THEN
    RAISE EXCEPTION 'Invalid date' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'SW003';
  END IF;
  IF v_student.status <> 'withdrawn' THEN
    RAISE EXCEPTION 'Student is not withdrawn' USING ERRCODE = 'SW004';
  END IF;

  PERFORM set_config('app.student_withdrawal', 'on', true);
  UPDATE public.students
     SET status = 'active',
         withdrawn_at = NULL,
         period_start = GREATEST(v_start, COALESCE(v_student.period_start, v_start))
   WHERE id = p_student_id
  RETURNING * INTO v_student;
  PERFORM set_config('app.student_withdrawal', 'off', true);

  RETURN v_student;
END;
$$;

REVOKE ALL ON FUNCTION public.student_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_balance(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.withdraw_student(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_student(uuid, text, date) TO authenticated;
REVOKE ALL ON FUNCTION public.reactivate_student(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_student(uuid, date) TO authenticated;
