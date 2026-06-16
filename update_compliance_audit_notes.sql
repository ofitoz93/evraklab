-- =======================================================
-- MEVZUAT UYUM VE GÜNCELLEME SİSTEMİ KOLON VE POLİTİKA GÜNCELLEMELERİ
-- Supabase SQL Editor'de çalıştırın
-- =======================================================

-- 1. client_regulation_articles tablosuna loglama ve mevcut durum bilgileri için kolonlar ekleme
ALTER TABLE public.client_regulation_articles 
ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS current_status_notes TEXT,
ADD COLUMN IF NOT EXISTS current_status_requested BOOLEAN DEFAULT false;

-- 2. pdf_regulations tablosundaki RLS Politikalarını Danışman firmaya özel yapacak şekilde güncelleme
DROP POLICY IF EXISTS "Allow public select on pdf_regulations" ON public.pdf_regulations;
CREATE POLICY "Allow public select on pdf_regulations" ON public.pdf_regulations
    FOR SELECT TO authenticated USING (
        company_id IS NULL OR company_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow company manage on pdf_regulations" ON public.pdf_regulations;
CREATE POLICY "Allow company manage on pdf_regulations" ON public.pdf_regulations
    FOR ALL TO authenticated USING (
        company_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('premium_corporate', 'corporate_chief'))
    );

-- 3. pdf_articles tablosundaki RLS Politikalarını güncelleme
DROP POLICY IF EXISTS "Allow public select on pdf_articles" ON public.pdf_articles;
CREATE POLICY "Allow public select on pdf_articles" ON public.pdf_articles
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.pdf_regulations r
            WHERE r.id = pdf_articles.regulation_id
              AND (r.company_id IS NULL OR r.company_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Allow company manage on pdf_articles" ON public.pdf_articles;
CREATE POLICY "Allow company manage on pdf_articles" ON public.pdf_articles
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.pdf_regulations r
            WHERE r.id = pdf_articles.regulation_id
              AND r.company_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('premium_corporate', 'corporate_chief'))
    );
