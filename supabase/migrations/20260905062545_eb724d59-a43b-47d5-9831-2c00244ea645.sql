-- Server-side truth for "is this owner currently allowed to use the app?"
-- Mirrors src/lib/subscription.ts: trial valid until trial_end; active valid until
-- subscription_end + 7 days grace; cancelled/expired are immediately locked.
CREATE OR REPLACE FUNCTION public.subscription_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
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
$$;

REVOKE ALL ON FUNCTION public.subscription_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscription_allowed() TO authenticated, service_role;

-- Operational tenant data: same isolation as before + subscription gate
DROP POLICY IF EXISTS "own students" ON public.students;
CREATE POLICY "own students" ON public.students FOR ALL TO authenticated
  USING (institute_id = (SELECT public.my_institute_id()) AND (SELECT public.subscription_allowed()))
  WITH CHECK (institute_id = (SELECT public.my_institute_id()) AND (SELECT public.subscription_allowed()));

DROP POLICY IF EXISTS "own courses" ON public.courses;
CREATE POLICY "own courses" ON public.courses FOR ALL TO authenticated
  USING (institute_id = (SELECT public.my_institute_id()) AND (SELECT public.subscription_allowed()))
  WITH CHECK (institute_id = (SELECT public.my_institute_id()) AND (SELECT public.subscription_allowed()));

DROP POLICY IF EXISTS "own teachers" ON public.teachers;
CREATE POLICY "own teachers" ON public.teachers FOR ALL TO authenticated
  USING (institute_id = (SELECT public.my_institute_id()) AND (SELECT public.subscription_allowed()))
  WITH CHECK (institute_id = (SELECT public.my_institute_id()) AND (SELECT public.subscription_allowed()));

DROP POLICY IF EXISTS "own sections" ON public.sections;
CREATE POLICY "own sections" ON public.sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c
                  WHERE c.id = sections.course_id
                    AND c.institute_id = (SELECT public.my_institute_id()))
         AND (SELECT public.subscription_allowed()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c
                  WHERE c.id = sections.course_id
                    AND c.institute_id = (SELECT public.my_institute_id()))
         AND (SELECT public.subscription_allowed()));

DROP POLICY IF EXISTS "own payments" ON public.payments;
CREATE POLICY "own payments" ON public.payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s
                  WHERE s.id = payments.student_id
                    AND s.institute_id = (SELECT public.my_institute_id()))
         AND (SELECT public.subscription_allowed()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s
                  WHERE s.id = payments.student_id
                    AND s.institute_id = (SELECT public.my_institute_id()))
         AND (SELECT public.subscription_allowed()));

DROP POLICY IF EXISTS "own student_courses" ON public.student_courses;
CREATE POLICY "own student_courses" ON public.student_courses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s
                  WHERE s.id = student_courses.student_id
                    AND s.institute_id = (SELECT public.my_institute_id()))
         AND (SELECT public.subscription_allowed()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s
                  WHERE s.id = student_courses.student_id
                    AND s.institute_id = (SELECT public.my_institute_id()))
         AND (SELECT public.subscription_allowed()));

DROP POLICY IF EXISTS "own teacher_payments" ON public.teacher_payments;
CREATE POLICY "own teacher_payments" ON public.teacher_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teachers t
                  WHERE t.id = teacher_payments.teacher_id
                    AND t.institute_id = (SELECT public.my_institute_id()))
         AND (SELECT public.subscription_allowed()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teachers t
                  WHERE t.id = teacher_payments.teacher_id
                    AND t.institute_id = (SELECT public.my_institute_id()))
         AND (SELECT public.subscription_allowed()));