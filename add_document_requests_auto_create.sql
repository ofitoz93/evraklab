-- ==========================================================
-- Süresi geçmiş (MSDS olmayan) belgeler için müşteri panelinde
-- otomatik "Evrak Talebi" oluşturulabilsin (src/ClientPanel.tsx,
-- ensureAutoDocumentRequests). MSDS belgeleri bu akışa girmez —
-- onlar ayrı bir alt-alanda (add_client_msds_self_service.sql).
--
-- source_document_id: hangi süresi geçmiş documents satırından
-- otomatik oluşturulduğunu tutar, aynı belge için tekrar tekrar
-- talep açılmasını (idempotency) engellemek için kullanılır.
-- ==========================================================

ALTER TABLE public.document_requests
  ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_document_requests_source_document ON public.document_requests(source_document_id);

DROP POLICY IF EXISTS "Client can auto-create own document requests" ON public.document_requests;
CREATE POLICY "Client can auto-create own document requests" ON public.document_requests
  FOR INSERT WITH CHECK (
    requested_by = (select auth.uid())
    AND client_id IN (SELECT client_id FROM public.profiles WHERE id = (select auth.uid()) AND client_id IS NOT NULL)
    AND consultant_company_id IN (
      SELECT cc.consultant_company_id FROM public.consultant_clients cc
      JOIN public.profiles p ON p.client_id = cc.id
      WHERE p.id = (select auth.uid())
    )
  );
