-- Müşteri portalı (role='client') kullanıcılarının kendi danışmanlık firmasına
-- ait taşıyıcı/gönderilen firma listesini görebilmesi ve yeni firma ekleyebilmesi
-- için waste_companies tablosuna ek RLS izinleri.
--
-- Not: waste_records tablosuna kayıt ekleme zaten mevcut "Manage waste_records"
-- politikasındaki "created_by = auth.uid()" koşulu sayesinde çalışıyor, bu yüzden
-- o tabloda değişikliğe gerek yok.

-- 1. Müşteri kendi danışmanının tanımladığı taşıyıcı/gönderilen firmaları görebilsin
DROP POLICY IF EXISTS "Select waste_companies" ON public.waste_companies;
CREATE POLICY "Select waste_companies" ON public.waste_companies
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.organization_id = waste_companies.organization_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.id = p.client_id
            WHERE p.id = auth.uid() AND p.role = 'client' AND cc.consultant_company_id = waste_companies.organization_id
        )
    );

-- 2. Müşteri kendi danışmanının organizasyonuna yeni taşıyıcı/gönderilen firma ekleyebilsin
--    (sadece ekleme; mevcut/paylaşılan firmaları düzenleme-silme yetkisi danışman personelinde kalır)
DROP POLICY IF EXISTS "Client insert waste_companies" ON public.waste_companies;
CREATE POLICY "Client insert waste_companies" ON public.waste_companies
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.id = p.client_id
            WHERE p.id = auth.uid() AND p.role = 'client' AND cc.consultant_company_id = waste_companies.organization_id
        )
    );
