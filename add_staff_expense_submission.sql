-- ==========================================================
-- PERSONEL/ŞEF GİDER EKLEME
-- ==========================================================
-- Danışman personeli (corporate_staff) ve şefler (corporate_chief) bugüne
-- kadar Finans modülüne hiç erişemiyordu (canViewFinance sadece
-- premium_corporate/admin/system_admin). Artık kendi harcadıkları/ödedikleri
-- giderleri (dekont/fiş yükleyerek) girebilecekleri dar kapsamlı, sadece
-- "gider ekle" işlevi gören bir sayfa açılıyor - girdikleri gider normal
-- company_expenses akışına (Finansal Özet dahil) otomatik dahil olur.

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('sirket_karti', 'sirket_sahsi', 'kisisel_odeme')),
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- corporate_chief zaten create_finance_tables.sql'deki "Manage expenses
-- policy" ile tam erişime sahip (FOR ALL) - burada sadece corporate_staff
-- için, ve SADECE KENDİ gönderdikleriyle sınırlı, iki dar policy eklenir.
DROP POLICY IF EXISTS "Staff insert own expenses" ON public.company_expenses;
CREATE POLICY "Staff insert own expenses" ON public.company_expenses
  FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND auth.uid() IN (
      SELECT p.id FROM public.profiles p
      WHERE p.organization_id = consultant_company_id AND p.role = 'corporate_staff'
    )
  );

DROP POLICY IF EXISTS "Staff view own submitted expenses" ON public.company_expenses;
CREATE POLICY "Staff view own submitted expenses" ON public.company_expenses
  FOR SELECT
  USING (
    submitted_by = auth.uid()
    AND auth.uid() IN (
      SELECT p.id FROM public.profiles p
      WHERE p.organization_id = consultant_company_id AND p.role = 'corporate_staff'
    )
  );
