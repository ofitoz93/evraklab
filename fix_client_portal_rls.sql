-- Müşteri portalı (profiles.role = 'client') kullanıcılarının artık erişebildiği
-- Mevzuat Takip, Saha QR Denetimleri, Aylık & Yıllık Raporlar ve Zorunlu Belge
-- Matrisi sekmelerinin verilerini görebilmesi için eksik RLS izinleri.
--
-- Bu tablolarda daha önce hiçbir politika role='client' + client_id eşleşmesi
-- kontrol etmiyordu (profiles.client_id kolonu diğer tüm politikalardan sonra,
-- create_client_panel.sql ile eklendi). Var olan politikalar dokunulmadan,
-- her tabloya EK bir SELECT politikası tanımlanıyor (Postgres'te aynı komut
-- için birden fazla PERMISSIVE politika birbirine OR ile eklenir).

-- 1. client_regulations — Mevzuat Takip sekmesi
DROP POLICY IF EXISTS "Client select client_regulations" ON public.client_regulations;
CREATE POLICY "Client select client_regulations" ON public.client_regulations
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'client' AND p.client_id = client_regulations.client_id
        )
    );

-- 2. client_regulation_articles — mevzuat madde detayları
DROP POLICY IF EXISTS "Client select client_regulation_articles" ON public.client_regulation_articles;
CREATE POLICY "Client select client_regulation_articles" ON public.client_regulation_articles
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.client_regulations cr
            JOIN public.profiles p ON p.client_id = cr.client_id AND p.role = 'client'
            WHERE cr.id = client_regulation_articles.client_regulation_id AND p.id = auth.uid()
        )
    );

-- 3. inspection_submissions — Saha QR Denetimleri geçmişi
DROP POLICY IF EXISTS "Client select inspection_submissions" ON public.inspection_submissions;
CREATE POLICY "Client select inspection_submissions" ON public.inspection_submissions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.inspection_points ip
            JOIN public.inspection_forms f ON f.id = ip.form_id
            JOIN public.profiles p ON p.client_id = f.client_id AND p.role = 'client'
            WHERE ip.id = inspection_submissions.point_id AND p.id = auth.uid()
        )
    );

-- 4. inspection_answers — denetim cevap detayları
DROP POLICY IF EXISTS "Client select inspection_answers" ON public.inspection_answers;
CREATE POLICY "Client select inspection_answers" ON public.inspection_answers
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.inspection_submissions s
            JOIN public.inspection_points ip ON ip.id = s.point_id
            JOIN public.inspection_forms f ON f.id = ip.form_id
            JOIN public.profiles p ON p.client_id = f.client_id AND p.role = 'client'
            WHERE s.id = inspection_answers.submission_id AND p.id = auth.uid()
        )
    );

-- 5. env_reports — Aylık & Yıllık Raporlar
DROP POLICY IF EXISTS "Client select env_reports" ON public.env_reports;
CREATE POLICY "Client select env_reports" ON public.env_reports
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'client' AND p.client_id = env_reports.client_id
        )
    );

-- 6. visit_schedules — Danışman ziyaret planları (Raporlar sekmesi)
DROP POLICY IF EXISTS "Client select visit_schedules" ON public.visit_schedules;
CREATE POLICY "Client select visit_schedules" ON public.visit_schedules
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'client' AND p.client_id = visit_schedules.client_id
        )
    );

-- 7. user_definitions — Zorunlu Belge Matrisi (belge tanım/lokasyon şablonları)
--    Not: Bu tabloda client_id kolonu yok, sadece organization_id var; bu yüzden
--    danışmanın tüm organizasyon tanımları görülebilir hale geliyor (uygulama
--    tarafında zaten firma adına göre filtreleniyor). Bu, mevcut waste_companies
--    ve documents gibi tablolarla aynı organizasyon bazlı erişim modelidir.
DROP POLICY IF EXISTS "Client select user_definitions" ON public.user_definitions;
CREATE POLICY "Client select user_definitions" ON public.user_definitions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.id = p.client_id
            WHERE p.id = auth.uid() AND p.role = 'client' AND cc.consultant_company_id = user_definitions.organization_id
        )
    );

-- 8. documents — Zorunlu Belge Matrisi'nde belge durumu eşleştirmesi için
--    (aynı organizasyon-bazlı erişim modeli; uygulama sorguları zaten firma
--    adına göre filtreleme yapıyor)
DROP POLICY IF EXISTS "Client select documents" ON public.documents;
CREATE POLICY "Client select documents" ON public.documents
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.id = p.client_id
            WHERE p.id = auth.uid() AND p.role = 'client' AND cc.consultant_company_id = documents.organization_id
        )
    );
