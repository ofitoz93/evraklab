-- 1. Add kep_address to consultant_clients
ALTER TABLE public.consultant_clients ADD COLUMN IF NOT EXISTS kep_address TEXT;

-- 2. Create client_change_requests table
CREATE TABLE IF NOT EXISTS public.client_change_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.consultant_clients(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    new_name TEXT,
    new_address TEXT,
    gazette_pdf_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 3. Enable RLS
ALTER TABLE public.client_change_requests ENABLE ROW LEVEL SECURITY;

-- 4. Create policies
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.client_change_requests;
CREATE POLICY "Allow select for authenticated users" ON public.client_change_requests
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.client_change_requests;
CREATE POLICY "Allow insert for authenticated users" ON public.client_change_requests
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.client_change_requests;
CREATE POLICY "Allow update for authenticated users" ON public.client_change_requests
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.client_change_requests;
CREATE POLICY "Allow delete for authenticated users" ON public.client_change_requests
    FOR DELETE TO authenticated USING (true);
