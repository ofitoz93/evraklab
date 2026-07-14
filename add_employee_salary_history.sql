-- ==========================================================
-- EVRAKLAB PERSONEL MAAŞ GEÇMİŞİ (tarih-etkili maaş/zam kayıtları)
-- ==========================================================
-- employee_details.monthly_salary tek bir sabit değerdi; artık maaş
-- "şu tarihten itibaren şu kadar" satırları halinde tutuluyor. Bir ay
-- için geçerli tutar, o aya <= olan en güncel effective_date satırıdır.
-- Böylece hem "yıl boyunca sabit maaş" hem de "yıl içinde belirli bir
-- aydan itibaren zam, geçmişte zaten üretilmiş giderleri de düzeltir"
-- davranışı aynı tabloyla/aynı üretim fonksiyonuyla sağlanır.

CREATE TABLE IF NOT EXISTS public.employee_salary_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    monthly_salary NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (profile_id, effective_date)
);

ALTER TABLE public.employee_salary_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own org employee salary history" ON public.employee_salary_history
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_salary_history.organization_id
              AND p.role = 'premium_corporate'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_salary_history.organization_id
              AND p.role = 'premium_corporate'
        )
    );

-- Tek seferlik veri taşıma: mevcut employee_details.monthly_salary
-- değerlerini, işe giriş ayından itibaren geçerli ilk maaş geçmişi
-- satırı olarak kopyala (otomasyon kesintisiz devam etsin).
INSERT INTO public.employee_salary_history (profile_id, organization_id, effective_date, monthly_salary)
SELECT profile_id, organization_id, date_trunc('month', hire_date)::date, monthly_salary
FROM public.employee_details
WHERE monthly_salary IS NOT NULL AND monthly_salary > 0 AND hire_date IS NOT NULL
ON CONFLICT (profile_id, effective_date) DO NOTHING;

-- generate_missing_salary_expenses: artık employee_details.monthly_salary
-- yerine, her ay için employee_salary_history'den o aya uygulanabilir en
-- güncel satırı okur; zaten üretilmiş bir ay varsa ve tutar farklıysa
-- UPDATE eder (geçmişe dönük zam düzeltmesi), yoksa INSERT eder.
CREATE OR REPLACE FUNCTION public.generate_missing_salary_expenses(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hire_date DATE;
  v_exit_date DATE;
  v_org_id UUID;
  v_cursor DATE;
  v_last_month DATE;
  v_rate NUMERIC(15,2);
  v_existing_id UUID;
  v_existing_amount NUMERIC(15,2);
BEGIN
  SELECT hire_date, exit_date, organization_id
    INTO v_hire_date, v_exit_date, v_org_id
  FROM public.employee_details
  WHERE profile_id = p_profile_id;

  IF v_hire_date IS NULL THEN
    RETURN;
  END IF;

  v_last_month := date_trunc('month', CURRENT_DATE) - INTERVAL '1 month';
  IF v_exit_date IS NOT NULL AND date_trunc('month', v_exit_date) < v_last_month THEN
    v_last_month := date_trunc('month', v_exit_date);
  END IF;

  v_cursor := date_trunc('month', v_hire_date);

  WHILE v_cursor <= v_last_month LOOP
    SELECT monthly_salary INTO v_rate
    FROM public.employee_salary_history
    WHERE profile_id = p_profile_id AND effective_date <= v_cursor
    ORDER BY effective_date DESC
    LIMIT 1;

    IF v_rate IS NOT NULL THEN
      SELECT id, amount INTO v_existing_id, v_existing_amount
      FROM public.company_expenses
      WHERE employee_id = p_profile_id
        AND is_auto_salary = TRUE
        AND date_trunc('month', expense_date) = v_cursor;

      IF v_existing_id IS NULL THEN
        INSERT INTO public.company_expenses (
          consultant_company_id, title, category, amount, expense_date, employee_id, is_auto_salary
        ) VALUES (
          v_org_id,
          'Maaş - ' || to_char(v_cursor, 'MM.YYYY'),
          'Maaş/Personel',
          v_rate,
          v_cursor::date,
          p_profile_id,
          TRUE
        );
      ELSIF v_existing_amount IS DISTINCT FROM v_rate THEN
        UPDATE public.company_expenses SET amount = v_rate WHERE id = v_existing_id;
      END IF;
    END IF;

    v_cursor := v_cursor + INTERVAL '1 month';
  END LOOP;
END;
$$;

-- employee_details tetikleyicisi artık sadece hire_date/exit_date için
-- (maaş artık bu tabloda değişmiyor).
DROP TRIGGER IF EXISTS employee_details_salary_trigger ON public.employee_details;
CREATE TRIGGER employee_details_salary_trigger
AFTER INSERT OR UPDATE OF hire_date, exit_date ON public.employee_details
FOR EACH ROW
EXECUTE FUNCTION public.trg_employee_details_salary();

-- Yeni: employee_salary_history değiştiğinde (yeni maaş/zam girildiğinde)
-- otomatik yeniden üret/düzelt.
CREATE OR REPLACE FUNCTION public.trg_employee_salary_history()
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

DROP TRIGGER IF EXISTS employee_salary_history_trigger ON public.employee_salary_history;
CREATE TRIGGER employee_salary_history_trigger
AFTER INSERT OR UPDATE OF monthly_salary ON public.employee_salary_history
FOR EACH ROW
EXECUTE FUNCTION public.trg_employee_salary_history();
