-- 1. DEĞERLENDİRME DÖNEMLERİ (Evaluation Periods)
CREATE TABLE IF NOT EXISTS public.evaluation_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    allow_chief_evaluations BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. DEĞERLENDİRMELER (Evaluations)
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES public.evaluation_periods(id) ON DELETE CASCADE,
    evaluator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL if filled by client externally
    evaluatee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Evaluated staff/chief
    client_id UUID REFERENCES public.consultant_clients(id) ON DELETE SET NULL, -- Client company reference
    evaluator_type TEXT NOT NULL CHECK (evaluator_type IN ('manager', 'client')),
    scores JSONB NOT NULL, -- e.g. { "technical_q1": 4, "technical_q2": 5, ... }
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. MÜŞTERİ DEĞERLENDİRME TOKENS (Client Evaluation Tokens)
CREATE TABLE IF NOT EXISTS public.evaluation_client_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES public.evaluation_periods(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.consultant_clients(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    is_used BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evaluation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_client_tokens ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES FOR evaluation_periods
CREATE POLICY "Users can read evaluation periods of own organization" ON public.evaluation_periods
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Only company owners/admins can manage evaluation periods" ON public.evaluation_periods
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('premium_corporate', 'admin', 'system_admin')
        )
    );

-- 5. POLICIES FOR evaluations
-- Managers/owners can read evaluations from their own company, but normal staff can only read where evaluatee_id is their own id.
CREATE POLICY "Firma Sahibi can view all evaluations" ON public.evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('premium_corporate', 'admin', 'system_admin')
            AND p.organization_id = (
                SELECT organization_id FROM public.profiles WHERE id = evaluatee_id
            )
        )
    );

CREATE POLICY "Managers can view evaluations they created" ON public.evaluations
    FOR SELECT USING (
        evaluator_id = auth.uid()
    );


-- Inserts: authenticated users with corporate rights can evaluate.
CREATE POLICY "Allow authenticated users to create evaluations" ON public.evaluations
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
        )
    );

-- Allow public insert of client evaluations (for token-based client ratings)
CREATE POLICY "Allow anonymous client evaluation inserts" ON public.evaluations
    FOR INSERT WITH CHECK (
        evaluator_type = 'client' AND evaluator_id IS NULL
    );

-- Allow company owners/admins to delete evaluations
CREATE POLICY "Only company owners/admins can delete evaluations" ON public.evaluations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('premium_corporate', 'admin', 'system_admin')
            AND p.organization_id = (
                SELECT organization_id FROM public.profiles WHERE id = evaluatee_id
            )
        )
    );

-- 6. POLICIES FOR evaluation_client_tokens
CREATE POLICY "Manage client tokens" ON public.evaluation_client_tokens
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
        )
    );

CREATE POLICY "Allow public select by token value" ON public.evaluation_client_tokens
    FOR SELECT USING (
        true
    );

CREATE POLICY "Allow public update of is_used on token verification" ON public.evaluation_client_tokens
    FOR UPDATE USING (
        is_used = false AND expires_at > now()
    )
    WITH CHECK (
        is_used = true
    );

