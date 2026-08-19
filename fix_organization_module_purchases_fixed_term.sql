-- Faz 2: Ekstra modüller artık sonsuz otomatik yenilenmiyor. Sabit 1 aylık
-- süreyle satın alınıyor; süre dolunca gerçekten pasifleşiyor (status='expired')
-- ve ilgili panelde "Modül Süresi Doldu, lütfen satın alın" kilitli ekranı
-- gösteriliyor. Bu dosya bir önceki turda kurulan "aylık + otomatik yenilenir"
-- (sync_module_renewals) modelini değiştirir.

ALTER TABLE public.organization_module_purchases
RENAME COLUMN next_renewal_at TO expires_at;

ALTER TABLE public.organization_module_purchases
DROP CONSTRAINT IF EXISTS organization_module_purchases_status_check;

ALTER TABLE public.organization_module_purchases
ADD CONSTRAINT organization_module_purchases_status_check
CHECK (status IN ('active', 'cancelled', 'expired'));

DROP FUNCTION IF EXISTS public.sync_module_renewals(UUID);

-- Satın Alma: sabit 1 aylık dönem başlatır (yeniden yenileme yok). Org+modül
-- için en son satırı bulur; o satır iptal edilmemişse (organik süre dolumundan
-- sonra tekrar alma dahil) aynı satırı canlandırır, iptal edilmişse yeni bir
-- geçmiş kaydı açar.
CREATE OR REPLACE FUNCTION public.purchase_extra_module(
  p_organization_id UUID,
  p_module_key TEXT,
  p_category_key TEXT,
  p_price NUMERIC
)
RETURNS void AS $$
DECLARE
  v_existing_id UUID;
  v_existing_status TEXT;
  v_current_modules JSONB;
BEGIN
  SELECT id, status INTO v_existing_id, v_existing_status
  FROM public.organization_module_purchases
  WHERE organization_id = p_organization_id AND module_key = p_module_key
  ORDER BY purchased_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_status != 'cancelled' THEN
    UPDATE public.organization_module_purchases
    SET price = p_price,
        status = 'active',
        purchased_at = NOW(),
        expires_at = NOW() + INTERVAL '1 month',
        cancelled_at = NULL
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.organization_module_purchases
      (organization_id, module_key, category_key, price, status, purchased_at, expires_at, created_by)
    VALUES
      (p_organization_id, p_module_key, p_category_key, p_price, 'active', NOW(), NOW() + INTERVAL '1 month', auth.uid());
  END IF;

  SELECT COALESCE(enabled_modules, '[]'::jsonb) INTO v_current_modules
  FROM public.organizations WHERE id = p_organization_id;

  IF NOT (v_current_modules @> to_jsonb(p_category_key)) THEN
    v_current_modules := v_current_modules || to_jsonb(p_category_key);
  END IF;
  IF NOT (v_current_modules @> to_jsonb(p_module_key)) THEN
    v_current_modules := v_current_modules || to_jsonb(p_module_key);
  END IF;

  UPDATE public.organizations
  SET enabled_modules = v_current_modules
  WHERE id = p_organization_id;

  INSERT INTO public.subscription_payments (organization_id, user_id, amount, plan_type)
  VALUES (p_organization_id, auth.uid(), p_price, 'extra_module');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Süre Dolumu Senkronu: gerçek bir ödeme gateway'i/cron altyapısı olmadığından,
-- panel her açıldığında fırsatçı şekilde çağrılır. Süresi geçmiş aktif
-- kayıtları 'expired' yapar ve enabled_modules'dan çıkarır. Otomatik yenileme
-- YOKTUR — hiçbir ödeme log'u eklenmez.
CREATE OR REPLACE FUNCTION public.sync_expired_modules(p_organization_id UUID)
RETURNS void AS $$
DECLARE
  r RECORD;
  v_current_modules JSONB;
BEGIN
  SELECT COALESCE(enabled_modules, '[]'::jsonb) INTO v_current_modules
  FROM public.organizations WHERE id = p_organization_id;

  FOR r IN
    SELECT * FROM public.organization_module_purchases
    WHERE organization_id = p_organization_id AND status = 'active' AND expires_at < NOW()
  LOOP
    UPDATE public.organization_module_purchases
    SET status = 'expired'
    WHERE id = r.id;

    v_current_modules := v_current_modules - r.module_key;
  END LOOP;

  UPDATE public.organizations
  SET enabled_modules = v_current_modules
  WHERE id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
