-- Migration: add mandatory name/surname and QR password fields

-- 1. Add columns to inspection_submissions
ALTER TABLE public.inspection_submissions
  ADD COLUMN IF NOT EXISTS submitted_by_surname TEXT;

-- Update any existing rows to have non-null values
UPDATE public.inspection_submissions 
SET submitted_by_surname = '' 
WHERE submitted_by_surname IS NULL;

UPDATE public.inspection_submissions 
SET submitted_by_name = '' 
WHERE submitted_by_name IS NULL;

-- Make them NOT NULL with default ''
ALTER TABLE public.inspection_submissions
  ALTER COLUMN submitted_by_surname SET DEFAULT '',
  ALTER COLUMN submitted_by_surname SET NOT NULL,
  ALTER COLUMN submitted_by_name SET DEFAULT '',
  ALTER COLUMN submitted_by_name SET NOT NULL;

-- 2. Add columns to inspection_forms
ALTER TABLE public.inspection_forms
  ADD COLUMN IF NOT EXISTS access_password TEXT;
