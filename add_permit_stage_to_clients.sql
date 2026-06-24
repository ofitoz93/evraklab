-- Migration to add permit stage and permit articles to consultant_clients table

-- 1. Add permit_stage column (options: 'ek1', 'ek2', 'out_of_scope')
ALTER TABLE public.consultant_clients ADD COLUMN IF NOT EXISTS permit_stage TEXT DEFAULT 'out_of_scope';

-- 2. Add permit_articles column (JSONB array to store selected articles from EK-1 or EK-2)
ALTER TABLE public.consultant_clients ADD COLUMN IF NOT EXISTS permit_articles JSONB DEFAULT '[]'::jsonb;
