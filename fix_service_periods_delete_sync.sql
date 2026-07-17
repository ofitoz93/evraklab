-- ==========================================================
-- consultant_clients.monthly_fee senkron tetikleyicisi sadece INSERT/UPDATE'te
-- çalışıyordu; bir dönem satırı silinirse (ör. yanlış girilen bir yenileme
-- düzeltilirken) monthly_fee bayatlıyordu. AFTER DELETE de eklenir.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.trg_consultant_client_service_periods_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.consultant_clients
  SET monthly_fee = COALESCE((
    SELECT monthly_fee FROM public.consultant_client_service_periods
    WHERE client_id = OLD.client_id
    ORDER BY start_date DESC
    LIMIT 1
  ), 0)
  WHERE id = OLD.client_id;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_consultant_client_service_periods_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS consultant_client_service_periods_delete_trigger ON public.consultant_client_service_periods;
CREATE TRIGGER consultant_client_service_periods_delete_trigger
AFTER DELETE ON public.consultant_client_service_periods
FOR EACH ROW
EXECUTE FUNCTION public.trg_consultant_client_service_periods_delete();
