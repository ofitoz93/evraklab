-- ==========================================================
-- EVRAKLAB PERSONEL ÇIKARMA (geçmişe dönük çıkış tarihi destekli)
-- ==========================================================
-- Hem Ekip Yönetimi satırındaki hızlı "İşten Çıkar" ikonu hem de
-- Personel Kartı'ndaki "Şirketten Çıkar" butonu bu tek RPC'yi çağırır.
-- Çıkış tarihi geçmişe çekilebildiği için (personel aslında daha önce
-- ayrılmış olabilir), o tarihten sonraki aylar için zaten üretilmiş
-- olabilecek otomatik maaş giderlerini de temizler.
CREATE OR REPLACE FUNCTION public.kick_employee_with_exit_date(
  p_profile_id UUID,
  p_org_id UUID,
  p_exit_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET organization_id = NULL, role = 'normal'
  WHERE id = p_profile_id;

  INSERT INTO public.employee_details (profile_id, organization_id, exit_date, updated_at)
  VALUES (p_profile_id, p_org_id, p_exit_date, NOW())
  ON CONFLICT (profile_id) DO UPDATE SET exit_date = p_exit_date, updated_at = NOW();

  DELETE FROM public.company_expenses
  WHERE employee_id = p_profile_id
    AND is_auto_salary = TRUE
    AND expense_date >= (date_trunc('month', p_exit_date) + INTERVAL '1 month');
END;
$$;
