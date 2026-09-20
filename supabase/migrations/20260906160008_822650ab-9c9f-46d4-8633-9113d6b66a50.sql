ALTER TABLE public.students ADD COLUMN IF NOT EXISTS grade text, ADD COLUMN IF NOT EXISTS branch text;
UPDATE public.students SET stage = NULL WHERE stage IS NOT NULL;