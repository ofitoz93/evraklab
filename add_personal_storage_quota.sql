-- ==========================================================
-- KİŞİ BAZLI ŞAHSİ DEPOLAMA KOTASI TAHSİSİ + GERÇEK KOTA ZORLAMASI
-- ==========================================================
-- Bugüne kadar organizations.storage_limit / profiles.storage_limit sadece
-- görsel bir bar olarak gösteriliyordu (get_org_storage_usage,
-- get_user_storage_usage, get_org_storage_usage_by_member) — hiçbir yerde
-- (frontend'de kontrol yok, documents tablosunda trigger yok, RLS sadece
-- sahiplik kontrol ediyor) fiilen zorlanmıyordu. Bu migration iki şey ekliyor:
--
-- 1. employee_details.personal_storage_quota: firma sahibinin belirli bir
--    personele (şahsi belge yükleme izni verilmiş olsa bile) şirket
--    kotasından kesin bir pay ayırabilmesi için (örn. Ahmet'e 100MB,
--    Mehmet'e 50MB). NULL = kişiye özel üst sınır yok (bugünkü gibi, sadece
--    genel şirket kotasıyla sınırlı).
-- 2. documents tablosuna gerçek kota zorlama trigger'ı: şirket kotası,
--    kişiye özel tahsisat ve kendi satın alınan şahsi kota artık dolunca
--    yükleme gerçekten reddediliyor.

-- 1. Kolon
ALTER TABLE public.employee_details
ADD COLUMN IF NOT EXISTS personal_storage_quota BIGINT;

-- 2. Tahsisat doğrulama: bir org'daki tüm personel_storage_quota toplamı
-- organizations.storage_limit'i aşamaz.
CREATE OR REPLACE FUNCTION public.trg_check_employee_storage_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_limit BIGINT;
  v_allocated_others BIGINT;
BEGIN
  IF NEW.personal_storage_quota IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT storage_limit INTO v_org_limit FROM public.organizations WHERE id = NEW.organization_id;

  SELECT COALESCE(SUM(personal_storage_quota), 0) INTO v_allocated_others
  FROM public.employee_details
  WHERE organization_id = NEW.organization_id
    AND profile_id != NEW.profile_id
    AND personal_storage_quota IS NOT NULL;

  IF v_org_limit IS NOT NULL AND (v_allocated_others + NEW.personal_storage_quota) > v_org_limit THEN
    RAISE EXCEPTION 'Toplam tahsis edilen şahsi kota, şirket depolama kotasını aşamaz. Kalan tahsis edilebilir alan: % bayt.',
      GREATEST(v_org_limit - v_allocated_others, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_details_storage_allocation_trigger ON public.employee_details;
CREATE TRIGGER employee_details_storage_allocation_trigger
BEFORE INSERT OR UPDATE OF personal_storage_quota ON public.employee_details
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_employee_storage_allocation();

-- 3. Yükleme zorlama: documents INSERT'inde ilgili havuzun (şirket / kişiye
-- özel tahsisat / kendi şahsi kotası) dolup dolmadığını kontrol eder. Mevcut
-- get_org_storage_usage / get_org_storage_usage_by_member / get_user_storage_usage
-- fonksiyonlarıyla birebir aynı WHERE mantığını kullanır (tutarlılık için).
CREATE OR REPLACE FUNCTION public.trg_check_document_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_org_limit BIGINT;
  v_org_used BIGINT;
  v_personal_quota BIGINT;
  v_personal_used BIGINT;
  v_profile_limit BIGINT;
  v_profile_used BIGINT;
BEGIN
  IF NEW.file_size IS NULL OR NEW.file_size <= 0 THEN
    RETURN NEW;
  END IF;

  v_org_id := COALESCE(NEW.organization_id, NEW.billing_org_id);

  IF v_org_id IS NOT NULL THEN
    -- Şirket kotası (kurumsal + işverene faturalanan tüm şahsi kullanım dahil)
    SELECT storage_limit INTO v_org_limit FROM public.organizations WHERE id = v_org_id;

    SELECT COALESCE(SUM(file_size), 0) INTO v_org_used
    FROM public.documents
    WHERE organization_id = v_org_id OR billing_org_id = v_org_id;

    IF v_org_limit IS NOT NULL AND v_org_used + NEW.file_size > v_org_limit THEN
      RAISE EXCEPTION 'Şirket depolama kotası dolu. Bu belge için yeterli alan yok.';
    END IF;

    -- Kişiye özel tahsisat varsa, o kişinin kendi payı da ayrıca kontrol edilir
    IF NEW.billing_org_id IS NOT NULL THEN
      SELECT personal_storage_quota INTO v_personal_quota
      FROM public.employee_details
      WHERE profile_id = NEW.uploader_id AND organization_id = v_org_id;

      IF v_personal_quota IS NOT NULL THEN
        SELECT COALESCE(SUM(file_size), 0) INTO v_personal_used
        FROM public.documents
        WHERE (organization_id = v_org_id OR billing_org_id = v_org_id)
          AND uploader_id = NEW.uploader_id;

        IF v_personal_used + NEW.file_size > v_personal_quota THEN
          RAISE EXCEPTION 'Şahsi depolama kotanız dolu. Yöneticinizden size ayrılan alanı artırmasını isteyin.';
        END IF;
      END IF;
    END IF;
  ELSE
    -- Tam şahsi (kendi satın aldığı/varsayılan kota)
    SELECT storage_limit INTO v_profile_limit FROM public.profiles WHERE id = NEW.uploader_id;

    SELECT COALESCE(SUM(file_size), 0) INTO v_profile_used
    FROM public.documents
    WHERE uploader_id = NEW.uploader_id AND organization_id IS NULL AND billing_org_id IS NULL;

    IF v_profile_limit IS NOT NULL AND v_profile_used + NEW.file_size > v_profile_limit THEN
      RAISE EXCEPTION 'Şahsi depolama kotanız dolu. Depolama alanı satın alarak kotanızı artırabilirsiniz.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_storage_quota_trigger ON public.documents;
CREATE TRIGGER documents_storage_quota_trigger
BEFORE INSERT ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_document_storage_quota();
