
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.subscription_status AS ENUM ('trial','active','grace','expired','cancelled');
CREATE TYPE public.payment_method AS ENUM ('cash','shamcash','transfer');
CREATE TYPE public.receipt_status AS ENUM ('pending','confirmed','cancelled');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.institutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'معهدي',
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  trial_end timestamptz NOT NULL DEFAULT now() + interval '3 days',
  subscription_end timestamptz,
  onboarding_completed boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'ar',
  theme text NOT NULL DEFAULT 'light',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutes TO authenticated;
GRANT ALL ON public.institutes TO service_role;
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages institute" ON public.institutes FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "admins view institutes" ON public.institutes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update institutes" ON public.institutes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.my_institute_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.institutes WHERE owner_id = auth.uid() LIMIT 1
$$;

CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  course_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teachers ADD CONSTRAINT teachers_course_fk FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE TABLE public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  name text NOT NULL,
  father_name text,
  mother_name text,
  phone text,
  enrollment_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  custom_fee numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT current_date,
  method public.payment_method NOT NULL DEFAULT 'cash',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teacher_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers, public.courses, public.sections, public.students, public.student_courses, public.payments, public.teacher_payments TO authenticated;
GRANT ALL ON public.teachers, public.courses, public.sections, public.students, public.student_courses, public.payments, public.teacher_payments TO service_role;

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own teachers" ON public.teachers FOR ALL TO authenticated
  USING (institute_id = public.my_institute_id()) WITH CHECK (institute_id = public.my_institute_id());
CREATE POLICY "own courses" ON public.courses FOR ALL TO authenticated
  USING (institute_id = public.my_institute_id()) WITH CHECK (institute_id = public.my_institute_id());
CREATE POLICY "own students" ON public.students FOR ALL TO authenticated
  USING (institute_id = public.my_institute_id()) WITH CHECK (institute_id = public.my_institute_id());
CREATE POLICY "own sections" ON public.sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.institute_id = public.my_institute_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.institute_id = public.my_institute_id()));
CREATE POLICY "own student_courses" ON public.student_courses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.institute_id = public.my_institute_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.institute_id = public.my_institute_id()));
CREATE POLICY "own payments" ON public.payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.institute_id = public.my_institute_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.institute_id = public.my_institute_id()));
CREATE POLICY "own teacher_payments" ON public.teacher_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.institute_id = public.my_institute_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.institute_id = public.my_institute_id()));

CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  user_email text,
  plan text NOT NULL,
  amount numeric NOT NULL,
  image_url text NOT NULL,
  status public.receipt_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own receipts" ON public.receipts FOR SELECT TO authenticated USING (institute_id = public.my_institute_id());
CREATE POLICY "insert own receipts" ON public.receipts FOR INSERT TO authenticated WITH CHECK (institute_id = public.my_institute_id());
CREATE POLICY "admin read receipts" ON public.receipts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update receipts" ON public.receipts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.admin_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  shamcash_qr_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone signed in reads settings" ON public.admin_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin writes settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin updates settings" ON public.admin_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.admin_settings (id) VALUES (1);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.institutes (owner_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'institute_name', 'معهدي'))
  ON CONFLICT (owner_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
