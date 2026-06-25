-- ==========================================================
-- UPDATE RLS POLICIES FOR VISIT SCHEDULE REQUESTS
-- Run this in your Supabase SQL Editor
-- ==========================================================

-- 1. Drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "Staff can request new visits for their assigned clients" ON public.visit_schedules;
DROP POLICY IF EXISTS "Staff can delete or update their own pending requests" ON public.visit_schedules;

-- 2. Create policy to allow staff members to INSERT new visit requests
-- Staff can only insert if they are assigned to the client and the status is 'requested' with their own profile ID
CREATE POLICY "Staff can request new visits for their assigned clients"
ON public.visit_schedules FOR INSERT
WITH CHECK (
  -- Must be assigned to the client via consultant_assignments
  EXISTS (
    SELECT 1 FROM public.consultant_assignments ca
    WHERE ca.client_id = visit_schedules.client_id
      AND ca.user_id = auth.uid()
  )
  -- The visit status must be marked as 'requested' (pending manager approval)
  AND status = 'requested'
  -- The personnel_id must be the requesting user's own ID
  AND personnel_id = auth.uid()
);

-- 3. Create policy to allow staff members to UPDATE or DELETE their own pending requests
CREATE POLICY "Staff can delete or update their own pending requests"
ON public.visit_schedules FOR ALL
USING (
  personnel_id = auth.uid()
  AND status = 'requested'
)
WITH CHECK (
  personnel_id = auth.uid()
  AND status = 'requested'
);
