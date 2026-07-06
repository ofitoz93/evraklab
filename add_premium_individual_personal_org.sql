-- Bireysel premium (premium_individual) satın alan kullanıcılara "Premium Panel"
-- üzerinden Saha Denetimleri / Atık Yönetimi / Mevzuat Takip / Aksiyon Takip
-- özelliklerini açabilmek için: bu kullanıcılara satın alma anında (Pricing.tsx)
-- kendilerine özel, tek kişilik bir "kişisel organizasyon" ve bu organizasyona
-- bağlı, kendi adlarını taşıyan bir "kişisel client" (consultant_clients) kaydı
-- otomatik oluşturuluyor. Bu sayede at Yönetimi/Mevzuat/Aksiyon tablolarının
-- var olan organization_id / client_id tabanlı RLS politikaları hiç
-- değiştirilmeden çalışır (tıpkı normal bir "müşteri firma" hesabı gibi).
--
-- Tek istisna: inspection_forms/questions/points/submissions/answers
-- politikaları SADECE ('corporate_chief','premium_corporate','corporate_staff',
-- 'admin','system_admin') rollerine izin veriyordu (created_by/assigned_to gibi
-- bir yedek kontrol yok). Bu yüzden bu 5 politikaya 'premium_individual' rolü
-- ekleniyor.

-- 1. organizations.is_personal: bireysel premium için otomatik oluşturulan
--    "kişisel organizasyonları" admin panelindeki gerçek şirket listelerinden
--    ayırt edebilmek için (ileride filtrelemek isterseniz).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;

-- 1b. consultant_clients: "kişisel firma" kaydını (kendi adına) satın alma
--     anında ekleyebilmek için MANAGE politikasına 'premium_individual' eklendi.
DROP POLICY IF EXISTS "Consultant admins can manage their clients" ON public.consultant_clients;
CREATE POLICY "Consultant admins can manage their clients"
ON public.consultant_clients FOR ALL
USING (consultant_company_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid() AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'premium_individual')
));

-- 2. inspection_forms
DROP POLICY IF EXISTS "Allow consultant employees to manage forms" ON public.inspection_forms;
CREATE POLICY "Allow consultant employees to manage forms" ON public.inspection_forms
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid()
            AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'premium_individual' OR role = 'admin' OR role = 'system_admin')
        )
    );

-- 3. inspection_questions
DROP POLICY IF EXISTS "Allow consultant employees to manage questions" ON public.inspection_questions;
CREATE POLICY "Allow consultant employees to manage questions" ON public.inspection_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.inspection_forms f
            WHERE f.id = form_id
            AND f.organization_id IN (
                SELECT organization_id FROM public.profiles
                WHERE id = auth.uid()
                AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'premium_individual' OR role = 'admin' OR role = 'system_admin')
            )
        )
    );

-- 4. inspection_points
DROP POLICY IF EXISTS "Allow consultant employees to manage points" ON public.inspection_points;
CREATE POLICY "Allow consultant employees to manage points" ON public.inspection_points
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.inspection_forms f
            WHERE f.id = form_id
            AND f.organization_id IN (
                SELECT organization_id FROM public.profiles
                WHERE id = auth.uid()
                AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'premium_individual' OR role = 'admin' OR role = 'system_admin')
            )
        )
    );

-- 5. inspection_submissions
DROP POLICY IF EXISTS "Allow consultant employees to edit/delete submissions" ON public.inspection_submissions;
CREATE POLICY "Allow consultant employees to edit/delete submissions" ON public.inspection_submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.inspection_points p
            JOIN public.inspection_forms f ON p.form_id = f.id
            WHERE p.id = point_id
            AND f.organization_id IN (
                SELECT organization_id FROM public.profiles
                WHERE id = auth.uid()
                AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'premium_individual' OR role = 'admin' OR role = 'system_admin')
            )
        )
    );

-- 6. inspection_answers
DROP POLICY IF EXISTS "Allow consultant employees to edit/delete answers" ON public.inspection_answers;
CREATE POLICY "Allow consultant employees to edit/delete answers" ON public.inspection_answers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.inspection_submissions s
            JOIN public.inspection_points p ON s.point_id = p.id
            JOIN public.inspection_forms f ON p.form_id = f.id
            WHERE s.id = submission_id
            AND f.organization_id IN (
                SELECT organization_id FROM public.profiles
                WHERE id = auth.uid()
                AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'premium_individual' OR role = 'admin' OR role = 'system_admin')
            )
        )
    );

-- 7. user_definitions (Belge Türü / Lokasyon tanımları — "Dokümantasyon" sekmesi)
-- Bireysel premium hesap artık bir organization_id'ye sahip olduğu için
-- yeni belge türü/lokasyon eklerken "kurumsal" (organization_id dolu) kaydı
-- oluşturuyor; bu ise INSERT/UPDATE/DELETE politikalarının sadece
-- premium_corporate/corporate_chief/admin rollerine izin vermesi yüzünden
-- RLS tarafından reddediliyordu ("belge türü ve lokasyon eklenmiyor" hatası).
DROP POLICY IF EXISTS "Allow users to view definitions" ON public.user_definitions;
CREATE POLICY "Allow users to view definitions" ON public.user_definitions
FOR SELECT TO authenticated USING (
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles manager
        WHERE manager.id = auth.uid()
        AND manager.organization_id = user_definitions.organization_id
        AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
      )
      OR
      user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Allow users to insert definitions" ON public.user_definitions;
CREATE POLICY "Allow users to insert definitions" ON public.user_definitions
FOR INSERT TO authenticated WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
);

DROP POLICY IF EXISTS "Allow users to update definitions" ON public.user_definitions;
CREATE POLICY "Allow users to update definitions" ON public.user_definitions
FOR UPDATE TO authenticated USING (
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
) WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
);

DROP POLICY IF EXISTS "Allow users to delete definitions" ON public.user_definitions;
CREATE POLICY "Allow users to delete definitions" ON public.user_definitions
FOR DELETE TO authenticated USING (
  (
    (organization_id IS NULL AND user_id = auth.uid())
    OR
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles target
        JOIN public.profiles manager ON manager.organization_id = target.organization_id
        WHERE manager.id = auth.uid()
        AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
        AND target.id = user_definitions.user_id
        AND manager.organization_id = user_definitions.organization_id
      )
    )
  )
  AND NOT (
    category = 'location'
    AND organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.consultant_company_id = user_definitions.organization_id
      AND LOWER(cc.name) = LOWER(user_definitions.label)
    )
  )
);
