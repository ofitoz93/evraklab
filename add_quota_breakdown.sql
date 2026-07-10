-- ==========================================================
-- KİŞİ BAZLI DEPOLAMA (KOTA) KIRILIMI
-- Bir organizasyonun toplam depolama kullanımını, kim ne kadar
-- yüklemiş şeklinde kişi bazında kırar. Şirket sahibinin
-- Ekip Yönetimi sayfasında görüntülemesi için kullanılır.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_org_storage_usage_by_member(org_id UUID)
RETURNS TABLE(uploader_id UUID, total_bytes BIGINT, doc_count BIGINT) AS $$
  SELECT uploader_id, COALESCE(SUM(file_size), 0)::BIGINT AS total_bytes, COUNT(*)::BIGINT AS doc_count
  FROM public.documents
  WHERE organization_id = org_id
  GROUP BY uploader_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
