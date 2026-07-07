-- ==========================================================
-- FIX PREMIUM_INDIVIDUAL ROUND 4
-- Supabase SQL Editor'de çalıştırın
--
-- 1) pdf_regulations / pdf_articles SELECT: admin'in genel mevzuat havuzunu
--    (company_id IS NULL) sadece 'premium_corporate' ve 'corporate_chief'
--    rolleri görebiliyordu, 'premium_individual' listede yoktu. Bu yüzden
--    bireysel premium hesaplar "Mevzuat Havuzu" sayfasında admin'in
--    yüklediği mevzuatları hiç görmüyor, liste boş görünüyordu.
-- 2) visit_schedules: "Managers can manage..." (ALL) politikası sadece
--    'premium_corporate' ve 'corporate_chief' rollerini kabul ediyordu.
--    Bireysel premium hesap ziyareti kendi üzerinde doğrudan (status
--    'scheduled') planlarken bu politika INSERT'i reddediyor ve
--    "new row violates row-level security policy for table
--    visit_schedules" hatası veriyordu. Aynı sebeple SELECT politikasında
--    da 'premium_individual' eksikti.
-- ==========================================================

-- 1a. pdf_regulations: SELECT
DROP POLICY IF EXISTS "Allow public select on pdf_regulations" ON public.pdf_regulations;
CREATE POLICY "Allow public select on pdf_regulations" ON public.pdf_regulations
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        company_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR
        (
            company_id IS NULL AND EXISTS (
                SELECT 1 FROM public.profiles WHERE id = auth.uid()
                  AND role IN ('premium_corporate', 'corporate_chief', 'premium_individual')
            )
        )
    );

-- 1b. pdf_articles: SELECT
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
                            AND role IN ('premium_corporate', 'corporate_chief', 'premium_individual')
                      )
                  )
              )
        )
    );

-- 2a. visit_schedules: SELECT
DROP POLICY IF EXISTS "Users can view visit schedules of their organization" ON public.visit_schedules;
CREATE POLICY "Users can view visit schedules of their organization"
ON public.visit_schedules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND organization_id = visit_schedules.consultant_company_id
      AND (role IN ('premium_corporate', 'premium_individual', 'admin', 'system_admin')
           OR (role = 'corporate_chief' AND (extra_permissions->>'can_view_all_clients')::boolean = true))
  )
  OR
  EXISTS (
    SELECT 1 FROM public.consultant_assignments ca
    WHERE ca.client_id = visit_schedules.client_id
      AND ca.user_id = auth.uid()
  )
);

-- 2b. visit_schedules: MANAGE (insert/update/delete)
DROP POLICY IF EXISTS "Managers can manage visit schedules of their organization" ON public.visit_schedules;
CREATE POLICY "Managers can manage visit schedules of their organization"
ON public.visit_schedules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND organization_id = visit_schedules.consultant_company_id
      AND role IN ('premium_corporate', 'corporate_chief', 'premium_individual', 'admin', 'system_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND organization_id = visit_schedules.consultant_company_id
      AND role IN ('premium_corporate', 'corporate_chief', 'premium_individual', 'admin', 'system_admin')
  )
);
