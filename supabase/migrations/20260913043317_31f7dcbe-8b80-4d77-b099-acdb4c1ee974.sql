ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS branch text;