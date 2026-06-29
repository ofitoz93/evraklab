-- ==========================================================
-- FIX USER_DEFINITIONS INSERT & UPDATE RLS POLICIES
-- ==========================================================

-- Drop the restrictive policies
DROP POLICY IF EXISTS "Allow users to insert definitions" ON public.user_definitions;
DROP POLICY IF EXISTS "Allow users to update definitions" ON public.user_definitions;

-- 1. Create corrected INSERT policy
-- Allows managers/chiefs/admins to insert definitions for other members of the same organization
CREATE POLICY "Allow users to insert definitions" ON public.user_definitions
FOR INSERT TO authenticated WITH CHECK (
  -- Personal: owner can insert
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: any authenticated member of the organization can insert for themselves
  (
    organization_id IS NOT NULL 
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id = user_definitions.organization_id
    )
  )
  OR
  -- Corporate (manager/chief/admin): can insert for any member of their organization
  (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles manager
      WHERE manager.id = auth.uid()
      AND manager.organization_id = user_definitions.organization_id
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.id = user_definitions.user_id
      AND target.organization_id = user_definitions.organization_id
    )
  )
);

-- 2. Create corrected UPDATE policy
-- Allows managers/chiefs/admins to update definitions for other members of the same organization
CREATE POLICY "Allow users to update definitions" ON public.user_definitions
FOR UPDATE TO authenticated USING (
  -- Personal: owner can update
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: any authenticated member of the organization can update their own definitions
  (
    organization_id IS NOT NULL 
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id = user_definitions.organization_id
    )
  )
  OR
  -- Corporate (manager/chief/admin): can update definitions for any member of their organization
  (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles manager
      WHERE manager.id = auth.uid()
      AND manager.organization_id = user_definitions.organization_id
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
    )
  )
);
