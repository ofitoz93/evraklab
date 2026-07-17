-- ==========================================================
-- AYRILAN PERSONELİ GERİ AL (yanlışlıkla çıkarma düzeltmesi)
-- ==========================================================
-- kick_employee_with_exit_date, personelin rolünü 'normal'a çevirip
-- organization_id'yi null'luyordu - önceki rol (ör. corporate_chief)
-- hiçbir yerde saklanmıyordu, bu yüzden geri almak mümkün değildi.
-- Şimdi çıkarılırken employee_details.role_before_exit'e kaydediliyor,
-- reactivate_departed_employee bunu geri yükleyip org'a tekrar bağlıyor.

ALTER TABLE public.employee_details ADD COLUMN IF NOT EXISTS role_before_exit TEXT;

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
DECLARE
  v_prior_role TEXT;
BEGIN
  SELECT role INTO v_prior_role FROM public.profiles WHERE id = p_profile_id;

  UPDATE public.profiles
  SET organization_id = NULL, role = 'normal'
  WHERE id = p_profile_id;

  INSERT INTO public.employee_details (profile_id, organization_id, exit_date, role_before_exit, updated_at)
  VALUES (p_profile_id, p_org_id, p_exit_date, v_prior_role, NOW())
  ON CONFLICT (profile_id) DO UPDATE SET exit_date = p_exit_date, role_before_exit = v_prior_role, updated_at = NOW();

  DELETE FROM public.company_expenses
  WHERE employee_id = p_profile_id
    AND is_auto_salary = TRUE
    AND expense_date >= (date_trunc('month', p_exit_date) + INTERVAL '1 month');
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_departed_employee(p_profile_id UUID, p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
     OR COALESCE((SELECT organization_id FROM public.profiles WHERE id = auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid) != p_org_id
  THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok.';
  END IF;

  SELECT role_before_exit INTO v_role
  FROM public.employee_details
  WHERE profile_id = p_profile_id AND organization_id = p_org_id;

  UPDATE public.profiles
  SET organization_id = p_org_id, role = COALESCE(v_role, 'corporate_staff')
  WHERE id = p_profile_id;

  UPDATE public.employee_details
  SET exit_date = NULL, role_before_exit = NULL, updated_at = NOW()
  WHERE profile_id = p_profile_id AND organization_id = p_org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reactivate_departed_employee(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_departed_employee(UUID, UUID) TO authenticated;
