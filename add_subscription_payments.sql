-- Premium abonelik / depolama satın alımlarının ödeme geçmişini tutar.
-- Öncesinde satın alma akışı (Pricing.tsx) sadece organizations/profiles
-- tablolarındaki subscription_end_date'i güncelliyordu, hiçbir yerde "kim,
-- ne zaman, ne kadar ödedi" bilgisi kalıcı olarak saklanmıyordu. Admin
-- panelinde "Premium satın alanlar / Ödemeler / Aylık Kazanç" listesini
-- gösterebilmek için bu tablo eklendi; her satın alma işleminde
-- (bireysel, kurumsal yeni, kurumsal yenileme, depolama) bir kayıt düşülür.

CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('individual', 'corporate_new', 'corporate_renewal', 'storage')),
    amount NUMERIC NOT NULL DEFAULT 0,
    duration_months INTEGER,
    seats INTEGER,
    storage_bytes BIGINT,
    invoice_no TEXT,
    invoice_title TEXT,
    invoice_tax_id TEXT,
    invoice_address TEXT,
    invoice_generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own payments" ON public.subscription_payments;
CREATE POLICY "Users can insert own payments"
ON public.subscription_payments FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own payments" ON public.subscription_payments;
CREATE POLICY "Users can view own payments"
ON public.subscription_payments FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage all payments" ON public.subscription_payments;
CREATE POLICY "Admins manage all payments"
ON public.subscription_payments FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
