-- ==========================================================
-- 1) user_definitions (belge türleri / lokasyonlar): şirket sahibinin
--    eklediği kurumsal tanımlar personel (corporate_staff) tarafından
--    görünmüyordu. "Allow users to view definitions" politikası SELECT'i
--    sadece yönetici rolleriyle (premium_corporate, corporate_chief,
--    admin, system_admin, premium_individual) sınırlıyordu; corporate_staff
--    bu listede olmadığı için sadece user_id = kendisi olan satırları
--    görebiliyordu - oysa sahibin eklediği tanımlar user_id = sahip
--    olarak tek satır halinde saklanıyor (bkz. AddDocument.tsx). Bu
--    kategoriler hassas veri değil, aynı şirketteki herkesin belge
--    yüklerken aynı listeden seçim yapabilmesi gerekiyor - bu yüzden
--    SELECT'i rol ayrımı yapmadan tüm organizasyon üyelerine açıyoruz
--    (INSERT/UPDATE/DELETE hâlâ sadece yöneticilere özel, dokunulmadı).
--
-- 2) documents: corporate_chief/corporate_staff'a sahibin
--    extra_permissions.can_view_all_clients yetkisi verildiğinde RLS
--    seviyesinde de organizasyon geneli belgeleri görebilmeleri için
--    ek bir OR koşulu ekleniyor (documents.tsx'teki client-side filtre
--    zaten bu bayrağı kontrol ediyor, ama corporate_staff bu bayrağa
--    sahip olsa bile RLS onu daha en baştan engelliyordu).
-- ==========================================================

DROP POLICY IF EXISTS "Allow users to view definitions" ON public.user_definitions;
CREATE POLICY "Allow users to view definitions" ON public.user_definitions
FOR SELECT TO authenticated USING (
  -- Kişisel tanımlar: sadece sahibi görebilir
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Kurumsal tanımlar: aynı organizasyondaki HERKES görebilir (rol farkı yok)
  (
    organization_id IS NOT NULL
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Allow users to view documents" ON public.documents;
CREATE POLICY "Allow users to view documents" ON public.documents
FOR SELECT
TO authenticated
USING (
    uploader_id = auth.uid()
    OR
    (
        organization_id IS NOT NULL
        AND
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND
        (
            (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'normal')
            OR
            (SELECT COALESCE((permissions->>'can_view_team_docs')::boolean, false) FROM public.profiles WHERE id = auth.uid()) = true
            OR
            (SELECT COALESCE((extra_permissions->>'can_view_all_clients')::boolean, false) FROM public.profiles WHERE id = auth.uid()) = true
        )
    )
);
