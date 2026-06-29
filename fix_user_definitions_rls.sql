-- ==========================================================
-- FIX: user_definitions RLS Policy for organization owners
-- ==========================================================
-- 
-- Problem: Firma sahipleri (premium_corporate) ve şefler (corporate_chief)
-- user_definitions tablosuna yalnızca kendi user_id'leriyle satır
-- ekleyebildiklerinden, tüm ekip adına kayıt oluşturmaya çalışınca
-- "new row violates row-level security policy" hatası alıyorlar.
--
-- Çözüm A (Önerilen): Sadece organization_id bazlı tek satır ekle.
-- Kod tarafında yapıldı - aşağıdaki SQL çalıştırmadan da çalışır.
--
-- Çözüm B: RLS politikasını genişlet (ekstra güvenlik esnekliği için)
-- Aşağıdaki SQL'i Supabase SQL Editor'da çalıştırın:
-- ==========================================================

-- Mevcut insert politikasını kaldır (varsa)
DROP POLICY IF EXISTS "Users can insert own definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow insert for same org members" ON public.user_definitions;
DROP POLICY IF EXISTS "org_members_can_insert_definitions" ON public.user_definitions;

-- Yeni politika: Aynı organizasyondaki premium_corporate veya corporate_chief
-- rolleri, organizasyon kapsamında herhangi bir user_id için kayıt ekleyebilir.
-- Diğer roller sadece kendi user_id'leri için ekleyebilir.
CREATE POLICY "org_owners_can_insert_any_user_definition"
ON public.user_definitions
FOR INSERT
TO authenticated
WITH CHECK (
  -- Organizasyon sahibi veya şefi ise: kayıt organization_id'nin kendi orgıyla eşleşmeli
  (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
        AND profiles.organization_id = user_definitions.organization_id
    )
  )
  OR
  -- Diğer roller: sadece kendi user_id'leri için kayıt ekleyebilir
  (
    user_definitions.user_id = auth.uid()
  )
);

-- SELECT politikası: Aynı organizasyondaki herkes okuyabilir
DROP POLICY IF EXISTS "Users can view own definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "org_members_can_view_definitions" ON public.user_definitions;

CREATE POLICY "org_members_can_view_definitions"
ON public.user_definitions
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  OR user_id = auth.uid()
);

-- UPDATE politikası
DROP POLICY IF EXISTS "Users can update own definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "org_owners_can_update_definitions" ON public.user_definitions;

CREATE POLICY "org_owners_can_update_definitions"
ON public.user_definitions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      AND profiles.organization_id = user_definitions.organization_id
  )
  OR user_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      AND profiles.organization_id = user_definitions.organization_id
  )
  OR user_id = auth.uid()
);

-- DELETE politikası
DROP POLICY IF EXISTS "Users can delete own definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "org_owners_can_delete_definitions" ON public.user_definitions;

CREATE POLICY "org_owners_can_delete_definitions"
ON public.user_definitions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      AND profiles.organization_id = user_definitions.organization_id
  )
  OR user_id = auth.uid()
);

-- ==========================================================
-- Ayrıca kod tarafında da düzeltme yapıldı:
-- "all" seçildiğinde artık her üye için ayrı satır oluşturmak yerine
-- sadece mevcut kullanıcı (userId) adına tek bir org-geneli kayıt ekleniyor.
-- Bu sayede RLS politikasını güncellemeden de hata alınmaz.
-- ==========================================================
