-- =======================================================
-- ÖZEL MEVZUAT ONAY AKIŞI
-- Supabase SQL Editor'de çalıştırın
-- Personel (corporate_staff) tarafından eklenen özel mevzuatlar artık doğrudan
-- firma havuzuna girmez; yönetici (premium_corporate) veya şef (corporate_chief)
-- onaylayana kadar 'pending_approval' durumunda bekler.
-- =======================================================

ALTER TABLE public.company_pdf_regulations
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS company_pdf_regulations_id_key
  ON public.company_pdf_regulations(id);

ALTER TABLE public.company_pdf_regulations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_company_pdf_regulations_status
  ON public.company_pdf_regulations(status);
