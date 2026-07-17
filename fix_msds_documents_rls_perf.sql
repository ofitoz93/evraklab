-- ==========================================================
-- msds_documents için performans iyileştirmesi (Supabase
-- performans danışmanının uyarılarına istinaden):
-- 1) RLS politikalarında auth.uid() her satır için değil, sorgu
--    başına bir kez değerlendirilsin diye (select auth.uid())
--    kullanımına geçilir.
-- 2) document_id / uploaded_by foreign key'leri için kapsayan
--    indeks eklenir.
-- ==========================================================

DROP POLICY IF EXISTS "Consultant staff manage own msds_documents" ON public.msds_documents;
DROP POLICY IF EXISTS "Client view own msds_documents" ON public.msds_documents;

CREATE POLICY "Consultant staff manage own msds_documents" ON public.msds_documents
  FOR ALL USING (
    consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = (select auth.uid()))
  )
  WITH CHECK (
    consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = (select auth.uid()))
  );

CREATE POLICY "Client view own msds_documents" ON public.msds_documents
  FOR SELECT USING (
    client_id IN (SELECT client_id FROM public.profiles WHERE id = (select auth.uid()) AND client_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_msds_documents_document_id ON public.msds_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_msds_documents_uploaded_by ON public.msds_documents(uploaded_by);
