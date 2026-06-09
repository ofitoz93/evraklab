-- Existing SELECT policy on env_reports needs to be dropped and recreated to allow the creator to view it.
DROP POLICY IF EXISTS "Users can view reports in their company" ON env_reports;

CREATE POLICY "Users can view reports in their company"
ON env_reports FOR SELECT
USING (
    consultant_company_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR creator_id = auth.uid()
);
