-- 1. consultant_clients: Danışmanlık Firmasının Müşterileri (Hizmet verilen işletmeler)
CREATE TABLE IF NOT EXISTS consultant_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultant_company_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    tax_no TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE consultant_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants can view their own clients"
ON consultant_clients FOR SELECT
USING (consultant_company_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Consultant admins can manage their clients"
ON consultant_clients FOR ALL
USING (consultant_company_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid() AND (role = 'corporate_chief' OR role = 'premium_corporate')
));


-- 2. consultant_assignments: Hangi personel hangi işletmeden sorumlu?
CREATE TABLE IF NOT EXISTS consultant_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES consultant_clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, user_id)
);

-- RLS
ALTER TABLE consultant_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignments in their company"
ON consultant_assignments FOR SELECT
USING (client_id IN (
    SELECT id FROM consultant_clients WHERE consultant_company_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
));

CREATE POLICY "Consultant admins can manage assignments"
ON consultant_assignments FOR ALL
USING (client_id IN (
    SELECT id FROM consultant_clients WHERE consultant_company_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid() AND (role = 'corporate_chief' OR role = 'premium_corporate')
    )
));


-- 3. env_reports: Raporların tutulduğu ana tablo
CREATE TABLE IF NOT EXISTS env_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES consultant_clients(id) ON DELETE CASCADE,
    consultant_company_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL, -- 'monthly' or 'yearly'
    report_date DATE NOT NULL,
    expires_at DATE, -- 1 ay veya 1 yıl sonrası
    is_manual_upload BOOLEAN DEFAULT FALSE,
    file_url TEXT, -- Manuel yüklendiyse
    form_data JSONB, -- Sistem üzerinden doldurulduysa tüm alanlar
    status TEXT DEFAULT 'draft', -- 'draft', 'completed'
    signature_link_token TEXT, -- Uzaktan imza için şifreli/güvenli token
    coordinator_signature JSONB, -- { signed_at, ip, name } vb.
    engineer_signature JSONB,
    client_signature JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE env_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports in their company"
ON env_reports FOR SELECT
USING (consultant_company_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Assigned users and admins can manage reports"
ON env_reports FOR ALL
USING (
    consultant_company_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
        creator_id = auth.uid() 
        OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND (role = 'corporate_chief' OR role = 'premium_corporate')
            AND organization_id = env_reports.consultant_company_id
        )
    )
);

-- 4. Şirketlere "Danışmanlık Modülü" izni vermek için profiles'a/organizations'a alan ekleyelim
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_environmental_consultant BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS consultant_logo_url TEXT;

-- 5. Storage Bucket (Opsiyonel)
-- insert into storage.buckets (id, name, public) values ('env_reports', 'env_reports', true);
