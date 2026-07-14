-- ==========================================================
-- EVRAKLAB PERSONEL ÇIKIŞ TARİHİ + OTOMATİK AYLIK MAAŞ GİDERİ
-- ==========================================================
-- - employee_details.exit_date: "Çıkar" işleminde yazılır; aynı personel
--   yeniden işe alınırsa hire_date güncellenip exit_date temizlenir.
-- - company_expenses.is_auto_salary: otomatik üretilen maaş satırlarını
--   elle girilenlerden ayırır ve tekrar üretimi engeller (idempotent).
-- - generate_missing_salary_expenses: bir personelin işe giriş ayından,
--   son TAMAMLANMIŞ aya kadar (içinde bulunulan ay hariç) eksik maaş
--   giderlerini otomatik oluşturur. hire_date/monthly_salary/exit_date
--   her değiştiğinde (trigger) VE her ayın 1'inde (pg_cron) çalışır.

-- 1. Çıkış tarihi kolonu
ALTER TABLE public.employee_details
ADD COLUMN IF NOT EXISTS exit_date DATE;

-- 2. Otomatik üretilen maaş giderlerini işaretlemek için
ALTER TABLE public.company_expenses
ADD COLUMN IF NOT EXISTS is_auto_salary BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Eksik ayların maaş giderini üretir (idempotent)
CREATE OR REPLACE FUNCTION public.generate_missing_salary_expenses(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hire_date DATE;
  v_monthly_salary NUMERIC(15,2);
  v_exit_date DATE;
  v_org_id UUID;
  v_cursor DATE;
  v_last_month DATE;
  v_exists BOOLEAN;
BEGIN
  SELECT hire_date, monthly_salary, exit_date, organization_id
    INTO v_hire_date, v_monthly_salary, v_exit_date, v_org_id
  FROM public.employee_details
  WHERE profile_id = p_profile_id;

  IF v_hire_date IS NULL OR v_monthly_salary IS NULL OR v_monthly_salary <= 0 THEN
    RETURN;
  END IF;

  -- Son tamamlanmış ay (içinde bulunulan ay asla üretilmez)
  v_last_month := date_trunc('month', CURRENT_DATE) - INTERVAL '1 month';
  IF v_exit_date IS NOT NULL AND date_trunc('month', v_exit_date) < v_last_month THEN
    v_last_month := date_trunc('month', v_exit_date);
  END IF;

  v_cursor := date_trunc('month', v_hire_date);

  WHILE v_cursor <= v_last_month LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.company_expenses
      WHERE employee_id = p_profile_id
        AND is_auto_salary = TRUE
        AND date_trunc('month', expense_date) = v_cursor
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO public.company_expenses (
        consultant_company_id, title, category, amount, expense_date, employee_id, is_auto_salary
      ) VALUES (
        v_org_id,
        'Maaş - ' || to_char(v_cursor, 'MM.YYYY'),
        'Maaş/Personel',
        v_monthly_salary,
        v_cursor::date,
        p_profile_id,
        TRUE
      );
    END IF;

    v_cursor := v_cursor + INTERVAL '1 month';
  END LOOP;
END;
$$;

-- 4. employee_details değiştiğinde otomatik tetikleyici (geriye dönük doldurma)
CREATE OR REPLACE FUNCTION public.trg_employee_details_salary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.generate_missing_salary_expenses(NEW.profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_details_salary_trigger ON public.employee_details;
CREATE TRIGGER employee_details_salary_trigger
AFTER INSERT OR UPDATE OF hire_date, monthly_salary, exit_date ON public.employee_details
FOR EACH ROW
EXECUTE FUNCTION public.trg_employee_details_salary();

-- 5. Ayın 1'inde tüm personel için toplu üretim (pg_cron)
CREATE OR REPLACE FUNCTION public.run_monthly_salary_generation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT profile_id FROM public.employee_details LOOP
    PERFORM public.generate_missing_salary_expenses(r.profile_id);
  END LOOP;
END;
$$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'monthly-salary-generation';

SELECT cron.schedule(
  'monthly-salary-generation',
  '0 2 1 * *',
  $$SELECT public.run_monthly_salary_generation();$$
);
