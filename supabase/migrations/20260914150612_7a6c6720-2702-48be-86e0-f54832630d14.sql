ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS surname text,
  ADD COLUMN IF NOT EXISTS guardian_phone text;