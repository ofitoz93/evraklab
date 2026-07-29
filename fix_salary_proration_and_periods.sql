-- ==========================================================
-- KIST (GÜNLÜK ORANLI) MAAŞ HESABI + DÖNEM-BAZLI ÜRETİM
-- ==========================================================
-- generate_missing_salary_expenses artık employee_details.hire_date/
-- exit_date'ten TEK bir sürekli aralık varsaymak yerine, bu personelin
-- employee_employment_periods'taki HER dönemini (bkz.
-- add_employee_employment_periods.sql) ayrı ayrı ay ay dolaşır:
-- - Bir dönemin İLK ayı, işe giriş gününden ay sonuna kadar kıst hesaplanır.
-- - Bir dönemin SON ayı (çıkış varsa), ay başından çıkış gününe kadar kıst
--   hesaplanır.
-- - Aradaki tam aylar (ve tam ay olan tek-aylık dönemler) değişmez.
-- - İki dönem arasındaki boşluk aylarına (personel fiilen çalışmıyorken)
--   hiç satır üretilmez; daha önce yanlışlıkla üretilmiş olabilecek boşluk
--   ayı satırları fonksiyon sonunda temizlenir.
CREATE OR REPLACE FUNCTION public.generate_missing_salary_expenses(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_last_completed_month DATE;
  v_has_periods BOOLEAN;
  v_period RECORD;
  v_cursor DATE;
  v_period_last_month DATE;
  v_rate NUMERIC(15,2);
  v_existing_id UUID;
  v_existing_amount NUMERIC(15,2);
  v_existing_title TEXT;
  v_days_in_month INT;
  v_start_day INT;
  v_end_day INT;
  v_worked_days INT;
  v_amount NUMERIC(15,2);
  v_title TEXT;
  v_covered_months DATE[] := ARRAY[]::DATE[];
BEGIN
  SELECT organization_id INTO v_org_id FROM public.employee_details WHERE profile_id = p_profile_id;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.employee_employment_periods WHERE profile_id = p_profile_id
  ) INTO v_has_periods;

  IF NOT v_has_periods THEN
    RETURN;
  END IF;

  -- Son tamamlanmış ay (içinde bulunulan ay asla üretilmez)
  v_last_completed_month := date_trunc('month', CURRENT_DATE) - INTERVAL '1 month';

  FOR v_period IN
    SELECT hire_date, exit_date
    FROM public.employee_employment_periods
    WHERE profile_id = p_profile_id
    ORDER BY hire_date ASC
  LOOP
    v_period_last_month := v_last_completed_month;
    IF v_period.exit_date IS NOT NULL AND date_trunc('month', v_period.exit_date) < v_period_last_month THEN
      v_period_last_month := date_trunc('month', v_period.exit_date);
    END IF;

    v_cursor := date_trunc('month', v_period.hire_date);

    WHILE v_cursor <= v_period_last_month LOOP
      SELECT monthly_salary INTO v_rate
      FROM public.employee_salary_history
      WHERE profile_id = p_profile_id AND effective_date <= v_cursor
      ORDER BY effective_date DESC
      LIMIT 1;

      IF v_rate IS NOT NULL THEN
        v_days_in_month := EXTRACT(DAY FROM (v_cursor + INTERVAL '1 month' - INTERVAL '1 day'))::INT;

        v_start_day := 1;
        IF v_cursor = date_trunc('month', v_period.hire_date) THEN
          v_start_day := EXTRACT(DAY FROM v_period.hire_date)::INT;
        END IF;

        v_end_day := v_days_in_month;
        IF v_period.exit_date IS NOT NULL AND v_cursor = date_trunc('month', v_period.exit_date) THEN
          v_end_day := EXTRACT(DAY FROM v_period.exit_date)::INT;
        END IF;

        v_worked_days := v_end_day - v_start_day + 1;
        v_amount := ROUND(v_rate * v_worked_days / v_days_in_month, 2);

        v_title := 'Maaş - ' || to_char(v_cursor, 'MM.YYYY');
        IF v_worked_days < v_days_in_month THEN
          v_title := v_title || ' (kısmi ay, ' || v_worked_days || ' gün)';
        END IF;

        v_covered_months := array_append(v_covered_months, v_cursor);

        SELECT id, amount, title INTO v_existing_id, v_existing_amount, v_existing_title
        FROM public.company_expenses
        WHERE employee_id = p_profile_id
          AND is_auto_salary = TRUE
          AND date_trunc('month', expense_date) = v_cursor;

        IF v_existing_id IS NULL THEN
          INSERT INTO public.company_expenses (
            consultant_company_id, title, category, amount, expense_date, employee_id, is_auto_salary
          ) VALUES (
            v_org_id, v_title, 'Maaş/Personel', v_amount, v_cursor::date, p_profile_id, TRUE
          );
        ELSIF v_existing_amount IS DISTINCT FROM v_amount OR v_existing_title IS DISTINCT FROM v_title THEN
          UPDATE public.company_expenses SET amount = v_amount, title = v_title WHERE id = v_existing_id;
        END IF;
      END IF;

      v_cursor := v_cursor + INTERVAL '1 month';
    END LOOP;
  END LOOP;

  -- Boşluk ay temizliği: hiçbir dönemin kapsamadığı bir aya ait otomatik
  -- maaş satırı varsa (iki dönem arasındaki boşluk, ya da bu düzeltmeden
  -- önce yanlışlıkla üretilmiş bir satır) sil.
  DELETE FROM public.company_expenses
  WHERE employee_id = p_profile_id
    AND is_auto_salary = TRUE
    AND NOT (date_trunc('month', expense_date)::date = ANY (v_covered_months));
END;
$$;

-- Geriye dönük öz-düzeltme: mevcut tüm personel için bir kez çalıştırılıp,
-- hâlihazırda tam ay üretilmiş ama artık kısmi olması gereken satırları
-- (örn. zaten ayrılmış personelin çıkış ayı) otomatik olarak kıst tutara
-- günceller. Bu değişiklikten ÖNCE zaten çıkarılıp tekrar işe alınmış
-- personellerin kaybolmuş İLK dönem verisini geri getirmez (bkz.
-- add_employee_employment_periods.sql'deki tek seferlik veri taşıma notu)
-- — sadece employee_details'te hâlâ doğru duran güncel dönem/exit_date
-- bilgisine sahip kayıtları düzeltir.
SELECT public.run_monthly_salary_generation();
