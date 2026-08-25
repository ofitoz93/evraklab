-- organizations.enabled_modules kolonunun canlı veritabanındaki DEFAULT'u,
-- hiçbir migration dosyasında izi olmayan (muhtemelen elle SQL editöründen
-- uygulanmış) hatalı bir değere ayarlanmıştı:
--   '["compliance", "actions", "team", "waste", "msds"]'::jsonb
-- Bu dizi, src/moduleRegistry.ts içindeki ESKİ-FORMAT geriye dönük uyumluluk
-- kodunun (isModuleEnabled/isCategoryEnabled — "Detect old DB array format")
-- referans aldığı placeholder dizinin BİREBİR AYNISI. O kod, bu dizide
-- literal olarak 'waste' / 'msds' / 'actions' bulunduğu için bu üç EKSTRA
-- (ücretli, isDefault:false) modülü gerçekten aktif sayıyor.
--
-- Sonuç: api/paytrShared.ts > activatePurchase() içinde yeni kurumsal/bireysel
-- üyelik satın alan bir organizations satırı INSERT edilirken enabled_modules
-- açıkça verilmediği için bu bozuk DEFAULT uygulanıyor ve yeni satın alınan
-- HER üyelik, Atık Yönetimi + Aksiyon Takip + MSDS modüllerini (üstelik hiçbir
-- satın alma kaydı olmadan) varsayılan olarak açık buluyordu.
--
-- NOT: "Aksiyon Takip" (actions) src/moduleRegistry.ts'de bu düzeltmeyle
-- birlikte isDefault:false yapılıp Atık Yönetimi/MSDS gibi ücretli bir Ekstra
-- Modül'e çevrildi (bkz. DEFAULT_EXTRA_MODULE_PRICING) — bu yüzden aşağıdaki
-- "doğru" varsayılan liste artık actions'ı İÇERMİYOR.
--
-- Bu dosya iki şeyi düzeltir:
--   1) Kolonun DEFAULT'unu, moduleRegistry.ts > DEFAULT_MODULE_KEYS ile birebir
--      aynı olan doğru varsayılan listeye çeker.
--   2) Bu hatalı DEFAULT ile oluşmuş (ve waste/msds/actions için hiçbir aktif
--      satın alma kaydı bulunmayan) organizasyonları geriye dönük düzeltir.
-- (Kod tarafındaki asıl kaynak, api/paytrShared.ts'deki INSERT'lere artık
-- enabled_modules: DEFAULT_MODULE_KEYS'in açıkça eklenmesiyle ayrıca
-- düzeltildi — bu migration sadece DB varsayılanını ve mevcut bozuk kayıtları
-- onarır.)

ALTER TABLE public.organizations
ALTER COLUMN enabled_modules SET DEFAULT
  '["operations","compliance","documents","hr","finance","clients","terminated_clients","legislations","requests","reports","document_matrix","document_requests","definitions","team","org_chart","departed"]'::jsonb;

UPDATE public.organizations o
SET enabled_modules =
  '["operations","compliance","documents","hr","finance","clients","terminated_clients","legislations","requests","reports","document_matrix","document_requests","definitions","team","org_chart","departed"]'::jsonb
WHERE o.enabled_modules @> '["compliance","actions","team","waste","msds"]'::jsonb
  AND o.enabled_modules <@ '["compliance","actions","team","waste","msds"]'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_module_purchases omp
    WHERE omp.organization_id = o.id
      AND omp.status = 'active'
      AND omp.module_key IN ('waste', 'msds', 'actions')
  );
