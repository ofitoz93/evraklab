-- =======================================================
-- AKSİYONLARIN BİRDEN FAZLA MADDEYE BAĞLANABİLMESİ
-- Supabase SQL Editor'de çalıştırın
-- Tek bir aksiyonun, seçilen birden fazla mevzuat maddesiyle
-- ilişkilendirilebilmesi için compliance_actions tablosuna
-- article_ids (UUID[]) kolonu ekler. Mevcut article_id kolonu
-- geriye dönük uyumluluk için (ilk seçilen madde) korunur.
-- =======================================================

ALTER TABLE public.compliance_actions
  ADD COLUMN IF NOT EXISTS article_ids UUID[];

CREATE INDEX IF NOT EXISTS idx_compliance_actions_article_ids
  ON public.compliance_actions USING GIN (article_ids);
