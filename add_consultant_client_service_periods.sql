-- ==========================================================
-- HİZMET DÖNEMİ (SÖZLEŞME YENİLEME) + YIL BAZLI ÜCRET GEÇMİŞİ
-- ==========================================================
-- consultant_clients.monthly_fee tek, geçmişsiz bir sütundu; artık ücret
-- "şu tarihten şu tarihe kadar şu kadar" dönem satırları halinde tutuluyor.
-- Aynı desen employee_salary_history + generate_missing_salary_expenses'in
-- (add_employee_salary_history.sql) müşteri hizmet ücretine uyarlanmış hali:
-- dönemler ARDIŞIK tutulur (yeni dönem her zaman bir öncekinin end_date'inin
-- ertesi günü başlar), "hangi ay hangi ücrete tabi" basit bir aralık
-- eşleşmesiyle bulunur ve bu otomatik olarak client_payments'a (alacaklar)
-- yansır — geçmiş dönemler kendi tarihindeki ücretle sabit kalır.

CREATE TABLE IF NOT EXISTS public.consultant_client_service_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.consultant_clients(id) ON DELETE CASCADE,
  consultant_company_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_fee NUMERIC(15,2) NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date > start_date),
  UNIQUE (client_id, start_date)
);

ALTER TABLE public.consultant_client_service_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage service periods policy" ON public.consultant_client_service_periods;
DROP POLICY IF EXISTS "Client view own service periods" ON public.consultant_client_service_periods;

-- create_finance_tables.sql'deki client_payments/company_expenses ile birebir
-- aynı rol listesi - bu tablo da finans modülünün bir parçası.
CREATE POLICY "Manage service periods policy" ON public.consultant_client_service_periods
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = consultant_company_id
              AND p.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
        )
    );

-- Müşteri kendi dönem geçmişini görebilsin (ClientPanel.tsx'teki sözleşme
-- durumu / erişim kilidi hesaplaması için gerekli, salt-okunur).
CREATE POLICY "Client view own service periods" ON public.consultant_client_service_periods
    FOR SELECT USING (
        client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_service_periods_client ON public.consultant_client_service_periods(client_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_service_periods_org ON public.consultant_client_service_periods(consultant_company_id);

-- ----------------------------------------------------------
-- generate_missing_client_payments: generate_missing_salary_expenses'in
-- eşdeğeri. İlk dönemin başlangıcından tamamlanmış son aya kadar (cari ay
-- hariç) ay ay gezer, o ayı kapsayan dönemin ücretini bulur, client_payments'ta
-- eksikse ekler, varsa VE ÖDENMEMİŞSE VE tutar farklıysa düzeltir. Ödenmiş
-- (is_paid=true) satırlara ASLA dokunmaz.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_missing_client_payments(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_first_start DATE;
  v_cursor DATE;
  v_last_month DATE;
  v_rate NUMERIC(15,2);
  v_existing_id UUID;
  v_existing_amount NUMERIC(15,2);
  v_existing_paid BOOLEAN;
BEGIN
  SELECT consultant_company_id, MIN(start_date) INTO v_org_id, v_first_start
  FROM public.consultant_client_service_periods
  WHERE client_id = p_client_id
  GROUP BY consultant_company_id;

  IF v_first_start IS NULL THEN
    RETURN;
  END IF;

  v_last_month := date_trunc('month', CURRENT_DATE) - INTERVAL '1 month';
  v_cursor := date_trunc('month', v_first_start);

  WHILE v_cursor <= v_last_month LOOP
    SELECT monthly_fee INTO v_rate
    FROM public.consultant_client_service_periods
    WHERE client_id = p_client_id AND start_date <= v_cursor AND end_date > v_cursor
    ORDER BY start_date DESC
    LIMIT 1;

    IF v_rate IS NOT NULL THEN
      SELECT id, amount, is_paid INTO v_existing_id, v_existing_amount, v_existing_paid
      FROM public.client_payments
      WHERE client_id = p_client_id
        AND year = EXTRACT(YEAR FROM v_cursor)::int
        AND month = EXTRACT(MONTH FROM v_cursor)::int;

      IF v_existing_id IS NULL THEN
        INSERT INTO public.client_payments (client_id, consultant_company_id, year, month, amount, is_paid)
        VALUES (p_client_id, v_org_id, EXTRACT(YEAR FROM v_cursor)::int, EXTRACT(MONTH FROM v_cursor)::int, v_rate, FALSE);
      ELSIF NOT v_existing_paid AND v_existing_amount IS DISTINCT FROM v_rate THEN
        UPDATE public.client_payments SET amount = v_rate WHERE id = v_existing_id;
      END IF;
    END IF;

    v_cursor := v_cursor + INTERVAL '1 month';
  END LOOP;
END;
$$;

-- Dönem eklendiğinde/değiştiğinde: consultant_clients.monthly_fee'yi (geriye
-- dönük uyumluluk için - Excel export, kart görünümü gibi eski okuma
-- noktaları değişmeden çalışsın diye) en güncel dönemin ücretiyle senkron
-- tutar, ve eksik/kaymış client_payments satırlarını üretir.
CREATE OR REPLACE FUNCTION public.trg_consultant_client_service_periods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.consultant_clients
  SET monthly_fee = (
    SELECT monthly_fee FROM public.consultant_client_service_periods
    WHERE client_id = NEW.client_id
    ORDER BY start_date DESC
    LIMIT 1
  )
  WHERE id = NEW.client_id;

  PERFORM public.generate_missing_client_payments(NEW.client_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consultant_client_service_periods_trigger ON public.consultant_client_service_periods;
CREATE TRIGGER consultant_client_service_periods_trigger
AFTER INSERT OR UPDATE OF monthly_fee, start_date, end_date ON public.consultant_client_service_periods
FOR EACH ROW
EXECUTE FUNCTION public.trg_consultant_client_service_periods();

-- Ayın 1'inde tüm müşteriler için toplu üretim (pg_cron) - dönemler
-- değişmese bile her ay geçtikçe yeni ayın alacak satırı otomatik açılsın.
CREATE OR REPLACE FUNCTION public.run_monthly_client_payment_generation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT client_id FROM public.consultant_client_service_periods LOOP
    PERFORM public.generate_missing_client_payments(r.client_id);
  END LOOP;
END;
$$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'monthly-client-payment-generation';
SELECT cron.schedule(
  'monthly-client-payment-generation',
  '0 3 1 * *',
  $$SELECT public.run_monthly_client_payment_generation();$$
);

-- ----------------------------------------------------------
-- Tek seferlik veri taşıma: mevcut consultant_clients.service_start_date +
-- monthly_fee değerlerini, o firmanın ilk (ve şu ana kadar tek bilinen)
-- dönemi olarak kopyala. Bu, sistemin bugün gösterdiği davranışla birebir
-- aynıdır (yenileme hiç yoktu, süresi geçen firma sonsuza dek "Süresi Geçti"
-- görünüyordu) - gerçek çok-yıllı geçmişi olan firmalar için personel
-- "Hizmet Yenile" ile gerçek durumu yakalayana kadar böyle kalır.
-- ----------------------------------------------------------
INSERT INTO public.consultant_client_service_periods (client_id, consultant_company_id, start_date, end_date, monthly_fee)
SELECT id, consultant_company_id, service_start_date, service_start_date + INTERVAL '1 year', COALESCE(monthly_fee, 0)
FROM public.consultant_clients
WHERE service_start_date IS NOT NULL
ON CONFLICT (client_id, start_date) DO NOTHING;
