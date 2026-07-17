-- ==========================================================
-- Bu fonksiyonlar sadece trigger/cron içinden çağrılmak üzere tasarlandı;
-- SECURITY DEFINER olmaları PostgREST'in bunları anon/authenticated için
-- /rest/v1/rpc/... uç noktası olarak dışa açmasına neden oluyor (Supabase
-- güvenlik danışmanı: anon/authenticated_security_definer_function_executable).
-- generate_missing_client_payments keyfi bir client_id kabul ettiğinden, dış
-- çağrıya açık kalması başka bir organizasyonun client_payments/monthly_fee
-- verisini manipüle etmeye izin verirdi. EXECUTE'u genel kullanıcılardan
-- kaldırmak trigger/cron'un iç çalışmasını etkilemez (onlar bu izin
-- kontrolünün dışındadır).
-- ==========================================================

REVOKE EXECUTE ON FUNCTION public.generate_missing_client_payments(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_consultant_client_service_periods() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_monthly_client_payment_generation() FROM PUBLIC, anon, authenticated;
