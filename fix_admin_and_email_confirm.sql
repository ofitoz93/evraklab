-- ==========================================================
-- EVRAKLAB - ADMIN USER CREATION & EMAIL CONFIRMATION BYPASS & USER DELETION & STORAGE POLICIES
-- ==========================================================

-- 1. E-posta onayını otomatik hale getiren Trigger fonksiyonu
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  NEW.confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı auth.users tablosuna BEFORE INSERT (eklemeden hemen önce) olarak ekliyoruz
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();


-- 2. Profiller (profiles) tablosu için RLS politikaları
-- RLS'yi aktif ediyoruz (zaten aktifse etkisizdir)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Mevcut politikaları temizleyelim (çakışmaları önlemek için)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Admin kontrolü için recursive olmayan (sonsuz döngü yaratmayan) SECURITY DEFINER fonksiyonu
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'system_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Herkesin profilleri listeleyebilmesi için (sohbet, ekip yönetimi vb.)
CREATE POLICY "Users can view all profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Kullanıcıların kendi profillerini güncelleyebilmesi için
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin ve Sistem Adminlerinin tüm profilleri ekleme, silme, güncelleme yapabilmesi için
CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- 3. Adminin kullanıcıyı tamamen silebilmesi için RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Istek yapan kullanıcının admin olup olmadığını kontrol edelim
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gereklidir.';
  END IF;

  -- Profil verisini sil
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- auth.users tablosundaki kaydı sil (böylece aynı maille tekrar kaydolabilir)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. client_assets, documents ve avatars Buckets Oluşturma ve Storage RLS Politikaları
-- Bucket'ları oluşturuyoruz (varsa hata vermez)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('client_assets', 'client_assets', true),
  ('documents', 'documents', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Eski politikaları temizleyelim (çakışmaları önlemek için)
DROP POLICY IF EXISTS "Allow public insert into client_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from client_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on client_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from client_assets" ON storage.objects;

DROP POLICY IF EXISTS "Allow public insert into documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from documents" ON storage.objects;

DROP POLICY IF EXISTS "Allow public insert into avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from avatars" ON storage.objects;

-- client_assets RLS
CREATE POLICY "Allow public insert into client_assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'client_assets');
CREATE POLICY "Allow public select from client_assets" ON storage.objects FOR SELECT USING (bucket_id = 'client_assets');
CREATE POLICY "Allow public update on client_assets" ON storage.objects FOR UPDATE USING (bucket_id = 'client_assets');
CREATE POLICY "Allow public delete from client_assets" ON storage.objects FOR DELETE USING (bucket_id = 'client_assets');

-- documents RLS
CREATE POLICY "Allow public insert into documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Allow public select from documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Allow public update on documents" ON storage.objects FOR UPDATE USING (bucket_id = 'documents');
CREATE POLICY "Allow public delete from documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents');

-- avatars RLS
CREATE POLICY "Allow public insert into avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Allow public select from avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Allow public update on avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');
CREATE POLICY "Allow public delete from avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars');

-- ==========================================================
-- 5. user_definitions için RLS politikaları
-- ==========================================================
ALTER TABLE public.user_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to view definitions in same organization" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to insert their own definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to update their own definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to delete their own definitions" ON public.user_definitions;

-- SELECT: Kullanıcı kendi tanımlarını veya kendi şirketindeki diğer kullanıcıların tanımlarını görebilir
CREATE POLICY "Allow users to view definitions in same organization" ON public.user_definitions
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p1
        WHERE p1.id = user_definitions.user_id
        AND p1.organization_id IS NOT NULL
        AND p1.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
);

-- INSERT: Kullanıcı sadece kendi adına tanım ekleyebilir
CREATE POLICY "Allow users to insert their own definitions" ON public.user_definitions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Kullanıcı sadece kendi tanımlarını güncelleyebilir
CREATE POLICY "Allow users to update their own definitions" ON public.user_definitions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Kullanıcı sadece kendi tanımlarını silebilir
CREATE POLICY "Allow users to delete their own definitions" ON public.user_definitions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());


-- ==========================================================
-- 6. documents için RLS politikaları
-- ==========================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to view documents" ON public.documents;
DROP POLICY IF EXISTS "Allow users to insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Allow users to update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Allow users to delete their own documents" ON public.documents;

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
            (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
            OR
            (SELECT COALESCE((permissions->>'can_view_team_docs')::boolean, false) FROM public.profiles WHERE id = auth.uid()) = true
        )
    )
);

CREATE POLICY "Allow users to insert their own documents" ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
    uploader_id = auth.uid()
    AND
    (
        organization_id IS NULL
        OR
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
);

CREATE POLICY "Allow users to update their own documents" ON public.documents
FOR UPDATE
TO authenticated
USING (
    uploader_id = auth.uid()
    OR
    (
        organization_id IS NOT NULL
        AND
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
    )
)
WITH CHECK (
    uploader_id = auth.uid()
    OR
    (
        organization_id IS NOT NULL
        AND
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
    )
);

CREATE POLICY "Allow users to delete their own documents" ON public.documents
FOR DELETE
TO authenticated
USING (
    uploader_id = auth.uid()
    OR
    (
        organization_id IS NOT NULL
        AND
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
    )
);

