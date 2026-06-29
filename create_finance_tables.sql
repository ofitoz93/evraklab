-- ==========================================================
-- EVRAKLAB FINANCE & COST MODULE TABLES AND RLS POLICIES
-- ==========================================================

-- 1. Add monthly_fee column to consultant_clients table if not exists
ALTER TABLE public.consultant_clients 
ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(15, 2) DEFAULT 0.00;

-- 2. Create client_payments table
CREATE TABLE IF NOT EXISTS public.client_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.consultant_clients(id) ON DELETE CASCADE,
    consultant_company_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    year INT NOT NULL,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_client_month_year UNIQUE (client_id, year, month)
);

-- 3. Create company_expenses table
CREATE TABLE IF NOT EXISTS public.company_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultant_company_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT, -- e.g., 'Ofis/Kira', 'Maaş/Personel', 'Yol/Ulaşım', 'Yazılım/Lisans', 'Vergi/Harç', 'Diğer'
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_expenses ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Only owners of the consultant company (premium_corporate), chiefs (corporate_chief) or system admins can manage payments.
CREATE POLICY "Manage payments policy" ON public.client_payments
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p 
            WHERE p.organization_id = consultant_company_id 
              AND p.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
        )
    );

-- Only owners of the consultant company (premium_corporate), chiefs (corporate_chief) or system admins can manage expenses.
CREATE POLICY "Manage expenses policy" ON public.company_expenses
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p 
            WHERE p.organization_id = consultant_company_id 
              AND p.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
        )
    );
