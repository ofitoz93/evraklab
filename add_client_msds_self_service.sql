-- ==========================================================
-- Müşteri, kendi MSDS/SDS kayıtlarını (ürün adı/tarih) düzeltip
-- güncel belgeyi kendisi yükleyebilsin (Belgelerim > MSDS/SDS
-- Formları alt-alanı, src/ClientPanel.tsx).
--
-- msds_documents zaten client SELECT policy'sine sahip
-- (add_msds_documents.sql) — burada sadece UPDATE eklenir.
--
-- documents tablosunda müşteri normalde sadece kendi yüklediği
-- (uploader_id = auth.uid()) satırı güncelleyebilir; ama MSDS
-- belgeleri genelde danışman personeli tarafından toplu
-- yüklendiği için (src/AddMsdsDocuments.tsx), müşterinin "güncel
-- belgeyi yükle" akışının çalışabilmesi için dar kapsamlı ek bir
-- UPDATE policy gerekiyor: sadece kendi msds_documents kaydının
-- işaret ettiği documents satırı.
-- ==========================================================

DROP POLICY IF EXISTS "Client update own msds_documents" ON public.msds_documents;
CREATE POLICY "Client update own msds_documents" ON public.msds_documents
  FOR UPDATE USING (
    client_id IN (SELECT client_id FROM public.profiles WHERE id = (select auth.uid()) AND client_id IS NOT NULL)
  )
  WITH CHECK (
    client_id IN (SELECT client_id FROM public.profiles WHERE id = (select auth.uid()) AND client_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Client update own linked msds documents" ON public.documents;
CREATE POLICY "Client update own linked msds documents" ON public.documents
  FOR UPDATE USING (
    id IN (
      SELECT md.document_id FROM public.msds_documents md
      JOIN public.profiles p ON p.client_id = md.client_id
      WHERE p.id = (select auth.uid()) AND md.document_id IS NOT NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT md.document_id FROM public.msds_documents md
      JOIN public.profiles p ON p.client_id = md.client_id
      WHERE p.id = (select auth.uid()) AND md.document_id IS NOT NULL
    )
  );
