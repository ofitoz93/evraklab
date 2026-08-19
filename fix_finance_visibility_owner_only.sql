-- "Finansal Özet", "Müşteri Ödemeleri" ve "Gider Yönetimi" (firmanın TÜM
-- finans verisini gösteren sekmeler) artık sadece firma sahibi
-- (premium_corporate) ve admin/system_admin için görünür — şef
-- (corporate_chief) ve personel (corporate_staff) bu verileri göremez,
-- onlar için sadece "Gider Ekle" (kendi gönderdikleri giderler) kalır.
-- ConsultantPanel.tsx tarafında bu zaten UI seviyesinde kapatıldı; burada
-- aynı kısıtlamayı veritabanı seviyesinde (RLS) de uyguluyoruz ki
-- sınırlama sadece arayüzde değil, gerçek veri erişiminde de geçerli olsun.

-- client_payments: "Manage payments policy" artık corporate_chief'i
-- KAPSAMIYOR (önceden kapsıyordu).
DROP POLICY IF EXISTS "Manage payments policy" ON public.client_payments;
CREATE POLICY "Manage payments policy"
ON public.client_payments FOR ALL
TO public
USING (
  auth.uid() IN (
    SELECT p.id FROM public.profiles p
    WHERE p.organization_id = client_payments.consultant_company_id
      AND p.role IN ('premium_corporate', 'admin', 'system_admin')
  )
);

-- company_expenses: "Manage expenses policy" artık corporate_chief'i
-- KAPSAMIYOR. Şef, kendi gönderdiği giderleri "Staff ..." politikalarıyla
-- (aşağıda corporate_staff'a ek olarak corporate_chief de eklendi) hâlâ
-- ekleyip/görüp/silebilir — sadece TÜM firma giderlerini görme/onaylama
-- yetkisi kaldırıldı.
DROP POLICY IF EXISTS "Manage expenses policy" ON public.company_expenses;
CREATE POLICY "Manage expenses policy"
ON public.company_expenses FOR ALL
TO public
USING (
  auth.uid() IN (
    SELECT p.id FROM public.profiles p
    WHERE p.organization_id = company_expenses.consultant_company_id
      AND p.role IN ('premium_corporate', 'admin', 'system_admin')
  )
);

DROP POLICY IF EXISTS "Staff insert own expenses" ON public.company_expenses;
CREATE POLICY "Staff insert own expenses"
ON public.company_expenses FOR INSERT
TO public
WITH CHECK (
  submitted_by = auth.uid()
  AND auth.uid() IN (
    SELECT p.id FROM public.profiles p
    WHERE p.organization_id = company_expenses.consultant_company_id
      AND p.role IN ('corporate_staff', 'corporate_chief')
  )
);

DROP POLICY IF EXISTS "Staff view own submitted expenses" ON public.company_expenses;
CREATE POLICY "Staff view own submitted expenses"
ON public.company_expenses FOR SELECT
TO public
USING (
  submitted_by = auth.uid()
  AND auth.uid() IN (
    SELECT p.id FROM public.profiles p
    WHERE p.organization_id = company_expenses.consultant_company_id
      AND p.role IN ('corporate_staff', 'corporate_chief')
  )
);

DROP POLICY IF EXISTS "Staff delete own unapproved expenses" ON public.company_expenses;
CREATE POLICY "Staff delete own unapproved expenses"
ON public.company_expenses FOR DELETE
TO public
USING (
  submitted_by = auth.uid()
  AND approved_at IS NULL
  AND auth.uid() IN (
    SELECT p.id FROM public.profiles p
    WHERE p.organization_id = company_expenses.consultant_company_id
      AND p.role IN ('corporate_staff', 'corporate_chief')
  )
);
