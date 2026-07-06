-- ==========================================================
-- ADD ORGANIZATION_ID COLUMN & FIX USER_DEFINITIONS RLS POLICIES
-- ==========================================================

-- 1. Add organization_id column if it does not exist
ALTER TABLE public.user_definitions 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Migrate existing definitions: associate them with their creator's organization_id
UPDATE public.user_definitions ud
SET organization_id = p.organization_id
FROM public.profiles p
WHERE p.id = ud.user_id
AND p.organization_id IS NOT NULL
AND ud.organization_id IS NULL;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_definitions ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow users to view definitions in same organization" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to insert their own definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to update their own definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to delete their own definitions" ON public.user_definitions;

DROP POLICY IF EXISTS "Allow managers to insert definitions for same organization" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow managers to update definitions for same organization" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow managers to delete definitions for same organization" ON public.user_definitions;

DROP POLICY IF EXISTS "Allow users to view definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to insert definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to update definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to delete definitions" ON public.user_definitions;

-- 5. Create SELECT policy: User can view their own personal definitions, or corporate definitions if they are a manager/chief, or their own corporate definitions
CREATE POLICY "Allow users to view definitions" ON public.user_definitions
FOR SELECT TO authenticated USING (
  -- Personal definitions: only the owner can see them
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate definitions:
  (
    organization_id IS NOT NULL 
    AND (
      -- 1. Managers, chiefs, and admins can view all definitions in their organization
      EXISTS (
        SELECT 1 FROM public.profiles manager
        WHERE manager.id = auth.uid()
        AND manager.organization_id = user_definitions.organization_id
        AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
      )
      OR
      -- 2. Normal staff can only view definitions assigned to themselves
      user_id = auth.uid()
    )
  )
);

-- 6. Create INSERT policy: User can insert personal definitions, OR managers/chiefs/admins can insert corporate definitions for their organization
CREATE POLICY "Allow users to insert definitions" ON public.user_definitions
FOR INSERT TO authenticated WITH CHECK (
  -- Personal: owner can insert
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: managers, chiefs, admins of the organization can insert
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
);

-- 7. Create UPDATE policy: User can update personal definitions, OR managers/chiefs/admins can update corporate definitions for their organization
CREATE POLICY "Allow users to update definitions" ON public.user_definitions
FOR UPDATE TO authenticated USING (
  -- Personal: owner can update
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: managers/chiefs/admins of the organization can update
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
) WITH CHECK (
  -- Personal: owner can update
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: managers/chiefs/admins of the organization can update
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
);

-- 8. Create DELETE policy: User can delete personal definitions, OR managers/chiefs/admins can delete corporate definitions
-- RESTRICTION: Cannot delete locations that match registered clients in the organization
CREATE POLICY "Allow users to delete definitions" ON public.user_definitions
FOR DELETE TO authenticated USING (
  (
    -- Personal: owner can delete
    (organization_id IS NULL AND user_id = auth.uid())
    OR
    -- Corporate: managers/chiefs/admins of the organization can delete
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles target
        JOIN public.profiles manager ON manager.organization_id = target.organization_id
        WHERE manager.id = auth.uid()
        AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'premium_individual')
        AND target.id = user_definitions.user_id
        AND manager.organization_id = user_definitions.organization_id
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

