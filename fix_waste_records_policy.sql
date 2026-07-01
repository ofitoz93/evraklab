-- Run this SQL in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- This will update the SELECT RLS policy on public.waste_records to allow client users
-- to view their own company's waste records.

DROP POLICY IF EXISTS "Select waste_records" ON public.waste_records;

CREATE POLICY "Select waste_records" ON public.waste_records
    FOR SELECT TO authenticated USING (
        -- 1. Admins and system admins can view all records
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        
        -- 2. Consultant managers or chiefs can view all records of clients served by their company
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND p.role IN ('premium_corporate', 'corporate_chief')
              AND cc.id = waste_records.client_id
        ) OR
        
        -- 3. The user who created the record
        created_by = auth.uid() OR
        
        -- 4. Consultants assigned to this client via consultant_assignments
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = waste_records.client_id
        ) OR

        -- 5. NEW: Client users (customer portal) can view their own company's waste records
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'client'
              AND p.client_id = waste_records.client_id
        )
    );
