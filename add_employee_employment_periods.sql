-- ==========================================================
-- EVRAKLAB PERSONEL ÇALIŞMA DÖNEMLERİ (çoklu giriş/çıkış geçmişi)
-- ==========================================================
-- employee_details.hire_date/exit_date kişi başına TEK satır olduğu için
-- bir personel çıkarılıp tekrar işe alındığında önceki dönem (ilk giriş/
-- çıkış tarihi çifti) üzerine yazılarak kayboluyordu. Bu tablo her dönemi
-- ayrı bir satır olarak kalıcı tutar; employee_details değişmeye devam
-- eder ("şu anki dönem" özeti olarak, mevcut kod tabanındaki tüm
-- rol/roster kontrolleri onu kullanmaya devam eder) — bu tablo sadece
-- geçmiş dönemlerin kaydı ve maaş üretiminin (bkz.
-- fix_salary_proration_and_periods.sql) kıst/boşluk-ay hesabında baz
-- aldığı kaynaktır.
--
-- employee_details'i değiştiren TÜM yollar (kick_employee_with_exit_date,
-- reactivate_departed_employee, PersonnelCard.tsx'teki client-side
-- upsert'ler) merkezi olarak buradaki tek trigger üzerinden senkronlanır;
-- her call site'ı ayrı ayrı güncellemeye gerek yoktur.

CREATE TABLE IF NOT EXISTS public.employee_employment_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hire_date DATE NOT NULL,
    exit_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employment_periods_profile ON public.employee_employment_periods(profile_id, hire_date DESC);

ALTER TABLE public.employee_employment_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own org employment periods" ON public.employee_employment_periods
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_employment_periods.organization_id
              AND p.role = 'premium_corporate'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_employment_periods.organization_id
              AND p.role = 'premium_corporate'
        )
    );

-- Tek seferlik veri taşıma: mevcut employee_details satırlarındaki "şu anki
-- dönem"i ilk period kaydı olarak kopyala. NOT: Bu, bu değişiklikten önce
-- zaten bir kez çıkarılıp tekrar işe alınmış personellerin kaybolmuş İLK
-- dönem verisini geri getirmez — sadece şu an employee_details'te duran
-- güncel dönem bilinir hale gelir. Bundan sonraki her çıkış/tekrar-işe-alım
-- döngüsü artık doğru şekilde ayrı satırlar halinde birikir.
INSERT INTO public.employee_employment_periods (profile_id, organization_id, hire_date, exit_date)
SELECT profile_id, organization_id, hire_date, exit_date
FROM public.employee_details
WHERE hire_date IS NOT NULL
ON CONFLICT DO NOTHING;

-- employee_details.hire_date/exit_date değiştiğinde dönem kayıtlarını
-- otomatik senkronlar.
CREATE OR REPLACE FUNCTION public.trg_employee_employment_periods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open_period_id UUID;
BEGIN
  IF NEW.hire_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Çıkış: exit_date yeni set edildi/değişti -> açık dönemi kapat (yoksa oluştur)
  IF NEW.exit_date IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.exit_date IS DISTINCT FROM OLD.exit_date) THEN
    SELECT id INTO v_open_period_id
    FROM public.employee_employment_periods
    WHERE profile_id = NEW.profile_id AND exit_date IS NULL
    ORDER BY hire_date DESC LIMIT 1;

    IF v_open_period_id IS NOT NULL THEN
      UPDATE public.employee_employment_periods
      SET exit_date = NEW.exit_date, updated_at = NOW()
      WHERE id = v_open_period_id;
    ELSE
      INSERT INTO public.employee_employment_periods (profile_id, organization_id, hire_date, exit_date)
      VALUES (NEW.profile_id, NEW.organization_id, NEW.hire_date, NEW.exit_date);
    END IF;
    RETURN NEW;
  END IF;

  -- Geri alım: exit_date temizlendi
  IF NEW.exit_date IS NULL AND TG_OP = 'UPDATE' AND OLD.exit_date IS NOT NULL THEN
    IF NEW.hire_date IS NOT DISTINCT FROM OLD.hire_date THEN
      -- Aynı işe giriş tarihi: yanlışlıkla çıkarma düzeltmesi, en son dönemi yeniden aç
      UPDATE public.employee_employment_periods
      SET exit_date = NULL, updated_at = NOW()
      WHERE id = (
        SELECT id FROM public.employee_employment_periods
        WHERE profile_id = NEW.profile_id
        ORDER BY hire_date DESC LIMIT 1
      );
    ELSE
      -- Yeni bir işe giriş tarihi: gerçek (boşluklu) tekrar işe alım, yeni dönem aç
      -- (eski dönem zaten kapalı kalır, geçmiş olarak korunur)
      INSERT INTO public.employee_employment_periods (profile_id, organization_id, hire_date, exit_date)
      VALUES (NEW.profile_id, NEW.organization_id, NEW.hire_date, NULL);
    END IF;
    RETURN NEW;
  END IF;

  -- İlk işe giriş kaydı (henüz hiç dönem yok) ya da açık dönemdeyken
  -- hire_date düzeltmesi (yazım hatası düzeltme gibi)
  IF NEW.exit_date IS NULL THEN
    SELECT id INTO v_open_period_id
    FROM public.employee_employment_periods
    WHERE profile_id = NEW.profile_id AND exit_date IS NULL
    ORDER BY hire_date DESC LIMIT 1;

    IF v_open_period_id IS NULL THEN
      INSERT INTO public.employee_employment_periods (profile_id, organization_id, hire_date, exit_date)
      VALUES (NEW.profile_id, NEW.organization_id, NEW.hire_date, NULL);
    ELSIF NEW.hire_date IS DISTINCT FROM OLD.hire_date THEN
      UPDATE public.employee_employment_periods
      SET hire_date = NEW.hire_date, updated_at = NOW()
      WHERE id = v_open_period_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger adı bilerek "employee_details_periods_trigger" (mevcut
-- "employee_details_salary_trigger" ile aynı olaylarda tetiklenir).
-- Postgres aynı tablo/olay için birden fazla trigger'ı isim alfabetik
-- sırasına göre çalıştırır ("p" < "s"), bu yüzden dönem senkronu HER ZAMAN
-- maaş üretiminden önce çalışır — generate_missing_salary_expenses'in en
-- güncel dönem verisiyle çalışması bu sıralamaya bağlıdır.
DROP TRIGGER IF EXISTS employee_details_periods_trigger ON public.employee_details;
CREATE TRIGGER employee_details_periods_trigger
AFTER INSERT OR UPDATE OF hire_date, exit_date ON public.employee_details
FOR EACH ROW
EXECUTE FUNCTION public.trg_employee_employment_periods();
