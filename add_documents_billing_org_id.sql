-- ==========================================================
-- ŞAHSİ BELGE KOTASININ FATURALANDIRILDIĞI FİRMA
-- Şef/Yönetici bir personele "Şahsi Belge Yükleme" yetkisi
-- verdiğinde, o personelin yüklediği şahsi (organization_id IS NULL)
-- belgeler artık kendi 50MB'lık bireysel kotasından değil, işvereninin
-- ortak (500MB+) kotasından düşer. billing_org_id bu ilişkiyi tutar;
-- belgenin görünürlüğünü (hâlâ sadece yükleyen görür) ETKİLEMEZ,
-- sadece kota hesaplamasında kullanılır.
-- ==========================================================

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS billing_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_billing_org_id ON public.documents(billing_org_id) WHERE billing_org_id IS NOT NULL;

-- INSERT sırasında billing_org_id sadece yükleyenin KENDİ organization_id'sine
-- eşit olabilir (başka bir firmanın kotasını şişirme girişimini engeller).
DROP POLICY IF EXISTS "Allow users to insert their own documents" ON public.documents;
CREATE POLICY "Allow users to insert their own documents" ON public.documents
  FOR INSERT WITH CHECK (
    (uploader_id = auth.uid())
    AND (
      (organization_id IS NULL)
      OR (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))
    )
    AND (
      (billing_org_id IS NULL)
      OR (billing_org_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))
    )
  );

CREATE OR REPLACE FUNCTION public.get_org_storage_usage(org_id UUID)
RETURNS BIGINT AS $$
DECLARE
  total_usage BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size), 0)::BIGINT INTO total_usage
  FROM public.documents
  WHERE organization_id = org_id OR billing_org_id = org_id;

  RETURN total_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_org_storage_usage_by_member(org_id UUID)
RETURNS TABLE(uploader_id UUID, total_bytes BIGINT, doc_count BIGINT) AS $$
  SELECT uploader_id, COALESCE(SUM(file_size), 0)::BIGINT AS total_bytes, COUNT(*)::BIGINT AS doc_count
  FROM public.documents
  WHERE organization_id = org_id OR billing_org_id = org_id
  GROUP BY uploader_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_storage_usage(target_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  total_usage BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size), 0)::BIGINT INTO total_usage
  FROM public.documents
  WHERE uploader_id = target_user_id
    AND organization_id IS NULL
    AND billing_org_id IS NULL;

  RETURN total_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
