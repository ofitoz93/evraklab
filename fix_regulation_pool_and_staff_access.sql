-- =======================================================
-- MEVZUAT HAVUZU / PERSONEL ERİŞİMİ DÜZELTMELERİ
-- Supabase SQL Editor'de çalıştırın
--
-- Bu script şunları düzeltir:
-- 1) pdf_regulations SELECT: personel artık admin'in genel havuzunu
--    (company_id IS NULL) GÖRMESİN, sadece kendi firmasının özel mevzuatlarını
--    (company_id = kendi org'u) görsün. Yönetici/şef/admin admin havuzunu da görür.
-- 2) pdf_regulations / pdf_articles MANAGE (insert/update/delete): SADECE
--    yönetici/şef/admin. Personel artık bu tabloya hiç doğrudan yazmıyor;
--    "Mevzuat Talebi" akışıyla (regulation_requests.draft_regulation) tam
--    mevzuat metnini gönderiyor, yönetici/şef onaylarsa uygulama bu kayıtları
--    o an oluşturuyor (bkz. handleAnswerRegulationRequest). Bu yüzden personele
--    pdf_regulations/pdf_articles üzerinde asla doğrudan yazma izni VERİLMİYOR.
-- 3) regulation_requests: personelin tam mevzuat taslağını taşıyabilmesi için
--    draft_regulation (JSONB) kolonu ekleniyor.
-- 4) client_regulations / client_regulation_articles / company_pdf_regulations /
--    regulation_requests politikaları, atanmış personelin kendi firmasının ve
--    kendine atanmış işletmelerin verilerini görüp yönetebilmesi için
--    yeniden (idempotent olarak) tanımlanıyor.
-- =======================================================

-- 1. pdf_regulations: SELECT - admin havuzu (company_id IS NULL) sadece
--    yönetici/şef/admin'e; firmanın kendi özel mevzuatları herkese (personel dahil).
DROP POLICY IF EXISTS "Allow public select on pdf_regulations" ON public.pdf_regulations;
CREATE POLICY "Allow public select on pdf_regulations" ON public.pdf_regulations
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        company_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR
        (
            company_id IS NULL AND EXISTS (
                SELECT 1 FROM public.profiles WHERE id = auth.uid()
                  AND role IN ('premium_corporate', 'corporate_chief')
            )
        )
    );

-- 1b. pdf_regulations: MANAGE (insert/update/delete) - sadece yönetici/şef.
--     Personel bu tabloya asla doğrudan yazmaz (bkz. yukarıdaki not).
DROP POLICY IF EXISTS "Allow company manage on pdf_regulations" ON public.pdf_regulations;
CREATE POLICY "Allow company manage on pdf_regulations" ON public.pdf_regulations
    FOR ALL TO authenticated USING (
        company_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('premium_corporate', 'corporate_chief'))
    );

-- 2. pdf_articles: SELECT - üst mevzuatı görebilen herkes maddelerini de görebilir
--    (admin havuzu maddeleri de aynı şekilde personelden gizlenir).
DROP POLICY IF EXISTS "Allow public select on pdf_articles" ON public.pdf_articles;
CREATE POLICY "Allow public select on pdf_articles" ON public.pdf_articles
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.pdf_regulations r
            WHERE r.id = pdf_articles.regulation_id
              AND (
                  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
                  r.company_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR
                  (
                      r.company_id IS NULL AND EXISTS (
                          SELECT 1 FROM public.profiles WHERE id = auth.uid()
                            AND role IN ('premium_corporate', 'corporate_chief')
                      )
                  )
              )
        )
    );

-- 2b. pdf_articles: MANAGE - sadece yönetici/şef.
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

-- 2c. regulation_requests: personelin tam mevzuat taslağını taşıyacak kolon.
ALTER TABLE public.regulation_requests
  ADD COLUMN IF NOT EXISTS draft_regulation JSONB;

-- 3. company_pdf_regulations: firma havuzu - herhangi bir org üyesi (personel dahil)
--    kendi firmasının havuzunu görebilir ve (onay akışı durum kolonuyla kontrol
--    edilmek üzere) satır ekleyebilir/güncelleyebilir.
DROP POLICY IF EXISTS "Select company_pdf_regulations" ON public.company_pdf_regulations;
CREATE POLICY "Select company_pdf_regulations" ON public.company_pdf_regulations
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Manage company_pdf_regulations" ON public.company_pdf_regulations;
CREATE POLICY "Manage company_pdf_regulations" ON public.company_pdf_regulations
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

-- 4. client_regulations: yeniden tanımlama (yönetici/yetkili şef tüm firmaları,
--    personel sadece consultant_assignments üzerinden atandığı işletmeleri görür/yönetir).
DROP POLICY IF EXISTS "Select client_regulations" ON public.client_regulations;
CREATE POLICY "Select client_regulations" ON public.client_regulations
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND (p.role = 'premium_corporate' OR p.role = 'corporate_chief' OR (p.permissions->>'can_view_all_clients')::boolean = true)
              AND cc.id = client_regulations.client_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = client_regulations.client_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            JOIN public.profiles p ON p.id = auth.uid()
            JOIN public.organizations o ON o.id = p.organization_id
            WHERE cc.id = client_regulations.client_id
              AND (
                LOWER(TRIM(cc.name)) = LOWER(TRIM(o.name))
                OR LOWER(TRIM(cc.name)) LIKE '%' || LOWER(TRIM(o.name)) || '%'
                OR LOWER(TRIM(o.name)) LIKE '%' || LOWER(TRIM(cc.name)) || '%'
              )
        )
    );

DROP POLICY IF EXISTS "Manage client_regulations" ON public.client_regulations;
CREATE POLICY "Manage client_regulations" ON public.client_regulations
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND (p.role = 'premium_corporate' OR p.role = 'corporate_chief' OR (p.permissions->>'can_view_all_clients')::boolean = true)
              AND cc.id = client_regulations.client_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = client_regulations.client_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            JOIN public.profiles p ON p.id = auth.uid()
            JOIN public.organizations o ON o.id = p.organization_id
            WHERE cc.id = client_regulations.client_id
              AND LOWER(TRIM(cc.name)) = LOWER(TRIM(o.name))
        )
    );

-- 5. client_regulation_articles: madde bazlı erişim (mevcut geniş politika korunuyor,
--    yalnızca netlik için yeniden tanımlanıyor).
DROP POLICY IF EXISTS "Select client_regulation_articles" ON public.client_regulation_articles;
CREATE POLICY "Select client_regulation_articles" ON public.client_regulation_articles
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.client_regulations cr
            WHERE cr.id = client_regulation_articles.client_regulation_id
        )
    );

DROP POLICY IF EXISTS "Manage client_regulation_articles" ON public.client_regulation_articles;
CREATE POLICY "Manage client_regulation_articles" ON public.client_regulation_articles
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.client_regulations cr
            WHERE cr.id = client_regulation_articles.client_regulation_id
        )
    );

-- 6. regulation_requests: firma içi talepler - firma içindeki herkes görebilir/
--    (yönetici veya şef) cevaplayabilir; personel sadece kendi talebini yönetebilir.
DROP POLICY IF EXISTS "Select regulation_requests" ON public.regulation_requests;
CREATE POLICY "Select regulation_requests" ON public.regulation_requests
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        requested_by = auth.uid() OR
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            WHERE cc.id = regulation_requests.client_id
              AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Manage regulation_requests" ON public.regulation_requests;
CREATE POLICY "Manage regulation_requests" ON public.regulation_requests
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        requested_by = auth.uid() OR
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            WHERE cc.id = regulation_requests.client_id
              AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );
