-- evaluation_periods tablosuna şef değerlendirmesi talep etme bayrağı ekleme
ALTER TABLE public.evaluation_periods 
ADD COLUMN IF NOT EXISTS allow_chief_evaluations BOOLEAN NOT NULL DEFAULT false;
