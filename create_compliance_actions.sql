-- =======================================================
-- AKSİYON TAKİP SİSTEMİ TABLOSU VE POLİTİKALARI
-- Supabase SQL Editor'de çalıştırın
-- =======================================================

CREATE TABLE IF NOT EXISTS public.compliance_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.consultant_clients(id) ON DELETE CASCADE NOT NULL,
    article_id UUID REFERENCES public.client_regulation_articles(id) ON DELETE CASCADE NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    status TEXT DEFAULT 'pending', -- 'pending' (Bekliyor), 'completed' (Onay Bekliyor), 'correction_requested' (Düzeltme İstendi), 'approved' (Onaylandı)
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    evidence_url TEXT,
    manager_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Enable
ALTER TABLE public.compliance_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Select compliance_actions" ON public.compliance_actions;
DROP POLICY IF EXISTS "Manage compliance_actions" ON public.compliance_actions;

-- 1. Select Policy
CREATE POLICY "Select compliance_actions" ON public.compliance_actions
    FOR SELECT TO authenticated USING (
        -- Admins and system admins see all
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        -- Consultant managers or chiefs see all client actions of their company
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND p.role IN ('premium_corporate', 'corporate_chief')
              AND cc.id = compliance_actions.client_id
        ) OR
        -- Users assigned to the action
        assigned_to = auth.uid() OR
        -- Creator of the action
        created_by = auth.uid() OR
        -- Users assigned to the client via consultant_assignments
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = compliance_actions.client_id
        )
    );

-- 2. Manage Policy (All operations)
CREATE POLICY "Manage compliance_actions" ON public.compliance_actions
    FOR ALL TO authenticated USING (
        -- Admins and system admins can do all
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        -- Consultant managers or chiefs can manage all client actions of their company
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND p.role IN ('premium_corporate', 'corporate_chief')
              AND cc.id = compliance_actions.client_id
        ) OR
        -- Assigned staff can edit their assigned actions
        assigned_to = auth.uid() OR
        -- Creator of the action can manage it
        created_by = auth.uid()
    );

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_compliance_actions_client ON public.compliance_actions(client_id);
CREATE INDEX IF NOT EXISTS idx_compliance_actions_article ON public.compliance_actions(article_id);
CREATE INDEX IF NOT EXISTS idx_compliance_actions_assignee ON public.compliance_actions(assigned_to);
