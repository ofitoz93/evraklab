-- ==========================================================
-- HİZMET SONLANDIRMA (personel "Ayrılan Personeller" / exit_date
-- deseninin müşteri firmalara uyarlanmış hali)
-- ==========================================================
-- generate_missing_client_payments (add_consultant_client_service_periods.sql)
-- zaten SADECE "bu ayı kapsayan bir dönem var mı" mantığıyla çalışıyor - ayrı
-- bir exit_date/cap değişkenine gerek yok. Sonlandırma RPC'si aktif dönemin
-- end_date'ini sonlandırma tarihine kısaltınca, mevcut fonksiyon hiç
-- değişmeden "o tarihten sonra hiç ödeme üretme" davranışını zaten verir.
-- ==========================================================

ALTER TABLE public.consultant_clients ADD COLUMN IF NOT EXISTS service_terminated_at DATE;

CREATE OR REPLACE FUNCTION public.terminate_client_service(p_client_id UUID, p_org_id UUID, p_termination_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER RLS'i bypass ettiği için yetki kontrolü fonksiyon içinde yapılır.
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
     OR COALESCE((SELECT organization_id FROM public.profiles WHERE id = auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid) != p_org_id
  THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok.';
  END IF;

  UPDATE public.consultant_clients
  SET service_terminated_at = p_termination_date
  WHERE id = p_client_id AND consultant_company_id = p_org_id;

  -- Sonlandırma tarihini kapsayan dönemi kısalt (dönem ortasında sonlandırma)
  UPDATE public.consultant_client_service_periods
  SET end_date = p_termination_date + INTERVAL '1 day'
  WHERE client_id = p_client_id AND start_date <= p_termination_date AND end_date > p_termination_date;

  -- Sonlandırma tarihinden sonra başlayan (henüz gelmemiş) dönemler tamamen silinir
  DELETE FROM public.consultant_client_service_periods
  WHERE client_id = p_client_id AND start_date > p_termination_date;

  -- Sonlandırma öncesi (ör. önceki cron/trigger çalışmasıyla) zaten üretilmiş,
  -- henüz ödenmemiş gelecek ay alacak kayıtlarını temizle. Ödenmiş kayıtlara
  -- (is_paid=true) asla dokunulmaz.
  DELETE FROM public.client_payments
  WHERE client_id = p_client_id AND is_paid = false
    AND make_date(year, month, 1) >= date_trunc('month', p_termination_date) + INTERVAL '1 month';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.terminate_client_service(UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.terminate_client_service(UUID, UUID, DATE) TO authenticated;
