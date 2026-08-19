-- ==========================================================
-- PAYTR ÖDEME ALTYAPISI: satın alma "ödeme onaylanmadan aktif
-- olmaz" modeline geçiyor. Bu tablo, PayTR iFrame API'ye
-- gönderilen her siparişi (merchant_oid) ve PayTR'ın sunucu
-- taraflı bildirim (callback) sonucunu izler. Gerçek aktivasyon
-- (modül/üyelik/depolama) sadece callback hash'i doğrulanıp
-- status='success' olunca, servis-rol istemcisiyle yapılır.
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_oid TEXT NOT NULL UNIQUE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    purpose TEXT NOT NULL CHECK (purpose IN (
      'module_purchase', 'subscription_individual', 'subscription_corporate_new',
      'subscription_corporate_renewal', 'storage'
    )),
    purpose_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    paytr_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_merchant_oid ON public.payment_transactions (merchant_oid);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON public.payment_transactions (user_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi siparişini oluşturabilir (init aşaması, oturumlu istekle).
DROP POLICY IF EXISTS "Users can create own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can create own payment transactions"
ON public.payment_transactions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Kullanıcı kendi siparişlerini görebilir (ör. dönüş sayfasında durumu
-- yoklamak için); admin hepsini görebilir. Durumu (status) güncellemek
-- normal kullanıcıya AÇIK DEĞİL — sadece PayTR callback'i servis-rol
-- istemcisiyle (RLS bypass) günceller, böylece bir kullanıcı kendi
-- ödemesini sahte şekilde "success" yapamaz.
DROP POLICY IF EXISTS "Users can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own payment transactions"
ON public.payment_transactions FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage all payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins manage all payment transactions"
ON public.payment_transactions FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- purchase_extra_module RPC'sine geriye dönük uyumlu p_user_id parametresi
-- eklenir: PayTR callback'i webhook olarak (oturumsuz) çalıştığı için
-- auth.uid() NULL döner; webhook gerçek satın alan kullanıcıyı bu
-- parametreyle açıkça belirtir. Mevcut çağrı yerleri (ModuleStore.tsx'in
-- doğrudan çağrısı gibi) parametreyi hiç geçmezse davranış aynı kalır.
-- NOT: Postgres CREATE OR REPLACE, parametre imzası değişince eski
-- fonksiyonu SİLMEZ, yeni bir "overload" oluşturur (PostgREST bu durumda
-- "function is not unique" hatası verir) — bu yüzden önce eski 4 parametreli
-- sürüm açıkça DROP edilir.
DROP FUNCTION IF EXISTS public.purchase_extra_module(UUID, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.purchase_extra_module(
  p_organization_id UUID,
  p_module_key TEXT,
  p_category_key TEXT,
  p_price NUMERIC,
  p_user_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_existing_id UUID;
  v_existing_status TEXT;
  v_current_modules JSONB;
  v_actor_id UUID := COALESCE(p_user_id, auth.uid());
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
      (p_organization_id, p_module_key, p_category_key, p_price, 'active', NOW(), NOW() + INTERVAL '1 month', v_actor_id);
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
  VALUES (p_organization_id, v_actor_id, p_price, 'extra_module');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
