-- ==========================================================
-- GÜVENLİK DÜZELTMESİ: kick_employee_with_exit_date hiçbir yetki kontrolü
-- yapmıyordu ve `anon` rolüne (oturum açmamış herkes) açıktı. SECURITY
-- DEFINER olduğu için bu, kimlik doğrulaması olmadan herhangi bir
-- organizasyondan herhangi bir personeli çıkarmaya izin veren gerçek bir
-- açıktı (Supabase güvenlik danışmanı: anon_security_definer_function_
-- executable). terminate_client_service/reactivate_departed_employee'de
-- kullanılan aynı iç yetki kontrolü (rol + organizasyon eşleşmesi) eklenir.
-- ==========================================================

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
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
     OR COALESCE((SELECT organization_id FROM public.profiles WHERE id = auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid) != p_org_id
  THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok.';
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.kick_employee_with_exit_date(UUID, UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kick_employee_with_exit_date(UUID, UUID, DATE) TO authenticated;
