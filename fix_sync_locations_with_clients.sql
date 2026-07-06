-- Bireysel premium hesaplarda "Lokasyon" (user_definitions, category='location')
-- ile "İşletme/Firma" (consultant_clients) kayıtları birbirinden bağımsız
-- oluşturulmuştu: Pricing.tsx satın alma anında sadece consultant_clients'a
-- "Lokasyon 1" ekliyordu, user_definitions'a hiç eklemiyordu. Bu yüzden
-- Evrak Yükle / Belge Ekle sayfalarındaki "Lokasyon" listesi (user_definitions
-- okur) ile Premium Panel'deki Aksiyon/Görüş/Mevzuat listeleri
-- (consultant_clients okur) birbirini tutmuyordu.
--
-- Bu script, premium_individual hesaplarının consultant_clients
-- kayıtlarından, karşılığında user_definitions (category='location')
-- kaydı OLMAYANLAR için eksik kaydı oluşturur. İdempotenttir - zaten
-- eşleşen bir kayıt varsa tekrar eklemez.

INSERT INTO public.user_definitions (user_id, category, label, organization_id)
SELECT p.id, 'location', cc.name, cc.consultant_company_id
FROM public.consultant_clients cc
JOIN public.profiles p ON p.organization_id = cc.consultant_company_id AND p.role = 'premium_individual'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_definitions ud
  WHERE ud.organization_id = cc.consultant_company_id
    AND LOWER(TRIM(ud.label)) = LOWER(TRIM(cc.name))
    AND ud.category = 'location'
);
