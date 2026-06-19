-- =======================================================
-- ATIK YÖNETİMİ TABLOLARI VE POLİTİKALARI
-- Supabase SQL Editor'de çalıştırın
-- =======================================================

-- 1. Waste Companies Table (Taşıyıcı ve Gönderilen Firmalar)
CREATE TABLE IF NOT EXISTS public.waste_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'transporter' (Taşıyıcı), 'destination' (Gönderilen/Alıcı)
    address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Enable for waste_companies
ALTER TABLE public.waste_companies ENABLE ROW LEVEL SECURITY;

-- Policies for waste_companies
DROP POLICY IF EXISTS "Select waste_companies" ON public.waste_companies;
DROP POLICY IF EXISTS "Manage waste_companies" ON public.waste_companies;

CREATE POLICY "Select waste_companies" ON public.waste_companies
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.organization_id = waste_companies.organization_id
        )
    );

CREATE POLICY "Manage waste_companies" ON public.waste_companies
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.organization_id = waste_companies.organization_id
        )
    );

-- 2. Client Business location columns
ALTER TABLE public.consultant_clients ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.consultant_clients ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- 3. Waste Records Table
CREATE TABLE IF NOT EXISTS public.waste_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.consultant_clients(id) ON DELETE CASCADE NOT NULL,
    waste_code TEXT NOT NULL,
    exit_date DATE NOT NULL,
    quantity_kg NUMERIC NOT NULL,
    transporter TEXT, -- Kept for backward compatibility
    transporter_address TEXT, -- Kept for backward compatibility
    destination TEXT, -- Kept for backward compatibility
    destination_address TEXT, -- Kept for backward compatibility
    disposal_type TEXT NOT NULL, -- 'recovery' (Geri Kazanım), 'disposal' (Bertaraf)
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alter waste_records to support new fields
ALTER TABLE public.waste_records ADD COLUMN IF NOT EXISTS transporter_id UUID REFERENCES public.waste_companies(id) ON DELETE SET NULL;
ALTER TABLE public.waste_records ADD COLUMN IF NOT EXISTS destination_id UUID REFERENCES public.waste_companies(id) ON DELETE SET NULL;
ALTER TABLE public.waste_records ADD COLUMN IF NOT EXISTS disposal_code TEXT;

-- RLS Enable for waste_records
ALTER TABLE public.waste_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Select waste_records" ON public.waste_records;
DROP POLICY IF EXISTS "Manage waste_records" ON public.waste_records;

-- 1. Select Policy
CREATE POLICY "Select waste_records" ON public.waste_records
    FOR SELECT TO authenticated USING (
        -- Admins and system admins see all
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        -- Consultant managers or chiefs see all client actions of their company
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND p.role IN ('premium_corporate', 'corporate_chief')
              AND cc.id = waste_records.client_id
        ) OR
        -- Users who created the record
        created_by = auth.uid() OR
        -- Users assigned to the client via consultant_assignments
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = waste_records.client_id
        )
    );

-- 2. Manage Policy (All operations)
CREATE POLICY "Manage waste_records" ON public.waste_records
    FOR ALL TO authenticated USING (
        -- Admins and system admins can do all
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        -- Consultant managers or chiefs can manage all client actions of their company
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND p.role IN ('premium_corporate', 'corporate_chief')
              AND cc.id = waste_records.client_id
        ) OR
        -- Users who created the record
        created_by = auth.uid() OR
        -- Users assigned to the client via consultant_assignments
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = waste_records.client_id
        )
    );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_waste_records_client ON public.waste_records(client_id);
CREATE INDEX IF NOT EXISTS idx_waste_companies_org ON public.waste_companies(organization_id);
