-- =======================================================
-- MEVZUAT UYUM & YÜKÜMLÜLÜK TAKİP SİSTEMİ (V2)
-- Supabase SQL Editor'de çalıştırın
-- =======================================================

-- 1. TABLOLARI OLUŞTUR
-- =======================================================

-- İşletmeye Özel Mevzuatlar (Client Regulations)
CREATE TABLE IF NOT EXISTS public.client_regulations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.consultant_clients(id) ON DELETE CASCADE NOT NULL,
  parent_regulation_id uuid REFERENCES public.pdf_regulations(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'active', -- active, repealed, amended
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- İşletmeye Özel Mevzuat Maddeleri (Client Regulation Articles)
CREATE TABLE IF NOT EXISTS public.client_regulation_articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_regulation_id uuid REFERENCES public.client_regulations(id) ON DELETE CASCADE NOT NULL,
  parent_article_id uuid REFERENCES public.pdf_articles(id) ON DELETE SET NULL,
  article_no text,
  title text,
  content text NOT NULL,
  is_mandatory boolean DEFAULT true, -- Uyum zorunlu mu? (Firma muafiyeti için)
  order_index integer DEFAULT 0
);

-- İşletmeye Özel Uyum Yükümlülükleri (Client Obligations)
CREATE TABLE IF NOT EXISTS public.client_obligations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_regulation_id uuid REFERENCES public.client_regulations(id) ON DELETE CASCADE NOT NULL,
  article_id uuid REFERENCES public.client_regulation_articles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  frequency text DEFAULT 'once', -- once, daily, weekly, monthly, quarterly, yearly
  due_date date,
  priority text DEFAULT 'medium', -- low, medium, high, critical
  status text DEFAULT 'pending', -- pending, in_progress, completed, not_applicable
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id),
  notes text,
  evidence_url text,
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Personel Mevzuat Talepleri (Staff Regulation Requests)
CREATE TABLE IF NOT EXISTS public.regulation_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.consultant_clients(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid REFERENCES public.profiles(id) NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending', -- pending, approved, rejected
  admin_notes text,
  created_at timestamptz DEFAULT now()
);

-- Yönetici-Personel Aksiyon/Bilgi Talepleri (Action/Information Requests)
CREATE TABLE IF NOT EXISTS public.compliance_action_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.consultant_clients(id) ON DELETE CASCADE NOT NULL,
  obligation_id uuid REFERENCES public.client_obligations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending', -- pending, answered, resolved
  requested_by uuid REFERENCES public.profiles(id) NOT NULL, -- Danışmanlık yöneticisi
  assigned_to uuid REFERENCES public.profiles(id) NOT NULL, -- Sorumlu personel (Ahmet)
  response_notes text,
  response_evidence_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =======================================================
-- ROW LEVEL SECURITY (RLS) POLİTİKALARI
-- =======================================================

ALTER TABLE public.client_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_regulation_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_action_requests ENABLE ROW LEVEL SECURITY;

-- Temizleme
DROP POLICY IF EXISTS "Select client_regulations" ON public.client_regulations;
DROP POLICY IF EXISTS "Manage client_regulations" ON public.client_regulations;
DROP POLICY IF EXISTS "Select client_regulation_articles" ON public.client_regulation_articles;
DROP POLICY IF EXISTS "Manage client_regulation_articles" ON public.client_regulation_articles;
DROP POLICY IF EXISTS "Select client_obligations" ON public.client_obligations;
DROP POLICY IF EXISTS "Manage client_obligations" ON public.client_obligations;
DROP POLICY IF EXISTS "Select regulation_requests" ON public.regulation_requests;
DROP POLICY IF EXISTS "Manage regulation_requests" ON public.regulation_requests;
DROP POLICY IF EXISTS "Select compliance_action_requests" ON public.compliance_action_requests;
DROP POLICY IF EXISTS "Manage compliance_action_requests" ON public.compliance_action_requests;

-- 1. client_regulations POLİTİKALARI
CREATE POLICY "Select client_regulations" ON public.client_regulations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
    EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.id = client_regulations.client_id
        AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Manage client_regulations" ON public.client_regulations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
    EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.id = client_regulations.client_id
        AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- 2. client_regulation_articles POLİTİKALARI
CREATE POLICY "Select client_regulation_articles" ON public.client_regulation_articles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_regulations cr
      WHERE cr.id = client_regulation_articles.client_regulation_id
    )
  );

CREATE POLICY "Manage client_regulation_articles" ON public.client_regulation_articles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.client_regulations cr
      WHERE cr.id = client_regulation_articles.client_regulation_id
    )
  );

-- 3. client_obligations POLİTİKALARI
CREATE POLICY "Select client_obligations" ON public.client_obligations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_regulations cr
      WHERE cr.id = client_obligations.client_regulation_id
    )
  );

CREATE POLICY "Manage client_obligations" ON public.client_obligations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.client_regulations cr
      WHERE cr.id = client_obligations.client_regulation_id
    )
  );

-- 4. regulation_requests POLİTİKALARI
CREATE POLICY "Select regulation_requests" ON public.regulation_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
    EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.id = regulation_requests.client_id
        AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Manage regulation_requests" ON public.regulation_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
    EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.id = regulation_requests.client_id
        AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- 5. compliance_action_requests POLİTİKALARI
CREATE POLICY "Select compliance_action_requests" ON public.compliance_action_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
    EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.id = compliance_action_requests.client_id
        AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Manage compliance_action_requests" ON public.compliance_action_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
    EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.id = compliance_action_requests.client_id
        AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- =======================================================
-- PERFORMANS İNDEKSLERİ
-- =======================================================
CREATE INDEX IF NOT EXISTS idx_client_regulations_client_id ON public.client_regulations(client_id);
CREATE INDEX IF NOT EXISTS idx_client_regulations_parent ON public.client_regulations(parent_regulation_id);
CREATE INDEX IF NOT EXISTS idx_client_regulation_articles_parent ON public.client_regulation_articles(client_regulation_id);
CREATE INDEX IF NOT EXISTS idx_client_obligations_regulation ON public.client_obligations(client_regulation_id);
CREATE INDEX IF NOT EXISTS idx_client_obligations_article ON public.client_obligations(article_id);
CREATE INDEX IF NOT EXISTS idx_regulation_requests_client ON public.regulation_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_compliance_action_requests_client ON public.compliance_action_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_compliance_action_requests_oblig ON public.compliance_action_requests(obligation_id);
