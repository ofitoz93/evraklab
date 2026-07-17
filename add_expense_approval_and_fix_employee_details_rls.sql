-- ==========================================================
-- GİDER ONAY SİSTEMİ + employee_details RLS DÜZELTMESİ
-- ==========================================================
-- 1) Personel kendi eklediği (henüz onaylanmamış) bir gideri silebilsin,
--    ama yönetici onayladıktan sonra artık silemesin.
-- 2) employee_details SELECT policy'si sadece premium_corporate'a izin
--    veriyordu (admin/system_admin dahil değildi) - bu yüzden Finansal
--    Özet'te ayrılan personelin adı bazı hesap türlerinde sessizce
--    "Bilinmeyen Personel" olarak kalıyordu (fetchDepartedEmployees RLS
--    tarafından engellenip boş dönüyordu, hata da kullanıcıya gösterilmiyordu).
-- ==========================================================

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Staff delete own unapproved expenses" ON public.company_expenses;
CREATE POLICY "Staff delete own unapproved expenses" ON public.company_expenses
  FOR DELETE
  USING (
    submitted_by = auth.uid()
    AND approved_at IS NULL
    AND auth.uid() IN (
      SELECT p.id FROM public.profiles p
      WHERE p.organization_id = consultant_company_id AND p.role = 'corporate_staff'
    )
  );

-- employee_details: canViewFinance ile aynı rol seti (premium_corporate +
-- admin/system_admin) SELECT/yönetim yapabilsin. Şefler (corporate_chief)
-- ve personel (corporate_staff) kasıtlı olarak dışarıda bırakılmaya devam
-- ediyor - bu tablo hassas maaş/HR verisi içeriyor.
DROP POLICY IF EXISTS "Owner manages own org employee details" ON public.employee_details;
CREATE POLICY "Owner manages own org employee details" ON public.employee_details
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_details.organization_id
              AND p.role IN ('premium_corporate', 'admin', 'system_admin')
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_details.organization_id
              AND p.role IN ('premium_corporate', 'admin', 'system_admin')
        )
    );
