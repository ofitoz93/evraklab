-- ==========================================================
-- REACTIVATE_DEPARTED_EMPLOYEE: gerçek (boşluklu) tekrar işe alım desteği
-- ==========================================================
-- Önceki sürüm hiçbir tarih sormadan personeli eski hire_date'iyle devam
-- ediyormuş gibi geri açıyordu: çıkış ile geri alım arasında gerçek bir
-- zaman boşluğu varsa, generate_missing_salary_expenses o boşluk ayları
-- için de (personel aslında çalışmıyorken) otomatik maaş gideri üretiyordu.
--
-- Artık isteğe bağlı p_rehire_date parametresi var:
-- - Verilmezse veya kayıtlı exit_date'e eşit/öncesindeyse: eski davranış
--   ("yanlışlıkla çıkarma" düzeltmesi) — hire_date'e dokunulmaz, sadece
--   exit_date temizlenir; add_employee_employment_periods.sql'deki trigger
--   bunu aynı dönemin yeniden açılması olarak işler.
-- - exit_date'ten SONRAKİ bir tarihse: gerçek boşluklu tekrar işe alım —
--   hire_date bu yeni tarihe güncellenir; trigger bunu YENİ bir çalışma
--   dönemi olarak kaydeder, eski dönem (hire_date/exit_date çifti) kalıcı
--   olarak korunur, aradaki boşluk aylarına maaş gideri üretilmez.
-- CREATE OR REPLACE bir Postgres fonksiyonunu farklı bir imzayla (parametre
-- sayısı değiştiği için) REPLACE etmez, yeni bir overload olarak ekler —
-- bu da eski 2 parametreli çağrıları belirsiz hale getirir. Önce eskisini
-- kaldırıyoruz.
DROP FUNCTION IF EXISTS public.reactivate_departed_employee(UUID, UUID);

CREATE OR REPLACE FUNCTION public.reactivate_departed_employee(
  p_profile_id UUID,
  p_org_id UUID,
  p_rehire_date DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_exit_date DATE;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
     OR COALESCE((SELECT organization_id FROM public.profiles WHERE id = auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid) != p_org_id
  THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok.';
  END IF;

  SELECT role_before_exit, exit_date INTO v_role, v_exit_date
  FROM public.employee_details
  WHERE profile_id = p_profile_id AND organization_id = p_org_id;

  UPDATE public.profiles
  SET organization_id = p_org_id, role = COALESCE(v_role, 'corporate_staff')
  WHERE id = p_profile_id;

  IF p_rehire_date IS NOT NULL AND v_exit_date IS NOT NULL AND p_rehire_date > v_exit_date THEN
    UPDATE public.employee_details
    SET hire_date = p_rehire_date, exit_date = NULL, role_before_exit = NULL, updated_at = NOW()
    WHERE profile_id = p_profile_id AND organization_id = p_org_id;
  ELSE
    UPDATE public.employee_details
    SET exit_date = NULL, role_before_exit = NULL, updated_at = NOW()
    WHERE profile_id = p_profile_id AND organization_id = p_org_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reactivate_departed_employee(UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_departed_employee(UUID, UUID, DATE) TO authenticated;
