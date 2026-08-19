-- ==========================================================
-- EKSTRA MODÜL SATIN ALMA / OTOMATİK YENİLEME KAYITLARI
-- ModuleStore.tsx'teki "Ekstra Modül Mağazası" şimdiye kadar bir modülü
-- organizations.enabled_modules dizisine anında ve süresiz ekliyordu;
-- "kim, ne zaman, hangi modülü, ne kadara aldı" bilgisi hiçbir yerde
-- kalıcı olarak saklanmıyordu. Bu tablo + RPC'ler, aylık + otomatik
-- yenilenen (süre seçimsiz, iptal edilene kadar aktif) bir satın alma
-- modeli kurar; admin panelinde şirket bazlı modül satın alma geçmişini
-- göstermek için de kaynak olarak kullanılır.
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.organization_module_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    category_key TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_renewal_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_module_purchases_org_module_status
ON public.organization_module_purchases (organization_id, module_key, status);

ALTER TABLE public.organization_module_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view own module purchases" ON public.organization_module_purchases;
CREATE POLICY "Org members can view own module purchases"
ON public.organization_module_purchases FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Admins manage all module purchases" ON public.organization_module_purchases;
CREATE POLICY "Admins manage all module purchases"
ON public.organization_module_purchases FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Satın Alma: modülü aktive eder (veya iptal edilmiş kaydı yeniden aktive eder),
-- enabled_modules'a ekler ve ödeme log'u düşer. add_storage_limit ile aynı basit
-- SECURITY DEFINER deseni kullanılıyor; rol kontrolü client tarafında yapılıyor
-- (bu kod tabanının genel deseni).
CREATE OR REPLACE FUNCTION public.purchase_extra_module(
  p_organization_id UUID,
  p_module_key TEXT,
  p_category_key TEXT,
  p_price NUMERIC
)
RETURNS void AS $$
DECLARE
  v_existing_id UUID;
  v_current_modules JSONB;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.organization_module_purchases
  WHERE organization_id = p_organization_id AND module_key = p_module_key AND status = 'active'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.organization_module_purchases
    SET price = p_price,
        next_renewal_at = NOW() + INTERVAL '1 month'
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.organization_module_purchases
      (organization_id, module_key, category_key, price, status, purchased_at, next_renewal_at, created_by)
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

-- İptal: aktif kaydı 'cancelled' yapar ve enabled_modules'dan modül anahtarını çıkarır.
CREATE OR REPLACE FUNCTION public.cancel_extra_module(
  p_organization_id UUID,
  p_module_key TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.organization_module_purchases
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE organization_id = p_organization_id AND module_key = p_module_key AND status = 'active';

  UPDATE public.organizations
  SET enabled_modules = COALESCE(enabled_modules, '[]'::jsonb) - p_module_key
  WHERE id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otomatik yenileme: gerçek bir ödeme gateway'i olmadığı için (bu kod tabanının
-- Pricing.tsx/Storage.tsx'te de kullandığı desen), vadesi geçmiş aktif kayıtlar
-- için yeni bir muhasebe/log satırı düşer ve bir sonraki yenileme tarihini bir ay
-- ileri alır. Cron altyapısı olmadığından ModuleStore.tsx her açıldığında bu RPC
-- fırsatçı şekilde çağrılır.
CREATE OR REPLACE FUNCTION public.sync_module_renewals(p_organization_id UUID)
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM public.organization_module_purchases
    WHERE organization_id = p_organization_id AND status = 'active' AND next_renewal_at < NOW()
  LOOP
    INSERT INTO public.subscription_payments (organization_id, user_id, amount, plan_type)
    VALUES (p_organization_id, r.created_by, r.price, 'extra_module');

    UPDATE public.organization_module_purchases
    SET next_renewal_at = r.next_renewal_at + INTERVAL '1 month'
    WHERE id = r.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
