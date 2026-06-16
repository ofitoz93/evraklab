-- =======================================================
-- MEVZUAT TAKİP VE UYUM MODÜLÜ TABLOLARI
-- Supabase SQL Editor'de çalıştırın
-- =======================================================

-- 1. PDF_REGULATIONS (Global Mevzuat Havuzu)
CREATE TABLE IF NOT EXISTS public.pdf_regulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Yönetmelik', -- 'Yönetmelik', 'Kanun', 'Yönerge', 'Diğer'
    publication_date DATE,
    effective_date DATE,
    rg_no TEXT,
    rg_date DATE,
    company_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL, -- Opsiyonel
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PDF_ARTICLES (Mevzuat Maddeleri)
CREATE TABLE IF NOT EXISTS public.pdf_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regulation_id UUID REFERENCES public.pdf_regulations(id) ON DELETE CASCADE,
    article_no TEXT,
    title TEXT,
    content TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. COMPANY_PDF_REGULATIONS (Firmalara Tanımlanan Mevzuatlar)
CREATE TABLE IF NOT EXISTS public.company_pdf_regulations (
    company_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    regulation_id UUID REFERENCES public.pdf_regulations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (company_id, regulation_id)
);

-- 4. CLIENT_REGULATIONS (İşletmeye/Müşteriye Atanan Mevzuatlar)
CREATE TABLE IF NOT EXISTS public.client_regulations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.consultant_clients(id) ON DELETE CASCADE NOT NULL,
    parent_regulation_id UUID REFERENCES public.pdf_regulations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active', -- active, repealed, amended
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CLIENT_REGULATION_ARTICLES (İşletmeye Özel Mevzuat Maddeleri)
CREATE TABLE IF NOT EXISTS public.client_regulation_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_regulation_id UUID REFERENCES public.client_regulations(id) ON DELETE CASCADE NOT NULL,
    parent_article_id UUID REFERENCES public.pdf_articles(id) ON DELETE SET NULL,
    article_no TEXT,
    title TEXT,
    content TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT true, -- Muafiyet durumu (false ise hariç tutulmuş demektir)
    compliance_status TEXT DEFAULT 'compliant', -- 'compliant' (Uygun) veya 'non_compliant' (Uygun Değil)
    order_index INTEGER DEFAULT 0
);

-- 6. REGULATION_REQUESTS (Mevzuat & Güncelleme Talepleri)
CREATE TABLE IF NOT EXISTS public.regulation_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.consultant_clients(id) ON DELETE CASCADE, -- Nullable (firma sahibi talepleri için)
    requested_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    admin_notes TEXT,
    request_type TEXT DEFAULT 'staff_to_owner', -- 'staff_to_owner' veya 'owner_to_admin'
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- İstek yapan danışmanlık firması
    target_regulation_id UUID REFERENCES public.pdf_regulations(id) ON DELETE SET NULL, -- Güncelleme talepleri için
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =======================================================
-- ROW LEVEL SECURITY (RLS) POLİTİKALARI
-- =======================================================

-- RLS Aktifleştir
ALTER TABLE public.pdf_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_pdf_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_regulation_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulation_requests ENABLE ROW LEVEL SECURITY;

-- Temizleme (Eski politikalar varsa silinsin)
DROP POLICY IF EXISTS "Allow public select on pdf_regulations" ON public.pdf_regulations;
DROP POLICY IF EXISTS "Allow admin manage on pdf_regulations" ON public.pdf_regulations;
DROP POLICY IF EXISTS "Allow public select on pdf_articles" ON public.pdf_articles;
DROP POLICY IF EXISTS "Allow admin manage on pdf_articles" ON public.pdf_articles;
DROP POLICY IF EXISTS "Select company_pdf_regulations" ON public.company_pdf_regulations;
DROP POLICY IF EXISTS "Manage company_pdf_regulations" ON public.company_pdf_regulations;
DROP POLICY IF EXISTS "Select client_regulations" ON public.client_regulations;
DROP POLICY IF EXISTS "Manage client_regulations" ON public.client_regulations;
DROP POLICY IF EXISTS "Select client_regulation_articles" ON public.client_regulation_articles;
DROP POLICY IF EXISTS "Manage client_regulation_articles" ON public.client_regulation_articles;
DROP POLICY IF EXISTS "Select regulation_requests" ON public.regulation_requests;
DROP POLICY IF EXISTS "Manage regulation_requests" ON public.regulation_requests;

-- 1. pdf_regulations Politikaları
CREATE POLICY "Allow public select on pdf_regulations" ON public.pdf_regulations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin manage on pdf_regulations" ON public.pdf_regulations
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin'))
    );

-- 2. pdf_articles Politikaları
CREATE POLICY "Allow public select on pdf_articles" ON public.pdf_articles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin manage on pdf_articles" ON public.pdf_articles
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin'))
    );

-- 3. company_pdf_regulations Politikaları
CREATE POLICY "Select company_pdf_regulations" ON public.company_pdf_regulations
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Manage company_pdf_regulations" ON public.company_pdf_regulations
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

-- 4. client_regulations Politikaları
DROP POLICY IF EXISTS "Select client_regulations" ON public.client_regulations;
CREATE POLICY "Select client_regulations" ON public.client_regulations
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        -- Consultant managers or staff with view all clients permission: see all clients of their consultant company
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND (p.role = 'premium_corporate' OR (p.permissions->>'can_view_all_clients')::boolean = true)
              AND cc.id = client_regulations.client_id
        ) OR
        -- Consultant staff: see only clients assigned in consultant_assignments
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = client_regulations.client_id
        ) OR
        -- Normal client company: see their matching client regulations
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            JOIN public.profiles p ON p.id = auth.uid()
            JOIN public.organizations o ON o.id = p.organization_id
            WHERE cc.id = client_regulations.client_id
              AND (
                LOWER(TRIM(cc.name)) = LOWER(TRIM(o.name))
                OR LOWER(TRIM(cc.name)) LIKE '%' || LOWER(TRIM(o.name)) || '%'
                OR LOWER(TRIM(o.name)) LIKE '%' || LOWER(TRIM(cc.name)) || '%'
              )
        )
    );

DROP POLICY IF EXISTS "Manage client_regulations" ON public.client_regulations;
CREATE POLICY "Manage client_regulations" ON public.client_regulations
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        -- Consultant managers or staff with view all clients permission: manage all clients of their consultant company
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND (p.role = 'premium_corporate' OR (p.permissions->>'can_view_all_clients')::boolean = true)
              AND cc.id = client_regulations.client_id
        ) OR
        -- Consultant staff: manage only clients assigned in consultant_assignments
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = client_regulations.client_id
        ) OR
        -- Normal client company: manage their matching client regulations
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            JOIN public.profiles p ON p.id = auth.uid()
            JOIN public.organizations o ON o.id = p.organization_id
            WHERE cc.id = client_regulations.client_id
              AND LOWER(TRIM(cc.name)) = LOWER(TRIM(o.name))
        )
    );

-- 5. client_regulation_articles Politikaları
CREATE POLICY "Select client_regulation_articles" ON public.client_regulation_articles
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.client_regulations cr
            WHERE cr.id = client_regulation_articles.client_regulation_id
        )
    );

CREATE POLICY "Manage client_regulation_articles" ON public.client_regulation_articles
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.client_regulations cr
            WHERE cr.id = client_regulation_articles.client_regulation_id
        )
    );

-- 6. regulation_requests Politikaları
CREATE POLICY "Select regulation_requests" ON public.regulation_requests
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        requested_by = auth.uid() OR
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            WHERE cc.id = regulation_requests.client_id
              AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Manage regulation_requests" ON public.regulation_requests
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        requested_by = auth.uid() OR
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            WHERE cc.id = regulation_requests.client_id
              AND cc.consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- =======================================================
-- PERFORMANS İNDEKSLERİ
-- =======================================================
CREATE INDEX IF NOT EXISTS idx_pdf_articles_reg ON public.pdf_articles(regulation_id);
CREATE INDEX IF NOT EXISTS idx_company_pdf_regulations_comp ON public.company_pdf_regulations(company_id);
CREATE INDEX IF NOT EXISTS idx_client_regulations_client ON public.client_regulations(client_id);
CREATE INDEX IF NOT EXISTS idx_client_regulation_articles_cr ON public.client_regulation_articles(client_regulation_id);
CREATE INDEX IF NOT EXISTS idx_regulation_requests_req ON public.regulation_requests(requested_by);

-- consultant_clients SELECT politikası güncellemesi
DROP POLICY IF EXISTS "Clients can view their own client record" ON public.consultant_clients;
CREATE POLICY "Clients can view their own client record" ON public.consultant_clients
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.organizations o ON o.id = p.organization_id
            WHERE p.id = auth.uid()
              AND (
                LOWER(TRIM(public.consultant_clients.name)) = LOWER(TRIM(o.name))
                OR LOWER(TRIM(public.consultant_clients.name)) LIKE '%' || LOWER(TRIM(o.name)) || '%'
                OR LOWER(TRIM(o.name)) LIKE '%' || LOWER(TRIM(public.consultant_clients.name)) || '%'
              )
          )
    );

-- 7. Tabloya compliance_status kolonu eklenmesi (Eski tablolar için)
ALTER TABLE public.client_regulation_articles ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'compliant';

-- 8. Bir yönetmeliğin bir firmaya en fazla bir kez atanabilmesi için benzersizlik (UNIQUE) kısıtı eklenmesi
-- Eğer varsa eski mükerrer kayıtları temizle (yalnızca en eski olanı koru)
DELETE FROM public.client_regulations a USING (
    SELECT MIN(id::text)::uuid as min_id, client_id, parent_regulation_id
    FROM public.client_regulations
    GROUP BY client_id, parent_regulation_id
    HAVING COUNT(*) > 1
) b
WHERE a.client_id = b.client_id 
  AND a.parent_regulation_id = b.parent_regulation_id 
  AND a.id <> b.min_id;

ALTER TABLE public.client_regulations DROP CONSTRAINT IF EXISTS unique_client_parent_regulation;
ALTER TABLE public.client_regulations ADD CONSTRAINT unique_client_parent_regulation UNIQUE (client_id, parent_regulation_id);
