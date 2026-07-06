-- ==========================================================
-- 1. pdf_regulations / pdf_articles: sadece admin değil, ilgili
--    yönetici rolleri de (premium_corporate, corporate_chief,
--    premium_individual) kendi "Özel Mevzuat Ekle" kayıtlarını
--    ekleyebilsin/düzenleyebilsin/silebilsin diye MANAGE politikası
--    genişletildi. Önceden SADECE admin/system_admin izinliydi; bu
--    yüzden "Kaydedilirken hata oluştu: new row violates row-level
--    security policy for table pdf_regulations" hatası alınıyordu
--    (premium_individual'a özgü değil, tüm yönetici/şef hesapları
--    bu hatayı alıyordu).
-- ==========================================================

DROP POLICY IF EXISTS "Allow admin manage on pdf_regulations" ON public.pdf_regulations;
CREATE POLICY "Allow admin manage on pdf_regulations" ON public.pdf_regulations
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin'))
        OR created_by = auth.uid()
        OR (
            company_id IS NOT NULL
            AND company_id IN (
                SELECT organization_id FROM public.profiles
                WHERE id = auth.uid()
                AND role IN ('premium_corporate', 'corporate_chief', 'premium_individual')
            )
        )
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin'))
        OR created_by = auth.uid()
        OR (
            company_id IS NOT NULL
            AND company_id IN (
                SELECT organization_id FROM public.profiles
                WHERE id = auth.uid()
                AND role IN ('premium_corporate', 'corporate_chief', 'premium_individual')
            )
        )
    );

DROP POLICY IF EXISTS "Allow admin manage on pdf_articles" ON public.pdf_articles;
CREATE POLICY "Allow admin manage on pdf_articles" ON public.pdf_articles
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin'))
        OR EXISTS (
            SELECT 1 FROM public.pdf_regulations r
            WHERE r.id = pdf_articles.regulation_id
              AND (
                r.created_by = auth.uid()
                OR (
                    r.company_id IS NOT NULL
                    AND r.company_id IN (
                        SELECT organization_id FROM public.profiles
                        WHERE id = auth.uid()
                        AND role IN ('premium_corporate', 'corporate_chief', 'premium_individual')
                    )
                )
            )
        )
    );

-- ==========================================================
-- 2. Mevcut bireysel premium hesapların, satın alma anında kendi ad
--    soyadıyla otomatik oluşturulmuş "kişisel firma" (consultant_clients)
--    kaydını "Lokasyon 1" olarak yeniden adlandırır. Bundan böyle yeni
--    satın almalarda zaten "Lokasyon 1" adıyla oluşturuluyor
--    (Pricing.tsx güncellendi); bu sadece DAHA ÖNCE oluşturulmuş
--    kayıtları düzeltir. Sadece isim değişikliği - hiçbir kayıt
--    silinmiyor/taşınmıyor, bağlı aksiyon/rapor/atık kayıtları etkilenmez.
-- ==========================================================

UPDATE public.consultant_clients cc
SET name = 'Lokasyon 1'
FROM public.profiles p
WHERE p.role = 'premium_individual'
  AND p.organization_id = cc.consultant_company_id
  AND (
    LOWER(TRIM(cc.name)) = LOWER(TRIM(COALESCE(p.full_name, '')))
    OR LOWER(TRIM(cc.name)) = LOWER(TRIM(COALESCE(p.email, '')))
  );
