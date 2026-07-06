-- ==========================================================
-- Abonelik süresi dolunca check_and_downgrade_subscriptions()
-- kullanıcıları 'normal' rolüne düşürüyor ama ESKİ ROLÜ HİÇBİR
-- YERDE SAKLAMIYORDU. Şirket abonelik yenilemesi yapılsa bile
-- (organizations.subscription_end_date uzasa bile) üyelerin rolü
-- sonsuza kadar 'normal' kalıyor, bu yüzden "Hizmet Verilen
-- İşletmeler" gibi role bağlı sayfalar/sekmeler kayboluyordu.
--
-- Bu migration:
-- 1) profiles.previous_role kolonunu ekliyor
-- 2) check_and_downgrade_subscriptions() düşürürken previous_role'u
--    kaydediyor
-- 3) restore_org_roles(org_id) fonksiyonunu ekliyor - yenileme
--    sırasında Pricing sayfasından çağrılıyor, previous_role'u geri
--    yüklüyor
-- 4) FİTOZ A.Ş. için rolleri zaten kaybolmuş 3 kullanıcının rolünü
--    manuel olarak geri yüklüyor (previous_role kaydı olmadığı için
--    otomatik geri yükleme bunlar için mümkün değildi)
-- ==========================================================

-- 1. Yeni kolon
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS previous_role TEXT;

-- 2. Downgrade fonksiyonunu previous_role kaydedecek şekilde güncelle
CREATE OR REPLACE FUNCTION public.check_and_downgrade_subscriptions()
RETURNS VOID AS $$
BEGIN
  -- Bireysel premium süresi dolanları düşür
  UPDATE public.profiles
  SET previous_role = role, role = 'normal', subscription_end_date = NULL
  WHERE subscription_end_date IS NOT NULL
    AND subscription_end_date < NOW()
    AND role = 'premium_individual';

  -- Organizasyon aboneliği süresi dolan kurumsal kullanıcıları düşür
  UPDATE public.profiles p
  SET previous_role = p.role, role = 'normal'
  FROM public.organizations o
  WHERE p.organization_id = o.id
    AND o.subscription_end_date IS NOT NULL
    AND o.subscription_end_date < NOW()
    AND p.role IN ('premium_corporate', 'corporate_chief', 'corporate_staff');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Yenileme sırasında rolleri geri yükleyen fonksiyon
CREATE OR REPLACE FUNCTION public.restore_org_roles(org_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET role = previous_role, previous_role = NULL
  WHERE organization_id = org_id
    AND role = 'normal'
    AND previous_role IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FİTOZ A.Ş. için manuel düzeltme (previous_role kaydı yoktu)
UPDATE public.profiles SET role = 'premium_corporate' WHERE email = 'o.fitoz93@gmail.com';
UPDATE public.profiles SET role = 'corporate_staff' WHERE email = 'o.fitoz9393@gmail.com';
UPDATE public.profiles SET role = 'corporate_chief' WHERE email = 'gurkan@gurkan.com';
