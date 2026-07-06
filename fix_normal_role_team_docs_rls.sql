-- ==========================================================
-- Normal (rolsüz) organizasyon üyelerinin, ekibin şirket
-- evraklarını görebilmesi için documents SELECT RLS politikasını
-- günceller. Önceden sadece premium_corporate / corporate_chief /
-- admin / system_admin (veya can_view_team_docs izni olanlar)
-- organizasyon evraklarını görebiliyordu; 'normal' rolündeki
-- organizasyon üyeleri kendi yükledikleri dışında hiçbir şey
-- göremiyordu (Evraklar sayfasında sadece 3 adet vb. sorunlara
-- yol açıyordu).
-- ==========================================================

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
        )
    )
);
