-- email_settings tablosundaki script_url daha önce sadece role='admin'/'system_admin'
-- olan kullanıcılar tarafından okunabiliyordu (is_admin() fonksiyonu). Ancak aksiyon
-- açma / müşteri daveti gönderme işlemleri Yönetici Paneli'nde premium_corporate,
-- corporate_chief ve corporate_staff rolleri tarafından yapılıyor — bu roller
-- is_admin() olmadığı için Admin Panelinde kaydedilen script_url'i hiç okuyamıyor
-- ve sistem sessizce eski/boş bir URL'e geri dönüyordu.
--
-- system_logo_url zaten herkese açık okunabiliyordu (bkz. "Allow public select of
-- system logo url" politikası); script_url için de aynı mantıkla, herhangi bir
-- gizli bilgi içermediği için (sadece bir webhook adresi) tüm giriş yapmış
-- kullanıcılara okuma izni veriyoruz.

DROP POLICY IF EXISTS "Allow authenticated select of script_url" ON public.email_settings;
CREATE POLICY "Allow authenticated select of script_url" ON public.email_settings
    FOR SELECT TO authenticated USING (key = 'script_url');
