-- ==========================================================
-- CREATE VISIT SCHEDULES & CHANGE REQUESTS MODULE
-- ==========================================================

-- 1. Create visit_schedules table
CREATE TABLE IF NOT EXISTS public.visit_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultant_company_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.consultant_clients(id) ON DELETE CASCADE,
    personnel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Nullable, tracks who made the change request
    visit_date DATE NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
    -- Change requests fields
    change_request_status TEXT DEFAULT 'none', -- 'none', 'pending', 'approved', 'rejected'
    change_request_reason TEXT,
    change_request_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.visit_schedules ENABLE ROW LEVEL SECURITY;

-- Drop NOT NULL constraint on personnel_id if it exists from previous installations
ALTER TABLE public.visit_schedules ALTER COLUMN personnel_id DROP NOT NULL;

-- 3. Drop existing policies to avoid duplication errors
DROP POLICY IF EXISTS "Users can view visit schedules of their organization" ON public.visit_schedules;
DROP POLICY IF EXISTS "Users can view visit schedules of their organization" ON visit_schedules;
DROP POLICY IF EXISTS "Managers can manage visit schedules of their organization" ON public.visit_schedules;
DROP POLICY IF EXISTS "Managers can manage visit schedules of their organization" ON visit_schedules;
DROP POLICY IF EXISTS "Staff can request changes on their assigned visit schedules" ON public.visit_schedules;
DROP POLICY IF EXISTS "Staff can request changes on their assigned visit schedules" ON visit_schedules;
DROP POLICY IF EXISTS "Staff can request changes on their assigned client visit schedules" ON public.visit_schedules;
DROP POLICY IF EXISTS "Staff can request changes on their assigned client visit schedules" ON visit_schedules;

-- 4. Create RLS Policies
-- Allow users to view visit schedules belonging to their own organization (managers see all, restricted roles see only assigned client visits)
CREATE POLICY "Users can view visit schedules of their organization" 
ON public.visit_schedules FOR SELECT
USING (
  -- 1. Managers/Admins can view all visit schedules in their organization
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND organization_id = visit_schedules.consultant_company_id
      AND (role IN ('premium_corporate', 'admin', 'system_admin') 
           OR (role = 'corporate_chief' AND (extra_permissions->>'can_view_all_clients')::boolean = true))
  )
  OR
  -- 2. Staff/Chiefs with restricted view see only their assigned clients' visit schedules
  EXISTS (
    SELECT 1 FROM public.consultant_assignments ca
    WHERE ca.client_id = visit_schedules.client_id
      AND ca.user_id = auth.uid()
  )
);

-- Allow managers to manage (insert, update, delete) schedules of their organization
CREATE POLICY "Managers can manage visit schedules of their organization" 
ON public.visit_schedules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND organization_id = visit_schedules.consultant_company_id
      AND role IN ('premium_corporate', 'corporate_chief')
  )
);

-- Allow assigned staff members to request changes if they are assigned to the client via consultant_assignments
CREATE POLICY "Staff can request changes on their assigned client visit schedules" 
ON public.visit_schedules FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.consultant_assignments ca
    WHERE ca.client_id = visit_schedules.client_id
      AND ca.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.consultant_assignments ca
    WHERE ca.client_id = visit_schedules.client_id
      AND ca.user_id = auth.uid()
  )
);
