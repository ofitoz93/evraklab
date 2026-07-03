-- =======================================================
-- GÖRÜŞ (RESMİ YAZI) TASLAK SİSTEMİ
-- Supabase SQL Editor'de çalıştırın
--
-- Personelin bir işletme için hazırladığı, bir kuruma yazılacak resmi
-- "görüş" yazılarını tutar. Personel oluşturur (durum: pending), yönetici
-- veya şef onaylar/reddeder. Onaylanan görüş personelin kendi panelinde
-- "Dökümantasyon > Görüşler" altında onaylı olarak görünür. Bu belgeler
-- genel "Evraklar" (documents) listesine YAZILMAZ.
-- =======================================================

CREATE TABLE IF NOT EXISTS public.opinion_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.consultant_clients(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    subject TEXT NOT NULL,
    letter_date DATE NOT NULL,
    sequence_no INTEGER, -- işletme + yıl bazlı "Sayı" sırası (ör. 2026-01 için 1)
    institution_name TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.opinion_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select opinion_letters" ON public.opinion_letters;
CREATE POLICY "Select opinion_letters" ON public.opinion_letters
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Manage opinion_letters" ON public.opinion_letters;
CREATE POLICY "Manage opinion_letters" ON public.opinion_letters
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_opinion_letters_org ON public.opinion_letters(organization_id);
CREATE INDEX IF NOT EXISTS idx_opinion_letters_client ON public.opinion_letters(client_id);
CREATE INDEX IF NOT EXISTS idx_opinion_letters_status ON public.opinion_letters(status);
