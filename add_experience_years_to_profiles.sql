-- Migration to add experience_years to the public.profiles table

-- 1. Add experience_years column (defaults to 0 years of experience)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;
