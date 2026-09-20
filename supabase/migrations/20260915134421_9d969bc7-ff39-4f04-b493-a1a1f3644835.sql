CREATE TABLE public.teacher_courses (
  id uuid not null default gen_random_uuid() primary key,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (teacher_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_courses TO authenticated;
GRANT ALL ON public.teacher_courses TO service_role;
ALTER TABLE public.teacher_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own teacher_courses" ON public.teacher_courses FOR ALL TO authenticated
USING ((EXISTS (SELECT 1 FROM teachers t WHERE t.id = teacher_courses.teacher_id AND t.institute_id = (SELECT my_institute_id()))) AND (SELECT subscription_allowed()))
WITH CHECK ((EXISTS (SELECT 1 FROM teachers t WHERE t.id = teacher_courses.teacher_id AND t.institute_id = (SELECT my_institute_id()))) AND (SELECT subscription_allowed()));

INSERT INTO public.teacher_courses (teacher_id, course_id)
SELECT id, course_id FROM public.teachers WHERE course_id IS NOT NULL
ON CONFLICT DO NOTHING;