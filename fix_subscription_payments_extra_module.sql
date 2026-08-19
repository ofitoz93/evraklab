-- ModuleStore.tsx ekstra modül satın alımlarını 'extra_module' plan_type'ı ile
-- subscription_payments'a logluyor, ama tablonun CHECK kısıtı bu değeri
-- tanımıyordu; her satın almada log insert'i sessizce (try/catch içinde)
-- başarısız oluyordu. Kısıtı 'extra_module' değerini de kabul edecek şekilde
-- genişletiyoruz.

ALTER TABLE public.subscription_payments
DROP CONSTRAINT IF EXISTS subscription_payments_plan_type_check;

ALTER TABLE public.subscription_payments
ADD CONSTRAINT subscription_payments_plan_type_check
CHECK (plan_type IN ('individual', 'corporate_new', 'corporate_renewal', 'storage', 'extra_module'));
