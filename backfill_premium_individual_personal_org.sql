-- add_premium_individual_personal_org.sql'i uyguladıktan SONRA çalıştırın.
--
-- Kişisel organizasyon otomatik oluşturma özelliği (Pricing.tsx) eklenmeden
-- ÖNCE bireysel premium satın almış hesaplar (örn. fitoz9322@gmail.com),
-- organization_id = NULL durumunda kalmıştı. Bu script, role='premium_individual'
-- olup organizasyonu olmayan TÜM hesaplar için geriye dönük olarak kişisel
-- organizasyon + kendi adını taşıyan "kişisel firma" (consultant_clients) kaydı
-- oluşturur. İdempotenttir: sadece organization_id IS NULL olanları işler,
-- birden fazla kez çalıştırılsa da zaten organizasyonu olanlara dokunmaz.

DO $$
DECLARE
  r RECORD;
  new_org_id UUID;
  personal_name TEXT;
BEGIN
  FOR r IN
    SELECT id, full_name, email
    FROM public.profiles
    WHERE role = 'premium_individual' AND organization_id IS NULL
  LOOP
    personal_name := COALESCE(NULLIF(TRIM(r.full_name), ''), r.email, 'Bireysel Kullanıcı');

    INSERT INTO public.organizations (name, member_limit, is_environmental_consultant, is_personal)
    VALUES (personal_name, 1, false, true)
    RETURNING id INTO new_org_id;

    UPDATE public.profiles
    SET organization_id = new_org_id
    WHERE id = r.id;

    INSERT INTO public.consultant_clients (consultant_company_id, name)
    VALUES (new_org_id, personal_name);

    RAISE NOTICE 'Kişisel organizasyon oluşturuldu: % (%) -> org_id=%', personal_name, r.email, new_org_id;
  END LOOP;
END $$;
