-- ==========================================================
-- EVRAK TALEBİ (Danışman -> Hizmet Verilen İşletme)
-- Danışman personeli, hizmet verdiği bir işletmeden serbest
-- metinli bir belge talep eder (ör. "Güncel Mali Sigorta").
-- Talep müşteri panelinde görünür, müşteri belge yükleyince
-- talep "karşılandı" olur ve danışman belgeyi indirebilir.
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.consultant_clients(id) ON DELETE CASCADE,
  consultant_company_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  fulfilled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultant staff manage own requests" ON public.document_requests;
DROP POLICY IF EXISTS "Client view own requests" ON public.document_requests;
DROP POLICY IF EXISTS "Client fulfill own requests" ON public.document_requests;

-- Danışman personeli: kendi organizasyonuna ait talepleri tam yönetebilir
CREATE POLICY "Consultant staff manage own requests" ON public.document_requests
  FOR ALL USING (
    consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- Müşteri: sadece kendi client_id'sine ait talepleri görebilir
CREATE POLICY "Client view own requests" ON public.document_requests
  FOR SELECT USING (
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
  );

-- Müşteri: sadece kendi client_id'sine ait talepleri karşılayabilir (belge yükleyip günceller)
CREATE POLICY "Client fulfill own requests" ON public.document_requests
  FOR UPDATE USING (
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
  )
  WITH CHECK (
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_document_requests_client ON public.document_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_document_requests_org ON public.document_requests(consultant_company_id, status);
