-- Aksiyonların belirli bir müşteri paneli e-postasına atanabilmesi ve
-- müşterinin kendi aksiyonlarını görüp kanıt dosyası yükleyerek
-- tamamlandı olarak işaretleyebilmesi için gerekli değişiklikler.

-- 1. Aksiyonun hangi müşteri giriş hesabına (e-postaya) özel gösterileceğini tutan kolon.
--    NULL ise firma geneli aksiyon olarak kalır (mevcut davranışla uyumlu).
ALTER TABLE public.compliance_actions ADD COLUMN IF NOT EXISTS assigned_client_email TEXT;

-- 2. Müşteri (role='client') kendi firmasına ait aksiyonları görebilsin.
--    (Daha önce bu tabloda hiçbir client-role SELECT politikası yoktu.)
DROP POLICY IF EXISTS "Client select compliance_actions" ON public.compliance_actions;
CREATE POLICY "Client select compliance_actions" ON public.compliance_actions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'client' AND p.client_id = compliance_actions.client_id
        )
    );

-- 3. Müşteri kendi firmasına ait aksiyonlara kanıt dosyası/notu ekleyip
--    tamamlandı olarak işaretleyebilsin (durum güncellemesi).
DROP POLICY IF EXISTS "Client update compliance_actions" ON public.compliance_actions;
CREATE POLICY "Client update compliance_actions" ON public.compliance_actions
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'client' AND p.client_id = compliance_actions.client_id
        )
    );
