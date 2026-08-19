-- Admin panelindeki "Modül Ayarları" sayfasında "Finans & Gider Yönetimi"
-- modülünü kapatınca tüm "Finans & Maliyet" kategorisi de kilitleniyordu.
-- Kök neden: moduleRegistry.ts'te bu modülün key'i ('finance'), ait olduğu
-- kategorinin key'i ile ('finance') AYNI string'ti — düz bir string dizisinde
-- saklanan sysDefaultModuleKeys/enabled_modules için bu ikisi ayırt
-- edilemiyordu, modülü kaldırmak kategoriyi de kaldırıyordu. Diğer tüm
-- kategorilerde alt modül key'leri kategori key'inden farklıdır (ör.
-- 'operations' kategorisinin altında 'waste', 'inspections' vardır, asla
-- 'operations' değildir) — sadece finance bu deseni bozuyordu.
--
-- moduleRegistry.ts'te modül key'i 'finance_management' olarak değiştirildi
-- (kategori key'i 'finance' olarak kalıyor). Bu, organizations.enabled_modules
-- dizilerinde daha önce sadece 'finance' (kategori+modül karışık) olan
-- kayıtları etkiler: modül erişimini kaybetmesinler diye 'finance_management'
-- anahtarını da ekliyoruz.

UPDATE public.organizations
SET enabled_modules = enabled_modules || '["finance_management"]'::jsonb
WHERE enabled_modules @> '["finance"]'::jsonb
  AND NOT enabled_modules @> '["finance_management"]'::jsonb;
