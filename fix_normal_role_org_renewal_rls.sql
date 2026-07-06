-- ==========================================================
-- Abonelik süresi dolan bir organizasyondaki tüm üyeler
-- check_and_downgrade_subscriptions() tarafından 'normal' rolüne
-- düşürülüyor. Ancak organizations tablosundaki UPDATE RLS
-- politikası sadece 'admin' / 'system_admin' / 'premium_corporate' /
-- 'corporate_chief' rollerine izin veriyordu - yani süresi dolmuş
-- bir şirket, üyeleri 'normal'e düştüğü için bir daha ASLA kendi
-- başına yenileme yapamıyordu (Pricing sayfası "başarılı" mesajı
-- gösteriyordu ama UPDATE RLS tarafından sessizce engelleniyor,
-- 0 satır etkileniyordu).
--
-- Bu politika artık: organizasyona bağlı 'normal' rolündeki üyelerin
-- de kendi şirketlerinin abonelik/koltuk bilgisini güncelleyebilmesine
-- (yenileme yapabilmesine) izin veriyor.
-- ==========================================================

DROP POLICY IF EXISTS "Allow update for authorized users" ON public.organizations;

CREATE POLICY "Allow update for authorized users" ON public.organizations
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND (
              profiles.role = ANY (ARRAY['admin'::text, 'system_admin'::text])
              OR (
                  profiles.organization_id = organizations.id
                  AND profiles.role = ANY (ARRAY['premium_corporate'::text, 'corporate_chief'::text, 'normal'::text])
              )
          )
    )
);
