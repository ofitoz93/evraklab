-- "Belge Şablon Tanımlama" sayfasında (AddDocument.tsx) aynı isimle birden fazla
-- belge türü / lokasyon tanımı oluşturulabiliyordu (ör. 2 adet "Çevre izni"),
-- çünkü o sayfadaki ekleme fonksiyonunda mükerrer isim kontrolü yoktu.
-- (Kod tarafı AddDocument.tsx içinde ayrıca düzeltildi.)
--
-- Bu script, veritabanında halihazırda oluşmuş mükerrer user_definitions
-- kayıtlarını tek bir kayıtta birleştirir:
--   1. Aynı kapsam (kurumsal ise organization_id, kişisel ise user_id) ve
--      aynı kategori (doc_type/location) içinde, isim (boşluksuz/küçük harf)
--      eşleşen kayıtlar bulunur.
--   2. En eski kayıt "asıl" (keep) olarak seçilir, diğerleri "mükerrer" (dup) sayılır.
--   3. documents.type_def_id / location_def_id ve client_required_documents
--      tablolarındaki referanslar asıl kayda yönlendirilir.
--   4. Mükerrer kayıtlar silinir.
--
-- Çalıştırmadan önce mükerrer kayıtları görmek isterseniz aşağıdaki SELECT'i
-- tek başına çalıştırabilirsiniz:
--
-- SELECT category, lower(trim(label)) AS norm_label,
--        COALESCE(organization_id::text, 'user:' || user_id::text) AS scope_key,
--        count(*), array_agg(id ORDER BY created_at)
-- FROM public.user_definitions
-- GROUP BY 1,2,3
-- HAVING count(*) > 1;

BEGIN;

CREATE TEMP TABLE dup_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    category,
    lower(trim(label)) AS norm_label,
    COALESCE(organization_id::text, 'user:' || user_id::text) AS scope_key,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY category, lower(trim(label)), COALESCE(organization_id::text, 'user:' || user_id::text)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.user_definitions
  WHERE label IS NOT NULL AND trim(label) <> ''
)
SELECT r.id AS dup_id, k.id AS keep_id, r.category, r.norm_label
FROM ranked r
JOIN ranked k
  ON k.category = r.category
 AND k.norm_label = r.norm_label
 AND k.scope_key = r.scope_key
 AND k.rn = 1
WHERE r.rn > 1;

-- Silinecek/birleştirilecek kayıt yoksa burada duracak
DO $$
BEGIN
  RAISE NOTICE 'Mükerrer kayıt sayısı: %', (SELECT count(*) FROM dup_map);
END $$;

-- 1. documents tablosundaki referansları asıl kayda taşı
UPDATE public.documents d
SET type_def_id = m.keep_id
FROM dup_map m
WHERE d.type_def_id = m.dup_id;

UPDATE public.documents d
SET location_def_id = m.keep_id
FROM dup_map m
WHERE d.location_def_id = m.dup_id;

-- 2. client_required_documents referanslarını taşı
--    (client_id, type_def_id) unique kısıtına çarpmamak için önce çakışmayanları güncelle
UPDATE public.client_required_documents crd
SET type_def_id = m.keep_id
FROM dup_map m
WHERE crd.type_def_id = m.dup_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_required_documents x
    WHERE x.client_id = crd.client_id AND x.type_def_id = m.keep_id
  );

-- Asıl kayıt için zaten satır varsa, mükerrer olan artık gereksiz -> sil
DELETE FROM public.client_required_documents crd
USING dup_map m
WHERE crd.type_def_id = m.dup_id;

-- 3. Artık hiçbir yerden referans edilmeyen mükerrer tanım kayıtlarını sil
DELETE FROM public.user_definitions ud
USING dup_map m
WHERE ud.id = m.dup_id;

-- Özet: birleştirilen kayıtlar
SELECT * FROM dup_map;

COMMIT;
