-- 1. Create client_required_documents table
CREATE TABLE IF NOT EXISTS public.client_required_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.consultant_clients(id) ON DELETE CASCADE,
    type_def_id UUID REFERENCES public.user_definitions(id) ON DELETE CASCADE,
    is_exempt BOOLEAN DEFAULT FALSE,
    exempt_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, type_def_id)
);

-- Enable RLS
ALTER TABLE public.client_required_documents ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for client_required_documents
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.client_required_documents;
CREATE POLICY "Allow select for authenticated users" ON public.client_required_documents
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.client_required_documents;
CREATE POLICY "Allow insert for authenticated users" ON public.client_required_documents
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.client_required_documents;
CREATE POLICY "Allow update for authenticated users" ON public.client_required_documents
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.client_required_documents;
CREATE POLICY "Allow delete for authenticated users" ON public.client_required_documents
    FOR DELETE TO authenticated USING (true);

-- 3. Restructure user_definitions SELECT, INSERT, UPDATE, DELETE policies for organization-wide access
DROP POLICY IF EXISTS "Allow users to view definitions" ON public.user_definitions;
CREATE POLICY "Allow users to view definitions" ON public.user_definitions
FOR SELECT TO authenticated USING (
  -- Personal definitions: only the owner can see them
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate definitions: any authenticated member of the organization can view
  (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id = user_definitions.organization_id
    )
  )
);

DROP POLICY IF EXISTS "Allow users to insert definitions" ON public.user_definitions;
CREATE POLICY "Allow users to insert definitions" ON public.user_definitions
FOR INSERT TO authenticated WITH CHECK (
  -- Personal: owner can insert
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: any authenticated member of the organization can insert
  (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id = user_definitions.organization_id
    )
    AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow users to update definitions" ON public.user_definitions;
CREATE POLICY "Allow users to update definitions" ON public.user_definitions
FOR UPDATE TO authenticated USING (
  -- Personal: owner can update
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: any authenticated member of the organization can update
  (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id = user_definitions.organization_id
    )
  )
);

DROP POLICY IF EXISTS "Allow users to delete definitions" ON public.user_definitions;
CREATE POLICY "Allow users to delete definitions" ON public.user_definitions
FOR DELETE TO authenticated USING (
  (
    -- Personal: owner can delete
    (organization_id IS NULL AND user_id = auth.uid())
    OR
    -- Corporate: any authenticated member of the organization can delete
    (
      organization_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.organization_id = user_definitions.organization_id
      )
    )
  )
  -- Restrict deleting locations that match registered businesses in the organization
  AND NOT (
    category = 'location'
    AND organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.consultant_company_id = user_definitions.organization_id
      AND LOWER(cc.name) = LOWER(user_definitions.label)
    )
  )
);
