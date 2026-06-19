-- =======================================================
-- YÖNETMELİK MADDELERİ GEÇERLİLİK TARİHİ VE VARSAYILAN DURUM GÜNCELLEMELERİ
-- Supabase SQL Editor'de çalıştırın
-- =======================================================

-- 1. client_regulation_articles tablosuna geçerlilik tarihi kolonu (expiry_date) ekleme
ALTER TABLE public.client_regulation_articles 
ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL;

-- 2. compliance_status varsayılan 'compliant' (uygun) değerini kaldırma ve NULL yapma
ALTER TABLE public.client_regulation_articles 
ALTER COLUMN compliance_status DROP DEFAULT;

ALTER TABLE public.client_regulation_articles 
ALTER COLUMN compliance_status SET DEFAULT NULL;

-- 3. Mevcut kayıtlardan henüz kullanıcı tarafından güncellenmemiş olanların uyum durumunu NULL (seçilmemiş) yapma
-- (Bu sayede eski atanan maddeler de boş/seçilmemiş olarak gelecektir)
UPDATE public.client_regulation_articles 
SET compliance_status = NULL 
WHERE current_status_notes IS NULL;
