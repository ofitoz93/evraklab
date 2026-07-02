-- Bir kullanıcının (danışman personeli, şef, yönetici) AYNI ZAMANDA belirli bir
-- müşteri firmasının panelini de görüntüleyebilmesi için: bu SQL, daha önce
-- eklenen "role = 'client'" şartlı RLS politikalarını, role'den bağımsız olarak
-- sadece profiles.client_id eşleşmesine bakacak şekilde gevşetiyor.
--
-- Not: profiles.client_id normal (client olmayan) hesaplarda varsayılan olarak
-- NULL'dur, bu yüzden bu değişiklik ek bir güvenlik açığı yaratmaz — sadece
-- client_id'si BİLEREK atanmış hesaplar (bkz. ConsultantPanel "Müşteri Girişi"
-- akışındaki "mevcut hesaba bağla" seçeneği) o firmanın verilerini görebilir.

-- 1. client_regulations
DROP POLICY IF EXISTS "Client select client_regulations" ON public.client_regulations;
CREATE POLICY "Client select client_regulations" ON public.client_regulations
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.client_id = client_regulations.client_id
        )
    );

-- 2. client_regulation_articles
DROP POLICY IF EXISTS "Client select client_regulation_articles" ON public.client_regulation_articles;
CREATE POLICY "Client select client_regulation_articles" ON public.client_regulation_articles
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.client_regulations cr
            JOIN public.profiles p ON p.client_id = cr.client_id
            WHERE cr.id = client_regulation_articles.client_regulation_id AND p.id = auth.uid()
        )
    );

-- 3. inspection_submissions
DROP POLICY IF EXISTS "Client select inspection_submissions" ON public.inspection_submissions;
CREATE POLICY "Client select inspection_submissions" ON public.inspection_submissions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.inspection_points ip
            JOIN public.inspection_forms f ON f.id = ip.form_id
            JOIN public.profiles p ON p.client_id = f.client_id
            WHERE ip.id = inspection_submissions.point_id AND p.id = auth.uid()
        )
    );

-- 4. inspection_answers
DROP POLICY IF EXISTS "Client select inspection_answers" ON public.inspection_answers;
CREATE POLICY "Client select inspection_answers" ON public.inspection_answers
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.inspection_submissions s
            JOIN public.inspection_points ip ON ip.id = s.point_id
            JOIN public.inspection_forms f ON f.id = ip.form_id
            JOIN public.profiles p ON p.client_id = f.client_id
            WHERE s.id = inspection_answers.submission_id AND p.id = auth.uid()
        )
    );

-- 5. env_reports
DROP POLICY IF EXISTS "Client select env_reports" ON public.env_reports;
CREATE POLICY "Client select env_reports" ON public.env_reports
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.client_id = env_reports.client_id
        )
    );

-- 6. visit_schedules
DROP POLICY IF EXISTS "Client select visit_schedules" ON public.visit_schedules;
CREATE POLICY "Client select visit_schedules" ON public.visit_schedules
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.client_id = visit_schedules.client_id
        )
    );

-- 7. user_definitions
DROP POLICY IF EXISTS "Client select user_definitions" ON public.user_definitions;
CREATE POLICY "Client select user_definitions" ON public.user_definitions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.id = p.client_id
            WHERE p.id = auth.uid() AND cc.consultant_company_id = user_definitions.organization_id
        )
    );

-- 8. documents
DROP POLICY IF EXISTS "Client select documents" ON public.documents;
CREATE POLICY "Client select documents" ON public.documents
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.id = p.client_id
            WHERE p.id = auth.uid() AND cc.consultant_company_id = documents.organization_id
        )
    );

-- 9. compliance_actions (select)
DROP POLICY IF EXISTS "Client select compliance_actions" ON public.compliance_actions;
CREATE POLICY "Client select compliance_actions" ON public.compliance_actions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.client_id = compliance_actions.client_id
        )
    );

-- 10. compliance_actions (update — kanıt dosyası ekleme / tamamlandı işaretleme)
DROP POLICY IF EXISTS "Client update compliance_actions" ON public.compliance_actions;
CREATE POLICY "Client update compliance_actions" ON public.compliance_actions
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.client_id = compliance_actions.client_id
        )
    );

-- 11. waste_companies (select)
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
            WHERE p.id = auth.uid() AND cc.consultant_company_id = waste_companies.organization_id
        )
    );

-- 12. waste_companies (insert)
DROP POLICY IF EXISTS "Client insert waste_companies" ON public.waste_companies;
CREATE POLICY "Client insert waste_companies" ON public.waste_companies
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.id = p.client_id
            WHERE p.id = auth.uid() AND cc.consultant_company_id = waste_companies.organization_id
        )
    );

-- 13. waste_records (select) — mevcut politikayı role='client' şartından bağımsız hale getir
DROP POLICY IF EXISTS "Select waste_records" ON public.waste_records;
CREATE POLICY "Select waste_records" ON public.waste_records
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND p.role IN ('premium_corporate', 'corporate_chief')
              AND cc.id = waste_records.client_id
        ) OR
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = waste_records.client_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.client_id = waste_records.client_id
        )
    );
